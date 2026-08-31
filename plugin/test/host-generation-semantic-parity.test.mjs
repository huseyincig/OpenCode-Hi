import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createOpenCodeChildSessionPort} from '../dist/opencode/child-session-port.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {createV2ChildSessionPort} from '../dist/opencode/v2/child-session-port.js'
import {v2HostCapabilityView} from '../dist/opencode/v2/host-port.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

function currentFixture(){
  const calls=[]
  const client={session:{
    create:async input=>{calls.push(['create',input]);return{data:{id:'child-parity'}}},
    promptAsync:async input=>{calls.push(['prompt',input]);return{data:{id:'msg-parity'}}},
    abort:async input=>{calls.push(['abort',input]);return{data:true}},
    status:async()=>({data:{'child-parity':{type:'idle'}}}),
  }}
  return{client,calls,port:createOpenCodeChildSessionPort(client)}
}
function v2Fixture(){
  const calls=[]
  const ctx={
    location:{directory:'/repo',project:{id:'p',directory:'/repo',canonical:'/repo'}},catalog:{model:{list:async()=>[]}},
    session:{
      create:async input=>{calls.push(['create',input]);return{id:'child-parity',location:input.location}},
      prompt:async input=>{calls.push(['prompt',input]);return{id:'msg-parity'}},
      interrupt:async input=>{calls.push(['abort',input]);return{interrupted:true}},
      get:async input=>({id:input.sessionID,time:{created:1,idle:2}}),
      switchAgent:async input=>{calls.push(['switchAgent',input])},switchModel:async input=>{calls.push(['switchModel',input])},
      context:async()=>[],hook:async()=>({dispose:async()=>{}}),
    },agent:{transform:async()=>({dispose:async()=>{}}),reload:async()=>{}},command:{transform:async()=>({dispose:async()=>{}})},tool:{transform:async()=>({dispose:async()=>{}}),hook:async()=>({dispose:async()=>{}})},event:{subscribe:()=>({async *[Symbol.asyncIterator](){}})},
  }
  const facts={status:new Map(),eventPumpAbort:new AbortController()}
  return{ctx,calls,port:createV2ChildSessionPort(ctx,facts)}
}
const request={parentSessionID:'parent',title:'worker',role:'coder',model:'provider/model',variant:'fast'}

async function normalizedLifecycle(port){
  const created=await port.create(request)
  await port.prompt(created.child.id,'do work','coder','provider/model','fast',{read:true},'msg-user',{type:'text'})
  const beforeAbort=await port.status(created.child.id)
  const abort=await port.abort(created.child.id)
  const afterAbort=await port.status(created.child.id)
  return{child:created.child.id,fork:created.fork.used,status_before:beforeAbort,abort:abort==='client'||abort==='server'||abort==='client-reconciled'||abort==='server-reconciled'?'CONFIRMED':'UNAVAILABLE',status_after:afterAbort}
}

test('current/V1 and V2 adapters preserve canonical child lifecycle outcomes for equivalent host capability',async()=>{
  const current=currentFixture(),v2=v2Fixture()
  const a=await normalizedLifecycle(current.port),b=await normalizedLifecycle(v2.port)
  assert.deepEqual(a,b)
  assert.equal(a.child,'child-parity');assert.equal(a.status_before,'idle');assert.equal(a.abort,'CONFIRMED');assert.equal(a.status_after,'idle')
  assert.ok(current.calls.some(([k])=>k==='prompt'));assert.ok(v2.calls.some(([k])=>k==='prompt'))
})

test('current/V1 and V2 capability views agree on semantic support where primitives are equivalent and expose differences explicitly',()=>{
  const current=currentFixture(),v2=v2Fixture()
  const a=detectOpenCodeCapabilities(current.client),b=v2HostCapabilityView(v2.ctx)
  for(const id of ['child-session-create','session-prompt','session-abort','worker-runtime']){
    assert.equal(a.contracts.find(x=>x.id===id)?.status,'SUPPORTED',`current ${id}`)
    assert.equal(b.contracts.find(x=>x.id===id)?.status,'SUPPORTED',`v2 ${id}`)
  }
  assert.equal(a.contracts.find(x=>x.id==='session-diff')?.status,'DEGRADED')
  assert.equal(b.contracts.find(x=>x.id==='session-diff')?.status,'DEGRADED')
  assert.ok([...a.contracts,...b.contracts].every(x=>x.discovery_source==='RUNTIME_TRUTH'))
})

const semanticProofs={
  'simple mission':['user-journey-acceptance.test.mjs','small task stays single/minimal'],
  'child execution':['host-port-boundary.test.mjs','alternate host child-session port can execute'],
  'task dependency':['dependency-outcome-projection.test.mjs','queued successor receives dependency result'],
  'parallel read-only workers':['scheduler-lifecycle.test.mjs','read-only unknown surfaces may still fan out'],
  'conflicting writers':['runtime-write-conflict.test.mjs','runtime-discovered overlapping writes quarantine'],
  'model fallback':['provider-fallback-hardening.test.mjs','provider failure creates a fresh child'],
  'provider failure':['runtime-invariants.test.mjs','provider failure is isolated from stagnation'],
  'usage observation':['execution-usage-economics.test.mjs','worker usage observation is exact-attempt bound'],
  'authority request':['critical-invariant-guards.test.mjs','authority approval is bound to the exact action hash'],
  'human decision fallback':['structured-human-decision-host.test.mjs','structured host UI remains unsupported'],
  'cancellation':['task-runtime-scheduler-cutover.test.mjs','cancellation releases the exact scheduler reservation'],
  'restart recovery':['user-journey-acceptance.test.mjs','restart journey reconciles in-flight worker'],
  'continuation':['host-port-boundary.test.mjs','alternate host continuation port preserves Mission continuation'],
  'completion verification':['verification-envelope-contract.test.mjs','VerificationEnvelope derives a passed check'],
  'unsupported capability':['user-journey-acceptance.test.mjs','unsupported journey is truthful'],
  'degraded capability':['host-capability-contract.test.mjs','degraded capability contracts always name fallback'],
  'browser':['browser-feedback-loop.test.mjs','browser finding transfers source remediation'],
  'process':['process-control-integration.test.mjs','task start preflights unavailable process lifecycle'],
  'workspace isolation':['workspace-real-host-acceptance.test.mjs','workspace runtime contract requires live observation'],
  'session history/compaction':['compaction-recovery-governor.test.mjs','compaction preserves semantic recovery anti-replay history'],
}

test('Phase08 mandatory semantic parity scenario catalog is complete and every scenario is bound to executable proof',()=>{
  assert.equal(Object.keys(semanticProofs).length,20)
  for(const [scenario,[file,needle]] of Object.entries(semanticProofs)){
    const path=resolve(root,'plugin/test',file)
    assert.equal(existsSync(path),true,`${scenario}: missing ${file}`)
    assert.match(readFileSync(path,'utf8'),new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),`${scenario}: proof needle missing`)
  }
})
