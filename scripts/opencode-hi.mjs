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
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { createInterface } from 'node:readline/promises'
import { applyProjectSettings } from '../plugin/dist/config/project-settings.js'

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
const CHILD_ROLES=['coder','architect','repository-explorer','qa-reviewer','security-reviewer','visual-qa']
const PRIMARY_ROLES=['manager','working-manager']
const EXECUTION_POLICIES=['minimal','balanced','thorough','adaptive','manual']
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
  return {...out,product:PRODUCT,routing_initialization:'pending-effective-runtime-settings',next:'Restart OpenCode, then ask “Hi ayarlarını göster” or use runtime hi_settings. Hi will show only OpenCode effective connected models; Adaptive + Automatic requires no persisted role mapping. Then run npx opencode-hi doctor <project> and runtime hi_doctor if diagnostics are needed.'}
}

function install(project,version){
  const ownPath=join(project,OWNERSHIP)
  return existsSync(ownPath)?update(project,version):setup(project,version)
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
  if(!existsSync(routingPath)&&hi.length)warnings.push('settings-policy-not-yet-persisted')
  if(issues.includes('hi-plugin-not-registered'))actions.push(`Run: npx ${PACKAGE} setup ${project}`)
  if(issues.includes('duplicate-hi-registration'))actions.push('Remove the duplicate/conflicting Hi registration; keep one exact owned plugin entry.')
  if(issues.includes('unsupported-routing-schema'))actions.push(`Repair or regenerate ${routingPath}; only routing schema ${ROUTING_SCHEMA} is supported.`)
  if(issues.includes('pending-setup-transaction'))actions.push(`Run: npx ${PACKAGE} recover ${project}`)
  if(warnings.includes('ownership-proof-missing'))actions.push('Do not update/rollback as Hi-owned until ownership is re-established; inspect the existing registration first.')
  if(warnings.includes('managed-config-drift'))actions.push('Review user changes before rollback/update; Hi will not overwrite drift blindly.')
  if(warnings.includes('settings-policy-not-yet-persisted'))actions.push('No explicit Hi settings are persisted yet. This is valid: Adaptive + Automatic can run without a routing file. After OpenCode starts, use runtime hi_settings to inspect effective connected models or save explicit preferences.')
  return{status:issues.length?'FAIL':warnings.length?'WARN':'OK',product:PRODUCT,short:SHORT,config:cfg,hi_specs:hi,ownership:{state:!existsSync(ownPath)?'missing':ownership&&Object.keys(ownership).length?'healthy':'invalid',schema:ownership.schema,config_drift:configDrift},lifecycle:{transaction_pending:existsSync(txPath),rollback_available:existsSync(rbPath)},routing:{path:routingPath,schema:routingSchema,valid:!existsSync(routingPath)||routingSchema===ROUTING_SCHEMA,initialization:!existsSync(routingPath)?'automatic-unpersisted':'present'},issues,warnings,actions,note:'This package CLI verifies registration/ownership. Effective provider/model capability truth is verified by the loaded OpenCode runtime and the hi_doctor tool.'}
}

