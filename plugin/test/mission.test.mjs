import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission,applyStructuredFollowup} from './helpers/semantic.mjs'

test('mission starts provisional with no executable obligations or workers',()=>{
  const store=new MissionStore(),m=store.start('s1','opaque request')
  assert.equal(m.semantic_assessment.status,'pending')
  assert.deepEqual(m.obligations,[])
  assert.deepEqual(m.workers,[])
  assert.equal(m.execution_mode,'single')
})

test('assessed material mission creates deterministic obligations without spawning workers',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1','opaque request',{task_kind:'bug-fix',likely_verification:['targeted-tests']})
  assert.ok(m.obligations.some(o=>o.kind==='analysis'))
  assert.ok(m.obligations.some(o=>o.kind==='implementation'))
  assert.ok(m.obligations.some(o=>o.kind==='verification'))
  assert.equal(m.workers.length,0)
})

test('explicit stop is sticky until explicit resume',()=>{
  const store=new MissionStore();startAssessedMission(store,'s1')
  store.stop('s1');assert.equal(store.get('s1')?.user_interrupted,true);assert.equal(store.get('s1')?.status,'stopped')
  store.resume('s1');assert.equal(store.get('s1')?.status,'active')
})

test('structured multi-stream follow-up recomputes execution mode to parallel',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1')
  assert.equal(m.execution_mode,'single')
  const generation=m.generation
  applyStructuredFollowup(store,'s1','opaque multi-stream follow-up',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  assert.equal(m.intent.scope,'multi-stream')
  assert.equal(m.intent.dependencyClass,'independent-multi')
  assert.equal(m.execution_mode,'parallel')
  assert.equal(m.generation,generation+1)
})

test('structured high-risk follow-up opens high-assurance review and review policy',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1','opaque',{risk:'low'})
  applyStructuredFollowup(store,'s1','opaque security follow-up',{risk:'high',required_capabilities:['implementation','security-review','independent-review'],likely_verification:['targeted-tests','review-evidence']})
  assert.equal(m.risk,'high')
  assert.equal(m.verification_policy.requireReview,true)
  assert.ok(m.obligations.some(o=>o.id==='o-high-assurance'&&o.status==='open'))
})

test('authority-boundary structured intent remains single even with multi-stream scope',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'s1','opaque publish request',{scope:'multi-stream',risk:'authority-boundary',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],requested_external_actions:['package-publish']})
  assert.equal(m.risk,'authority-boundary')
  assert.equal(m.execution_mode,'single')
  assert.ok(m.obligations.some(o=>o.kind==='authority'&&o.status==='open'))
})
