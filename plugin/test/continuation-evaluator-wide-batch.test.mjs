import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import HiPlugin from '../dist/plugin.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {evaluateIdle,shouldCountStagnation} from '../dist/runtime/continuation/evaluator.js'
import {dispatchContinuation} from '../dist/runtime/continuation/dispatcher.js'
import {startAssessedMission,applyStructuredFollowup,DEFAULT_ASSESSMENT} from './helpers/semantic.mjs'


async function assessPluginMission(hooks,sessionID,overrides={},revision=1){
  const assessment={...DEFAULT_ASSESSMENT,...overrides}
  return JSON.parse(await hooks.tool.hi_intent_assess.execute({revision,assessment_json:JSON.stringify(assessment)},{sessionID}))
}

function idleTick(store,m){
  const progressed=store.updateProgress(m,false)
  let decision=evaluateIdle(m)
  if(!progressed&&shouldCountStagnation(decision)){store.updateProgress(m,true);decision=evaluateIdle(m)}
  return {progressed,decision}
}

test('permission WAIT and pending-worker WAIT never accumulate reasoning stagnation',()=>{
  const store=new MissionStore(process.cwd())
  const p=store.start('perm','fix bug')
  p.pending_permissions=1
  for(let i=0;i<4;i++)assert.equal(idleTick(store,p).decision.reason_code,'waiting-permission')
  assert.equal(p.stagnation_count,0)

  const w=store.start('worker','fix bug')
  w.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:'worker',parent_mission_id:w.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'x',status:'busy',generation_at_spawn:w.generation})
  for(let i=0;i<4;i++)assert.equal(idleTick(store,w).decision.reason_code,'waiting-worker')
  assert.equal(w.stagnation_count,0)
})

test('open-obligation idles do advance the bounded reasoning recovery ladder',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque implementation')
  m.obligations=m.obligations.filter(o=>o.kind!=='verification');store.updateProgress(m,false)
  let d=idleTick(store,m).decision
  assert.equal(d.reason_code,'stagnation-recovery')
  assert.match(d.reason,/stagnation-level-1/)
  assert.equal(m.stagnation_count,1)
  d=idleTick(store,m).decision
  assert.match(d.reason,/stagnation-level-2/)
  assert.equal(m.stagnation_count,2)
})

test('exhausted provider fallback is user-action/provider availability blocker, not reasoning stagnation',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'p','opaque bug',{task_kind:'bug-fix'})
  m.blockers.push('provider-failure:provider-transport:p/model')
  m.stagnation_count=5
  const d=evaluateIdle(m)
  assert.equal(d.decision,'USER_ACTION_REQUIRED')
  assert.equal(d.reason_code,'provider-failure-blocked')
  assert.equal(m.stagnation_count,0)
})

test('semantic generation guard prevents an old continuation from clearing a newer continuation',async()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque bug',{task_kind:'bug-fix'})
  let resolve1,resolve2
  const calls=[]
  const client={session:{promptAsync:req=>{calls.push(req);return new Promise(r=>{if(calls.length===1)resolve1=r;else resolve2=r})}}}
  const first=dispatchContinuation(client,m,'first','first')
  const firstID=m.active_action_id
  assert.ok(firstID)
  // A semantic follow-up invalidates the previous continuation action.
  applyStructuredFollowup(store,'s','opaque verification follow-up',{message_kind:'verification',likely_verification:['targeted-tests']})
  assert.equal(m.active_action_id,undefined)
  const second=dispatchContinuation(client,m,'second','second')
  const secondID=m.active_action_id
  assert.ok(secondID&&secondID!==firstID)
  resolve1({data:{}})
  assert.equal(await first,false)
  assert.equal(m.active_action_id,secondID)
  assert.equal(m.continuation_active,true)
  resolve2({data:{}})
  assert.equal(await second,true)
  assert.equal(m.active_action_id,undefined)
  assert.equal(m.continuation_active,false)
  assert.ok(m.ledger.some(e=>e.type==='continuation.stale-completion'))
})

