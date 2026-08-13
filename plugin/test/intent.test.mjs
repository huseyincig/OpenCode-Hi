import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSemanticIntentAssessment,provisionalIntent,technicalTargets,assessedIntent} from '../dist/runtime/intent/semantic-assessment.js'

const base={material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]}

test('provisional intent remains semantically unclassified and only preserves technical targets',()=>{
  const intent=provisionalIntent('Any-language request touching src/auth.ts and package.json')
  assert.equal(intent.taskKind,'unclassified')
  assert.equal(intent.dependencyClass,'unknown')
  assert.deepEqual(intent.likelyTargets,['src/auth.ts','package.json'])
})

test('technical target extraction parses machine-like paths without classifying user semantics',()=>{
  assert.deepEqual(technicalTargets('foo/bar.ts README.md package.json'),['foo/bar.ts','README.md','package.json'])
})

test('structured bug-fix assessment produces bounded deterministic intent state',()=>{
  const a=parseSemanticIntentAssessment({...base,task_kind:'bug-fix',likely_verification:['targeted-tests']})
  const intent=assessedIntent(provisionalIntent('opaque user text'),a)
  assert.equal(intent.taskKind,'bug-fix')
  assert.deepEqual(intent.likelyVerification,['targeted-tests'])
})

test('requested external actions require authority-boundary risk',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,requested_external_actions:['package-publish']}),/authority-boundary/)
  const a=parseSemanticIntentAssessment({...base,risk:'authority-boundary',scope:'external',requested_external_actions:['package-publish']})
  assert.deepEqual(a.requested_external_actions,['package-publish'])
})

test('multi-stream semantics are explicit structured state rather than prose counting',()=>{
  const a=parseSemanticIntentAssessment({...base,scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  assert.equal(a.scope,'multi-stream')
  assert.equal(a.dependency_class,'independent-multi')
  assert.ok(a.required_capabilities.includes('multi-stream-delegation'))
})

test('review versus implementation is an explicit semantic assessment decision',()=>{
  const review=parseSemanticIntentAssessment({...base,task_kind:'review',required_capabilities:['review'],likely_verification:['review-evidence']})
  const implementation=parseSemanticIntentAssessment(base)
  assert.equal(review.task_kind,'review')
  assert.equal(implementation.task_kind,'implementation')
})

test('security and independent-review capabilities are bounded enum values',()=>{
  const a=parseSemanticIntentAssessment({...base,risk:'high',required_capabilities:['implementation','security-review','independent-review']})
  assert.deepEqual(a.required_capabilities,['implementation','security-review','independent-review'])
})

test('unsupported capability and non-intent signal values fail closed',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,required_capabilities:['magic-review']}),/unsupported semantic enum/)
  assert.throws(()=>parseSemanticIntentAssessment({...base,intent_signals:['surface.security']}),/unsupported semantic intent signal/)
})
