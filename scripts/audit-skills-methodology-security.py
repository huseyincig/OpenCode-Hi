#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-skills-methodology-security.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
checks=[
 ('discovery-confinement','plugin/src/runtime/skills/registry.ts','confined(root,actualDir)','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','project skill discovery rejects a skill-directory symlink escaping its discovery root'),
 ('resource-indexing','plugin/src/runtime/skills/registry.ts','indexSkillResources','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','resource symlink cannot escape the admitted skill directory'),
 ('arbitrary-path-read','plugin/src/runtime/skills/registry.ts','Unsafe skill resource path','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs',"readSkillResource(skill,'references','../outside.md')"),
 ('symlink-escape','plugin/src/runtime/methodology/project-policy.ts','exactConfinedFile','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','project policy/provenance directory symlink escape is not an admission surface'),
 ('frontmatter-validation','plugin/src/runtime/skills/registry.ts','validSkillFrontmatter','plugin/test/c7-skill-catalog-index.test.mjs','assert.equal(bad.valid,false)'),
 ('id-collisions','plugin/src/runtime/skills/registry.ts','const foreign=all.filter','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','foreign project skill ID cannot shadow or replace a built-in Hi methodology'),
 ('project-vs-built-in-precedence','plugin/src/runtime/skills/registry.ts','expectedProvider:SkillProvider=policy.provider','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs',"assert.equal(plan.outcomes[0].outcome,'invalid')"),
 ('malicious-content','plugin/src/runtime/methodology/host-permissions.ts',"skill[policy.name]='ask'",'plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','repository-local methodology provenance can never silently grant native skill allow'),
 ('lazy-load','plugin/src/runtime/methodology/native-loading.ts','assertChildMethodologyLoad','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','selected methodology is not loaded until the exact child load is observed'),
 ('admission','plugin/src/runtime/methodology/project-policy.ts','provenance.skill_sha256!==digest(skillText)','plugin/test/project-methodology-admission-contract.test.mjs','project methodology is admitted only when skill, policy and hash-bound provenance are coherent'),
 ('user-project-trust','plugin/src/runtime/methodology/host-permissions.ts','Repository-local methodology provenance proves integrity, not user trust','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs',"assert.equal(cfg.agent.coder.permission.skill[f.name],'ask')"),
 ('provenance','plugin/src/runtime/methodology/project-policy.ts','provenance.policy_sha256!==digest(policyText)','plugin/test/project-methodology-admission-contract.test.mjs','project methodology update requires fresh provenance hash before re-admission'),
 ('methodology-learning-promotion','plugin/src/runtime/project-intelligence/methodology-candidate.ts',"v.state==='READY'&&independent<2",'plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','forged project-learning files cannot turn repository provenance into silent execution trust'),
]
violations=[];rows=[]
for name,owner,oa,proof,pa in checks:
    op,pp=ROOT/owner,ROOT/proof
    if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');continue
    if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');continue
    ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
    if oa not in ot:violations.append(f'{name}:owner-anchor-drift:{oa}')
    if pa not in pt:violations.append(f'{name}:proof-anchor-drift:{pa}')
    rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
reg=(ROOT/'plugin/src/runtime/skills/registry.ts').read_text(errors='replace')
host=(ROOT/'plugin/src/runtime/methodology/host-permissions.ts').read_text(errors='replace')
native=(ROOT/'plugin/src/runtime/methodology/native-loading.ts').read_text(errors='replace')
policy=(ROOT/'plugin/src/runtime/methodology/project-policy.ts').read_text(errors='replace')
guards={
 'installed_not_admitted':"unknown-policy" in reg and 'methodologyCatalogEntry' in native,
 'admitted_not_selected':"requested=requestedMethodologies" in reg and 'resolveSkillPlan' in reg,
 'selected_not_loaded':'selected_methodologies' in native and 'loaded_methodologies' in native,
 'project_default_trust_is_ask':"skill[policy.name]='ask'" in host,
 'explicit_deny_preserved':"exact==='deny'||exact==='ask'||exact==='allow'" in host,
 'project_artifacts_realpath_confined':'exactConfinedFile' in policy,
 'resource_parent_traversal_rejected':"relativePath.includes('..')" in reg,
}
for k,v in guards.items():
    if not v:violations.append('static-guard:'+k)
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_SKILLS_METHODOLOGY_SECURITY_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':21,'status':status,'invariants':rows,'static_guards':guards,'violations':violations,'summary':{'required':len(checks),'covered':len(checks)-len([v for v in violations if not v.startswith('static-guard:')]),'violations':len(violations)},'closed_defects':[
 {'id':'skill-discovery-symlink-escape','fix':'Project/personal/Hi skill candidates are accepted only when the canonical skill directory and SKILL.md remain confined to the canonical discovery root/skill directory.'},
 {'id':'repo-provenance-silent-skill-trust','fix':'Repository-local methodology provenance is integrity metadata only; admitted project methodologies default to native ASK unless an exact host/user permission already says ALLOW, while DENY is preserved.'},
 {'id':'project-methodology-artifact-symlink-escape','fix':'Project methodology policy, skill, provenance and learning candidate files must resolve to exact confined project paths before admission.'},
 ],'state_separation':['installed skill','admitted methodology','selected methodology','loaded methodology'],'claim_boundary':'Project-local skill/methodology files may become structurally admitted after integrity/provenance checks, but repository content cannot silently manufacture native execution trust. Native/user permission remains the load boundary; methodologies cannot grant Authority or Completion.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"skills/methodology security audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)}")
if violations:print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
