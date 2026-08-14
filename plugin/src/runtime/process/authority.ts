import { realpathSync } from 'node:fs'
import { resolve,sep } from 'node:path'
import { isExternalActionContract } from '../../contracts/external-action.js'
import { externalActionType } from '../safety/command-classifier.js'
import { evaluateShellCommand } from './shell-policy.js'
import type { ProcessPermissionDecision,ProcessSpawnRequest } from './executor.js'

export interface ProcessPermissionRequest{permission:'bash'|'external_directory';pattern:string;patterns:string[];always:string[];metadata:Record<string,unknown>}
export interface ProcessSpawnAuthorityResult{decision:'ALLOW'|'ASK'|'DENY';reason:string;command_line:string;external_cwd:boolean;permission_request?:ProcessPermissionRequest}
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function wildcard(input:string,pattern:string):boolean{const normalized=input.replaceAll('\\','/'),source=pattern.replaceAll('\\','/');let escaped=source.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.');if(escaped.endsWith(' .*'))escaped=escaped.slice(0,-3)+'( .*)?';return new RegExp('^'+escaped+'$',process.platform==='win32'?'si':'s').test(normalized)}
function permissionDecision(hostConfig:Record<string,unknown>,role:string,permission:string,pattern:string):ProcessPermissionDecision{
  const agents:Record<string,unknown>=record(hostConfig['agent'])?hostConfig['agent']:{}
  const roleValue=agents[role],agent:Record<string,unknown>=record(roleValue)?roleValue:{}
  const permissionValue=agent['permission'],permissions:Record<string,unknown>=record(permissionValue)?permissionValue:{}
  let result:ProcessPermissionDecision='ask'
  for(const permissionKey of Object.keys(permissions)){
    if(!wildcard(permission,permissionKey))continue
    const value=permissions[permissionKey]
    if(value==='allow'||value==='ask'||value==='deny'){result=value;continue}
    if(!record(value))continue
    for(const [rulePattern,action] of Object.entries(value))if(wildcard(pattern,rulePattern)&&(action==='allow'||action==='ask'||action==='deny'))result=action
  }
  return result
}
function quoted(value:string):string{return /^[A-Za-z0-9_./:@%+=,-]+$/.test(value)?value:`'${value.replaceAll("'",`'\\''`)}'`}
export function processCommandLine(request:Pick<ProcessSpawnRequest,'command'|'args'>):string{return[request.command,...request.args??[]].map(quoted).join(' ')}
function exactGrant(request:ProcessSpawnRequest,permission:'bash'|'external_directory',pattern:string):boolean{return(request.native_permission_grants??[]).some(grant=>grant.permission===permission&&grant.pattern===pattern)}
function canonical(path:string):string{try{return realpathSync(path)}catch{return resolve(path)}}
function outside(root:string,target:string):boolean{const r=canonical(root),t=canonical(target);return t!==r&&!t.startsWith(r+sep)}
export function evaluateProcessSpawnAuthority(request:ProcessSpawnRequest,projectRoot:string,hostConfig:Record<string,unknown>):ProcessSpawnAuthorityResult{
  const commandLine=processCommandLine(request),shell=evaluateShellCommand(commandLine),externalCwd=outside(projectRoot,request.cwd)
  if(shell.decision==='DENY')return{decision:'DENY',reason:`shell-policy:${shell.reason}`,command_line:commandLine,external_cwd:externalCwd}
  if(shell.decision==='USER_ACTION_REQUIRED'||shell.decision==='REWRITE')return{decision:'ASK',reason:`shell-policy:${shell.reason}`,command_line:commandLine,external_cwd:externalCwd}
  const bash=permissionDecision(hostConfig,request.role,'bash',commandLine)
  if(bash==='deny')return{decision:'DENY',reason:'bash-permission:deny',command_line:commandLine,external_cwd:externalCwd}
  if(bash==='ask'&&!exactGrant(request,'bash',commandLine))return{decision:'ASK',reason:'bash-permission:ask',command_line:commandLine,external_cwd:externalCwd,permission_request:{permission:'bash',pattern:commandLine,patterns:[commandLine],always:[commandLine],metadata:{command:commandLine,source:'hi-process-executor'}}}
  if(externalCwd){const pattern=canonical(request.cwd).replace(/[\\/]$/,'')+sep+'*',decision=permissionDecision(hostConfig,request.role,'external_directory',pattern);if(decision==='deny')return{decision:'DENY',reason:'external-directory-permission:deny',command_line:commandLine,external_cwd:true};if(decision==='ask'&&!exactGrant(request,'external_directory',pattern))return{decision:'ASK',reason:'external-directory-permission:ask',command_line:commandLine,external_cwd:true,permission_request:{permission:'external_directory',pattern,patterns:[pattern],always:[pattern],metadata:{command:commandLine,directories:[canonical(request.cwd)],patterns:[pattern],source:'hi-process-executor'}}}}
  const actionType=externalActionType(commandLine)
  if(actionType){const external=request.external_action;if(!external||!isExternalActionContract(external)||external.action_type!==actionType||!external.requested_explicitly||external.required_authority_ref!==request.authority_ref)return{decision:'ASK',reason:`external-action-authority-required:${actionType}`,command_line:commandLine,external_cwd:externalCwd}}
  if(!request.authority_ref.trim())return{decision:'DENY',reason:'authority-ref-missing',command_line:commandLine,external_cwd:externalCwd}
  return{decision:'ALLOW',reason:'native-permissions-and-authority-satisfied',command_line:commandLine,external_cwd:externalCwd}
}
