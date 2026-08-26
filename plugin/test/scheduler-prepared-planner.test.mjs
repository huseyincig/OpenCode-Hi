import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask} from '../dist/runtime/worker/worker-runtime.js'
import {projectMissionToWorkGraph} from '../dist/runtime/execution/work-graph-projection.js'
import {createSchedulingPlanner,planScheduling} from '../dist/runtime/scheduler/planner.js'

function fixture(){
  const store=new MissionStore(),m=store.start('m14-prepared-planner','prepared planner purity')
  store.applyInitialSemanticAssessment('m14-prepared-planner',{material:true,message_kind:'mission',task_kind:'implementation',scope:'multi-stream',risk:'low',ambiguity:'none',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['test']}
  const a=createTask(m,{objective:'a',role:'coder',category:'standard',scope:['src/a.ts']}),b=createTask(m,{objective:'b',role:'coder',category:'standard',scope:['src/b.ts']}),c=createTask(m,{objective:'c',role:'coder',category:'standard',scope:['src/c.ts']})
  a.created_at=1;b.created_at=2;c.created_at=3
  const graph=projectMissionToWorkGraph(m,1),unitTraits={},resolvedResources={}
  for(const unit of graph.executionUnits){unitTraits[unit.id]={readOnly:false};resolvedResources[unit.id]={provider:'p',model:'p/m'}}
  return{snapshot:{graph,unitTraits,resolvedResources,capacity:{topology:2,global:2,providers:{p:2},models:{'p/m':2},running:[]}},units:graph.executionUnits}
}

test('M14 prepared scheduler planner is call-scoped, capacity-variable, and decision-equivalent',()=>{
  const {snapshot,units}=fixture(),prepared=createSchedulingPlanner(snapshot)
  assert.deepEqual(prepared(),planScheduling(snapshot))
  const oneRunning={...snapshot.capacity,running:[{executionUnitId:units[0].id,provider:'p',model:'p/m'}]}
  assert.deepEqual(prepared(oneRunning),planScheduling({...snapshot,capacity:oneRunning}))
  assert.equal(prepared(oneRunning).units[1].disposition,'RUNNABLE')
  const twoRunning={...snapshot.capacity,running:[{executionUnitId:units[0].id,provider:'p',model:'p/m'},{executionUnitId:units[1].id,provider:'p',model:'p/m'}]}
  assert.deepEqual(prepared(twoRunning),planScheduling({...snapshot,capacity:twoRunning}))
  assert.equal(prepared(twoRunning).units[2].disposition,'DEFERRED_CAPACITY')
  assert.deepEqual(prepared(),planScheduling(snapshot),'later calls must not retain simulated running capacity')
})
