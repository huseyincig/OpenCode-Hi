import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import HiPlugin from '../dist/plugin.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {evaluateIdle,shouldCountStagnation} from '../dist/runtime/continuation/evaluator.js'
import {dispatchContinuation} from '../dist/runtime/continuation/dispatcher.js'
import {startAssessedMission,applyStructuredFollowup,DEFAULT_ASSESSMENT} from './helpers/semantic.mjs'
import {continuationPort} from './helpers/host-port.mjs'


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
  p.authority.pending_permissions=1
  for(let i=0;i<4;i++)assert.equal(idleTick(store,p).decision.reason_code,'waiting-permission')
  assert.equal(p.continuation.stagnation_count,0)

  const w=store.start('worker','fix bug')
  w.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:'worker',parent_mission_id:w.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'x',status:'busy',generation_at_spawn:w.continuation.generation})
  for(let i=0;i<4;i++)assert.equal(idleTick(store,w).decision.reason_code,'waiting-worker')
  assert.equal(w.continuation.stagnation_count,0)
})


test('sessionless queue cannot mask an older FIX_REQUIRED result that only parent reconciliation can clear',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'queued-reconcile','repair package release prep',{task_kind:'implementation',likely_verification:[]})
  const explorer=createTask(m,{objective:'inspect packages',role:'repository-explorer',category:'quick',scope:['packages'],requiredEvidence:[],obligationIds:[]})
  const explorerWorker=createWorker(m,explorer,'p/read');explorer.status='waiting';explorerWorker.status='ready';explorerWorker.session_id='child-explorer';explorer.result={status:'FIX_REQUIRED',summary:'source provenance escaped bounded scope',changed_files:[],evidence:[],open_issues:['source-provenance-outside-task-scope'],needs_context:[]}
  const impl=m.execution.obligations.find(o=>o.kind==='implementation')
  const coder=createTask(m,{objective:'repair cli',role:'coder',category:'standard',scope:['packages/cli'],requiredEvidence:[],obligationIds:impl?[impl.id]:[]})
  const coderWorker=createWorker(m,coder,'p/code');coder.status='queued';coderWorker.status='queued'
  const decision=evaluateIdle(m)
  assert.equal(decision.decision,'RECONCILE')
  assert.equal(decision.reason_code,'worker-result-unreconciled')
  assert.match(decision.prompt??'',/Reconcile the latest worker result/)
})

test('actual live child still wins WAIT over an unrelated unreconciled result',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'live-child-priority','repair package release prep',{task_kind:'implementation',likely_verification:[]})
  const old=createTask(m,{objective:'old analysis',role:'repository-explorer',category:'quick',scope:['packages'],requiredEvidence:[],obligationIds:[]})
  const oldWorker=createWorker(m,old,'p/read');old.status='waiting';oldWorker.status='ready';oldWorker.session_id='child-old';old.result={status:'FIX_REQUIRED',summary:'needs bounded correction',changed_files:[],evidence:[],open_issues:['scope'],needs_context:[]}
  const live=createTask(m,{objective:'live independent analysis',role:'repository-explorer',category:'quick',scope:['README.md'],requiredEvidence:[],obligationIds:[]})
  const liveWorker=createWorker(m,live,'p/read');live.status='running';liveWorker.status='busy';liveWorker.session_id='child-live'
  const decision=evaluateIdle(m)
  assert.equal(decision.decision,'WAIT')
  assert.equal(decision.reason_code,'waiting-worker')
})

test('open-obligation idles do advance the bounded reasoning recovery ladder',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque implementation')
  m.execution.obligations=m.execution.obligations.filter(o=>o.kind!=='verification');store.updateProgress(m,false)
  let d=idleTick(store,m).decision
  assert.equal(d.reason_code,'stagnation-recovery')
  assert.match(d.reason,/stagnation-level-1/)
  assert.equal(m.continuation.stagnation_count,1)
  d=idleTick(store,m).decision
  assert.match(d.reason,/stagnation-level-2/)
  assert.equal(m.continuation.stagnation_count,2)
})

