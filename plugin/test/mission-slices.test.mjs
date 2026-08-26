import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { RuntimePersistence,RUNTIME_STATE_SCHEMA } from '../dist/runtime/state/persistence.js'

const SLICES=['authority','context','continuation','execution','identity','methodology','release','vcs']

test('A3 MissionState persists as exactly eight named slices with no flat compatibility aliases',()=>{
  const m=new MissionStore().start('a3-slices','opaque request')
  assert.deepEqual(Object.keys(m).sort(),SLICES)
  for(const key of SLICES)assert.equal(typeof m[key],'object',key)
  assert.equal(m.identity.session_id,'a3-slices')
  assert.equal(m.continuation.generation,1)
  assert.deepEqual(m.execution.tasks,[])
  assert.deepEqual(m.vcs.changed_files,[])
  assert.equal(Object.prototype.hasOwnProperty.call(m,'mission_id'),false)
  assert.equal(Object.prototype.hasOwnProperty.call(m,'tasks'),false)
  assert.equal(Object.prototype.hasOwnProperty.call(m,'generation'),false)
  assert.equal(Object.prototype.hasOwnProperty.call(m,'release_chain'),false)
})

test('A3 RuntimePersistence round-trips only the nested current schema',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-a3-slices-'))
  try{
    const store=new MissionStore(root),m=store.start('persisted','opaque request')
    const persistence=new RuntimePersistence(root);persistence.save([m],true)
    const raw=JSON.parse(readFileSync(persistence.path,'utf8'))
    assert.equal(RUNTIME_STATE_SCHEMA,10)
    assert.equal(raw.schema,RUNTIME_STATE_SCHEMA)
    assert.deepEqual(Object.keys(raw.missions[0]).sort(),SLICES)
    const loaded=persistence.load();assert.equal(loaded.length,1);assert.equal(loaded[0].identity.session_id,'persisted')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('A3 flat Mission envelope is rejected; schema 7 is not migrated or aliased',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-a3-flat-'))
  try{
    const persistence=new RuntimePersistence(root),now=Date.now()
    mkdirSync(dirname(persistence.path),{recursive:true})
    const flat={mission_id:'m_old',session_id:'s_old',objective:'old flat state',status:'active'}
    writeFileSync(persistence.path,JSON.stringify({schema:RUNTIME_STATE_SCHEMA,updated_at:now,runtime:{boot_id:'old',started_at:now,clean_shutdown:true,last_saved_at:now},missions:[flat]}))
    assert.deepEqual(persistence.load(),[]);assert.match(persistence.lastLoadReport.error,/invalid mission state/)
    writeFileSync(persistence.path,JSON.stringify({schema:7,updated_at:now,runtime:{boot_id:'old',started_at:now,clean_shutdown:true,last_saved_at:now},missions:[]}))
    assert.deepEqual(persistence.load(),[]);assert.match(persistence.lastLoadReport.error,/unsupported runtime-state schema 7/)
  }finally{rmSync(root,{recursive:true,force:true})}
})
