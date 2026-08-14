#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ERR=[]
def err(x):ERR.append(x)
version=(ROOT/'VERSION').read_text().strip()
if version!='0.1.0':err(f'VERSION must be 0.1.0: {version}')
identity=json.loads((ROOT/'data/product.json').read_text())
expected={'product_name':'OpenCode-Hi','short_name':'HI','version':version,'repository':'https://github.com/huseyincig/OpenCode-Hi','plugin_package':'opencode-hi','runtime_entrypoint':'plugin/dist/plugin.js'}
for k,v in expected.items():
    if identity.get(k)!=v:err(f'product identity {k}: {identity.get(k)!r} != {v!r}')
pkg=json.loads((ROOT/'package.json').read_text())
if pkg.get('name')!='opencode-hi' or pkg.get('version')!=version:err('root package identity/version mismatch')
if pkg.get('main')!='plugin/dist/plugin.js' or not (ROOT/pkg['main']).is_file():err('root plugin entrypoint missing')
pp=json.loads((ROOT/'plugin/package.json').read_text())
if pp.get('version')!=version:err('plugin workspace version mismatch')
if pp.get('allowScripts')!={'msgpackr-extract@3.0.4':True}:err('plugin install-script allowlist mismatch')
lock_path=ROOT/'plugin/package-lock.json'
try:
    lock=json.loads(lock_path.read_text())
    for rel,meta in (lock.get('packages') or {}).items():
        if not rel or meta.get('link'):continue
        if not meta.get('version'):err(f'package-lock entry missing version: {rel}')
        if not meta.get('resolved') or not meta.get('integrity'):err(f'package-lock entry missing resolved/integrity: {rel}')
except Exception as e:err(f'bad plugin package-lock: {e}')
if not re.search(rf'^##\s+(?:\[)?v?{re.escape(version)}(?:\])?(?:\s|$)',(ROOT/'CHANGELOG.md').read_text(),re.M|re.I):err('CHANGELOG current version entry missing')
# Root must remain product-repository clean.
required_root={'README.md','CHANGELOG.md','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY_NOTICES.md','LICENSE','VERSION','package.json'}
for name in required_root:
    if not (ROOT/name).is_file():err(f'required root file missing: {name}')
for forbidden in ('KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','HI.cmd','HI.sh','HI-VALIDATE.cmd','HI-VALIDATE.sh','HI-RELEASE-PREP.cmd','HI-RELEASE-PREP.sh','docs/HI-TEST-LAB-HANDOFF.md','docs/FLOW-11-COVERAGE.md','docs/NATIVE-FIRST-10-COVERAGE.md','docs/MIGRATION-Hi-NEXT.md'):
    if (ROOT/forbidden).exists():err(f'non-product/legacy file present: {forbidden}')
required_docs={'ARCHITECTURE.md','INSTALLATION.md','SKILLS.md','VALIDATION.md','THREAT-MODEL.md','SOURCE-REUSE-MATRIX.md','BASELINE-RECEIPT.md','ARCHITECTURE-REALITY-MAP.md','CONTEXT.md','EXECUTION-POLICY.md','HOSTS.md','HUMAN-DECISIONS.md','PRIVACY.md','PROJECT-INTELLIGENCE.md','RELEASE.md','VERIFICATION.md','BENCHMARKS.md','IMPLEMENTATION-REPORT.md','TERMINOLOGY.md','PRODUCT-IDENTITY.md','FILESYSTEM-LAYOUT.md','STORAGE-ARCHITECTURE.md','STORAGE-OWNERSHIP-MATRIX.md','SKILL-ARTIFACT-OWNERSHIP.md','FINAL-ACCEPTANCE.md'}
actual_docs={p.name for p in (ROOT/'docs').glob('*.md')}
if actual_docs!=required_docs:err(f'docs set mismatch: {sorted(actual_docs)}')
# Project-local runtime state/config is allowed only at repository root during development.
# Nested .opencode directories are product-source contamination (typically leaked test/runtime state).
for op in ROOT.rglob('.opencode'):
    if op.is_dir() and op.parent != ROOT:
        err(f'nested project-local runtime directory present in product source: {op.relative_to(ROOT).as_posix()}')