test('exhausted provider fallback is user-action/provider availability blocker, not reasoning stagnation',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'p','opaque bug',{task_kind:'bug-fix'})
  m.execution.blockers.push('provider-failure:provider-transport:p/model')
  m.continuation.stagnation_count=5
  const d=evaluateIdle(m)
  assert.equal(d.decision,'USER_ACTION_REQUIRED')
  assert.equal(d.reason_code,'provider-failure-blocked')
  assert.equal(m.continuation.stagnation_count,0)
})

test('semantic generation guard prevents an old continuation from clearing a newer continuation',async()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'s','opaque bug',{task_kind:'bug-fix'})
  let resolve1,resolve2
  const calls=[]
  const client={session:{promptAsync:req=>{calls.push(req);return new Promise(r=>{if(calls.length===1)resolve1=r;else resolve2=r})}}}
  const first=dispatchContinuation(continuationPort(client),m,'first','first')
  const firstID=m.continuation.active_action_id
  assert.ok(firstID)
  await Promise.resolve() // host-status admission resolves before the transport prompt begins
  // A semantic follow-up invalidates the previous continuation action.
  applyStructuredFollowup(store,'s','opaque verification follow-up',{message_kind:'verification',likely_verification:['targeted-tests']})
  assert.equal(m.continuation.active_action_id,undefined)
  const second=dispatchContinuation(continuationPort(client),m,'second','second')
  const secondID=m.continuation.active_action_id
  assert.ok(secondID&&secondID!==firstID)
  await Promise.resolve() // second host-status admission resolves independently
  resolve1({data:{}})
  assert.equal(await first,false)
  assert.equal(m.continuation.active_action_id,secondID)
  assert.equal(m.continuation.continuation_active,true)
  resolve2({data:{}})
  assert.equal(await second,true)
  assert.equal(m.continuation.active_action_id,undefined)
  assert.equal(m.continuation.continuation_active,false)
  assert.ok(m.execution.ledger.some(e=>e.type==='continuation.stale-completion'))
})

function baseClient(createIDs=[]){
  const promptCalls=[];let n=0
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{
    create:async()=>({data:{id:createIDs[n++]??`child-${n}`}}),
    promptAsync:async req=>{promptCalls.push(req);return {data:{}}},abort:async()=>({data:{}}),status:async()=>({data:{}}),diff:async()=>({data:[]}),
    messages:async()=>({data:[]}),
  }}
  return {client,promptCalls}
}

test('plugin parent idle while permission/worker wait preserves stagnation_count=0',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-idle-wait-'))
  const {client}=baseClient(['child-wait']);client.session.status=async()=>({data:{'child-wait':{type:'busy'}}})
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'p1'},{message:{role:'user'},parts:[{type:'text',text:'fix bug'}]})
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

test('child terminal wake is deferred while parent is busy and delivered exactly once on parent idle',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-parent-busy-wake-'))
  const {client,promptCalls}=baseClient(['child-busy-wake'])
  const statusMap={parent:{type:'busy'}}
  client.session.status=async()=>({data:statusMap})
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  try{
    await hooks['chat.message']({sessionID:'parent'},{message:{role:'user'},parts:[{type:'text',text:'inspect the repository'}]})
    await assessPluginMission(hooks,'parent',{task_kind:'review',required_capabilities:['repository-analysis'],likely_verification:[]})
    const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'inspect repository',role:'repository-explorer',category:'quick'},{sessionID:'parent'}))
    assert.ok(started.worker_id)
    await hooks.event({event:{type:'session.error',properties:{sessionID:'child-busy-wake',error:{message:'worker reasoning failed'}}}})
    assert.equal(promptCalls.filter(x=>x.path?.id==='parent').length,0,'busy parent must not receive a synthetic continuation')
    let ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:180},{sessionID:'parent'}))
    assert.ok(ledger.events.some(e=>e.type==='continuation.deferred'&&e.payload?.reason==='parent-session-active'&&e.payload?.host_status==='busy'))
    delete statusMap.parent
    await hooks.event({event:{type:'session.idle',properties:{sessionID:'parent'}}})
    assert.equal(promptCalls.filter(x=>x.path?.id==='parent').length,1,'parent idle must deliver exactly one canonical continuation')
    await hooks.event({event:{type:'session.idle',properties:{sessionID:'parent'}}})
    assert.equal(promptCalls.filter(x=>x.path?.id==='parent').length,1,'continuation lock must prevent duplicate delivery from a repeated idle callback')
    ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:220},{sessionID:'parent'}))
    assert.equal(ledger.events.filter(e=>e.type==='continuation.deferred'&&e.payload?.reason==='parent-session-active').length,1)
  }finally{await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})}
})

