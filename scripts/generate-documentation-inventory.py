#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
POLICY=ROOT/'data/documentation-ownership.json'
OUT=ROOT/'data/validation/documentation-inventory.json'

def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p:Path)->str:return p.relative_to(ROOT).as_posix()

def main():
    cfg=json.loads(POLICY.read_text(encoding='utf-8'))
    public=cfg.get('public_documents') or []
    machine=cfg.get('machine_owners') or []
    areas=[x.get('area') for x in public+machine]
    duplicate=sorted({x for x in areas if areas.count(x)>1})
    artifacts=[];missing=[]
    for x in public:
        path=x['path']; p=ROOT/path
        if not p.is_file(): missing.append(path); continue
        artifacts.append({'path':path,'sha256':sha(p),'area':x['area'],'audience':x['audience'],'lifecycle':'DERIVED_CURRENT' if x['update_mode']=='DERIVED_CURRENT' else 'CANONICAL_CURRENT','update_mode':x['update_mode']})
    machine_rows=[]
    for x in machine:
        p=ROOT/x['path']
        if not p.is_file(): missing.append(x['path']); continue
        machine_rows.append({'path':x['path'],'sha256':sha(p),'area':x['area'],'lifecycle':'MACHINE_OWNER'})
    artifacts.sort(key=lambda x:x['path']); machine_rows.sort(key=lambda x:x['path'])
    docs_count=sum(1 for x in artifacts if x['path'].startswith('docs/') and x['path'].endswith('.md'))
    root_md=[p.name for p in ROOT.glob('*.md') if p.is_file()]
    budget=cfg['policy']['public_docs_budget']; root_budget=cfg['policy']['root_markdown_budget']
    budget_viol=[]
    if docs_count>budget:budget_viol.append(f'public-doc-budget:{docs_count}>{budget}')
    if len(root_md)>root_budget:budget_viol.append(f'root-markdown-budget:{len(root_md)}>{root_budget}')
    # Local-only archive must never be tracked or treated as a current owner.
    tracked_local=False
    import subprocess
    tracked=subprocess.run(['git','ls-files','.project-docs'],cwd=ROOT,text=True,capture_output=True).stdout.strip()
    tracked_local=bool(tracked)
    if tracked_local:budget_viol.append('local-only-docs-are-tracked')
    status='PASS' if not(missing or duplicate or budget_viol) else 'FAIL'
    out={'schema':1,'release':(ROOT/'VERSION').read_text(encoding='utf-8').strip(),'kind':'DOCUMENTATION_TRUTH_INVENTORY','status':status,
      'policy':{'path':rel(POLICY),'sha256':sha(POLICY)},
      'summary':{'public_documents':len(artifacts),'docs_markdown':docs_count,'root_markdown':len(root_md),'machine_owners':len(machine_rows),'canonical_areas':len(areas)},
      'canonical_ownership':public+machine,'artifacts':artifacts,'machine_owners':machine_rows,
      'violations':{'missing':missing,'duplicate_area':duplicate,'budget_or_tracking':budget_viol},
      'classification_boundary':'Only the bounded public manifest owns current human documentation. Local engineering/history notes and Git history may inform maintainers but never own current product truth.'}
    OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    print(f"documentation inventory {status}: public={len(artifacts)} docs={docs_count} root_md={len(root_md)} machine={len(machine_rows)}")
    if status!='PASS':print(json.dumps(out['violations'],indent=2,ensure_ascii=False))
    return 0 if status=='PASS' else 1
if __name__=='__main__':sys.exit(main())
