import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {discoverSkills,resolveSkillPlan} from '../dist/runtime/skills/registry.js'

const root=join(process.cwd(),'..')
const expectedNew=['hhc-source-driven-development','hhc-test-driven-development','hhc-review-feedback','hhc-architecture-decisions','hhc-iterative-retrieval','hhc-design-discovery','hhc-api-interface-design','hhc-workspace-isolation','hhc-skill-authoring','hhc-adversarial-validation']

test('HHC ships exactly 29 native methodology skills and all new candidates are valid',()=>{
  const dirs=readdirSync(join(root,'skills')).filter(n=>{try{return Boolean(readFileSync(join(root,'skills',n,'SKILL.md'),'utf8'))}catch{return false}}).sort()
  assert.equal(dirs.length,29)
  for(const name of expectedNew)assert.ok(dirs.includes(name),name)
  const found=discoverSkills(root,root).filter(x=>x.provider==='hhc')
  assert.equal(found.filter(x=>x.valid).length,29)
})

test('skill default remains zero for ordinary implementation capability',()=>{
  const found=discoverSkills(root,root)
  const plan=resolveSkillPlan(['implementation'],found,{},true,'coder')
  assert.deepEqual(plan.selected,[])
  assert.match(plan.reason.join(' '),/skills=0/)
})

test('new HHC methodologies route selectively and stay bounded to max three',()=>{
  const found=discoverSkills(root,root)
  const tdd=resolveSkillPlan(['tdd-required'],found,{},true,'coder')
  assert.deepEqual(tdd.selected.map(x=>x.name),['hhc-test-driven-development'])
  const source=resolveSkillPlan(['source-verification'],found,{},true,'coder')
  assert.deepEqual(source.selected.map(x=>x.name),['hhc-source-driven-development'])
  const design=resolveSkillPlan(['design-exploration','implementation-planning','api-interface-design','critical-validation'],found,{},true,'architect')
  assert.ok(design.selected.length<=3)
  assert.ok(design.selected.some(x=>x.name==='hhc-design-discovery'))
  assert.ok(design.selected.some(x=>x.name==='hhc-architecture-decisions'))
})

test('HHC-native skill documents remain methodology-only and contain no HHC control-plane API ownership',()=>{
  for(const name of expectedNew){const text=readFileSync(join(root,'skills',name,'SKILL.md'),'utf8').toLowerCase();for(const token of ['hhc_task_start','hhc_task_cancel','hhc_team_create','hhc_direct_progress'])assert.ok(!text.includes(token),`${name}:${token}`)}
})