test('child StructuredOutputError event settles as resumable WorkerResult contract failure',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-structured-output-event-'));mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src','a.ts'),'export const a=1\n')
  const {client}=baseClient(['child-structured-output'])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  try{
    await hooks['chat.message']({sessionID:'parent-structured-output'},{message:{role:'user'},parts:[{type:'text',text:'inspect src/a.ts'}]})
    await assessPluginMission(hooks,'parent-structured-output',{task_kind:'review',required_capabilities:['repository-analysis'],likely_targets:['src/a.ts'],likely_verification:[]})
    const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'inspect src/a.ts',role:'repository-explorer',category:'quick',scope:'src/a.ts'},{sessionID:'parent-structured-output'}))
    assert.ok(started.worker_id)
    await hooks.event({event:{type:'session.error',properties:{sessionID:'child-structured-output',error:{name:'StructuredOutputError',data:{message:'Model did not produce structured output',retries:0}}}}})
    const rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent-structured-output'})),row=rows.find(x=>x.task.id===started.task_id)
    assert.equal(row.task.status,'waiting');assert.equal(row.worker.status,'ready');assert.equal(row.task.result.status,'FIX_REQUIRED')
    assert.ok(row.task.result.open_issues.includes('worker-result-contract-invalid:structured-output'))
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:180},{sessionID:'parent-structured-output'}))
    assert.ok(ledger.events.some(e=>e.type==='worker.result-contract-retryable'&&e.payload?.transport==='opencode-json-schema'&&e.payload?.event_path==='session-error'))
    assert.equal(ledger.events.some(e=>e.type==='worker.failed'&&e.worker_id===started.worker_id),false)
  }finally{await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})}
})

test('failed child defers parent continuation while a sibling worker is still pending',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-parent-wake-'));mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src','a.ts'),'export const a=1\n');writeFileSync(join(dir,'src','b.ts'),'export const b=1\n')
  const {client,promptCalls}=baseClient(['child-a','child-b'])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'parent'},{message:{role:'user'},parts:[{type:'text',text:'research the repository for two separate tasks'}]})
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

test('resource-only process capability failure is preflighted task-locally and never opens a user decision',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-child-wake-capability-'));mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src','a.ts'),'export const a=1\n')
  const {client,promptCalls}=baseClient(['child-capability'])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  try{
    await hooks['chat.message']({sessionID:'parent-capability'},{message:{role:'user'},parts:[{type:'text',text:'inspect the repository and keep a process available if needed'}]})
    await assessPluginMission(hooks,'parent-capability',{task_kind:'review',required_capabilities:['repository-analysis','interactive-process'],likely_targets:['src/a.ts']})
    const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'keep an auxiliary process available if possible',process_lifecycle:true},{sessionID:'parent-capability'}))
    assert.equal(started.status,'BLOCKED');assert.equal(started.reason,'process-support-capability-unavailable');assert.equal(started.scope,'task-preflight-resource');assert.equal(started.mission_blocking,false);assert.equal(started.task_created,false);assert.equal(started.retry_same_start,false)
    assert.equal(promptCalls.some(x=>x.path?.id==='child-capability'),false,'known-unavailable auxiliary process capability must not create a child merely to rediscover the same failure')
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:180},{sessionID:'parent-capability'}))
    assert.ok(ledger.events.some(e=>e.type==='capability.optional-unavailable'&&e.payload?.scope==='task-preflight-resource'&&e.payload?.mission_blocking===false&&e.payload?.task_created===false))
    assert.equal(ledger.events.some(e=>e.type==='user.action.required'&&e.payload?.reason_code==='capability-unavailable'),false)
    const status=await hooks.tool.hi_status.execute({},{sessionID:'parent-capability'});assert.doesNotMatch(String(status),/waiting.user|user action required/i)
  }finally{await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})}
})

