import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync,mkdtempSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STORAGE_OWNERSHIP_CATALOG,assertStorageOwnershipCatalog,isStorageOwnershipContract } from '../dist/contracts/storage-ownership.js'
import { durableArtifactPath,projectIntelligencePath,projectMethodologyCandidatePath,projectMethodologyPolicyPath,projectMethodologyProvenancePath,projectPolicyPath,projectSkillRoot } from '../dist/runtime/storage/ownership.js'
import { runtimeStatePath } from '../dist/runtime/storage/locations.js'
import { RuntimePersistence,RUNTIME_STATE_SCHEMA } from '../dist/runtime/state/persistence.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { inspectProject } from '../dist/doctor/project-inspection.js'

const byClass=name=>STORAGE_OWNERSHIP_CATALOG.find(x=>x.data_class===name)

test('StorageOwnership catalog is strict and has one canonical owner per scope/data class',()=>{
  assertStorageOwnershipCatalog(STORAGE_OWNERSHIP_CATALOG)
  assert.ok(STORAGE_OWNERSHIP_CATALOG.every(isStorageOwnershipContract))
  const duplicate={...STORAGE_OWNERSHIP_CATALOG[0]}
  assert.throws(()=>assertStorageOwnershipCatalog([...STORAGE_OWNERSHIP_CATALOG,duplicate]),/Duplicate canonical storage owner/)
  assert.equal(isStorageOwnershipContract({...duplicate,unknown:true}),false)
})

test('catalog path providers match the real project storage resolvers',()=>{
  const root=join(tmpdir(),'project-root'),name='hi-project-check'
  assert.equal(projectPolicyPath(root,'routing'),join(root,'.opencode','hi','policy','routing.json'))
  assert.equal(projectPolicyPath(root,'authority'),join(root,'.opencode','hi','policy','authority.json'))
  assert.equal(projectIntelligencePath(root,'pi_1'),join(root,'.opencode','hi','project-intelligence','patterns','pi_1.json'))
  assert.equal(projectMethodologyCandidatePath(root,'mc_1'),join(root,'.opencode','hi','project-intelligence','methodology-candidates','mc_1.json'))
  assert.equal(durableArtifactPath(root,'review','a_1'),join(root,'.opencode','hi','artifacts','review','a_1.json'))
  assert.equal(projectMethodologyPolicyPath(root,name),join(root,'.opencode','hi','policy','methodologies',`${name}.json`))
  assert.equal(projectMethodologyProvenancePath(root,name),join(root,'.opencode','hi','provenance','methodologies',`${name}.json`))
  assert.equal(projectSkillRoot(root,name),join(root,'.opencode','skills',name))
  assert.equal(projectSkillRoot(root,name).includes(join('.opencode','hi')),false)
  assert.throws(()=>projectSkillRoot(root,'../escape'),/Unsafe storage segment/)
})

test('catalog keeps host-native project skills outside Hi internal storage and runtime state outside the project',()=>{
  assert.equal(byClass('project-methodology-skill').canonical_owner,'OpenCode-project-skill')
  assert.match(byClass('project-methodology-skill').path_provider,/\.opencode\/skills\/hi-project-/)
  assert.doesNotMatch(byClass('project-methodology-skill').path_provider,/\.opencode\/hi/)
  assert.equal(byClass('mission-survival-state').scope,'runtime')
  const root=mkdtempSync(join(tmpdir(),'hi-storage-runtime-'))
  try{assert.equal(runtimeStatePath(root).startsWith(root),false)}finally{rmSync(root,{recursive:true,force:true})}
})

test('doctor consumes the canonical current runtime schema instead of a stale literal',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-storage-doctor-'))
  try{
    const store=new MissionStore(root),state=new RuntimePersistence(root);state.save([store.start('s-storage','storage audit')],true)
    assert.equal(JSON.parse(readFileSync(state.path,'utf8')).schema,RUNTIME_STATE_SCHEMA)
    const inspected=inspectProject(root)
    assert.equal(inspected.runtimeState,'healthy');assert.equal(inspected.runtimeSchema,RUNTIME_STATE_SCHEMA);assert.equal(inspected.runtimeSchemaValid,true);assert.equal(existsSync(state.path),true)
  }finally{rmSync(root,{recursive:true,force:true})}
})
