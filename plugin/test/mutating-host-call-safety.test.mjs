import test from 'node:test'
import assert from 'node:assert/strict'
import {createChildSession,sendPromptAsync,sendSyntheticContinuation} from '../dist/opencode/client-adapter.js'
import {NativeOpenCodeAdapter,nativeOperationEffect} from '../dist/opencode/native-adapter.js'

test('native host operations explicitly classify read-only versus mutating effects',()=>{
  for(const name of ['session-create','prompt-async','prompt-sync','abort','fork','summarize','revert','unrevert','structured-log'])assert.equal(nativeOperationEffect(name),'mutating',name)
  for(const name of ['status','children','todo','diff','provider-inventory','version'])assert.equal(nativeOperationEffect(name),'read-only',name)
})

test('mutating host operations are dispatched once and never replayed through another current endpoint after ambiguity',async()=>{
  let first=0,sync=0
  const promptClient={session:{
    promptAsync:async()=>{first++;throw new Error('ambiguous after dispatch')},
    prompt:async()=>{sync++},
  }}
  await assert.rejects(()=>sendPromptAsync(promptClient,'child-1','x'),/ambiguous after dispatch/)
  assert.deepEqual({first,sync},{first:1,sync:0})

  first=0;sync=0
  await assert.rejects(()=>sendSyntheticContinuation(promptClient,'child-1','x',{}),/ambiguous after dispatch/)
  assert.deepEqual({first,sync},{first:1,sync:0})

  first=0;sync=0
  const nativePrompt=new NativeOpenCodeAdapter({session:{
    promptAsync:async()=>{first++;throw new Error('ambiguous after dispatch')},
    prompt:async()=>{sync++},
  }})
  await assert.rejects(()=>nativePrompt.prompt('child-1','x'),/ambiguous after dispatch/)
  assert.deepEqual({first,sync},{first:1,sync:0})

  let summaries=0
  const nativeSummary=new NativeOpenCodeAdapter({session:{summarize:async()=>{summaries++;throw new Error('ambiguous after dispatch')}}})
  await assert.rejects(()=>nativeSummary.summarize('child-1'),/ambiguous after dispatch/)
  assert.equal(summaries,1)
})



test('alias-only legacy host shapes are not promoted to current OpenCode capabilities',()=>{
  const legacy=new NativeOpenCodeAdapter({session:{
    prompt_async:async()=>{},getStatus:async()=>({}),child:async()=>[],listChildren:async()=>[],todos:async()=>[],summary:async()=>({}),
  },config:{providers:async()=>[]}})
  assert.equal(legacy.has('prompt-async'),false)
  assert.equal(legacy.has('status'),false)
  assert.equal(legacy.has('children'),false)
  assert.equal(legacy.has('todo'),false)
  assert.equal(legacy.has('summarize'),false)
  assert.equal(legacy.has('provider-inventory'),false)
})

test('child create is dispatched once while read-only compatibility may fall back',async()=>{
  let creates=0
  await assert.rejects(()=>createChildSession({session:{create:async()=>{creates++;throw new Error('ambiguous after dispatch')}}},'parent','child'),/ambiguous after dispatch/)
  assert.equal(creates,1)

  let appVersion=0,serverVersion=0
  const adapter=new NativeOpenCodeAdapter({
    app:{version:async()=>{appVersion++;throw new Error('read failed')}},
    server:{version:async()=>{serverVersion++;return{data:'1.18.19'}}},
  })
  assert.equal(await adapter.version(),'1.18.19')
  assert.deepEqual({appVersion,serverVersion},{appVersion:1,serverVersion:1})
})


test('prompt_async acknowledgement is bounded, abort-signalled, and never replayed after a hung host transport',async()=>{
  let asyncCalls=0,syncCalls=0,capturedSignal
  const client={session:{
    promptAsync:arg=>{asyncCalls++;capturedSignal=arg.signal;return new Promise(()=>{})},
    prompt:async()=>{syncCalls++},
  }}
  await assert.rejects(()=>sendPromptAsync(client,'child-hung','x',undefined,undefined,undefined,undefined,20),/acknowledgement timed out after 20ms/)
  assert.equal(asyncCalls,1);assert.equal(syncCalls,0);assert.equal(capturedSignal instanceof AbortSignal,true);assert.equal(capturedSignal.aborted,true)

  asyncCalls=0;syncCalls=0;capturedSignal=undefined
  await assert.rejects(()=>sendSyntheticContinuation(client,'parent-hung','continue',{},20),/acknowledgement timed out after 20ms/)
  assert.equal(asyncCalls,1);assert.equal(syncCalls,0);assert.equal(capturedSignal instanceof AbortSignal,true);assert.equal(capturedSignal.aborted,true)
})


test('mutating prompt result tuples fail closed and are never replayed after host rejection',async()=>{
  let asyncCalls=0,syncCalls=0,requestedThrowOnError=false
  const rejection={name:'BadRequestError',data:{message:'prompt rejected'}}
  const client={session:{
    promptAsync:async arg=>{asyncCalls++;requestedThrowOnError=arg.throwOnError===true;return{data:undefined,error:rejection}},
    prompt:async()=>{syncCalls++;return{data:{}}},
  }}
  await assert.rejects(()=>sendPromptAsync(client,'child-rejected','x',undefined,undefined,undefined,undefined,50),/prompt rejected/)
  assert.equal(requestedThrowOnError,true);assert.equal(asyncCalls,1);assert.equal(syncCalls,0)

  asyncCalls=0;syncCalls=0;requestedThrowOnError=false
  await assert.rejects(()=>sendSyntheticContinuation(client,'parent-rejected','x',{},50),/prompt rejected/)
  assert.equal(requestedThrowOnError,true);assert.equal(asyncCalls,1);assert.equal(syncCalls,0)

  let syncThrowOnError=false
  const syncOnly={session:{prompt:async arg=>{syncCalls++;syncThrowOnError=arg.throwOnError===true;return{data:undefined,error:rejection}}}}
  syncCalls=0
  await assert.rejects(()=>sendPromptAsync(syncOnly,'child-sync-rejected','x'),/prompt rejected/)
  assert.equal(syncThrowOnError,true);assert.equal(syncCalls,1)
})


test('worker prompt forwards caller-owned OpenCode messageID without changing single-dispatch mutation safety',async()=>{
  const calls=[];const client={session:{promptAsync:async arg=>{calls.push(arg);return{data:{}}},prompt:async()=>{throw new Error('must not replay')}}}
  const messageID='msg_000000000001aaaaaaaaaaaaaa'
  await sendPromptAsync(client,'child-message-id','x','coder','p/m',undefined,{bash:false},50,messageID)
  assert.equal(calls.length,1);assert.equal(calls[0].body.messageID,messageID);assert.equal(calls[0].throwOnError,true);assert.equal(calls[0].body.model.providerID,'p');assert.equal(calls[0].body.model.modelID,'m')
})