function routingState(project){
  const path=join(project,ROUTING);assertManaged(project,path)
  if(!existsSync(path))return{path,exists:false,doc:{schema:ROUTING_SCHEMA,type:'hi-routing',routing:{}}}
  const doc=load(path)
  if(doc.schema!==ROUTING_SCHEMA)throw new SetupError('unsupported-routing-schema',{path,detail:`observed=${doc.schema??'missing'} expected=${ROUTING_SCHEMA}`,action:`Repair or regenerate ${path}; only routing schema ${ROUTING_SCHEMA} is supported.`})
  if(doc.routing!==undefined&&(!doc.routing||typeof doc.routing!=='object'||Array.isArray(doc.routing)))throw new SetupError('invalid-routing-shape',{path,detail:'routing must be an object'})
  return{path,exists:true,doc}
}
function writeRouting(project,state,doc){
  assertManaged(project,state.path)
  const next={...doc,schema:ROUTING_SCHEMA,type:doc.type??'hi-routing',applied_at:now(),applied_by:PACKAGE,ownership:doc.ownership??'project-routing-user-reconfigurable'}
  atomicWrite(state.path,dump(next),modeFor(state.path,0o600));return next
}
function stateView(project){
  const d=doctor(project),route=routingState(project),rr=route.doc.routing&&typeof route.doc.routing==='object'?route.doc.routing:{},roleModels=rr.roleModels&&typeof rr.roleModels==='object'&&!Array.isArray(rr.roleModels)?rr.roleModels:{}
  const registered=d.hi_specs?.length===1?d.hi_specs[0]:null
  return{status:d.status,product:PRODUCT,short:SHORT,project,package_runner_version:packageVersion,registered_plugin_spec:registered,registration:{config:d.config,hi_specs:d.hi_specs,ownership:d.ownership,lifecycle:d.lifecycle},routing:{path:route.path,configured:route.exists,execution_policy:route.doc.executionPolicy??null,primary_mode:route.doc.primaryMode??null,strategy:rr.strategy??null,role_models:Object.fromEntries(CHILD_ROLES.flatMap(role=>Array.isArray(roleModels[role])?[[role,roleModels[role]]]:[]))},issues:d.issues,warnings:d.warnings,actions:d.actions,note:'state is read-only package/project state. Live Mission/provider/model execution truth remains owned by in-runtime hi_status/hi_readiness/hi_doctor.'}
}
function reprofile(project,profile){
  if(!profile)throw new SetupError('profile-required',{action:`Use --profile ${EXECUTION_POLICIES.join('|')}.`})
  if(!EXECUTION_POLICIES.includes(profile))throw new SetupError('unsupported-execution-profile',{detail:profile,action:`Use one of: ${EXECUTION_POLICIES.join(', ')}.`})
  const state=routingState(project),before=state.doc.executionPolicy??null
  if(before===profile)return{status:'NOOP',product:PRODUCT,project,config:state.path,execution_policy:profile,reason:'already-at-profile'}
  const next=writeRouting(project,state,{...state.doc,executionPolicy:profile})
  return{status:'APPLIED',product:PRODUCT,project,config:state.path,from_execution_policy:before,to_execution_policy:next.executionPolicy,restart_required:true,note:'Only executionPolicy changed; unrelated routing/OpenCode fields were preserved.'}
}
function assertChildRole(role){
  if(PRIMARY_ROLES.includes(role))throw new SetupError('role-model-primary-owned-by-opencode',{detail:role,action:'Choose manager/working-manager primary model in OpenCode. Hi role routing owns only child roles.'})
  if(!CHILD_ROLES.includes(role))throw new SetupError('unsupported-role-model',{detail:role,action:`Use one of: ${CHILD_ROLES.join(', ')}.`})
}
function roleView(doc){const rr=doc.routing&&typeof doc.routing==='object'?doc.routing:{},models=rr.roleModels&&typeof rr.roleModels==='object'&&!Array.isArray(rr.roleModels)?rr.roleModels:{},variants=rr.roleVariants&&typeof rr.roleVariants==='object'&&!Array.isArray(rr.roleVariants)?rr.roleVariants:{};return{roleModels:Object.fromEntries(CHILD_ROLES.flatMap(role=>Array.isArray(models[role])?[[role,[...models[role]]]]:[])),roleVariants:Object.fromEntries(CHILD_ROLES.flatMap(role=>variants[role]&&typeof variants[role]==='object'&&!Array.isArray(variants[role])?[[role,{...variants[role]}]]:[]))}}
function roles(project,sets=[],variants=[]){
  const state=routingState(project),view=roleView(state.doc)
  if(!sets.length&&!variants.length)return{status:state.exists?'OK':'NOT_CONFIGURED',product:PRODUCT,project,config:state.path,...view,note:'Hi role-model routing applies only to six child roles; manager/working-manager primary model ownership stays in OpenCode.'}
  const rr=state.doc.routing&&typeof state.doc.routing==='object'?{...state.doc.routing}:{},rawModels=rr.roleModels&&typeof rr.roleModels==='object'&&!Array.isArray(rr.roleModels)?rr.roleModels:{},rawVariants=rr.roleVariants&&typeof rr.roleVariants==='object'&&!Array.isArray(rr.roleVariants)?rr.roleVariants:{},roleModels={...rawModels},roleVariants={...rawVariants}
  for(const item of sets){const at=item.indexOf('=');if(at<1)throw new SetupError('invalid-role-set',{detail:item,action:'Use --set ROLE=MODEL[,FALLBACK...].'});const role=item.slice(0,at).trim();assertChildRole(role);const models=[...new Set(item.slice(at+1).split(',').map(x=>x.trim()).filter(Boolean))];if(!models.length)throw new SetupError('role-model-list-empty',{detail:role});roleModels[role]=models}
  for(const item of variants){const at=item.indexOf('='),colon=item.indexOf(':');if(at<1||colon<1||colon>at)throw new SetupError('invalid-role-variant',{detail:item,action:'Use --variant ROLE:MODEL=VARIANT.'});const role=item.slice(0,colon).trim(),model=item.slice(colon+1,at).trim(),variant=item.slice(at+1).trim();assertChildRole(role);if(!model||!variant)throw new SetupError('invalid-role-variant',{detail:item});roleVariants[role]={...(roleVariants[role]??{}),[model]:variant}}
  const next=writeRouting(project,state,{...state.doc,routing:{...rr,roleModels,roleVariants}}),nextView=roleView(next)
  return{status:'APPLIED',product:PRODUCT,project,config:state.path,...nextView,restart_required:true,note:'Only explicit child role model/variant mappings changed; unrelated routing/OpenCode fields were preserved.'}
}
function rotateRole(project,role){
  if(!role)throw new SetupError('role-required',{action:`Use --role ${CHILD_ROLES.join('|')}.`});assertChildRole(role)
  const state=routingState(project),view=roleView(state.doc),models=view.roleModels[role]??[]
  if(models.length<2)return{status:'NOOP',product:PRODUCT,project,config:state.path,role,models,reason:'fewer-than-two-configured-role-models'}
  const rotated=[...models.slice(1),models[0]],rr={...(state.doc.routing??{})},rawModels=rr.roleModels&&typeof rr.roleModels==='object'&&!Array.isArray(rr.roleModels)?rr.roleModels:{},nextModels={...rawModels,[role]:rotated}
  writeRouting(project,state,{...state.doc,routing:{...rr,roleModels:nextModels}})
  return{status:'APPLIED',product:PRODUCT,project,config:state.path,role,before:models,after:rotated,restart_required:true,note:'rotate changes only this child role fallback order; it never rotates credentials, provider keys, or primary OpenCode models.'}
}

