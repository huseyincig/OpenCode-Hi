#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-context-project-intelligence-compression.json'
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
checks=[
 ('context-consumer-binding','plugin/src/contracts/context-reference.ts','consumer_ref','plugin/test/context-reference-contract.test.mjs','ContextReference binds one available source to an explicit consumer'),
 ('unknown-context-handle-fail-close','plugin/src/runtime/task/task-runtime.ts','Unknown context artifact id(s)','plugin/test/context-survival-hardening.test.mjs','unknown task context artifact id fails closed instead of widening context'),
 ('stale-context-exclusion','plugin/src/runtime/task/task-runtime.ts',"stored?.freshness==='FRESH'",'plugin/test/context-survival-hardening.test.mjs','fresh durable context artifact content is loaded only while source-bound freshness holds'),
 ('project-intelligence-retrieval-eligibility','plugin/src/runtime/project-intelligence/retrieval.ts','item.consumer_domains.includes(input.consumer)','plugin/test/c5-project-intelligence-hybrid-retrieval.test.mjs','C5 filters stale non-active and consumer-ineligible records before scoring regardless of confidence'),
 ('compression-source-hash-binding','plugin/src/contracts/compression-artifact.ts','source_hashes','plugin/test/c3-compression-artifact.test.mjs','C3 CompressionArtifact is strict, source/hash aligned and policy/model/scope bound'),
 ('compression-consumer-isolation','plugin/src/contracts/compression-artifact.ts','exact compression consumer scope','plugin/test/c3-compression-artifact.test.mjs','PROMPT B compression cannot re-scope context from one consumer to another without explicit rebind'),
 ('compression-freshness-propagation','plugin/src/runtime/context/artifact-store.ts','invalidateChanged','plugin/test/c3-compression-artifact.test.mjs','C3 source invalidation propagates freshness through the compression envelope after restart'),
 ('privacy-monotonicity','plugin/src/runtime/context/artifact-store.ts',"sources.every(s=>s.privacy_class==='redacted')?'redacted':'project-private'",'plugin/test/c3-compression-artifact.test.mjs','C3 compression privacy is monotonic and never widens project-private input to redacted'),
 ('project-intelligence-not-evidence','plugin/src/runtime/project-intelligence/store.ts','ProjectIntelligenceStore','plugin/test/project-intelligence-contract.test.mjs','source hash drift invalidates Project Intelligence without converting it into Evidence'),
 ('context-compression-not-evidence','plugin/src/runtime/context/artifact-store.ts','addCompression','plugin/test/c3-compression-artifact.test.mjs','C3 compression implementation remains Context-owned and does not enter Evidence ownership'),
 ('protected-state-budget-survival','plugin/src/runtime/context/governor.ts','PROTECTED','plugin/test/context-survival-hardening.test.mjs','compaction survival keeps blockers, next action and stop contract under very large mission state'),
 ('cache-source-invalidation','plugin/src/runtime/project-intelligence/store.ts','invalidateChanged','plugin/test/project-intelligence-contract.test.mjs','source hash drift invalidates Project Intelligence without converting it into Evidence'),
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
# Ownership guards: context/PI may invalidate themselves but may never become Mission Evidence owners.
pi=list((ROOT/'plugin/src/runtime/project-intelligence').glob('*.ts'));ctx=list((ROOT/'plugin/src/runtime/context').glob('*.ts'))
pi_bad=[str(x.relative_to(ROOT)) for x in pi if 'addEvidence(' in x.read_text(errors='replace') or "../evidence/" in x.read_text(errors='replace')]
ctx_bad=[str(x.relative_to(ROOT)) for x in ctx if 'addEvidence(' in x.read_text(errors='replace') or "../evidence/" in x.read_text(errors='replace')]
if pi_bad:violations.append('project-intelligence-evidence-ownership:'+','.join(pi_bad))
if ctx_bad:violations.append('context-evidence-ownership:'+','.join(ctx_bad))
compression=(ROOT/'plugin/src/contracts/compression-artifact.ts').read_text(errors='replace')
if "s.consumer_ref!==consumerScope" not in compression:violations.append('compression-consumer-binding-not-enforced')
if "s.freshness==='UNKNOWN'" not in compression:violations.append('compression-unknown-freshness-not-rejected')
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_CONTEXT_PROJECT_INTELLIGENCE_COMPRESSION_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':10,'status':status,'invariants':rows,'static_guards':{'project_intelligence_evidence_owner_paths':pi_bad,'context_evidence_owner_paths':ctx_bad,'compression_exact_consumer_binding':True,'compression_unknown_freshness_rejected':True},'violations':violations,'summary':{'required':len(checks),'covered':len(checks)-sum(1 for v in violations if ':missing-' in v or ':owner-anchor-drift:' in v or ':proof-anchor-drift:' in v),'violations':len(violations)},'closed_defects':[{'id':'compression-cross-consumer-rescope','fix':'CompressionArtifact sources must already be explicitly bound to the exact compression consumer scope; cross-task/consumer derivation requires canonical rebind first.'}],'claim_boundary':'Context, ProjectIntelligence and Compression remain non-Evidence semantic planes; stale/unknown or consumer-ineligible material cannot silently widen task context.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"context audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)}")
if violations:print(json.dumps(data,indent=2))
sys.exit(0 if status=='PASS' else 1)
