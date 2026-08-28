import test from 'node:test'
import assert from 'node:assert/strict'
import {WORKER_RESULT_JSON_SCHEMA,workerResultOutputFormat} from '../dist/contracts/worker-result-schema.js'
import {normalizeWorkerResult} from '../dist/contracts/worker-result.js'

test('native WorkerResult schema makes evidence nesting explicit and rejects rerun21 top-level evidence shape',()=>{
  assert.equal(WORKER_RESULT_JSON_SCHEMA.additionalProperties,false)
  assert.ok(WORKER_RESULT_JSON_SCHEMA.required.includes('evidence'))
  assert.equal(WORKER_RESULT_JSON_SCHEMA.properties.evidence.type,'array')
  assert.equal(WORKER_RESULT_JSON_SCHEMA.properties['source-provenance-evidence'],undefined)
  const format=workerResultOutputFormat();assert.equal(format.type,'json_schema');assert.equal(format.retryCount,0);assert.equal(format.schema,WORKER_RESULT_JSON_SCHEMA)
  const rerun21=normalizeWorkerResult({status:'DONE',summary:'found target',changed_files:[],open_issues:[],needs_context:[],context_gap:'none','source-provenance-evidence':{kind:'source-provenance-evidence',summary:'index',scope:['index.html'],evidence_refs:['ev_example'],outcome:'passed'}})
  assert.deepEqual(rerun21.evidence,[],'compatibility normalizer must not silently promote an evidence-kind top-level key')
})