test('late parent-session events after explicit STOP are ignored and cannot recreate permission wait',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-stop-late-'))
  const {client}=baseClient([])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'stop-parent'},{message:{role:'user'},parts:[{type:'text',text:'fix bug'}]})
  await assessPluginMission(hooks,'stop-parent',{task_kind:'bug-fix',likely_verification:['targeted-tests']})
  await hooks['chat.message']({sessionID:'stop-parent'},{message:{role:'user'},parts:[{type:'text',text:'STOP'}]})
  await assessPluginMission(hooks,'stop-parent',{material:true,message_kind:'stop',task_kind:'bug-fix',likely_verification:['targeted-tests']},2)
  await hooks.event({event:{type:'permission.asked',properties:{id:'late-perm',sessionID:'stop-parent',permission:'bash',patterns:['git push origin *']}}})
  await hooks.event({event:{type:'permission.replied',properties:{id:'late-perm',sessionID:'stop-parent',response:'always'}}})
  const postStopConfig={permission:{bash:{'*':'allow'}}};await hooks.config(postStopConfig);assert.equal(postStopConfig.permission.bash['git push *'],'ask','late always reply after STOP must not persist project authority')
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
  m.execution.tasks.push({id:'t1',objective:'x',status:'blocked',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],result:{status:'FAILED',summary:'first wording',changed_files:[],evidence:[],open_issues:['same-blocker'],needs_context:[]},created_at:1,updated_at:1})
  m.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:'sig',parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'failed',last_result_digest:'digest-a',generation_at_spawn:m.continuation.generation})
  store.updateProgress(m,false)
  m.execution.tasks[0].result.summary='same failure, different prose';m.execution.workers[0].last_result_digest='digest-b'
  const progressed=store.updateProgress(m,true)
  assert.equal(progressed,false)
  assert.equal(m.continuation.stagnation_count,1)
  m.execution.blockers.push('new-real-blocker')
  assert.equal(store.updateProgress(m,true),true)
  assert.equal(m.continuation.stagnation_count,0)
})

test('continuation transport failures use a separate bounded runtime retry budget, not reasoning stagnation',async()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'cont-fail','opaque implementation')
  const failing={session:{promptAsync:async()=>{throw new Error('transport unavailable')}}}
  for(let i=1;i<=2;i++){
    m.continuation.continuation_lock_until=undefined;m.continuation.suppress_until=undefined
    assert.equal(await dispatchContinuation(continuationPort(failing),m,'continue','runtime-retry'),false)
    assert.equal(m.continuation.continuation_failure_count,i)
    assert.equal(m.continuation.iteration,0,'failed transport delivery does not consume reasoning/continuation turn budget')
    assert.equal(m.continuation.stagnation_count,0)
    const d=evaluateIdle(m,Date.now()+5000)
    assert.equal(d.reason_code,'continuation-runtime-retry')
    assert.equal(shouldCountStagnation(d),false)
  }
  m.continuation.continuation_lock_until=undefined;m.continuation.suppress_until=undefined
  assert.equal(await dispatchContinuation(continuationPort(failing),m,'continue','runtime-retry'),false)
  const exhausted=evaluateIdle(m,Date.now()+5000)
  assert.equal(exhausted.decision,'USER_ACTION_REQUIRED')
  assert.equal(exhausted.reason_code,'continuation-runtime-exhausted')
  assert.equal(m.continuation.stagnation_count,0)
})

