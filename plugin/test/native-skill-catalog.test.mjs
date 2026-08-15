import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {discoverSkills,resolveSkillPlan} from '../dist/runtime/skills/registry.js'
import {HI_METHODOLOGY_LIMITS,HI_METHODOLOGY_POLICY} from '../dist/generated/methodology-policy.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {builtinMethodologyCatalog} from '../dist/runtime/methodology/catalog.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const canonical=JSON.parse(readFileSync(join(root,'data','hi-methodologies.json'),'utf8'))
const canonicalNames=canonical.profiles.map(x=>x.name).sort()

test('packaged native methodology inventory exactly matches the canonical Hi catalog',()=>{
  const dirs=readdirSync(join(root,'skills')).filter(name=>{try{return Boolean(readFileSync(join(root,'skills',name,'SKILL.md'),'utf8'))}catch{return false}}).sort()
  assert.deepEqual(dirs,canonicalNames)
  assert.deepEqual(HI_METHODOLOGY_POLICY.map(x=>x.name).sort(),canonicalNames)
  const found=discoverSkills(root,root).filter(x=>x.provider==='hi'&&x.valid).map(x=>x.name).sort()
  assert.deepEqual(found,canonicalNames)
})


test('generated SKILL mechanical contract sections mirror canonical methodology data',()=>{
  const field=(text,label)=>text.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`,'m'))?.[1]?.trim()
  for(const profile of canonical.profiles){
    const text=readFileSync(join(root,'skills',profile.name,'SKILL.md'),'utf8')
    assert.equal(text.match(/^name:\s*(.+)$/m)?.[1]?.trim(),profile.name,`${profile.name}: name projection drift`)
    assert.equal(text.match(/^description:\s*(.+)$/m)?.[1]?.trim(),profile.purpose,`${profile.name}: purpose projection drift`)
    assert.equal(field(text,'Trigger'),profile.trigger,`${profile.name}: trigger projection drift`)
    assert.equal(field(text,'Do not trigger'),profile.do_not_trigger,`${profile.name}: negative-trigger projection drift`)
    assert.equal(field(text,'Exit condition'),profile.exit_condition,`${profile.name}: exit projection drift`)
    assert.equal(field(text,'Role affinity'),profile.role_affinity.join(', '),`${profile.name}: role-affinity projection drift`)
    assert.equal(field(text,'Context cost'),profile.context_cost,`${profile.name}: context-cost projection drift`)
    assert.equal(field(text,'Execution cost'),profile.execution_cost,`${profile.name}: execution-cost projection drift`)
  }
})

test('methodology catalog contains no repeated inert prose relation fields',()=>{
  for(const profile of canonical.profiles){
    assert.equal('escalation_relation' in profile,false,`${profile.name}: inert escalation relation must not be canonical data`)
    assert.equal('verification_relation' in profile,false,`${profile.name}: inert verification relation must not be canonical data`)
  }
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
    const resources=new Set(policy.resourceRequirements)
    const plan=resolveSkillPlan([policy.name],found,permissions,true,role,catalog,resources)
    assert.deepEqual(plan.selected.map(x=>x.name),[policy.name],`${policy.name}: native lazy selection is not executable for ${role} when declared resources are available`)
  }
})
