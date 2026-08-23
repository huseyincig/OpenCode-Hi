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

test('H1 chat transport opens idempotently and awaits one exact bounded response',async()=>{
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

test('H1 timeout and cancel are transport-only and never resolve canonical HumanDecision state',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-cancel','small task')
  const decision=openHumanDecision(m,{semantic_type:'operational_action',reason_code:'external-step',summary:'External step required',response_schema:{kind:'external-action'}})
  const transport=new ChatHumanDecisionTransport(5);transport.open(decision)
  assert.deepEqual(await transport.await(decision.decision_id),{status:'TIMEOUT',decision_id:decision.decision_id})
  assert.equal(m.authority.human_decision.status,'OPEN')
  const waiting=transport.await(decision.decision_id);transport.cancel(decision.decision_id)
  assert.deepEqual(await waiting,{status:'CANCELLED',decision_id:decision.decision_id})
  assert.equal(m.authority.human_decision.status,'OPEN')
})

test('H1 typed choice rejects invalid chat input and accepts only an exact configured choice',async()=>{
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

test('H1 authority chat remains canonical hash-bound authority; generic prose cannot become transport approval',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-authority','release task')
  assert.throws(()=>requireAuthority(m,'git push origin main',process.cwd()),/explicit approval required/)
  const decision=m.authority.human_decision,hash=m.authority.authority.pending.hash
  const transport=new ChatHumanDecisionTransport(100),hook=createChatMessageHook(store,undefined,transport);transport.open(decision)
  await hook({sessionID:'h1-authority',agent:'working-manager'},userOutput('continue'))
  assert.equal(m.authority.authority.pending.hash,hash);assert.equal(m.authority.human_decision.status,'OPEN');assert.equal(transport.handle(decision.decision_id)?.state,'OPEN')
  await hook({sessionID:'h1-authority',agent:'working-manager'},userOutput(authorityProtocolJson(m,'approve')))
  assert.equal(m.authority.authority.pending,undefined);assert.equal(m.authority.authority.approved.hash,hash);assert.equal(m.authority.human_decision.status,'RESOLVED');assert.equal(transport.handle(decision.decision_id)?.state,'RESPONDED')
})


test('H1 opening a replacement decision cancels the stale waiter for the same Mission only',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-replace','small task'),transport=new ChatHumanDecisionTransport(100)
  const first=openHumanDecision(m,{semantic_type:'value_judgment',reason_code:'first',summary:'First',response_schema:{kind:'free-text'}});transport.open(first)
  const waiting=transport.await(first.decision_id)
  const second=openHumanDecision(m,{semantic_type:'ambiguity',reason_code:'second',summary:'Second',response_schema:{kind:'free-text'}});transport.open(second)
  assert.deepEqual(await waiting,{status:'CANCELLED',decision_id:first.decision_id})
  assert.equal(transport.handle(second.decision_id)?.state,'OPEN')
})

test('H1 runtime composition owns one ephemeral chat transport and does not persist a second HumanDecision store',()=>{
  const source=readFileSync(new URL('../src/runtime/application/runtime-services.ts',import.meta.url),'utf8')
  const transportSource=readFileSync(new URL('../src/runtime/human-decision/transport.ts',import.meta.url),'utf8')
  assert.equal((source.match(/new ChatHumanDecisionTransport\(/g)??[]).length,1)
  assert.doesNotMatch(transportSource,/writeFile|readFile|RuntimePersistence|\.opencode\/hi/)
})


test('PROMPT B first HumanDecision transport response wins and duplicate/conflicting replies are inert',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-conflict','small task'),transport=new ChatHumanDecisionTransport(100)
  const decision=openHumanDecision(m,{semantic_type:'preference',reason_code:'pick',summary:'pick',response_schema:{kind:'choice',choices:['safe','fast']}});transport.open(decision)
  const first=transport.respond(decision.decision_id,'safe');assert.equal(first?.value,'safe')
  assert.equal(transport.respond(decision.decision_id,'safe'),undefined);assert.equal(transport.respond(decision.decision_id,'fast'),undefined)
  const awaited=await transport.await(decision.decision_id);assert.equal(awaited.status,'RESPONDED');assert.equal(awaited.response.value,'safe')
  assert.equal(m.authority.human_decision.status,'OPEN','transport response alone never resolves semantic decision')
})

test('PROMPT B restart reopens persisted semantic decision but never replays stale ephemeral transport response',async()=>{
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

test('H1 ephemeral transport retires old terminal entries instead of growing without bound',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-bounded-history','small task'),transport=new ChatHumanDecisionTransport(100)
  let firstID,lastID
  for(let i=0;i<200;i++){
    const d=openHumanDecision(m,{semantic_type:'preference',reason_code:`bounded-${i}`,summary:`pick ${i}`,response_schema:{kind:'choice',choices:['a','b']}})
    transport.open(d);if(i===0)firstID=d.decision_id;lastID=d.decision_id
  }
  assert.equal(transport.handle(lastID)?.state,'OPEN')
  assert.equal(transport.handle(firstID),undefined,'old cancelled transport history must be retired from process-local memory')
})

test('PROMPT B stale answer to a replaced HumanDecision cannot resolve the replacement',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'h1-stale-answer','small task'),transport=new ChatHumanDecisionTransport(100)
  const old=openHumanDecision(m,{semantic_type:'preference',reason_code:'old',summary:'old',response_schema:{kind:'choice',choices:['a','b']}});transport.open(old)
  const fresh=openHumanDecision(m,{semantic_type:'preference',reason_code:'fresh',summary:'fresh',response_schema:{kind:'choice',choices:['x','y']}});transport.open(fresh)
  assert.equal(transport.respond(old.decision_id,'a'),undefined);assert.equal(transport.handle(old.decision_id)?.state,'CANCELLED');assert.equal(transport.handle(fresh.decision_id)?.state,'OPEN')
  assert.equal(transport.respond(fresh.decision_id,'x')?.value,'x')
})
