#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
POLICY=ROOT/'data/documentation-ownership.json'
OUT=ROOT/'data/validation/documentation-parity.json'

def rel(p:Path)->str:return p.relative_to(ROOT).as_posix()
def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def links(text:str):
    for m in re.finditer(r'!?\[[^\]]*\]\(([^)]+)\)',text):
        target=m.group(1).strip().split()[0].strip('<>')
        if not target or target.startswith(('#','http://','https://','mailto:')):continue
        yield target.split('#',1)[0]
def main():
    errors=[]; cfg=json.loads(POLICY.read_text(encoding='utf-8'))
    docs=[]
    for row in cfg.get('public_documents') or []:
        p=ROOT/row['path']
        if not p.is_file(): errors.append({'code':'DOC_PUBLIC_OWNER_MISSING','path':row['path']});continue
        docs.append(p)
    version=(ROOT/'VERSION').read_text(encoding='utf-8').strip();pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'));pp=json.loads((ROOT/'plugin/package.json').read_text(encoding='utf-8'));product=json.loads((ROOT/'data/product.json').read_text(encoding='utf-8'))
    if not(version==pkg.get('version')==pp.get('version')==product.get('version')):errors.append({'code':'DOC_VERSION_PARITY'})
    if pkg.get('name')!='opencode-hi' or product.get('plugin_package')!='opencode-hi':errors.append({'code':'DOC_PACKAGE_PARITY'})
    # Public surface must remain bounded. Historical/internal docs are local-only and never required by CI.
    public_docs=[p for p in (ROOT/'docs').rglob('*.md') if p.is_file()]
    if len(public_docs)>cfg['policy']['public_docs_budget']:errors.append({'code':'DOC_BUDGET_EXCEEDED','detail':len(public_docs)})
    engineering=set(cfg['policy'].get('engineering_state_root_markdown') or []); root_md=[p for p in ROOT.glob('*.md') if p.is_file() and p.name not in engineering]
    if len(root_md)>cfg['policy']['root_markdown_budget']:errors.append({'code':'ROOT_MD_BUDGET_EXCEEDED','detail':[p.name for p in root_md]})
    for forbidden in ('README.tr.md','CONTRIBUTING.md','SECURITY.md'):
        if (ROOT/forbidden).exists():errors.append({'code':'ROOT_DOC_SHOULD_MOVE_TO_SUPPORTED_LOCATION','path':forbidden})
    if (ROOT/'docs/engineering-constitution').exists():errors.append({'code':'PUBLIC_INTERNAL_ENGINEERING_TREE_PRESENT'})
    if '.project-docs/' not in (ROOT/'.gitignore').read_text(encoding='utf-8'):errors.append({'code':'LOCAL_DOCS_IGNORE_MISSING'})
    if subprocess.run(['git','ls-files','.project-docs'],cwd=ROOT,text=True,capture_output=True).stdout.strip():errors.append({'code':'LOCAL_DOCS_TRACKED'})
    local_engineering=['AGENTS.md','PROJECT_POLICY.md','PROTOCOL.md','ROADMAP.md','TASKS.md','agent-archive']
    ignore_text=(ROOT/'.gitignore').read_text(encoding='utf-8')
    required_ignores=['/AGENTS.md','/PROJECT_POLICY.md','/PROTOCOL.md','/ROADMAP.md','/TASKS.md','/agent-archive/']
    missing_ignores=[x for x in required_ignores if x not in ignore_text]
    if missing_ignores:errors.append({'code':'LOCAL_ENGINEERING_IGNORE_MISSING','paths':missing_ignores})
    tracked_local=subprocess.run(['git','ls-files','--',*local_engineering],cwd=ROOT,text=True,capture_output=True).stdout.splitlines()
    if tracked_local:errors.append({'code':'LOCAL_ENGINEERING_STATE_TRACKED','paths':tracked_local})
    stale=[
      ('STALE_PREPUBLICATION',r'npm bootstrap publication is not yet complete|current npm bootstrap remains blocked|not considered registry-available until final T4|final label remains \*\*PARTIAL\*\*'),
      ('STALE_CAPABILITY',r'process lifecycle remains DEGRADED|workspace[- ]isolation(?: binding)? remains UNSUPPORTED|browser[- ]execution remains UNSUPPORTED'),
      ('STALE_INTERNAL_DOC_OWNER',r'docs/engineering-constitution/|SOURCE-REUSE-MATRIX|FINAL-SYSTEM-CERTIFICATION\.md|ARCHITECTURE-REALITY-MAP\.md'),
    ]
    for p in docs:
        text=p.read_text(encoding='utf-8',errors='replace')
        for code,pat in stale:
            if re.search(pat,text,re.I):errors.append({'code':code,'path':rel(p)})
        for target in links(text):
            dest=(p.parent/target).resolve()
            try:dest.relative_to(ROOT.resolve())
            except ValueError:errors.append({'code':'DOC_LINK_ESCAPE','path':rel(p),'target':target});continue
            if not dest.exists():errors.append({'code':'DOC_BROKEN_LOCAL_LINK','path':rel(p),'target':target})
        if '.project-docs/' in text:errors.append({'code':'PUBLIC_DOC_LINKS_LOCAL_ONLY','path':rel(p)})
    compat=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))
    caps=(compat.get('current_reference_host') or {}).get('capabilities') or {}
    for required in ('process-lifecycle','workspace-isolation-binding','browser-execution'):
        if (caps.get(required) or {}).get('status')!='SUPPORTED_T3':errors.append({'code':'DOC_HOST_SUPPORT_INPUT','detail':required})
    release=json.loads((ROOT/f'data/validation/release-status-{version}.json').read_text(encoding='utf-8'))
    readme=(ROOT/'README.md').read_text(encoding='utf-8');install=(ROOT/'docs/INSTALLATION.md').read_text(encoding='utf-8');configuration=(ROOT/'docs/CONFIGURATION.md').read_text(encoding='utf-8');configuration_tr=(ROOT/'docs/locales/tr/CONFIGURATION.md').read_text(encoding='utf-8');hosts=(ROOT/'docs/HOSTS.md').read_text(encoding='utf-8');arch=(ROOT/'docs/ARCHITECTURE.md').read_text(encoding='utf-8')
    candidate=release.get('candidate') or {}; npm_status=candidate.get('npm_status'); github_status=candidate.get('github_status')
    tr_path=ROOT/'docs/locales/tr/README.md'; tr=tr_path.read_text(encoding='utf-8') if tr_path.is_file() else ''
    release_gates=json.loads((ROOT/'data/validation/release-gates.json').read_text(encoding='utf-8'))
    expected_tool_count=((release_gates.get('current_local_evidence') or {}).get('fresh_consumer') or {}).get('expected_hi_tool_count')
    if not isinstance(expected_tool_count,int) or expected_tool_count<=0:
        errors.append({'code':'DOC_RUNTIME_TOOL_COUNT_INPUT','expected':'positive current expected_hi_tool_count'})
    else:
        tool_count_claims=[
          ('README.md',readme,rf'\*\*{expected_tool_count} `hi_\*` tools\*\*'),
          ('docs/INSTALLATION.md',install,rf'observes {expected_tool_count} runtime tools'),
          ('docs/locales/tr/README.md',tr,rf'\*\*{expected_tool_count} adet `hi_\*` runtime tool\*\*'),
        ]
        for path,text,pattern in tool_count_claims:
            if not re.search(pattern,text):errors.append({'code':'DOC_RUNTIME_TOOL_COUNT_DRIFT','path':path,'expected':expected_tool_count})
    if f'`{version}`' not in tr:errors.append({'code':'DOC_LOCALIZED_VERSION_DRIFT','path':'docs/locales/tr/README.md','expected':version})
    stale_localized=r'npm bootstrap|registry package oluşana kadar|npm[^\n]{0,180}(henüz|mevcut değildir|açık değildir|blocked|not yet|unavailable)|release-status-0\.1\.0'
    if npm_status=='PASS_T4' and github_status=='PASS_T4':
        if f'`{version}`' not in readme or 'Published availability is external state' not in readme:errors.append({'code':'DOC_RELEASE_PUBLICATION_DRIFT','path':'README.md'})
        if re.search(r'npm[^\n]{0,180}(blocked|not yet|unavailable)',install,re.I):errors.append({'code':'DOC_INSTALL_PREPUBLICATION_DRIFT','path':'docs/INSTALLATION.md'})
        if f'opencode-hi@{version}' not in tr or re.search(stale_localized,tr,re.I):errors.append({'code':'DOC_LOCALIZED_RELEASE_DRIFT','path':'docs/locales/tr/README.md','expected':f'opencode-hi@{version} published'})
    if hosts.count('<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->')!=1 or hosts.count('<!-- END GENERATED HOST CAPABILITY MATRIX -->')!=1:errors.append({'code':'DOC_HOST_GENERATED_MARKER'})
    if install.count('<!-- BEGIN GENERATED CONFIG REFERENCE -->')!=1 or install.count('<!-- END GENERATED CONFIG REFERENCE -->')!=1:errors.append({'code':'DOC_CONFIG_GENERATED_MARKER'})
    if configuration.count('<!-- BEGIN GENERATED CONFIG REFERENCE -->')!=1 or configuration.count('<!-- END GENERATED CONFIG REFERENCE -->')!=1:errors.append({'code':'DOC_CONFIGURATION_GUIDE_GENERATED_MARKER'})
    if configuration_tr.count('<!-- BEGIN GENERATED CONFIG REFERENCE -->')!=1 or configuration_tr.count('<!-- END GENERATED CONFIG REFERENCE -->')!=1:errors.append({'code':'DOC_CONFIGURATION_GUIDE_TR_GENERATED_MARKER'})
    options=json.loads((ROOT/'data/hi-config-options.json').read_text(encoding='utf-8')).get('options',[])
    for option in options:
        marker=f"`{option.get('path')}`"
        if marker not in install:errors.append({'code':'DOC_CONFIG_OPTION_OMITTED','detail':option.get('path')})
        if marker not in configuration:errors.append({'code':'DOC_CONFIGURATION_GUIDE_OPTION_OMITTED','detail':option.get('path')})
        if marker not in configuration_tr:errors.append({'code':'DOC_CONFIGURATION_GUIDE_TR_OPTION_OMITTED','detail':option.get('path')})
    if '[Configuration Guide](docs/CONFIGURATION.md)' not in readme:errors.append({'code':'README_CONFIGURATION_GUIDE_LINK_MISSING'})
    if '[Türkçe Kurulum ve Yapılandırma Rehberi](CONFIGURATION.md)' not in tr:errors.append({'code':'TR_README_CONFIGURATION_GUIDE_LINK_MISSING'})
    for cap,row in caps.items():
        if f'`{cap}`' not in hosts or f"**{row.get('status')}**" not in hosts:errors.append({'code':'DOC_HOST_MATRIX_DRIFT','detail':cap})
    if 'only `TypeScriptSemanticContextAdapter`' not in hosts:errors.append({'code':'DOC_SEMANTIC_ADAPTER_BOUNDARY','path':'docs/HOSTS.md'})
    if '## Context and Project Intelligence' not in arch or '## Storage and filesystem ownership' not in arch:errors.append({'code':'DOC_ARCHITECTURE_CONSOLIDATION_DRIFT','path':'docs/ARCHITECTURE.md'})
    # Required community-health surfaces that do not need invented contact details.
    for path in ('.github/CONTRIBUTING.md','.github/SECURITY.md','.github/SUPPORT.md','.github/pull_request_template.md','.github/ISSUE_TEMPLATE/bug_report.yml','.github/ISSUE_TEMPLATE/feature_request.yml'):
        if not (ROOT/path).is_file():errors.append({'code':'COMMUNITY_FILE_MISSING','path':path})
    status='PASS' if not errors else 'FAIL'
    out={'schema':1,'release':version,'kind':'DOCUMENTATION_PARITY','status':status,
      'inputs':{'documentation_ownership':{'path':rel(POLICY),'sha256':sha(POLICY)},'compatibility':{'path':'data/validation/compatibility-matrix-0.1.0.json','sha256':sha(ROOT/'data/validation/compatibility-matrix-0.1.0.json')},'release_status':{'path':f'data/validation/release-status-{version}.json','sha256':sha(ROOT/f'data/validation/release-status-{version}.json')}},
      'checked_current_documents':[rel(p) for p in docs],
      'checks':{'bounded_public_surface':True,'local_markdown_links':True,'stale_current_status_patterns':True,'release_availability':True,'localized_version_parity':True,'localized_release_status':True,'host_capabilities':True,'generated_config_host_projections':True,'community_health_files':True},'violations':errors}
    OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    print(f'documentation parity {status}: docs={len(docs)} violations={len(errors)}')
    if errors:print(json.dumps(errors,indent=2,ensure_ascii=False))
    return 0 if status=='PASS' else 1
if __name__=='__main__':sys.exit(main())
