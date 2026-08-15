#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];a=ROOT/'data/validation/developer-journey-acceptance-0.1.0.json';out=ROOT/'data/validation/prompt-b-developer-journey-acceptance.json';d=json.loads(a.read_text()) if a.exists() else {};req=['add-config','add-methodology','add-host-adapter-behavior','add-validation-rule'];viol=[]
if d.get('status')!='PASS':viol.append('acceptance-not-pass')
if d.get('journeys')!=req:viol.append('journey-inventory-drift')
if d.get('terminal')!={'tests':4,'pass':4,'fail':0,'cancelled':0,'skipped':0,'todo':0}:viol.append('terminal-drift')
rel=d.get('proof');dig=d.get('proof_sha256')
if not rel or not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=dig:viol.append('proof-hash-drift')
row={'schema':1,'kind':'PROMPT_B_DEVELOPER_JOURNEY_ACCEPTANCE_AUDIT','program':'PROMPT_B','section':37,'status':'PASS' if not viol else 'FAIL','acceptance_receipt':'data/validation/developer-journey-acceptance-0.1.0.json','acceptance_sha256':hashlib.sha256(a.read_bytes()).hexdigest() if a.exists() else None,'required_journeys':req,'summary':{'required':4,'covered':4 if not viol else 0,'violations':len(viol)},'violations':viol,'claim_boundary':'Developer journey acceptance rejects parallel semantic owners and hand-maintained generated truth.'};out.write_text(json.dumps(row,indent=2,sort_keys=True)+'\n');print(f'developer journey audit {row["status"]}: covered={row["summary"]["covered"]}/4 violations={len(viol)}');sys.exit(0 if not viol else 1)
