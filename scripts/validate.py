#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ERR=[]
def err(x):ERR.append(x)
version=(ROOT/'VERSION').read_text().strip()
if version!='2.0.10':err(f'VERSION must be 2.0.10: {version}')
identity=json.loads((ROOT/'data/product.json').read_text())
expected={'product_name':'OpenCode HHC Orchestrator','short_name':'OHO','version':version,'repository':'https://github.com/huseyincig/OpenCode-HHC-Orchestrator','plugin_package':'opencode-hhc-orchestrator','runtime_entrypoint':'plugin/dist/plugin.js'}
for k,v in expected.items():
    if identity.get(k)!=v:err(f'product identity {k}: {identity.get(k)!r} != {v!r}')
pkg=json.loads((ROOT/'package.json').read_text())
if pkg.get('name')!='opencode-hhc-orchestrator' or pkg.get('version')!=version:err('root package identity/version mismatch')
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
for forbidden in ('KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','OHO.cmd','OHO.sh','OHO-VALIDATE.cmd','OHO-VALIDATE.sh','OHO-RELEASE-PREP.cmd','OHO-RELEASE-PREP.sh','docs/OHO-TEST-LAB-HANDOFF.md','docs/FLOW-11-COVERAGE.md','docs/NATIVE-FIRST-10-COVERAGE.md','docs/MIGRATION-HHC-NEXT.md'):
    if (ROOT/forbidden).exists():err(f'non-product/legacy file present: {forbidden}')
required_docs={'ARCHITECTURE.md','INSTALLATION.md','SKILLS.md','VALIDATION.md','THREAT-MODEL.md'}
actual_docs={p.name for p in (ROOT/'docs').glob('*.md')}
if actual_docs!=required_docs:err(f'docs set mismatch: {sorted(actual_docs)}')
# Project-local runtime state/config is allowed only at repository root during development.
# Nested .opencode directories are product-source contamination (typically leaked test/runtime state).
for op in ROOT.rglob('.opencode'):
    if op.is_dir() and op.parent != ROOT:
        err(f'nested project-local runtime directory present in product source: {op.relative_to(ROOT).as_posix()}')

# Old product identity and numbered research-document filenames cannot appear in current product surfaces.
legacy=[r'HHC AI Team Kit',r'HHC Next',r'HHC-NEXTGEN',r'HHC-AI-Team-Kit',r'hhc-next\.js',r'\.opencode/hhc-next',r'@hhc-ai/opencode-plugin',r'feature-ledger-09',r'native-first-10',r'flow-11',r'roadmap-source-gates',r'observed-runtime-smoke-1\.18\.16']
allow={'scripts/validate.py','tests/test_oho.py'}
for p in ROOT.rglob('*'):
    # .opencode/ is the project-local runtime control plane (e.g. HHC-AI-Team-Kit bootstrap); the root .gitignore declares it never part of OHO product source.
    if not p.is_file() or any(x in p.parts for x in ('.git','node_modules','dist','.opencode')):continue
    rel=p.relative_to(ROOT).as_posix()
    if rel in allow:continue
    try:t=p.read_text(encoding='utf-8')
    except Exception:continue
    for pattern in legacy:
        if re.search(pattern,t,re.I):err(f'legacy/prototype identity in current path: {rel} / {pattern}')
# Living data contract names.
required_data={'data/product.json','data/validation/implementation-coverage.json','data/validation/native-coverage.json','data/validation/flow-coverage.json','data/validation/flow-acceptance.json','data/validation/source-gates.json','data/validation/release-gates.json','data/validation/source-contracts.json','data/validation/final-dod-audit.json','data/runtime/requirements.json'}
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
if [p.stem for p in roles]!=sorted(['architect','coder','manager','qa-reviewer','repository-explorer','security-reviewer','visual-qa','working-manager']):err('agent role inventory != canonical 8')
if not skills:err('packaged HHC skills missing')
for p in (ROOT/'data').rglob('*.json'):
    try:json.loads(p.read_text())
    except Exception as e:err(f'bad json {p.name}: {e}')
if ERR:
    print('VALIDATION FAIL'); [print('- '+x) for x in ERR]; sys.exit(1)
print('VALIDATION PASS'); print(f'version={version} roles={len(roles)} skills={len(skills)} product=OHO docs={len(actual_docs)}')