function canonicalChoice(value,allowed,fallback){return allowed.includes(value)?value:fallback}
async function askChoice(rl,label,choices,current){
  const defaultIndex=Math.max(0,choices.findIndex(x=>x.value===current)),shown=defaultIndex+1
  for(let attempt=0;attempt<3;attempt++){
    const lines=choices.map((x,i)=>`  ${i+1}. ${x.label}${i===defaultIndex?' [default]':''}`).join('\n')
    const raw=(await rl.question(`${label}\n${lines}\nChoose [${shown}]: `)).trim()
    if(!raw)return choices[defaultIndex].value
    const index=Number(raw)-1
    if(Number.isInteger(index)&&choices[index])return choices[index].value
    process.stderr.write('Invalid choice. Enter one of the listed numbers.\n')
  }
  throw new SetupError('interactive-choice-retry-exhausted',{detail:label,action:'Run the command again and choose one of the listed options.'})
}
async function askConfirm(rl,label,defaultYes=true){
  for(let attempt=0;attempt<3;attempt++){
    const raw=(await rl.question(`${label} ${defaultYes?'[Y/n]':'[y/N]'}: `)).trim().toLowerCase()
    if(!raw)return defaultYes
    if(['y','yes'].includes(raw))return true
    if(['n','no'].includes(raw))return false
    process.stderr.write('Please answer y or n.\n')
  }
  throw new SetupError('interactive-confirm-retry-exhausted',{action:'Run the command again and answer y or n.'})
}
function wizardDefaults(project){
  const state=routingState(project),doc=state.doc
  return{state,answers:{primaryMode:canonicalChoice(doc.primaryMode,['auto','working-manager','manager'],'auto')}}
}
async function collectWizard(project){
  const {state,answers:current}=wizardDefaults(project)
  let rl
  if(process.stdin.isTTY){rl=createInterface({input:process.stdin,output:process.stderr,terminal:Boolean(process.stderr.isTTY)})}
  else{
    let text='';for await(const chunk of process.stdin){if(text.length<65536)text+=String(chunk)}
    const lines=text.replace(/\r/g,'').split('\n');let index=0
    rl={question:async prompt=>{process.stderr.write(prompt);if(index>=lines.length)throw new SetupError('interactive-input-exhausted',{action:'Provide one bounded answer per wizard question, or run in a terminal.'});return lines[index++]??''},close:()=>{}}
  }
  try{
    process.stderr.write(`\n${PRODUCT} project configuration\nProject: ${project}\n\n`)
    const primaryMode=await askChoice(rl,'Primary working mode',[{value:'auto',label:'Auto — Hi chooses Manager/Working Manager behavior from the task'},{value:'working-manager',label:'Working Manager — work directly when appropriate and delegate specialists when useful'},{value:'manager',label:'Manager — coordinate work and delegate implementation to child agents'}],current.primaryMode)
    process.stderr.write('\nSpecialist selection, topology, verification depth and model scoring are Hi runtime internals. They are not normal-user setup questions.\nAfter OpenCode starts, ask “Hi ayarlarını göster” in chat. Runtime hi_settings presents Work Mode and effective connected child-model choices; Adaptive + Automatic needs no persisted model mapping.\n\n')
    const confirmed=await askConfirm(rl,'Apply this project configuration?',true)
    return{state,answers:{primaryMode},confirmed}
  }finally{rl.close()}
}
function applyWizardRouting(project,wizard){
  const {state,answers}=wizard,doc=state.doc
  const before=canonicalChoice(doc.primaryMode,['auto','working-manager','manager'],'auto')
  if(state.exists&&before===answers.primaryMode)return{status:'NOOP',product:PRODUCT,project,config:state.path,configuration:{primaryMode:answers.primaryMode},reason:'configuration-already-matches',restart_required:false,next:'In OpenCode chat, ask “Hi ayarlarını göster”. Runtime hi_settings shows Work Mode plus effective connected models; explicit changes apply to new worker dispatches without restart.'}
  const next=writeRouting(project,state,{...doc,primaryMode:answers.primaryMode})
  return{status:'APPLIED',product:PRODUCT,project,config:state.path,configuration:{primaryMode:next.primaryMode},restart_required:true,next:'Restart OpenCode, then ask “Hi ayarlarını göster” in chat. Runtime hi_settings shows Work Mode and only effective connected models; it can atomically update child roles and execution limits.'}
}
async function configureWizard(project){
  const d=doctor(project)
  if(d.issues?.includes('hi-plugin-not-registered'))throw new SetupError('hi-plugin-not-registered',{path:d.config,action:`Run: npx --yes ${PACKAGE}@${packageVersion} setup ${JSON.stringify(project)} first.`})
  const wizard=await collectWizard(project)
  if(!wizard.confirmed)return{status:'CANCELLED',product:PRODUCT,project,mutation_performed:false}
  return applyWizardRouting(project,wizard)
}

