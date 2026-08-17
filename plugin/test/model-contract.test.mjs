import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeModelCapabilityProfile,reconcileModelExecutionIdentity} from '../dist/contracts/model.js'

test('runtime model capability profile normalizes bounded host facts without inventing capability',()=>{
  const p=normalizeModelCapabilityProfile({id:'provider/model-x',provider:'provider',cost:1.5,quality:7,writeCapable:true,tags:['coding','coding'],variants:['high','low']})
  assert.deepEqual(p,{id:'provider/model-x',provider:'provider',cost:1.5,quality:7,writeCapable:true,tags:['coding'],variants:['high','low'],source:'runtime-inventory'})
  assert.equal(p.expectedTurns,undefined)
  assert.equal(p.contextOverhead,undefined)
})

test('model capability profile rejects invalid numeric and quirk facts',()=>{
  assert.throws(()=>normalizeModelCapabilityProfile({id:'x',cost:-1}),/cost/)
  assert.throws(()=>normalizeModelCapabilityProfile({id:'x',expectedTurns:0}),/expectedTurns/)
})

test('model execution identity keeps requested selected projected observed and effective phases distinct',()=>{
  const x=reconcileModelExecutionIdentity({
    requested:{model:'provider/a',variant:'high',source:'task-override'},
    selected:{model:'provider/a',variant:'high',source:'resolver'},
    projected:{model:'provider/a',variant:'high',source:'opencode-child'},
    observed:{model:'provider/a',variant:'high',source:'assistant-metadata'},
  })
  assert.equal(x.status,'verified')
  assert.equal(x.modelVerified,true)
  assert.equal(x.variantVerified,true)
  assert.equal(x.effective?.model,'provider/a')
  assert.equal(x.requested?.source,'task-override')
})

test('model execution identity classifies projection model and variant mismatches separately',()=>{
  assert.equal(reconcileModelExecutionIdentity({selected:{model:'a'},projected:{model:'b'}}).status,'projection-mismatch')
  assert.equal(reconcileModelExecutionIdentity({selected:{model:'a'},observed:{model:'b'}}).status,'model-mismatch')
  assert.equal(reconcileModelExecutionIdentity({selected:{model:'a',variant:'high'},observed:{model:'a'}}).status,'variant-unverified')
  assert.equal(reconcileModelExecutionIdentity({selected:{model:'a',variant:'high'},observed:{model:'a',variant:'low'}}).status,'variant-mismatch')
})

test('host-default remains unconstrained while observed metadata is still recorded',()=>{
  const x=reconcileModelExecutionIdentity({selected:{model:'host-default'},projected:{model:'host-default'},observed:{model:'provider/runtime'}})
  assert.equal(x.status,'host-default-or-unconstrained')
  assert.equal(x.modelVerified,true)
  assert.equal(x.effective?.model,'provider/runtime')
})

test('model capability profile does not create a Hi-owned model-quirk fact surface',()=>{
  const p=normalizeModelCapabilityProfile({id:'provider/mini',quirks:{compactInstructionSensitive:true},quality:3})
  assert.equal('quirks' in p,false)
  assert.equal(p.id,'provider/mini')
})
