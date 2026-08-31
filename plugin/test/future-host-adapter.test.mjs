import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createAlienFutureRuntime,createFutureAdapter} from './helpers/future-host-adapter.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

test('synthetic future generation with alien host vocabulary satisfies canonical child lifecycle without core semantics',async()=>{
  const raw=createAlienFutureRuntime(),{child}=createFutureAdapter(raw)
  const created=await child.create({parentSessionID:'parent',title:'future work',role:'coder',model:'future-provider/future-model'})
  assert.match(created.child.id,/^unit:/);assert.equal(created.fork.used,false)
  await child.prompt(created.child.id,'implement')
  assert.equal(await child.status(created.child.id),'idle')
  assert.equal(await child.abort(created.child.id),'client')
  assert.equal(await child.status(created.child.id),'idle')
})

test('future adapter normalizes alien usage/model shapes and never leaks them into canonical output',async()=>{
  const raw=createAlienFutureRuntime(),{child,host}=createFutureAdapter(raw)
  const created=await child.create({parentSessionID:'p',title:'x',role:'coder'});await child.prompt(created.child.id,'x')
  const result=await host.readAssistantResult(created.child.id)
  assert.equal(result.model.model,'future-provider/future-model')
  assert.deepEqual(result.usage.tokens,{input:11,output:3,reasoning:1,cache_read:2,cache_write:0})
  assert.equal(result.usage.monetary.usd,0.000025)
  assert.equal(host.getModels()[0].id,'future-provider/future-model');assert.equal(host.getModels()[0].visionCapable,true)
  assert.equal(JSON.stringify(result).includes('inTokens'),false)
})

test('future capabilities explicitly separate full degraded and unsupported states',()=>{
  const {contracts}=createFutureAdapter(createAlienFutureRuntime())
  const by=id=>contracts.find(x=>x.id===id)
  assert.equal(by('worker-runtime').status,'SUPPORTED')
  assert.equal(by('session-diff').status,'DEGRADED');assert.match(by('session-diff').fallback,/changed-file/);assert.ok(by('session-diff').semantic_loss.length)
  assert.equal(by('structured-human-decision-transport').status,'UNSUPPORTED')
  assert.equal(by('browser-execution').status,'UNSUPPORTED')
  assert.equal(by('process-lifecycle').status,'DEGRADED')
  assert.ok(contracts.every(x=>x.discovery_source==='RUNTIME_TRUTH'))
})

test('future host lifecycle naming is alien and adapter owns translation rather than canonical core',()=>{
  const source=readFileSync(resolve(root,'plugin/test/helpers/future-host-adapter.mjs'),'utf8')
  for(const alien of ['launchUnit','enqueueWork','haltUnit','inspectUnit','unit.quiet','inTokens'])assert.match(source,new RegExp(alien.replace('.','\\.')))
  assert.doesNotMatch(source,/MissionStore|TaskRuntime|Scheduler|EvidenceRuntime|AuthorityStateContract|RecoveryGovernor/)
})
