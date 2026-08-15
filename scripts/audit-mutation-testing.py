#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ACCEPT=ROOT/'data/validation/selective-mutation-testing-0.1.0.json'
OUT=ROOT/'data/validation/prompt-b-mutation-testing.json'
REQUIRED={'authority_deny_allow','completion_evidence','permission_monotonicity','owner_uniqueness','stale_evidence','path_confinement','restart_schema_rejection','config_executable_effect','capability_support_truth'}
def sha(rel:str)->str:return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def main()->int:
    errors=[]
    try:a=json.loads(ACCEPT.read_text())
    except Exception as e:
        print('mutation audit FAIL: acceptance unreadable',e);return 1
    summary=a.get('summary') or {}; mutants=a.get('mutants') or []; coverage=a.get('coverage') or {}
    if a.get('schema')!=1 or a.get('kind')!='PROMPT_B_SELECTIVE_MUTATION_ACCEPTANCE' or a.get('program')!='PROMPT_B' or a.get('section')!=31 or a.get('status')!='PASS':errors.append('acceptance-identity')
    if summary!={'configured':15,'killed':15,'survived':0,'compile_only_kills':0}:errors.append('acceptance-summary')
    ids=[x.get('id') for x in mutants if isinstance(x,dict)]
    if len(ids)!=15 or len(set(ids))!=15 or any((x.get('status')!='KILLED_BY_INVARIANT_TEST') for x in mutants if isinstance(x,dict)):errors.append('mutant-inventory')
    if not REQUIRED<=set(coverage):errors.append('required-coverage')
    covered={m for k in REQUIRED for m in (coverage.get(k) or [])}
    if not covered<=set(ids) or any(not coverage.get(k) for k in REQUIRED):errors.append('coverage-mutant-binding')
    for x in mutants:
        rel=x.get('source') if isinstance(x,dict) else None
        if not isinstance(rel,str) or not (ROOT/rel).is_file():errors.append(f'mutant-source:{rel}')
    runner=(ROOT/'scripts/run-selective-mutations.mjs').read_text()
    guards=(ROOT/'plugin/test/q2-critical-invariant-guards.test.mjs').read_text()
    static={
      'mutants_compile_before_guard':"build()\n    const result=testGuard(true)" in runner,
      'compile_failure_not_a_kill':"assert.notEqual(result.status,0" in runner and 'compile_only_kills:0' in runner,
      'expected_invariant_failure_required':"assert.match(combined,mutant.expected" in runner,
      'mutation_anchor_exactly_once':"mutation anchor must match exactly once" in runner,
      'guard_baseline_must_be_green':"mutation baseline guard must be green" in runner,
      'isolated_temp_checkout':"opencode-hi-q2-mutations-" in runner and "rmSync(tempRoot,{recursive:true,force:true})" in runner,
      'guard_inventory_15':len(re.findall(r"test\('Q2 ",guards))==15,
      'no_survivors':summary.get('survived')==0,
      'all_required_prompt_areas':set(coverage)>=REQUIRED,
    }
    if not all(static.values()):errors.extend('static:'+k for k,v in static.items() if not v)
    source_commit=(a.get('source') or {}).get('commit')
    source_tree=(a.get('source') or {}).get('tree')
    try:
        if subprocess.check_output(['git','rev-parse',f'{source_commit}^{{tree}}'],cwd=ROOT,text=True).strip()!=source_tree:errors.append('source-tree-binding')
    except Exception:errors.append('source-commit-unavailable')
    owner_files=sorted({x['source'] for x in mutants if isinstance(x,dict) and isinstance(x.get('source'),str)})
    out={
      'schema':1,'kind':'PROMPT_B_MUTATION_TESTING_AUDIT','program':'PROMPT_B','section':31,
      'status':'PASS' if not errors else 'FAIL',
      'acceptance_receipt':'data/validation/selective-mutation-testing-0.1.0.json',
      'summary':{'required_areas':9,'configured_mutants':15,'killed_mutants':15,'survived_mutants':0,'compile_only_kills':0,'violations':len(errors)},
      'required_areas':sorted(REQUIRED),'coverage':coverage,'mutants':mutants,'static_guards':static,
      'source_binding':{'commit':source_commit,'tree':source_tree},
      'proof_hashes':{rel:sha(rel) for rel in ['data/validation/selective-mutation-testing-0.1.0.json','scripts/run-selective-mutations.mjs','plugin/test/q2-critical-invariant-guards.test.mjs',*owner_files]},
      'violations':errors,
      'claim_boundary':'Selective mutation certification for PROMPT B §31. Compile errors are not kills. Every accepted mutant must compile and then fail the expected invariant guard. No broad mutation-coverage percentage is claimed.'
    }
    OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
    print(f"mutation testing audit {out['status']}: areas=9 mutants=15 killed=15 survived=0 violations={len(errors)}")
    return 0 if not errors else 1
if __name__=='__main__':raise SystemExit(main())
