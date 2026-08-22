#!/usr/bin/env python3
from pathlib import Path
import json,re,subprocess,sys

ROOT=Path(__file__).resolve().parents[1]
V=(ROOT/'VERSION').read_text().strip()
OUT=ROOT/f'data/validation/final-gates-{V}.json'
HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
TREE=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True).strip()

def run(cmd,cwd=ROOT,timeout=240):
    return subprocess.run(cmd,cwd=cwd,text=True,capture_output=True,timeout=timeout)

def both(r):
    return (r.stdout or '')+(r.stderr or '')

def tail(r,limit=2400):
    text=both(r).strip()
    return text[-limit:] if text else ''

def parse_counts(py,node,arch,docs):
    pm=re.search(r'(\d+) passed',both(py))
    nsm=re.findall(r'HI_NODE_TEST_SUMMARY tests=(\d+) pass=(\d+) fail=(\d+) cancelled=(\d+)',both(node)); nm=nsm[-1] if nsm else None
    am=re.search(r'ARCHITECTURE LINT PASS rules=(\d+)',both(arch))
    dm=re.search(r'documentation parity PASS: docs=(\d+) violations=(\d+)',both(docs))
    return pm,nm,am,dm

def write_gate(status,checks,returncodes,counts,post=None):
    out={
      'schema':1,'kind':'FINAL_CANONICAL_GATES','release':V,'status':status,
      'source_checkpoint':{'commit':HEAD,'tree':TREE},'counts':counts,
      'checks':checks,'returncodes':returncodes,
      'claim_boundary':'Fresh canonical final gates at the recorded clean source checkpoint; counts are parsed from terminal PASS summaries, not hand-maintained prose.'
    }
    if post is not None: out['post_certification']=post
    OUT.write_text(json.dumps(out,indent=2)+'\n')
    return out

# Phase 1 deliberately runs before a PASS final-gates receipt exists. The final
# certification chain is post-final-gates evidence, so validator/tests must not
# require it until this phase has mechanically passed and the PASS gate exists.
py=run([sys.executable,'-m','pytest','-q','tests/test_hi.py'])
build=run(['npm','run','build:plugin'])
node=run(['node','../scripts/run-node-test-suite.mjs'],ROOT/'plugin')
arch=run(['npm','run','architecture:lint'])
docs=run(['npm','run','docs:check'])
val=run([sys.executable,'scripts/validate.py'])
pm,nm,am,dm=parse_counts(py,node,arch,docs)
checks={
 'python':py.returncode==0 and bool(pm),
 'build':build.returncode==0,
 'node':node.returncode==0 and bool(nm) and nm[0]==nm[1] and nm[2]=='0' and nm[3]=='0',
 'architecture':arch.returncode==0 and bool(am),
 'docs':docs.returncode==0 and bool(dm) and dm.group(2)=='0',
 'validator':val.returncode==0,
}
counts={
 'python':int(pm.group(1)) if pm else None,
 'node':int(nm[0]) if nm else None,
 'architecture':int(am.group(1)) if am else None,
 'documentation_parity_violations':int(dm.group(2)) if dm else None,
}
returncodes={'python':py.returncode,'build':build.returncode,'node':node.returncode,'architecture':arch.returncode,'docs':docs.returncode,'validator':val.returncode}
if not all(checks.values()):
    out=write_gate('FAIL',checks,returncodes,counts)
    print(json.dumps(out,indent=2))
    for name,result in [('python',py),('build',build),('node',node),('architecture',arch),('docs',docs),('validator',val)]:
        if not checks[name]: print(f'--- {name} failure ---\n{tail(result)}')
    raise SystemExit(1)

# The PASS gate now truthfully exists from a complete local run. Generate the
# post-gate §§42-47 chain, then independently re-check validator and the full
# Python suite against that generated chain. If either fails, the gate is
# downgraded to FAIL rather than leaving a self-consistent but unverified PASS.
provisional=write_gate('PASS',checks,returncodes,counts)
cert=run([sys.executable,'scripts/audit-final-certification.py'])
post_val=run([sys.executable,'scripts/validate.py'])
post_py=run([sys.executable,'-m','pytest','-q','tests/test_hi.py'])
post_pm=re.search(r'(\d+) passed',both(post_py))
post={
 'certification_audit':cert.returncode==0,
 'validator':post_val.returncode==0,
 'python':post_py.returncode==0 and bool(post_pm),
 'python_count':int(post_pm.group(1)) if post_pm else None,
 'returncodes':{'certification_audit':cert.returncode,'validator':post_val.returncode,'python':post_py.returncode},
}
status='PASS' if all(post[k] for k in ('certification_audit','validator','python')) else 'FAIL'
if post.get('python_count') is not None: counts['python']=post['python_count']
out=write_gate(status,checks,returncodes,counts,post)
print(json.dumps(out,indent=2))
if status!='PASS':
    for name,result in [('certification_audit',cert),('validator',post_val),('python',post_py)]:
        if not post[name]: print(f'--- post {name} failure ---\n{tail(result)}')
    raise SystemExit(1)

# Rebind §44's test totals/current-projection view to the final PASS receipt and
# verify that the rebind itself preserves the post-gate validator contract.
cert_final=run([sys.executable,'scripts/audit-final-certification.py'])
val_final=run([sys.executable,'scripts/validate.py'])
if cert_final.returncode!=0 or val_final.returncode!=0:
    post['final_rebind']={'certification_audit':cert_final.returncode,'validator':val_final.returncode}
    out=write_gate('FAIL',checks,returncodes,counts,post)
    print(json.dumps(out,indent=2))
    if cert_final.returncode!=0: print('--- final certification rebind failure ---\n'+tail(cert_final))
    if val_final.returncode!=0: print('--- final validator rebind failure ---\n'+tail(val_final))
    raise SystemExit(1)
print('final certification rebind PASS')
