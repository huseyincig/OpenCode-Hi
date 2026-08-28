import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {recoveryPlan} from '../dist/runtime/continuation/recovery.js'
import {recordRecoveryStrategy,recoveryModelHazard,recoverySemanticSignature,recoveryStrategyEligibility} from '../dist/runtime/continuation/recovery-governor.js'
import {dispatchContinuation} from '../dist/runtime/continuation/dispatcher.js'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'

function mission(id='recovery-governor'){
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,id,'opaque implementation',{task_kind:'implementation',likely_verification:[]})
  m.execution.obligations=m.execution.obligations.filter(o=>o.kind!=='verification')
  store.updateProgress(m,false)
  return{store,m}
}

test('same recovery strategy cannot replay on unchanged semantic state and deterministically advances rung',()=>{
  const {m}=mission('rg-repeat');m.continuation.stagnation_count=1
  const first=recoveryPlan(m);assert.equal(first.action,'same-worker-resume');assert.equal(recoveryStrategyEligibility(m,first).allowed,true)
  recordRecoveryStrategy(m,first,'started',10)
  assert.equal(recoveryStrategyEligibility(m,first).allowed,false)
  const next=recoveryPlan(m);assert.equal(next.level,2);assert.equal(next.action,'same-worker-resume')
  assert.notEqual(next.level,first.level)
  assert.notEqual(recoveryStrategyEligibility(m,next).fingerprint,recoveryStrategyEligibility(m,first).fingerprint)
  assert.match(next.prompt,/materially different corrective hypothesis or action/i)
})

test('material mechanical evidence delta permits the same recovery strategy again',()=>{
  const {store,m}=mission('rg-new-info');m.continuation.stagnation_count=1
  const first=recoveryPlan(m);recordRecoveryStrategy(m,first,'started',10)
  addEvidence(m,{kind:'diagnostic-evidence',summary:'new falsifying observation',source:'test:diagnostic',outcome:'passed',pass:true});assert.equal(store.updateProgress(m,false),true)
  m.continuation.stagnation_count=1
  const again=recoveryPlan(m);assert.equal(again.level,1);assert.equal(again.action,'same-worker-resume')
  assert.equal(recoveryStrategyEligibility(m,again).allowed,true)
})

test('equivalent failure marker churn exhausts same-model correction after one repeated normalized failure',()=>{
  const {store,m}=mission('rg-failure-marker-churn')
  const task=createTask(m,{objective:'bounded review',role:'security-reviewer',category:'standard'}),worker=createWorker(m,task,'p/a');worker.session_id='child';worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/b'];task.result={status:'FIX_REQUIRED',summary:'verdict missing',changed_files:[],evidence:[],open_issues:['review-verdict-required:'+task.id],needs_context:['review-evidence required']};store.updateProgress(m,false)
  const signature=recoverySemanticSignature(m)
  const first=recordRecoveryStrategy(m,{level:1,action:'same-worker-resume'},'started',10,{task_id:task.id,worker_id:worker.id,model:'p/a'});assert.ok(first.failure_signature)
  task.result={...task.result,open_issues:['{"id":"review-verdict-required:'+task.id+'","summary":"canonical verdict still missing"}'],needs_context:['review-verdict: canonical review-evidence required']};assert.equal(store.updateProgress(m,false),true,'failure description can be new diagnostic state without being recovery gain')
  assert.equal(recoverySemanticSignature(m),signature)
  const hazard=recoveryModelHazard(m);assert.equal(hazard.open,true);assert.equal(hazard.same_model_exhausted,true);assert.equal(hazard.attempts,1);assert.deepEqual(hazard.recovery_candidates,['p/b'])
  assert.equal(recoveryStrategyEligibility(m,{level:2,action:'same-worker-resume'}).allowed,false)
})

test('unknown consequential release outcome blocks automatic recovery until reconciliation',()=>{
  const {m}=mission('rg-unknown-effect');m.continuation.stagnation_count=3
  m.release.release_chain={push:{outcome:'unknown',at:Date.now(),command:'git push'}}
  assert.equal(recoveryPlan(m).action,'user-action')
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'recovery-effect-uncertain');assert.equal(decision.reason,'release-push-outcome-unknown')
  assert.equal(m.continuation.stagnation_count,0)
})

test('busy parent session defers synthetic continuation without counting a transport failure',async()=>{
  const {m}=mission('rg-busy-parent');const calls=[]
  const host={sessionStatus:async()=>'busy',continueSession:async(...args)=>{calls.push(args);return true}}
  const ok=await dispatchContinuation(host,m,'continue safely','child-result-ready')
  assert.equal(ok,false);assert.equal(calls.length,0);assert.equal(m.continuation.continuation_failure_count??0,0)
  assert.ok(m.execution.ledger.some(e=>e.type==='continuation.deferred'&&e.payload?.reason==='parent-session-active'&&e.payload?.host_status==='busy'))
})

test('delivered stagnation continuation records the exact strategy decision state',async()=>{
  const {m}=mission('rg-dispatch');m.continuation.stagnation_count=3
  const plan=recoveryPlan(m);assert.equal(plan.action,'narrow-task')
  const calls=[];const host={sessionStatus:async()=>'idle',continueSession:async(...args)=>{calls.push(args);return true}}
  const ok=await dispatchContinuation(host,m,plan.prompt,`stagnation-level-${plan.level}:${plan.action}`)
  assert.equal(ok,true);assert.equal(calls.length,1)
  const last=m.continuation.recovery_history?.at(-1);assert.equal(last.action,'narrow-task');assert.equal(last.level,3);assert.equal(last.outcome,'started');assert.equal(last.progress_signature,recoverySemanticSignature(m))
})