function workModeFromRouting(doc){const topology=doc?.execution?.topology;return topology==='single-agent'?'single':topology==='multi-agent'?'multi':'adaptive'}
function configControl(project,{mode,maxAgents,parallelism,modelPool,clearModelPool,sets,clearRoles,resetModels,reset}={}){
  const state=routingState(project),doc=state.doc,requestedMode=mode===undefined?undefined:String(mode).trim().toLowerCase()
  if(requestedMode!==undefined&&!['adaptive','single','multi'].includes(requestedMode))throw new SetupError('unsupported-work-mode',{detail:requestedMode,action:'Use --mode adaptive|single|multi.'})
  const bounded=(value,name)=>{if(value===undefined)return undefined;const n=Number(value);if(!Number.isInteger(n)||n<1||n>8)throw new SetupError('invalid-execution-limit',{detail:`${name}=${value}`,action:`Use ${name} in 1..8.`});return n}
  const nextMax=bounded(maxAgents,'max-agents'),nextParallel=bounded(parallelism,'parallelism'),allowedModels=modelPool===undefined?undefined:[...new Set(String(modelPool).split(',').map(x=>x.trim()).filter(Boolean))],roleModels={}
  if(modelPool!==undefined&&!allowedModels.length)throw new SetupError('model-list-empty',{action:'Use --model-pool MODEL[,MODEL...].'})
  for(const role of clearRoles??[]){assertChildRole(role);roleModels[role]=null}
  for(const item of sets??[]){const at=item.indexOf('=');if(at<1)throw new SetupError('invalid-role-set',{detail:item,action:'Use --set ROLE=MODEL[,FALLBACK...].'});const role=item.slice(0,at).trim();assertChildRole(role);const models=[...new Set(item.slice(at+1).split(',').map(x=>x.trim()).filter(Boolean))];if(!models.length)throw new SetupError('role-model-list-empty',{detail:role});roleModels[role]=models}
  const hasMutation=Boolean(requestedMode!==undefined||nextMax!==undefined||nextParallel!==undefined||modelPool!==undefined||clearModelPool||(sets?.length)||(clearRoles?.length)||resetModels||reset)
  if(!hasMutation){const view=roleView(doc);return{status:state.exists?'OK':'NOT_CONFIGURED',product:PRODUCT,project,config:state.path,work_mode:workModeFromRouting(doc),execution:{max_agents:doc.execution?.maxAgents??4,parallelism:doc.execution?.parallelism??2},allowed_models:Array.isArray(doc.routing?.allowedModels)?doc.routing.allowedModels:[],role_models:view.roleModels,note:'Project preferences only. Effective connected model availability is OpenCode-owned and is shown/validated by runtime hi_settings.'}}
  const result=applyProjectSettings(project,{workMode:reset?'adaptive':requestedMode,allowedModels:reset||resetModels||clearModelPool?null:allowedModels,maxAgents:nextMax,parallelism:nextParallel,roleModels,resetRoleModels:Boolean(resetModels||reset)}),next=routingState(project).doc
  return{status:'APPLIED',product:PRODUCT,project,config:result.path,work_mode:result.workMode,execution:{max_agents:result.execution.maxAgents??next.execution?.maxAgents??4,parallelism:result.execution.parallelism??next.execution?.parallelism??2},allowed_models:result.allowedModels,role_models:result.roleModels,restart_required:false,note:'Project settings changed through the canonical transactional writer. Runtime hi_settings refreshes and validates effective connected models before live model changes.'}
}

