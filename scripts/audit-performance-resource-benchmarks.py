#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/validation/prompt-b-performance-resource-benchmarks.json'; violations=[]
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def text(rel):return (ROOT/rel).read_text(errors='replace')
rel='data/validation/performance-resource-benchmarks-0.1.0.json';d=json.loads((ROOT/rel).read_text())
required=['startup','task_initialization','skill_discovery_cache','pi_retrieval','context_build','persistence','scheduling','process_output','memory_growth','token_usage']
if d.get('schema')!=1 or d.get('kind')!='PROMPT_B_PERFORMANCE_RESOURCE_BENCHMARK' or d.get('program')!='PROMPT_B' or d.get('section')!=35 or d.get('status')!='PASS':violations.append('benchmark-identity-status')
if list((d.get('metrics') or {}).keys())!=required:violations.append('metric-inventory')
metrics=d.get('metrics') or {}
for k in required:
 m=metrics.get(k) or {}
 if k=='skill_discovery_cache':
  if (m.get('cold') or {}).get('status')!='PASS' or (m.get('cached') or {}).get('status')!='PASS' or m.get('full_scans')!=1 or int(m.get('fingerprint_checks',0))<1:violations.append('metric:'+k)
 elif m.get('status')!='PASS':violations.append('metric:'+k)
if (metrics.get('process_output') or {}).get('max_buffered_chars')!=256*1024 or (metrics.get('process_output') or {}).get('max_read_chars')!=64*1024:violations.append('process-output-bounds')
tok=metrics.get('token_usage') or {};obs=tok.get('provider_observed') or {};est=tok.get('estimated') or {}
if not (obs.get('value')==321 and obs.get('unit')=='tokens' and obs.get('source')=='provider-usage' and obs.get('confidence')=='exact' and est.get('value')==500 and est.get('source')=='estimated' and est.get('confidence')=='estimated'):violations.append('token-truth-boundary')
if d.get('optimization_decision')!='NO_NEW_SCHEDULER_OR_WORK_STEALING_COMPLEXITY_WITHOUT_MEASURED_BENEFIT':violations.append('optimization-decision')
existing=json.loads((ROOT/'data/validation/benchmarks-0.1.0.json').read_text())
if len(existing.get('scenarios') or [])!=9 or len(existing.get('schedulerEconomics') or [])!=3:violations.append('existing-policy-benchmark-inventory')
if any(x.get('kind')!='DETERMINISTIC_POLICY_SIMULATION' for x in existing.get('scenarios',[])):violations.append('policy-claim-boundary')
static={
 'skill-cache-owner':'#cache' in text('plugin/src/runtime/skills/catalog-index.ts') and '#fingerprintChecks' in text('plugin/src/runtime/skills/catalog-index.ts'),
 'pi-bounded-topk':'.slice(0,Math.max(1,input.limit??6))' in text('plugin/src/runtime/project-intelligence/retrieval.ts'),
 'context-governor-bounded':'maxChars' in text('plugin/src/runtime/context/governor.ts'),
 'persistence-atomic-replace':'renameSync(tmp,this.path)' in text('plugin/src/runtime/state/persistence.ts'),
 'scheduler-no-work-stealing':'work-steal' not in text('plugin/src/runtime/scheduler/concurrency.ts').lower(),
 'process-buffer-bounded':'readonly maxBufferedChars=256*1024' in text('plugin/src/opencode/open-code-pty-adapter.ts'),
 'token-estimate-not-exact':"unit:'tokens',source:'estimated',confidence:'estimated'" in text('plugin/src/runtime/context/budget-estimator.ts'),
}
for k,v in static.items():
 if not v:violations.append('static:'+k)
out={'schema':1,'kind':'PROMPT_B_PERFORMANCE_RESOURCE_BENCHMARK_AUDIT','program':'PROMPT_B','section':35,'status':'PASS' if not violations else 'FAIL','benchmark_receipt':rel,'benchmark_sha256':sha(rel),'required_metrics':required,'summary':{'required':10,'covered':sum(1 for k in required if k in metrics),'violations':len(violations)},'static_guards':static,'existing_policy_benchmark':{'path':'data/validation/benchmarks-0.1.0.json','sha256':sha('data/validation/benchmarks-0.1.0.json'),'scenarios':9,'scheduler_economics':3},'optimization_decision':d.get('optimization_decision'),'violations':violations,'claim_boundary':'Measured local paths use broad stable thresholds plus exact bounded resource/token semantics. No provider wall-clock latency, billing, or imaginary scheduler benefit is claimed.'}
OUT.write_text(json.dumps(out,indent=2)+'\n')
print(f"performance/resource audit {out['status']}: covered={out['summary']['covered']}/10 violations={len(violations)}")
sys.exit(0 if not violations else 1)
