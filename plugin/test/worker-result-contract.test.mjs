import test from 'node:test'
import assert from 'node:assert/strict'
import {isWorkerResultContract,normalizeWorkerResult} from '../dist/contracts/worker-result.js'

test('normalized WorkerResult is canonical and accepted by the same strict contract validator',()=>{
  const result=normalizeWorkerResult({status:'PASS',summary:'ok',changed_files:['src/a.ts'],evidence:[{kind:'targeted-tests',summary:'focused test passed',outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(result.status,'DONE')
  assert.equal(isWorkerResultContract(result),true)
})

test('WorkerResult contract rejects unknown fields instead of letting persistence invent a second schema',()=>{
  const result=normalizeWorkerResult({status:'DONE',summary:'ok',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(isWorkerResultContract({...result,magic:true}),false)
})

test('WorkerResult evidence rejects unknown proof kinds and malformed evidence metadata',()=>{
  const base=normalizeWorkerResult({status:'DONE',summary:'ok',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(isWorkerResultContract({...base,evidence:[{kind:'made-up-proof',summary:'x'}]}),false)
  assert.equal(isWorkerResultContract({...base,evidence:[{kind:'build',summary:'x',outcome:'maybe'}]}),false)
})

test('methodology observations must cite exact canonical worker evidence kinds',()=>{
  const base=normalizeWorkerResult({status:'DONE',summary:'ok',changed_files:[],evidence:[{kind:'diagnostic-evidence',summary:'root cause'}],open_issues:[],needs_context:[]})
  const good={...base,methodology_observations:[{key:'repeatable-debug',procedure:'Inspect the failing boundary, isolate the cause, then verify the correction.',trigger:'Repeated unknown failure',do_not_trigger:'Known local typo',exit_condition:'Root cause and correction are evidenced',evidence:['diagnostic-evidence']}]}
  assert.equal(isWorkerResultContract(good),true)
  assert.equal(isWorkerResultContract({...good,methodology_observations:[{...good.methodology_observations[0],evidence:['summary-text']}]}),false)
})

test('USER_ACTION_REQUIRED remains a compatibility alias but canonical result state is BLOCKED',()=>{
  const result=normalizeWorkerResult({status:'USER_ACTION_REQUIRED',summary:'MFA required'})
  assert.equal(result.status,'BLOCKED')
  assert.ok(result.open_issues.includes('USER_ACTION_REQUIRED'))
  assert.equal(isWorkerResultContract(result),true)
})
