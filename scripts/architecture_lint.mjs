#!/usr/bin/env node
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync,cpSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {contentHash} from '../plugin/dist/contracts/common.js'
import {validateProjectionReceipt} from '../plugin/dist/contracts/provenance.js'
import {STORAGE_OWNERSHIP_CATALOG,assertStorageOwnershipCatalog} from '../plugin/dist/contracts/storage-ownership.js'
import {HI_ROLE_CONTRACTS,HI_ROLE_IDS} from '../plugin/dist/generated/role-policy.js'
import {HI_PERMISSION_PROFILES} from '../plugin/dist/generated/permission-policy.js'
import {validatePermissionProfileCatalog,validateRolePermissionBindings} from '../plugin/dist/contracts/permission-profile.js'
import {validateConfigOptionCatalog} from '../plugin/dist/contracts/config-option.js'
import {HI_CONFIG_OPTIONS,HI_CONFIG_DEFAULTS} from '../plugin/dist/generated/config-policy.js'
import {PACKAGED_HI_AGENTS} from '../plugin/dist/generated/agent-config.js'
import {HI_METHODOLOGY_POLICY} from '../plugin/dist/generated/methodology-policy.js'
import {openCodeHostCapabilityContracts} from '../plugin/dist/contracts/host-capability.js'
import {unaccountedExecutionPermissionKeys} from '../plugin/dist/runtime/routing/execution-profile.js'
import {buildProjectionReceipts} from './projection_receipts.mjs'

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))
const results=[]
const fail=(id,name,detail)=>results.push({id,name,status:'FAIL',detail})
const pass=(id,name,detail)=>results.push({id,name,status:'PASS',detail})
const linked=(id,name,detail)=>results.push({id,name,status:'LINKED',detail})
const deferred=(id,name,detail)=>results.push({id,name,status:'DEFERRED',detail})
const json=p=>JSON.parse(readFileSync(join(ROOT,p),'utf8'))
const source=p=>readFileSync(join(ROOT,p),'utf8')
const testExists=name=>existsSync(join(ROOT,'plugin/test',name))
function guard(id,name,fn){try{fn();pass(id,name,'fatal check passed for migrated classes')}catch(e){fail(id,name,String(e?.message??e))}}
function assert(cond,msg){if(!cond)throw new Error(msg)}

// HI001 — migrated owner uniqueness, including M3 PermissionProfile.
guard('HI001','DUPLICATE_CANONICAL_OWNER',()=>{
  assert(new Set(HI_ROLE_IDS).size===HI_ROLE_IDS.length,'duplicate canonical role identity')
  assertStorageOwnershipCatalog(STORAGE_OWNERSHIP_CATALOG)
  validateRolePermissionBindings(HI_ROLE_CONTRACTS,validatePermissionProfileCatalog(structuredClone(HI_PERMISSION_PROFILES)))
  assert(source('plugin/src/runtime/roles/catalog.ts').includes("from '../../generated/role-policy.js'"),'runtime role catalog is not generated-contract derived')
})

// HI002 — canonical role/methodology references.
guard('HI002','UNKNOWN_CONTRACT_REFERENCE',()=>{
  const roles=json('data/hi-roles.json').roles, known=new Set(roles.map(r=>r.id)), permissionIds=new Set(json('data/hi-permission-profiles.json').profiles.map(p=>p.id))
  for(const role of roles){for(const ref of role.delegation.allowed_role_refs)assert(known.has(ref),`${role.id}: unknown delegation ${ref}`);assert(permissionIds.has(role.permission_profile_ref),`${role.id}: unknown permission profile ${role.permission_profile_ref}`)}
  for(const m of json('data/hi-methodologies.json').profiles)for(const ref of [...m.compatible_roles,...m.role_affinity])assert(known.has(ref),`${m.name}: unknown role ${ref}`)
})

function leafPaths(value,prefix='',out=[]){
  if(Array.isArray(value)||value===null||typeof value!=='object'||Object.keys(value).length===0){out.push(prefix);return out}
  for(const [k,v] of Object.entries(value))leafPaths(v,prefix?`${prefix}.${k}`:k,out)
  return out
}
guard('HI003','CONFIG_EXECUTOR_MISSING',()=>{
  const options=validateConfigOptionCatalog(structuredClone(HI_CONFIG_OPTIONS))
  const catalogPaths=[...new Set(options.map(x=>x.path))].sort(), defaultPaths=leafPaths(structuredClone(HI_CONFIG_DEFAULTS)).sort()
  assert(JSON.stringify(catalogPaths)===JSON.stringify(defaultPaths),'HiConfig leaf/default catalog coverage drift')
  assert(options.filter(x=>x.classification==='runtime').length===29,'runtime option inventory must remain explicit (29)')
  assert(options.filter(x=>x.classification==='diagnostic').length===2,'diagnostic option inventory must remain explicit (2)')
  assert(options.filter(x=>x.classification==='schema-marker').length===1,'schema marker inventory must remain explicit (1)')
  for(const x of options){
    if(x.classification==='runtime')assert(Boolean(x.runtimeConsumer&&x.executorEffect),`${x.path}: runtime option has no executable effect`)
    else assert(!x.runtimeConsumer&&!x.executorEffect,`${x.path}: non-runtime option falsely claims executor effect`)
    for(const ref of x.behavioralAcceptanceRefs)assert(testExists(ref),`${x.path}: missing config behavioral proof ${ref}`)
  }
  const defaults=source('plugin/src/config/defaults.ts');assert(defaults.includes("from '../generated/config-policy.js'"),'DEFAULT_HI_CONFIG is not generated-catalog derived')
})

