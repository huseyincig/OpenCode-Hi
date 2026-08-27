import test from 'node:test'
import assert from 'node:assert/strict'
import {parseWorkerResult} from '../dist/runtime/task/result-parser.js'
import {normalizeWorkerResult} from '../dist/contracts/worker-result.js'

test('parses observed bold-label worker result without promoting narrative evidence',()=>{
  const text=`WorkerResult complete.\n\n**status**: DONE\n\n**summary**: Work Unit B completed.\n\n**changed_files**: [\"src/right.js\"]\n\n**evidence**:\n- kind: targeted-tests — NOT passed; execution pending parent control-plane.\n\n**open_issues**: [\"Targeted test pending parent\"]`
  const r=parseWorkerResult(text)
  assert.equal(r.status,'DONE')
  assert.equal(r.summary,'Work Unit B completed.')
  assert.deepEqual(r.evidence,[])
  assert.deepEqual(r.changed_files,[])
  assert.deepEqual(r.open_issues,[])
})

test('preserves canonical JSON and existing STATUS forms',()=>{
  assert.equal(parseWorkerResult('{"status":"DONE","summary":"ok","changed_files":["a.ts"],"evidence":[],"open_issues":[],"needs_context":[]}').status,'DONE')
  assert.equal(parseWorkerResult('STATUS: FIX_REQUIRED\nSUMMARY: retry').status,'FIX_REQUIRED')
  assert.equal(parseWorkerResult('**STATUS**: NEEDS_CONTEXT\n**SUMMARY**: inspect more').status,'NEEDS_CONTEXT')
})

test('prose mentioning done without a status label still fails closed',()=>{
  const r=parseWorkerResult('The work is done and looks correct. No structured status label is present.')
  assert.equal(r.status,'FAILED')
  assert.ok(r.open_issues.includes('Worker did not return parseable structured result'))
})

test('object-valued issue details remain deterministic instead of collapsing to object Object',()=>{const r=normalizeWorkerResult({status:'FIX_REQUIRED',summary:'review needs correction',changed_files:[],evidence:[],open_issues:[{id:'review-verdict-required:t1',summary:'return canonical verdict'}],needs_context:[{kind:'review-evidence',outcome:'passed'}]});assert.deepEqual(r.open_issues,['{"id":"review-verdict-required:t1","summary":"return canonical verdict"}']);assert.deepEqual(r.needs_context,['{"kind":"review-evidence","outcome":"passed"}']);assert.doesNotMatch(r.open_issues[0],/\[object Object\]/)})
