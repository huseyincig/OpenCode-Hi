// Authority responses are a structured HumanDecision protocol. User/assistant prose is never approval semantics.
import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createChatMessageHook } from '../dist/hooks/chat-message.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ChatHumanDecisionTransport } from '../dist/runtime/human-decision/transport.js'
import {AUTHORITY_APPROVAL_TTL_MS,isAuthorized,requireAuthority,approvePendingAuthority} from '../dist/runtime/safety/authority.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startAssessedMission,applyStructuredFollowup} from './helpers/semantic.mjs'
import {authorityProtocolJson,authorityProtocolResponse,plantPendingAuthority,plantExecutingAuthority} from './helpers/authority.mjs'

function callHook(hook, sessionID, userText, _assistantText='') {
  // Exact OpenCode chat.message carries the user message only; assistant prose is not an authority input surface.
  return hook({ sessionID },{ message: { role: 'user' }, parts: [{ type: 'text', text: userText }] })
}
function authorityHook(store){const transport=new ChatHumanDecisionTransport(100);return{transport,hook:createChatMessageHook(store,undefined,transport)}}

test('structured exact authority response advances only the matching pending action', async () => {
  const store=new MissionStore();store.start('s1','demo');const m=store.get('s1'),{hook}=authorityHook(store)
  plantPendingAuthority(m,'a'.repeat(64));await callHook(hook,'s1',authorityProtocolJson(m,'approve'))
  assert.equal(m.authority.authority?.pending,undefined);assert.equal(m.authority.authority?.approved?.hash,'a'.repeat(64));assert.equal(m.identity.status,'active')
})

test('plain approval prose is not an authority response', async()=>{
  const store=new MissionStore();store.start('s1','demo');const m=store.get('s1'),{hook}=authorityHook(store);plantPendingAuthority(m,'b'.repeat(64))
  for(const text of ['approve','approved','I approve','yes','tamam','devam et'])await callHook(hook,'s1',text)
  assert.equal(m.authority.authority?.pending?.hash,'b'.repeat(64));assert.equal(m.authority.authority?.approved,undefined);assert.equal(m.authority.human_decision.status,'OPEN')
})

test('wrong decision id or authority ref cannot authorize the pending action',async()=>{
  const store=new MissionStore();store.start('s1','demo');const m=store.get('s1'),{hook}=authorityHook(store);const d=plantPendingAuthority(m,'c'.repeat(64))
  await callHook(hook,'s1',JSON.stringify({decision_id:'hd_'+ 'f'.repeat(20),authority_ref:d.authority_ref,response:'approve'}))
  await callHook(hook,'s1',JSON.stringify({decision_id:d.decision_id,authority_ref:'d'.repeat(64),response:'approve'}))
  assert.equal(m.authority.authority?.pending?.hash,'c'.repeat(64));assert.equal(m.authority.authority?.approved,undefined)
})

test('assistant text can never settle a pending authority response', async () => {
  const store=new MissionStore();store.start('s1','demo');const m=store.get('s1'),{hook}=authorityHook(store);plantPendingAuthority(m,'d'.repeat(64))
  await callHook(hook,'s1','continue',authorityProtocolJson(m,'approve'))
  assert.equal(m.authority.authority?.pending?.hash,'d'.repeat(64));assert.equal(m.authority.authority?.approved,undefined)
})

test('user stop request opens semantic follow-up; structured stop assessment stops the mission', async () => {
  const store=new MissionStore(),hook=createChatMessageHook(store);startAssessedMission(store,'s1','opaque task')
  await callHook(hook,'s1','opaque stop request');assert.equal(store.get('s1').identity.semantic_assessment.status,'pending')
  applyStructuredFollowup(store,'s1','opaque stop request',{message_kind:'stop'});assert.equal(store.get('s1').identity.status,'stopped')
})

test('generic resume against pending authority is rejected', async () => {
  const store=new MissionStore();store.start('s1','demo');const m=store.get('s1'),{hook}=authorityHook(store);plantPendingAuthority(m,'e'.repeat(64))
  await callHook(hook,'s1','resume');assert.equal(m.authority.authority?.pending?.hash,'e'.repeat(64));assert.equal(m.authority.authority?.approved,undefined)
})