function registeredVersion(spec){const m=typeof spec==='string'?spec.match(/^opencode-hi@(\d+\.\d+\.\d+)$/):null;return m?.[1]}
function compareSemver(a,b){const pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number);if(pa.length!==3||pb.length!==3||[...pa,...pb].some(x=>!Number.isInteger(x)))return null;for(let i=0;i<3;i++)if(pa[i]!==pb[i])return pa[i]<pb[i]?-1:1;return 0}
function registryLatest(timeoutMs=5000){
  const base=String(process.env.npm_config_registry||'https://registry.npmjs.org').replace(/\/+$/,'')+'/'
  const url=new URL(`${base}${PACKAGE}/latest`),getter=url.protocol==='http:'?httpGet:httpsGet
  return new Promise((resolveLatest,rejectLatest)=>{const req=getter(url,{headers:{accept:'application/json','user-agent':`${PACKAGE}/${packageVersion}`}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>{if(text.length<200000)text+=chunk});res.on('end',()=>{if((res.statusCode??500)>=400)return rejectLatest(new Error(`registry-http-${res.statusCode}`));try{const body=JSON.parse(text),v=body?.version;if(typeof v!=='string')throw new Error('registry-version-missing');resolveLatest(v)}catch(e){rejectLatest(e)}})});req.setTimeout(timeoutMs,()=>req.destroy(new Error('registry-timeout')));req.on('error',rejectLatest)})
}
async function checkUpdate(project){
  const d=doctor(project),registered=d.hi_specs?.length===1?d.hi_specs[0]:null,current=registeredVersion(registered)??packageVersion
  try{const latest=await registryLatest(),cmp=compareSemver(current,latest),available=cmp===-1;return{status:'OK',product:PRODUCT,project,package_runner_version:packageVersion,registered_plugin_spec:registered,current_version:current,latest_version:latest,update_available:available,...(available?{recommended_command:`npx --yes ${PACKAGE}@${latest} install ${JSON.stringify(project)}`}:{recommended_command:null}),note:'check-update is advisory and never mutates registration or project files.'}}
  catch(error){return{status:'WARN',product:PRODUCT,project,package_runner_version:packageVersion,registered_plugin_spec:registered,current_version:current,latest_version:null,update_available:null,reason:'registry-check-unavailable',detail:String(error).slice(0,300),note:'No project state was changed. Retry check-update when npm registry access is available.'}}
}

