import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission,assessPluginMission} from './helpers/semantic.mjs'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function harness(){
  let diffs=[]
  const client={session:{diff:async()=>({data:diffs})}}
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  return {rt,setDiffs:value=>{diffs=value}}
}
function done(files){return {status:'DONE',summary:'done',changed_files:files,evidence:[],open_issues:[],needs_context:[]}}

test('session-scoped observed native write omitted from WorkerResult forces reconciliation',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-diff-1','opaque change',{likely_targets:['src/a.ts']})
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.session_id='child-1';w.write_set=['src/a.ts','src/hidden.ts']
  const {rt}=harness()
  const reconciled=await rt.reconcileNativeResult(m,w.id,done(['src/a.ts']))
  assert.equal(reconciled.status,'FIX_REQUIRED')
  assert.ok(reconciled.changed_files.includes('src/hidden.ts'))
  assert.ok(reconciled.open_issues.some(x=>x.startsWith(`native-diff-mismatch:${t.id}:`)))
  assert.ok(m.execution.ledger.some(e=>e.type==='native.diff.mismatch'))
})

test('native diff baseline-to-idle delta catches an undeclared write when this is the sole writer',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-diff-2','opaque change',{likely_targets:['src/a.ts']})
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.session_id='child-2';w.native_diff_baseline={}
  const {rt,setDiffs}=harness();setDiffs([{file:'src/hidden.ts',before:'old',after:'new',additions:1,deletions:1}])
  const reconciled=await rt.reconcileNativeResult(m,w.id,done([]))
  assert.equal(reconciled.status,'FIX_REQUIRED')
  assert.deepEqual(reconciled.changed_files,['src/hidden.ts'])
})

test('worktree-global-looking native delta is not attributed to one worker while multiple writers are active',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-diff-3','opaque parallel task');m.execution.execution_mode='parallel'
  const ta=createTask(m,{objective:'a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[]}),tb=createTask(m,{objective:'b',role:'coder',category:'quick',scope:['src/b.ts'],requiredEvidence:[]})
  const wa=createWorker(m,ta,'host-default'),wb=createWorker(m,tb,'host-default');wa.status='busy';wb.status='busy';wa.session_id='child-a';wb.session_id='child-b';wa.native_diff_baseline={}
  const {rt,setDiffs}=harness();setDiffs([{file:'src/unrelated.ts',before:'old',after:'new',additions:1,deletions:1}])
  const reconciled=await rt.reconcileNativeResult(m,wa.id,done([]))
  assert.equal(reconciled.status,'DONE')
  assert.deepEqual(reconciled.changed_files,[])
  assert.ok(m.execution.ledger.some(e=>e.type==='native.diff.reconciled'))
})

test('plugin session.idle path converts DONE to FIX_REQUIRED when native diff exposes an undeclared file',async()=>{
  const {default:HiPlugin}=await import('../dist/plugin.js')
  let diffs=[];const childResult={status:'DONE',summary:'done',changed_files:['src/a.ts'],evidence:[],open_issues:[],needs_context:[]}
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{
    create:async()=>({data:{id:'child-native'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),status:async()=>({data:{}}),
    diff:async()=>({data:diffs}),messages:async()=>({data:[{info:{role:'assistant'},parts:[{type:'text',text:JSON.stringify(childResult)}]}]})
  }}
  const root=mkdtempSync(join(tmpdir(),'hi-native-diff-'))
  let hooks
  try{
    hooks=await HiPlugin({directory:root,worktree:root,project:{},client});const config={};await hooks.config(config)
    await hooks['chat.message']({sessionID:'parent-native',message:{role:'user',parts:[{type:'text',text:'opaque task'}]}},{parts:[]});await assessPluginMission(hooks,'parent-native',{likely_targets:['src/a.ts']})
    const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'change a',role:'coder',category:'quick',scope:['src/a.ts']},{sessionID:'parent-native'}))
    diffs=[{file:'src/a.ts',before:'a',after:'b',additions:1,deletions:1},{file:'src/hidden.ts',before:'x',after:'y',additions:1,deletions:1}]
    await hooks.event({event:{type:'session.idle',properties:{sessionID:'child-native'}}})
    const rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent-native'}));const row=rows.find(x=>x.task.id===started.task_id)
    assert.equal(row.task.result.status,'FIX_REQUIRED')
    assert.ok(row.task.result.changed_files.includes('src/hidden.ts'))
    assert.ok(row.task.result.open_issues.some(x=>x.startsWith(`native-diff-mismatch:${started.task_id}:`)))
  }finally{await hooks?.dispose?.();rmSync(root,{recursive:true,force:true})}
})


