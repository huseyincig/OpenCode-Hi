import test from 'node:test'
import assert from 'node:assert/strict'
import {createChildSession,sendPromptAsync,sendSyntheticContinuation} from '../dist/opencode/client-adapter.js'
import {NativeOpenCodeAdapter,nativeOperationEffect} from '../dist/opencode/native-adapter.js'

test('native host operations explicitly classify read-only versus mutating effects',()=>{
  for(const name of ['session-create','prompt-async','prompt-sync','abort','fork','summarize','revert','unrevert','structured-log'])assert.equal(nativeOperationEffect(name),'mutating',name)
  for(const name of ['status','children','todo','diff','provider-inventory','version'])assert.equal(nativeOperationEffect(name),'read-only',name)
})

test('mutating compatibility aliases are selected before dispatch and never replay after ambiguity',async()=>{
  let first=0,second=0,sync=0
  const promptClient={session:{
    promptAsync:async()=>{first++;throw new Error('ambiguous after dispatch')},
    prompt_async:async()=>{second++},
    prompt:async()=>{sync++},
  }}
  await assert.rejects(()=>sendPromptAsync(promptClient,'child-1','x'),/ambiguous after dispatch/)
  assert.deepEqual({first,second,sync},{first:1,second:0,sync:0})

  first=0;second=0;sync=0
  await assert.rejects(()=>sendSyntheticContinuation(promptClient,'child-1','x',{}),/ambiguous after dispatch/)
  assert.deepEqual({first,second,sync},{first:1,second:0,sync:0})

  first=0;sync=0
  const nativePrompt=new NativeOpenCodeAdapter({session:{
    promptAsync:async()=>{first++;throw new Error('ambiguous after dispatch')},
    prompt:async()=>{sync++},
  }})
  await assert.rejects(()=>nativePrompt.prompt('child-1','x'),/ambiguous after dispatch/)
  assert.deepEqual({first,sync},{first:1,sync:0})

  let primary=0,alias=0
  const nativeSummary=new NativeOpenCodeAdapter({session:{
    summarize:async()=>{primary++;throw new Error('ambiguous after dispatch')},
    summary:async()=>{alias++},
  }})
  await assert.rejects(()=>nativeSummary.summarize('child-1'),/ambiguous after dispatch/)
  assert.deepEqual({primary,alias},{primary:1,alias:0})
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