test('uncertain authority requires structured USER outcome reconciliation; assistant self-report is ignored', async () => {
  const store=new MissionStore();store.start('s1','demo');const m=store.get('s1'),{hook}=authorityHook(store);plantExecutingAuthority(m,'f'.repeat(64))
  await callHook(hook,'s1','okay','action succeeded');assert.ok(m.authority.authority?.executing);assert.ok(!(m.authority.authority?.completed_hashes??[]).includes('f'.repeat(64)))
  await callHook(hook,'s1',authorityProtocolJson(m,'success'));assert.equal(m.authority.authority?.executing,undefined);assert.ok((m.authority.authority?.completed_hashes??[]).includes('f'.repeat(64)))
})

test('user amendment opens semantic follow-up and structured assessment updates execution state', async () => {
  const store=new MissionStore(),hook=createChatMessageHook(store),m=startAssessedMission(store,'s1','opaque task')
  await callHook(hook,'s1','opaque amendment');applyStructuredFollowup(store,'s1','opaque amendment',{message_kind:'amendment',scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  assert.equal(m.identity.intent.scope,'multi-stream');assert.equal(m.execution.execution_mode,'parallel')
})

test('createSystemTransformHook co-exists with chat-message hook (no regression)', async () => {
  const store=new MissionStore(),bg=new BackgroundRegistry();startAssessedMission(store,'s1','opaque multi-stream',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  const sysHook=createSystemTransformHook(store,bg),sysOut={system:[]};await sysHook({sessionID:'s1'},sysOut)
  assert.equal(sysOut.system.length,1);assert.match(sysOut.system[0],/Hi MISSION RUNTIME PROJECTION/);assert.match(sysOut.system[0],/Objective: opaque multi-stream/)
})

test('expired pending authority request rejects even a structurally exact response',async()=>{
  const store=new MissionStore();store.start('s-expired','demo');const m=store.get('s-expired'),{hook}=authorityHook(store);plantPendingAuthority(m,'1'.repeat(64))
  m.authority.authority.pending.created_at=Date.now()-AUTHORITY_APPROVAL_TTL_MS-1
  await callHook(hook,'s-expired',authorityProtocolJson(m,'approve'))
  assert.equal(m.authority.authority?.approved,undefined);assert.equal(m.authority.authority?.pending,undefined);assert.equal(m.authority.human_decision.status,'RESOLVED');assert.equal(m.authority.human_decision.resolution,'authority-request-expired')
})

test('stale one-shot approval is unauthorized and a new exact request cannot coexist with it',()=>{
  const store=new MissionStore();store.start('s-stale-approved','demo');const m=store.get('s-stale-approved');plantPendingAuthority(m,'2'.repeat(64),'cwd=/repo\ncommand=git push');assert.equal(approvePendingAuthority(m,authorityProtocolResponse(m,'approve')),true)
  m.authority.authority.approved.approved_at=Date.now()-AUTHORITY_APPROVAL_TTL_MS-1
  assert.equal(isAuthorized(m,'git push','/repo'),false)
  assert.throws(()=>requireAuthority(m,'git push','/repo'),/structured authority response/)
  assert.equal(m.authority.authority?.approved,undefined);assert.ok(m.authority.authority?.pending)
})

test('semantic revision and runtime restart invalidate unconsumed approval without erasing executing uncertainty',()=>{
  const store=new MissionStore();store.start('s-revision','demo');const m=store.get('s-revision');plantPendingAuthority(m,'3'.repeat(64));assert.equal(approvePendingAuthority(m,authorityProtocolResponse(m,'approve')),true)
  store.beginFollowupSemanticAssessment('s-revision','new constraint');assert.equal(m.authority.authority?.approved,undefined)
  plantExecutingAuthority(m,'4'.repeat(64));store.stop('s-revision','test-stop');assert.equal(m.authority.authority?.executing?.hash,'4'.repeat(64),'STOP must not fabricate resolution of an in-flight external effect')

  const root=mkdtempSync(join(tmpdir(),'hi-auth-restart-'));try{const a=new MissionStore(root);a.start('s-restart','demo');const x=a.get('s-restart');plantPendingAuthority(x,'5'.repeat(64));assert.equal(approvePendingAuthority(x,authorityProtocolResponse(x,'approve')),true);const persistence=new RuntimePersistence(root);persistence.save(a.all(),true);const restored=persistence.load();assert.equal(restored.length,1);const b=new MissionStore(root);b.restore(restored,false);assert.equal(b.get('s-restart').authority.authority?.approved,undefined)}finally{rmSync(root,{recursive:true,force:true})}
})