test('native diff must prove collateral reverted before cleanup blocker can close',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-cleanup-1','opaque change',{likely_targets:['src/a.ts']})
  const impl=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.session_id='child-clean';w.native_diff_baseline={}
  const {rt,setDiffs}=harness()
  rt.applyResult(m,w.id,{status:'DONE',summary:'first attempt',changed_files:['src/a.ts','docs/random.md'],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(t.result.status,'FIX_REQUIRED')
  w.status='busy';t.status='running';w.started_at=Date.now()-5
  setDiffs([{file:'src/a.ts',before:'a',after:'b',additions:1,deletions:1}])
  const reconciled=await rt.reconcileNativeResult(m,w.id,{status:'DONE',summary:'reverted collateral',changed_files:['src/a.ts'],evidence:[],open_issues:[],needs_context:[]})
  rt.applyResult(m,w.id,reconciled)
  assert.equal(t.result.status,'DONE')
  assert.equal(impl.status,'closed')
  assert.equal(m.vcs.changed_files.includes('docs/random.md'),false)
  assert.ok(m.execution.ledger.some(e=>e.type==='diff.cleanup.verified'))
  assert.ok(m.execution.ledger.some(e=>e.type==='diff.cleanliness.resolved'))
})

test('cleanup claim remains FIX_REQUIRED while native diff still contains collateral',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-cleanup-2','opaque change',{likely_targets:['src/a.ts']})
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.session_id='child-dirty';w.native_diff_baseline={}
  const {rt,setDiffs}=harness()
  rt.applyResult(m,w.id,{status:'DONE',summary:'first attempt',changed_files:['src/a.ts','docs/random.md'],evidence:[],open_issues:[],needs_context:[]})
  w.status='busy';t.status='running';w.started_at=Date.now()-5
  setDiffs([{file:'src/a.ts',before:'a',after:'b',additions:1,deletions:1},{file:'docs/random.md',before:'x',after:'y',additions:1,deletions:1}])
  const reconciled=await rt.reconcileNativeResult(m,w.id,{status:'DONE',summary:'claimed cleanup',changed_files:['src/a.ts'],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(reconciled.status,'FIX_REQUIRED')
  assert.ok(reconciled.open_issues.some(x=>x.startsWith(`cleanup-not-reverted:${t.id}:`)))
})

test('cleanup cannot be accepted when native diff capability is unavailable',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-cleanup-3','opaque change',{likely_targets:['src/a.ts']})
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.session_id='child-no-diff';w.native_diff_baseline={}
  const rt=new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  rt.applyResult(m,w.id,{status:'DONE',summary:'first attempt',changed_files:['src/a.ts','docs/random.md'],evidence:[],open_issues:[],needs_context:[]})
  w.status='busy';t.status='running';w.started_at=Date.now()-5
  const reconciled=await rt.reconcileNativeResult(m,w.id,{status:'DONE',summary:'claimed cleanup',changed_files:['src/a.ts'],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(reconciled.status,'FIX_REQUIRED')
  assert.ok(reconciled.open_issues.some(x=>x.startsWith(`cleanup-unverified:${t.id}:`)))
})

test('pre-existing user dirty file unchanged from worker baseline is not attributed to the worker',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-user-dirty-1','opaque change',{likely_targets:['src/a.ts']})
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.session_id='child-user-dirty';
  const userSig='preexisting-user-signature';w.native_diff_baseline={'notes/user.md':userSig}
  const {rt,setDiffs}=harness();setDiffs([{file:'notes/user.md',before:'base',after:'user edit',additions:2,deletions:0}])
  // Override the baseline signature with the exact native serializer output captured from the same diff.
  await rt.reconcileNativeResult(m,w.id,done([]));w.native_diff_baseline=w.native_diff_final
  const reconciled=await rt.reconcileNativeResult(m,w.id,done(['notes/user.md']))
  assert.equal(reconciled.status,'DONE')
  assert.deepEqual(reconciled.changed_files,[])
  assert.ok(m.execution.ledger.some(e=>e.type==='user-diff.preserved'))
})

test('cleanup restores a collateral pre-existing user file to worker-start baseline rather than HEAD',async()=>{
  const s=new MissionStore(),m=startAssessedMission(s,'native-user-dirty-2','opaque change',{likely_targets:['src/a.ts']})
  const impl=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.session_id='child-user-clean';
  const {rt,setDiffs}=harness()
  // Capture a dirty user-owned baseline first.
  setDiffs([{file:'notes/user.md',before:'HEAD text',after:'USER EDIT',additions:1,deletions:0}])
  await rt.reconcileNativeResult(m,w.id,done([]));w.native_diff_baseline=w.native_diff_final
  // Worker accidentally modifies the same user-owned file; first result becomes collateral.
  setDiffs([{file:'notes/user.md',before:'HEAD text',after:'USER EDIT + Hi',additions:2,deletions:0},{file:'src/a.ts',before:'a',after:'b',additions:1,deletions:1}])
  const first=await rt.reconcileNativeResult(m,w.id,done(['src/a.ts','notes/user.md']));rt.applyResult(m,w.id,first)
  assert.equal(t.result.status,'FIX_REQUIRED')
  // Corrective cleanup restores USER EDIT, not HEAD text.
  w.status='busy';t.status='running';setDiffs([{file:'notes/user.md',before:'HEAD text',after:'USER EDIT',additions:1,deletions:0},{file:'src/a.ts',before:'a',after:'b',additions:1,deletions:1}])
  const cleaned=await rt.reconcileNativeResult(m,w.id,done(['src/a.ts']));rt.applyResult(m,w.id,cleaned)
  assert.equal(t.result.status,'DONE')
  assert.equal(m.vcs.changed_files.includes('notes/user.md'),false)
  assert.ok(m.execution.ledger.some(e=>e.type==='diff.cleanup.verified'))
})

test('initial child handoff warns that pre-existing dirty paths are user-owned and must not be reset',async()=>{
  let prompt='';const diff=[{file:'notes/user.md',before:'HEAD',after:'USER EDIT',additions:1,deletions:0}]
  const client={session:{create:async()=>({data:{id:'child-prompt-dirty'}}),promptAsync:async(args)=>{prompt=String(args?.body?.parts?.[0]?.text??args?.body?.text??JSON.stringify(args));return {data:{}}},abort:async()=>({data:{}}),diff:async()=>({data:diff})}}
  const s=new MissionStore(),m=startAssessedMission(s,'native-user-dirty-3','opaque change',{likely_targets:['src/a.ts']})
  const rt=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  await rt.start(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts']})
  assert.match(prompt,/pre-existing user dirty paths/i)
  assert.match(prompt,/notes\/user\.md/)
  assert.match(prompt,/never use git checkout\/reset\/restore/i)
})

test('PROMPT B final native diff deterministically binds worker evidence source-state identity',async()=>{
  const client={session:{diff:async()=>({data:[{file:'src/b.ts',additions:1,deletions:0,status:'modified',patch:'b'},{file:'src/a.ts',additions:2,deletions:1,status:'modified',patch:'a'}]})}}
  const {ChildExecutionCoordinator}=await import('../dist/runtime/task/child-execution-coordinator.js')
  const worker={session_id:'s-native-state'}
  const c=new ChildExecutionCoordinator(opencodeChildPort(client))
  const first=await c.captureNativeDiff(worker,'final'),hash1=worker.native_state_hash
  client.session.diff=async()=>({data:[{file:'src/a.ts',additions:2,deletions:1,status:'modified',patch:'a'},{file:'src/b.ts',additions:1,deletions:0,status:'modified',patch:'b'}]})
  const second=await c.captureNativeDiff(worker,'final'),hash2=worker.native_state_hash
  assert.deepEqual(first,second);assert.match(hash1,/^[a-f0-9]{64}$/);assert.equal(hash1,hash2)
})
