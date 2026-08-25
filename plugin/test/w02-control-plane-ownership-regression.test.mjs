import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {createToolBeforeHook} from '../dist/hooks/tool-before.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'

function runtime(){
  const created=[],registry=new BackgroundRegistry()
  const client={session:{
    create:async req=>{created.push(req);return{data:{id:'child-'+created.length}}},
    promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]}),
  }}
  const cfg=resolveHiConfig({parallel:{enabled:true,max:4}})
  const rt=new TaskRuntime(opencodeChildPort(client),registry,createConcurrencyPolicySource(()=>({global:4})),process.cwd(),process.cwd(),()=>cfg,()=>[{id:'p/model',provider:'p',quality:8,cost:1,tags:['balanced'],writeCapable:true}],()=>({}))
  return{rt,registry,created}
}

test('W02 regression: a read-only support role cannot be assigned a mutating reconciliation objective',async()=>{
  const x=runtime(),store=new MissionStore(),m=startAssessedMission(store,'w02-readonly-admission','repair production behavior',{task_kind:'implementation',scope:'local',risk:'medium',required_capabilities:['implementation'],likely_targets:['file_manager.py']})
  await assert.rejects(
    ()=>x.rt.start(m,{objective:'Revert test/test_public.py to HEAD version',role:'repository-explorer',category:'quick',scope:['test/test_public.py']}),
    /read-only|canonical role owner|mutation/i,
  )
  assert.equal(x.created.length,0)
})

test('W02 regression: durable child session ownership still enforces read-only mutation guard when process-local registry is empty',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'w02-durable-child-owner','inspect repository state',{task_kind:'diagnosis',scope:'local',risk:'medium',required_capabilities:['repository-analysis'],likely_targets:['test/test_public.py']})
  const task=createTask(m,{objective:'inspect test source',role:'repository-explorer',category:'quick',scope:['test/test_public.py']})
  const worker=createWorker(m,task,'p/model');worker.session_id='child-durable-owner';worker.status='busy';task.status='running'
  const hook=createToolBeforeHook(store,new BackgroundRegistry(),process.cwd(),process.cwd())
  await assert.rejects(()=>hook({sessionID:'child-durable-owner',tool:'edit'},{args:{filePath:'test/test_public.py'}}),/read-only role guard|ownership/i)
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.read-only-mutation-blocked'&&e.worker_id===worker.id))
})
