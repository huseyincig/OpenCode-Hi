import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ChatHumanDecisionTransport } from '../dist/runtime/human-decision/transport.js'
import { createChatMessageHook } from '../dist/hooks/chat-message.js'
import { openHumanDecision } from '../dist/runtime/human-decision/runtime.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { requireAuthority } from '../dist/runtime/safety/authority.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function userOutput(text){return{message:{role:'user',parts:[{type:'text',text}]}}}

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
  await hook({sessionID:'h1-authority',agent:'working-manager'},userOutput('approve'))
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
