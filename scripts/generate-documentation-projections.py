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
    replace_block(ROOT/'docs/CONFIGURATION.md','<!-- BEGIN GENERATED CONFIG REFERENCE -->','<!-- END GENERATED CONFIG REFERENCE -->','\n'.join(rows))
    tr_rows=['`data/hi-config-options.json` kaynağından generated edilir. Elle düzenlemeyin.','', '| Alan | Sınıf | Default | Güvenlik semantiği |','|---|---|---|---|']
    for x in cfg['options']:tr_rows.append(f"| `{md(x['path'])}` | {md(x['classification'])} | `{md(x.get('default'))}` | {md(x.get('safety_semantics'))} |")
    replace_block(ROOT/'docs/locales/tr/CONFIGURATION.md','<!-- BEGIN GENERATED CONFIG REFERENCE -->','<!-- END GENERATED CONFIG REFERENCE -->','\n'.join(tr_rows))
    cm=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))
    cur=cm['current_reference_host']; rows=[f"Generated from `data/validation/compatibility-matrix-0.1.0.json`. Current recorded exact host: OpenCode `{cur['opencode_version']}` on `{cur['platform']}/{cur['architecture']}`.",'','| Hi capability | Status | Exact source | Receipt |','|---|---|---|---|']
    for cap,x in sorted(cur['capabilities'].items()):
        rows.append(f"| `{cap}` | **{x['status']}** | `{x['tested_git_commit']}` | `{x['receipt']}` |")
    rows += ['','This table is a projection, not evidence ownership: the referenced exact receipts remain the capability proof. Historical negative/older receipts remain preserved in the generated compatibility history.']
    replace_block(ROOT/'docs/HOSTS.md','<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->','<!-- END GENERATED HOST CAPABILITY MATRIX -->','\n'.join(rows))

    print(f"documentation projections generated: config={len(cfg['options'])} capabilities={len(cur['capabilities'])}")
    return 0
if __name__=='__main__':sys.exit(main())
