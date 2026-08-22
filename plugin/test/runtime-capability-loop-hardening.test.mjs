import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'
import {dispatchContinuation} from '../dist/runtime/continuation/dispatcher.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {continuationPort} from './helpers/host-port.mjs'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

const VISUAL_ASSESSMENT={
  material:true,
  message_kind:'mission',
  task_kind:'implementation',
  scope:'local',
  risk:'low',
  ambiguity:'none',
  dependency_class:'independent',
  required_capabilities:['visual-qa'],
  requested_external_actions:[],
  likely_verification:['visual-check'],
  likely_targets:['index.html'],
  intent_signals:[],
  suppressed_intent_signals:[],
}

test('P0 visual-check activates canonical visual verification methodology before any worker is spawned',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('visual-initial','build a local HTML game')
  store.applyInitialSemanticAssessment('visual-initial',VISUAL_ASSESSMENT)
  const names=new Set(m.methodology.methodology_needs.map(x=>x.name))
  assert.ok(names.has('hi-visual-qa'),'visual-check must activate hi-visual-qa before task start')
})

test('P0 unchanged verification-pending cannot bypass the hard continuation budget',async()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'verification-loop','implement a UI',{likely_verification:['visual-check'],required_capabilities:['visual-qa']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation);implementation.status='closed';implementation.closedAt=Date.now()
  const host=continuationPort({session:{promptAsync:async()=>({data:{}})}})
  let terminal
  for(let i=0;i<m.continuation.continuation_budget+3;i++){
    const decision=evaluateIdle(m,Date.now()+10_000+i)
    if(decision.decision==='USER_ACTION_REQUIRED'||decision.decision==='STOP'){terminal=decision;break}
    assert.equal(decision.decision,'VERIFY')
    assert.ok(decision.prompt)
    m.continuation.continuation_lock_until=undefined;m.continuation.suppress_until=undefined
    assert.equal(await dispatchContinuation(host,m,decision.prompt,decision.reason),true)
    m.continuation.continuation_lock_until=undefined;m.continuation.suppress_until=undefined
  }
  assert.ok(terminal,'unchanged verification state must reach a terminal/user-action decision')
  assert.equal(terminal.decision,'USER_ACTION_REQUIRED')
  assert.equal(terminal.reason_code,'execution-budget-exhausted')
  assert.ok(m.continuation.iteration<=m.continuation.continuation_budget)
})

test('P0 unavailable verifier environment is terminal operational state, not an open-ended RECOVER continuation',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'verification-env','fix a UI',{likely_verification:['visual-check'],required_capabilities:['visual-qa']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation);implementation.status='closed';implementation.closedAt=Date.now()
  const obligation=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(obligation)
  addEvidence(m,{kind:'visual-check',summary:'Browser runtime unavailable',scope:['index.html'],source:'runtime:browser-preflight',obligation_ids:[obligation.id],outcome:'environment-issue',reason:'capability-unavailable:browser-execution'})
  const decision=evaluateIdle(m)
  assert.equal(decision.decision,'USER_ACTION_REQUIRED')
  assert.equal(decision.reason_code,'verification-environment-issue')
  assert.equal(decision.prompt,undefined)
})


test('P0 dispatch-time model inventory drift becomes terminal capability state',async()=>{
  const initial=[{id:'p/code',provider:'p',writeCapable:true,tags:['balanced']}],drifted=[{id:'p/other',provider:'p',writeCapable:true,tags:['balanced']}];let calls=0
  const getModels=()=>++calls===1?initial:drifted,client={session:{create:async()=>({data:{id:'unexpected-child'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]})}}
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({routing:{roleModels:{coder:['p/code']}}}),getModels,()=>({}))
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'model-drift','implement bounded change',{required_capabilities:['implementation'],likely_targets:['src/a.ts']})
  await assert.rejects(()=>runtime.start(m,{objective:'change a',role:'coder',category:'standard',scope:['src/a.ts']}),/Runtime model candidate rejected at dispatch/)
  assert.ok(m.execution.blockers.includes('capability-unavailable:model-dispatch'))
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable');assert.equal(decision.reason,'capability-unavailable:model-dispatch')
})
