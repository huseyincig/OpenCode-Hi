#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
POLICY=ROOT/'data/documentation-ownership.json'
OUT=ROOT/'data/validation/documentation-inventory.json'

def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p:Path)->str:return p.relative_to(ROOT).as_posix()

def classify(path:str,cfg:dict):
    ac=cfg['artifact_classification']
    if path in ac['root_current']:
        return ('DERIVED_CURRENT' if path=='README.tr.md' else 'CANONICAL_CURRENT','USER' if path.startswith('README') else 'CONTRIBUTOR','HUMAN_OWNED')
    if path.startswith('docs/') and path.count('/')==1:
        name=path.split('/',1)[1]
        if name in ac['docs_current']: return ('CANONICAL_CURRENT','USER' if name in {'INSTALLATION.md','SKILLS.md','HUMAN-DECISIONS.md','PRIVACY.md','PRODUCT-IDENTITY.md'} else 'CONTRIBUTOR','PARITY_VALIDATED')
        if name in ac['docs_historical']: return ('HISTORICAL','HISTORICAL','HUMAN_OWNED')
    prefix='docs/engineering-constitution/'
    if path.startswith(prefix):
        rest=path[len(prefix):]
        if rest.startswith('adrs/'): return ('REFERENCE','ARCHITECT','HUMAN_OWNED')
        if rest.startswith('sources/'): return ('HISTORICAL','HISTORICAL','HUMAN_OWNED')
        if rest in ac['constitution_current']: return ('CANONICAL_CURRENT','ARCHITECT' if rest!='MASTER-CONTINUATION.md' else 'INTERNAL_ENGINEERING','HUMAN_OWNED')
        if rest in ac['constitution_reference']: return ('REFERENCE','ARCHITECT','HUMAN_OWNED')
        if rest in ac['constitution_historical']: return ('HISTORICAL','HISTORICAL','HUMAN_OWNED')
    if path.startswith('roles/') and path.endswith('.md'): return ('DERIVED_CURRENT','CONTRIBUTOR','PARITY_VALIDATED')
    if path.startswith('skills/') and path.endswith('/SKILL.md'): return ('DERIVED_CURRENT','CONTRIBUTOR','PARITY_VALIDATED')
    return None

def main():
    cfg=json.loads(POLICY.read_text(encoding='utf-8'))
    candidates=[]
    for p in [ROOT/'README.md',ROOT/'README.tr.md',ROOT/'CONTRIBUTING.md',ROOT/'SECURITY.md',ROOT/'CHANGELOG.md']:
        if p.is_file(): candidates.append(p)
    candidates += [p for p in (ROOT/'docs').rglob('*') if p.is_file() and p.suffix.lower() in {'.md','.txt'}]
    candidates += [p for p in (ROOT/'roles').glob('*.md') if p.is_file()]
    candidates += [p for p in (ROOT/'skills').glob('*/SKILL.md') if p.is_file()]
    artifacts=[];unclassified=[]
    for p in sorted(set(candidates)):
        r=rel(p); c=classify(r,cfg)
        if not c: unclassified.append(r);continue
        lifecycle,audience,update_mode=c
        artifacts.append({'path':r,'sha256':sha(p),'audience':audience,'lifecycle':lifecycle,'update_mode':update_mode})
    meanings=cfg['meanings']; ids=[m['meaning'] for m in meanings]
    dup=sorted({x for x in ids if ids.count(x)>1})
    missing=[];historical_owner=[]
    bypath={a['path']:a for a in artifacts}
    for m in meanings:
        p=ROOT/m['owner']
        if not p.is_file(): missing.append({'meaning':m['meaning'],'owner':m['owner']});continue
        if m['owner'] in bypath and bypath[m['owner']]['lifecycle']=='HISTORICAL': historical_owner.append({'meaning':m['meaning'],'owner':m['owner']})
    current=sum(1 for a in artifacts if a['lifecycle'] in {'CANONICAL_CURRENT','DERIVED_CURRENT','GENERATED_CURRENT'})
    status='PASS' if not(unclassified or dup or missing or historical_owner) else 'FAIL'
    out={'schema':1,'release':(ROOT/'VERSION').read_text(encoding='utf-8').strip(),'kind':'DOCUMENTATION_TRUTH_INVENTORY','status':status,
         'policy':{'path':rel(POLICY),'sha256':sha(POLICY)},
         'summary':{'artifacts':len(artifacts),'current_or_derived':current,'historical':sum(1 for a in artifacts if a['lifecycle']=='HISTORICAL'),'reference':sum(1 for a in artifacts if a['lifecycle']=='REFERENCE'),'canonical_meanings':len(meanings)},
         'canonical_ownership':meanings,'artifacts':artifacts,
         'violations':{'unclassified':unclassified,'duplicate_meaning_owner':dup,'missing_owner':missing,'historical_as_current_owner':historical_owner},
         'classification_boundary':'Historical engineering/source-study artifacts remain available for provenance but may not own current product truth.'}
    OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f"documentation inventory {status}: artifacts={len(artifacts)} meanings={len(meanings)}")
    if status!='PASS':
        print(json.dumps(out['violations'],indent=2));return 1
    return 0
if __name__=='__main__':sys.exit(main())
