import test from 'node:test'
import assert from 'node:assert/strict'
import {MISSION_EVIDENCE_KINDS,isEvidenceItemContract} from '../dist/contracts/evidence.js'
import {WORKER_EVIDENCE_KINDS} from '../dist/contracts/worker-result.js'

const base={id:'ev_1',kind:'targeted-tests',summary:'focused tests passed',scope:['src/a.ts'],observed_at:1,pass:true,outcome:'passed'}

test('mission evidence catalog strictly contains worker proof kinds plus host/control-plane evidence inputs',()=>{
  for(const kind of WORKER_EVIDENCE_KINDS)assert.ok(MISSION_EVIDENCE_KINDS.includes(kind))
  assert.ok(MISSION_EVIDENCE_KINDS.includes('review-input'))
  assert.ok(MISSION_EVIDENCE_KINDS.includes('lsp-diagnostics'))
  assert.ok(MISSION_EVIDENCE_KINDS.includes('source-read-observation'))
  assert.ok(!WORKER_EVIDENCE_KINDS.includes('review-input'))
})

test('EvidenceItem accepts canonical source, state, task and obligation provenance',()=>{
  assert.equal(isEvidenceItemContract({...base,source:'worker:qa-reviewer',source_session_id:'s1',source_state_hash:'abc',task_id:'t1',obligation_ids:['o1']}),true)
})

test('EvidenceItem rejects unknown kinds fields and outcomes',()=>{
  assert.equal(isEvidenceItemContract({...base,kind:'mystery-proof'}),false)
  assert.equal(isEvidenceItemContract({...base,outcome:'maybe'}),false)
  assert.equal(isEvidenceItemContract({...base,magic:true}),false)
})

test('EvidenceItem freshness timestamps must be finite numbers',()=>{
  assert.equal(isEvidenceItemContract({...base,observed_at:Number.NaN}),false)
  assert.equal(isEvidenceItemContract({...base,invalidated_at:Number.POSITIVE_INFINITY}),false)
})
