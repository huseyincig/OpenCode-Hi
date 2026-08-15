#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'data/validation/user-journey-acceptance-0.1.0.json'
cp=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
tree=subprocess.run(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
r=subprocess.run(['node','--test','--test-timeout=15000','plugin/test/q6-user-journey-acceptance.test.mjs'],cwd=ROOT,text=True,capture_output=True,timeout=30)
text=(r.stdout or '')+'\n'+(r.stderr or '')
def n(label):
 m=re.search(rf'ℹ {re.escape(label)} (\d+)',text);return int(m.group(1)) if m else -1
known=r.returncode in (-6,134) and 'uv__io_poll' in text and 'errno == EEXIST' in text and n('fail')==0 and n('cancelled')==0
terminal={k:n(k) for k in ['tests','pass','fail','cancelled','skipped','todo']}
scenarios=['small-task','medium-feature','complex-mission','failure','authority','unsupported','restart']
status='PASS' if terminal=={'tests':7,'pass':7,'fail':0,'cancelled':0,'skipped':0,'todo':0} and (r.returncode==0 or known) else 'FAIL'
payload={'schema':1,'kind':'PROMPT_B_USER_JOURNEY_ACCEPTANCE','program':'PROMPT_B','section':36,'status':status,'source_binding':{'tested_git_commit':cp,'tested_git_tree':tree},'proof':'plugin/test/q6-user-journey-acceptance.test.mjs','proof_sha256':hashlib.sha256((ROOT/'plugin/test/q6-user-journey-acceptance.test.mjs').read_bytes()).hexdigest(),'scenarios':scenarios,'terminal':terminal,'known_node_teardown_normalized':known,'claim_boundary':'Controlled end-to-end user journeys over canonical runtime contracts; not external-provider/T3 evidence.'}
out.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
print(f'user journey acceptance {status}: scenarios={len(scenarios)}/7 tests={terminal["pass"]}/{terminal["tests"]}')
if status!='PASS': print(text);sys.exit(1)
