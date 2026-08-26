import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,mkdtempSync,rmSync } from 'node:fs'
import { ChatHumanDecisionTransport } from '../dist/runtime/human-decision/transport.js'
import { createChatMessageHook } from '../dist/hooks/chat-message.js'
import { openHumanDecision } from '../dist/runtime/human-decision/runtime.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { requireAuthority } from '../dist/runtime/safety/authority.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import {authorityProtocolJson} from './helpers/authority.mjs'

function userOutput(text){return{message:{role:'user'},parts:[{type:'text',text}]}}

test('chat transport opens idempotently and awaits one exact bounded response',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-transport','small task')
  const decision=openHumanDecision(m,{semantic_type:'value_judgment',reason_code:'choose-shape',summary:'Choose the preferred shape',response_schema:{kind:'free-text'}})
  const transport=new ChatHumanDecisionTransport(100)
  const first=transport.open(decision),second=transport.open(decision)
  assert.equal(first.decision_id,decision.decision_id);assert.equal(second.opened_at,first.opened_at)
  const waiting=transport.await(decision.decision_id)
  assert.equal(transport.respond('hd_'+ 'f'.repeat(20),'wrong'),undefined)
  const response=transport.respond(decision.decision_id,'x'.repeat(1400))
  assert.equal(response?.decision_id,decision.decision_id);assert.equal(response?.kind,'free-text');assert.equal(response?.value.length,1000)
  assert.deepEqual(await waiting,{status:'RESPONDED',response})
})

test('timeout and cancel are transport-only and never resolve canonical HumanDecision state',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-cancel','small task')
  const decision=openHumanDecision(m,{semantic_type:'operational_action',reason_code:'external-step',summary:'External step required',response_schema:{kind:'external-action'}})
  const transport=new ChatHumanDecisionTransport(5);transport.open(decision)
  assert.deepEqual(await transport.await(decision.decision_id),{status:'TIMEOUT',decision_id:decision.decision_id})
  assert.equal(m.authority.human_decision.status,'OPEN')
  const waiting=transport.await(decision.decision_id);transport.cancel(decision.decision_id)
  assert.deepEqual(await waiting,{status:'CANCELLED',decision_id:decision.decision_id})
  assert.equal(m.authority.human_decision.status,'OPEN')
})

test('typed choice rejects invalid chat input and accepts only an exact configured choice',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-choice','small task')
  const decision=openHumanDecision(m,{semantic_type:'preference',reason_code:'select-mode',summary:'Select mode',response_schema:{kind:'choice',choices:['safe','fast']}})
  const transport=new ChatHumanDecisionTransport(100)
  const hook=createChatMessageHook(store,undefined,transport)
  await hook({sessionID:'h1-choice',agent:'working-manager'},userOutput('other'))
  assert.equal(m.authority.human_decision.status,'OPEN');assert.equal(m.identity.semantic_assessment.status,'assessed');assert.equal(transport.handle(decision.decision_id)?.state,'OPEN')
  await hook({sessionID:'h1-choice',agent:'working-manager'},userOutput('safe'))
  assert.equal(m.authority.human_decision.status,'RESOLVED');assert.equal(m.identity.semantic_assessment.status,'pending');assert.equal(transport.handle(decision.decision_id)?.state,'RESPONDED')
  const result=await transport.await(decision.decision_id);assert.equal(result.status,'RESPONDED');assert.equal(result.response.value,'safe')
})

test('authority chat remains canonical hash-bound authority; generic prose cannot become transport approval',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-authority','release task')
  assert.throws(()=>requireAuthority(m,'git push origin main',process.cwd()),/explicit approval required/)
  const decision=m.authority.human_decision,hash=m.authority.authority.pending.hash
  const transport=new ChatHumanDecisionTransport(100),hook=createChatMessageHook(store,undefined,transport);transport.open(decision)
  await hook({sessionID:'h1-authority',agent:'working-manager'},userOutput('continue'))
  assert.equal(m.authority.authority.pending.hash,hash);assert.equal(m.authority.human_decision.status,'OPEN');assert.equal(transport.handle(decision.decision_id)?.state,'OPEN')
  await hook({sessionID:'h1-authority',agent:'working-manager'},userOutput(authorityProtocolJson(m,'approve')))
  assert.equal(m.authority.authority.pending,undefined);assert.equal(m.authority.authority.approved.hash,hash);assert.equal(m.authority.human_decision.status,'RESOLVED');assert.equal(transport.handle(decision.decision_id)?.state,'RESPONDED')
})


