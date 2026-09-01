import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProjectIntelligenceRuntime } from '../dist/runtime/project-intelligence/runtime.js'

test('Project Intelligence runtime composes narrow data-class owners without a generic memory store',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-project-intelligence-runtime-'))
  try{
    const runtime=new ProjectIntelligenceRuntime(root)
    assert.equal(runtime.methodologyLearning.projectRoot,root)
    assert.equal(runtime.taskOutcomeMemory.projectRoot,root)
    assert.equal('remember' in runtime,false)
    assert.equal('search' in runtime,false)
    assert.equal('add' in runtime,false)
    assert.equal((await runtime.projectMemory.recall({query:'anything',max_age_ms:1000,now:10})).status,'DISABLED')
  } finally { rmSync(root,{recursive:true,force:true}) }
})

test('optional project memory provider stays scoped, fresh, bounded and advisory',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-project-memory-provider-')),other=join(root,'other');mkdirSync(other)
  try{
    const now=10_000,provider={id:'test-memory',async recall(request){
      assert.equal(request.project_root,root);assert.equal(request.query,'auth decisions')
      return [
        {id:'ok',project_root:root,content:'Use signed session cookies',observed_at:9_500,source_uri:'memory://decision/ok',tags:['decision'],confidence:.9},
        {id:'stale',project_root:root,content:'Old rule',observed_at:1_000},
        {id:'other',project_root:other,content:'Foreign project fact',observed_at:9_900},
        {id:'expired',project_root:root,content:'Expired fact',observed_at:9_800,expires_at:9_999},
        {id:'future',project_root:root,content:'Future fact',observed_at:10_001},
      ]
    }}
    const runtime=new ProjectIntelligenceRuntime(root,provider),view=await runtime.projectMemory.recall({query:'auth decisions',max_age_ms:2_000,max_items:4,max_chars:500,now})
    assert.equal(view.status,'READY');assert.equal(view.provider_id,'test-memory');assert.deepEqual(view.items.map(x=>x.id),['ok'])
    assert.deepEqual(view.dropped,{invalid:1,cross_project:1,stale:1,expired:1,over_budget:0})
    assert.equal(view.advisory,true);assert.equal(view.evidence_authority,false);assert.equal(view.routing_authority,false);assert.equal(view.completion_authority,false);assert.equal(view.action_authority,false);assert.equal(view.persistence_owner,'provider-or-none')
    assert.equal(runtime.methodologyLearning.projectRoot,root);assert.equal(runtime.taskOutcomeMemory.projectRoot,root)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('project memory provider failure degrades without blocking core runtime',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-project-memory-provider-failure-'))
  try{
    const runtime=new ProjectIntelligenceRuntime(root,{id:'broken',async recall(){throw new Error('provider offline')}})
    const view=await runtime.projectMemory.recall({query:'x',max_age_ms:1000,now:1000})
    assert.equal(view.status,'DEGRADED');assert.equal(view.items.length,0);assert.equal(view.provider_id,'broken')
  }finally{rmSync(root,{recursive:true,force:true})}
})
