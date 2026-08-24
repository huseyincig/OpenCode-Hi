import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimeEventController} from '../dist/runtime/application/runtime-event-controller.js'
import {normalizeOpenCodeEvent} from '../dist/opencode/event-adapter.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {recoveryPlan} from '../dist/runtime/continuation/recovery.js'
import {recordRecoveryStrategy,recoverySemanticSignature} from '../dist/runtime/continuation/recovery-governor.js'

const INITIAL={material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]}
function assessed(store,id){const m=store.start(id,'opaque');store.applyInitialSemanticAssessment(id,INITIAL);return m}
function state(){return{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.21'}}

function controllerFor(store){
  return new RuntimeEventController({
    state:state(),
    host:{refreshRuntimeInventory:async()=>{},log:async()=>{},getModels:()=>[]},
    services:{store,background:{},persistence:{save:()=>{}},tasks:{resolveChildCallback:()=>undefined},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}},
    projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:'/repo',
  })
}

test('M09 compaction preserves semantic recovery anti-replay history while resetting context-sensitive stagnation',async()=>{
  const store=new MissionStore(),m=assessed(store,'m09-compaction-parent')
  m.continuation.stagnation_count=1
  const signatureBefore=recoverySemanticSignature(m)
  const first=recoveryPlan(m)
  assert.equal(first.level,1);assert.equal(first.action,'same-worker-resume')
  recordRecoveryStrategy(m,first,'started')
  m.continuation.stagnation_count=1
  const beforeCompaction=recoveryPlan(m)
  assert.equal(beforeCompaction.level,2,'same semantic state must advance rather than replay rung 1')

  await controllerFor(store).handle(normalizeOpenCodeEvent({type:'session.compacted',properties:{sessionID:m.identity.session_id}}))

  assert.equal(m.continuation.stagnation_count,0,'compaction may reset context-sensitive stagnation')
  assert.equal(recoverySemanticSignature(m),signatureBefore,'compaction is not semantic progress')
  assert.equal(m.continuation.recovery_history.length,1,'compaction must preserve semantic recovery budget/history')
  assert.equal(recoveryPlan(m).level,0,'compaction reset means there is no immediate recovery without a new no-progress idle')
  m.continuation.stagnation_count=1
  const afterNextStagnation=recoveryPlan(m)
  assert.equal(afterNextStagnation.level,2,'the next unchanged no-progress idle must not regain an already-attempted recovery rung')
})
