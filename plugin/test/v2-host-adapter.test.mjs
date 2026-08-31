import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createV2HostPort, v2HostCapabilityView } from '../dist/opencode/v2/host-port.js'
import { createV2ChildSessionPort } from '../dist/opencode/v2/child-session-port.js'
import { adaptV2Permissions, normalizeV2Event, v2EventStatus } from '../dist/opencode/v2/lifecycle.js'
import HiV2Server from '../dist/opencode/v2/server.js'
import { isHostUsageObservation } from '../dist/contracts/execution-usage.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
function context(overrides={}){
  const calls=[]
  const ctx={
    location:{directory:'/repo',project:{id:'p1',directory:'/repo',canonical:'/repo'}},
    catalog:{model:{list:async()=>[]}},
    session:{
      create:async input=>{calls.push(['create',input]);return{id:'child-1',location:input.location,time:{created:1}}},
      get:async input=>{calls.push(['get',input]);return{id:input.sessionID,time:{created:1,idle:2}}},
      switchAgent:async input=>{calls.push(['switchAgent',input])},
      switchModel:async input=>{calls.push(['switchModel',input])},
      prompt:async input=>{calls.push(['prompt',input]);return{id:'msg-1'}},
      interrupt:async input=>{calls.push(['interrupt',input]);return{interrupted:true}},
      context:async()=>[],
      hook:async()=>({dispose:async()=>{}}),
    },
    agent:{transform:async()=>({dispose:async()=>{}}),reload:async()=>{}},
    command:{transform:async()=>({dispose:async()=>{}})},
    tool:{transform:async()=>({dispose:async()=>{}}),hook:async()=>({dispose:async()=>{}})},
    event:{subscribe:()=>({async *[Symbol.asyncIterator](){}})},
    ...overrides,
  }
  return{ctx,calls}
}

