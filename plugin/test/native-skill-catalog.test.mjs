import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {discoverSkills,resolveSkillPlan} from '../dist/runtime/skills/registry.js'
import {HI_METHODOLOGY_LIMITS,HI_METHODOLOGY_POLICY} from '../dist/generated/methodology-policy.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {builtinMethodologyCatalog} from '../dist/runtime/methodology/catalog.js'

const root=join(process.cwd(),'..')
const canonical=JSON.parse(readFileSync(join(root,'data','hi-methodologies.json'),'utf8'))
const canonicalNames=canonical.profiles.map(x=>x.name).sort()

test('packaged native methodology inventory exactly matches the canonical Hi catalog',()=>{
  const dirs=readdirSync(join(root,'skills')).filter(name=>{try{return Boolean(readFileSync(join(root,'skills',name,'SKILL.md'),'utf8'))}catch{return false}}).sort()
  assert.deepEqual(dirs,canonicalNames)
  assert.deepEqual(HI_METHODOLOGY_POLICY.map(x=>x.name).sort(),canonicalNames)
  const found=discoverSkills(root,root).filter(x=>x.provider==='hi'&&x.valid).map(x=>x.name).sort()
  assert.deepEqual(found,canonicalNames)
})

test('retired control-plane concepts are not packaged as methodologies',()=>{
  assert.ok(!canonicalNames.includes('hi-task-classification'))
  assert.ok(!canonicalNames.includes('hi-workspace-isolation'))
  assert.equal(canonicalNames.length,27)
})

test('methodology selection defaults to explicit names and remains hard bounded',()=>{
  const found=discoverSkills(root,root)
  const none=resolveSkillPlan([],found,{},true,'coder')
  assert.deepEqual(none.selected,[])
  const selected=resolveSkillPlan(['hi-test-driven-development','hi-safe-refactoring','hi-dependency-change','hi-ci-build-recovery'],found,{},true,'coder')
  assert.ok(selected.selected.length<=HI_METHODOLOGY_LIMITS.hardMax)
})

test('methodology composition defers unrelated extras beyond typical max',()=>{
  const found=discoverSkills(root,root),catalog=builtinMethodologyCatalog()
  const plan=resolveSkillPlan(['hi-test-driven-development','hi-safe-refactoring'],found,{},true,'coder',catalog)
  assert.deepEqual(plan.selected.map(x=>x.name),['hi-test-driven-development'])
  assert.equal(plan.outcomes.find(x=>x.name==='hi-safe-refactoring')?.outcome,'composition-deferred')
})

test('methodology composition permits an explicit primary coexistence hub up to hard max',()=>{
  const found=discoverSkills(root,root),catalog=builtinMethodologyCatalog()
  const plan=resolveSkillPlan(['hi-test-driven-development','hi-safe-refactoring','hi-test-strategy'],found,{},true,'coder',catalog)
  assert.deepEqual(plan.selected.map(x=>x.name),['hi-test-strategy','hi-test-driven-development','hi-safe-refactoring'])
  assert.equal(plan.selected.length,HI_METHODOLOGY_LIMITS.hardMax)
})

test('Hi methodology documents do not claim control-plane tool ownership',()=>{
  for(const name of canonicalNames){
    const text=readFileSync(join(root,'skills',name,'SKILL.md'),'utf8').toLowerCase()
    for(const token of ['hi_task_start','hi_task_cancel','hi_team_create','hi_direct_progress'])assert.ok(!text.includes(token),`${name}:${token}`)
  }
})


test('native configured Hi skill path does not duplicate the same physical root as a personal provider',()=>{
  const found=discoverSkills(root,root,[join(root,'skills')]).filter(x=>x.name==='hi-test-driven-development')
  assert.equal(found.length,1)
  assert.equal(found[0].provider,'hi')
})


test('incompatible methodology needs cannot consume the executable selection budget',()=>{
  const found=discoverSkills(root,root)
  const plan=resolveSkillPlan(['hi-visual-qa','hi-accessibility-review','hi-browser-testing','hi-test-driven-development'],found,{},true,'coder')
  assert.ok(plan.outcomes.slice(0,3).every(x=>x.outcome==='incompatible'))
  assert.deepEqual(plan.selected.map(x=>x.name),['hi-test-driven-development'])
})


test('every built-in methodology has an activation edge and an executable compatible native role',()=>{
  const found=discoverSkills(root,root),catalog=builtinMethodologyCatalog()
  for(const policy of HI_METHODOLOGY_POLICY){
    assert.ok(policy.activationSignals.length>0,`${policy.name}: activation edge missing`)
    for(const signal of policy.activationSignals)assert.ok(canonical.signal_catalog[signal],`${policy.name}: unknown activation signal ${signal}`)
    assert.ok(policy.compatibleRoles.length>0,`${policy.name}: compatible role missing`)
    const role=policy.preferredRoles[0]??policy.compatibleRoles[0]
    assert.ok(policy.compatibleRoles.includes(role),`${policy.name}: preferred role is not compatible`)
    const agent=PACKAGED_HI_AGENTS[role]
    assert.ok(agent,`${policy.name}: generated role ${role} missing`)
    const permissions=agent.permission?.skill??{}
    const plan=resolveSkillPlan([policy.name],found,permissions,true,role,catalog)
    assert.deepEqual(plan.selected.map(x=>x.name),[policy.name],`${policy.name}: native lazy selection is not executable for ${role}`)
  }
})