test('opening a replacement decision cancels the stale waiter for the same Mission only',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-replace','small task'),transport=new ChatHumanDecisionTransport(100)
  const first=openHumanDecision(m,{semantic_type:'value_judgment',reason_code:'first',summary:'First',response_schema:{kind:'free-text'}});transport.open(first)
  const waiting=transport.await(first.decision_id)
  const second=openHumanDecision(m,{semantic_type:'ambiguity',reason_code:'second',summary:'Second',response_schema:{kind:'free-text'}});transport.open(second)
  assert.deepEqual(await waiting,{status:'CANCELLED',decision_id:first.decision_id})
  assert.equal(transport.handle(second.decision_id)?.state,'OPEN')
})

test('runtime composition owns one ephemeral chat transport and does not persist a second HumanDecision store',()=>{
  const source=readFileSync(new URL('../src/runtime/application/runtime-services.ts',import.meta.url),'utf8')
  const transportSource=readFileSync(new URL('../src/runtime/human-decision/transport.ts',import.meta.url),'utf8')
  assert.equal((source.match(/new ChatHumanDecisionTransport\(/g)??[]).length,1)
  assert.doesNotMatch(transportSource,/writeFile|readFile|RuntimePersistence|\.opencode\/hi/)
})


test('first HumanDecision transport response wins and duplicate/conflicting replies are inert',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-conflict','small task'),transport=new ChatHumanDecisionTransport(100)
  const decision=openHumanDecision(m,{semantic_type:'preference',reason_code:'pick',summary:'pick',response_schema:{kind:'choice',choices:['safe','fast']}});transport.open(decision)
  const first=transport.respond(decision.decision_id,'safe');assert.equal(first?.value,'safe')
  assert.equal(transport.respond(decision.decision_id,'safe'),undefined);assert.equal(transport.respond(decision.decision_id,'fast'),undefined)
  const awaited=await transport.await(decision.decision_id);assert.equal(awaited.status,'RESPONDED');assert.equal(awaited.response.value,'safe')
  assert.equal(m.authority.human_decision.status,'OPEN','transport response alone never resolves semantic decision')
})

test('restart reopens persisted semantic decision but never replays stale ephemeral transport response',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-hd-restart-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'h1-restart','small task'),oldTransport=new ChatHumanDecisionTransport(100)
    const decision=openHumanDecision(m,{semantic_type:'preference',reason_code:'restart-choice',summary:'pick',response_schema:{kind:'choice',choices:['safe','fast']}});oldTransport.open(decision)
    assert.equal(oldTransport.respond(decision.decision_id,'safe')?.value,'safe')
    new RuntimePersistence(root).save(store.all(),true)
    const restoredMission=new RuntimePersistence(root).load()[0];assert.equal(restoredMission.authority.human_decision.status,'OPEN')
    const freshTransport=new ChatHumanDecisionTransport(100);freshTransport.open(restoredMission.authority.human_decision)
    assert.equal(freshTransport.handle(decision.decision_id)?.state,'OPEN');assert.equal(oldTransport.handle(decision.decision_id)?.state,'RESPONDED')
    const waiting=freshTransport.await(decision.decision_id);const response=freshTransport.respond(decision.decision_id,'fast');assert.equal(response?.value,'fast');assert.equal((await waiting).status,'RESPONDED')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('ephemeral transport retires old terminal entries instead of growing without bound',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-bounded-history','small task'),transport=new ChatHumanDecisionTransport(100)
  let firstID,lastID
  for(let i=0;i<200;i++){
    const d=openHumanDecision(m,{semantic_type:'preference',reason_code:`bounded-${i}`,summary:`pick ${i}`,response_schema:{kind:'choice',choices:['a','b']}})
    transport.open(d);if(i===0)firstID=d.decision_id;lastID=d.decision_id
  }
  assert.equal(transport.handle(lastID)?.state,'OPEN')
  assert.equal(transport.handle(firstID),undefined,'old cancelled transport history must be retired from process-local memory')
})

test('stale answer to a replaced HumanDecision cannot resolve the replacement',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-stale-answer','small task'),transport=new ChatHumanDecisionTransport(100)
  const old=openHumanDecision(m,{semantic_type:'preference',reason_code:'old',summary:'old',response_schema:{kind:'choice',choices:['a','b']}});transport.open(old)
  const fresh=openHumanDecision(m,{semantic_type:'preference',reason_code:'fresh',summary:'fresh',response_schema:{kind:'choice',choices:['x','y']}});transport.open(fresh)
  assert.equal(transport.respond(old.decision_id,'a'),undefined);assert.equal(transport.handle(old.decision_id)?.state,'CANCELLED');assert.equal(transport.handle(fresh.decision_id)?.state,'OPEN')
  assert.equal(transport.respond(fresh.decision_id,'x')?.value,'x')
})

