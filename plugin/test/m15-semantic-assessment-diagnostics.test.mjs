import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSemanticIntentAssessment} from '../dist/runtime/intent/semantic-assessment.js'
const base={material:true,message_kind:'mission',task_kind:'diagnosis',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['repository-analysis'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]}
test('M15 parser identifies the exact invalid closed-list field without widening diagnosis semantics',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,required_capabilities:['repository-analysis','diagnosis']}),/unsupported required_capabilities value\(s\): diagnosis/)
  assert.equal(parseSemanticIntentAssessment(base).task_kind,'diagnosis')
})
test('M15 parser keeps other closed-list fields fail-closed with field-scoped diagnostics',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,likely_verification:['imaginary-check']}),/unsupported likely_verification value\(s\): imaginary-check/)
  assert.throws(()=>parseSemanticIntentAssessment({...base,user_verification:['imaginary-check']}),/unsupported user_verification value\(s\): imaginary-check/)
  assert.throws(()=>parseSemanticIntentAssessment({...base,requested_external_actions:['imaginary-action'],risk:'authority-boundary'}),/unsupported requested_external_actions value\(s\): imaginary-action/)
})
test('M15 task_kind remains independently field-specific and invalid intent signals stay explicit',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,task_kind:'diagnosis-capability'}),/task_kind must be one of/)
  assert.throws(()=>parseSemanticIntentAssessment({...base,intent_signals:['intent.diagnosis']}),/unsupported semantic intent signal\(s\): intent.diagnosis/)
})