test('V2 capability discovery is runtime-shape driven and degradation is explicit',()=>{
  const {ctx}=context()
  const view=v2HostCapabilityView(ctx)
  assert.ok(view.contracts.every(x=>x.discovery_source==='RUNTIME_TRUTH'))
  assert.equal(view.workerRuntime,true)
  assert.equal(view.contracts.find(x=>x.id==='worker-runtime')?.status,'SUPPORTED')
  assert.equal(view.contracts.find(x=>x.id==='session-diff')?.status,'DEGRADED')
  assert.equal(view.contracts.find(x=>x.id==='process-lifecycle')?.status,'UNSUPPORTED')
  const source=readFileSync(resolve(root,'plugin/src/opencode/v2/host-port.ts'),'utf8')
  assert.doesNotMatch(source,/version\s*[<>=]|semver|startsWith\(['"]0\.0\.0-beta/i,'V2 capability routing must not be version-string driven')
})

test('V2 child adapter maps canonical child execution to native Promise session primitives',async()=>{
  const {ctx,calls}=context()
  const facts={status:new Map(),eventPumpAbort:new AbortController()}
  const port=createV2ChildSessionPort(ctx,facts)
  const created=await port.create({parentSessionID:'parent-1',title:'worker',role:'coder',model:'provider/model',variant:'fast',workspace:{workspaceID:'ws-1',directory:'/repo-ws'}})
  assert.equal(created.child.id,'child-1')
  assert.equal(calls[0][0],'create')
  assert.deepEqual(calls[0][1].model,{providerID:'provider',id:'model',variant:'fast'})
  assert.equal(calls[0][1].location.workspaceID,'ws-1')
  await port.prompt('child-1','do work','coder','provider/other','precise',{read:true},'msg-user',{type:'text'})
  assert.equal(calls.some(([kind])=>kind==='switchModel'),true)
  assert.equal(calls.some(([kind])=>kind==='switchAgent'),true)
  const prompt=calls.find(([kind])=>kind==='prompt')[1]
  assert.equal(prompt.delivery,'queue')
  assert.equal(prompt.resume,true)
  assert.equal(prompt.text,'do work')
  assert.equal(await port.abort('child-1'),'client')
  await assert.rejects(()=>port.diff('child-1'),/UNSUPPORTED_CAPABILITY/)
})

test('V2 assistant usage normalizes to canonical execution usage without type escape',async()=>{
  const {ctx}=context({session:{...context().ctx.session,context:async()=>[{id:'msg-v2',type:'assistant',model:{providerID:'opencode',id:'mimo-v2.5-free',variant:'low'},cost:0,time:{created:10,completed:20},tokens:{input:100,output:20,reasoning:3,cache:{read:4,write:1}},content:[{type:'text',text:'done'}]}]}})
  const facts={status:new Map(),eventPumpAbort:new AbortController()}
  const result=await createV2HostPort(ctx,facts).readAssistantResult('child-1')
  assert.equal(result.text,'done')
  assert.equal(result.model?.model,'opencode/mimo-v2.5-free')
  assert.equal(isHostUsageObservation(result.usage),true)
  assert.deepEqual(result.usage?.tokens,{input:100,output:20,reasoning:3,cache_read:4,cache_write:1})
  assert.equal(result.usage?.token_source,'opencode-assistant-message')
  assert.equal(result.usage?.coverage,'assistant-message-reported')
  assert.equal(result.usage?.confidence,'exact')
})

test('V2 native session truth overrides stale busy cache for child and host status',async()=>{
  const {ctx,calls}=context()
  const facts={status:new Map([['child-1','busy']]),eventPumpAbort:new AbortController()}
  const child=createV2ChildSessionPort(ctx,facts)
  assert.equal(await child.status('child-1'),'idle')
  assert.equal(facts.status.get('child-1'),'idle')
  assert.ok(calls.some(([kind])=>kind==='get'),'native session.get must be consulted even when cached status is busy')
  facts.status.set('child-1','busy')
  const host=createV2HostPort(ctx,facts)
  assert.equal(await host.sessionStatus('child-1'),'idle')
  assert.equal(facts.status.get('child-1'),'idle')
})

test('V2 event envelopes normalize native data payloads before semantic host events',()=>{
  const idle={id:'evt_1',type:'session.idle',created:1,data:{sessionID:'child-1'}}
  const normalized=normalizeV2Event(idle)
  assert.equal(v2EventStatus(idle),'idle')
  assert.equal(normalized.kind,'session-idle')
  assert.equal(normalized.sessionID,'child-1')
  assert.equal(v2EventStatus({type:'session.status',data:{sessionID:'child-1',status:{type:'busy'}}}),'busy')
})

test('V2 permission projection preserves Hi deny semantics while mapping renamed host actions',()=>{
  const rules=adaptV2Permissions({task:'deny',bash:'ask',read:{'*.env':'deny'}})
  assert.ok(rules.some(x=>x.action==='subagent'&&x.resource==='*'&&x.effect==='deny'))
  assert.ok(rules.some(x=>x.resource==='execute'&&x.effect==='ask'))
  assert.ok(rules.some(x=>x.resource==='bash'&&x.effect==='ask'))
  assert.ok(rules.some(x=>x.action==='*.env'&&x.resource==='read'&&x.effect==='deny'))
})

test('published V2 server entry is a native setup object and remains edge-only',()=>{
  assert.equal(HiV2Server.id,'opencode-hi')
  assert.equal(typeof HiV2Server.setup,'function')
  const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
  assert.equal(pkg.exports['./server'].import,'./plugin/dist/opencode/v2/server.js')
  const source=readFileSync(resolve(root,'plugin/src/opencode/v2/server.ts'),'utf8')
  const lifecycle=readFileSync(resolve(root,'plugin/src/opencode/v2/lifecycle.ts'),'utf8')
  assert.doesNotMatch(source,/MissionStore|TaskRuntime|Scheduler|Evidence|AuthorityStateContract/)
  assert.match(lifecycle,/options:\{codemode:false\}/,'Hi control-plane tools must stay on V2 native direct tool calls so hook identity remains canonical')
  assert.match(lifecycle,/background\.list\(\)\.some\(w=>w\.session_id===sessionID\)/,'V2 child prompts must bypass top-level semantic mission admission just like current/V1')
})
