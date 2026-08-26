import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRuntimeScopedStores } from '../dist/runtime/application/runtime-scoped-stores.js'

const rootSource=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')

test('runtime-scoped stores are created once by the application composition service',()=>{
  const services=rootSource('runtime/application/runtime-services.ts')
  const scoped=rootSource('runtime/application/runtime-scoped-stores.ts')
  const task=rootSource('runtime/task/task-runtime.ts')
  const result=rootSource('runtime/task/task-result-reconciler.ts')
  const events=rootSource('runtime/application/runtime-event-controller.ts')
  const tools=rootSource('runtime/application/hi-tool-surface.ts')
  assert.match(services,/const scopedStores=createRuntimeScopedStores\(projectRoot,packageRoot\)/)
  assert.match(scoped,/contextArtifacts:new ContextArtifactStore\(projectRoot\)/)
  assert.match(scoped,/taskOutcomeMemory:new ProjectTaskOutcomeMemoryStore\(projectRoot\)/)
  assert.doesNotMatch(task,/new ContextArtifactStore|new ProjectTaskOutcomeMemoryStore|discoverSkills\(|SkillCatalogIndex/)
  assert.match(task,/methodologySkillCandidates\(/)
  assert.match(task,/this\.#scopedStores\.contextArtifacts/)
  assert.doesNotMatch(result,/new ContextArtifactStore|new ProjectTaskOutcomeMemoryStore/)
  assert.match(result,/this\.scopedStores\.contextArtifacts\.invalidateChanged/)
  assert.doesNotMatch(events,/new ContextArtifactStore/)
  assert.doesNotMatch(tools,/new ContextArtifactStore/)
  assert.match(tools,/scopedStores\.contextArtifacts\.add/)
})

test('scoped factory returns stable store identities for one runtime instance',()=>{
  const project=mkdtempSync(join(tmpdir(),'hi-a5-stores-'))
  const hiRoot=mkdtempSync(join(tmpdir(),'hi-a5-hi-'))
  try{
    const stores=createRuntimeScopedStores(project,hiRoot)
    assert.strictEqual(stores.contextArtifacts,stores.contextArtifacts)
    assert.strictEqual(stores.taskOutcomeMemory,stores.taskOutcomeMemory)
    const artifact=stores.contextArtifacts.add('note','runtime scoped','payload',['src/a.ts'])
    assert.equal(stores.contextArtifacts.get(artifact.artifact_id)?.content,'payload')
    assert.equal(stores.contextArtifacts.invalidateChanged(['src/a.ts']),1)
    assert.equal(stores.contextArtifacts.get(artifact.artifact_id)?.freshness,'POTENTIALLY_STALE')
  } finally { rmSync(project,{recursive:true,force:true});rmSync(hiRoot,{recursive:true,force:true}) }
})
