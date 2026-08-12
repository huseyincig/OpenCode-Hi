import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createChatMessageHook } from '../dist/hooks/chat-message.js'
import { createMessagesTransformHook } from '../dist/hooks/messages-transform.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'

function nativeUser(text){return {message:{role:'user'},parts:[{type:'text',text}]}}

test('OpenCode 1.18 chat.message output.parts is the authoritative user text source', async()=>{
  const store=new MissionStore(process.cwd())
  const hook=createChatMessageHook(store)
  await hook({sessionID:'native-shape',agent:'working-manager'},nativeUser('src/parser.ts bugını düzelt'))
  const m=store.get('native-shape')
  assert.ok(m)
  assert.match(m.objective,/parser/i)
  assert.notEqual(m.objective,'')
})

test('pure greeting on native chat.message shape does not create an HHC mission', async()=>{
  const store=new MissionStore(process.cwd())
  const hook=createChatMessageHook(store)
  await hook({sessionID:'casual',agent:'working-manager'},nativeUser('Merhaba, tek cümle cevap ver.'))
  assert.equal(store.get('casual'),undefined)
})

test('legacy input.message fixture remains supported for older hosts/tests', async()=>{
  const store=new MissionStore(process.cwd())
  const hook=createChatMessageHook(store)
  await hook({sessionID:'legacy',message:{role:'user',parts:[{type:'text',text:'README typo düzelt'}]}},{parts:[]})
  assert.ok(store.get('legacy'))
})


test('native output.parts shape drives STOP and follow-up verification transitions', async()=>{
  const store=new MissionStore(process.cwd())
  const hook=createChatMessageHook(store)
  await hook({sessionID:'follow',agent:'working-manager'},nativeUser('src/a.ts düzelt'))
  const m=store.get('follow'); assert.ok(m)
  await hook({sessionID:'follow',agent:'working-manager'},nativeUser('testleri de yap'))
  assert.equal(m.obligations.find(x=>x.kind==='verification')?.status,'open')
  await hook({sessionID:'follow',agent:'working-manager'},nativeUser('STOP'))
  assert.equal(m.status,'stopped')
})

test('native title/summary/compaction agents do not receive HHC control-plane transforms', async()=>{
  for(const agent of ['title','summary','compaction']){
    const store=new MissionStore(process.cwd())
    store.start(`s-${agent}`,'src/a.ts düzelt')
    const bg=new BackgroundRegistry()
    const sys=createSystemTransformHook(store,bg)
    const out={system:['native']}
    await sys({sessionID:`s-${agent}`,agent},out)
    assert.deepEqual(out.system,['native'])
    const messages=createMessagesTransformHook(store,bg)
    const mout={messages:[{info:{role:'user'},parts:[{type:'text',text:'hello'}]}]}
    await messages({sessionID:`s-${agent}`,agent},mout)
    assert.equal(mout.messages[0].parts.length,1)
  }
})


test('OpenCode CLI quoted chat text normalizes before casual classification', async()=>{
  const store=new MissionStore(process.cwd())
  const hook=createChatMessageHook(store)
  await hook({sessionID:'cli-quoted',agent:'working-manager'},nativeUser('\"Merhaba, tek cümle cevap ver.\"'))
  assert.equal(store.get('cli-quoted'),undefined)
})

test('OpenCode 1.18 agentless title system transform is recognized from native prompt fingerprint', async()=>{
  const store=new MissionStore(process.cwd())
  store.start('agentless-title','src/a.ts düzelt')
  const out={system:['You are a title generator. You output ONLY a thread title. Nothing else.']}
  await createSystemTransformHook(store,new BackgroundRegistry())({sessionID:'agentless-title',model:{id:'gpt-5.4-nano'}},out)
  assert.equal(out.system.length,1)
  assert.doesNotMatch(out.system[0],/HHC CONTROL-PLANE CONTRACT/)
})

test('working-manager still receives HHC system transform', async()=>{
  const store=new MissionStore(process.cwd())
  store.start('parent','src/a.ts düzelt')
  const out={system:['native']}
  await createSystemTransformHook(store,new BackgroundRegistry())({sessionID:'parent',agent:'working-manager'},out)
  assert.equal(out.system.length,2)
  assert.match(out.system[1],/HHC CONTROL-PLANE CONTRACT/)
})
