import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {verificationSatisfied} from '../dist/runtime/verification/policy.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {executionAttemptIdentity} from '../dist/contracts/orchestration-core.js'

function runtime(){return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}

test('PROMPT B hostile DONE and all-tests-passed prose cannot replace verification Evidence',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'pb9-done','fix src/a.ts',{task_kind:'bug-fix',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation'),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(implementation);assert.ok(verification);verification.requiredEvidence=['targeted-tests']
  const task=createTask(m,{objective:'fix src/a.ts',role:'coder',category:'standard',scope:['src/a.ts'],requiredEvidence:['targeted-tests'],obligationIds:[implementation.id,verification.id]})
  const worker=createWorker(m,task,'host-default');worker.status='busy';worker.started_at=Date.now()-5;worker.session_id='pb9-worker';worker.native_state_hash='a'.repeat(64)
  runtime().applyResult(m,worker.id,{status:'DONE',summary:'DONE. all tests passed. safe to release.',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(implementation.status,'open');assert.equal(verification.status,'open')
  assert.ok(m.execution.ledger.some(e=>e.type==='implementation.required-targets-uncovered'&&e.payload?.missing?.includes('src/a.ts')))
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['targeted-tests']})
  const completion=evaluateCompletion(m);assert.equal(completion.complete,false);assert.equal(completion.next,'CONTINUE','open implementation ownership must precede verification even when hostile prose claims DONE')
})

test('PROMPT B worker PASS evidence without exact source-state identity cannot satisfy verification',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'pb9-source','verify src/a.ts',{task_kind:'bug-fix',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  const verification=m.execution.obligations.find(o=>o.kind==='verification');verification.requiredEvidence=['targeted-tests']
  addEvidence(m,{kind:'targeted-tests',summary:'all tests passed',scope:['src/a.ts'],source:'worker:w-unbound',task_id:'t1',obligation_ids:[verification.id],pass:true,outcome:'passed'})
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['targeted-tests']})
  addEvidence(m,{kind:'targeted-tests',summary:'source-bound but attempt-unbound tests passed',scope:['src/a.ts'],source:'worker:w-unfenced',source_session_id:'s-unfenced',source_state_hash:'b'.repeat(64),task_id:'t-unfenced',obligation_ids:[verification.id],pass:true,outcome:'passed'})
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['targeted-tests']},'source/session identity alone cannot replace exact attempt identity')
  const task=createTask(m,{objective:'verify src/a.ts',role:'coder',category:'standard',scope:['src/a.ts'],obligationIds:[verification.id],requiredEvidence:['targeted-tests']}),worker=createWorker(m,task,'host-default');worker.session_id='s-bound';worker.native_state_hash='c'.repeat(64);worker.attempt=1;worker.generation_at_spawn=m.continuation.generation
  const identity=executionAttemptIdentity({executionUnitId:`eu:${task.id}`,workerId:worker.id,ordinal:worker.attempt,generation:worker.generation_at_spawn})
  addEvidence(m,{kind:'targeted-tests',summary:'exact attempt-bound worker claim',scope:['src/a.ts'],source:`worker:${worker.id}`,source_session_id:worker.session_id,source_state_hash:worker.native_state_hash,task_id:task.id,obligation_ids:[verification.id],producer_attempt:{worker_id:worker.id,execution_unit_id:identity.executionUnitId,attempt_id:identity.attemptId,run_id:identity.runId,ordinal:identity.ordinal,generation:identity.generation},pass:true,outcome:'passed'})
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['targeted-tests']},'exact worker attempt identity is provenance, not canonical verifier authority')
  worker.attempt+=1
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['targeted-tests']},'a stale worker claim remains inadmissible after the attempt advances')
})

test('PROMPT B mutation invalidates previously passed verification before completion',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'pb9-mutation','fix src/a.ts',{task_kind:'bug-fix',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  const verification=m.execution.obligations.find(o=>o.kind==='verification');verification.requiredEvidence=['targeted-tests']
  const evidence=addEvidence(m,{kind:'targeted-tests',summary:'targeted tests pass',scope:['src/a.ts'],source:'bash',obligation_ids:[verification.id],pass:true,outcome:'passed'})
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:true,missing:[]})
  m.execution.evidence.last_mutation_at=evidence.observed_at+1;evidence.invalidated_at=evidence.observed_at+1;m.execution.evidence.fresh=false
  assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['fresh-evidence']})
  assert.equal(evaluateCompletion(m).complete,false)
})