test('successful continuation delivery resets the runtime-failure counter',async()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'cont-reset','opaque implementation')
  m.continuation.continuation_failure_count=2;m.continuation.continuation_lock_until=undefined;m.continuation.suppress_until=undefined
  const ok=await dispatchContinuation(continuationPort({session:{promptAsync:async()=>({data:{}})}}),m,'continue','retry-success')
  assert.equal(ok,true)
  assert.equal(m.continuation.continuation_failure_count,0)
  assert.equal(m.continuation.iteration,1)
})

test('child permission session-error becomes explicit user action and never parent reasoning recovery',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-permission-failure-'))
  const {client,promptCalls}=baseClient(['child-perm'])
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  await hooks['chat.message']({sessionID:'parent-perm'},{message:{role:'user'},parts:[{type:'text',text:'inspect the repository file'}]})
  await assessPluginMission(hooks,'parent-perm',{task_kind:'review',required_capabilities:['repository-analysis']})
  const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'inspect repository',role:'repository-explorer',category:'quick'},{sessionID:'parent-perm'}))
  assert.ok(started.worker_id)
  await hooks.event({event:{type:'session.error',properties:{sessionID:'child-perm',error:{name:'ProviderAuthError',data:{providerID:'p',message:'authentication required'}}}}})
  assert.equal(promptCalls.filter(x=>x.path?.id==='parent-perm').length,0)
  const rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent-perm'})),row=rows.find(x=>x.task.id===started.task_id)
  assert.equal(row.task.status,'failed')
  assert.ok(row.task.result.open_issues.some(x=>x.startsWith('permission-failure:')))
  const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:120},{sessionID:'parent-perm'}))
  assert.ok(ledger.events.some(e=>e.type==='user.action.required'&&e.payload.reason_code==='permission-failure'&&e.payload.semantic_type==='operational_action'))
  assert.equal(ledger.stagnation_count,0)
  await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})
})


