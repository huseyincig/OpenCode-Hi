import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ensureProjectRoutingConfig } from '../dist/config/auto-init.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'
import { recommendInitialRoleModels } from '../dist/runtime/routing/model-resolver.js'

function makeProject() { return mkdtempSync(join(tmpdir(), 'hi-routing-defaults-')) }
const ALL_CHILD_ROLES=['coder','architect','repository-explorer','qa-reviewer','security-reviewer','visual-qa']
function cfg(){return structuredClone(DEFAULT_HI_CONFIG)}

test('M16 initial recommendations are derived from effective model scoring, not built-in provider/model IDs', () => {
  const inventory=[
    {id:'alpha/general',provider:'alpha',tags:['balanced','reasoning','coding','high-assurance'],quality:9,cost:.2,visionCapable:false},
    {id:'beta/general',provider:'beta',tags:['balanced','reasoning','coding','high-assurance'],quality:3,cost:.1,visionCapable:false},
    {id:'vision/eye',provider:'vision',tags:['balanced','reasoning','coding','high-assurance'],quality:8,cost:.3,visionCapable:true},
  ]
  const first=recommendInitialRoleModels(inventory,cfg())
  assert.equal(first.coder?.[0],'alpha/general')
  assert.equal(first['qa-reviewer']?.[0],'alpha/general')
  assert.equal(first['visual-qa']?.[0],'vision/eye')
  const changed=inventory.map(model=>model.id==='beta/general'?{...model,quality:30}:model)
  const second=recommendInitialRoleModels(changed,cfg())
  assert.equal(second.coder?.[0],'beta/general')
  assert.equal(second['qa-reviewer']?.[0],'beta/general')
})

test('M16 auto-init refuses to persist a recommendation before effective runtime ranking exists', () => {
  const project=makeProject();try{
    const result=ensureProjectRoutingConfig(project)
    assert.equal(result.created,false)
    assert.equal(result.reason,'runtime-inventory-required-for-initial-recommendation')
    assert.equal(existsSync(result.path),false)
  }finally{rmSync(project,{recursive:true,force:true})}
})

test('M16 auto-init persists runtime-ranked recommendations and leaves ineligible roles adaptive', () => {
  const project=makeProject();try{
    const recommendations={coder:['alpha/general'],'qa-reviewer':['alpha/general'],'visual-qa':['vision/eye']}
    const result=ensureProjectRoutingConfig(project,recommendations)
    assert.equal(result.created,true)
    assert.equal(result.configuredRoles,3)
    const content=JSON.parse(readFileSync(result.path,'utf8'))
    assert.equal(content.schema,1)
    assert.equal(content.type,'hi-routing')
    assert.equal(content.routing.strategy,'cost-quality')
    assert.equal(content.routing.modelPolicy,'recommended')
    assert.deepEqual(content.routing.roleModels,recommendations)
    assert.deepEqual(content.routing.adaptiveRoles,ALL_CHILD_ROLES.filter(x=>!recommendations[x]))
    assert.equal(content.applied_by,'opencode-hi')
  }finally{rmSync(project,{recursive:true,force:true})}
})

test('M16 generated initial recommendations are one-shot and never overwrite later user choices', () => {
  const project=makeProject();try{
    const first=ensureProjectRoutingConfig(project,{coder:['alpha/first']})
    const before=readFileSync(first.path,'utf8')
    const second=ensureProjectRoutingConfig(project,{coder:['beta/later'],'qa-reviewer':['beta/reviewer']})
    assert.equal(first.created,true)
    assert.equal(second.created,false)
    assert.equal(readFileSync(first.path,'utf8'),before)
  }finally{rmSync(project,{recursive:true,force:true})}
})
