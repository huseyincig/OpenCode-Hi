import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'

function harness(){
  let n=0
  const calls={aborts:[],prompts:[]}
  const client={session:{
    create:async()=>({data:{id:`child-${++n}`}}),
    promptAsync:async req=>{calls.prompts.push(req)},
    abort:async req=>{calls.aborts.push(req);return{data:true}},
  }}
  const registry=new BackgroundRegistry()
  const scheduler=createConcurrencyPolicySource(()=>({global:4}))
  const runtime=new TaskRuntime(opencodeChildPort(client),registry,scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({parallel:{enabled:true,max:4}}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}))
  return {runtime,calls,registry,scheduler}
}
const done={status:'DONE',summary:'done',changed_files:[],evidence:[],open_issues:[],needs_context:[]}

test('runtime-discovered overlapping writes quarantine the later writer and serialize its resume',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'runtime-conflict','opaque parallel edits',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  const {runtime,calls}=harness()
  const a=await runtime.start(m,{objective:'edit A',role:'coder',category:'standard',scope:['src/a.ts']})
  const b=await runtime.start(m,{objective:'edit B',role:'coder',category:'standard',scope:['src/b.ts']})
  const wa=m.execution.workers.find(w=>w.id===a.worker_id),wb=m.execution.workers.find(w=>w.id===b.worker_id)
  // This test isolates write-conflict serialization rather than methodology admission/load/exit.
  for(const w of [wa,wb]){w.selected_methodologies=[];w.loaded_methodologies=[];w.methodologies=[]}
  assert.equal(wa.status,'busy');assert.equal(wb.status,'busy')
  assert.equal(m.execution.scheduler.reservations.length,2);assert.ok(m.execution.scheduler.reservations.every(r=>r.phase==='RUNNING'))
  await runtime.noteNativeWriteSet(m,wa.id,['src/shared.ts'],'session-diff','h1')
  await runtime.noteNativeWriteSet(m,wb.id,['src/shared.ts'],'session-diff','h2')
  const ta=m.execution.tasks.find(t=>t.id===a.task_id),tb=m.execution.tasks.find(t=>t.id===b.task_id)
  assert.equal(wb.status,'queued')
  assert.equal(tb.status,'queued')
  assert.ok(tb.dependencies.includes(ta.id),'later writer must depend on the already-active writer')
  assert.equal(calls.aborts.length,1)
  assert.deepEqual(calls.aborts[0],{path:{id:wb.session_id}})
  assert.ok(m.execution.blockers.some(x=>x.startsWith('parallel-write-conflict:')))
  assert.equal(m.execution.scheduler.reservations.length,1,'aborted conflicting run must release its exact reservation')
  assert.equal(m.execution.scheduler.reservations[0].workerId,wa.id)

  runtime.applyResult(m,wa.id,done)
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(wb.status,'busy','quarantined worker should resume after winner completion')
  assert.equal(tb.status,'running')
  assert.equal(m.execution.scheduler.reservations.length,1);assert.equal(m.execution.scheduler.reservations[0].workerId,wb.id);assert.equal(m.execution.scheduler.reservations[0].phase,'RUNNING');assert.equal(m.execution.scheduler.reservations[0].attempt.ordinal,2)
  assert.match(calls.prompts.at(-1).body.parts[0].text,/write-conflict reconciliation/i)
  assert.match(calls.prompts.at(-1).body.parts[0].text,/src\/shared\.ts/)

  runtime.applyResult(m,wb.id,done)
  assert.equal(tb.status,'completed')
  assert.equal(m.execution.scheduler.reservations.length,0)
  assert.equal(m.execution.blockers.some(x=>x.startsWith('parallel-write-conflict:')),false,'conflict blocker clears only after quarantined task reconciles')
})

test('successful worker result does not clear unrelated mission blockers',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'blocker-ownership','opaque blocker task')
  const {runtime}=harness()
  m.execution.blockers.push('external-authority:deploy')
  const started=await runtime.start(m,{objective:'local edit',role:'coder',category:'standard',scope:['src/a.ts']})
  runtime.applyResult(m,started.worker_id,done)
  assert.ok(m.execution.blockers.includes('external-authority:deploy'))
})


test('parallel write conflict with unavailable abort becomes terminal quiescence state',async()=>{
  let n=0;const client={session:{create:async()=>({data:{id:`child-no-abort-${++n}`}}),promptAsync:async()=>({data:{}})}}
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:4})),process.cwd(),process.cwd(),()=>resolveHiConfig({parallel:{enabled:true,max:4}}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}))
  const m=startAssessedMission(new MissionStore(),'runtime-conflict-no-abort','opaque parallel edits',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  const a=await runtime.start(m,{objective:'edit A',role:'coder',category:'standard',scope:['src/a.ts']}),b=await runtime.start(m,{objective:'edit B',role:'coder',category:'standard',scope:['src/b.ts']})
  const wa=m.execution.workers.find(w=>w.id===a.worker_id),wb=m.execution.workers.find(w=>w.id===b.worker_id);for(const w of [wa,wb]){w.selected_methodologies=[];w.loaded_methodologies=[];w.methodologies=[]}
  await runtime.noteNativeWriteSet(m,wa.id,['src/shared.ts'],'session-diff','h1');await runtime.noteNativeWriteSet(m,wb.id,['src/shared.ts'],'session-diff','h2')
  assert.equal(wb.status,'busy');assert.ok(m.execution.blockers.includes('capability-unavailable:session-abort'));assert.ok(m.execution.blockers.some(x=>x.startsWith('parallel-conflict-abort-unavailable:')))
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason,'capability-unavailable:session-abort')
})
