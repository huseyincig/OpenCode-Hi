import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveExecutionMode} from '../dist/runtime/routing/execution-mode.js'

function intent(overrides={}){return{objective:'opaque',taskKind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:[],avoid:[],...overrides}}

test('explicit multi-stream structured scope resolves to parallel',()=>{
  const d=resolveExecutionMode(intent({scope:'multi-stream',dependencyClass:'independent-multi',requiredCapabilities:['implementation','multi-stream-delegation']}))
  assert.equal(d.mode,'parallel')
})

test('single bounded local task stays single',()=>{
  const d=resolveExecutionMode(intent({taskKind:'bug-fix',scope:'local'}))
  assert.equal(d.mode,'single')
  assert.equal(d.reason[0],'minimum sufficient execution')
})

test('local review with multiple review capabilities remains minimum-sufficient single execution',()=>{
  const d=resolveExecutionMode(intent({taskKind:'review',scope:'local',requiredCapabilities:['security-review','visual-qa','review']}))
  assert.equal(d.mode,'single')
})

test('multi-stream state overrides the local single path only when explicitly selected',()=>{
  assert.equal(resolveExecutionMode(intent({scope:'multi-stream',dependencyClass:'independent-multi'})).mode,'parallel')
  assert.equal(resolveExecutionMode(intent({scope:'local'})).mode,'single')
})

test('independent-multi dependency state proves parallel branches even when scope is repo-wide',()=>{
  const d=resolveExecutionMode(intent({scope:'repo-wide',dependencyClass:'independent-multi',requiredCapabilities:['implementation','verification','repository-analysis']}))
  assert.equal(d.mode,'parallel')
  assert.match(d.reason.join(' '),/independent-multi/)
})

test('authority boundary forbids speculative parallel execution',()=>{
  const d=resolveExecutionMode(intent({risk:'authority-boundary',scope:'multi-stream',dependencyClass:'independent-multi',requestedExternalActions:['package-publish']}))
  assert.equal(d.mode,'single')
})