function baseClient(createIDs=[]){
  const promptCalls=[];let n=0
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{
    create:async()=>({data:{id:createIDs[n++]??`child-${n}`}}),
    promptAsync:async req=>{promptCalls.push(req);return {data:{}}},abort:async()=>({data:{}}),diff:async()=>({data:[]}),
    messages:async()=>({data:[]}),
  }}
  return {client,promptCalls}
}

test('plugin parent idle while permission/worker wait preserves stagnation_count=0',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-idle-wait-'))
  const {client}=baseClient(['child-wait'])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'p1',message:{role:'user',parts:[{type:'text',text:'fix bug'}]}},{parts:[]})
  await assessPluginMission(hooks,'p1',{task_kind:'bug-fix',likely_verification:['targeted-tests']})
  await hooks.event({event:{type:'permission.asked',properties:{id:'perm-1',sessionID:'p1',permission:'bash'}}})
  await hooks.event({event:{type:'session.idle',properties:{sessionID:'p1'}}})
  let report=JSON.parse(await hooks.tool.hi_ledger.execute({limit:80},{sessionID:'p1'}))
  let last=[...report.events].reverse().find(e=>e.type==='runtime.decision')
  assert.equal(last.payload.reason_code,'waiting-permission');assert.equal(last.payload.stagnation_count,0)
  await hooks.event({event:{type:'permission.replied',properties:{id:'perm-1',sessionID:'p1',decision:'once'}}})
  await hooks.tool.hi_task_start.execute({objective:'inspect bug',role:'repository-explorer',category:'quick'},{sessionID:'p1'})
  await hooks.event({event:{type:'session.idle',properties:{sessionID:'p1'}}})
  report=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:'p1'}));last=[...report.events].reverse().find(e=>e.type==='runtime.decision')
  assert.equal(last.payload.reason_code,'waiting-worker');assert.equal(last.payload.stagnation_count,0)
  await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})
})

test('failed child defers parent continuation while a sibling worker is still pending',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-parent-wake-'))
  const {client,promptCalls}=baseClient(['child-a','child-b'])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'parent',message:{role:'user',parts:[{type:'text',text:'research the repository for two separate tasks'}]}},{parts:[]})
  await assessPluginMission(hooks,'parent',{task_kind:'review',scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['repository-analysis','multi-stream-delegation']})
  const a=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'inspect A',role:'repository-explorer',category:'quick',scope:'src/a.ts'},{sessionID:'parent'}))
  const b=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'inspect B',role:'repository-explorer',category:'quick',scope:'src/b.ts'},{sessionID:'parent'}))
  assert.ok(a.worker_id&&b.worker_id)
  assert.equal(promptCalls.filter(x=>x.path?.id==='parent').length,0)
  await hooks.event({event:{type:'session.error',properties:{sessionID:'child-a',error:{message:'worker reasoning failed'}}}})
  assert.equal(promptCalls.filter(x=>x.path?.id==='parent').length,0,'no parent continuation while child-b is pending')
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:'parent'}))
  assert.ok(ledger.events.some(e=>e.type==='parent.wake.deferred'&&e.payload.reason==='sibling-workers-pending'))
  const rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent'}))
  assert.ok(['starting','busy'].includes(rows.find(x=>x.task.id===b.task_id).worker.status))
  await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})
})

test('late parent-session events after explicit STOP are ignored and cannot recreate permission wait',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-stop-late-'))
  const {client}=baseClient([])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'stop-parent',message:{role:'user',parts:[{type:'text',text:'fix bug'}]}},{parts:[]})
  await assessPluginMission(hooks,'stop-parent',{task_kind:'bug-fix',likely_verification:['targeted-tests']})
  await hooks['chat.message']({sessionID:'stop-parent',message:{role:'user',parts:[{type:'text',text:'STOP'}]}},{parts:[]})
  await assessPluginMission(hooks,'stop-parent',{material:true,message_kind:'stop',task_kind:'bug-fix',likely_verification:['targeted-tests']},2)
  await hooks.event({event:{type:'permission.asked',properties:{id:'late-perm',sessionID:'stop-parent',permission:'bash'}}})
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:'stop-parent'}))
  assert.ok(ledger.events.some(e=>e.type==='runtime.event.after-user-stop-ignored'&&e.payload.event==='permission.asked'))
  assert.equal(ledger.events.some(e=>e.type==='permission.asked'&&e.payload.permission_id==='late-perm'),false)
  await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})
})