test('transport dispose cancels every open waiter and rejects late replies',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-dispose-transport','small task'),transport=new ChatHumanDecisionTransport(60_000)
  const decision=openHumanDecision(m,{semantic_type:'preference',reason_code:'dispose-choice',summary:'pick',response_schema:{kind:'choice',choices:['safe','fast']}});transport.open(decision)
  const waiting=transport.await(decision.decision_id)
  transport.dispose()
  assert.deepEqual(await waiting,{status:'CANCELLED',decision_id:decision.decision_id})
  assert.equal(transport.respond(decision.decision_id,'safe'),undefined,'disposed transport must never accept a late reply')
  transport.dispose()
})

test('plugin dispose preserves a waiting-user Mission and durable HumanDecision across clean host teardown',async()=>{
  const {default:HiPlugin}=await import('../dist/plugin.js')
  const {assessPluginMission}=await import('./helpers/semantic.mjs')
  const root=mkdtempSync(join(tmpdir(),'hi-hd-plugin-dispose-'))
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:'unused'}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true}),status:async()=>({data:{}}),diff:async()=>({data:[]}),messages:async()=>({data:[]})}}
  let hooks
  try{
    hooks=await HiPlugin({directory:root,worktree:root,project:{},client});await hooks.config({})
    await hooks['chat.message']({sessionID:'h1-dispose-parent',agent:'working-manager'},userOutput('inspect local credentials'))
    await assessPluginMission(hooks,'h1-dispose-parent',{task_kind:'diagnosis',required_capabilities:['verification']})
    await assert.rejects(()=>hooks['tool.execute.before']({sessionID:'h1-dispose-parent',tool:'bash'},{args:{command:'gh auth login'}}),/interactive credential/i)
    let before=new RuntimePersistence(root).load().find(x=>x.identity.session_id==='h1-dispose-parent')
    assert.equal(before?.identity.status,'waiting-user');assert.equal(before?.authority.human_decision?.status,'OPEN')
    await hooks.dispose();hooks=undefined
    const after=new RuntimePersistence(root).load().find(x=>x.identity.session_id==='h1-dispose-parent')
    assert.equal(after?.identity.status,'waiting-user')
    assert.equal(after?.continuation.user_interrupted,false)
    assert.equal(after?.authority.human_decision?.status,'OPEN')
    assert.equal(after?.execution.ledger.some(e=>e.type==='mission.stopped'&&e.payload?.reason==='plugin-dispose'),false)
    assert.ok(after?.execution.ledger.some(e=>e.type==='runtime.plugin-disposed'&&e.payload?.durable_mission_preserved===true))
  }finally{await hooks?.dispose?.();rmSync(root,{recursive:true,force:true})}
})

test('plugin dispose preserves an active worker recipe for restart reconciliation instead of cancelling it',async()=>{
  const {default:HiPlugin}=await import('../dist/plugin.js')
  const {assessPluginMission}=await import('./helpers/semantic.mjs')
  const root=mkdtempSync(join(tmpdir(),'hi-active-plugin-dispose-'))
  let child=0
  const client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:`child-${++child}`}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true}),status:async()=>({data:{}}),diff:async()=>({data:[]}),messages:async()=>({data:[]})}}
  let hooks
  try{
    hooks=await HiPlugin({directory:root,worktree:root,project:{},client});await hooks.config({})
    const sid='h1-dispose-active';await hooks['chat.message']({sessionID:sid,agent:'working-manager'},userOutput('fix local bug'))
    await assessPluginMission(hooks,sid,{task_kind:'bug-fix',required_capabilities:['implementation'],likely_verification:['targeted-tests']})
    const started=JSON.parse(String(await hooks.tool.hi_task_start.execute({input:{role:'coder',objective:'fix local bug'}},{sessionID:sid})))
    assert.match(started.task_id,/^t_/);assert.match(started.worker_id,/^w_/)
    await hooks.dispose();hooks=undefined
    const after=new RuntimePersistence(root).load().find(x=>x.identity.session_id===sid)
    const task=after?.execution.tasks.find(x=>x.id===started.task_id),worker=after?.execution.workers.find(x=>x.id===started.worker_id)
    assert.equal(after?.identity.status,'active');assert.equal(after?.continuation.user_interrupted,false)
    assert.equal(task?.status,'running');assert.equal(worker?.status,'busy');assert.equal(worker?.session_id,'child-1')
    assert.equal(after?.execution.ledger.some(e=>e.type==='worker.cancelled'&&e.worker_id===started.worker_id),false)
  }finally{await hooks?.dispose?.();rmSync(root,{recursive:true,force:true})}
})
