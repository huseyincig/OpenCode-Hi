import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createToolAfterHook} from '../dist/hooks/tool-after.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {executionAttemptIdentity} from '../dist/contracts/orchestration-core.js'
import {verificationSatisfied} from '../dist/runtime/verification/policy.js'
import {startAssessedMission} from './helpers/semantic.mjs'

test('tool-after cannot close parent verification from worker evidence owned only by implementation',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'m11-claim-link','change src/a.ts then parent verifies',{task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation'),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(implementation);assert.ok(verification)
  const task=createTask(m,{objective:'edit only',role:'coder',category:'quick',scope:['src/a.ts'],obligationIds:[implementation.id],requiredEvidence:[]}),worker=createWorker(m,task,'opencode-go/deepseek-v4-flash');worker.session_id='child-m11';worker.native_state_hash='a'.repeat(64);worker.attempt=1;worker.generation_at_spawn=m.continuation.generation
  const id=executionAttemptIdentity({executionUnitId:`eu:${task.id}`,workerId:worker.id,ordinal:worker.attempt,generation:worker.generation_at_spawn})
  addEvidence(m,{kind:'targeted-tests',summary:'worker narrative says pass but parent owns verification',scope:['src/a.ts'],source:`worker:${worker.id}`,source_session_id:worker.session_id,source_state_hash:worker.native_state_hash,task_id:task.id,obligation_ids:[implementation.id],producer_attempt:{worker_id:worker.id,execution_unit_id:id.executionUnitId,attempt_id:id.attemptId,run_id:id.runId,ordinal:id.ordinal,generation:id.generation},pass:true,outcome:'passed'})
  const after=createToolAfterHook(store)
  await after({sessionID:'m11-claim-link',tool:'read',args:{filePath:'src/a.ts'}},'export const a=1')
  assert.equal(verification.status,'open');assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:['targeted-tests']})
  await after({sessionID:'m11-claim-link',tool:'bash',args:{command:'node --test test/a.test.js'}},{stdout:'1 pass\n0 fail',metadata:{exit:0}})
  assert.equal(verification.status,'closed');assert.equal(verificationSatisfied(m,verification.id).ok,true)
  const parentEvidence=m.execution.evidence.items.findLast(e=>e.source==='bash'&&e.kind==='targeted-tests');assert.ok(parentEvidence?.obligation_ids?.includes(verification.id))
  assert.ok(m.execution.ledger.some(e=>e.type==='obligation.closed'&&e.payload?.obligation===verification.id))
})
