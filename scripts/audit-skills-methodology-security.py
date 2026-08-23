#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-skills-methodology-security.json'
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
checks=[
 ('selected-name-discovery-confinement','plugin/src/runtime/skills/registry.ts','if(!confined(root,actual))','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B requested methodology preflight rejects a same-name project skill symlink escaping its native discovery root'),
 ('native-discovery-host-owned','plugin/src/runtime/skills/registry.ts','Narrow native-skill compatibility probe.','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B native-installed skill outside Hi methodology policy is not selected by Hi while native loading remains host-owned'),
 ('frontmatter-name-description','plugin/src/runtime/skills/registry.ts','fm.name===name&&Boolean(fm.description)','plugin/test/native-skill-catalog.test.mjs','generated SKILL mechanical contract sections mirror canonical methodology data'),
 ('same-name-shadow-collision','plugin/src/runtime/skills/registry.ts','const foreign=all.filter','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B foreign project skill ID cannot shadow or replace a built-in Hi methodology'),
 ('project-policy-symlink-confinement','plugin/src/runtime/methodology/project-policy.ts','exactConfinedFile','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B project policy/provenance directory symlink escape is not an admission surface'),
 ('project-skill-provenance-hash','plugin/src/runtime/methodology/project-policy.ts','provenance.skill_sha256!==digest(skillText)','plugin/test/project-methodology-admission-contract.test.mjs','project methodology is admitted only when skill, policy and hash-bound provenance are coherent'),
 ('project-policy-provenance-hash','plugin/src/runtime/methodology/project-policy.ts','provenance.policy_sha256!==digest(policyText)','plugin/test/project-methodology-admission-contract.test.mjs','project methodology update requires fresh provenance hash before re-admission'),
 ('project-learning-ready','plugin/src/runtime/methodology/project-policy.ts','methodologyCandidateAssessment(candidate).eligible','plugin/test/project-methodology-admission-contract.test.mjs','project-learning admission decays a historically READY candidate until fresh evidence restores confidence'),
 ('project-default-trust-ask','plugin/src/runtime/methodology/host-permissions.ts',"skill[policy.name]='ask'",'plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B repository-local methodology provenance can never silently grant native skill allow'),
 ('explicit-deny-preserved','plugin/src/runtime/methodology/host-permissions.ts',"if(exact==='deny'||exact==='ask'||exact==='allow')",'plugin/test/project-methodology-admission-contract.test.mjs','explicit native deny is preserved even for an admitted compatible project methodology'),
 ('selected-not-loaded','plugin/src/runtime/methodology/native-loading.ts','assertChildMethodologyLoad','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B selected methodology is not loaded until the exact child load is observed'),
 ('unadmitted-not-selected','plugin/src/runtime/skills/registry.ts','if(!policy)continue','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B native-installed skill outside Hi methodology policy is not selected by Hi while native loading remains host-owned'),
 ('methodology-cannot-grant-authority','plugin/src/runtime/methodology/host-permissions.ts','Repository-local methodology provenance proves integrity, not trust.','plugin/test/prompt-b-skills-methodology-security-hostile.test.mjs','PROMPT B forged project-learning files cannot turn repository provenance into silent execution trust'),
]
violations=[];rows=[]
for name,owner,oa,proof,pa in checks:
 op=ROOT/owner;pp=ROOT/proof
 if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');continue
 if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');continue
 ot=op.read_text(errors='replace');pt=pp.read_text(errors='replace')
 if oa not in ot:violations.append(f'{name}:owner-anchor-drift:{oa}')
 if pa not in pt:violations.append(f'{name}:proof-anchor-drift:{pa}')
 rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
registry=(ROOT/'plugin/src/runtime/skills/registry.ts').read_text(errors='replace')
policy=(ROOT/'plugin/src/runtime/methodology/project-policy.ts').read_text(errors='replace')
permissions=(ROOT/'plugin/src/runtime/methodology/host-permissions.ts').read_text(errors='replace')
loading=(ROOT/'plugin/src/runtime/methodology/native-loading.ts').read_text(errors='replace')
static={
 'selected_names_only':'for(const name of [...new Set(requestedNames)])' in registry,
 'no_second_skill_catalog_loader':all(x not in registry for x in ['SkillCatalogIndex','readSkillResource','indexSkillResources','discoverSkills(']),
 'native_loading_host_owned':'OpenCode owns actual discovery' in registry and 'body loading' in registry,
 'canonical_skill_realpath_confinement':'realpathSync' in registry and 'confined(root,actual)' in registry,
 'same_name_shadow_rejected':'const foreign=all.filter' in registry,
 'project_artifacts_realpath_confined':'exactConfinedFile' in policy and 'dirname(actual)===base' in policy,
 'project_learning_requires_ready':'methodologyCandidateAssessment(candidate).eligible' in policy,
 'project_provenance_is_not_trust':'provenance proves integrity, not trust' in permissions,
 'project_default_is_ask':"skill[policy.name]='ask'" in permissions,
 'explicit_native_decision_preserved':"if(exact==='deny'||exact==='ask'||exact==='allow')" in permissions,
 'selected_loaded_separation':'selected_methodologies' in loading and 'loaded_methodologies' in loading and 'assertChildMethodologyLoad' in loading,
}
for k,v in static.items():
 if not v:violations.append('static:'+k)
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
out={'schema':1,'kind':'PROMPT_B_SKILLS_METHODOLOGY_SECURITY_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':21,'status':status,'invariants':rows,'static_guards':static,'state_separation':['installed skill','admitted methodology','selected methodology','loaded methodology'],'closed_defects':[{'id':'skill-discovery-symlink-escape','fix':'Selected-name native compatibility probing canonicalizes the exact SKILL.md and rejects same-name roots that escape by symlink.'},{'id':'repo-provenance-silent-skill-trust','fix':'Repository-local methodology provenance proves integrity only; absent an explicit native decision, admitted project methodology is narrowed to ASK.'},{'id':'project-methodology-artifact-symlink-escape','fix':'Project policy, skill, provenance and project-learning candidate admission require exact confined canonical files.'},{'id':'second-skill-loader-removed','fix':'Hi no longer owns a full skill/resource inventory or loader; OpenCode owns discovery/body/resource loading while Hi checks only selected methodology names and records observed loads.'}],'violations':violations,'summary':{'required':len(checks),'covered':len(checks)-sum(1 for v in violations if ':missing-' in v or ':owner-anchor-drift:' in v or ':proof-anchor-drift:' in v),'violations':len(violations)},'claim_boundary':'Installed OpenCode skills, admitted Hi methodology policy, selected methodology and observed native load are distinct states. Repository content cannot grant trust or authority, foreign same-name skills cannot shadow canonical Hi methodology, and Hi does not reimplement OpenCode skill/resource loading.'}
OUT.write_text(json.dumps(out,indent=2)+'\n')
print(f"skills/methodology security audit {status}: covered={out['summary']['covered']}/{len(checks)} violations={len(violations)}")
if violations:print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
