import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveHiConfigWithReport } from '../dist/config/resolver.js'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { normalizeWorkerResult } from '../dist/runtime/task/contracts.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { evaluateShellCommand } from '../dist/runtime/process/shell-policy.js'
import { capabilityProfile } from '../dist/runtime/capabilities/profiles.js'
import { OPENCODE_REFERENCE_CAPABILITIES,resolveHostCapability } from '../dist/runtime/host/capability-manifest.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { createToolAfterHook } from '../dist/hooks/tool-after.js'
import { createTask,createWorker } from '../dist/runtime/worker/worker-runtime.js'

const baseConfig=()=>resolveHiConfigWithReport({},undefined).config
const models=[{id:'cheap/model',provider:'cheap',cost:1,quality:5,writeCapable:true,tags:['coding']},{id:'strong/model',provider:'strong',cost:3,quality:9,writeCapable:true,tags:['reasoning','coding']}]

test('project topology override reaches mission topology decision',()=>{const root=mkdtempSync(join(tmpdir(),'hi-config-'));try{mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true});writeFileSync(join(root,'.opencode','hi','policy','routing.json'),JSON.stringify({schema:1,type:'hi-routing',execution:{topology:'multi-agent',maxAgents:3,parallelism:2}}));let cfg=resolveHiConfigWithReport({},root).config;const store=new MissionStore(root,{},()=>cfg.primaryMode,()=>({mode:cfg.execution.topology,maxAgents:cfg.execution.maxAgents,parallelism:cfg.execution.parallelism}));assert.equal(startAssessedMission(store,'s','opaque local change',{task_kind:'implementation',scope:'local',required_capabilities:['implementation']}).execution.topology.mode,'multi-agent')}finally{rmSync(root,{recursive:true,force:true})}})
test('legacy fixed-model input is omitted from canonical config while explicit task model remains authoritative',()=>{const resolved=resolveHiConfigWithReport({models:{mode:'fixed',default:'cheap/model',roles:{coder:'cheap/model'}}});assert.equal('models' in resolved.config,false);assert.ok(resolved.report.notes.some(note=>note.includes('models.mode')));assert.equal(resolveModel('deep',models,resolved.config,undefined,'coder').primary,'strong/model');assert.equal(resolveModel('deep',models,resolved.config,'cheap/model','coder').primary,'cheap/model')})
test('project facts do not become methodology observations without the structured reusable-HOW contract',()=>{const fact=normalizeWorkerResult({status:'DONE',summary:'The project uses ResultEnvelope for API errors',changed_files:[],evidence:[],open_issues:[],needs_context:[]});assert.equal(fact.methodology_observations,undefined);const structured=normalizeWorkerResult({status:'DONE',summary:'Reusable project procedure observed',changed_files:[],evidence:[{kind:'review-evidence',summary:'bounded proof',pass:true,outcome:'passed'}],open_issues:[],needs_context:[],methodology_observations:[{key:'project-review-flow',procedure:'Inspect the project-specific review manifest before changing adapters.',trigger:'Adapter review touches the manifest.',do_not_trigger:'No adapter review is involved.',exit_condition:'Manifest constraints are reconciled.',evidence:['review-evidence']}]});assert.equal(structured.methodology_observations?.length,1)})
test('shell policy is non-interactive and never fakes approval',()=>{assert.equal(evaluateShellCommand('npm init').decision,'REWRITE');assert.equal(evaluateShellCommand('gh auth login').decision,'USER_ACTION_REQUIRED');assert.equal(evaluateShellCommand('yes | dangerous-command').decision,'DENY');assert.equal(evaluateShellCommand('npm test').decision,'ALLOW')})
test('tool-before enforces shell rewrite and interactive user-action gate',async()=>{const store=new MissionStore(),m=startAssessedMission(store,'shell-live','opaque local task',{task_kind:'implementation',scope:'local',required_capabilities:['implementation']});const hook=createToolBeforeHook(store);const out={args:{command:'npm init'}};await hook({sessionID:'shell-live',tool:'bash',args:{command:'npm init'}},out);assert.equal(out.args.command,'npm init -y');await assert.rejects(()=>hook({sessionID:'shell-live',tool:'bash',args:{command:'gh auth login'}},{args:{command:'gh auth login'}}),/interactive credential/i);assert.equal(m.identity.status,'waiting-user')})
test('non-active Mission fails closed for ordinary execution while preserving bounded inspection and exact rollback',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'waiting-lifecycle','bounded local task',{task_kind:'implementation',scope:'local',required_capabilities:['implementation']})
  const {payloadHash}=await import('../dist/runtime/safety/idempotency.js'),{openHumanDecision}=await import('../dist/runtime/human-decision/runtime.js')
  m.vcs.temporary_mutations.push({id:'tm-wait',kind:'experiment',description:'temporary',rollback_command:'echo rollback',rollback_hash:payloadHash('echo rollback'),rollback_mode:'command',status:'active',created_at:Date.now()})
  openHumanDecision(m,{semantic_type:'operational_action',reason_code:'precondition-blocked',summary:'rollback required',response_schema:{kind:'external-action'}})
  const hook=createToolBeforeHook(store)
  await hook({sessionID:m.identity.session_id,tool:'read'},{args:{filePath:'src/a.ts'}})
  await hook({sessionID:m.identity.session_id,tool:'hi_status'},{args:{}})
  await hook({sessionID:m.identity.session_id,tool:'bash'},{args:{command:'echo rollback'}})
  await hook({sessionID:m.identity.session_id,tool:'hi_temporary_mutation_revert'},{args:{id:'tm-wait'}})
  for(const [tool,args] of [['write',{filePath:'src/a.ts',content:'x'}],['edit',{filePath:'src/a.ts'}],['bash',{command:'printf x > src/a.ts'}],['task',{description:'native bypass'}],['unknown_future_tool',{}]])await assert.rejects(()=>hook({sessionID:m.identity.session_id,tool,args},{args}),/Hi lifecycle guard: mission is waiting-user/)
  assert.ok(m.execution.ledger.filter(e=>e.type==='tool.lifecycle-admission-blocked').length>=5)
})
test('resolved rollback admits only bounded verification recovery and completes the same waiting Mission',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-rollback-verify-'));try{
    mkdirSync(join(root,'src'),{recursive:true});mkdirSync(join(root,'test'),{recursive:true})
    writeFileSync(join(root,'package.json'),JSON.stringify({name:'rollback-verifier',private:true,type:'module',scripts:{test:'node --test'}}))
    writeFileSync(join(root,'src','a.js'),'export const a=1\n')
    writeFileSync(join(root,'test','a.test.mjs'),"import test from 'node:test'; import assert from 'node:assert/strict'; import {a} from '../src/a.js'; test('a',()=>assert.equal(a,1))\n")
    const store=new MissionStore(root),m=startAssessedMission(store,'rollback-verification-recovery','fix src/a.js and verify',{task_kind:'bug-fix',scope:'local',required_capabilities:['implementation','verification'],likely_targets:['src/a.js'],likely_verification:['targeted-tests']})
    const {openHumanDecision}=await import('../dist/runtime/human-decision/runtime.js'),{appendLedger}=await import('../dist/runtime/ledger/ledger.js')
    for(const o of m.execution.obligations){if(o.kind!=='verification'){o.status='closed';o.closedAt=Date.now()}else{o.status='open';o.closedAt=undefined}}
    m.vcs.changed_files=['src/a.js'];m.execution.evidence.fresh=false
    m.vcs.temporary_mutations=[{id:'tm-resolved',kind:'experiment',description:'resolved experiment',rollback_command:'true',rollback_hash:'resolved',rollback_mode:'native-revert',status:'rolled-back',created_at:Date.now()-100,resolved_at:Date.now()-50}]
    appendLedger(m,'temporary-mutation.rolled-back',{payload:{id:'tm-resolved',rollback_mode:'native-revert'}})
    appendLedger(m,'obligation.reopened',{payload:{obligation:m.execution.obligations.find(o=>o.kind==='verification').id,owner:'evidence-freshness',reason:'claim-linked-evidence-invalidated'}})
    openHumanDecision(m,{semantic_type:'operational_action',reason_code:'precondition-blocked',summary:'verification must be refreshed after rollback',response_schema:{kind:'external-action'}})
    const before=createToolBeforeHook(store,undefined,root,root),after=createToolAfterHook(store,undefined,undefined,root,root)
    await before({sessionID:m.identity.session_id,tool:'bash',args:{command:'npm test'}},{args:{command:'npm test'}})
    await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'bash',args:{command:'python3 -m pytest'}},{args:{command:'python3 -m pytest'}}),/lifecycle guard/i)
    await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'write',args:{filePath:'src/a.js',content:'x'}},{args:{filePath:'src/a.js',content:'x'}}),/lifecycle guard/i)
    await after({sessionID:m.identity.session_id,tool:'bash',args:{command:'npm test'}},{stdout:'1..1\n# pass 1\n# fail 0',metadata:{exit:0}})
    assert.equal(m.identity.status,'completed')
    assert.equal(m.execution.obligations.find(o=>o.kind==='verification').status,'closed')
    assert.equal(m.authority.human_decision?.status,'RESOLVED')
    assert.ok(m.execution.ledger.some(e=>e.type==='verification.rollback-recovery-completed'))
  }finally{rmSync(root,{recursive:true,force:true})}
})
test('stopped and completed Missions reject ordinary mutation at the generic tool boundary',async()=>{
  for(const status of ['stopped','completed']){const store=new MissionStore(),m=startAssessedMission(store,`lifecycle-${status}`,'bounded task',{task_kind:'implementation',scope:'local',required_capabilities:['implementation']});m.identity.status=status;const hook=createToolBeforeHook(store);await hook({sessionID:m.identity.session_id,tool:'hi_status'},{args:{}});await assert.rejects(()=>hook({sessionID:m.identity.session_id,tool:'write'},{args:{filePath:'src/a.ts',content:'x'}}),new RegExp(`mission is ${status}`))}
})
test('active Hi mission blocks the competing native OpenCode task runtime',async()=>{const store=new MissionStore(),m=startAssessedMission(store,'single-owner','independent work',{task_kind:'implementation',scope:'repo-wide',dependency_class:'independent-multi',required_capabilities:['implementation','verification']});const hook=createToolBeforeHook(store);await assert.rejects(()=>hook({sessionID:'single-owner',tool:'task'},{args:{description:'delegate outside Hi'}}),/native OpenCode task delegation is disabled.*hi_task_start/i);assert.ok(m.execution.ledger.some(e=>e.type==='orchestration.native-task-blocked'))})
test('parallel Hi topology blocks parent mutation while preserving read and verification commands',async()=>{const store=new MissionStore(),m=startAssessedMission(store,'parallel-owner','independent fixes',{task_kind:'bug-fix',scope:'multi-file',dependency_class:'independent-multi',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests']});assert.equal(m.execution.execution_mode,'parallel');const hook=createToolBeforeHook(store);await hook({sessionID:'parallel-owner',tool:'read'},{args:{filePath:'src/a.ts'}});await hook({sessionID:'parallel-owner',tool:'bash'},{args:{command:'npm test'}});await hook({sessionID:'parallel-owner',tool:'bash'},{args:{command:'python3 -m pytest tests/ -v'}});await assert.rejects(()=>hook({sessionID:'parallel-owner',tool:'edit'},{args:{filePath:'src/a.ts'}}),/topology guard.*hi_task_start/i);await assert.rejects(()=>hook({sessionID:'parallel-owner',tool:'bash'},{args:{command:'printf x > src/a.ts'}}),/topology guard.*hi_task_start/i);await assert.rejects(()=>hook({sessionID:'parallel-owner',tool:'bash'},{args:{command:`python3 -c "\nwith open('src/a.ts','w') as f:\n    f.write('x')\nprint('written')\n"\ncat src/a.ts`}}),/topology guard.*hi_task_start/i);assert.ok(m.execution.ledger.filter(e=>e.type==='orchestration.parent-mutation-blocked').length>=3)})

test('project direct parents serialize overlapping mutation claims while disjoint direct work remains allowed',async()=>{
  const store=new MissionStore(),a=startAssessedMission(store,'direct-peer-a','edit src/shared.ts for A',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_targets:['src/shared.ts']}),b=startAssessedMission(store,'direct-peer-b','edit src/shared.ts for B',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_targets:['src/shared.ts']}),c=startAssessedMission(store,'direct-peer-c','edit src/other.ts',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_targets:['src/other.ts']})
  a.identity.created_at=10;b.identity.created_at=20;c.identity.created_at=30
  assert.equal(a.execution.adaptive_execution?.path,'DIRECT');assert.equal(b.execution.adaptive_execution?.path,'DIRECT');assert.equal(c.execution.adaptive_execution?.path,'DIRECT')
  const hook=createToolBeforeHook(store)
  await hook({sessionID:'direct-peer-a',tool:'edit'},{args:{filePath:'src/shared.ts'}})
  await assert.rejects(()=>hook({sessionID:'direct-peer-b',tool:'edit'},{args:{filePath:'src/shared.ts'}}),/project write conflict.*hi_task_start/i)
  await hook({sessionID:'direct-peer-c',tool:'edit'},{args:{filePath:'src/other.ts'}})
  assert.ok(b.execution.ledger.some(e=>e.type==='orchestration.parent-mutation-blocked'&&e.payload?.reason==='project-write-conflict'))
})

test('direct parent mutation loses authority when no canonical implementation obligation remains open',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'direct-owner-closed','edit src/a.ts',{task_kind:'bug-fix',scope:'local',risk:'low',required_capabilities:['implementation','verification'],likely_targets:['src/a.ts']})
  for(const obligation of m.execution.obligations)if(obligation.kind==='implementation'){obligation.status='closed';obligation.closedAt=Date.now()}
  const hook=createToolBeforeHook(store)
  await assert.rejects(()=>hook({sessionID:m.identity.session_id,tool:'edit'},{args:{filePath:'src/a.ts'}}),/direct mutation authority guard.*hi_task_start/i)
  assert.ok(m.execution.ledger.some(e=>e.type==='orchestration.parent-mutation-blocked'&&e.payload?.reason==='no-canonical-direct-write-owner'))
})

