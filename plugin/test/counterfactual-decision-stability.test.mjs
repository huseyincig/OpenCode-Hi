import test from 'node:test'
import assert from 'node:assert/strict'
import {counterfactualDecisionStability} from '../dist/runtime/decision/counterfactual-stability.js'
import {decideSemanticExecution} from '../dist/runtime/decision/semantic-decision.js'
const topology={parallelEnabled:true,maxParallel:3}
const verification={requiredKinds:[],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
const intent=(o={})=>({objective:'bounded task',likelyTargets:['src/a.ts'],taskKind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:[],avoid:[],...o})

test('counterfactual stability is bounded deterministic advisory diagnostics, never probability authority',()=>{
  const a=counterfactualDecisionStability({intent:intent(),verification,topology}),b=counterfactualDecisionStability({intent:intent(),verification,topology})
  assert.deepEqual(a,b);assert.equal(a.advisory_only,true);assert.equal(a.probability_claim,false);assert.ok(a.sample_count>0&&a.sample_count<=8);assert.ok(a.stability_ratio>=0&&a.stability_ratio<=1)
  assert.deepEqual(Object.keys(a.changed_axes).sort(),['execution-path','model-class','team','topology'].sort())
})

test('boundary-sensitive decisions expose fragile semantic dimensions rather than fake confidence',()=>{
  const x=counterfactualDecisionStability({intent:intent({risk:'medium',ambiguity:'resolvable',scope:'multi-file',dependencyClass:'independent-multi'}),verification,topology})
  assert.ok(x.fragile_dimensions.length>0);assert.ok(x.samples.some(s=>s.changed_axes.includes('execution-path')||s.changed_axes.includes('topology')))
  assert.ok(['ROBUST','MIXED','FRAGILE'].includes(x.band))
})

test('semantic decision carries stability diagnostics without changing canonical decision outputs',()=>{
  const direct=decideSemanticExecution({intent:intent(),verification,primaryMode:'working-manager',topology})
  assert.equal(direct.executionPath,'DIRECT');assert.equal(direct.primary,'working-manager');assert.equal(direct.stability.advisory_only,true)
  const high=decideSemanticExecution({intent:intent({risk:'high'}),verification:{...verification,requireReview:true},primaryMode:'working-manager',topology})
  assert.equal(high.executionPath,'ESCALATED');assert.equal(high.assurance.freshReviewerRequired,true);assert.equal(high.stability.probability_claim,false)
})

test('authority-boundary decision remains escalated regardless of local stability band',()=>{
  const d=decideSemanticExecution({intent:intent({risk:'authority-boundary',scope:'external',requestedExternalActions:['git-push']}),verification,primaryMode:'working-manager',topology})
  assert.equal(d.executionPath,'ESCALATED');assert.equal(d.providerSurfacePhase,'ESCALATED_CONTROL');assert.ok(['ROBUST','MIXED','FRAGILE'].includes(d.stability.band));assert.equal(d.stability.samples.some(s=>s.dimension==='risk'&&s.to!=='authority-boundary'),false);assert.equal(d.stability.samples.some(s=>s.dimension==='scope'&&s.to!=='external'),false)
})