function parseArgs(argv){
  const args=[...argv],command=args.shift()??'help';let project='.',version,profile,role,interactive,mode,maxAgents,parallelism,modelPool;const sets=[],variants=[],clearRoles=[];let printOnly=false,resetModels=false,reset=false,clearModelPool=false
  if(args[0]&&!args[0].startsWith('-'))project=args.shift()
  while(args.length){const flag=args.shift();if(flag==='--version'){version=args.shift();if(!version)throw new SetupError('missing-version-value',{action:'Use --version <exact-version>.'})}else if(flag==='--profile'){profile=args.shift();if(!profile)throw new SetupError('profile-required')}else if(flag==='--role'){role=args.shift();if(!role)throw new SetupError('role-required')}else if(flag==='--set'){const v=args.shift();if(!v)throw new SetupError('invalid-role-set');sets.push(v)}else if(flag==='--variant'){const v=args.shift();if(!v)throw new SetupError('invalid-role-variant');variants.push(v)}else if(flag==='--mode'){mode=args.shift();if(!mode)throw new SetupError('unsupported-work-mode')}else if(flag==='--max-agents'){maxAgents=args.shift();if(!maxAgents)throw new SetupError('invalid-execution-limit')}else if(flag==='--parallelism'){parallelism=args.shift();if(!parallelism)throw new SetupError('invalid-execution-limit')}else if(flag==='--model-pool'){modelPool=args.shift();if(!modelPool)throw new SetupError('model-list-empty')}else if(flag==='--clear-model-pool'){clearModelPool=true}else if(flag==='--clear-role'){const v=args.shift();if(!v)throw new SetupError('role-required');clearRoles.push(v)}else if(flag==='--reset-models'){resetModels=true}else if(flag==='--reset'){reset=true}else if(flag==='--interactive'){if(interactive===false)throw new SetupError('conflicting-interactive-flags');interactive=true}else if(flag==='--non-interactive'){if(interactive===true)throw new SetupError('conflicting-interactive-flags');interactive=false}else if(flag==='--print'){printOnly=true}else throw new SetupError('unsupported-cli-argument',{detail:String(flag),action:'Run: npx opencode-hi --help'})}
  return{command,project:projectPath(project),version,profile,role,sets,variants,clearRoles,mode,maxAgents,parallelism,modelPool,clearModelPool,resetModels,reset,printOnly,interactive}
}
function usage(){return `${PRODUCT} npm bootstrap and project controls\n\nUsage:\n  npx ${PACKAGE} install [project] [--version X]   # ensure exact Hi registration (setup or safe owned update)\n  npx ${PACKAGE} setup [project] [--version X]     # strict first installation; interactive in a terminal\n  npx ${PACKAGE} reconfigure [project]               # reopen the project configuration wizard\n  npx ${PACKAGE} update [project] [--version X]\n  npx ${PACKAGE} doctor [project]\n  npx ${PACKAGE} state [project]\n  npx ${PACKAGE} config [project] [--mode adaptive|single|multi] [--max-agents N] [--parallelism N] [--model-pool MODEL[,MODEL...]] [--clear-model-pool] [--set ROLE=MODEL[,FALLBACK...]] [--clear-role ROLE] [--reset-models|--reset]\n  npx ${PACKAGE} reprofile [project] --profile <minimal|balanced|thorough|adaptive|manual>\n  npx ${PACKAGE} roles [project] [--set ROLE=MODEL[,FALLBACK...]] [--variant ROLE:MODEL=VARIANT]\n  npx ${PACKAGE} rotate [project] --role <child-role>\n  npx ${PACKAGE} check-update [project]\n  npx ${PACKAGE} plan [project] [--version X]\n  npx ${PACKAGE} rollback [project]\n  npx ${PACKAGE} recover [project]\n\nThe friendly path is setup/install (interactive in a terminal) -> restart OpenCode -> config/doctor. Runtime hi_settings is the authoritative live connected-model settings surface. Use --non-interactive for automation. install is idempotent and safely updates only a matching Hi-owned older registration. The package runner never creates project-root node_modules. Provider authentication and primary model selection remain OpenCode-owned.\n`}