test('recovery history is bounded and malformed durable records fail closed',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-recovery-governor-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'rg-persist','opaque',{task_kind:'implementation',likely_verification:[]});m.execution.obligations=m.execution.obligations.filter(o=>o.kind!=='verification');store.updateProgress(m,false)
    for(let i=0;i<30;i++){m.continuation.stagnation_count=(i%5)+1;const plan=recoveryPlan(m);recordRecoveryStrategy(m,plan,'started',100+i);m.continuation.recovery_history.at(-1).progress_signature=`${(i+1).toString(16).padStart(8,'0')}`}
    assert.equal(m.continuation.recovery_history.length,24)
    const persistence=new RuntimePersistence(root);persistence.save(store.all(),true);assert.equal(persistence.load().length,1)
    const raw=JSON.parse(readFileSync(persistence.path,'utf8'));raw.missions[0].continuation.recovery_history[0].fingerprint='forged';writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0);assert.match(String(persistence.lastLoadReport.error),/invalid mission state/i)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('recovery semantic signature ignores activity-only worker attempt churn',()=>{
  const {store,m}=mission('rg-activity-churn')
  const task=createTask(m,{objective:'fix',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/a');worker.session_id='child';worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/b'];store.updateProgress(m,false)
  const before=recoverySemanticSignature(m)
  worker.attempt+=1;worker.status='busy';task.status='running';assert.equal(store.updateProgress(m,false),false);worker.status='ready';task.status='waiting';assert.equal(store.updateProgress(m,false),false)
  assert.equal(recoverySemanticSignature(m),before,'activity churn must not manufacture a fresh recovery epoch')
})


test('pending evidence churn does not reset one-correction same-failure hazard signature',()=>{
  const {store,m}=mission('rg-pending-evidence-churn')
  const task=createTask(m,{objective:'visual verify',role:'visual-qa',category:'visual'}),worker=createWorker(m,task,'p/a');worker.session_id='child';worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/b'];task.result={status:'FIX_REQUIRED',summary:'visual contract missing',changed_files:[],evidence:[],open_issues:['verification-coverage-missing'],needs_context:['visual evidence required']};store.updateProgress(m,false)
  const signature=recoverySemanticSignature(m)
  recordRecoveryStrategy(m,{level:1,action:'same-worker-resume'},'started',10,{task_id:task.id,worker_id:worker.id,model:'p/a'})
  const pending1=addEvidence(m,{kind:'browser-evidence',summary:'attempt one inspect',source:'browser:bo_one',task_id:task.id,obligation_ids:[],outcome:'pending',reason:'raw browser observation'});store.updateProgress(m,false);pending1.invalidated_at=Date.now();store.updateProgress(m,false)
  assert.equal(recoverySemanticSignature(m),signature);m.continuation.stagnation_count=2
  const hazard=recoveryModelHazard(m);assert.equal(hazard.open,true);assert.equal(hazard.attempts,1);assert.deepEqual(hazard.recovery_candidates,['p/b'])
})

test('one same-model correction with the same normalized failure opens recovery-only model escalation',()=>{
  const {store,m}=mission('rg-model-hazard')
  const task=createTask(m,{objective:'fix',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/a');worker.session_id='child';worker.status='ready';task.status='waiting';worker.recovery_candidates=['p/b','p/c'];task.result={status:'FIX_REQUIRED',summary:'contract invalid',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['worker-result-contract-retry']};store.updateProgress(m,false)
  recordRecoveryStrategy(m,{level:1,action:'same-worker-resume'},'started',10,{task_id:task.id,worker_id:worker.id,model:'p/a'})
  worker.attempt+=1;store.updateProgress(m,false);m.continuation.stagnation_count=2
  const hazard=recoveryModelHazard(m);assert.equal(hazard.open,true);assert.equal(hazard.attempts,1);assert.deepEqual(hazard.recovery_candidates,['p/b','p/c'])
  const plan=recoveryPlan(m);assert.equal(plan.level,3);assert.equal(plan.action,'model-escalation');assert.match(plan.prompt,/recovery-only model candidate/i)
})

test('explicit task model exhausts same-failure correction without inventing model authority',()=>{
  const {store,m}=mission('rg-explicit-model')
  const task=createTask(m,{objective:'fix',role:'coder',category:'standard'}),worker=createWorker(m,task,'p/a');worker.session_id='child';worker.status='ready';task.status='waiting';worker.requested_model='p/a';worker.recovery_candidates=['p/b'];task.result={status:'FIX_REQUIRED',summary:'contract invalid',changed_files:[],evidence:[],open_issues:['worker-result-contract-invalid'],needs_context:['worker-result-contract-retry']};store.updateProgress(m,false)
  recordRecoveryStrategy(m,{level:1,action:'same-worker-resume'},'started',10,{task_id:task.id,worker_id:worker.id,model:'p/a'});m.continuation.stagnation_count=2
  const hazard=recoveryModelHazard(m);assert.equal(hazard.open,false);assert.equal(hazard.same_model_exhausted,true);assert.match(hazard.reason,/explicit-task-model.*exhausted/);assert.equal(recoveryPlan(m).action,'narrow-task')
})
