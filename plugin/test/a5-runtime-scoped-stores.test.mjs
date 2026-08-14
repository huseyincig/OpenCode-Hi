import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRuntimeScopedStores } from '../dist/runtime/application/runtime-scoped-stores.js'
import { SkillCatalogIndex } from '../dist/runtime/skills/catalog-index.js'

const rootSource=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')

test('A5 runtime-scoped stores are created once by the application composition service',()=>{
  const services=rootSource('runtime/application/runtime-services.ts')
  const scoped=rootSource('runtime/application/runtime-scoped-stores.ts')
  const task=rootSource('runtime/task/task-runtime.ts')
  const result=rootSource('runtime/task/task-result-reconciler.ts')
  const events=rootSource('runtime/application/runtime-event-controller.ts')
  const tools=rootSource('runtime/application/hi-tool-surface.ts')
  assert.match(services,/const scopedStores=createRuntimeScopedStores\(projectRoot,packageRoot\)/)
  assert.match(scoped,/contextArtifacts:new ContextArtifactStore\(projectRoot\)/)
  assert.match(scoped,/projectIntelligence:new ProjectIntelligenceStore\(projectRoot\)/)
  assert.match(scoped,/skillCatalog:new SkillCatalogIndex\(projectRoot,hiRoot\)/)
  assert.doesNotMatch(task,/new ContextArtifactStore|new ProjectIntelligenceStore|discoverSkills\(/)
  assert.match(task,/this\.#scopedStores\.skillCatalog\.candidates\(hostConfig\)/)
  assert.match(task,/this\.#scopedStores\.contextArtifacts/)
  assert.match(task,/this\.#scopedStores\.projectIntelligence/)
  assert.doesNotMatch(result,/new ContextArtifactStore|new ProjectIntelligenceStore/)
  assert.match(result,/this\.scopedStores\.contextArtifacts\.invalidateChanged/)
  assert.match(result,/this\.scopedStores\.projectIntelligence\.invalidateChanged/)
  assert.doesNotMatch(events,/new ContextArtifactStore|new ProjectIntelligenceStore/)
  assert.match(events,/scopedStores\.skillCatalog\.invalidateChanged/)
  assert.doesNotMatch(tools,/new ContextArtifactStore/)
  assert.match(tools,/scopedStores\.contextArtifacts\.add/)
})

test('A5 SkillCatalogIndex reuses discovery until an explicit relevant invalidation',()=>{
  const project=mkdtempSync(join(tmpdir(),'hi-a5-project-'))
  const hiRoot=mkdtempSync(join(tmpdir(),'hi-a5-package-'))
  try{
    const index=new SkillCatalogIndex(project,hiRoot)
    const before=index.candidates({})
    const name='hi-a5-cache-proof',dir=join(hiRoot,'skills',name)
    mkdirSync(dir,{recursive:true})
    writeFileSync(join(dir,'SKILL.md'),`---\nname: ${name}\ndescription: A5 cache proof\n---\nbody\n`)
    assert.equal(before.some(x=>x.name===name),false)
    assert.equal(index.candidates({}).some(x=>x.name===name),false,'no operation-time rescan before invalidation')
    assert.equal(index.invalidateChanged(['src/unrelated.ts']),false)
    assert.equal(index.candidates({}).some(x=>x.name===name),false,'unrelated source mutation does not rescan skills')
    assert.equal(index.invalidateChanged([`skills/${name}/SKILL.md`]),true)
    const refreshed=index.candidates({})
    const hit=refreshed.find(x=>x.name===name)
    assert.ok(hit);assert.equal(hit.provider,'hi');assert.equal(hit.valid,true)
  } finally { rmSync(project,{recursive:true,force:true});rmSync(hiRoot,{recursive:true,force:true}) }
})

test('A5 scoped factory returns stable store identities for one runtime instance',()=>{
  const project=mkdtempSync(join(tmpdir(),'hi-a5-stores-'))
  const hiRoot=mkdtempSync(join(tmpdir(),'hi-a5-hi-'))
  try{
    const stores=createRuntimeScopedStores(project,hiRoot)
    assert.strictEqual(stores.contextArtifacts,stores.contextArtifacts)
    assert.strictEqual(stores.projectIntelligence,stores.projectIntelligence)
    assert.strictEqual(stores.skillCatalog,stores.skillCatalog)
    const artifact=stores.contextArtifacts.add('note','runtime scoped','payload',['src/a.ts'])
    assert.equal(stores.contextArtifacts.get(artifact.artifact_id)?.content,'payload')
    assert.equal(stores.contextArtifacts.invalidateChanged(['src/a.ts']),1)
    assert.equal(stores.contextArtifacts.get(artifact.artifact_id)?.freshness,'POTENTIALLY_STALE')
  } finally { rmSync(project,{recursive:true,force:true});rmSync(hiRoot,{recursive:true,force:true}) }
})
