import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {applyStructuredFollowup} from './helpers/semantic.mjs'

const R2_PROMPT="Fix the real production regression in OpenCode's ripgrep preview handling. A failing regression test in packages/core/test/ripgrep.test.ts demonstrates the bug. Make the smallest correct production-code change. Do not modify tests or unrelated files. Run `bun test test/ripgrep.test.ts` from packages/core and stop when it passes."
const R2_ASSESSMENT={material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['packages/core/src/ripgrep.ts','packages/core/test/ripgrep.test.ts'],intent_signals:['intent.tdd'],suppressed_intent_signals:[]}
const TDD_ASSESSMENT={...R2_ASSESSMENT,scope:'multi-file',dependency_class:'sequential',likely_targets:['src/parser.ts','test/parser.test.ts']}

function lastSemanticLedger(m,type='semantic.assessed'){return [...m.execution.ledger].reverse().find(x=>x.type===type)}

test('explicit do-not-modify-tests authority suppresses a contradictory model-derived TDD signal',()=>{
  const store=new MissionStore(),m=store.start('m15-r2',R2_PROMPT)
  store.applyInitialSemanticAssessment('m15-r2',R2_ASSESSMENT)
  assert.equal(m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'||x.signal==='intent.tdd'),false)
  assert.deepEqual(m.identity.intent.likelyTargets,R2_ASSESSMENT.likely_targets,'test path remains available as verification/context evidence')
  const payload=lastSemanticLedger(m)?.payload??{}
  assert.deepEqual(payload.intent_signals,['intent.tdd'])
  assert.deepEqual(payload.effective_intent_signals,[])
  assert.ok(payload.runtime_suppressed_intent_signals.includes('intent.tdd'))
})

test('explicit TDD request is preserved when the user did not forbid test mutation',()=>{
  const store=new MissionStore(),m=store.start('m15-real-tdd','Use TDD. Add a failing regression test first, then implement the parser fix and run the targeted tests.')
  store.applyInitialSemanticAssessment('m15-real-tdd',TDD_ASSESSMENT)
  assert.ok(m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'&&x.signal==='intent.tdd'))
  const payload=lastSemanticLedger(m)?.payload??{}
  assert.ok(payload.effective_intent_signals.includes('intent.tdd'))
  assert.ok(!payload.runtime_suppressed_intent_signals.includes('intent.tdd'))
})

test('a test-verification request without mutation prohibition does not invent runtime suppression',()=>{
  const store=new MissionStore(),m=store.start('m15-test-command','Fix src/a.ts and run npm test. The current regression test fails.')
  store.applyInitialSemanticAssessment('m15-test-command',{...R2_ASSESSMENT,intent_signals:[]})
  const payload=lastSemanticLedger(m)?.payload??{}
  assert.deepEqual(payload.runtime_suppressed_intent_signals,[])
  assert.equal(m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'),false)
})

test('follow-up no-test-mutation authority removes an already active TDD methodology need',()=>{
  const store=new MissionStore(),m=store.start('m15-tdd-followup','Use TDD and add the regression test first.')
  store.applyInitialSemanticAssessment('m15-tdd-followup',TDD_ASSESSMENT)
  assert.ok(m.methodology.methodology_needs.some(x=>x.signal==='intent.tdd'))
  applyStructuredFollowup(store,'m15-tdd-followup','Do not modify tests from this point forward; keep the existing tests unchanged.',{message_kind:'constraint',intent_signals:[]})
  assert.equal(m.methodology.methodology_needs.some(x=>x.signal==='intent.tdd'),false)
  const payload=lastSemanticLedger(m,'semantic.followup-assessed')?.payload??{}
  assert.ok(payload.runtime_suppressed_intent_signals.includes('intent.tdd'))
})

test('explicit unchanged-test wording suppresses TDD without suppressing verification evidence',()=>{
  const store=new MissionStore(),m=store.start('m15-unchanged-tests','Fix src/a.ts. Test files must remain unchanged. Run the targeted tests afterwards.')
  store.applyInitialSemanticAssessment('m15-unchanged-tests',R2_ASSESSMENT)
  assert.equal(m.methodology.methodology_needs.some(x=>x.signal==='intent.tdd'),false)
  assert.deepEqual(m.execution.verification_policy.requiredKinds,['targeted-tests'])
})
