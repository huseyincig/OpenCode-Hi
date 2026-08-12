import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { evaluateIdle } from '../dist/runtime/continuation/evaluator.js'
import { markMutation, addEvidence } from '../dist/runtime/evidence/evidence-runtime.js'
import { evaluateCompletion } from '../dist/runtime/completion/evaluator.js'

test('Flow-01 stopped mission is not implicitly resumed by a new task',()=>{
  const store=new MissionStore()
  const old=store.start('s1','fix the bug')
  store.stop('s1')
  const fresh=store.start('s1','README title fix')
  assert.notEqual(fresh.mission_id,old.mission_id)
  assert.equal(fresh.status,'active')
})

test('Flow-03 active follow-up widens the completion contract without invalidating generation',()=>{
  const store=new MissionStore()
  const m=store.start('s1','fix the README typo')
  const g=m.generation
  store.amend('s1','also update the CHANGELOG line')
  assert.equal(m.generation,g)
  assert.ok(m.obligations.some(o=>o.summary.includes('CHANGELOG')))
})

test('Flow-04 security follow-up escalates risk and verification policy',()=>{
  const store=new MissionStore()
  const m=store.start('s1','fix the README typo')
  store.amend('s1','also change auth permission behavior')
  assert.equal(m.risk,'high')
  assert.equal(m.verification_policy.requireReview,true)
  assert.ok(m.obligations.some(o=>o.id==='o-high-assurance'))
})

test('Flow-05 permission wait is WAIT rather than stagnation recovery',()=>{
  const store=new MissionStore(); const m=store.start('s1','fix the bug')
  m.pending_permissions=1; m.stagnation_count=4
  const d=evaluateIdle(m)
  assert.equal(d.decision,'WAIT'); assert.equal(d.reason_code,'waiting-permission')
})

test('Flow-07 mutation after evidence prevents deterministic completion',()=>{
  const store=new MissionStore(); const m=store.start('s1','fix the README typo')
  for(const o of m.obligations) if(o.kind==='implementation') o.status='closed'
  addEvidence(m,{kind:'changed-surface-sanity',summary:'check',scope:['README.md'],pass:true,outcome:'passed'})
  markMutation(m,['README.md'],'test')
  assert.equal(evaluateCompletion(m).complete,false)
})
