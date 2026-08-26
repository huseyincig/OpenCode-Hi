import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'

function setup(){
  const created=[],prompts=[],aborts=[]
  let seq=0
  const client={session:{
    create:async req=>{const id=`child-${++seq}`;created.push({id,req});return{data:{id}}},
    promptAsync:async req=>{prompts.push(req);return{data:undefined,error:{name:'BadRequestError',data:{message:'prompt rejected'}}}},
    abort:async req=>{aborts.push(req);return{data:true}},
    diff:async()=>({data:[]}),
  }}
  const cfg=resolveHiConfig({routing:{roleModels:{coder:['p/primary','p/fallback']},maxFallbacks:2}})
  const models=[
    {id:'p/primary',provider:'p',writeCapable:true,tags:['balanced']},
    {id:'p/fallback',provider:'p',writeCapable:true,tags:['balanced']},
  ]
  const scheduler=createConcurrencyPolicySource(()=>({global:2,providers:{p:2},models:{}}))
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),scheduler,process.cwd(),process.cwd(),()=>cfg,()=>models,()=>({}))
  const mission=startAssessedMission(new MissionStore(process.cwd()),'m11-dispatch-rejection','prove mutating prompt rejection cannot replay on another model',{task_kind:'implementation',scope:'local',required_capabilities:['implementation'],likely_verification:[]})
  return{runtime,mission,created,prompts,aborts}
}

test('M11 rejected prompt mutation is never replayed through a fallback model after child creation',async()=>{
  const {runtime,mission,created,prompts,aborts}=setup()
  await assert.rejects(()=>runtime.start(mission,{objective:'bounded implementation',role:'coder',category:'standard',scope:['src/a.ts']}),/prompt rejected/)
  assert.equal(created.length,1,'a rejected mutating prompt must not create a second fallback child')
  assert.equal(prompts.length,1,'a rejected mutating prompt must not be replayed on another model')
  assert.equal(aborts.length,1,'the exact created child must be reconciled before ownership is released')
  assert.equal(mission.execution.scheduler.reservations.length,0,'proven abort releases the exact scheduler reservation')
  const worker=mission.execution.workers.at(-1),task=mission.execution.tasks.at(-1)
  assert.equal(worker?.status,'failed')
  assert.equal(task?.status,'failed')
  assert.equal(worker?.fallback_history?.length??0,0)
})
