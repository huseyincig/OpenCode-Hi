import test from 'node:test'
import assert from 'node:assert/strict'
import { isProjectIntelligenceContract } from '../dist/contracts/project-intelligence.js'
import { ProjectIntelligenceStore } from '../dist/runtime/project-intelligence/store.js'

const item={id:'pi-errors',statement:'Errors use ResultEnvelope',source_refs:[{ref:'file:src/errors.ts',hash:'a'.repeat(64)}],confidence:.9,freshness:'FRESH',lifecycle:'ACTIVE',consumer_domains:['task-context'],updated_at:1}

test('ProjectIntelligenceContract keeps source provenance, freshness and consumer domain explicit',()=>{
  assert.equal(isProjectIntelligenceContract(item),true)
  const store=new ProjectIntelligenceStore();store.upsert(item)
  assert.deepEqual(store.relevantToFiles(['src/errors.ts'],'task-context').map(x=>x.id),['pi-errors'])
})

test('ProjectIntelligenceContract rejects unsafe refs, invalid hashes/confidence, duplicate sources and unknown fields',()=>{
  assert.equal(isProjectIntelligenceContract({...item,source_refs:[{ref:'file:../secret',hash:'a'.repeat(64)}]}),false)
  assert.equal(isProjectIntelligenceContract({...item,source_refs:[{ref:'file:src/errors.ts',hash:'old'}]}),false)
  assert.equal(isProjectIntelligenceContract({...item,confidence:1.1}),false)
  assert.equal(isProjectIntelligenceContract({...item,source_refs:[...item.source_refs,...item.source_refs]}),false)
  assert.equal(isProjectIntelligenceContract({...item,unexpected:true}),false)
  assert.throws(()=>new ProjectIntelligenceStore().upsert({...item,confidence:-1}),/Invalid ProjectIntelligenceContract/)
})

test('Project Intelligence is excluded from task context when stale, retired, unrelated or consumer-ineligible',()=>{
  const store=new ProjectIntelligenceStore();store.upsert(item)
  store.upsert({...item,id:'pi-other',source_refs:[{ref:'file:src/other.ts',hash:'b'.repeat(64)}]})
  store.upsert({...item,id:'pi-stale',freshness:'POTENTIALLY_STALE'})
  store.upsert({...item,id:'pi-archived',lifecycle:'ARCHIVED'})
  assert.deepEqual(store.relevantToFiles(['src/errors.ts'],'task-context').map(x=>x.id),['pi-errors'])
})

test('source hash drift invalidates Project Intelligence without converting it into Evidence',()=>{
  const store=new ProjectIntelligenceStore();store.upsert(item)
  assert.deepEqual(store.invalidateChanged([],{['src/errors.ts']:'b'.repeat(64)}),['pi-errors'])
  assert.equal(store.get('pi-errors').freshness,'POTENTIALLY_STALE')
  assert.equal('evidence' in store.get('pi-errors'),false)
})
