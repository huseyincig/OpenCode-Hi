#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-evidence-verification-completion.json'
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
checks=[
 ('evidence-scope','plugin/src/runtime/verification/policy.ts','evidenceAllowedForVerification','plugin/test/obligation-ownership.test.mjs','worker verification claim satisfies neither its owned nor another verification obligation'),
 ('evidence-freshness','plugin/src/runtime/verification/policy.ts',"freshness=p.requireFresh&&!requiredEvidenceFresh?'stale':'fresh'",'plugin/test/q2-critical-invariant-guards.test.mjs','Q2 invalidated pre-mutation evidence cannot satisfy freshness'),
 ('source-revision','plugin/src/runtime/task/child-execution-coordinator.ts','worker.native_state_hash=stateHash','plugin/test/native-diff-ownership.test.mjs','PROMPT B final native diff deterministically binds worker evidence source-state identity'),
 ('changed-file-ownership','plugin/src/runtime/task/task-result-reconciler.ts','native.diff.mismatch','plugin/test/native-diff-ownership.test.mjs','plugin session.idle path converts DONE to FIX_REQUIRED when native diff exposes an undeclared file'),
 ('mutation-invalidation','plugin/src/runtime/evidence/evidence-runtime.ts','markMutation','plugin/test/evidence-freshness-ordering.test.mjs','worker-reported verification remains non-canonical when changed_files is learned from the same result'),
 ('not-run-not-passed','plugin/src/runtime/verification/policy.ts',"result:'not_run' as const",'plugin/test/verification-envelope-contract.test.mjs','missing required check is not_run with explanation and never a pass'),
 ('worker-result-not-evidence','plugin/src/runtime/task/task-result-reconciler.ts','WorkerResult evidence stays task-result provenance. It is never copied wholesale','plugin/test/prompt-b-evidence-verification-completion-hostile.test.mjs','PROMPT B hostile DONE and all-tests-passed prose cannot replace verification Evidence'),
 ('project-methodology-learning-not-evidence','plugin/src/runtime/project-intelligence/methodology-learning.ts','project-methodology.observation-rejected','plugin/test/methodology-signal-contract.test.mjs','project methodology learning rejects an observation whose claimed evidence is not in worker result evidence'),
 ('context-artifact-not-evidence','plugin/src/runtime/context/artifact-store.ts','export class ContextArtifactStore','plugin/test/artifact-contract.test.mjs','ArtifactContract keeps identity, content hash and provenance as distinct fields'),
 ('review-disposition','plugin/src/runtime/task/task-result-reconciler.ts','review.claim-unproven','plugin/test/obligation-ownership.test.mjs','reviewer DONE prose without explicit source-bound review evidence cannot close review or verification'),
 ('required-evidence-coverage','plugin/src/runtime/verification/policy.ts','requiredKinds','plugin/test/verification-envelope-contract.test.mjs','VerificationEnvelope derives a passed check only from explicit passed evidence'),
 ('completion-obligation-reconciliation','plugin/src/runtime/completion/evaluator.ts','open-obligations','plugin/test/prompt-b-evidence-verification-completion-hostile.test.mjs','PROMPT B hostile DONE and all-tests-passed prose cannot replace verification Evidence'),
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
# Semantic-plane ownership guards.
pi_paths=list((ROOT/'plugin/src/runtime/project-intelligence').glob('*.ts'))
ctx_paths=list((ROOT/'plugin/src/runtime/context').glob('*.ts'))
worker_contract=(ROOT/'plugin/src/contracts/worker-result.ts').read_text(errors='replace')
def evidence_writer(path):
 text=path.read_text(errors='replace')
 return 'addEvidence(' in text or 'execution.evidence.items.push(' in text or 'execution.evidence.items.splice(' in text or 'execution.evidence.items=' in text
pi_evidence_owner=[str(x.relative_to(ROOT)) for x in pi_paths if evidence_writer(x)]
context_evidence_owner=[str(x.relative_to(ROOT)) for x in ctx_paths if evidence_writer(x)]
if pi_evidence_owner:violations.append('project-intelligence-became-evidence-owner:'+','.join(pi_evidence_owner))
if context_evidence_owner:violations.append('context-became-evidence-owner:'+','.join(context_evidence_owner))
if 'EvidenceItem' in worker_contract or "runtime/evidence" in worker_contract:violations.append('worker-result-contract-became-mission-evidence-owner')
reconciler=(ROOT/'plugin/src/runtime/task/task-result-reconciler.ts').read_text(errors='replace')
if "kind:'review-evidence'" in reconciler and 'review.claim-unproven' not in reconciler:violations.append('review-done-auto-promotes-to-evidence')
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_EVIDENCE_VERIFICATION_COMPLETION_HOSTILE_AUDIT','program':'PROMPT_B','section':9,'status':status,'invariants':rows,'static_guards':{'project_intelligence_evidence_owner_paths':pi_evidence_owner,'context_evidence_owner_paths':context_evidence_owner,'worker_result_is_mission_evidence_owner':False},'violations':violations,'summary':{'required':len(checks),'covered':len(checks)-sum(1 for v in violations if ':missing-' in v or ':owner-anchor-drift:' in v or ':proof-anchor-drift:' in v),'violations':len(violations)},'closed_defects':[{'id':'reviewer-done-auto-pass-evidence','fix':'Reviewer DONE/prose no longer synthesizes passed review Evidence or closes review/verification obligations without explicit fresh source-bound review evidence.'},{'id':'worker-pass-without-source-state','fix':'Generic WorkerResult verification claims never become canonical Evidence; trusted reviewer/browser observation admission remains exact session/state/attempt bound, and final native diff deterministically binds worker.native_state_hash.'}],'claim_boundary':'Treats WorkerResult/model prose as untrusted. Only canonical Evidence with scope, freshness, obligation and source-state constraints may satisfy Verification/Completion.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"evidence audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)}")
if violations:print(json.dumps(data,indent=2))
sys.exit(0 if status=='PASS' else 1)
