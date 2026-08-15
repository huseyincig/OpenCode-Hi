#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
a=ROOT/'data/validation/user-journey-acceptance-0.1.0.json';out=ROOT/'data/validation/prompt-b-user-journey-acceptance.json'
d=json.loads(a.read_text()) if a.exists() else {}
required=['small-task','medium-feature','complex-mission','failure','authority','unsupported','restart']
viol=[]
if d.get('status')!='PASS':viol.append('acceptance-not-pass')
if d.get('scenarios')!=required:viol.append('scenario-inventory-drift')
if d.get('terminal')!={'tests':7,'pass':7,'fail':0,'cancelled':0,'skipped':0,'todo':0}:viol.append('terminal-drift')
proof=d.get('proof');digest=d.get('proof_sha256')
if not proof or not (ROOT/proof).is_file() or hashlib.sha256((ROOT/proof).read_bytes()).hexdigest()!=digest:viol.append('proof-hash-drift')
summary={'required':7,'covered':7 if not viol else 0,'violations':len(viol)}
row={'schema':1,'kind':'PROMPT_B_USER_JOURNEY_ACCEPTANCE_AUDIT','program':'PROMPT_B','section':36,'status':'PASS' if not viol else 'FAIL','acceptance_receipt':'data/validation/user-journey-acceptance-0.1.0.json','acceptance_sha256':hashlib.sha256(a.read_bytes()).hexdigest() if a.exists() else None,'summary':summary,'required_scenarios':required,'violations':viol,'claim_boundary':'User journey acceptance verifies externally understandable behavior without requiring internal orchestration knowledge.'}
out.write_text(json.dumps(row,indent=2,sort_keys=True)+'\n')
print(f'user journey audit {row["status"]}: covered={summary["covered"]}/7 violations={len(viol)}')
if viol:sys.exit(1)
