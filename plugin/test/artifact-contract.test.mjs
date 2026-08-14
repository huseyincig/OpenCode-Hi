import test from 'node:test'
import assert from 'node:assert/strict'
import { artifactContentHash,isArtifactContract,newArtifactId } from '../dist/contracts/artifact.js'
import { ContextArtifactStore } from '../dist/runtime/context/artifact-store.js'

test('ArtifactContract keeps identity, content hash and provenance as distinct fields',()=>{
  const a=new ContextArtifactStore().add('analysis','bounded','body',['src/a.ts'])
  assert.equal(isArtifactContract(a),true)
  assert.match(a.artifact_id,/^a_[a-f0-9]{24}$/)
  assert.equal(a.content_hash,artifactContentHash('body'))
  assert.notEqual(a.artifact_id,a.content_hash)
  assert.deepEqual(a.provenance.source_files,['src/a.ts'])
  assert.equal(a.retention_class,'session')
})

test('ArtifactContract rejects hash drift, unknown fields and malformed provenance',()=>{
  const a=new ContextArtifactStore().add('analysis','bounded','body',['src/a.ts'])
  assert.equal(isArtifactContract({...a,content_hash:'0'.repeat(64)}),false)
  assert.equal(isArtifactContract({...a,provenance:{source_files:[7]}}),false)
  assert.equal(isArtifactContract({...a,unexpected:true}),false)
})

test('artifact IDs do not encode content or provenance and each stored artifact keeps its own identity',()=>{
  const s=new ContextArtifactStore(),a=s.add('analysis','same','same',['src/a.ts']),b=s.add('analysis','same','same',['src/a.ts'])
  assert.notEqual(a.artifact_id,b.artifact_id)
  assert.equal(a.content_hash,b.content_hash)
  assert.notEqual(newArtifactId(),newArtifactId())
})
