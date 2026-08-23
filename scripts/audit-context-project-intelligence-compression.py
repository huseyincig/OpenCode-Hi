#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
version=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
OUT=ROOT/'data/validation/prompt-b-context-project-intelligence-compression.json'
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
checks=[
 ('context-consumer-binding','plugin/src/contracts/context-reference.ts','consumer_ref','plugin/test/context-reference-contract.test.mjs','ContextReference binds one available source to an explicit consumer'),
 ('unknown-context-handle-fail-close','plugin/src/runtime/task/task-runtime.ts','Unknown context artifact id(s)','plugin/test/context-survival-hardening.test.mjs','unknown task context artifact id fails closed instead of widening context'),
 ('stale-context-exclusion','plugin/src/runtime/task/task-runtime.ts',"stored?.freshness==='FRESH'",'plugin/test/context-survival-hardening.test.mjs','fresh durable context artifact content is loaded only while source-bound freshness holds'),
 ('durable-artifact-source-provenance','plugin/src/runtime/context/artifact-store.ts','provenance:{source_files:','plugin/test/artifact-contract.test.mjs',"assert.deepEqual(a.provenance.source_files,['src/a.ts'])"),
 ('durable-artifact-consumer-binding','plugin/src/runtime/context/artifact-store.ts','bindConsumer','plugin/test/context-survival-hardening.test.mjs','consumer_refs.includes(started.task_id)'),
 ('durable-artifact-freshness-invalidation','plugin/src/runtime/context/artifact-store.ts',"a.freshness='POTENTIALLY_STALE'",'plugin/test/hi-core-evolution.test.mjs',"freshness,'POTENTIALLY_STALE'"),
 ('artifact-privacy-boundary','plugin/src/runtime/context/artifact-store.ts',"privacyClass??'project-private'",'plugin/test/artifact-contract.test.mjs','ArtifactContract keeps identity, content hash and provenance as distinct fields'),
 ('mission-runtime-projection-bounded','plugin/src/runtime/context/mission-runtime-projection.ts','clipText','plugin/test/c1-mission-runtime-projection.test.mjs','Hi MISSION RUNTIME PROJECTION'),
 ('provider-duplicate-pruning-state-bound','plugin/src/runtime/context/provider-duplicate-pruning.ts','stateIdentity(part)','plugin/test/c2-provider-duplicate-pruning.test.mjs','state identity before pruning'),
 ('project-methodology-learning-evidence-binding','plugin/src/runtime/project-intelligence/methodology-learning.ts','if(!referenced.length)','plugin/test/methodology-signal-contract.test.mjs','project methodology learning rejects an observation whose claimed evidence is not in worker result evidence'),
 ('project-methodology-independent-readiness','plugin/src/runtime/project-intelligence/methodology-learning.ts',"if(independentTasks>=2)item.state='READY'",'plugin/test/methodology-signal-contract.test.mjs','project methodology learning requires repeated independent evidence and survives store restart'),
 ('context-project-learning-not-evidence','plugin/src/runtime/project-intelligence/methodology-learning.ts','activateMethodologySignal','plugin/test/methodology-signal-contract.test.mjs','project.methodology-gap'),
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
learning=list((ROOT/'plugin/src/runtime/project-intelligence').glob('*.ts'));ctx=list((ROOT/'plugin/src/runtime/context').glob('*.ts'))
def evidence_writer(path):
 text=path.read_text(errors='replace')
 return 'addEvidence(' in text or 'execution.evidence.items.push(' in text or 'execution.evidence.items.splice(' in text or 'execution.evidence.items=' in text
learning_bad=[str(x.relative_to(ROOT)) for x in learning if evidence_writer(x)]
ctx_bad=[str(x.relative_to(ROOT)) for x in ctx if evidence_writer(x)]
if learning_bad:violations.append('project-methodology-learning-evidence-ownership:'+','.join(learning_bad))
if ctx_bad:violations.append('context-evidence-ownership:'+','.join(ctx_bad))
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_CONTEXT_PROJECT_LEARNING_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':10,'status':status,'invariants':rows,'static_guards':{'project_methodology_learning_evidence_owner_paths':learning_bad,'context_evidence_owner_paths':ctx_bad,'general_project_intelligence_retrieval_present':False,'compression_subsystem_present':False},'violations':violations,'summary':{'required':len(checks),'covered':len(checks)-sum(1 for v in violations if ':missing-' in v or ':owner-anchor-drift:' in v or ':proof-anchor-drift:' in v),'violations':len(violations)},'claim_boundary':f'Current {version} context architecture: explicit consumer-bound ContextReference/Artifact state, bounded Mission runtime projection, deterministic duplicate pruning, and evidence-bound project methodology learning. Removed general Project Intelligence retrieval and CompressionArtifact subsystems are not certified as current product surfaces.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"context/project-learning audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)}")
if violations:print(json.dumps(data,indent=2))
sys.exit(0 if status=='PASS' else 1)
