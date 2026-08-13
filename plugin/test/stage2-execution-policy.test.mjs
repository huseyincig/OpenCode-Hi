import test from 'node:test'
import assert from 'node:assert/strict'
import {executionProfileFor,automaticContinuationEnabled,adaptiveIdleEvaluatorEnabled} from '../dist/config/execution-policy.js'

function intent(overrides={}){return{objective:'opaque',likelyTargets:[],taskKind:'implementation',scope:'multi-file',risk:'medium',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:[],avoid:[],...overrides}}

test('adaptive execution policy chooses a bounded profile from structured mission state',()=>{assert.equal(executionProfileFor('adaptive',intent({scope:'local',risk:'low'})),'minimal');assert.equal(executionProfileFor('adaptive',intent({risk:'high'})),'thorough');assert.equal(executionProfileFor('adaptive',intent()),'balanced')})
test('fixed execution policies remain fixed and manual uses balanced role baseline',()=>{assert.equal(executionProfileFor('minimal',intent({risk:'high'})),'minimal');assert.equal(executionProfileFor('balanced',intent({risk:'low',scope:'local'})),'balanced');assert.equal(executionProfileFor('thorough',intent({risk:'low'})),'thorough');assert.equal(executionProfileFor('manual',intent({risk:'high'})),'balanced')})
test('manual alone disables automatic child wake while adaptive alone owns idle recovery evaluator',()=>{for(const mode of ['minimal','balanced','thorough','adaptive'])assert.equal(automaticContinuationEnabled(mode),true,mode);assert.equal(automaticContinuationEnabled('manual'),false);assert.equal(adaptiveIdleEvaluatorEnabled('adaptive'),true);for(const mode of ['minimal','balanced','thorough','manual'])assert.equal(adaptiveIdleEvaluatorEnabled(mode),false,mode)})
