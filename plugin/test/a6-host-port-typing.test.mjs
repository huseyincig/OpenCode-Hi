import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sendSyntheticContinuation } from '../dist/opencode/client-adapter.js'

const source=rel=>readFileSync(new URL(`../src/${rel}`,import.meta.url),'utf8')

test('A6 derives OpenCode edge types from the actual exported Plugin signature',()=>{
  const types=source('opencode/types.ts')
  assert.match(types,/Parameters<Plugin>\[0\]/)
  assert.match(types,/OpenCodeClient=OpenCodePluginContext\['client'\]/)
  const host=source('opencode/host-port.ts')
  assert.match(host,/export interface HostPort/)
  assert.match(host,/client:OpenCodeClient/)
  assert.match(host,/createHostPort\(ctx:OpenCodePluginContext\):HostPort/)
})

test('A6 keeps raw SDK any at adapter edge and removes client any from runtime core',()=>{
  for(const rel of ['runtime/task/task-runtime.ts','runtime/task/child-execution-coordinator.ts','runtime/continuation/dispatcher.ts','runtime/application/runtime-services.ts']){
    const s=source(rel)
    assert.doesNotMatch(s,/client:any|ctx:any/,rel)
  }
  assert.match(source('runtime/task/task-runtime.ts'),/client:OpenCodeClient/)
  assert.match(source('runtime/task/child-execution-coordinator.ts'),/client:OpenCodeClient/)
  assert.match(source('runtime/continuation/dispatcher.ts'),/client:OpenCodeClient/)
  assert.match(source('runtime/application/runtime-services.ts'),/ctx:OpenCodePluginContext/)
  assert.match(source('opencode/client-adapter.ts'),/const edge=client as any/)
})

test('A6 continuation uses the adapter port rather than probing OpenCode SDK shapes in core',()=>{
  const dispatcher=source('runtime/continuation/dispatcher.ts')
  assert.match(dispatcher,/sendSyntheticContinuation\(/)
  assert.doesNotMatch(dispatcher,/client\?*\.session|prompt_async|promptAsync\.bind/)
})

test('A6 composition hook uses concrete HostPort/services/authority/event types',()=>{
  const hooks=source('opencode/open-code-hooks.ts')
  assert.match(hooks,/host:HostPort/)
  assert.match(hooks,/services:ReturnType<typeof createRuntimeServices>/)
  assert.match(hooks,/projectAuthority:ProjectAuthorityStore/)
  assert.match(hooks,/eventController:RuntimeEventController/)
  assert.doesNotMatch(hooks,/host:any|services:any|projectAuthority:any|eventController:any/)
  assert.doesNotMatch(source('plugin.ts'),/async\(ctx:any\)/)
})

test('A6 synthetic continuation adapter normalizes async, legacy async, sync, and unavailable hosts',async()=>{
  const calls=[]
  const base=(name)=>({session:{[name]:async req=>{calls.push({name,req})}}})
  assert.equal(await sendSyntheticContinuation(base('promptAsync'),'s1','go',{reason:'a'}),true)
  assert.equal(await sendSyntheticContinuation(base('prompt_async'),'s2','go',{reason:'b'}),true)
  assert.equal(await sendSyntheticContinuation(base('prompt'),'s3','go',{reason:'c'}),true)
  assert.equal(await sendSyntheticContinuation({session:{}},'s4','go',{reason:'d'}),false)
  assert.deepEqual(calls.map(x=>x.name),['promptAsync','prompt_async','prompt'])
  assert.equal(calls[0].req.body.parts[0].synthetic,true)
  assert.equal(calls[0].req.body.parts[0].metadata.reason,'a')
})
