import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { compactMissionContext } from '../dist/runtime/state/snapshot.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { DEFAULT_HHC_CONFIG } from '../dist/config/defaults.js'
import { DEFAULT_CONTEXT_BUDGET } from '../dist/runtime/context/budget.js'

function addLargeState(m){
  for(let i=0;i<80;i++)m.obligations.push({id:`o-${i}`,kind:'implementation',status:'open',summary:`obligation ${i} ${'x'.repeat(180)}`})
  for(let i=0;i<90;i++)m.tasks.push({id:`t-${i}`,objective:`task ${i} ${'y'.repeat(220)}`,status:i===89?'blocked':'completed',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:i===89?{status:'FIX_REQUIRED',summary:'must reconcile hidden diff',changed_files:[],evidence:[],open_issues:['F-last'],needs_context:[]}:undefined,created_at:1,updated_at:1})
  m.blockers=['critical-authority-blocker','critical-diff-blocker']
  m.pending_nudge={id:'n1',reason:'test',instruction:'RECONCILE THE LAST BLOCKING RESULT BEFORE STOP',created_at:1,generation:m.generation}
}

test('compaction survival keeps blockers, next action and stop contract under very large mission state',()=>{
  const store=new MissionStore(),m=store.start('ctx-survive','large mission objective')
  addLargeState(m)
  const text=compactMissionContext(m)
  assert.ok(text.length<=DEFAULT_CONTEXT_BUDGET.max_context_chars)
  assert.match(text,/KNOWN BLOCKERS: .*critical-authority-blocker/)
  assert.match(text,/NEXT SAFE ACTION: RECONCILE THE LAST BLOCKING RESULT BEFORE STOP/)
  assert.match(text,/STOP CONDITIONS:/)
  assert.match(text,/UNRECONCILED RESULTS:/)
  assert.match(text,/t-89:FIX_REQUIRED/)
})

test('oversized relevant context is replaced by native summary instead of being appended to it',async()=>{
  const prompts=[]
  const client={session:{
    create:async()=>({data:{id:'child-context'}}),
    promptAsync:async req=>{prompts.push(req);return{data:{}}},
    summarize:async()=>({data:'BOUNDED_NATIVE_SUMMARY'}),
    abort:async()=>({data:{}}),
  }}
  const store=new MissionStore(),m=store.start('parent-context','fix bounded context')
  const rt=new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2})),process.cwd(),process.cwd(),()=>DEFAULT_HHC_CONFIG,()=>[],()=>({}))
  const huge=`FULL_TRANSCRIPT_MARKER_${'z'.repeat(DEFAULT_CONTEXT_BUDGET.max_context_chars+5000)}`
  await rt.start(m,{objective:'small fix',role:'coder',category:'quick',relevantContext:[huge]})
  assert.equal(prompts.length,1)
  const text=prompts[0].body.parts[0].text
  assert.ok(text.length<=DEFAULT_CONTEXT_BUDGET.max_handoff_chars)
  assert.match(text,/native-session-summary:BOUNDED_NATIVE_SUMMARY/)
  assert.doesNotMatch(text,/FULL_TRANSCRIPT_MARKER/)
})

test('handoff remains within total budget when native summarization is unavailable',async()=>{
  const prompts=[]
  const client={session:{
    create:async()=>({data:{id:'child-context-no-summary'}}),
    promptAsync:async req=>{prompts.push(req);return{data:{}}},
    abort:async()=>({data:{}}),
  }}
  const store=new MissionStore(),m=store.start('parent-context-no-summary','fix bounded context')
  const rt=new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2})),process.cwd(),process.cwd(),()=>DEFAULT_HHC_CONFIG,()=>[],()=>({}))
  await rt.start(m,{objective:'small fix',role:'coder',category:'quick',relevantContext:Array.from({length:40},(_,i)=>`context-${i}-${'q'.repeat(1000)}`)})
  const text=prompts[0].body.parts[0].text
  assert.ok(text.length<=DEFAULT_CONTEXT_BUDGET.max_handoff_chars)
  assert.match(text,/HHC WORKER HANDOFF/)
})
