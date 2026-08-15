import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {HI_ROLES,HI_PRIMARY_ROLES,HI_CHILD_ROLES,isHiReadOnlyChildRole,roleCanOwnObligation} from '../dist/runtime/roles/catalog.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'

const CHILD=['coder','architect','repository-explorer','qa-reviewer','security-reviewer','visual-qa']
function runtime(policy){const created=[];const client={session:{create:async req=>{created.push(req);return{data:{id:'child-'+created.length}}},promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]})}};const cfg=resolveHiConfig({executionPolicy:policy,parallel:{enabled:true,max:4}});const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:4})),process.cwd(),process.cwd(),()=>cfg,()=>[{id:'p/model',provider:'p',quality:8,cost:1,tags:['balanced'],writeCapable:true}],()=>({}));return{rt,created}}
function designMission(id){const store=new MissionStore();return startAssessedMission(store,id,'opaque design work',{task_kind:'implementation',scope:'repo-wide',risk:'medium',required_capabilities:['design-exploration'],likely_verification:[]})}

test('executionPolicy profile changes the actual default OpenCode child role',async()=>{const minimal=runtime('minimal'),m1=designMission('minimal-role');const a=await minimal.rt.start(m1,{objective:'bounded design-related task'});assert.equal(m1.execution.tasks.find(t=>t.id===a.task_id)?.role,'coder');assert.equal(minimal.created[0].body.agent,'coder');const thorough=runtime('thorough'),m2=designMission('thorough-role');const b=await thorough.rt.start(m2,{objective:'bounded design-related task'});assert.equal(m2.execution.tasks.find(t=>t.id===b.task_id)?.role,'architect');assert.equal(thorough.created[0].body.agent,'architect')})

test('repo-wide bug default task role starts with repository exploration, not architecture',async()=>{const x=runtime('balanced'),store=new MissionStore(),m=startAssessedMission(store,'wide-bug-role','opaque wide bug',{task_kind:'bug-fix',scope:'repo-wide',risk:'medium',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests']});const out=await x.rt.start(m,{objective:'bound the root-cause surface'});assert.equal(m.execution.tasks.find(t=>t.id===out.task_id)?.role,'repository-explorer');assert.equal(x.created[0].body.agent,'repository-explorer')})

test('packaged child role prompts defer output shape to Hi WorkerResult handoff',()=>{for(const role of CHILD){const prompt=String(PACKAGED_HI_AGENTS[role].prompt);assert.match(prompt,/structured `WorkerResult` contract|structured WorkerResult contract/i,role);assert.doesNotMatch(prompt,/Return `STATUS:/,role)}})


test('child roles cannot claim obligations outside their authority class',async()=>{
  const reviewRuntime=runtime('balanced'),reviewStore=new MissionStore(),review=startAssessedMission(reviewStore,'role-review-authority','opaque review',{task_kind:'review',scope:'multi-file',risk:'medium',required_capabilities:['review','independent-review'],likely_verification:['review-evidence']})
  const reviewObligation=review.execution.obligations.find(o=>o.kind==='review')
  await assert.rejects(()=>reviewRuntime.rt.start(review,{objective:'implement instead of review',role:'coder',obligationIds:[reviewObligation.id]}),/coder cannot own obligation.*review/)

  const implRuntime=runtime('balanced'),implStore=new MissionStore(),impl=startAssessedMission(implStore,'role-impl-authority','opaque implementation',{task_kind:'implementation',scope:'multi-file',risk:'medium',required_capabilities:['implementation'],likely_verification:[]})
  const implementation=impl.execution.obligations.find(o=>o.kind==='implementation')
  await assert.rejects(()=>implRuntime.rt.start(impl,{objective:'reviewer cannot implement',role:'qa-reviewer',obligationIds:[implementation.id]}),/qa-reviewer cannot own obligation.*implementation/)

  const authorityRuntime=runtime('balanced'),authorityStore=new MissionStore(),authority=startAssessedMission(authorityStore,'role-authority-boundary','opaque external effect',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',required_capabilities:['verification'],requested_external_actions:['deploy'],likely_verification:[]})
  const authorityObligation=authority.execution.obligations.find(o=>o.kind==='authority')
  await assert.rejects(()=>authorityRuntime.rt.start(authority,{objective:'child cannot own external authority',role:'coder',obligationIds:[authorityObligation.id]}),/coder cannot own obligation.*authority/)
})

test('review obligation auto-binding is limited to reviewer roles, not every read-only role',async()=>{
  const x=runtime('balanced'),store=new MissionStore(),m=startAssessedMission(store,'role-review-auto','opaque review',{task_kind:'review',scope:'multi-file',risk:'medium',required_capabilities:['review','independent-review'],likely_verification:['review-evidence']})
  const out=await x.rt.start(m,{objective:'architecture context only',role:'architect',requiredEvidence:[]})
  const task=m.execution.tasks.find(t=>t.id===out.task_id)
  assert.equal(task.obligation_ids.some(id=>m.execution.obligations.find(o=>o.id===id)?.kind==='review'),false)
})


test('core role catalog and OpenCode agent identities stay in parity',()=>{assert.deepEqual(Object.keys(PACKAGED_HI_AGENTS).sort(),[...HI_ROLES].sort());for(const r of HI_PRIMARY_ROLES)assert.equal(PACKAGED_HI_AGENTS[r].mode,'primary');for(const r of HI_CHILD_ROLES)assert.equal(PACKAGED_HI_AGENTS[r].mode,'subagent');assert.equal(isHiReadOnlyChildRole('architect'),true);assert.equal(roleCanOwnObligation('qa-reviewer','review'),true);assert.equal(roleCanOwnObligation('qa-reviewer','implementation'),false)})


test('mission restore preserves observed primary identity instead of recomputing it from config',()=>{const a=new MissionStore(process.cwd(),{},()=> 'manager');const m=startAssessedMission(a,'primary-restore','opaque',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_verification:[]});a.bindObservedPrimary('primary-restore','manager');const b=new MissionStore(process.cwd(),{},()=> 'working-manager');b.restore([structuredClone(m)]);assert.equal(b.get('primary-restore').execution.primary_mode,'manager')})
