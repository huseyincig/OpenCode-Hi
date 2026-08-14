import test from 'node:test'
import assert from 'node:assert/strict'
import { bindContextReference,isContextReferenceContract } from '../dist/contracts/context-reference.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask } from '../dist/runtime/worker/worker-runtime.js'
import { startAssessedMission } from './helpers/semantic.mjs'

const draft={source_ref:'hi-artifact:a_0123456789abcdef01234567',reason:'explicit-task-selection',priority:'normal',protection:'COMPRESSIBLE',budget_cost:512,freshness:'FRESH',retention:'task',privacy_class:'redacted',kind:'research',summary:'bounded context',content_hash:'a'.repeat(64),source_handle_id:'ca-source'}

test('ContextReference binds one available source to an explicit consumer',()=>{
  const ref=bindContextReference(draft,'t-consumer')
  assert.equal(isContextReferenceContract(ref),true)
  assert.equal(ref.consumer_ref,'t-consumer')
  assert.equal(ref.source_handle_id,'ca-source')
  assert.equal(ref.freshness,'FRESH')
})

test('ContextReference rejects missing consumer, unknown fields and invalid budget/freshness',()=>{
  const ref=bindContextReference(draft,'t-consumer')
  assert.equal(isContextReferenceContract({...ref,consumer_ref:''}),false)
  assert.equal(isContextReferenceContract({...ref,budget_cost:-1}),false)
  assert.equal(isContextReferenceContract({...ref,freshness:'PASS'}),false)
  assert.equal(isContextReferenceContract({...ref,unexpected:true}),false)
})

test('TaskContract stores selected ContextReferences, not raw mission availability handles',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'ctx-ref-task','bounded task')
  const task=createTask(m,{objective:'bounded task',role:'coder',category:'quick',contextReferences:[draft]})
  assert.equal(task.context_artifacts.length,1)
  assert.equal(task.context_artifacts[0].consumer_ref,task.id)
  assert.equal(task.context_artifacts[0].source_handle_id,'ca-source')
  assert.equal(isContextReferenceContract(task.context_artifacts[0]),true)
})
