#!/usr/bin/env python3
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
V=(ROOT/'VERSION').read_text().strip(); OUT=ROOT/f'data/validation/final-gates-{V}.json'
HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();TREE=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True).strip()
def run(cmd,cwd=ROOT): return subprocess.run(cmd,cwd=cwd,text=True,capture_output=True,timeout=240)
def both(r): return (r.stdout or '')+(r.stderr or '')
py=run([sys.executable,'-m','pytest','-q','tests/test_hi.py'])
build=run(['npm','run','build:plugin']); node=run(['node','../scripts/run-node-test-suite.mjs'],ROOT/'plugin'); arch=run(['npm','run','architecture:lint']); docs=run(['npm','run','docs:check']); val=run([sys.executable,'scripts/validate.py'])
pm=re.search(r'(\d+) passed',both(py)); nsm=re.findall(r'HI_NODE_TEST_SUMMARY tests=(\d+) pass=(\d+) fail=(\d+) cancelled=(\d+)',both(node)); nm=nsm[-1] if nsm else None; am=re.search(r'ARCHITECTURE LINT PASS rules=(\d+)',both(arch)); dm=re.search(r'documentation parity PASS: docs=(\d+) violations=(\d+)',both(docs))
checks={'python':py.returncode==0 and bool(pm),'build':build.returncode==0,'node':node.returncode==0 and bool(nm) and nm[0]==nm[1] and nm[2]=='0' and nm[3]=='0','architecture':arch.returncode==0 and bool(am),'docs':docs.returncode==0 and bool(dm) and dm.group(2)=='0','validator':val.returncode==0}
out={'schema':1,'kind':'FINAL_CANONICAL_GATES','release':V,'status':'PASS' if all(checks.values()) else 'FAIL','source_checkpoint':{'commit':HEAD,'tree':TREE},'counts':{'python':int(pm.group(1)) if pm else None,'node':int(nm[0]) if nm else None,'architecture':int(am.group(1)) if am else None,'documentation_parity_violations':int(dm.group(2)) if dm else None},'checks':checks,'returncodes':{'python':py.returncode,'build':build.returncode,'node':node.returncode,'architecture':arch.returncode,'docs':docs.returncode,'validator':val.returncode},'claim_boundary':'Fresh canonical final gates at the recorded clean source checkpoint; counts are parsed from terminal PASS summaries, not hand-maintained prose.'}
OUT.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2));sys.exit(0 if out['status']=='PASS' else 1)
