#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
POLICY=ROOT/'data/documentation-ownership.json'
OUT=ROOT/'data/validation/documentation-parity.json'

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
    errors=[]; policy=json.loads(POLICY.read_text(encoding='utf-8')); docs=current_docs(policy)
    version=(ROOT/'VERSION').read_text(encoding='utf-8').strip(); pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8')); pp=json.loads((ROOT/'plugin/package.json').read_text(encoding='utf-8')); product=json.loads((ROOT/'data/product.json').read_text(encoding='utf-8'))
    compat=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8')); release=json.loads((ROOT/f'data/validation/release-status-{version}.json').read_text(encoding='utf-8'))
    if not(version==pkg.get('version')==pp.get('version')==product.get('version')):errors.append({'code':'DOC_VERSION_PARITY','detail':'VERSION/package/plugin/product mismatch'})
    if pkg.get('name')!='opencode-hi' or product.get('plugin_package')!='opencode-hi':errors.append({'code':'DOC_PACKAGE_PARITY','detail':'canonical package mismatch'})
    cap={k:v.get('status') for k,v in (compat.get('current_reference_host',{}).get('capabilities') or {}).items()}
    for required in ('process-lifecycle','workspace-isolation-binding','browser-execution'):
        if cap.get(required)!='SUPPORTED_T3':errors.append({'code':'DOC_HOST_SUPPORT_INPUT','detail':f'{required} not SUPPORTED_T3 in generated compatibility'})
    readme=(ROOT/'README.md').read_text(encoding='utf-8'); hosts=(ROOT/'docs/HOSTS.md').read_text(encoding='utf-8'); install=(ROOT/'docs/INSTALLATION.md').read_text(encoding='utf-8'); context=(ROOT/'docs/CONTEXT.md').read_text(encoding='utf-8')
    stale=[
      ('STALE_CANDIDATE',r'first coherent OpenCode-Hi candidate|exact 0[.]1[.]0 supported-host statement is bound only after|guaranteed[^\n]{0,60}candidate'),
      ('STALE_PROCESS_SUPPORT',r'process lifecycle remains DEGRADED'),
      ('STALE_WORKSPACE_SUPPORT',r'workspace[- ]isolation(?: binding)? remains UNSUPPORTED'),
      ('STALE_BROWSER_SUPPORT',r'browser[- ]execution remains UNSUPPORTED'),
      ('STALE_GIT_PACKAGE_SPEC',r'opencode-hi@git[+]https://github[.]com/huseyincig/OpenCode-Hi[.]git#'),
      ('STALE_PROCESS_GOVERNOR',r'ProcessGovernor'),
      ('STALE_FUTURE_WORKSPACE_ADAPTER',r'future Git/OpenCode adapter'),
      ('STALE_N1_FUTURE',r'Final source-driven normalization is reserved for `N1|N1[^\n]{0,100}after the engineering work-package program completes'),
      ('STALE_PRODUCT_VERSION_IDENTITY',r'OpenCode-Hi 0[.]1[.]0 is a new product identity'),
    ]
    for p in docs:
        text=p.read_text(encoding='utf-8',errors='replace')
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
    observed_boundary=('Runtime capability contracts report only what the active host actually exposes' in hosts and '`SUPPORTED` or `UNSUPPORTED` at verification level `OBSERVED`' in hosts and 'cannot promote `REAL_HOST_ACCEPTANCE` or T3' in hosts)
    if not observed_boundary:errors.append({'code':'DOC_HOST_OBSERVED_T3_BOUNDARY','path':'docs/HOSTS.md','detail':'runtime OBSERVED capability health must remain distinct from external T3 certification'})
    if 'only `TypeScriptSemanticContextAdapter`' not in hosts or 'JavaScript, LSP-backed and Tree-sitter-backed semantic adapters are not implemented or advertised' not in context:
        errors.append({'code':'DOC_SEMANTIC_ADAPTER_DRIFT','detail':'semantic adapter support boundary missing'})
    if 'contains no raw stdout/stderr buffer' not in (ROOT/'docs/ARCHITECTURE.md').read_text(encoding='utf-8'):errors.append({'code':'DOC_PROCESS_CONTRACT_DRIFT','path':'docs/ARCHITECTURE.md'})
    config_doc=(ROOT/'docs/INSTALLATION.md').read_text(encoding='utf-8'); host_doc=(ROOT/'docs/HOSTS.md').read_text(encoding='utf-8')
    if config_doc.count('<!-- BEGIN GENERATED CONFIG REFERENCE -->')!=1 or config_doc.count('<!-- END GENERATED CONFIG REFERENCE -->')!=1:errors.append({'code':'DOC_CONFIG_GENERATED_MARKER','path':'docs/INSTALLATION.md'})
    for option in json.loads((ROOT/'data/hi-config-options.json').read_text(encoding='utf-8')).get('options',[]):
        if f"`{option.get('path')}`" not in config_doc:errors.append({'code':'DOC_CONFIG_OPTION_OMITTED','path':'docs/INSTALLATION.md','detail':option.get('path')})
    if host_doc.count('<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->')!=1 or host_doc.count('<!-- END GENERATED HOST CAPABILITY MATRIX -->')!=1:errors.append({'code':'DOC_HOST_GENERATED_MARKER','path':'docs/HOSTS.md'})
    for cap,entry in (compat.get('current_reference_host',{}).get('capabilities') or {}).items():
        if f"`{cap}`" not in host_doc or f"**{entry.get('status')}**" not in host_doc or f"`{entry.get('receipt')}`" not in host_doc:errors.append({'code':'DOC_HOST_MATRIX_DRIFT','path':'docs/HOSTS.md','detail':cap})
    if not (ROOT/'scripts/generate-documentation-projections.py').is_file():errors.append({'code':'DOC_PROJECTION_GENERATOR_MISSING'})

    status='PASS' if not errors else 'FAIL'
    out={'schema':1,'release':version,'kind':'DOCUMENTATION_PARITY','status':status,
         'inputs':{'documentation_ownership':{'path':rel(POLICY),'sha256':sha(POLICY)},'compatibility':{'path':'data/validation/compatibility-matrix-0.1.0.json','sha256':sha(ROOT/'data/validation/compatibility-matrix-0.1.0.json')},'release_status':{'path':f'data/validation/release-status-{version}.json','sha256':sha(ROOT/f'data/validation/release-status-{version}.json')}},
         'checked_current_documents':[rel(p) for p in docs],
         'checks':{'version_package_product_parity':True,'local_markdown_links':True,'stale_current_status_patterns':True,'release_availability':True,'host_capabilities':True,'semantic_adapter_boundary':True},
         'violations':errors}
    OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    print(f'documentation parity {status}: docs={len(docs)} violations={len(errors)}')
    if errors: print(json.dumps(errors,indent=2,ensure_ascii=False))
    return 0 if status=='PASS' else 1
if __name__=='__main__':sys.exit(main())