const proofLinks={
  HI004:['DECISION_EXECUTOR_MISSING',['stage2-role-contract.test.mjs','authority-side-effect-idempotency.test.mjs']],
  HI007:['SAFETY_CONSTRAINT_WIDENED',['agent-binding-contract.test.mjs','project-authority-persistence.test.mjs']],
  HI008:['AUTHORITY_SCOPE_MISMATCH',['authority-contract.test.mjs','authority-input-split.test.mjs']],
  HI009:['EVIDENCE_FRESHNESS_INVALID',['evidence-freshness-ordering.test.mjs','verification-envelope-contract.test.mjs']],
  HI015:['COMPLETION_BYPASS',['verification-envelope-contract.test.mjs','threat-model.test.mjs']],
  HI018:['WORKER_RECOVERY_OWNERSHIP_CONFLICT',['task-worker-contract.test.mjs','provider-fallback-hardening.test.mjs']],
  HI019:['CONTEXT_CONSUMER_MISSING',['context-reference-contract.test.mjs','context-survival-hardening.test.mjs']],
  HI020:['ARTIFACT_IDENTITY_COLLISION',['artifact-contract.test.mjs']],
}
for(const [id,[name,files]] of Object.entries(proofLinks)){
  const missing=files.filter(x=>!testExists(x))
  if(missing.length)fail(id,name,`missing behavioral proof link(s): ${missing.join(', ')}`)
  else linked(id,name,`behavioral proof: ${files.join(', ')}; executed by controlled plugin suite`)
}

// HI005 — every host capability outcome has explicit acceptance evidence and no fake supported shape.
guard('HI005','HOST_CAPABILITY_FAKE',()=>{
  const falseObs={childSessions:false,asyncPrompt:false,syncPrompt:false,abort:false,providerInventory:false,appLog:false,sessionStatus:false,childSessionList:false,sessionTodo:false,sessionDiff:false,sessionFork:false,sessionSummarize:false,sessionRevert:false,sessionUnrevert:false}
  const trueObs=Object.fromEntries(Object.keys(falseObs).map(k=>[k,true]))
  const contracts=[...openCodeHostCapabilityContracts(falseObs),...openCodeHostCapabilityContracts(trueObs)]
  for(const c of contracts){
    assert(testExists(c.acceptance_ref),`${c.id}: missing acceptance ${c.acceptance_ref}`)
    if(c.status==='SUPPORTED')assert(Boolean(c.native_primitive&&c.adapter_entrypoint),`${c.id}: supported without native primitive/adapter`)
    if(c.status==='DEGRADED')assert(Boolean(c.fallback&&c.semantic_loss.length),`${c.id}: degraded without fallback/loss`)
    if(c.status==='UNSUPPORTED')assert(!c.native_primitive&&!c.adapter_entrypoint,`${c.id}: unsupported claims executor`)
  }
})

function normalizedReceipts(items){return items.map(x=>validateProjectionReceipt(x)).sort((a,b)=>a.outputPath.localeCompare(b.outputPath,'en'))}
guard('HI006','HOST_PROJECTION_DRIFT',()=>{
  const stored=normalizedReceipts(json('data/validation/projection-receipts.json'))
  const expected=normalizedReceipts(buildProjectionReceipts(ROOT))
  assert(JSON.stringify(stored)===JSON.stringify(expected),'projection receipt/source/output drift')
})

guard('HI010','STORAGE_OWNER_CONFLICT',()=>assertStorageOwnershipCatalog(STORAGE_OWNERSHIP_CATALOG))

function generatedPaths(root){
  const paths=['plugin/src/generated/config-policy.ts','plugin/src/generated/permission-policy.ts','plugin/src/generated/role-policy.ts','plugin/src/generated/agent-config.ts','plugin/src/generated/methodology-policy.ts']
  const skills=readdirSync(join(root,'skills')).filter(n=>n.startsWith('hi-')&&existsSync(join(root,'skills',n,'SKILL.md'))).sort().map(n=>`skills/${n}/SKILL.md`)
  return [...paths,...skills]
}
function tempGeneratedComparison(){
  const temp=mkdtempSync(join(tmpdir(),'hi-arch-lint-'))
  try{
    for(const rel of ['data','roles','skills','scripts'])cpSync(join(ROOT,rel),join(temp,rel),{recursive:true})
    cpSync(join(ROOT,'plugin/src/generated'),join(temp,'plugin/src/generated'),{recursive:true})
    for(const script of ['generate_config_policy.py','generate_permission_policy.py','generate_plugin_agents.py','generate_methodology_policy.py']){
      const r=spawnSync('python3',[join(temp,'scripts',script)],{encoding:'utf8'})
      if(r.status!==0)throw new Error(`${script}: ${r.stderr||r.stdout}`)
    }
    for(const rel of generatedPaths(ROOT))assert(readFileSync(join(ROOT,rel),'utf8')===readFileSync(join(temp,rel),'utf8'),`${rel}: generated artifact dirty`)
  }finally{rmSync(temp,{recursive:true,force:true})}
}
guard('HI011','GENERATED_ARTIFACT_DIRTY',tempGeneratedComparison)

