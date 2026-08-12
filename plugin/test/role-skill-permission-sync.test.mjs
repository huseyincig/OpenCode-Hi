import test from 'node:test'
import assert from 'node:assert/strict'
import { PACKAGED_HI_AGENTS } from '../dist/generated/agent-config.js'
import { discoverSkills,resolveSkillPlan } from '../dist/runtime/skills/registry.js'

const root=new URL('../../',import.meta.url).pathname.replace(/\/$/,'')
const matrix={
  'working-manager':['hi-task-classification','hi-release-guardrails','hi-test-strategy','hi-changelog-and-documentation','hi-safe-refactoring'],
  manager:['hi-task-classification','hi-release-guardrails'],
  coder:['hi-debugging-root-cause','hi-test-driven-development','hi-implementation-planning','hi-test-strategy','hi-changelog-and-documentation','hi-safe-refactoring','hi-database-migration','hi-dependency-change','hi-api-contract-review','hi-api-interface-design','hi-ci-build-recovery','hi-performance-analysis','hi-release-guardrails','hi-source-driven-development','hi-review-feedback','hi-workspace-isolation','hi-skill-authoring','hi-adversarial-validation'],
  architect:['hi-design-discovery','hi-architecture-decisions','hi-implementation-planning','hi-iterative-retrieval','hi-repository-analysis','hi-api-interface-design','hi-source-driven-development','hi-adversarial-validation'],
  'repository-explorer':['hi-repository-analysis','hi-iterative-retrieval','hi-source-driven-development'],
  'qa-reviewer':['hi-code-review','hi-regression-review','hi-test-strategy','hi-review-feedback','hi-adversarial-validation'],
  'security-reviewer':['hi-security-review','hi-code-review','hi-review-feedback','hi-adversarial-validation','hi-dependency-change'],
  'visual-qa':['hi-visual-qa','hi-accessibility-review','hi-browser-testing','hi-design-discovery'],
}
const capabilities={
  coder:['debugging','tdd-required','implementation-planning','verification','docs-change','refactor','database-migration','dependency-change','api-contract','api-interface-design','ci-recovery','performance-analysis','release-guardrails','source-verification','review-feedback','workspace-isolation','skill-authoring','critical-validation'],
  architect:['design-exploration','implementation-planning','repository-analysis','api-contract','api-interface-design','source-verification','critical-validation'],
  'repository-explorer':['repository-analysis','source-verification'],
  'qa-reviewer':['review','verification','review-feedback','critical-validation','regression-review'],
  'security-reviewer':['security-review','review','review-feedback','critical-validation','dependency-change'],
  'visual-qa':['visual-qa','accessibility','browser-testing','design-exploration'],
}

test('packaged role skill permissions exactly match the v46 Hi-native role matrix',()=>{
  for(const [role,expected] of Object.entries(matrix)){
    const skill=PACKAGED_HI_AGENTS[role].permission.skill
    assert.equal(skill['*'],'deny',`${role} must default-deny skills`)
    const allowed=Object.entries(skill).filter(([name,value])=>name!=='*'&&value==='allow').map(([name])=>name).sort()
    assert.deepEqual(allowed,[...expected].sort(),role)
    assert.ok(allowed.every(name=>name.startsWith('hi-')),`${role} contains non-Hi skill permission`)
  }
})

test('every skill the runtime router can select for a specialist is native-permission allowed',()=>{
  const found=discoverSkills(root,root)
  for(const [role,caps] of Object.entries(capabilities)){
    const permission=PACKAGED_HI_AGENTS[role].permission.skill
    for(const cap of caps){
      const plan=resolveSkillPlan([cap],found,permission,true,role)
      for(const name of plan.requested)assert.equal(permission[name],'allow',`${role}:${cap}:${name}`)
      assert.deepEqual(plan.missing,[],`${role}:${cap} should not be denied/missing`)
    }
  }
})

test('all 29 shipped Hi-native skills are reachable by at least one role permission surface',()=>{
  const union=new Set(Object.values(matrix).flat())
  assert.equal(union.size,29)
  const found=discoverSkills(root,root).filter(x=>x.provider==='hi'&&x.valid).map(x=>x.name).sort()
  assert.deepEqual([...union].sort(),found)
})
