#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
POLICY=ROOT/'data/documentation-ownership.json'
OUT=ROOT/'data/validation/documentation-parity-0.1.0.json'

def rel(p:Path)->str:return p.relative_to(ROOT).as_posix()
def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def current_docs(policy):
    ac=policy['artifact_classification']; out=[]
    for n in ac['root_current']:
        p=ROOT/n
        if p.is_file():out.append(p)
    for n in ac['docs_current']:
        p=ROOT/'docs'/n
        if p.is_file():out.append(p)
    for n in ac['constitution_current']:
        p=ROOT/'docs/engineering-constitution'/n
        if p.is_file():out.append(p)
    return sorted(set(out))
def links(path:Path,text:str):
    # Markdown inline links only; images are also file refs and are validated.
    out=[]
    for m in re.finditer(r'!?\[[^\]]*\]\(([^)]+)\)',text):
        target=m.group(1).strip().split()[0].strip('<>')
        if not target or target.startswith(('#','http://','https://','mailto:')):continue
        target=target.split('#',1)[0]
        if not target:continue
        out.append((m.start(),target))
    return out
def main():
    errors=[]; policy=json.loads(POLICY.read_text()); docs=current_docs(policy)
    version=(ROOT/'VERSION').read_text().strip(); pkg=json.loads((ROOT/'package.json').read_text()); pp=json.loads((ROOT/'plugin/package.json').read_text()); product=json.loads((ROOT/'data/product.json').read_text())
    compat=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text()); release=json.loads((ROOT/'data/validation/release-status-0.1.0.json').read_text())
    if not(version==pkg.get('version')==pp.get('version')==product.get('version')):errors.append({'code':'DOC_VERSION_PARITY','detail':'VERSION/package/plugin/product mismatch'})
    if pkg.get('name')!='opencode-hi' or product.get('plugin_package')!='opencode-hi':errors.append({'code':'DOC_PACKAGE_PARITY','detail':'canonical package mismatch'})
    cap={k:v.get('status') for k,v in (compat.get('current_reference_host',{}).get('capabilities') or {}).items()}
    for required in ('process-lifecycle','workspace-isolation-binding','browser-execution'):
        if cap.get(required)!='SUPPORTED_T3':errors.append({'code':'DOC_HOST_SUPPORT_INPUT','detail':f'{required} not SUPPORTED_T3 in generated compatibility'})
    readme=(ROOT/'README.md').read_text(); hosts=(ROOT/'docs/HOSTS.md').read_text(); install=(ROOT/'docs/INSTALLATION.md').read_text(); context=(ROOT/'docs/CONTEXT.md').read_text()
    stale=[
      ('STALE_CANDIDATE',r'first coherent OpenCode-Hi candidate|exact 0[.]1[.]0 supported-host statement is bound only after|guaranteed[^\n]{0,60}candidate'),
      ('STALE_PROCESS_SUPPORT',r'process lifecycle remains DEGRADED'),
      ('STALE_WORKSPACE_SUPPORT',r'workspace[- ]isolation(?: binding)? remains UNSUPPORTED'),
      ('STALE_BROWSER_SUPPORT',r'browser[- ]execution remains UNSUPPORTED'),
      ('STALE_GIT_PACKAGE_SPEC',r'opencode-hi@git[+]https://github[.]com/huseyincig/OpenCode-Hi[.]git#'),
    ]
    for p in docs:
        text=p.read_text(errors='replace')
        for code,pat in stale:
            if re.search(pat,text,re.I):errors.append({'code':code,'path':rel(p)})
        for pos,target in links(p,text):
            dest=(p.parent/target).resolve()
            try: dest.relative_to(ROOT.resolve())
            except ValueError:
                errors.append({'code':'DOC_LINK_ESCAPE','path':rel(p),'target':target});continue
            if not dest.exists():errors.append({'code':'DOC_BROKEN_LOCAL_LINK','path':rel(p),'target':target})
    if release.get('npm',{}).get('status')=='BLOCKED_T4_AUTH':
        if not re.search(r'npm[^\n]{0,160}(?:not currently available|not yet|blocked)',readme,re.I|re.S):errors.append({'code':'DOC_NPM_AVAILABILITY_DRIFT','path':'README.md'})
        if not re.search(r'npm[^\n]{0,180}(?:blocked|not yet)',install,re.I|re.S):errors.append({'code':'DOC_NPM_INSTALL_DRIFT','path':'docs/INSTALLATION.md'})
    for phrase in ('`process-lifecycle` is `SUPPORTED`','workspace-isolation-binding` is `SUPPORTED`','browser-execution` is `SUPPORTED`'):
        if phrase not in hosts:errors.append({'code':'DOC_HOST_CAPABILITY_OMITTED','path':'docs/HOSTS.md','detail':phrase})
    if 'only `TypeScriptSemanticContextAdapter`' not in hosts or 'JavaScript, LSP-backed and Tree-sitter-backed semantic adapters are not implemented or advertised' not in context:
        errors.append({'code':'DOC_SEMANTIC_ADAPTER_DRIFT','detail':'semantic adapter support boundary missing'})
    if 'contains no raw stdout/stderr buffer' not in (ROOT/'docs/ARCHITECTURE.md').read_text():errors.append({'code':'DOC_PROCESS_CONTRACT_DRIFT','path':'docs/ARCHITECTURE.md'})
    status='PASS' if not errors else 'FAIL'
    out={'schema':1,'release':version,'kind':'DOCUMENTATION_PARITY','status':status,
         'inputs':{'documentation_ownership':{'path':rel(POLICY),'sha256':sha(POLICY)},'compatibility':{'path':'data/validation/compatibility-matrix-0.1.0.json','sha256':sha(ROOT/'data/validation/compatibility-matrix-0.1.0.json')},'release_status':{'path':'data/validation/release-status-0.1.0.json','sha256':sha(ROOT/'data/validation/release-status-0.1.0.json')}},
         'checked_current_documents':[rel(p) for p in docs],
         'checks':{'version_package_product_parity':True,'local_markdown_links':True,'stale_current_status_patterns':True,'release_availability':True,'host_capabilities':True,'semantic_adapter_boundary':True},
         'violations':errors}
    OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
    print(f'documentation parity {status}: docs={len(docs)} violations={len(errors)}')
    if errors: print(json.dumps(errors,indent=2,ensure_ascii=False))
    return 0 if status=='PASS' else 1
if __name__=='__main__':sys.exit(main())
