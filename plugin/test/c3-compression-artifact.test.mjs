import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,rmSync,readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bindContextReference } from '../dist/contracts/context-reference.js'
import { buildCompressionArtifact,isCompressionArtifact,COMPRESSION_POLICY_VERSION } from '../dist/contracts/compression-artifact.js'
import { ContextArtifactStore } from '../dist/runtime/context/artifact-store.js'
import { durableArtifactPath } from '../dist/runtime/storage/ownership.js'

function ref(overrides={}){
  return bindContextReference({source_ref:'file:src/a.ts',reason:'compression-source',priority:'normal',protection:'COMPRESSIBLE',budget_cost:500,freshness:'FRESH',retention:'mission',privacy_class:'project-private',kind:'analysis',summary:'source summary',content_hash:'a'.repeat(64),...overrides},'mission:c3')
}

test('C3 CompressionArtifact is strict, source/hash aligned and policy/model/scope bound',()=>{
  const source=ref(),artifact=buildCompressionArtifact('a_'+'1'.repeat(24),[source],'bounded summary',{consumerScope:'mission:c3',modelIdentity:'provider/model',createdAt:10})
  assert.equal(isCompressionArtifact(artifact),true)
  assert.deepEqual(Object.keys(artifact),['id','source_context_refs','source_hashes','summary','created_at','freshness','consumer_scope','model_identity','compression_policy_version'])
  assert.deepEqual(artifact.source_context_refs,[source.source_ref]);assert.deepEqual(artifact.source_hashes,[source.content_hash])
  assert.equal(artifact.consumer_scope,'mission:c3');assert.equal(artifact.model_identity,'provider/model');assert.equal(artifact.compression_policy_version,COMPRESSION_POLICY_VERSION)
  assert.equal(isCompressionArtifact({...artifact,extra:true}),false)
})

test('C3 accepts only valid COMPRESSIBLE sources with known freshness and content hashes',()=>{
  for(const protection of ['PROTECTED','PURGEABLE'])assert.throws(()=>buildCompressionArtifact('a_'+'2'.repeat(24),[ref({protection})],'x',{consumerScope:'m',modelIdentity:'p/m'}),/COMPRESSIBLE/)
  assert.throws(()=>buildCompressionArtifact('a_'+'3'.repeat(24),[ref({freshness:'UNKNOWN'})],'x',{consumerScope:'m',modelIdentity:'p/m'}),/UNKNOWN/)
  const invalid={...ref(),content_hash:undefined}
  assert.throws(()=>buildCompressionArtifact('a_'+'4'.repeat(24),[invalid],'x',{consumerScope:'m',modelIdentity:'p/m'}),/valid ContextReference|content hashes/)
})

test('C3 ContextArtifactStore persists compression through the existing ArtifactContract owner and reloads it',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-c3-'))
  try{
    const store=new ContextArtifactStore(root),compression=store.addCompression([ref()],'compressed analysis',{consumerScope:'task:t1',modelIdentity:'p/m'})
    const envelope=store.get(compression.id);assert.ok(envelope)
    assert.equal(envelope.kind,'context-compression');assert.equal(envelope.producer,'hi-context-compression');assert.equal(envelope.artifact_id,compression.id);assert.equal(envelope.freshness,'FRESH')
    assert.deepEqual(envelope.provenance.source_files,['src/a.ts']);assert.deepEqual(envelope.consumer_refs,['task:t1'])
    assert.equal(new ContextArtifactStore(root).getCompression(compression.id)?.summary,'compressed analysis')
    const disk=JSON.parse(readFileSync(durableArtifactPath(root,'context-compression',compression.id),'utf8'));assert.equal(disk.artifact_id,compression.id);assert.equal(disk.kind,'context-compression')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('C3 source invalidation propagates freshness through the compression envelope after restart',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-c3-stale-'))
  try{
    const store=new ContextArtifactStore(root),compression=store.addCompression([ref()],'summary',{consumerScope:'mission:m',modelIdentity:'p/m'})
    assert.equal(store.invalidateChanged(['src/a.ts']),1)
    assert.equal(store.getCompression(compression.id)?.freshness,'POTENTIALLY_STALE')
    assert.equal(new ContextArtifactStore(root).getCompression(compression.id)?.freshness,'POTENTIALLY_STALE')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('C3 compression sourced from a durable Hi artifact inherits its source-file invalidation surface',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-c3-parent-'))
  try{
    const store=new ContextArtifactStore(root),parent=store.add('research','parent','long parent content',['src/a.ts'])
    const source=ref({source_ref:`hi-artifact:${parent.artifact_id}`,content_hash:parent.content_hash,privacy_class:'redacted'})
    const compression=store.addCompression([source],'derived summary',{consumerScope:'task:t1',modelIdentity:'p/m'})
    assert.deepEqual(store.get(compression.id)?.provenance.source_files,['src/a.ts'])
    assert.equal(store.invalidateChanged(['src/a.ts']),2,'parent and derived compression both become stale')
    assert.equal(store.getCompression(compression.id)?.freshness,'POTENTIALLY_STALE')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('C3 compression privacy is monotonic and never widens project-private input to redacted',()=>{
  const store=new ContextArtifactStore()
  const allRedacted=store.addCompression([ref({privacy_class:'redacted'})],'r',{consumerScope:'m',modelIdentity:'p/m'})
  assert.equal(store.get(allRedacted.id)?.privacy_class,'redacted')
  const mixed=store.addCompression([ref({source_ref:'file:src/a.ts',privacy_class:'redacted'}),ref({source_ref:'file:src/b.ts',content_hash:'b'.repeat(64),privacy_class:'project-private'})],'mixed',{consumerScope:'m',modelIdentity:'p/m'})
  assert.equal(store.get(mixed.id)?.privacy_class,'project-private')
})

test('C3 compression implementation remains Context-owned and does not enter Evidence ownership',()=>{
  const contract=readFileSync(new URL('../src/contracts/compression-artifact.ts',import.meta.url),'utf8')
  const store=readFileSync(new URL('../src/runtime/context/artifact-store.ts',import.meta.url),'utf8')
  for(const source of [contract,store])assert.doesNotMatch(source,/addEvidence|EvidenceItem|execution\.evidence|runtime\/evidence|contracts\/evidence/)
  assert.match(store,/addCompression/);assert.match(store,/kind:'context-compression'/)
})
