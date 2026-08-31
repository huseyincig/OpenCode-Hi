import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {applyStructuredFollowup} from './helpers/semantic.mjs'

const R2_PROMPT="Fix the real production regression in OpenCode's packages/core/src/ripgrep.ts ripgrep preview handling. A failing regression test in packages/core/test/ripgrep.test.ts demonstrates the bug. Make the smallest correct production-code change. Do not modify tests or unrelated files. Run `bun test test/ripgrep.test.ts` from packages/core and stop when it passes."
const R2_ASSESSMENT={material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','verification'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['packages/core/src/ripgrep.ts','packages/core/test/ripgrep.test.ts'],intent_signals:['intent.tdd'],suppressed_intent_signals:[]}
const TDD_ASSESSMENT={...R2_ASSESSMENT,scope:'multi-file',dependency_class:'sequential',likely_targets:['src/parser.ts','test/parser.test.ts']}

function lastSemanticLedger(m,type='semantic.assessed'){return [...m.execution.ledger].reverse().find(x=>x.type===type)}

test('explicit do-not-modify-tests authority suppresses a contradictory model-derived TDD signal',()=>{
  const store=new MissionStore(),m=store.start('m15-r2',R2_PROMPT)
  store.applyInitialSemanticAssessment('m15-r2',R2_ASSESSMENT)
  assert.equal(m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'||x.signal==='intent.tdd'),false)
  assert.equal(m.identity.intent.requiredCapabilities.includes('test-authoring'),false,'contradictory TDD signal cannot retain write authority after grounding')
  assert.equal(m.execution.obligations.some(o=>o.kind==='test-authoring'),false,'contradictory TDD signal cannot create test-authoring work')
  assert.deepEqual(m.identity.intent.likelyTargets,R2_ASSESSMENT.likely_targets,'test path remains available as verification/context evidence')
  const payload=lastSemanticLedger(m)?.payload??{}
  assert.deepEqual(payload.intent_signals,['intent.tdd'])
  assert.deepEqual(payload.effective_intent_signals,[])
  assert.ok(payload.runtime_suppressed_intent_signals.includes('intent.tdd'))
})

test('model-supplied test-authoring cannot override explicit no-test-mutation user authority',()=>{
  const store=new MissionStore(),m=store.start('m15-model-cap-forbidden','Fix src/a.ts. Do not modify test/a.test.ts. Run npm test and report completion only after it passes.')
  store.applyInitialSemanticAssessment('m15-model-cap-forbidden',{...R2_ASSESSMENT,required_capabilities:['implementation','verification','test-authoring'],likely_targets:['src/a.ts','test/a.test.ts'],mutation_targets:['src/a.ts','test/a.test.ts'],intent_signals:[]})
  assert.equal(m.identity.intent.requiredCapabilities.includes('test-authoring'),false,'model capability cannot create test-write authority against explicit user preservation')
  assert.equal(m.execution.obligations.some(o=>o.kind==='test-authoring'),false,'no test-authoring obligation may survive explicit no-test-mutation authority')
  assert.deepEqual(m.identity.intent.mutationTargets,['src/a.ts'],'model-proposed test mutation target must be stripped while production mutation remains')
  assert.deepEqual(m.identity.intent.likelyTargets,['src/a.ts','test/a.test.ts'],'existing test target remains available as verification/context input')
  assert.deepEqual(m.execution.verification_policy.requiredKinds,['targeted-tests'])
})

test('generic existing-test execution does not authorize model-supplied test-authoring',()=>{
  const store=new MissionStore(),m=store.start('m15-run-only','Fix src/a.ts and run npm test. The existing regression test currently fails.')
  store.applyInitialSemanticAssessment('m15-run-only',{...R2_ASSESSMENT,required_capabilities:['implementation','verification','test-authoring'],intent_signals:[]})
  assert.equal(m.identity.intent.requiredCapabilities.includes('test-authoring'),false)
  assert.equal(m.execution.obligations.some(o=>o.kind==='test-authoring'),false)
  assert.deepEqual(m.execution.verification_policy.requiredKinds,['targeted-tests'])
})

test('ungrounded test-authoring request-unit mapping is removed with the model capability',()=>{
  const store=new MissionStore(),m=store.start('m15-ru-strip','Fix src/a.ts and run the existing tests; do not modify tests.')
  store.applyInitialSemanticAssessment('m15-ru-strip',{...R2_ASSESSMENT,scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','verification','test-authoring'],capability_request_units:{'test-authoring':['ru1']},intent_signals:[]})
  assert.equal(m.identity.intent.requiredCapabilities.includes('test-authoring'),false)
  assert.equal(m.execution.obligations.some(o=>o.kind==='test-authoring'),false)
})

test('explicit TDD request is preserved when the user did not forbid test mutation',()=>{
  const store=new MissionStore(),m=store.start('m15-real-tdd','Use TDD. Add a failing regression test first, then implement the parser fix and run the targeted tests.')
  store.applyInitialSemanticAssessment('m15-real-tdd',TDD_ASSESSMENT)
  assert.ok(m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'&&x.signal==='intent.tdd'))
  assert.ok(m.identity.intent.requiredCapabilities.includes('test-authoring'),'explicit TDD request must derive grounded test-authoring authority')
  assert.ok(m.execution.obligations.some(o=>o.kind==='test-authoring'),'explicit TDD request must materialize test-authoring work')
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


test('follow-up false TDD signal cannot grant test-authoring authority',()=>{
  const store=new MissionStore(),m=store.start('m15-followup-false-tdd','Fix src/a.ts without changing tests, then run npm test.')
  store.applyInitialSemanticAssessment('m15-followup-false-tdd',{...R2_ASSESSMENT,intent_signals:[]})
  applyStructuredFollowup(store,'m15-followup-false-tdd','Run the existing tests to verify the fix; do not modify tests.',{message_kind:'verification',required_capabilities:['implementation','verification','test-authoring'],intent_signals:['intent.tdd']})
  assert.equal(m.identity.intent.requiredCapabilities.includes('test-authoring'),false,'follow-up false-TDD signal cannot grant durable test-authoring authority')
  assert.equal(m.execution.obligations.some(o=>o.kind==='test-authoring'),false,'follow-up false-TDD signal cannot create test-authoring work')
  const payload=lastSemanticLedger(m,'semantic.followup-assessed')?.payload??{}
  assert.ok(payload.runtime_suppressed_intent_signals.includes('intent.tdd'))
})

test('explicit semantic test-authoring capability survives TDD grounding',()=>{
  const store=new MissionStore(),m=store.start('m15-explicit-test-authority','Add a regression test for src/a.ts, then implement the fix.')
  store.applyInitialSemanticAssessment('m15-explicit-test-authority',{...R2_ASSESSMENT,required_capabilities:['implementation','verification','test-authoring'],intent_signals:[]})
  assert.ok(m.identity.intent.requiredCapabilities.includes('test-authoring'),'explicit required_capabilities test-authoring authority must be preserved')
  assert.ok(m.execution.obligations.some(o=>o.kind==='test-authoring'),'explicit test-authoring authority must materialize its obligation')
})
