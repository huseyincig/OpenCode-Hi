#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHECKS=[
 ('role-agent-model-methodology-separation','plugin/src/runtime/task/task-runtime.ts','worker.requested_model=input.model','plugin/test/model-contract.test.mjs','model execution identity keeps requested selected projected observed and effective phases distinct'),
 ('requested-selected-projected-observed-model','plugin/src/contracts/model.ts','reconcileModelExecutionIdentity','plugin/test/main-prompt-model-evidence.test.mjs','projected model mismatch is a first-class blocker even when observed model matches selection'),
 ('host-contradiction-handling','plugin/src/runtime/task/child-execution-coordinator.ts',"identity.status==='model-mismatch'",'plugin/test/main-prompt-model-evidence.test.mjs','effective model mismatch blocks DONE and preserves the obligation for reconciliation'),
 ('unknown-model-capability','plugin/src/runtime/readiness/preconditions.ts','No permitted/available runtime model satisfies this task','plugin/test/main-prompt-delegation-preconditions.test.mjs','missing native worker capability is RESOLVE before creating task or trying model fallbacks'),
 ('model-fallback','plugin/src/runtime/task/task-recovery-coordinator.ts','recoverRuntimeFailure','plugin/test/provider-fallback-hardening.test.mjs','second provider failure advances to next fallback rather than returning to prior model'),
 ('methodology-available-admitted-selected-loaded','plugin/src/runtime/skills/registry.ts','resolveSkillPlan','plugin/test/project-methodology-admission-contract.test.mjs','admitted project methodology reaches native lazy selection as project provider'),
 ('methodology-lazy-load','plugin/src/runtime/task/task-result-reconciler.ts','methodology-not-loaded','plugin/test/methodology-signal-contract.test.mjs','selected child methodology must be actually native-loaded before DONE can be accepted'),
 ('methodology-collision','plugin/src/runtime/skills/registry.ts','foreign.length','plugin/test/native-skill-catalog.test.mjs','native configured Hi skill path does not duplicate the same physical root as a personal provider'),
 ('methodology-exit','plugin/src/runtime/methodology/exit.ts','methodologyExitCheck','plugin/test/b3-methodology-exit-evidence.test.mjs','fresh explicit passed browser/visual evidence satisfies only the matching methodology exit'),
 ('methodology-cannot-grant-authority','plugin/src/runtime/skills/methodology.ts','never own orchestration, worker spawning, model selection, authority','plugin/test/native-skill-catalog.test.mjs','Hi methodology documents do not claim control-plane tool ownership'),
 ('methodology-cannot-own-completion','plugin/src/runtime/task/task-result-reconciler.ts','reconcileMethodologyExits','plugin/test/forensic-hardening.test.mjs','parent direct methodology remains active until mission-scope fresh verification satisfies its exit contract'),
 ('role-permissions-mechanically-projected','plugin/src/generated/permission-policy.ts','HI_PERMISSION_PROFILES','plugin/test/permission-profile-contract.test.mjs','canonical PermissionProfile catalog validates and exactly drives non-methodology native permissions'),
 ('prompt-persona-cannot-override-policy','plugin/src/runtime/routing/execution-profile.ts','promptToolOverrides','plugin/test/main-prompt-execution-profile-tools.test.mjs','prompt tool overrides only disable tools; they never turn a denied native permission into allow'),
]
def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def main()->int:
  violations=[];rows=[]
  for ident,owner,oa,proof,pa in CHECKS:
    op,pp=ROOT/owner,ROOT/proof
    if not op.is_file():violations.append(f'{ident}:missing-owner:{owner}');continue
    if not pp.is_file():violations.append(f'{ident}:missing-proof:{proof}');continue
    ot,pt=op.read_text(errors='ignore'),pp.read_text(errors='ignore')
    if oa not in ot:violations.append(f'{ident}:owner-anchor-drift:{oa}')
    if pa not in pt:violations.append(f'{ident}:proof-anchor-drift:{pa}')
    rows.append({'invariant':ident,'owner':owner,'owner_sha256':sha(op),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(pp),'proof_anchor':pa})
  # Methodology may inspect security/authority surfaces, but must not import the Authority/Completion owners or control-plane runtime.
  forbidden=[]
  for base in [ROOT/'plugin/src/runtime/methodology']:
    for f in base.rglob('*.ts'):
      text=f.read_text(errors='ignore')
      for token in ["../safety/authority", "../completion/", "../../runtime/safety/authority", "../../runtime/completion/"]:
        if token in text: forbidden.append(f'{f.relative_to(ROOT)}:{token}')
  if forbidden: violations.extend('forbidden-methodology-owner-import:'+x for x in forbidden)
  skills=sorted((ROOT/'skills').glob('hi-*/SKILL.md'))
  skill_boundary_missing=[]; control_claims=[]
  boundary='This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.'
  for f in skills:
    text=f.read_text(errors='ignore')
    if boundary not in text: skill_boundary_missing.append(str(f.relative_to(ROOT)))
    for token in ['hi_task_start','hi_task_cancel','hi_team_create','hi_direct_progress']:
      if token in text: control_claims.append(f'{f.relative_to(ROOT)}:{token}')
  if skill_boundary_missing: violations.extend('skill-boundary-missing:'+x for x in skill_boundary_missing)
  if control_claims: violations.extend('skill-control-plane-claim:'+x for x in control_claims)
  role_mechanical=[]
  for f in (ROOT/'roles').glob('*.md') if (ROOT/'roles').exists() else []:
    for line in f.read_text(errors='ignore').splitlines():
      if line.strip().lower().startswith(('permission:','model:','tools:')):role_mechanical.append(str(f.relative_to(ROOT))+':'+line.strip())
  if role_mechanical:violations.extend('role-markdown-mechanical-owner:'+x for x in role_mechanical)
  out={'schema':1,'kind':'PROMPT_B_ROLE_MODEL_METHODOLOGY_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':7,'status':'PASS' if not violations and len(rows)==len(CHECKS) else 'FAIL','invariants':rows,'static_guards':{'methodology_forbidden_owner_imports':forbidden,'skill_boundary_missing':skill_boundary_missing,'skill_control_plane_claims':control_claims,'role_markdown_mechanical_owners':role_mechanical,'skill_count':len(skills)},'violations':violations,'summary':{'required':len(CHECKS),'covered':len(rows)-len({v.split(':',1)[0] for v in violations if not v.startswith(('forbidden-','skill-','role-'))}),'violations':len(violations)},'claim_boundary':'Deterministic current-source audit of PROMPT B section 7 role/model/methodology separation. It does not elevate prompt prose above executable policy.'}
  path=ROOT/'data/validation/prompt-b-role-model-methodology.json';path.write_text(json.dumps(out,indent=2)+'\n')
  print(f"role/model/methodology audit {out['status']}: covered={out['summary']['covered']}/{out['summary']['required']} violations={len(violations)} skills={len(skills)}")
  return 0 if out['status']=='PASS' else 1
if __name__=='__main__':sys.exit(main())
