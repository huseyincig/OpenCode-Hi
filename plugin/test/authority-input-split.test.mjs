// Regression guard for the user-input vs assistant-output split in
// chat-message.ts. Previously a single `extractText(output)` was used, which
// read the assistant response — so user-supplied keywords (approve,
// approve, stop, resume, amend) were never matched and the
// authority boundary re-threw on every privilege-action retry.
// Fixed in this commit by extracting user text from `input.message` and
// assistant text from `output` separately, then routing STOP / RESUME /
// APPROVE / AMEND to the user stream and resolveUncertainAuthority to the
// assistant stream.

import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createChatMessageHook } from '../dist/hooks/chat-message.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import {startAssessedMission,applyStructuredFollowup} from './helpers/semantic.mjs'

function callHook(hook, sessionID, userText, assistantText) {
  return hook(
    { sessionID, message: { role: 'user', parts: [{ type: 'text', text: userText }] } },
    { parts: [{ type: 'text', text: assistantText }] },
  )
}

test('user "approve" matches pending authority and advances state', async () => {
  const store = new MissionStore()
  const hook = createChatMessageHook(store)
  // Manually plant a pending authority that maps to a known command hash.
  store.start('s1', 'demo')
  const m = store.get('s1')
  m.authority = {
    pending: { hash: 'a'.repeat(64), action: 'cwd=\ncommand=git push', created_at: Date.now() },
    approved: undefined, executing: undefined, completed_hashes: [],
  }
  await callHook(hook, 's1', 'approve', '')
  assert.ok(!m.authority?.pending, 'pending must be cleared')
  assert.equal(m.authority?.approved?.hash, 'a'.repeat(64), 'approved.hash must match pending.hash')
  assert.equal(m.status, 'active', 'mission must resume to active after approval')
})

test('user "approve" matches pending authority (English phrase)', async () => {
  const store = new MissionStore()
  const hook = createChatMessageHook(store)
  store.start('s1', 'demo')
  const m = store.get('s1')
  m.authority = {
    pending: { hash: 'b'.repeat(64), action: 'cwd=\ncommand=git push', created_at: Date.now() },
    approved: undefined, executing: undefined, completed_hashes: [],
  }
  await callHook(hook, 's1', 'approve', '')
  assert.equal(m.authority?.approved?.hash, 'b'.repeat(64))
  assert.equal(m.status, 'active')
})

test('user "approve" does NOT match if assistant text contains "approve" but user text does not', async () => {
  // Regression for the bug: previously extractText(output) was used, so an
  // assistant response mentioning "approve" would have falsely matched.
  const store = new MissionStore()
  const hook = createChatMessageHook(store)
  store.start('s1', 'demo')
  const m = store.get('s1')
  m.authority = {
    pending: { hash: 'c'.repeat(64), action: 'cwd=\ncommand=git push', created_at: Date.now() },
    approved: undefined, executing: undefined, completed_hashes: [],
  }
  await callHook(hook, 's1', 'tamam devam et', 'approve')
  assert.ok(m.authority?.pending, 'pending must remain unless USER text says approve')
  assert.equal(m.authority?.approved, undefined)
})

test('user stop request opens semantic follow-up; structured stop assessment stops the mission', async () => {
  const store=new MissionStore(),hook=createChatMessageHook(store);startAssessedMission(store,'s1','opaque task')
  await callHook(hook,'s1','opaque stop request','');assert.equal(store.get('s1').semantic_assessment.status,'pending')
  applyStructuredFollowup(store,'s1','opaque stop request',{message_kind:'stop'});assert.equal(store.get('s1').status,'stopped')
})

test('user "resume" against pending authority is rejected (must use exact approve)', async () => {
  const store = new MissionStore()
  const hook = createChatMessageHook(store)
  store.start('s1', 'demo')
  const m = store.get('s1')
  m.authority = {
    pending: { hash: 'd'.repeat(64), action: 'cwd=\ncommand=git push', created_at: Date.now() },
    approved: undefined, executing: undefined, completed_hashes: [],
  }
  await callHook(hook, 's1', 'resume', '')
  assert.ok(m.authority?.pending, 'pending must remain; generic resume does not authorize')
  assert.equal(m.authority?.approved, undefined)
})

test('uncertain authority requires explicit USER reconciliation; assistant self-report is ignored', async () => {
  const store = new MissionStore()
  const hook = createChatMessageHook(store)
  store.start('s1', 'demo')
  const m = store.get('s1')
  m.authority = {
    executing: { hash: 'e'.repeat(64), action: 'cwd=\ncommand=git push', started_at: Date.now() },
    approved: undefined, completed_hashes: [],
  }
  await callHook(hook, 's1', 'tamam', 'action succeeded')
  assert.ok(m.authority?.executing, 'assistant text must not settle an uncertain external action')
  assert.ok(!(m.authority?.completed_hashes ?? []).includes('e'.repeat(64)))
  await callHook(hook, 's1', 'confirm action succeeded', '')
  assert.equal(m.authority?.executing, undefined)
  assert.ok((m.authority?.completed_hashes ?? []).includes('e'.repeat(64)))
})

test('user amendment opens semantic follow-up and structured assessment updates execution state', async () => {
  const store=new MissionStore(),hook=createChatMessageHook(store),m=startAssessedMission(store,'s1','opaque task')
  await callHook(hook,'s1','opaque amendment','');applyStructuredFollowup(store,'s1','opaque amendment',{message_kind:'amendment',scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  assert.equal(m.intent.scope,'multi-stream');assert.equal(m.execution_mode,'parallel')
})

test('assistant passage without user keyword does NOT trigger approval', async () => {
  const store = new MissionStore()
  const hook = createChatMessageHook(store)
  store.start('s1', 'demo')
  const m = store.get('s1')
  m.authority = {
    pending: { hash: 'f'.repeat(64), action: 'cwd=\ncommand=git push', created_at: Date.now() },
    approved: undefined, executing: undefined, completed_hashes: [],
  }
  // Long assistant response that happens to contain the word "approve".
  await callHook(
    hook,
    's1',
    'devam et',
    'Hi authority boundary: explicit approval required for exact action contract ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff. Reply with approve ile onay verin',
  )
  assert.ok(m.authority?.pending, 'user "devam et" must not match approve pattern')
  assert.equal(m.authority?.approved, undefined)
})

test('createSystemTransformHook co-exists with chat-message hook (no regression)', async () => {
  // Sanity: the system transform hook still injects scope + execution mode.
  const store = new MissionStore()
  const bg = new BackgroundRegistry()
  startAssessedMission(store,'s1','opaque multi-stream',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
  const sysHook = createSystemTransformHook(store, bg)
  const sysOut = { system: [] }
  await sysHook({ sessionID: 's1' }, sysOut)
  assert.match(sysOut.system[0], /Scope: multi-stream/)
  assert.match(sysOut.system[0], /Execution mode: parallel/)
})
