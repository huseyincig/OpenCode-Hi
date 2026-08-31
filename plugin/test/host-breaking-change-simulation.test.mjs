import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createOpenCodeChildSessionPort} from '../dist/opencode/child-session-port.js'
import {createV2HostPort,v2HostCapabilityView} from '../dist/opencode/v2/host-port.js'
import {normalizeV2Event} from '../dist/opencode/v2/lifecycle.js'
import {lastAssistantUsage} from '../dist/opencode/client-adapter.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

function renamedSessionHost(){
  const native={
    startChild:async input=>({id:'renamed-child',parent:input.parent}),
    send:async()=>({accepted:true}),
    stop:async()=>({stopped:true}),
    inspect:async id=>({id,state:'idle'}),
  }
  // This is intentionally edge-only compatibility mapping. Canonical child port does not know renamed primitives.
  const client={session:{
    create:async ({body})=>({data:await native.startChild({parent:body.parentID})}),
    promptAsync:async input=>({data:await native.send(input)}),
    abort:async input=>({data:await native.stop(input)}),
    status:async()=>({data:{'renamed-child':{type:'idle'}}}),
  }}
  return{native,client}
}

test('renamed session primitives require only edge mapping and preserve canonical child semantics',async()=>{
  const {client}=renamedSessionHost(),port=createOpenCodeChildSessionPort(client)
  const created=await port.create({parentSessionID:'p',title:'x',role:'coder'})
  assert.equal(created.child.id,'renamed-child')
  await port.prompt(created.child.id,'work','coder')
  assert.equal(await port.status(created.child.id),'idle')
  assert.match(await port.abort(created.child.id),/client|server/)
})

test('removed child/background primitives degrade explicitly instead of mutating core behavior',()=>{
  const ctx={location:{directory:'/r',project:{}},catalog:{model:{list:async()=>[]}},session:{get:async()=>({}),context:async()=>[],hook:async()=>({dispose:async()=>{}})},agent:{transform:async()=>({dispose:async()=>{}})},command:{transform:async()=>({dispose:async()=>{}})},tool:{transform:async()=>({dispose:async()=>{}}),hook:async()=>({dispose:async()=>{}})},event:{subscribe:()=>({async *[Symbol.asyncIterator](){}})}}
  const view=v2HostCapabilityView(ctx)
  assert.equal(view.contracts.find(x=>x.id==='child-session-create')?.status,'UNSUPPORTED')
  assert.equal(view.contracts.find(x=>x.id==='worker-runtime')?.status,'UNSUPPORTED')
})

test('changed usage payload tolerates unknown fields but never fabricates missing exact token fields',()=>{
  const complete=lastAssistantUsage([{info:{id:'m',role:'assistant',providerID:'p',modelID:'m',tokens:{input:5,output:2,reasoning:1,cache:{read:0,write:0},future_extra:999},future_field:'ignored'},parts:[]}])
  assert.deepEqual(complete.tokens,{input:5,output:2,reasoning:1,cache_read:0,cache_write:0})
  const partial=lastAssistantUsage([{info:{id:'m',role:'assistant',providerID:'p',modelID:'m',tokens:{input:5,output:2}},parts:[]}])
  assert.equal(partial,undefined)
})

test('changed V2 model inventory tolerates unknown fields while preserving canonical identity',async()=>{
  const ctx={location:{directory:'/r',project:{}},catalog:{model:{list:async()=>[{providerID:'p',id:'m',renamed_future_field:{x:1},capabilities:{input:['text','image']}}]}},session:{create:async()=>({id:'c'}),prompt:async()=>({}),interrupt:async()=>({}),get:async()=>({time:{idle:1}}),context:async()=>[],hook:async()=>({dispose:async()=>{}})},agent:{transform:async()=>({dispose:async()=>{}})},command:{transform:async()=>({dispose:async()=>{}})},tool:{transform:async()=>({dispose:async()=>{}}),hook:async()=>({dispose:async()=>{}})},event:{subscribe:()=>({async *[Symbol.asyncIterator](){}})}}
  const facts={status:new Map(),eventPumpAbort:new AbortController()},host=createV2HostPort(ctx,facts)
  await host.refreshRuntimeInventory('mutation')
  const models=host.getModels()
  assert.equal(models[0]?.id,'p/m');assert.equal(models[0]?.visionCapable,true)
})

test('changed event envelope/order normalizes at V2 edge and duplicate/extra fields stay non-semantic',()=>{
  const a=normalizeV2Event({type:'session.status',data:{sessionID:'s',status:{type:'busy'},unknown:'x'}})
  const b=normalizeV2Event({type:'session.status',data:{unknown:'y',status:{type:'busy'},sessionID:'s'}})
  assert.equal(a.sessionID,'s');assert.equal(a.status,'busy')
  assert.equal(b.sessionID,'s');assert.equal(b.status,'busy')
})

test('missing permission/question surfaces remain explicit unsupported rather than synthesized support',()=>{
  const ctx={location:{directory:'/r',project:{}},catalog:{model:{list:async()=>[]}},session:{create:async()=>({id:'c'}),prompt:async()=>({}),interrupt:async()=>({}),get:async()=>({}),context:async()=>[],hook:async()=>({dispose:async()=>{}})},agent:{transform:async()=>({dispose:async()=>{}})},command:{transform:async()=>({dispose:async()=>{}})},tool:{transform:async()=>({dispose:async()=>{}}),hook:async()=>({dispose:async()=>{}})},event:{subscribe:()=>({async *[Symbol.asyncIterator](){}})}}
  const view=v2HostCapabilityView(ctx)
  assert.equal(view.contracts.find(x=>x.id==='structured-human-decision-transport')?.status,'UNSUPPORTED')
})

test('host-generation implementation remains edge-isolated: canonical core never imports V2/current adapters',()=>{
  const coreFiles=[
    'plugin/src/runtime/mission/mission-store.ts','plugin/src/runtime/task/task-runtime.ts',
    'plugin/src/runtime/scheduler/planner.ts','plugin/src/runtime/evidence/evidence-runtime.ts',
    'plugin/src/runtime/continuation/recovery-governor.ts','plugin/src/runtime/routing/model-resolver.ts',
    'plugin/src/runtime/safety/authority.ts'
  ]
  for(const file of coreFiles){
    const source=readFileSync(resolve(root,file),'utf8')
    assert.doesNotMatch(source,/from ['"][^'"]*opencode(?:\/v2)?\//,file)
    assert.doesNotMatch(source,/@opencode-ai\//,file)
  }
})