test('canonical runtime decision includes NOTHING when no active mission exists',()=>{
  const d=evaluateIdle(undefined)
  assert.equal(d.decision,'NOTHING')
  assert.equal(d.reason_code,'no-active-mission')
})

test('progress signature ignores paraphrased result text and counts only semantic state changes',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('sig','fix bug')
  m.tasks.push({id:'t1',objective:'x',status:'blocked',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:{status:'FAILED',summary:'first wording',changed_files:[],evidence:[],open_issues:['same-blocker'],needs_context:[]},created_at:1,updated_at:1})
  m.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:'sig',parent_mission_id:m.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'failed',last_result_digest:'digest-a',generation_at_spawn:m.generation})
  store.updateProgress(m,false)
  m.tasks[0].result.summary='same failure, different prose';m.workers[0].last_result_digest='digest-b'
  const progressed=store.updateProgress(m,true)
  assert.equal(progressed,false)
  assert.equal(m.stagnation_count,1)
  m.blockers.push('new-real-blocker')
  assert.equal(store.updateProgress(m,true),true)
  assert.equal(m.stagnation_count,0)
})

test('continuation transport failures use a separate bounded runtime retry budget, not reasoning stagnation',async()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'cont-fail','opaque implementation')
  const failing={session:{promptAsync:async()=>{throw new Error('transport unavailable')}}}
  for(let i=1;i<=2;i++){
    m.continuation_lock_until=undefined;m.suppress_until=undefined
    assert.equal(await dispatchContinuation(failing,m,'continue','runtime-retry'),false)
    assert.equal(m.continuation_failure_count,i)
    assert.equal(m.iteration,0,'failed transport delivery does not consume reasoning/continuation turn budget')
    assert.equal(m.stagnation_count,0)
    const d=evaluateIdle(m,Date.now()+5000)
    assert.equal(d.reason_code,'continuation-runtime-retry')
    assert.equal(shouldCountStagnation(d),false)
  }
  m.continuation_lock_until=undefined;m.suppress_until=undefined
  assert.equal(await dispatchContinuation(failing,m,'continue','runtime-retry'),false)
  const exhausted=evaluateIdle(m,Date.now()+5000)
  assert.equal(exhausted.decision,'USER_ACTION_REQUIRED')
  assert.equal(exhausted.reason_code,'continuation-runtime-exhausted')
  assert.equal(m.stagnation_count,0)
})

test('successful continuation delivery resets the runtime-failure counter',async()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'cont-reset','opaque implementation')
  m.continuation_failure_count=2;m.continuation_lock_until=undefined;m.suppress_until=undefined
  const ok=await dispatchContinuation({session:{promptAsync:async()=>({data:{}})}},m,'continue','retry-success')
  assert.equal(ok,true)
  assert.equal(m.continuation_failure_count,0)
  assert.equal(m.iteration,1)
})

test('child permission session-error becomes explicit user action and never parent reasoning recovery',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-permission-failure-'))
  const {client,promptCalls}=baseClient(['child-perm'])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'parent-perm',message:{role:'user',parts:[{type:'text',text:'inspect the repository file'}]}},{parts:[]})
  await assessPluginMission(hooks,'parent-perm',{task_kind:'review',required_capabilities:['repository-analysis']})
  const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'inspect repository',role:'repository-explorer',category:'quick'},{sessionID:'parent-perm'}))
  assert.ok(started.worker_id)
  await hooks.event({event:{type:'session.error',properties:{sessionID:'child-perm',error:{message:'permission denied by effective OpenCode policy'}}}})
  assert.equal(promptCalls.filter(x=>x.path?.id==='parent-perm').length,0)
  const rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent-perm'})),row=rows.find(x=>x.task.id===started.task_id)
  assert.equal(row.task.status,'failed')
  assert.ok(row.task.result.open_issues.some(x=>x.startsWith('permission-failure:')))
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:'parent-perm'}))
  assert.ok(ledger.events.some(e=>e.type==='user.action.required'&&e.payload.reason_code==='permission-failure'&&e.payload.semantic_type==='operational_action'))
  assert.equal(ledger.stagnation_count,0)
  await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})
})
