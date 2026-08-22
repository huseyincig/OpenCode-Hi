import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSemanticIntentAssessment,provisionalIntent,technicalTargets,semanticTargets,assessedIntent,materialSemanticTargets} from '../dist/runtime/intent/semantic-assessment.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'

const base={material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]}

test('provisional intent remains semantically unclassified and only preserves technical targets',()=>{
  const intent=provisionalIntent('Any-language request touching src/auth.ts and package.json')
  assert.equal(intent.taskKind,'unclassified')
  assert.equal(intent.dependencyClass,'unknown')
  assert.deepEqual(intent.likelyTargets,['src/auth.ts','package.json'])
})

test('technical target extraction parses machine-like paths without classifying user semantics',()=>{
  assert.deepEqual(technicalTargets('foo/bar.ts README.md package.json'),['foo/bar.ts','README.md','package.json'])
  assert.deepEqual(technicalTargets('Change src/a.ts and src/b.ts. Then inspect packages/v1.2/foo.test.ts...'),['src/a.ts','src/b.ts','packages/v1.2/foo.test.ts'])
  assert.deepEqual(technicalTargets('Use README.md, src/a.ts; and (src/b.ts).'),['README.md','src/a.ts','src/b.ts'])
})

test('semantic targets normalize prose-wrapped project paths and preserve browser URLs',()=>{
  assert.deepEqual(semanticTargets(['ripgrep preview truncation code in packages/core','https://127.0.0.1:4173/view']),['packages/core','https://127.0.0.1:4173/view'])
})

test('semantic assessment drops prose-only target descriptions and falls back to provisional technical targets',()=>{
  const a=parseSemanticIntentAssessment({...base,likely_targets:['the ripgrep preview implementation']})
  assert.deepEqual(a.likely_targets,[])
  const intent=assessedIntent(provisionalIntent('Fix packages/core/src/ripgrep.ts without touching tests'),a)
  assert.deepEqual(intent.likelyTargets,['packages/core/src/ripgrep.ts'])
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
  assert.throws(()=>parseSemanticIntentAssessment({...base,required_capabilities:['magic-review']}),/unsupported required_capabilities value\(s\): magic-review/)
  assert.throws(()=>parseSemanticIntentAssessment({...base,intent_signals:['surface.security']}),/unsupported semantic intent signal/)
})


test('semantic assessment canonicalizes a single-material-target sequential multi-file label without another model turn',()=>{
  const a=parseSemanticIntentAssessment({...base,task_kind:'bug-fix',scope:'multi-file',risk:'low',ambiguity:'none',dependency_class:'sequential',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['packages/core/src/ripgrep.ts']})
  assert.equal(a.scope,'local');assert.equal(a.dependency_class,'independent')
})

test('targeted existing test paths are verifier-only unless explicit test-authoring intent makes them material',()=>{
  const ordinary=parseSemanticIntentAssessment({...base,scope:'multi-file',risk:'low',dependency_class:'sequential',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/value.js','test/value.test.js']})
  assert.deepEqual(materialSemanticTargets(ordinary),['src/value.js']);assert.equal(ordinary.scope,'local');assert.equal(ordinary.dependency_class,'independent')
  const tdd=parseSemanticIntentAssessment({...base,scope:'multi-file',risk:'low',dependency_class:'sequential',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/value.js','test/value.test.js'],intent_signals:['intent.tdd']})
  assert.deepEqual(materialSemanticTargets(tdd),['src/value.js','test/value.test.js']);assert.equal(tdd.scope,'multi-file');assert.equal(tdd.dependency_class,'sequential')
})

test('semantic assessment preserves a real sequential multi-file bug-fix when multiple material targets are explicit',()=>{
  const a=parseSemanticIntentAssessment({...base,task_kind:'bug-fix',scope:'multi-file',risk:'low',ambiguity:'none',dependency_class:'sequential',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/parser.ts','src/consumer.ts']})
  assert.equal(a.dependency_class,'sequential');assert.equal(a.scope,'multi-file');assert.deepEqual(a.likely_targets,['src/parser.ts','src/consumer.ts'])
})

test('semantic assessment does not reject incomplete sequential evidence when ambiguity remains resolvable',()=>{
  const a=parseSemanticIntentAssessment({...base,task_kind:'bug-fix',scope:'multi-file',risk:'low',ambiguity:'resolvable',dependency_class:'sequential',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/parser.ts']})
  assert.equal(a.ambiguity,'resolvable');assert.equal(a.dependency_class,'sequential')
})

test('resolved multi-file material change cannot omit the second material target',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,task_kind:'implementation',scope:'multi-file',risk:'low',ambiguity:'none',dependency_class:'independent',likely_targets:['src/a.ts']}),/at least two material targets/)
})

test('resolved local material change rejects a second material target unless explicit TDD owns the source-plus-test pair',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',likely_targets:['src/a.ts','src/context.ts']}),/cannot declare multiple material targets/)
  const tdd=parseSemanticIntentAssessment({...base,task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',likely_verification:['targeted-tests'],likely_targets:['src/a.ts','test/a.test.ts'],intent_signals:['intent.tdd']})
  assert.deepEqual(materialSemanticTargets(tdd),['src/a.ts','test/a.test.ts'])
})

test('local sequential classification canonicalizes to one independent material work unit after assessment',()=>{
  const store=new MissionStore()
  store.start('local-sequential-normalize','Change src/value.js and then run its existing test')
  const m=store.applyInitialSemanticAssessment('local-sequential-normalize',{...base,scope:'local',dependency_class:'sequential',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests'],likely_targets:['src/value.js','test/value.test.js']})
  assert.equal(m.identity.intent.scope,'local')
  assert.equal(m.identity.intent.dependencyClass,'independent')
  assert.equal(m.execution.adaptive_execution.path,'DIRECT')
})
