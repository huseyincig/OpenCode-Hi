#!/usr/bin/env node

import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRODUCT='OpenCode-Hi'
const SHORT='HI'
const PACKAGE='opencode-hi'
const OWNERSHIP_SCHEMA=2
const SETUP_STATE_SCHEMA=1
const ROUTING_SCHEMA=1
const OWNERSHIP='.opencode/hi/provenance/setup.json'
const TRANSACTION='.opencode/hi/provenance/setup-transaction.json'
const ROLLBACK='.opencode/hi/provenance/setup-rollback.json'
const ROUTING='.opencode/hi/policy/routing.json'
const scriptDir=dirname(fileURLToPath(import.meta.url))
const packageRoot=resolve(scriptDir,'..')
const packageVersion=JSON.parse(readFileSync(join(packageRoot,'package.json'),'utf8')).version

class SetupError extends Error{
  constructor(reason,{path,detail,action}={}){super(detail??reason);this.reason=reason;this.path=path;this.detail=detail;this.action=action}
}

const now=()=>Math.floor(Date.now()/1000)
const sha=text=>createHash('sha256').update(text).digest('hex')
const dump=value=>JSON.stringify(value,null,2)+'\n'
const hiSpec=version=>`${PACKAGE}@${version??packageVersion}`
const isHi=value=>typeof value==='string'&&(value===PACKAGE||value.startsWith(`${PACKAGE}@`)||value.includes('OpenCode-Hi'))
const plugins=data=>Array.isArray(data?.plugin)?data.plugin.filter(x=>typeof x==='string'):[]
const hiEntries=list=>list.flatMap((value,index)=>isHi(value)?[[index,value]]:[])

