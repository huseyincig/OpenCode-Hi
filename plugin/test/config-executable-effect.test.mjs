import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {decideTopology} from '../dist/runtime/execution/topology-policy.js'
import {resolveModel} from '../dist/runtime/routing/model-resolver.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {routeCapabilities} from '../dist/runtime/routing/capability-router.js'
import {executionProfileFor} from '../dist/config/execution-policy.js'

const intent={objective:'independent streams',taskKind:'implementation',risk:'medium',scope:'multi-stream',ambiguity:'none',dependencyClass:'independent-multi',requiredCapabilities:['implementation'],likelyVerification:['targeted-tests']}

test('BA03 execution capacity config changes real topology and scheduler decisions',()=>{
  const one=resolveHiConfig({execution:{topology:'multi-agent',maxAgents:1,parallelism:4},parallel:{enabled:true,max:1,providers:{},models:{}}})
  const many=resolveHiConfig({execution:{topology:'multi-agent',maxAgents:4,parallelism:2},parallel:{enabled:true,max:4,providers:{p:1},models:{'p/m':1}}})
  const d1=decideTopology(intent,{mode:one.execution.topology,maxAgents:one.execution.maxAgents,parallelism:one.execution.parallelism})
  const d2=decideTopology(intent,{mode:many.execution.topology,maxAgents:many.execution.maxAgents,parallelism:many.execution.parallelism})
  assert.equal(d1.executionMode,'single');assert.equal(d1.agentCount,1)
  assert.equal(d2.executionMode,'parallel');assert.ok(d2.agentCount>=2)
  const global=new ConcurrencyScheduler(()=>({global:one.parallel.enabled?one.parallel.max:1,providers:one.parallel.providers,models:one.parallel.models}))
  assert.equal(global.acquire('a','p','p/a'),true);assert.equal(global.canStart('b','q','q/b').ok,false)
  const scoped=new ConcurrencyScheduler(()=>({global:many.parallel.max,providers:many.parallel.providers,models:many.parallel.models}))
  assert.equal(scoped.acquire('a','p','p/m'),true)
  assert.match(scoped.canStart('b','p','p/other').reason,/provider-capacity/)
  assert.match(scoped.canStart('c','q','p\/m').reason,/model-capacity/)
})

test('BA03 routing constraints and execution profile config change real model/role selection',()=>{
  const models=[{id:'p/cheap',provider:'p',quality:4,cost:1,writeCapable:true},{id:'q/strong',provider:'q',quality:9,cost:4,writeCapable:true}]
  const unrestricted=resolveHiConfig({routing:{strategy:'cost',allowedProviders:[]}})
  const constrained=resolveHiConfig({routing:{strategy:'cost',allowedProviders:['q']}})
  assert.equal(resolveModel('standard',models,unrestricted,undefined,'coder').primary,'p/cheap')
  assert.equal(resolveModel('standard',models,constrained,undefined,'coder').primary,'q/strong')
  const design={...intent,scope:'local',risk:'low',requiredCapabilities:['design-exploration']}
  const minimal=resolveHiConfig({executionPolicy:'minimal'}),thorough=resolveHiConfig({executionPolicy:'thorough'})
  const minProfile=minimal.profile[executionProfileFor(minimal.executionPolicy,design)],thoroughProfile=thorough.profile[executionProfileFor(thorough.executionPolicy,design)]
  assert.equal(routeCapabilities(design,minProfile).role,'coder')
  assert.equal(routeCapabilities(design,thoroughProfile).role,'architect')
})
