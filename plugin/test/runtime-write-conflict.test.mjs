import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { resolveHiConfig } from '../dist/config/resolver.js'

function harness(){
  let n=0
  const calls={aborts:[],prompts:[]}
  const client={session:{
    create:async()=>({data:{id:`child-${++n}`}}),
    promptAsync:async req=>{calls.prompts.push(req)},
    abort:async req=>{calls.aborts.push(req)},
  }}
  const registry=new BackgroundRegistry()
  const scheduler=new ConcurrencyScheduler(()=>({global:4}))
  const runtime=new TaskRuntime(client,registry,scheduler,process.cwd(),process.cwd(),()=>resolveHiConfig({parallel:{enabled:true,max:4}}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced']}],()=>({}))
  return {runtime,calls,registry,scheduler}
}
const done={status:'DONE',summary:'done',changed_files:[],evidence:[],open_issues:[],needs_context:[]}

test('runtime-discovered overlapping writes quarantine the later writer and serialize its resume',async()=>{
  const store=new MissionStore(),m=store.start('runtime-conflict','two initially independent edits');m.execution_mode='parallel'
  const {runtime,calls}=harness()
  const a=await runtime.start(m,{objective:'edit A',role:'coder',category:'standard',scope:['src/a.ts']})
  const b=await runtime.start(m,{objective:'edit B',role:'coder',category:'standard',scope:['src/b.ts']})
  const wa=m.workers.find(w=>w.id===a.worker_id),wb=m.workers.find(w=>w.id===b.worker_id)
  assert.equal(wa.status,'busy');assert.equal(wb.status,'busy')
  await runtime.noteNativeWriteSet(m,wa.id,['src/shared.ts'],'session-diff','h1')
  await runtime.noteNativeWriteSet(m,wb.id,['src/shared.ts'],'session-diff','h2')
  const ta=m.tasks.find(t=>t.id===a.task_id),tb=m.tasks.find(t=>t.id===b.task_id)
  assert.equal(wb.status,'queued')
  assert.equal(tb.status,'queued')
  assert.ok(tb.dependencies.includes(ta.id),'later writer must depend on the already-active writer')
  assert.equal(calls.aborts.length,1)
  assert.deepEqual(calls.aborts[0],{path:{id:wb.session_id}})
  assert.ok(m.blockers.some(x=>x.startsWith('parallel-write-conflict:')))

  runtime.applyResult(m,wa.id,done)
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(wb.status,'busy','quarantined worker should resume after winner completion')
  assert.equal(tb.status,'running')
  assert.match(calls.prompts.at(-1).body.parts[0].text,/write-conflict reconciliation/i)
  assert.match(calls.prompts.at(-1).body.parts[0].text,/src\/shared\.ts/)

  runtime.applyResult(m,wb.id,done)
  assert.equal(tb.status,'completed')
  assert.equal(m.blockers.some(x=>x.startsWith('parallel-write-conflict:')),false,'conflict blocker clears only after quarantined task reconciles')
})

test('successful worker result does not clear unrelated mission blockers',async()=>{
  const store=new MissionStore(),m=store.start('blocker-ownership','preserve blockers')
  const {runtime}=harness()
  m.blockers.push('external-authority:deploy')
  const started=await runtime.start(m,{objective:'local edit',role:'coder',category:'standard',scope:['src/a.ts']})
  runtime.applyResult(m,started.worker_id,done)
  assert.ok(m.blockers.includes('external-authority:deploy'))
})
