import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {replanVerificationForChangedSurface,verificationSatisfied} from '../dist/runtime/verification/policy.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'

function repo(){const root=mkdtempSync(join(tmpdir(),'hi-replan-'));writeFileSync(join(root,'package.json'),JSON.stringify({scripts:{test:'vitest run',typecheck:'tsc --noEmit',build:'vite build'}}));mkdirSync(join(root,'src','auth'),{recursive:true});writeFileSync(join(root,'src/auth/token.ts'),'x');writeFileSync(join(root,'src/other.ts'),'x');writeFileSync(join(root,'src/extra.ts'),'x');return root}
function runtime(root){return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}

test('unexpected multi-file changed surface strengthens a local verification contract with one static check',()=>{
  const root=repo(),s=new MissionStore(),m=startAssessedMission(s,'p','opaque bug',{task_kind:'bug-fix',risk:'low',likely_verification:['targeted-tests'],likely_targets:['src/other.ts']})
  m.identity.risk='low';m.identity.intent.risk='low';m.execution.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const t=createTask(m,{objective:'fix token',role:'coder',category:'quick',scope:['src/other.ts'],requiredEvidence:['targeted-tests']})
  const r=replanVerificationForChangedSurface(m,t,['src/other.ts','src/extra.ts'],collectRepoContext(root))
  assert.equal(r.scopeExpanded,true)
  assert.deepEqual(r.addedKinds,['typecheck'])
  assert.deepEqual(m.execution.verification_policy.requiredKinds,['targeted-tests','typecheck'])
})

test('sensitive changed surface escalates risk and requires static plus build evidence',()=>{
  const root=repo(),s=new MissionStore(),m=startAssessedMission(s,'p','opaque bug',{task_kind:'bug-fix',risk:'low',likely_verification:['targeted-tests'],likely_targets:['src/other.ts']})
  m.identity.risk='low';m.identity.intent.risk='low';m.execution.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const v=m.execution.obligations.find(o=>o.kind==='verification'); if(v)v.requiredEvidence=['targeted-tests']
  const t=createTask(m,{objective:'fix',role:'coder',category:'quick',scope:['src/other.ts'],requiredEvidence:['targeted-tests'],obligationIds:v?[v.id]:[]})
  const r=replanVerificationForChangedSurface(m,t,['src/other.ts','src/auth/token.ts'],collectRepoContext(root))
  assert.equal(r.riskEscalated,true)
  assert.equal(m.identity.risk,'high')
  assert.equal(m.identity.intent.risk,'high')
  assert.equal(m.execution.verification_policy.requireReview,true)
  assert.ok(m.execution.obligations.some(o=>o.kind==='review'&&o.status==='open'))
  assert.deepEqual(m.execution.verification_policy.requiredKinds,['targeted-tests','typecheck','build'])
  assert.deepEqual(v?.requiredEvidence,['targeted-tests','typecheck','build'])
})

