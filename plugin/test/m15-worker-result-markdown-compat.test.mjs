import test from 'node:test'
import assert from 'node:assert/strict'
import {parseWorkerResult} from '../dist/runtime/task/result-parser.js'

test('M15 parses observed bold-label worker result without promoting narrative evidence',()=>{
  const text=`WorkerResult complete.\n\n**status**: DONE\n\n**summary**: Work Unit B completed.\n\n**changed_files**: [\"src/right.js\"]\n\n**evidence**:\n- kind: targeted-tests — NOT passed; execution pending parent control-plane.\n\n**open_issues**: [\"Targeted test pending parent\"]`
  const r=parseWorkerResult(text)
  assert.equal(r.status,'DONE')
  assert.equal(r.summary,'Work Unit B completed.')
  assert.deepEqual(r.evidence,[])
  assert.deepEqual(r.changed_files,[])
  assert.deepEqual(r.open_issues,[])
})

test('M15 preserves canonical JSON and existing STATUS forms',()=>{
  assert.equal(parseWorkerResult('{"status":"DONE","summary":"ok","changed_files":["a.ts"],"evidence":[],"open_issues":[],"needs_context":[]}').status,'DONE')
  assert.equal(parseWorkerResult('STATUS: FIX_REQUIRED\nSUMMARY: retry').status,'FIX_REQUIRED')
  assert.equal(parseWorkerResult('**STATUS**: NEEDS_CONTEXT\n**SUMMARY**: inspect more').status,'NEEDS_CONTEXT')
})

test('M15 prose mentioning done without a status label still fails closed',()=>{
  const r=parseWorkerResult('The work is done and looks correct. No structured status label is present.')
  assert.equal(r.status,'FAILED')
  assert.ok(r.open_issues.includes('Worker did not return parseable structured result'))
})
