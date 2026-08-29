import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import { compactMissionContext } from '../dist/runtime/state/snapshot.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'
import { DEFAULT_CONTEXT_BUDGET } from '../dist/runtime/context/budget.js'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ContextArtifactStore} from '../dist/runtime/context/artifact-store.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function addLargeState(m){
  for(let i=0;i<80;i++)m.execution.obligations.push({id:`o-${i}`,kind:'implementation',status:'open',summary:`obligation ${i} ${'x'.repeat(180)}`})
  for(let i=0;i<90;i++)m.execution.tasks.push({id:`t-${i}`,objective:`task ${i} ${'y'.repeat(220)}`,status:i===89?'blocked':'completed',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:i===89?{status:'FIX_REQUIRED',summary:'must reconcile hidden diff',changed_files:[],evidence:[],open_issues:['F-last'],needs_context:[]}:undefined,created_at:1,updated_at:1})
  m.execution.blockers=['critical-authority-blocker','critical-diff-blocker']
  m.continuation.pending_nudge={id:'n1',reason:'test',instruction:'RECONCILE THE LAST BLOCKING RESULT BEFORE STOP',created_at:1,generation:m.continuation.generation}
}

test('compaction survival keeps blockers, next action and stop contract under very large mission state',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'ctx-survive','opaque large mission')
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
  const store=new MissionStore(),m=startAssessedMission(store,'parent-context','opaque bounded context task')
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const huge=`FULL_TRANSCRIPT_MARKER_${'z'.repeat(DEFAULT_CONTEXT_BUDGET.max_context_chars+5000)}`
  await rt.start(m,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts'],relevantContext:[huge]})
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
  const store=new MissionStore(),m=startAssessedMission(store,'parent-context-no-summary','opaque bounded context task')
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  await rt.start(m,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts'],relevantContext:Array.from({length:40},(_,i)=>`context-${i}-${'q'.repeat(1000)}`)})
  const text=prompts[0].body.parts[0].text
  assert.ok(text.length<=DEFAULT_CONTEXT_BUDGET.max_handoff_chars)
  assert.match(text,/Hi WORKER HANDOFF/)
})


test('task handoff includes only explicitly selected mission context artifacts',async()=>{
  const prompts=[]
  const client={session:{create:async()=>({data:{id:'child-artifacts'}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:{}})}}
  const store=new MissionStore(),m=startAssessedMission(store,'parent-artifacts','opaque bounded context task')
  m.context.context_artifacts.push(
    {id:'ca-selected',kind:'research',title:'Selected',summary:'SELECTED_ARTIFACT_MARKER',sha256:'a'.repeat(64),added_at:1},
    {id:'ca-unselected',kind:'research',title:'Unselected',summary:'UNSELECTED_ARTIFACT_MARKER',sha256:'b'.repeat(64),added_at:2},
  )
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  await rt.start(m,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts'],contextArtifactIds:['ca-selected']})
  const text=prompts[0].body.parts[0].text
  assert.match(text,/SELECTED_ARTIFACT_MARKER/)
  assert.doesNotMatch(text,/UNSELECTED_ARTIFACT_MARKER/)
  assert.deepEqual(m.execution.tasks.at(-1).context_artifacts.map(a=>a.source_handle_id),['ca-selected']);assert.ok(m.execution.tasks.at(-1).context_artifacts.every(a=>a.consumer_ref===m.execution.tasks.at(-1).id))
})

test('unknown task context artifact id fails closed instead of widening context',async()=>{
  const client={session:{create:async()=>({data:{id:'child-artifact-unknown'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:{}})}}
  const store=new MissionStore(),m=startAssessedMission(store,'parent-artifact-unknown','opaque bounded context task')
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  await assert.rejects(()=>rt.start(m,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts'],contextArtifactIds:['ca-missing']}),/Unknown context artifact/)
  assert.equal(m.execution.tasks.length,0)
})


test('scoped TypeScript semantic context reaches the child handoff without a generic project-memory injection layer',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-runtime-context-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true})
    writeFileSync(join(root,'src','a.ts'),"export interface PublicContract { id:string }\nconst noise='do-not-inject'\n")
    const prompts=[]
    const client={session:{create:async()=>({data:{id:'child-semantic'}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:{}})}}
    const store=new MissionStore(root),m=startAssessedMission(store,'parent-semantic','opaque TypeScript task',{likely_targets:['src/a.ts']})
    const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),root,process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
    const started=await rt.start(m,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts']})
    const text=prompts[0].body.parts[0].text
    const semanticEvent=m.execution.ledger.find(e=>e.type==='context.semantic-selected'&&e.task_id===started.task_id)
    assert.ok(semanticEvent);assert.equal(semanticEvent.payload.items[0].source_ref,'file:src/a.ts');assert.equal(typeof semanticEvent.payload.items[0].source_hash,'string')
    assert.match(text,/semantic-typescript:src\/a\.ts/);assert.match(text,/interface PublicContract/);assert.doesNotMatch(text,/project-intelligence:/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('fresh durable context artifact content is loaded only while source-bound freshness holds',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-durable-context-'))
  try{
    const durable=new ContextArtifactStore(root).add('research','bounded durable research','DURABLE_ARTIFACT_CONTENT_MARKER',['src/a.ts'])
    const ref={id:durable.artifact_id,kind:'research',uri:`hi-artifact:${durable.artifact_id}`,summary:durable.summary,sha256:durable.content_hash,added_at:1}
    const prompts=[]
    let seq=0
    const client={session:{create:async()=>({data:{id:`child-durable-${++seq}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:{}})}}
    const m1=startAssessedMission(new MissionStore(root),'parent-durable-1','opaque durable context task')
    m1.context.context_artifacts.push(ref)
    const rt1=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),root,process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
    const started=await rt1.start(m1,{objective:'first fix',role:'coder',category:'quick',scope:['src/a.ts'],contextArtifactIds:[durable.artifact_id]})
    assert.match(prompts[0].body.parts[0].text,/DURABLE_ARTIFACT_CONTENT_MARKER/)
    assert.ok(new ContextArtifactStore(root).get(durable.artifact_id).consumer_refs.includes(started.task_id))
    await rt1.noteNativeWriteSet(m1,started.worker_id,['src/a.ts'])
    assert.equal(new ContextArtifactStore(root).get(durable.artifact_id).freshness,'POTENTIALLY_STALE')

    const m2=startAssessedMission(new MissionStore(root),'parent-durable-2','opaque second durable context task')
    m2.context.context_artifacts.push(ref)
    const rt2=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),root,process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
    await rt2.start(m2,{objective:'second fix',role:'coder',category:'quick',scope:['src/a.ts'],contextArtifactIds:[durable.artifact_id]})
    assert.match(prompts[1].body.parts[0].text,new RegExp(`artifact-stale:${durable.artifact_id}`))
    assert.doesNotMatch(prompts[1].body.parts[0].text,/DURABLE_ARTIFACT_CONTENT_MARKER/)
  }finally{rmSync(root,{recursive:true,force:true})}
})
