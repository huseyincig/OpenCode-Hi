import test from 'node:test'
import assert from 'node:assert/strict'
import {verificationPolicyFor} from '../dist/runtime/verification/policy.js'
import {minimumTeamFor} from '../dist/runtime/routing/minimum-team.js'
import {routeCapabilities} from '../dist/runtime/routing/capability-router.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'

function intent(overrides={}){return{objective:'opaque',taskKind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:[],avoid:[],...overrides}}

test('small local low-risk implementation uses Working Manager direct path with zero delegated workers',()=>{
  const i=intent(),d=minimumTeamFor(i,verificationPolicyFor(i))
  assert.equal(d.primary,'working-manager');assert.equal(d.direct,true);assert.deepEqual(d.roles,[])
  const store=new MissionStore();const m=store.start('s-direct','opaque request')
  store.applyInitialSemanticAssessment('s-direct',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  assert.equal(m.execution.primary_mode,'working-manager');assert.equal(m.execution.workers.length,0)
})

test('security-sensitive implementation remains write-capable and adds independent security assurance',()=>{
  const i=intent({risk:'high',requiredCapabilities:['implementation','security-review','independent-review']})
  assert.equal(routeCapabilities(i).role,'coder')
  const d=minimumTeamFor(i,verificationPolicyFor(i))
  assert.equal(d.primary,'working-manager');assert.ok(d.roles.includes('coder'));assert.ok(d.roles.includes('security-reviewer'))
})

test('deterministic low-risk evidence does not manufacture a QA reviewer',()=>{
  const i=intent({likelyVerification:['targeted-tests']});const policy=verificationPolicyFor(i);const d=minimumTeamFor(i,policy)
  assert.equal(policy.requireReview,false);assert.ok(!d.roles.includes('qa-reviewer'))
})

test('review-dominant security work routes to read-only security reviewer',()=>{
  const i=intent({taskKind:'review',risk:'high',requiredCapabilities:['review','security-review']})
  assert.equal(routeCapabilities(i).role,'security-reviewer')
})

test('low-risk local review is direct evidence work when independence is not required',()=>{
  const i=intent({taskKind:'review',requiredCapabilities:['review'],likelyVerification:['review-evidence']});const policy=verificationPolicyFor(i),d=minimumTeamFor(i,policy)
  assert.equal(policy.requireReview,false);assert.equal(d.primary,'working-manager');assert.equal(d.direct,true);assert.deepEqual(d.roles,[])
})

test('explicit independent review remains an independent reviewer decision',()=>{
  const i=intent({taskKind:'review',requiredCapabilities:['review','independent-review'],likelyVerification:['review-evidence']});const policy=verificationPolicyFor(i),d=minimumTeamFor(i,policy)
  assert.equal(policy.requireReview,true);assert.ok(d.roles.includes('qa-reviewer'))
})
