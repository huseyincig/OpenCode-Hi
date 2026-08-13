import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'
import {markMutation,addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {startAssessedMission,applyStructuredFollowup} from './helpers/semantic.mjs'

test('Flow-01 stopped mission is not implicitly resumed by a new task',()=>{
  const store=new MissionStore(),old=startAssessedMission(store,'s1','opaque bug fix',{task_kind:'bug-fix'})
  store.stop('s1');const fresh=store.start('s1','new opaque request')
  assert.notEqual(fresh.mission_id,old.mission_id);assert.equal(fresh.status,'active');assert.equal(fresh.semantic_assessment.status,'pending')
})

test('Flow-03 structured amendment widens completion contract and opens a new semantic generation',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1')
  const g=m.generation,base=m.obligations.filter(o=>o.kind==='implementation').length
  applyStructuredFollowup(store,'s1','opaque additive request',{message_kind:'amendment'})
  assert.equal(m.generation,g+1)
  assert.equal(m.obligations.filter(o=>o.kind==='implementation').length,base+1)
})

test('Flow-04 structured security follow-up escalates risk and verification policy',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1','opaque',{risk:'low'})
  applyStructuredFollowup(store,'s1','opaque security update',{risk:'high',required_capabilities:['implementation','security-review','independent-review'],likely_verification:['targeted-tests','review-evidence']})
  assert.equal(m.risk,'high');assert.equal(m.verification_policy.requireReview,true);assert.ok(m.obligations.some(o=>o.id==='o-high-assurance'))
})

test('Flow-05 permission wait is WAIT rather than stagnation recovery',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1');m.pending_permissions=1;m.stagnation_count=4
  const d=evaluateIdle(m);assert.equal(d.decision,'WAIT');assert.equal(d.reason_code,'waiting-permission')
})

test('Flow-07 mutation after evidence prevents deterministic completion',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1','opaque',{likely_verification:['changed-surface-sanity']})
  for(const o of m.obligations)if(o.kind==='implementation')o.status='closed'
  addEvidence(m,{kind:'changed-surface-sanity',summary:'check',scope:['README.md'],pass:true,outcome:'passed'})
  markMutation(m,['README.md'],'test')
  assert.equal(evaluateCompletion(m).complete,false)
})