# Old product identity and numbered research-document filenames cannot appear in current product surfaces.
legacy=[r'Hi AI Team Kit',r'Hi Next',r'Hi-NEXTGEN',r'Hi-AI-Team-Kit',r'hi-next\.js',r'\.opencode/hi-next',r'@hi-ai/opencode-plugin',r'feature-ledger-09',r'native-first-10',r'flow-11',r'roadmap-source-gates',r'observed-runtime-smoke-1\.18\.16']
allow={'scripts/validate.py','tests/test_hi.py'}
for p in ROOT.rglob('*'):
    # .opencode/ is the project-local runtime control plane (e.g. Hi-AI-Team-Kit bootstrap); the root .gitignore declares it never part of HI product source.
    if not p.is_file() or any(x in p.parts for x in ('.git','node_modules','dist','.opencode')):continue
    rel=p.relative_to(ROOT).as_posix()
    if rel in allow:continue
    try:t=p.read_text(encoding='utf-8')
    except Exception:continue
    for pattern in legacy:
        if re.search(pattern,t,re.I):err(f'legacy/prototype identity in current path: {rel} / {pattern}')
# Living data contract names.
required_data={'data/product.json','data/validation/implementation-coverage.json','data/validation/native-coverage.json','data/validation/flow-coverage.json','data/validation/flow-acceptance.json','data/validation/source-gates.json','data/validation/release-gates.json','data/validation/source-contracts.json','data/validation/final-dod-audit.json','data/hi-methodologies.json','data/hi-roles.json','data/validation/benchmarks-0.1.0.json','data/validation/install-lifecycle-0.1.0.json','data/validation/terminology-audit-0.1.0.json','data/validation/projection-receipts.json'}
for rel in required_data:
    if not (ROOT/rel).is_file():err(f'required data contract missing: {rel}')
for old in ('feature-ledger-09-coverage.json','native-first-10-coverage.json','flow-11-coverage.json','flow-11-acceptance.json','roadmap-source-gates.json','observed-runtime-smoke-1.18.16.json'):
    if any(p.name==old for p in (ROOT/'data').rglob('*')):err(f'old data contract name present: {old}')
sc=json.loads((ROOT/'data/validation/source-contracts.json').read_text())
if sc.get('release')!=version:err('source-contracts release stale')
for cid,c in sc.get('contracts',{}).items():
    for evidence in c.get('evidence',[]):
        evidence=evidence.split('#',1)[0]
        if evidence and not (ROOT/evidence).exists():err(f'source-contract {cid} stale evidence: {evidence}')

final_audit=json.loads((ROOT/'data/validation/final-dod-audit.json').read_text())
if final_audit.get('release')!=version:err('final DoD audit release stale')
if final_audit.get('internal_status')!='LOCAL_IMPLEMENTATION_AND_IN_PROCESS_ACCEPTANCE_COMPLETE':err('final DoD internal audit not complete')
if final_audit.get('source_checklist',{}).get('internal_missing')!=[]:err('final DoD audit reports internal missing requirements')
if final_audit.get('release_blocked') is not True:err('final DoD audit must remain release-blocked until external receipts exist')
rg=json.loads((ROOT/'data/validation/release-gates.json').read_text())
if not any(str(v).startswith('PENDING_EXTERNAL') for v in rg.get('gates',{}).values()):err('external runtime gates unexpectedly have no pending evidence')
roles=sorted((ROOT/'roles').glob('*.md')); skills=sorted((ROOT/'skills').glob('*/SKILL.md'))
try:
    role_catalog=json.loads((ROOT/'data/hi-roles.json').read_text())
    if role_catalog.get('schema')!=1 or role_catalog.get('type')!='hi-role-contract-catalog':err('Hi role contract catalog header invalid')
    role_entries=role_catalog.get('roles',[])
    role_ids=[x.get('id') for x in role_entries if isinstance(x,dict)]
    expected_role_ids=sorted(['architect','coder','manager','qa-reviewer','repository-explorer','security-reviewer','visual-qa','working-manager'])
    if sorted(role_ids)!=expected_role_ids or len(role_ids)!=len(set(role_ids)):err('Hi role contract inventory != canonical 8 unique roles')
    known=set(role_ids)
    for item in role_entries:
        if not isinstance(item,dict):err('Hi role contract entry must be object');continue
        rid=item.get('id','')
        if item.get('role_class') not in ('primary','child'):err(f'{rid}: invalid role_class')
        if not isinstance(item.get('read_only'),bool) or not isinstance(item.get('reviewer'),bool):err(f'{rid}: role flags must be boolean')
        if item.get('read_only') and item.get('repository_write_authority')!='none':err(f'{rid}: read-only role has write authority')
        obligations=item.get('obligation_authority',[])
        if not isinstance(obligations,list) or any(x not in ('implementation','analysis','review','verification') for x in obligations):err(f'{rid}: invalid obligation authority')
        if item.get('reviewer') and 'review' not in obligations:err(f'{rid}: reviewer lacks review obligation authority')
        delegation=item.get('delegation',{})
        refs=delegation.get('allowed_role_refs',[]) if isinstance(delegation,dict) else []
        if any(ref not in known for ref in refs):err(f'{rid}: delegation references unknown role')
