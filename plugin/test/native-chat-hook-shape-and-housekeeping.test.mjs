import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createChatMessageHook } from '../dist/hooks/chat-message.js'
import { createMessagesTransformHook } from '../dist/hooks/messages-transform.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'
import { startAssessedMission, applyStructuredFollowup } from './helpers/semantic.mjs'

function nativeUser(text){return {message:{role:'user'},parts:[{type:'text',text}]}}

test('OpenCode 1.18 chat.message output.parts is the authoritative user text source', async()=>{
  const store=new MissionStore(process.cwd())
  const hook=createChatMessageHook(store)
  await hook({sessionID:'native-shape',agent:'working-manager'},nativeUser('fix the bug in src/parser.ts'))
  const m=store.get('native-shape')
  assert.ok(m)
  assert.match(m.identity.objective,/parser/i)
  assert.notEqual(m.identity.objective,'')
})

test('pure greeting becomes provisional until semantic assessment marks it non-material', async()=>{
  const store=new MissionStore(process.cwd());const hook=createChatMessageHook(store)
  await hook({sessionID:'casual',agent:'working-manager'},nativeUser('opaque greeting'))
  const m=store.get('casual');assert.ok(m);assert.equal(m.identity.semantic_assessment.status,'pending')
  store.applyInitialSemanticAssessment('casual',{material:false,message_kind:'non-material',task_kind:'review',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:[],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  assert.equal(m.identity.status,'completed')
})

test('legacy input.message fixture remains supported for older hosts/tests', async()=>{
  const store=new MissionStore(process.cwd())
  const hook=createChatMessageHook(store)
  await hook({sessionID:'legacy',message:{role:'user',parts:[{type:'text',text:'fix the README typo'}]}},{parts:[]})
  assert.ok(store.get('legacy'))
})


test('native output.parts opens semantic follow-up revisions; structured assessment drives verification and stop', async()=>{
  const store=new MissionStore(process.cwd()),hook=createChatMessageHook(store)
  await hook({sessionID:'follow',agent:'working-manager'},nativeUser('opaque task'));store.applyInitialSemanticAssessment('follow',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const m=store.get('follow');await hook({sessionID:'follow',agent:'working-manager'},nativeUser('opaque verification follow-up'));applyStructuredFollowup(store,'follow','opaque verification follow-up',{message_kind:'verification',likely_verification:['targeted-tests']});assert.equal(m.execution.obligations.find(x=>x.kind==='verification')?.status,'open')
  await hook({sessionID:'follow',agent:'working-manager'},nativeUser('opaque stop request'));applyStructuredFollowup(store,'follow','opaque stop request',{message_kind:'stop'});assert.equal(m.identity.status,'stopped')
})

test('native title/summary/compaction agents do not receive Hi control-plane transforms', async()=>{
  for(const agent of ['title','summary','compaction']){
    const store=new MissionStore(process.cwd())
    store.start(`s-${agent}`,'fix src/a.ts')
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


test('OpenCode CLI quoted chat text normalizes before provisional semantic assessment', async()=>{
  const store=new MissionStore(process.cwd()),hook=createChatMessageHook(store)
  await hook({sessionID:'cli-quoted',agent:'working-manager'},nativeUser('\"opaque quoted request\"'))
  const m=store.get('cli-quoted');assert.ok(m);assert.equal(m.identity.objective,'opaque quoted request');assert.equal(m.identity.semantic_assessment.status,'pending')
})

test('OpenCode 1.18 agentless title system transform is recognized from native prompt fingerprint', async()=>{
  const store=new MissionStore(process.cwd())
  store.start('agentless-title','fix src/a.ts')
  const out={system:['You are a title generator. You output ONLY a thread title. Nothing else.']}
  await createSystemTransformHook(store,new BackgroundRegistry())({sessionID:'agentless-title',model:{id:'gpt-5.4-nano'}},out)
  assert.equal(out.system.length,1)
  assert.doesNotMatch(out.system[0],/Hi CONTROL-PLANE CONTRACT/)
})

test('working-manager still receives Hi system transform', async()=>{
  const store=new MissionStore(process.cwd())
  startAssessedMission(store,'parent','opaque task',{likely_targets:['src/a.ts']})
  const out={system:['native']}
  await createSystemTransformHook(store,new BackgroundRegistry())({sessionID:'parent',agent:'working-manager'},out)
  assert.equal(out.system.length,2)
  assert.match(out.system[1],/Hi MISSION RUNTIME PROJECTION/)
})


test('primary chat model metadata stays host-selected and does not manufacture Hi primary model state',async()=>{
  const store=new MissionStore(),hook=createChatMessageHook(store)
  await hook({sessionID:'primary-host-model',agent:'working-manager',model:{providerID:'p',modelID:'host-choice'},variant:'high'},nativeUser('opaque primary task'))
  const m=store.get('primary-host-model')
  assert.ok(m)
  assert.equal(m.execution.primary_mode,'working-manager')
  assert.equal(m.execution.workers.length,0)
  assert.equal(Object.hasOwn(m,'primary_model'),false)
  assert.equal(Object.hasOwn(m,'primary_model_variant'),false)
})