function modeFor(path,fallback){try{return statSync(path).mode&0o777}catch{return fallback}}
function atomicWrite(path,text,mode){
  mkdirSync(dirname(path),{recursive:true})
  const chosen=mode??modeFor(path,0o644)
  const tmp=join(dirname(path),`.${path.split(sep).at(-1)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  let fd
  try{
    fd=openSync(tmp,'wx',chosen)
    writeFileSync(fd,text,'utf8');fsyncSync(fd);closeSync(fd);fd=undefined
    try{chmodSync(tmp,chosen)}catch{}
    renameSync(tmp,path)
    try{const dfd=openSync(dirname(path),'r');fsyncSync(dfd);closeSync(dfd)}catch{}
  }finally{
    if(fd!==undefined)try{closeSync(fd)}catch{}
    if(existsSync(tmp))try{unlinkSync(tmp)}catch{}
  }
}
function writeState(path,value){atomicWrite(path,dump(value),0o600)}
function removeState(path){if(existsSync(path))unlinkSync(path)}

function load(path){
  if(!existsSync(path))return{}
  let raw
  try{raw=JSON.parse(readFileSync(path,'utf8'))}catch(error){throw new SetupError('invalid-json-input',{path,detail:String(error).slice(0,500),action:'Repair or restore this JSON file before running OpenCode-Hi setup; Hi will not overwrite malformed input.'})}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new SetupError('json-root-must-be-object',{path,detail:`observed ${Array.isArray(raw)?'array':typeof raw}`,action:'Change the JSON root to an object before retrying setup.'})
  return raw
}

function projectPath(raw='.'){
  const expanded=raw.startsWith('~/')&&process.env.HOME?join(process.env.HOME,raw.slice(2)):raw
  return resolve(expanded)
}
function managedPathSafe(project,path){
  const root=resolve(project),target=resolve(path),rel=relative(root,target)
  if(rel.startsWith('..'+sep)||rel==='..'||isAbsolute(rel))return false
  let current=root
  for(const part of rel.split(sep).filter(Boolean)){
    current=join(current,part)
    if(existsSync(current)){try{if(lstatSync(current).isSymbolicLink())return false}catch{return false}}
  }
  return target===root||target.startsWith(root+sep)
}
function assertManaged(project,...paths){
  const unsafe=paths.filter(path=>!managedPathSafe(project,path)).map(String)
  if(unsafe.length)throw new SetupError('managed-path-escapes-project-or-uses-symlink',{detail:unsafe.join(', '),action:'Remove the symlink/escape and keep Hi-owned setup state inside the project.'})
}
function configPath(project){
  const json=join(project,'opencode.json'),jsonc=join(project,'opencode.jsonc')
  return existsSync(json)||!existsSync(jsonc)?json:jsonc
}
function relativeConfig(project,cfg){return relative(project,cfg).split(sep).join('/')}
function mutationGuard(project,...paths){
  const tx=join(project,TRANSACTION),rb=join(project,ROLLBACK)
  assertManaged(project,...paths,tx,rb)
  if(existsSync(tx))throw new SetupError('pending-setup-transaction-run-recover',{path:tx,action:'Run: npx opencode-hi recover <project> before any further setup mutation.'})
}
function jsoncBlocked(cfg){
  if(cfg.endsWith('.jsonc'))throw new SetupError('jsonc-safe-mutation-not-supported',{path:cfg,action:'Convert or maintain opencode.json explicitly; Hi will not parse/rewrite JSONC and risk losing comments.'})
}
function ownershipDoc(project,cfg,pluginSpec,beforeSha,afterSha,installedAt){
  return {schema:OWNERSHIP_SCHEMA,product:PRODUCT,short:SHORT,plugin_spec:pluginSpec,managed:{config:{path:relativeConfig(project,cfg),before_sha256:beforeSha,after_sha256:afterSha,plugin_spec:pluginSpec}},preserved:{user_plugins:true},installed_at:installedAt??now()}
}
function lifecycleRecord(operation,project,cfg,beforeText,afterText,beforeSpec,afterSpec,beforeIndex,afterIndex,beforeOwnership,nextOwnership,beforeConfigExisted){
  return {schema:SETUP_STATE_SCHEMA,type:'hi-setup-lifecycle',operation,config_path:relativeConfig(project,cfg),before_config_existed:beforeConfigExisted,after_config_existed:true,before_config_sha256:sha(beforeText),after_config_sha256:sha(afterText),before_plugin_spec:beforeSpec,after_plugin_spec:afterSpec,before_index:beforeIndex,after_index:afterIndex,before_ownership:beforeOwnership,next_ownership:nextOwnership,created_at:now()}
}
function applyLifecycle(project,operation,cfg,beforeText,afterDoc,beforeSpec,afterSpec,beforeIndex,afterIndex,beforeOwnership,nextOwnership){
  const beforeExists=existsSync(cfg),afterText=dump(afterDoc),txPath=join(project,TRANSACTION),rbPath=join(project,ROLLBACK),ownPath=join(project,OWNERSHIP)
  const tx=lifecycleRecord(operation,project,cfg,beforeText,afterText,beforeSpec,afterSpec,beforeIndex,afterIndex,beforeOwnership,nextOwnership,beforeExists)
  tx.status='planned';writeState(txPath,tx)
  atomicWrite(cfg,afterText)
  tx.status='config-applied';writeState(txPath,tx)
  if(nextOwnership===null)removeState(ownPath);else writeState(ownPath,nextOwnership)
  tx.status='ownership-applied';writeState(txPath,tx)
  const rollback={...tx,type:'hi-setup-rollback',status:'committed',committed_at:now()}
  writeState(rbPath,rollback);removeState(txPath)
  return {status:'APPLIED',operation,config:cfg,plugin_spec:afterSpec,rollback_available:true,restart_required:true}
}

function plan(project,version){
  const cfg=configPath(project),target=hiSpec(version)
  assertManaged(project,cfg)
  if(cfg.endsWith('.jsonc'))return{status:'BLOCKED',product:PRODUCT,short:SHORT,project,config:cfg,plugin_spec:target,reason:'jsonc-safe-mutation-not-supported',action:'Convert or maintain opencode.json explicitly; Hi will not rewrite JSONC.',changed:false}
  const data=load(cfg),before=plugins(data),hits=before.filter(isHi),foreign=hits.filter(x=>x!==target),after=[...before.filter(x=>!isHi(x)),target]
  return {status:foreign.length?'BLOCKED':'READY',product:PRODUCT,short:SHORT,project,config:cfg,plugin_spec:target,conflicting_hi_specs:foreign,before_plugins:before,after_plugins:after,changed:JSON.stringify(before)!==JSON.stringify(after),...(foreign.length?{reason:'conflicting-hi-registration',action:'Remove/resolve the conflicting Hi registration before setup.'}:{action:'Run setup to apply this exact registration plan.'})}
}

function setup(project,version){
  const target=hiSpec(version),cfg=configPath(project),ownPath=join(project,OWNERSHIP)
  mutationGuard(project,cfg,ownPath);jsoncBlocked(cfg)
  const data=load(cfg),beforePlugins=plugins(data),hits=hiEntries(beforePlugins),ownership=existsSync(ownPath)?load(ownPath):{},ownedSpec=ownership?.managed?.config?.plugin_spec
  if(ownedSpec){
    if(hits.map(([,x])=>x).length===1&&hits[0][1]===ownedSpec&&ownedSpec===target)return{status:'NOOP',product:PRODUCT,config:cfg,plugin_spec:target,reason:'already-installed-owned'}
    throw new SetupError('existing-owned-install-use-update',{path:cfg,detail:`owned=${ownedSpec}; target=${target}`,action:'Run: npx opencode-hi update <project>'})
  }
  if(hits.length>1||(hits.length===1&&hits[0][1]!==target))throw new SetupError('conflicting-hi-registration',{path:cfg,detail:hits.map(([,x])=>x).join(', '),action:'Resolve the conflicting Hi registration before setup.'})
  mkdirSync(project,{recursive:true});mkdirSync(dirname(cfg),{recursive:true})
  const beforeText=existsSync(cfg)?readFileSync(cfg,'utf8'):'',beforeSpec=hits[0]?.[1]??null,beforeIndex=hits[0]?.[0]??null
  const afterPlugins=[...beforePlugins];if(!hits.length)afterPlugins.push(target)
  const afterDoc={...data,plugin:afterPlugins},afterText=dump(afterDoc),afterIndex=afterPlugins.indexOf(target)
  const nextOwnership=ownershipDoc(project,cfg,target,sha(beforeText),sha(afterText))
  const out=applyLifecycle(project,'install',cfg,beforeText,afterDoc,beforeSpec,target,beforeIndex,afterIndex,null,nextOwnership)
  return {...out,product:PRODUCT,routing_initialization:'pending-effective-runtime-inventory',next:'Restart OpenCode. Hi will initialize recommended child routing only from the effective runtime inventory; then run npx opencode-hi doctor <project> and the in-runtime hi_doctor tool.'}
}

function update(project,version){
  const cfg=configPath(project),ownPath=join(project,OWNERSHIP),target=hiSpec(version)
  mutationGuard(project,cfg,ownPath);jsoncBlocked(cfg)
  if(!existsSync(ownPath))throw new SetupError('ownership-proof-missing',{path:cfg,action:'Inspect the existing Hi registration first; update will not claim user-owned state.'})
  const ownership=load(ownPath),managed=ownership?.managed?.config??{},ownedSpec=managed.plugin_spec
  if(!ownedSpec)throw new SetupError('ownership-proof-invalid',{path:ownPath})
  const data=load(cfg),beforePlugins=plugins(data),hits=hiEntries(beforePlugins)
  if(hits.map(([,x])=>x).length!==1||hits[0][1]!==ownedSpec)throw new SetupError('owned-plugin-drift',{path:cfg,detail:`owned=${ownedSpec}; observed=${hits.map(([,x])=>x).join(', ')}`,action:'Review user/config changes before updating; Hi will not overwrite drift blindly.'})
  if(ownedSpec===target)return{status:'NOOP',product:PRODUCT,config:cfg,plugin_spec:target,reason:'already-at-target'}
  const beforeText=existsSync(cfg)?readFileSync(cfg,'utf8'):dump(data),index=hits[0][0],afterPlugins=[...beforePlugins];afterPlugins[index]=target
  const afterDoc={...data,plugin:afterPlugins},afterText=dump(afterDoc),nextOwnership=ownershipDoc(project,cfg,target,sha(beforeText),sha(afterText),ownership.installed_at)
  const out=applyLifecycle(project,'upgrade',cfg,beforeText,afterDoc,ownedSpec,target,index,index,ownership,nextOwnership)
  return {...out,product:PRODUCT,from_plugin_spec:ownedSpec,to_plugin_spec:target,next:'Restart OpenCode so the native package cache loads the exact updated Hi registration, then run hi doctor.'}
}

function setHiRegistration(data,beforeSpec,afterSpec,beforeIndex){
  const list=plugins(data),hits=hiEntries(list),expected=beforeSpec===null?[]:[beforeSpec]
  if(JSON.stringify(hits.map(([,x])=>x))!==JSON.stringify(expected))throw new SetupError('setup-rollback-registration-drift',{detail:`expected=${expected.join(',')} observed=${hits.map(([,x])=>x).join(',')}`})
  if(beforeSpec!==null){const index=hits[0][0];if(afterSpec===null)list.splice(index,1);else list[index]=afterSpec}
  else if(afterSpec!==null){const index=beforeIndex===null?list.length:Math.max(0,Math.min(list.length,beforeIndex));list.splice(index,0,afterSpec)}
  return {...data,plugin:list}
}
function rollback(project){
  const cfg=configPath(project),ownPath=join(project,OWNERSHIP),rbPath=join(project,ROLLBACK)
  mutationGuard(project,cfg,ownPath,rbPath)
  if(!existsSync(rbPath))return{status:'NOOP',product:PRODUCT,reason:'no-setup-rollback-point'}
  const rb=load(rbPath)
  if(rb.schema!==SETUP_STATE_SCHEMA||rb.type!=='hi-setup-rollback'||rb.status!=='committed')throw new SetupError('invalid-setup-rollback-state',{path:rbPath})
  const currentExists=existsSync(cfg),currentText=currentExists?readFileSync(cfg,'utf8'):''
  if(!currentExists||sha(currentText)!==rb.after_config_sha256)throw new SetupError('setup-rollback-config-drift',{path:cfg,action:'Review user/config changes before rollback; Hi will not overwrite drift blindly.'})
  const beforeDoc=setHiRegistration(load(cfg),rb.after_plugin_spec??null,rb.before_plugin_spec??null,rb.before_index??null)
  if(rb.before_config_existed===false)unlinkSync(cfg);else atomicWrite(cfg,dump(beforeDoc))
  if(rb.before_ownership===null)removeState(ownPath);else if(rb.before_ownership&&typeof rb.before_ownership==='object'&&!Array.isArray(rb.before_ownership))writeState(ownPath,rb.before_ownership);else throw new SetupError('invalid-setup-rollback-ownership',{path:rbPath})
  removeState(rbPath)
  return{status:'APPLIED',product:PRODUCT,operation:'rollback',rolled_back_operation:rb.operation,config:cfg,restored_plugin_spec:rb.before_plugin_spec??null,rollback_available:false,restart_required:true}
}
function recover(project){
  const cfg=configPath(project),ownPath=join(project,OWNERSHIP),txPath=join(project,TRANSACTION),rbPath=join(project,ROLLBACK)
  assertManaged(project,cfg,ownPath,txPath,rbPath)
  if(!existsSync(txPath))return{status:'NOOP',product:PRODUCT,reason:'no-pending-setup-transaction'}
  const tx=load(txPath)
  if(tx.schema!==SETUP_STATE_SCHEMA||tx.type!=='hi-setup-lifecycle'||!['planned','config-applied','ownership-applied'].includes(tx.status))throw new SetupError('invalid-pending-setup-transaction',{path:txPath})
  const currentExists=existsSync(cfg),currentText=currentExists?readFileSync(cfg,'utf8'):'',currentSha=sha(currentText)
  if(currentExists===Boolean(tx.before_config_existed)&&currentSha===tx.before_config_sha256){removeState(txPath);return{status:'RECOVERED',product:PRODUCT,disposition:'rolled-back-before-config',operation:tx.operation}}
  if(!currentExists||currentSha!==tx.after_config_sha256)throw new SetupError('pending-setup-transaction-config-drift',{path:cfg,detail:`operation=${tx.operation}`})
  if(tx.next_ownership===null)removeState(ownPath);else if(tx.next_ownership&&typeof tx.next_ownership==='object'&&!Array.isArray(tx.next_ownership))writeState(ownPath,tx.next_ownership);else throw new SetupError('invalid-pending-setup-ownership',{path:txPath})
  const rollbackDoc={...tx,type:'hi-setup-rollback',status:'committed',committed_at:now()};writeState(rbPath,rollbackDoc);removeState(txPath)
  return{status:'RECOVERED',product:PRODUCT,disposition:'completed-interrupted-operation',operation:tx.operation,rollback_available:true,restart_required:true}
}

function doctor(project){
  const cfg=configPath(project);assertManaged(project,cfg,join(project,OWNERSHIP),join(project,TRANSACTION),join(project,ROLLBACK),join(project,ROUTING))
  let data
  try{data=load(cfg)}catch(error){if(error instanceof SetupError)return{status:'FAIL',product:PRODUCT,short:SHORT,config:cfg,issues:[error.reason],warnings:[],actions:[error.action??'Repair the OpenCode config before setup.']};throw error}
  const hi=plugins(data).filter(isHi),ownPath=join(project,OWNERSHIP),txPath=join(project,TRANSACTION),rbPath=join(project,ROLLBACK),routingPath=join(project,ROUTING),ownership=existsSync(ownPath)?load(ownPath):{},managed=ownership?.managed?.config??{},recordedAfter=managed.after_sha256
  const configDrift=recordedAfter&&existsSync(cfg)?sha(readFileSync(cfg,'utf8'))!==recordedAfter:null
  const routing=existsSync(routingPath)?load(routingPath):{},routingSchema=existsSync(routingPath)?routing.schema:null,issues=[],warnings=[],actions=[]
  if(!hi.length)issues.push('hi-plugin-not-registered')
  if(hi.length>1)issues.push('duplicate-hi-registration')
  if(hi.length&&!existsSync(ownPath))warnings.push('ownership-proof-missing')
  if(configDrift===true)warnings.push('managed-config-drift')
  if(existsSync(routingPath)&&routingSchema!==ROUTING_SCHEMA)issues.push('unsupported-routing-schema')
  if(existsSync(txPath))issues.push('pending-setup-transaction')
  if(!existsSync(routingPath)&&hi.length)warnings.push('routing-policy-pending-effective-runtime')
  if(issues.includes('hi-plugin-not-registered'))actions.push(`Run: npx ${PACKAGE} setup ${project}`)
  if(issues.includes('duplicate-hi-registration'))actions.push('Remove the duplicate/conflicting Hi registration; keep one exact owned plugin entry.')
  if(issues.includes('unsupported-routing-schema'))actions.push(`Repair or regenerate ${routingPath}; only routing schema ${ROUTING_SCHEMA} is supported.`)
  if(issues.includes('pending-setup-transaction'))actions.push(`Run: npx ${PACKAGE} recover ${project}`)
  if(warnings.includes('ownership-proof-missing'))actions.push('Do not update/rollback as Hi-owned until ownership is re-established; inspect the existing registration first.')
  if(warnings.includes('managed-config-drift'))actions.push('Review user changes before rollback/update; Hi will not overwrite drift blindly.')
  if(warnings.includes('routing-policy-pending-effective-runtime'))actions.push('Restart OpenCode once. Hi initializes recommended routing only after the host exposes the effective runtime provider/model inventory; then run the in-runtime hi_doctor tool.')
  return{status:issues.length?'FAIL':warnings.length?'WARN':'OK',product:PRODUCT,short:SHORT,config:cfg,hi_specs:hi,ownership:{state:!existsSync(ownPath)?'missing':ownership&&Object.keys(ownership).length?'healthy':'invalid',schema:ownership.schema,config_drift:configDrift},lifecycle:{transaction_pending:existsSync(txPath),rollback_available:existsSync(rbPath)},routing:{path:routingPath,schema:routingSchema,valid:!existsSync(routingPath)||routingSchema===ROUTING_SCHEMA,initialization:!existsSync(routingPath)?'pending-effective-runtime':'present'},issues,warnings,actions,note:'This package CLI verifies registration/ownership. Effective provider/model capability truth is verified by the loaded OpenCode runtime and the hi_doctor tool.'}
}

function parseArgs(argv){
  const args=[...argv],command=args.shift()??'help';let project='.',version
  if(args[0]&&!args[0].startsWith('-'))project=args.shift()
  while(args.length){const flag=args.shift();if(flag==='--version'){version=args.shift();if(!version)throw new SetupError('missing-version-value',{action:'Use --version <exact-version>.'})}else throw new SetupError('unsupported-cli-argument',{detail:String(flag),action:'Supported form: npx opencode-hi <setup|update|doctor|plan|rollback|recover> [project] [--version X].'})}
  return{command,project:projectPath(project),version}
}
function usage(){return `${PRODUCT} npm bootstrap\n\nUsage:\n  npx ${PACKAGE} setup [project] [--version X]\n  npx ${PACKAGE} update [project] [--version X]\n  npx ${PACKAGE} doctor [project]\n  npx ${PACKAGE} plan [project] [--version X]\n  npx ${PACKAGE} rollback [project]\n  npx ${PACKAGE} recover [project]\n\nThe normal path is setup -> restart OpenCode -> doctor. The package runner does not install project-root node_modules.\n`}

function main(){
  let out
  try{
    const {command,project,version}=parseArgs(process.argv.slice(2))
    if(command==='help'||command==='--help'||command==='-h'){process.stdout.write(usage());return 0}
    if(command==='setup'||command==='install')out=setup(project,version)
    else if(command==='update'||command==='upgrade')out=update(project,version)
    else if(command==='doctor')out=doctor(project)
    else if(command==='plan')out=plan(project,version)
    else if(command==='rollback')out=rollback(project)
    else if(command==='recover')out=recover(project)
    else throw new SetupError('unsupported-command',{detail:command,action:'Run: npx opencode-hi --help'})
  }catch(error){
    if(error instanceof SetupError)out={status:'BLOCKED',product:PRODUCT,reason:error.reason,...(error.path?{path:String(error.path)}:{}),...(error.detail?{detail:String(error.detail).slice(0,500)}:{}),...(error.action?{action:error.action}:{})}
    else out={status:'BLOCKED',product:PRODUCT,reason:'filesystem-or-runtime-operation-failed',detail:String(error).slice(0,500),action:'Check project path permissions/ownership and retry; no successful setup mutation is claimed.'}
  }
  process.stdout.write(dump(out))
  return ['BLOCKED','FAIL'].includes(out?.status)?2:0
}

process.exitCode=main()