async function main(){
  let out
  try{
    const {command,project,version,profile,role,sets,variants,clearRoles,mode,maxAgents,parallelism,modelPool,clearModelPool,resetModels,reset,interactive}=parseArgs(process.argv.slice(2))
    if(command==='help'||command==='--help'||command==='-h'){process.stdout.write(usage());return 0}
    const terminalInteractive=interactive??Boolean(process.stdin.isTTY&&process.stderr.isTTY)
    if(command==='install'||command==='setup'){
      let wizard
      if(terminalInteractive){wizard=await collectWizard(project);if(!wizard.confirmed){out={status:'CANCELLED',product:PRODUCT,project,mutation_performed:false}}}
      if(!out){const registration=command==='install'?install(project,version):setup(project,version);if(wizard){const configuration=applyWizardRouting(project,wizard);out={...registration,configuration}}else out=registration}
    }
    else if(command==='reconfigure'||command==='configure'){if(interactive===false)throw new SetupError('interactive-terminal-required',{action:'Run reconfigure in a terminal, or use the bounded non-interactive commands reprofile/roles.'});if(!(interactive??Boolean(process.stdin.isTTY&&process.stderr.isTTY)))throw new SetupError('interactive-terminal-required',{action:'Run this command from an interactive terminal. For scripted tests/automation, pass --interactive and provide bounded answers on stdin.'});out=await configureWizard(project)}
    else if(command==='update'||command==='upgrade')out=update(project,version)
    else if(command==='doctor')out=doctor(project)
    else if(command==='state')out=stateView(project)
    else if(command==='config')out=configControl(project,{mode,maxAgents,parallelism,modelPool,clearModelPool,sets,clearRoles,resetModels,reset})
    else if(command==='reprofile')out=reprofile(project,profile)
    else if(command==='roles')out=roles(project,sets,variants)
    else if(command==='rotate')out=rotateRole(project,role)
    else if(command==='check-update')out=await checkUpdate(project)
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

process.exitCode=await main()
