import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,existsSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {recommendInitialRoleModels} from '../dist/runtime/routing/model-resolver.js'
import {setProjectRoleModels} from '../dist/config/auto-init.js'

function makeProject(){return mkdtempSync(join(tmpdir(),'hi-routing-defaults-'))}
function cfg(){return structuredClone(DEFAULT_HI_CONFIG)}

test('automatic recommendations are capability-driven and invariant to cost/quality metadata',()=>{
  const inventory=[
    {id:'alpha/general',provider:'alpha',tags:['coding','balanced','reasoning','high-assurance'],quality:1,cost:100,visionCapable:false,variants:['high']},
    {id:'beta/general',provider:'beta',tags:['coding','balanced','reasoning'],quality:99,cost:.01,visionCapable:false,variants:['high']},
    {id:'vision/eye',provider:'vision',tags:['coding','reasoning'],quality:1,cost:50,visionCapable:true,variants:['high']},
  ]
  const first=recommendInitialRoleModels(inventory,cfg())
  assert.equal(first.coder?.[0],'alpha/general')
  assert.equal(first['qa-reviewer']?.[0],'alpha/general','high-assurance outranks cost/quality for critical review')
  assert.equal(first['visual-qa']?.[0],'vision/eye')
  const changed=inventory.map(model=>model.id==='beta/general'?{...model,quality:9999,cost:0}:model)
  const second=recommendInitialRoleModels(changed,cfg())
  assert.deepEqual(second,first,'cost/quality changes cannot mutate normal routing preference')
})

test('automatic recommendation preview never creates project state',()=>{
  const project=makeProject();try{
    const path=join(project,'.opencode','hi','policy','routing.json')
    recommendInitialRoleModels([{id:'p/code',provider:'p',tags:['coding']}],cfg())
    assert.equal(existsSync(path),false)
  }finally{rmSync(project,{recursive:true,force:true})}
})

test('only explicit user role persistence creates routing state',()=>{
  const project=makeProject();try{
    const applied=setProjectRoleModels(project,'coder',['p/code','p/fallback','p/code'])
    assert.equal(existsSync(applied.path),true)
    assert.deepEqual(applied.roleModels.coder,['p/code','p/fallback'])
    const doc=JSON.parse(readFileSync(applied.path,'utf8'))
    assert.equal(doc.routing.modelPolicy,'manual')
    assert.deepEqual(doc.routing.roleModels.coder,['p/code','p/fallback'])
    assert.equal(doc.routing.adaptiveRoles.includes('coder'),false)
    setProjectRoleModels(project,'coder',[])
    const cleared=JSON.parse(readFileSync(applied.path,'utf8'))
    assert.equal(cleared.routing.roleModels.coder,undefined)
    assert.equal(cleared.routing.adaptiveRoles.includes('coder'),true)
  }finally{rmSync(project,{recursive:true,force:true})}
})
