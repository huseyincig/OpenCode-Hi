import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProjectIntelligenceRuntime } from '../dist/runtime/project-intelligence/runtime.js'

test('Project Intelligence runtime composes narrow data-class owners without a generic memory store',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-project-intelligence-runtime-'))
  try{
    const runtime=new ProjectIntelligenceRuntime(root)
    assert.equal(runtime.methodologyLearning.projectRoot,root)
    assert.equal(runtime.taskOutcomeMemory.projectRoot,root)
    assert.equal('remember' in runtime,false)
    assert.equal('search' in runtime,false)
    assert.equal('add' in runtime,false)
  } finally { rmSync(root,{recursive:true,force:true}) }
})
