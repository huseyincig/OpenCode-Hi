import test from 'node:test'
import assert from 'node:assert/strict'
import { artifactContentHash,isArtifactContract,newArtifactId } from '../dist/contracts/artifact.js'
import { ContextArtifactStore } from '../dist/runtime/context/artifact-store.js'
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

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

test('semantic duplicate artifacts reuse one identity while artifact IDs remain non-content-derived',()=>{
  const s=new ContextArtifactStore(),a=s.add('analysis','same','same',['./src\\a.ts'],{producer:'worker:a',consumerRefs:['task-a']}),b=s.add('analysis','same','same',['src/a.ts'],{producer:'worker:a',consumerRefs:['task-b']})
  assert.equal(a.artifact_id,b.artifact_id)
  assert.equal(a.content_hash,b.content_hash)
  assert.deepEqual(b.provenance.source_files,['src/a.ts'])
  assert.deepEqual(new Set(b.consumer_refs),new Set(['task-a','task-b']))
  assert.notEqual(newArtifactId(),newArtifactId())
})

test('artifact dedupe preserves provenance boundaries and never revives stale observations',()=>{
  const s=new ContextArtifactStore(),a=s.add('analysis','same','same',['src/a.ts'],{producer:'worker:a'}),differentProducer=s.add('analysis','same','same',['src/a.ts'],{producer:'worker:b'}),differentSource=s.add('analysis','same','same',['src/b.ts'],{producer:'worker:a'})
  assert.notEqual(a.artifact_id,differentProducer.artifact_id)
  assert.notEqual(a.artifact_id,differentSource.artifact_id)
  assert.equal(s.invalidateChanged(['./src\\a.ts']),2)
  const fresh=s.add('analysis','same','same',['src/a.ts'],{producer:'worker:a'})
  assert.notEqual(fresh.artifact_id,a.artifact_id,'stale observation must not be silently reused as fresh')
})

test('binary artifact owner projects hash-validated bytes without exposing a storage path',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-artifact-binary-'))
  try{
    const store=new ContextArtifactStore(root),bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]),a=store.addBinary('browser-screenshot','shot',bytes,{extension:'png',mediaType:'image/png'})
    const projected=store.getBinary(a.artifact_id)
    assert.ok(projected)
    assert.equal(projected.mime,'image/png')
    assert.equal(projected.filename,`${a.artifact_id}.png`)
    assert.deepEqual([...projected.bytes],[...bytes])
    assert.equal(Object.hasOwn(projected,'path'),false)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test('binary artifact projection rejects tampered stored bytes',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-artifact-tamper-'))
  try{
    const store=new ContextArtifactStore(root),a=store.addBinary('browser-screenshot','shot',new Uint8Array([1,2,3,4]),{extension:'png',mediaType:'image/png'})
    const first=store.getBinary(a.artifact_id);assert.ok(first)
    writeFileSync(join(root,'.opencode','hi','artifacts','browser-screenshot',`${a.artifact_id}.png`),new Uint8Array([9,9,9,9]))
    assert.equal(store.getBinary(a.artifact_id),undefined)
  } finally {rmSync(root,{recursive:true,force:true})}
})