guard('HI012','GENERATED_ARTIFACT_HAND_EDIT',()=>{
  const receipts=normalizedReceipts(json('data/validation/projection-receipts.json'))
  for(const r of receipts)assert(contentHash(readFileSync(join(ROOT,r.outputPath),'utf8')).value===r.outputHash.value,`${r.outputPath}: output hash differs from receipt`)
  for(const rel of ['plugin/src/generated/config-policy.ts','plugin/src/generated/permission-policy.ts','plugin/src/generated/role-policy.ts','plugin/src/generated/agent-config.ts','plugin/src/generated/methodology-policy.ts'])assert(/do not hand edit/i.test(source(rel)),`${rel}: generated marker missing`)
})

guard('HI013','ROLE_AGENT_IDENTITY_UNVERIFIED',()=>{
  assert(JSON.stringify(Object.keys(PACKAGED_HI_AGENTS).sort())===JSON.stringify([...HI_ROLE_IDS].sort()),'agent/role identity inventory drift')
  for(const role of HI_ROLE_CONTRACTS){const a=PACKAGED_HI_AGENTS[role.id];assert(a.description===role.purpose,`${role.id}: description drift`);assert(a.mode===(role.roleClass==='primary'?'primary':'subagent'),`${role.id}: mode drift`)}
})

guard('HI014','METHODOLOGY_PERMISSION_DRIFT',()=>{
  const byName=new Map(HI_METHODOLOGY_POLICY.map(x=>[x.name,x]))
  for(const [role,agent] of Object.entries(PACKAGED_HI_AGENTS)){
    assert(agent.permission.skill['*']==='deny',`${role}: methodology permission not default deny`)
    for(const [name,value] of Object.entries(agent.permission.skill))if(name!=='*'&&value==='allow')assert(byName.get(name)?.compatibleRoles.includes(role),`${role}: incompatible methodology ${name}`)
    for(const m of HI_METHODOLOGY_POLICY)if(m.compatibleRoles.includes(role))assert(agent.permission.skill[m.name]==='allow',`${role}: missing compatible methodology ${m.name}`)
  }
})

guard('HI016','LEGACY_CURRENT_ONLY_VIOLATION',()=>{
  const forbidden=['KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','HI.cmd','HI.sh','HI-VALIDATE.cmd','HI-VALIDATE.sh','HI-RELEASE-PREP.cmd','HI-RELEASE-PREP.sh','docs/HI-TEST-LAB-HANDOFF.md','docs/'+'FLOW-'+'11-COVERAGE.md','docs/'+'NATIVE-FIRST-'+'10-COVERAGE.md','docs/MIGRATION-Hi-NEXT.md']
  for(const rel of forbidden)assert(!existsSync(join(ROOT,rel)),`legacy current-only path present: ${rel}`)
})

guard('HI017','BEHAVIORAL_PROOF_MISSING',()=>{
  for(const [id,[,files]] of Object.entries(proofLinks))for(const file of files)assert(testExists(file),`${id}: missing ${file}`)
  for(const file of ['config-option-contract.test.mjs','config-executable-effect.test.mjs','permission-profile-contract.test.mjs','role-contract-catalog.test.mjs','role-skill-permission-sync.test.mjs','host-capability-contract.test.mjs','storage-ownership-contract.test.mjs','agent-binding-contract.test.mjs','methodology-host-capability.test.mjs','team-contract.test.mjs','team-mode-hardening.test.mjs'])assert(testExists(file),`missing migrated-class acceptance ${file}`)
})

guard('HI021','EXECUTION_SURFACE_PERMISSION_DRIFT',()=>{
  const host={agent:PACKAGED_HI_AGENTS}
  for(const role of Object.keys(PACKAGED_HI_AGENTS)){
    const drift=unaccountedExecutionPermissionKeys(host,role)
    assert(drift.length===0,`${role}: permission keys not represented by Core execution surface: ${drift.join(', ')}`)
  }
})

for(const r of results.sort((a,b)=>a.id.localeCompare(b.id)))console.log(`${r.id} ${r.status} ${r.name} — ${r.detail}`)
const failures=results.filter(r=>r.status==='FAIL')
if(failures.length){console.error(`ARCHITECTURE LINT FAIL (${failures.length})`);process.exit(1)}
console.log(`ARCHITECTURE LINT PASS rules=${results.length} deferred=${results.filter(r=>r.status==='DEFERRED').length} linked=${results.filter(r=>r.status==='LINKED').length}`)
