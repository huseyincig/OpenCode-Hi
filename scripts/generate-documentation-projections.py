#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]

def replace_block(path:Path,begin:str,end:str,body:str):
    text=path.read_text(encoding='utf-8')
    if text.count(begin)!=1 or text.count(end)!=1:raise RuntimeError(f'marker count invalid: {path}')
    a=text.index(begin)+len(begin); b=text.index(end,a)
    path.write_text(text[:a]+'\n'+body.rstrip()+'\n'+text[b:],encoding='utf-8',newline='\n')
def md(value):
    if not isinstance(value,str): value=json.dumps(value,separators=(',',':'),ensure_ascii=False)
    return str(value).replace('|','\\|').replace('\n',' ')
def main():
    cfg=json.loads((ROOT/'data/hi-config-options.json').read_text(encoding='utf-8'))
    rows=['Generated from `data/hi-config-options.json`. Do not hand-edit this table.','', '| Path | Class | Default | Safety | Executable/diagnostic effect |','|---|---|---|---|---|']
    for x in cfg['options']:
        effect=x.get('executor_effect') or x.get('diagnostic_effect') or ''
        rows.append(f"| `{md(x['path'])}` | {md(x['classification'])} | `{md(x.get('default'))}` | {md(x.get('safety_semantics'))} | {md(effect)} |")
    replace_block(ROOT/'docs/INSTALLATION.md','<!-- BEGIN GENERATED CONFIG REFERENCE -->','<!-- END GENERATED CONFIG REFERENCE -->','\n'.join(rows))
    cm=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))
    cur=cm['current_reference_host']; rows=[f"Generated from `data/validation/compatibility-matrix-0.1.0.json`. Current recorded exact host: OpenCode `{cur['opencode_version']}` on `{cur['platform']}/{cur['architecture']}`.",'','| Hi capability | Status | Exact source | Receipt |','|---|---|---|---|']
    for cap,x in sorted(cur['capabilities'].items()):
        rows.append(f"| `{cap}` | **{x['status']}** | `{x['tested_git_commit']}` | `{x['receipt']}` |")
    rows += ['','This table is a projection, not evidence ownership: the referenced exact receipts remain the capability proof. Historical negative/older receipts remain preserved in the generated compatibility history.']
    replace_block(ROOT/'docs/HOSTS.md','<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->','<!-- END GENERATED HOST CAPABILITY MATRIX -->','\n'.join(rows))
    pti=json.loads((ROOT/'data/validation/product-truth-inventory.json').read_text(encoding='utf-8'))
    rows=['Generated from `data/validation/product-truth-inventory.json`. This is a trace projection, not a semantic owner.','', '| Area | Canonical owner | Owner source | Consumer/executor | Proof | Canonical doc |','|---|---|---|---|---|---|']
    for x in pti['areas']:
        consumers='<br>'.join(f"`{v}`" for v in x['consumer_or_executor_paths']) or '—'
        proofs='<br>'.join(f"`{v}`" for v in x['proof_paths']) or '—'
        rows.append(f"| `{x['area']}` | {x['canonical_owner']} | `{x['owner_path']}` | {consumers} | {proofs} | `{x['canonical_doc']}` |")
    replace_block(ROOT/'docs/ARCHITECTURE-REALITY-MAP.md','<!-- BEGIN GENERATED PRODUCT TRUTH TRACE -->','<!-- END GENERATED PRODUCT TRUTH TRACE -->','\n'.join(rows))

    print(f"documentation projections generated: config={len(cfg['options'])} capabilities={len(cur['capabilities'])} product areas={len(pti['areas'])}")
    return 0
if __name__=='__main__':sys.exit(main())