test('native child permission reject is causally settled as resumable NEEDS_CONTEXT before generic WorkerResult parsing',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hi-native-permission-deny-'))
  const {client,promptCalls}=baseClient(['child-native-deny'])
  client.session.messages=async()=>({data:[{info:{id:'assistant-before-deny',role:'assistant',providerID:'p',modelID:'primary',time:{created:100}},parts:[{type:'text',text:'I will install dependencies now.'},{type:'tool',tool:'bash',state:{status:'error',input:{command:'pip install -r requirements.txt'}}}]}]})
  const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
  try{
    await hooks['chat.message']({sessionID:'parent-native-deny'},{message:{role:'user'},parts:[{type:'text',text:'implement the local app'}]})
    await assessPluginMission(hooks,'parent-native-deny',{task_kind:'implementation',scope:'local',required_capabilities:['implementation'],likely_verification:[],likely_targets:['app.py']})
    const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'implement app',role:'coder',category:'standard',scope:'app.py'},{sessionID:'parent-native-deny'}));assert.ok(started.worker_id)
    const initialChildPrompts=promptCalls.filter(x=>x.path?.id==='child-native-deny').length;assert.equal(initialChildPrompts,1)
    await hooks.event({event:{type:'permission.asked',properties:{id:'perm-native-deny',sessionID:'child-native-deny',permission:'bash',patterns:['pip install -r requirements.txt']}}})
    await hooks.event({event:{type:'permission.replied',properties:{id:'perm-native-deny',sessionID:'child-native-deny',decision:'deny'}}})
    let rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent-native-deny'})),row=rows.find(x=>x.task.id===started.task_id)
    assert.deepEqual(row.worker.pending_native_permission_denial?.patterns,['pip install -r requirements.txt'])
    assert.equal(row.worker.pending_native_permission_denial?.permission_id,'perm-native-deny')
    await hooks.event({event:{type:'session.idle',properties:{sessionID:'child-native-deny'}}})
    rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent-native-deny'}));row=rows.find(x=>x.task.id===started.task_id)
    assert.equal(row.task.result.status,'NEEDS_CONTEXT');assert.equal(row.task.status,'blocked');assert.equal(row.worker.status,'ready')
    assert.ok(row.task.result.open_issues.includes('permission-denied:perm-native-deny'))
    assert.equal(row.task.result.open_issues.includes('worker-result-contract-invalid'),false,'causal native deny must not be misclassified as malformed model output')
    assert.ok(row.task.result.needs_context.some(x=>/Do not retry or bypass the denied action/i.test(x)))
    assert.equal(row.worker.pending_native_permission_denial,undefined,'denial receipt is consumed exactly once at accepted terminal idle')
    assert.equal(promptCalls.filter(x=>x.path?.id==='child-native-deny').length,1,'deny settlement must never automatically retry the child or denied action')
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:220},{sessionID:'parent-native-deny'}))
    assert.ok(ledger.events.some(e=>e.type==='worker.permission-denial.recorded'&&e.payload?.permission_id==='perm-native-deny'))
    assert.ok(ledger.events.some(e=>e.type==='worker.permission-denial.settled'&&e.payload?.status==='NEEDS_CONTEXT'))
    assert.equal(ledger.events.some(e=>e.type==='worker.result-contract-retryable'&&e.worker_id===started.worker_id),false)
    const resumed=JSON.parse(await hooks.tool.hi_task_start.execute({task_id:started.task_id},{sessionID:'parent-native-deny'}));assert.equal(resumed.task_id,started.task_id);assert.equal(resumed.session_id,'child-native-deny')
    assert.equal(promptCalls.filter(x=>x.path?.id==='child-native-deny').length,2)
    const correction=promptCalls.filter(x=>x.path?.id==='child-native-deny').at(-1).body.parts[0].text
    assert.match(correction,/permission-denied:perm-native-deny|native-permission-denied/i);assert.match(correction,/do not retry or bypass/i)
  }finally{await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})}
})

test('session.error defers to OpenCode while the exact child remains busy or retrying',async()=>{
  for(const hostStatus of ['busy','retry']){
    const dir=mkdtempSync(join(tmpdir(),`hi-error-${hostStatus}-`))
    const {client,promptCalls}=baseClient(['child-error']);let aborts=0
    client.session.status=async()=>({data:{'child-error':{type:hostStatus}}});client.session.abort=async()=>{aborts++;return{data:true}}
    const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client});await hooks.config({})
    try{
      await hooks['chat.message']({sessionID:'parent-error'},{message:{role:'user'},parts:[{type:'text',text:'inspect the repository'}]})
      await assessPluginMission(hooks,'parent-error',{task_kind:'review',required_capabilities:['repository-analysis'],likely_verification:[]})
      const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'inspect repository',role:'repository-explorer',category:'quick'},{sessionID:'parent-error'}));assert.ok(started.worker_id)
      await hooks.event({event:{type:'session.error',properties:{sessionID:'child-error',error:{name:'ContextOverflowError',data:{message:'maximum context length exceeded'}}}}})
      const rows=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'parent-error'})),row=rows.find(x=>x.task.id===started.task_id)
      assert.ok(['starting','busy'].includes(row.worker.status));assert.equal(row.task.status,'running');assert.equal(aborts,0)
      assert.equal(promptCalls.filter(x=>x.path?.id==='parent-error').length,0)
      const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({limit:160},{sessionID:'parent-error'}))
      assert.ok(ledger.events.some(e=>e.type==='worker.error-deferred-host-active'&&e.payload?.host_status===hostStatus&&e.payload?.error==='maximum context length exceeded'))
    }finally{await hooks.dispose?.();rmSync(dir,{recursive:true,force:true})}
  }
})