test('worker DONE with broader changed_files cannot close verification under the stale narrow plan',()=>{
  const root=repo(),s=new MissionStore(),m=startAssessedMission(s,'p','opaque bug',{task_kind:'bug-fix',risk:'low',likely_verification:['targeted-tests'],likely_targets:['src/other.ts']})
  m.identity.risk='low';m.identity.intent.risk='low';m.execution.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const v=m.execution.obligations.find(o=>o.kind==='verification'); if(v)v.requiredEvidence=['targeted-tests']
  const t=createTask(m,{objective:'fix',role:'coder',category:'quick',scope:['src/other.ts'],requiredEvidence:['targeted-tests'],obligationIds:v?[v.id]:[]})
  const w=createWorker(m,t,'host-default',[],[],[]);w.status='busy';w.started_at=Date.now()-10
  runtime(root).applyResult(m,w.id,{status:'DONE',summary:'fixed plus auth helper',changed_files:['src/other.ts','src/auth/token.ts'],evidence:[{kind:'targeted-tests',summary:'old narrow tests pass',scope:['src/other.ts'],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(v?.status,'open')
  assert.ok(m.execution.verification_policy.requiredKinds.includes('typecheck'))
  assert.ok(m.execution.verification_policy.requiredKinds.includes('build'))
  assert.equal(verificationSatisfied(m,v?.id).ok,false)
  assert.ok(m.execution.ledger.some(e=>e.type==='verification.replanned'))
})

test('follow-up reviewer defaults to actual changed surface and replanned required evidence',async()=>{
  const root=repo(),s=new MissionStore(root),m=startAssessedMission(s,'p','opaque bug',{task_kind:'bug-fix',risk:'low',likely_verification:['targeted-tests'],likely_targets:['src/other.ts']})
  m.vcs.changed_files=['src/other.ts','src/auth/token.ts']
  m.execution.verification_policy.requiredKinds=['targeted-tests','typecheck','build']
  const prompts=[];let seq=0
  const client={session:{create:async()=>({data:{id:`child-${++seq}`}}),promptAsync:async(x)=>{prompts.push(x);return{data:{}}},abort:async()=>({data:{}})}}
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const out=await rt.start(m,{objective:'review actual changed surface',role:'qa-reviewer',category:'standard'})
  const t=m.execution.tasks.find(x=>x.id===out.task_id)
  assert.deepEqual(t?.scope,['src/other.ts','src/auth/token.ts'])
  assert.deepEqual(t?.requiredEvidence,['targeted-tests','typecheck','build'])
  assert.match(prompts[0].body.parts[0].text,/src\/auth\/token\.ts/)
})


test('explicit dependency reviewer derives review evidence from its review obligation instead of mission-global visual verification',async()=>{
  const root=repo(),s=new MissionStore(root),m=startAssessedMission(s,'dependency-review-evidence','opaque visual app change',{task_kind:'implementation',risk:'low',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['src/other.ts']})
  m.execution.verification_policy={requiredKinds:['visual-check'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false}
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation)
  const producer=createTask(m,{objective:'update dependency',role:'coder',category:'standard',scope:['src/other.ts'],requiredEvidence:['visual-check'],obligationIds:[implementation.id]})
  producer.status='completed';producer.result={status:'DONE',summary:'dependency updated',changed_files:['requirements.txt'],evidence:[],open_issues:[],needs_context:[]};implementation.status='closed';implementation.closedAt=Date.now();m.vcs.changed_files=['requirements.txt']
  const replanned=replanVerificationForChangedSurface(m,producer,['requirements.txt'],collectRepoContext(root));assert.equal(replanned.reason,'dependency-changed-surface')
  const review=m.execution.obligations.find(o=>o.kind==='review'&&o.summary.includes('Dependency graph changed'));assert.ok(review);assert.deepEqual(review.requiredEvidence,['review-evidence'])
  const prompts=[];let seq=0
  const client={session:{create:async()=>({data:{id:`review-child-${++seq}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const out=await rt.start(m,{objective:'review requirements dependency',role:'security-reviewer',category:'standard',scope:['requirements.txt'],obligationIds:[review.id]})
  const task=m.execution.tasks.find(x=>x.id===out.task_id);assert.ok(task)
  assert.deepEqual(task.requiredEvidence,['review-evidence'])
  assert.deepEqual(task.obligation_ids,[review.id])
  assert.match(prompts[0].body.parts[0].text,/REQUIRED EVIDENCE: review-evidence/)
  assert.doesNotMatch(prompts[0].body.parts[0].text,/REQUIRED EVIDENCE: visual-check/)
  assert.match(prompts[0].body.parts[0].text,/Do not invent provider-, package-, advisory-, CVE-, or scanner-specific evidence\.kind IDs/)
})


test('implicit dependency reviewer recomputes authoritative review evidence after obligation ownership inference',async()=>{
  const root=repo(),s=new MissionStore(root),m=startAssessedMission(s,'dependency-review-implicit-evidence','opaque visual app change',{task_kind:'implementation',risk:'low',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['src/other.ts']})
  m.execution.verification_policy={requiredKinds:['visual-check'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false}
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation)
  const producer=createTask(m,{objective:'update dependency',role:'coder',category:'standard',scope:['src/other.ts'],requiredEvidence:['visual-check'],obligationIds:[implementation.id]})
  producer.status='completed';producer.result={status:'DONE',summary:'dependency updated',changed_files:['requirements.txt'],evidence:[],open_issues:[],needs_context:[]};implementation.status='closed';implementation.closedAt=Date.now();m.vcs.changed_files=['requirements.txt']
  const replanned=replanVerificationForChangedSurface(m,producer,['requirements.txt'],collectRepoContext(root));assert.equal(replanned.reason,'dependency-changed-surface')
  const review=m.execution.obligations.find(o=>o.kind==='review'&&o.summary.includes('Dependency graph changed'));assert.ok(review);assert.deepEqual(review.requiredEvidence,['review-evidence'])
  const prompts=[];let seq=0
  const client={session:{create:async()=>({data:{id:`implicit-review-child-${++seq}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const out=await rt.start(m,{objective:'review requirements dependency',role:'security-reviewer',category:'standard',scope:['requirements.txt']})
  const task=m.execution.tasks.find(x=>x.id===out.task_id);assert.ok(task)
  assert.deepEqual(task.obligation_ids,[review.id])
  assert.deepEqual(task.requiredEvidence,['review-evidence'])
  assert.deepEqual(task.execution_profile.task.required_evidence,['review-evidence'])
  assert.match(prompts[0].body.parts[0].text,/REQUIRED EVIDENCE: review-evidence/)
  assert.doesNotMatch(prompts[0].body.parts[0].text,/REQUIRED EVIDENCE: visual-check/)
  assert.ok(m.execution.ledger.some(e=>e.type==='task.evidence-contract-reconciled'&&e.payload?.obligation_ids?.includes(review.id)&&e.payload?.requested_evidence?.includes('visual-check')&&e.payload?.authoritative_evidence?.includes('review-evidence')))
})

test('implementation settlement replans parent-owned dependency surface before closure',()=>{
  const root=repo(),s=new MissionStore(root),m=startAssessedMission(s,'parent-dependency-surface','opaque visual app change',{task_kind:'implementation',scope:'multi-file',risk:'low',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['requirements.txt']})
  m.execution.verification_policy={requiredKinds:['visual-check'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:false}
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation);implementation.requiredTargets=['requirements.txt']
  m.vcs.changed_files=['requirements.txt']
  const task=createTask(m,{objective:'finish implementation after parent dependency write',role:'coder',category:'standard',scope:['requirements.txt'],requiredEvidence:[],obligationIds:[implementation.id]})
  const worker=createWorker(m,task,'host-default',[],[],[]);worker.status='busy';worker.started_at=Date.now()-10;task.status='running'
  runtime(root).applyResult(m,worker.id,{status:'DONE',summary:'implementation complete',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(implementation.status,'closed')
  const review=m.execution.obligations.find(o=>o.kind==='review'&&o.summary.includes('Dependency graph changed'));assert.ok(review);assert.deepEqual(review.requiredEvidence,['review-evidence']);assert.equal(review.status,'open');assert.equal(m.execution.verification_policy.requireReview,true)
  const replan=m.execution.ledger.findLast(e=>e.type==='verification.replanned');assert.ok(replan);assert.equal(replan.payload?.reason,'dependency-changed-surface');assert.ok(replan.payload?.changed_files?.includes('requirements.txt'))
})
