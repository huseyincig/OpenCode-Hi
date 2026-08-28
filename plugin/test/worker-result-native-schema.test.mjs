import test from 'node:test'
import assert from 'node:assert/strict'
import {WORKER_RESULT_JSON_SCHEMA,isWorkerResultTransportContract,workerResultOutputFormat} from '../dist/contracts/worker-result-schema.js'
import {isWorkerResultContract,normalizeWorkerResult} from '../dist/contracts/worker-result.js'

test('native WorkerResult schema makes evidence nesting explicit and rejects rerun21 top-level evidence shape',()=>{
  assert.equal(WORKER_RESULT_JSON_SCHEMA.additionalProperties,false)
  assert.ok(WORKER_RESULT_JSON_SCHEMA.required.includes('evidence'))
  assert.equal(WORKER_RESULT_JSON_SCHEMA.properties.evidence.type,'array')
  assert.equal(WORKER_RESULT_JSON_SCHEMA.properties['source-provenance-evidence'],undefined)
  const format=workerResultOutputFormat();assert.equal(format.type,'json_schema');assert.equal(format.retryCount,0);assert.equal(format.schema,WORKER_RESULT_JSON_SCHEMA)
  const rerun21=normalizeWorkerResult({status:'DONE',summary:'found target',changed_files:[],open_issues:[],needs_context:[],context_gap:'none','source-provenance-evidence':{kind:'source-provenance-evidence',summary:'index',scope:['index.html'],evidence_refs:['ev_example'],outcome:'passed'}})
  assert.deepEqual(rerun21.evidence,[],'compatibility normalizer must not silently promote an evidence-kind top-level key')
})


test('transport-valid rerun25-style visual payload normalizes without fabricating canonical coverage authority',()=>{
  const raw={status:'DONE',summary:'browser checks complete',changed_files:['index.html'],evidence:[{kind:'browser-evidence',summary:'observed UI',scope:['desktop'],evidence_refs:['ev_current_attempt_full_ref'],pass:true,outcome:'passed'}],verification_coverage:[{case_id:'desktop-layout',outcome:'passed',evidence_refs:['ev_current_attempt_full_ref']}],open_issues:[],needs_context:[]}
  assert.equal(isWorkerResultTransportContract(raw),true)
  assert.equal(isWorkerResultContract(raw),false,'dynamic/canonical case identity remains stricter than transport shape')
  const normalized=normalizeWorkerResult(raw)
  assert.equal(isWorkerResultContract(normalized),true)
  assert.equal(normalized.verification_coverage,undefined,'noncanonical invented case IDs are dropped, never promoted to verification authority')
  assert.equal(normalized.status,'DONE','semantic TaskResultReconciler remains responsible for converting missing required cases to FIX_REQUIRED')
})

test('structured transport guard remains fail-closed for malformed core envelopes',()=>{
  assert.equal(isWorkerResultTransportContract({status:'DONE',summary:'missing required arrays'}),false)
  assert.equal(isWorkerResultTransportContract({status:'DONE',summary:'unknown top-level',changed_files:[],evidence:[],open_issues:[],needs_context:[],magic:true}),false)
  assert.equal(isWorkerResultTransportContract({status:'DONE',summary:'bad evidence',changed_files:[],evidence:[{kind:'made-up-proof',summary:'x'}],open_issues:[],needs_context:[]}),false)
})