except Exception as e:err(f'bad Hi role contract catalog: {e}')
if [p.stem for p in roles]!=sorted(['architect','coder','manager','qa-reviewer','repository-explorer','security-reviewer','visual-qa','working-manager']):err('agent role inventory != canonical 8')
if not skills:err('packaged Hi methodologies missing')
try:
    methodology=json.loads((ROOT/'data/hi-methodologies.json').read_text())
    profiles=methodology.get('profiles',[])
    profile_names=[x.get('name') for x in profiles]
    skill_names=[p.parent.name for p in skills]
    if len(profile_names)!=len(set(profile_names)):err('duplicate Hi methodology names')
    if sorted(profile_names)!=sorted(skill_names):err('Hi methodology policy != packaged SKILL.md inventory')
    if methodology.get('policy',{}).get('activation_owner')!='Hi methodology activation':err('Hi methodology activation owner mismatch')
    if methodology.get('policy',{}).get('selection_scope')!='mission-task-or-obligation':err('Hi methodology selection scope mismatch')
    role_permissions={}
    for rp in roles:
        text=rp.read_text()
        fm=text.split('\n---\n',1)[0]
        role_permissions[rp.stem]={m.group(1):m.group(2) for m in re.finditer(r'^\s{4}(hi-[\w-]+):\s*(allow|ask|deny)\s*$',fm,re.M)}
    signal_catalog=methodology.get('signal_catalog',{})
    exit_catalog=methodology.get('exit_requirement_catalog',{})
    if not isinstance(signal_catalog,dict) or not signal_catalog:err('Hi methodology signal catalog missing')
    if not isinstance(exit_catalog,dict) or not exit_catalog:err('Hi methodology exit requirement catalog missing')
    for x in profiles:
        name=x.get('name',''); preferred=x.get('role_affinity',[]); compatible=x.get('compatible_roles',[]); signals=x.get('activation_signals',[]); exits=x.get('exit_requirements',[])
        if not preferred or not compatible:err(f'{name}: methodology roles missing')
        if any(role not in compatible for role in preferred):err(f'{name}: preferred role not compatible')
        if not signals:err(f'{name}: methodology activation_signals missing')
        unknown_signals=[signal for signal in signals if signal not in signal_catalog]
        if unknown_signals:err(f'{name}: unknown methodology activation signals {unknown_signals}')
        derived_sources=[signal_catalog[signal].get('trigger_source') for signal in signals if signal in signal_catalog]
        if not all(isinstance(source,str) and source for source in derived_sources):err(f'{name}: activation signal has invalid trigger source')
        if 'trigger_sources' in x:err(f'{name}: trigger_sources is legacy duplicate truth; derive it from activation_signals')
        if not exits:err(f'{name}: methodology exit_requirements missing')
        unknown_exits=[item for item in exits if item not in exit_catalog]
        if unknown_exits:err(f'{name}: unknown methodology exit requirements {unknown_exits}')
        for role in compatible:
            if role_permissions.get(role,{}).get(name)!='allow':err(f'{name}: compatible role {role} does not allow methodology')
except Exception as e:err(f'bad Hi methodology policy: {e}')
for p in (ROOT/'data').rglob('*.json'):
    try:json.loads(p.read_text())
    except Exception as e:err(f'bad json {p.name}: {e}')
if ERR:
    print('VALIDATION FAIL'); [print('- '+x) for x in ERR]; sys.exit(1)
print('VALIDATION PASS'); print(f'version={version} roles={len(roles)} methodologies={len(skills)} product=HI docs={len(actual_docs)}')
