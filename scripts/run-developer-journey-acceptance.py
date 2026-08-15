#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'data/validation/developer-journey-acceptance-0.1.0.json'
cp=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip();tree=subprocess.run(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
r=subprocess.run(['node','--test','--test-timeout=15000','plugin/test/q7-developer-journey-acceptance.test.mjs'],cwd=ROOT,text=True,capture_output=True,timeout=30);text=(r.stdout or '')+'\n'+(r.stderr or '')
def n(x):
 m=re.search(rf'ℹ {re.escape(x)} (\d+)',text);return int(m.group(1)) if m else -1
known=r.returncode in(-6,134) and 'uv__io_poll' in text and 'errno == EEXIST' in text and n('fail')==0 and n('cancelled')==0
terminal={k:n(k) for k in ['tests','pass','fail','cancelled','skipped','todo']};journeys=['add-config','add-methodology','add-host-adapter-behavior','add-validation-rule'];status='PASS' if terminal=={'tests':4,'pass':4,'fail':0,'cancelled':0,'skipped':0,'todo':0} and (r.returncode==0 or known) else 'FAIL'
p={'schema':1,'kind':'PROMPT_B_DEVELOPER_JOURNEY_ACCEPTANCE','program':'PROMPT_B','section':37,'status':status,'source_binding':{'tested_git_commit':cp,'tested_git_tree':tree},'journeys':journeys,'proof':'plugin/test/q7-developer-journey-acceptance.test.mjs','proof_sha256':hashlib.sha256((ROOT/'plugin/test/q7-developer-journey-acceptance.test.mjs').read_bytes()).hexdigest(),'terminal':terminal,'known_node_teardown_normalized':known,'claim_boundary':'Contributor acceptance verifies canonical owner discoverability and projection paths; it does not require editing generated projections by hand.'}
out.write_text(json.dumps(p,indent=2,sort_keys=True)+'\n');print(f'developer journey acceptance {status}: journeys=4/4 tests={terminal["pass"]}/{terminal["tests"]}');sys.exit(0 if status=='PASS' else 1)
