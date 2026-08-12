import test from 'node:test'
import assert from 'node:assert/strict'
import { PACKAGED_HHC_AGENTS } from '../dist/generated/agent-config.js'
import { discoverSkills,resolveSkillPlan } from '../dist/runtime/skills/registry.js'

const root=new URL('../../',import.meta.url).pathname.replace(/\/$/,'')
const matrix={
  'working-manager':['hhc-task-classification','hhc-release-guardrails','hhc-test-strategy','hhc-changelog-and-documentation','hhc-safe-refactoring'],
  manager:['hhc-task-classification','hhc-release-guardrails'],
  coder:['hhc-debugging-root-cause','hhc-test-driven-development','hhc-implementation-planning','hhc-test-strategy','hhc-changelog-and-documentation','hhc-safe-refactoring','hhc-database-migration','hhc-dependency-change','hhc-api-contract-review','hhc-api-interface-design','hhc-ci-build-recovery','hhc-performance-analysis','hhc-release-guardrails','hhc-source-driven-development','hhc-review-feedback','hhc-workspace-isolation','hhc-skill-authoring','hhc-adversarial-validation'],
  architect:['hhc-design-discovery','hhc-architecture-decisions','hhc-implementation-planning','hhc-iterative-retrieval','hhc-repository-analysis','hhc-api-interface-design','hhc-source-driven-development','hhc-adversarial-validation'],
  'repository-explorer':['hhc-repository-analysis','hhc-iterative-retrieval','hhc-source-driven-development'],
  'qa-reviewer':['hhc-code-review','hhc-regression-review','hhc-test-strategy','hhc-review-feedback','hhc-adversarial-validation'],
  'security-reviewer':['hhc-security-review','hhc-code-review','hhc-review-feedback','hhc-adversarial-validation','hhc-dependency-change'],
  'visual-qa':['hhc-visual-qa','hhc-accessibility-review','hhc-browser-testing','hhc-design-discovery'],
}
const capabilities={
  coder:['debugging','tdd-required','implementation-planning','verification','docs-change','refactor','database-migration','dependency-change','api-contract','api-interface-design','ci-recovery','performance-analysis','release-guardrails','source-verification','review-feedback','workspace-isolation','skill-authoring','critical-validation'],
  architect:['design-exploration','implementation-planning','repository-analysis','api-contract','api-interface-design','source-verification','critical-validation'],
  'repository-explorer':['repository-analysis','source-verification'],
  'qa-reviewer':['review','verification','review-feedback','critical-validation','regression-review'],
  'security-reviewer':['security-review','review','review-feedback','critical-validation','dependency-change'],
  'visual-qa':['visual-qa','accessibility','browser-testing','design-exploration'],
}

test('packaged role skill permissions exactly match the v46 HHC-native role matrix',()=>{
  for(const [role,expected] of Object.entries(matrix)){
    const skill=PACKAGED_HHC_AGENTS[role].permission.skill
    assert.equal(skill['*'],'deny',`${role} must default-deny skills`)
    const allowed=Object.entries(skill).filter(([name,value])=>name!=='*'&&value==='allow').map(([name])=>name).sort()
    assert.deepEqual(allowed,[...expected].sort(),role)
    assert.ok(allowed.every(name=>name.startsWith('hhc-')),`${role} contains non-HHC skill permission`)
  }
})

test('every skill the runtime router can select for a specialist is native-permission allowed',()=>{
  const found=discoverSkills(root,root)
  for(const [role,caps] of Object.entries(capabilities)){
    const permission=PACKAGED_HHC_AGENTS[role].permission.skill
    for(const cap of caps){
      const plan=resolveSkillPlan([cap],found,permission,true,role)
      for(const name of plan.requested)assert.equal(permission[name],'allow',`${role}:${cap}:${name}`)
      assert.deepEqual(plan.missing,[],`${role}:${cap} should not be denied/missing`)
    }
  }
})

test('all 29 shipped HHC-native skills are reachable by at least one role permission surface',()=>{
  const union=new Set(Object.values(matrix).flat())
  assert.equal(union.size,29)
  const found=discoverSkills(root,root).filter(x=>x.provider==='hhc'&&x.valid).map(x=>x.name).sort()
  assert.deepEqual([...union].sort(),found)
})