test('running foreign child writer blocks a direct parent mutation on the same project surface',async()=>{
  const store=new MissionStore(),peer=startAssessedMission(store,'direct-vs-child-peer','delegated shared edit',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_targets:['src/shared.ts']}),direct=startAssessedMission(store,'direct-vs-child-parent','direct shared edit',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_targets:['src/shared.ts']})
  const task=createTask(peer,{objective:'write shared',role:'coder',category:'standard',scope:['src/shared.ts']}),worker=createWorker(peer,task,'p/code');task.status='running';worker.status='busy';worker.write_set=['src/shared.ts']
  const hook=createToolBeforeHook(store)
  await assert.rejects(()=>hook({sessionID:'direct-vs-child-parent',tool:'edit'},{args:{filePath:'src/shared.ts'}}),/project write conflict.*hi_task_start/i)
  assert.ok(direct.execution.ledger.some(e=>e.type==='orchestration.parent-mutation-blocked'&&e.payload?.reason==='project-write-conflict'))
})
test('capability profiles never expand release authority implicitly',()=>{const release=capabilityProfile('RELEASE'),research=capabilityProfile('RESEARCH'),sandbox=capabilityProfile('SANDBOX');assert.equal(release.externalSideEffects,true);assert.equal(release.requiresAuthority,true);assert.equal(research.write,false);assert.equal(sandbox.requiresIsolation,true)})
test('reference host exposes owned native process events and workspace isolation primitives',()=>{assert.equal(resolveHostCapability(OPENCODE_REFERENCE_CAPABILITIES,'process_events'),'NATIVE');assert.equal(resolveHostCapability(OPENCODE_REFERENCE_CAPABILITIES,'workspace_isolation'),'NATIVE')})
