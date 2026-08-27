#!/usr/bin/env python3
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[2]
LAB=ROOT/'test-lab'
errors=[]
pool=json.loads((LAB/'config/model-pool.json').read_text())
allowed=pool['allowed_models']
cost=pool['cost_priority']
if allowed!=cost: errors.append('allowed_models must exactly equal cost_priority')
if len(allowed)!=len(set(allowed)): errors.append('model pool contains duplicates')
profile=pool.get('execution_profile',{})
if profile.get('executionPolicy')!='adaptive' or profile.get('topology')!='adaptive' or profile.get('roleModels')!={}: errors.append('model pool execution profile must be adaptive/adaptive with empty roleModels')
ids=[]
for d in sorted((LAB/'scenarios').iterdir()):
    if not d.is_dir(): continue
    ids.append(d.name)
    if not (d/'PROMPT.md').is_file(): errors.append(f'{d.name}: missing PROMPT.md')
    try: meta=json.loads((d/'scenario.json').read_text())
    except Exception as e: errors.append(f'{d.name}: invalid scenario.json: {e}'); continue
    if meta.get('id')!=d.name: errors.append(f'{d.name}: id mismatch')
    fx=meta.get('fixture')
    if fx:
        target=(d/fx).resolve()
        if not target.is_dir(): errors.append(f'{d.name}: fixture missing: {target}')
expected=[f'{i:02d}-' for i in range(1,11)]
if len(ids)!=10: errors.append(f'expected 10 scenarios, got {len(ids)}')
for prefix in expected:
    if not any(x.startswith(prefix) for x in ids): errors.append(f'missing scenario prefix {prefix}')
for required in ['MASTER_TEST_PROGRAM.md','CONTINUATION_PROMPT.md','SCENARIOS.md','config/environment-baseline.json','config/model-pool.json','bin/prepare-run.py','bin/refresh-environment.sh']:
    if not (LAB/required).is_file(): errors.append(f'missing {required}')
if errors:
    print('LAB VALIDATION FAIL')
    for e in errors: print('-',e)
    sys.exit(1)
print(f'LAB VALIDATION PASS scenarios={len(ids)} allowed_models={len(allowed)} fixtures={sum(1 for x in ids if (LAB/"fixtures"/x).is_dir())}')
