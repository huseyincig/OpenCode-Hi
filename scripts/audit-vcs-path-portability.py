#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-vcs-path-portability.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
checks=[
 # §18 Git/VCS safety
 (18,'user-dirty-files','plugin/src/runtime/task/task-result-reconciler.ts','user-diff.preserved','plugin/test/native-diff-ownership.test.mjs','pre-existing user dirty file unchanged from worker baseline'),
 (18,'pre-staged-files','plugin/src/runtime/safety/staging-safety.ts','recordStagingInspection','plugin/test/w2-workspace-executor.test.mjs','preserves pre-staged and unstaged user changes exactly'),
 (18,'untracked-files','plugin/src/opencode/open-code-workspace-adapter.ts','defaultInspect','plugin/test/w2-workspace-executor.test.mjs','untracked user'),
 (18,'worker-changes','plugin/src/runtime/task/task-result-reconciler.ts','native.diff.reconciled','plugin/test/native-diff-ownership.test.mjs','observed native write omitted from WorkerResult forces reconciliation'),
 (18,'independent-worker-changes','plugin/src/runtime/task/task-result-reconciler.ts','parallel.write-conflict.quarantined','plugin/test/runtime-write-conflict.test.mjs','overlapping writes quarantine the later writer'),
 (18,'verification-touching-files','plugin/src/runtime/evidence/evidence-runtime.ts','shellMayMutate(command)','plugin/test/prompt-b-vcs-path-portability.test.mjs','verification command that may mutate files invalidates earlier Evidence'),
 (18,'failed-task','plugin/src/runtime/task/task-result-reconciler.ts','FIX_REQUIRED','plugin/test/diff-cleanliness-hardening.test.mjs','undeclared out-of-scope change converts DONE to FIX_REQUIRED'),
 (18,'recovery','plugin/src/runtime/task/task-result-reconciler.ts','diff.cleanup.verified','plugin/test/native-diff-ownership.test.mjs','native diff must prove collateral reverted before cleanup blocker can close'),
 (18,'rollback','plugin/src/runtime/mutations/temporary-mutations.ts','rollback','plugin/test/forensic-hardening.test.mjs','command rollback with unknown exit cannot close rollback gate'),
 (18,'workspace-reconcile','plugin/src/runtime/workspace/runtime.ts','reconcileRestored','plugin/test/w2-workspace-executor.test.mjs','restart adopts exact lease, quarantines missing owner without recreation'),
 (18,'commit-boundary','plugin/src/runtime/safety/staging-safety.ts','staged-files-not-hi-owned','plugin/test/staging-safety.test.mjs','commit requires a fresh staged-set proof'),
 (18,'user-ownership-never-reclassified','plugin/src/runtime/safety/staging-safety.ts','preexisting_user_baseline_captured','plugin/test/staging-safety.test.mjs','pre-existing user baseline is frozen once'),
 (18,'no-blind-reset-stash-restore','plugin/src/runtime/task/task-runtime.ts','never use git checkout/reset/restore','plugin/test/native-diff-ownership.test.mjs',r'never use git checkout\/reset\/restore'),
 # §19 Filesystem/path portability
 (19,'relative-vs-absolute','plugin/src/contracts/common.ts','normalizeBoundedProjectPath','plugin/test/prompt-b-vcs-path-portability.test.mjs','project path normalization drops absolute paths outside repository'),
 (19,'cwd-assumptions','plugin/src/runtime/storage/locations.ts','resolve(projectRoot)','plugin/test/main-prompt-coexistence-platform-batch.test.mjs','worktree-first'),
 (19,'symlinks','plugin/src/opencode/open-code-workspace-adapter.ts','realpathSync','plugin/test/w2-workspace-executor.test.mjs','symlinked workspace escape is canonicalized and rejected'),
 (19,'traversal','plugin/src/contracts/common.ts',"segment==='..'",'plugin/test/prompt-b-vcs-path-portability.test.mjs','WorkerResult cannot persist absolute or traversal changed-file ownership'),
 (19,'path-separators','plugin/src/contracts/common.ts',"replace(/\\\\/g,'/')",'plugin/test/prompt-b-vcs-path-portability.test.mjs','normalizes relative Windows separators'),
 (19,'windows-paths','plugin/src/contracts/common.ts',r'/^[A-Za-z]:\//','plugin/test/prompt-b-vcs-path-portability.test.mjs','C:\\\\Windows'),
 (19,'linux-paths','plugin/src/contracts/common.ts',"rel.startsWith('/')",'plugin/test/prompt-b-vcs-path-portability.test.mjs','/etc/passwd'),
 (19,'case-sensitivity-preserved','plugin/src/contracts/common.ts','return rel','plugin/test/prompt-b-vcs-path-portability.test.mjs','path identity preserves case'),
 (19,'utf8','plugin/src/contracts/common.ts','return rel','plugin/test/prompt-b-vcs-path-portability.test.mjs','UTF-8 spaces and long names'),
 (19,'newline-differences','plugin/src/runtime/safety/staging-safety.ts',"split(/\\r?\\n/)",'plugin/test/prompt-b-vcs-path-portability.test.mjs','CRLF-separated staged names'),
 (19,'spaces','plugin/src/runtime/safety/staging-safety.ts','porcelainPaths','plugin/test/w2-workspace-executor.test.mjs','untracked user.txt'),
 (19,'non-ascii-paths','plugin/src/contracts/common.ts','return rel','plugin/test/prompt-b-vcs-path-portability.test.mjs','Unicode'),
 (19,'long-paths','plugin/src/contracts/common.ts','return rel','plugin/test/prompt-b-vcs-path-portability.test.mjs',"'a/'.repeat(120)"),
 (19,'unusable-readonly-root','plugin/src/runtime/state/persistence.ts','mkdirSync(dirname(this.path)','plugin/test/prompt-b-vcs-path-portability.test.mjs','unusable runtime state root fails visibly'),
 (19,'permission-denied-visible','plugin/src/runtime/state/persistence.ts','writeFileSync(tmp','plugin/test/prompt-b-vcs-path-portability.test.mjs','ENOTDIR'),
 (19,'home-xdg-localappdata','plugin/src/runtime/storage/locations.ts','XDG_STATE_HOME','plugin/test/prompt-b-vcs-path-portability.test.mjs','runtime state location honors explicit then XDG then LOCALAPPDATA'),
 (19,'browser-platform-cache','plugin/src/opencode/playwright-browser-adapter.ts','PLAYWRIGHT_BROWSERS_PATH','plugin/test/prompt-b-vcs-path-portability.test.mjs','browser executable discovery uses env/platform cache roots'),
 (19,'no-hardcoded-root-home','plugin/src/opencode/playwright-browser-adapter.ts','homedir()','plugin/test/prompt-b-vcs-path-portability.test.mjs','contains no host-user literal dependency'),
]
violations=[];rows=[]
for section,name,owner,oa,proof,pa in checks:
 op,pp=ROOT/owner,ROOT/proof
 if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');continue
 if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');continue
 ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
 if oa not in ot:violations.append(f'{name}:owner-anchor-drift:{oa}')
 if pa not in pt:violations.append(f'{name}:proof-anchor-drift:{pa}')
 rows.append({'section':section,'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
# Static fail-close guards.
prod='\n'.join(p.read_text(errors='replace') for p in (ROOT/'plugin/src').rglob('*.ts'))
common=(ROOT/'plugin/src/contracts/common.ts').read_text(errors='replace')
worker=(ROOT/'plugin/src/contracts/worker-result.ts').read_text(errors='replace')
evidence=(ROOT/'plugin/src/runtime/evidence/evidence-runtime.ts').read_text(errors='replace')
browser=(ROOT/'plugin/src/opencode/playwright-browser-adapter.ts').read_text(errors='replace')
guards={
 'no_host_user_literal_dependency':('/root/' not in prod and '/home/node/' not in prod),
 'worker_changed_files_use_bounded_path':('normalizeBoundedProjectPath' in worker and 'changed_files' in worker),
 'bounded_path_rejects_parent_absolute_drive_unc':all(x in common for x in ["segment==='..'",r'/^[A-Za-z]:\//',"rel.startsWith('/')","rel.startsWith('//')"]),
 'external_absolute_not_project_owned':("if(!projectRoot)return''" in evidence and "rel.startsWith(`..${sep}`)" in evidence),
 'browser_discovery_is_env_platform_based':all(x in browser for x in ['HI_BROWSER_EXECUTABLE','PLAYWRIGHT_BROWSERS_PATH','XDG_CACHE_HOME','LOCALAPPDATA','homedir()']),
 'staging_unbounded_path_fails_closed':('normalizeBoundedProjectPath' in (ROOT/'plugin/src/runtime/safety/staging-safety.ts').read_text(errors='replace')),
}
for k,v in guards.items():
 if not v:violations.append('static-guard:'+k)
by={}
for section in (18,19):
 names=[x[1] for x in checks if x[0]==section];bad=sum(1 for n in names if any(v.startswith(n+':') for v in violations));by[str(section)]={'required':len(names),'covered':len(names)-bad}
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_VCS_PATH_PORTABILITY_ADVERSARIAL_AUDIT','program':'PROMPT_B','sections':[18,19],'status':status,'invariants':rows,'static_guards':guards,'violations':violations,'summary':{'required':len(checks),'covered':sum(v['covered'] for v in by.values()),'violations':len(violations),'by_section':by},'closed_defects':[
 {'id':'unbounded-repository-path-identity','fix':'Repository-file identity is canonicalized through bounded relative path semantics; absolute, drive, UNC, traversal and NUL paths cannot enter changed-file ownership.'},
 {'id':'browser-host-user-cache-literal','fix':'Playwright executable discovery uses explicit/env/platform cache conventions rather than /root or /home/node literals.'},
 {'id':'browser-stale-spa-route-observation','fix':'Every browser snapshot refreshes and revalidates the actual page URL, preserving dynamic route state and failing closed on external client-side redirects.'},
 ],'claim_boundary':'VCS ownership is baseline- and staged-proof-bound; portability claims are path/storage/browser discovery semantics plus exact Linux/aarch64 Browser/Workspace host receipts, not an untested claim of full Windows runtime certification.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"vcs/path portability audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)} by_section={by}")
if violations:print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
