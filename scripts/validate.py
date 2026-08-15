#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; ERR=[]
def err(x):ERR.append(x)
version=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
if not re.fullmatch(r'(?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?',version):err(f'VERSION is not valid SemVer: {version}')
identity=json.loads((ROOT/'data/product.json').read_text(encoding='utf-8'))
expected={'product_name':'OpenCode-Hi','short_name':'HI','version':version,'repository':'https://github.com/huseyincig/OpenCode-Hi','plugin_package':'opencode-hi','runtime_entrypoint':'plugin/dist/plugin.js'}
for k,v in expected.items():
    if identity.get(k)!=v:err(f'product identity {k}: {identity.get(k)!r} != {v!r}')
pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
if pkg.get('name')!='opencode-hi' or pkg.get('version')!=version:err('root package identity/version mismatch')
if pkg.get('main')!='plugin/dist/plugin.js' or not (ROOT/pkg['main']).is_file():err('root plugin entrypoint missing')
pp=json.loads((ROOT/'plugin/package.json').read_text(encoding='utf-8'))
if pp.get('version')!=version:err('plugin workspace version mismatch')
if pp.get('allowScripts')!={'msgpackr-extract@3.0.4':True}:err('plugin install-script allowlist mismatch')
lock_path=ROOT/'plugin/package-lock.json'
try:
    lock=json.loads(lock_path.read_text(encoding='utf-8'))
    for rel,meta in (lock.get('packages') or {}).items():
        if not rel or meta.get('link'):continue
        if not meta.get('version'):err(f'package-lock entry missing version: {rel}')
        if not meta.get('resolved') or not meta.get('integrity'):err(f'package-lock entry missing resolved/integrity: {rel}')
except Exception as e:err(f'bad plugin package-lock: {e}')
if not re.search(rf'^##\s+(?:\[)?v?{re.escape(version)}(?:\])?(?:\s|$)',(ROOT/'CHANGELOG.md').read_text(encoding='utf-8'),re.M|re.I):err('CHANGELOG current version entry missing')
# Root must remain product-repository clean.
required_root={'README.md','CHANGELOG.md','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY_NOTICES.md','LICENSE','VERSION','package.json'}
for name in required_root:
    if not (ROOT/name).is_file():err(f'required root file missing: {name}')
for forbidden in ('KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','HI.cmd','HI.sh','HI-VALIDATE.cmd','HI-VALIDATE.sh','HI-RELEASE-PREP.cmd','HI-RELEASE-PREP.sh','docs/HI-TEST-LAB-HANDOFF.md','docs/FLOW-11-COVERAGE.md','docs/NATIVE-FIRST-10-COVERAGE.md','docs/MIGRATION-Hi-NEXT.md'):
    if (ROOT/forbidden).exists():err(f'non-product/legacy file present: {forbidden}')
required_docs={'ARCHITECTURE.md','INSTALLATION.md','SKILLS.md','VALIDATION.md','THREAT-MODEL.md','SOURCE-REUSE-MATRIX.md','BASELINE-RECEIPT.md','ARCHITECTURE-REALITY-MAP.md','CONTEXT.md','EXECUTION-POLICY.md','HOSTS.md','HUMAN-DECISIONS.md','PRIVACY.md','PROJECT-INTELLIGENCE.md','RELEASE.md','VERIFICATION.md','BENCHMARKS.md','IMPLEMENTATION-REPORT.md','TERMINOLOGY.md','PRODUCT-IDENTITY.md','FILESYSTEM-LAYOUT.md','STORAGE-ARCHITECTURE.md','STORAGE-OWNERSHIP-MATRIX.md','SKILL-ARTIFACT-OWNERSHIP.md','FINAL-ACCEPTANCE.md','HI-NAMING-NAMESPACE.md'}
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


try:
    pti=json.loads((ROOT/'data/validation/product-truth-inventory.json').read_text(encoding='utf-8'))
    if pti.get('schema')!=1 or pti.get('kind')!='PRODUCT_TRUTH_TRACE_INVENTORY' or pti.get('status')!='PASS':err('product truth inventory invalid')
    if pti.get('release')!=version or pti.get('violations',{}).get('missing_paths')!=[]:err('product truth inventory drift')
    areas=pti.get('areas') or []; ids=[x.get('area') for x in areas if isinstance(x,dict)]
    if len(ids)!=24 or len(ids)!=len(set(ids)):err('product truth inventory area coverage/uniqueness drift')
    for x in areas:
        for key in ('owner_path','canonical_doc'):
            rel=x.get(key)
            if not isinstance(rel,str) or not (ROOT/rel).exists():err(f"product truth {x.get('area')} missing {key}: {rel}")
        for key in ('producer_or_contract_paths','consumer_or_executor_paths','proof_paths'):
            for rel in x.get(key,[]):
                if '/' in str(rel) and not (ROOT/rel).exists():err(f"product truth {x.get('area')} missing {key}: {rel}")
    if not (ROOT/'scripts/generate-product-truth-inventory.py').is_file():err('product truth inventory generator missing')
except Exception as e:err(f'bad product truth inventory: {e}')

# PROMPT A documentation ownership/inventory: one meaning -> one current owner, with historical separation.
try:
    doc_policy=json.loads((ROOT/'data/documentation-ownership.json').read_text(encoding='utf-8'))
    doc_inv=json.loads((ROOT/'data/validation/documentation-inventory.json').read_text(encoding='utf-8'))
    if doc_policy.get('schema')!=1 or doc_policy.get('type')!='hi-documentation-ownership':err('documentation ownership policy header invalid')
    if doc_inv.get('schema')!=1 or doc_inv.get('kind')!='DOCUMENTATION_TRUTH_INVENTORY' or doc_inv.get('status')!='PASS':err('documentation inventory receipt invalid')
    if doc_inv.get('release')!=version:err('documentation inventory version drift')
    import hashlib
    meta=doc_inv.get('policy') or {}; policy_path=ROOT/meta.get('path','')
    if not policy_path.is_file() or hashlib.sha256(policy_path.read_bytes()).hexdigest()!=meta.get('sha256'):err('documentation ownership policy hash drift')
    violations=doc_inv.get('violations') or {}
    for key in ('unclassified','duplicate_meaning_owner','missing_owner','historical_as_current_owner'):
        if violations.get(key)!=[]:err(f'documentation inventory violation: {key}')
    meanings=doc_policy.get('meanings') or []; ids=[x.get('meaning') for x in meanings if isinstance(x,dict)]
    if len(ids)!=len(set(ids)) or not ids:err('documentation meaning ownership is duplicate/empty')
    inv_artifacts={x.get('path'):x for x in doc_inv.get('artifacts',[]) if isinstance(x,dict)}
    for item in meanings:
        owner=item.get('owner'); meaning=item.get('meaning')
        if not isinstance(owner,str) or not (ROOT/owner).is_file():err(f'documentation owner missing: {meaning} -> {owner}')
        art=inv_artifacts.get(owner)
        if art and art.get('lifecycle')=='HISTORICAL':err(f'historical artifact owns current meaning: {meaning} -> {owner}')
    if not (ROOT/'scripts/generate-documentation-inventory.py').is_file():err('documentation inventory generator missing')
except Exception as e:err(f'bad documentation ownership/inventory: {e}')


try:
    dp=json.loads((ROOT/'data/validation/documentation-parity.json').read_text(encoding='utf-8'))
    if dp.get('schema')!=1 or dp.get('kind')!='DOCUMENTATION_PARITY' or dp.get('status')!='PASS':err('documentation parity receipt invalid')
    if dp.get('release')!=version:err('documentation parity version drift')
    if dp.get('violations')!=[]:err('documentation parity reports violations')
    import hashlib
    for name,meta in (dp.get('inputs') or {}).items():
        rel=meta.get('path') if isinstance(meta,dict) else None; expected_sha=meta.get('sha256') if isinstance(meta,dict) else None
        if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'documentation parity input missing: {name}');continue
        if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_sha:err(f'documentation parity input hash drift: {name}')
    if not (ROOT/'scripts/validate-documentation.py').is_file():err('documentation parity validator missing')
except Exception as e:err(f'bad documentation parity receipt: {e}')

# Living data contract names.
required_data={'data/documentation-ownership.json','data/validation/documentation-inventory.json','data/validation/documentation-parity.json','data/validation/product-truth-inventory.json','data/product.json','data/validation/implementation-coverage.json','data/validation/native-coverage.json','data/validation/flow-coverage.json','data/validation/flow-acceptance.json','data/validation/source-gates.json','data/validation/release-gates.json','data/validation/source-contracts.json','data/validation/final-dod-audit.json','data/hi-methodologies.json','data/hi-roles.json','data/hi-permission-profiles.json','data/hi-config-options.json','data/validation/benchmarks-0.1.0.json','data/validation/install-lifecycle-0.1.0.json','data/validation/compatibility-matrix-0.1.0.json','data/validation/release-status-0.1.0.json','data/validation/terminology-audit-0.1.0.json','data/validation/projection-receipts.json'}
for rel in required_data:
    if not (ROOT/rel).is_file():err(f'required data contract missing: {rel}')
for old in ('feature-ledger-09-coverage.json','native-first-10-coverage.json','flow-11-coverage.json','flow-11-acceptance.json','roadmap-source-gates.json','observed-runtime-smoke-1.18.16.json'):
    if any(p.name==old for p in (ROOT/'data').rglob('*')):err(f'old data contract name present: {old}')

try:
    cm=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))
    if cm.get('schema')!=1 or cm.get('kind')!='GENERATED_RECEIPT_COMPATIBILITY_PROJECTION':err('compatibility projection header invalid')
    cur=cm.get('current_reference_host') or {}
    if cur.get('opencode_version')!='1.18.18' or cur.get('platform')!='linux' or cur.get('architecture')!='aarch64':err('compatibility current reference host drift')
    expected_caps={'process-lifecycle','workspace-isolation-binding','browser-execution'}
    caps=cur.get('capabilities') or {}
    if set(caps)!=expected_caps:err('compatibility current capability set drift')
    for cap in expected_caps:
        entry=caps.get(cap) or {}
        if entry.get('status')!='SUPPORTED_T3':err(f'compatibility {cap} not exact supported T3')
        receipt=entry.get('receipt')
        if not isinstance(receipt,str) or not (ROOT/receipt).is_file():err(f'compatibility {cap} receipt missing')
    for row in cm.get('history',[]):
        receipt=row.get('receipt');digest=row.get('receipt_sha256')
        if not isinstance(receipt,str) or not (ROOT/receipt).is_file():err(f'compatibility history receipt missing: {receipt}');continue
        import hashlib
        actual=hashlib.sha256((ROOT/receipt).read_bytes()).hexdigest()
        if actual!=digest:err(f'compatibility history receipt hash drift: {receipt}')
except Exception as e:err(f'bad compatibility projection: {e}')

# N1 final naming/namespace normalization projection.
try:
    nn=json.loads((ROOT/'data/validation/namespace-normalization-0.1.0.json').read_text(encoding='utf-8'))
    if nn.get('schema')!=1 or nn.get('kind')!='FINAL_HI_NAMESPACE_NORMALIZATION' or nn.get('status')!='PASS':err('N1 namespace normalization receipt invalid')
    if nn.get('guard',{}).get('violations')!=[] or nn.get('path_audit',{}).get('violations')!=[]:err('N1 namespace normalization reports living violations')
    if any(nn.get('stale_living_status',{}).values()):err('N1 namespace normalization reports stale living status')
    if not all(v is True for k,v in nn.get('public_surface',{}).items() if isinstance(v,bool)):err('N1 public namespace surface check failed')
    import hashlib
    for meta in nn.get('inputs',{}).values():
        path=ROOT/meta['path']
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=meta['sha256']:err(f"N1 namespace input drift: {meta.get('path')}")
except Exception as e:err(f'bad N1 namespace normalization receipt: {e}')

try:
    rs=json.loads((ROOT/'data/validation/release-status-0.1.0.json').read_text(encoding='utf-8'))
    if rs.get('schema')!=1 or rs.get('kind')!='GENERATED_RELEASE_STATUS_PROJECTION':err('release status projection header invalid')
    if rs.get('release')!=version:err('release status projection release mismatch')
    if rs.get('status')!='PARTIAL_EXTERNAL_NPM_BOOTSTRAP_AUTH' or rs.get('release_blocked') is not True:err('release status projection current state drift')
    if (rs.get('github') or {}).get('status')!='PASS_T4' or (rs.get('github') or {}).get('tag')!='v0.1.0':err('release status GitHub T4 projection drift')
    if (rs.get('npm') or {}).get('status')!='BLOCKED_T4_AUTH' or (rs.get('npm') or {}).get('publish_attempted') is not False:err('release status npm projection drift')
    if (rs.get('verification') or {}).get('persisted_test_count') is not False:err('release status must not persist test counts')
    host=rs.get('reference_host') or {}
    if (host.get('opencode_version'),host.get('platform'),host.get('architecture'))!=('1.18.18','linux','aarch64'):err('release status reference host drift')
    for cap in ('process-lifecycle','workspace-isolation-binding','browser-execution'):
        if ((host.get('capabilities') or {}).get(cap) or {}).get('status')!='SUPPORTED_T3':err(f'release status {cap} drift')
    import hashlib
    for name,meta in (rs.get('inputs') or {}).items():
        rel=meta.get('path') if isinstance(meta,dict) else None;expected_sha=meta.get('sha256') if isinstance(meta,dict) else None
        if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'release status input missing: {name}');continue
        actual=hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
        if actual!=expected_sha:err(f'release status input hash drift: {name} / {rel}')
    release_doc=(ROOT/'docs/RELEASE.md').read_text(encoding='utf-8')
    begin='<!-- BEGIN GENERATED RELEASE STATUS -->';end='<!-- END GENERATED RELEASE STATUS -->'
    if release_doc.count(begin)!=1 or release_doc.count(end)!=1:err('release status generated marker count invalid')
    if 'data/validation/release-status-0.1.0.json' not in release_doc or 'PARTIAL_EXTERNAL_NPM_BOOTSTRAP_AUTH' not in release_doc:err('release status generated docs block stale')
except Exception as e:err(f'bad release status projection: {e}')
sc=json.loads((ROOT/'data/validation/source-contracts.json').read_text(encoding='utf-8'))
if sc.get('release')!=version:err('source-contracts release stale')
for cid,c in sc.get('contracts',{}).items():
    for evidence in c.get('evidence',[]):
        evidence=evidence.split('#',1)[0]
        if evidence and not (ROOT/evidence).exists():err(f'source-contract {cid} stale evidence: {evidence}')

final_audit=json.loads((ROOT/'data/validation/final-dod-audit.json').read_text(encoding='utf-8'))
if final_audit.get('release')!=version:err('final DoD audit release stale')
if final_audit.get('internal_status')!='LOCAL_IMPLEMENTATION_AND_IN_PROCESS_ACCEPTANCE_COMPLETE':err('final DoD internal audit not complete')
if final_audit.get('source_checklist',{}).get('internal_missing')!=[]:err('final DoD audit reports internal missing requirements')
if final_audit.get('release_blocked') is not True:err('final DoD audit must remain release-blocked until external receipts exist')
rg=json.loads((ROOT/'data/validation/release-gates.json').read_text(encoding='utf-8'))
if not any(str(v).startswith('PENDING_') for v in rg.get('gates',{}).values()):err('release gates unexpectedly have no explicit pending evidence while release is blocked')
# M5 canonical ConfigOption catalog: every HiConfig leaf is classified and runtime entries must name an executable consumer/effect.
try:
    cc=json.loads((ROOT/'data/hi-config-options.json').read_text(encoding='utf-8'))
    if cc.get('schema')!=1 or cc.get('type')!='hi-config-option-catalog':err('Hi config option catalog header invalid')
    options=cc.get('options',[]); ids=[]; paths=[]
    for x in options:
        if not isinstance(x,dict):err('Hi config option entry must be object');continue
        oid=x.get('id'); path=x.get('path'); cls=x.get('classification');ids.append(oid);paths.append(path)
        if x.get('owner')!='hi-config':err(f'{oid}: config option owner invalid')
        if cls=='runtime':
            if not x.get('runtime_consumer') or not x.get('executor_effect'):err(f'{oid}: CONFIG_WITHOUT_EXECUTABLE_EFFECT')
            if x.get('diagnostic_consumer') or x.get('diagnostic_effect'):err(f'{oid}: runtime config falsely classified diagnostic-only')
        elif cls in ('diagnostic','schema-marker'):
            if x.get('runtime_consumer') or x.get('executor_effect'):err(f'{oid}: non-runtime config falsely claims executor effect')
            if not x.get('diagnostic_consumer') or not x.get('diagnostic_effect'):err(f'{oid}: diagnostic/schema config missing diagnostic effect')
        else:err(f'{oid}: unknown config option classification {cls}')
        for ref in x.get('behavioral_acceptance_refs',[]):
            if not (ROOT/'plugin/test'/ref).is_file():err(f'{oid}: missing config acceptance {ref}')
    if len(ids)!=len(set(ids)) or len(paths)!=len(set(paths)):err('duplicate Hi config option id/path')
    if (sum(1 for x in options if x.get('classification')=='runtime'),sum(1 for x in options if x.get('classification')=='diagnostic'),sum(1 for x in options if x.get('classification')=='schema-marker'))!=(29,2,1):err('Hi config option classification inventory drift')
except Exception as e:err(f'bad Hi config option catalog: {e}')
roles=sorted((ROOT/'roles').glob('*.md')); skills=sorted((ROOT/'skills').glob('*/SKILL.md'))
try:
    role_catalog=json.loads((ROOT/'data/hi-roles.json').read_text(encoding='utf-8'))
    if role_catalog.get('schema')!=2 or role_catalog.get('type')!='hi-role-contract-catalog':err('Hi role contract catalog header invalid')
    role_entries=role_catalog.get('roles',[])
    role_ids=[x.get('id') for x in role_entries if isinstance(x,dict)]
    expected_role_ids=sorted(['architect','coder','manager','qa-reviewer','repository-explorer','security-reviewer','visual-qa','working-manager'])
    if sorted(role_ids)!=expected_role_ids or len(role_ids)!=len(set(role_ids)):err('Hi role contract inventory != canonical 8 unique roles')
    known=set(role_ids)
    permission_catalog=json.loads((ROOT/'data/hi-permission-profiles.json').read_text(encoding='utf-8'))
    if permission_catalog.get('schema')!=1 or permission_catalog.get('type')!='hi-permission-profile-catalog':err('Hi permission profile catalog header invalid')
    permission_entries=permission_catalog.get('profiles',[])
    permission_ids=[x.get('id') for x in permission_entries if isinstance(x,dict)]
    if len(permission_ids)!=len(set(permission_ids)):err('duplicate Hi permission profile IDs')
    permission_known=set(permission_ids)
    for profile in permission_entries:
        if not isinstance(profile,dict):err('Hi permission profile entry must be object');continue
        pid=profile.get('id','')
        if profile.get('may_be_widened_by_lower_layer') is not False:err(f'{pid}: permission profile may widen at lower layer')
        rules=profile.get('rules',[])
        if any(r.get('capability')=='skill' for r in rules if isinstance(r,dict)):err(f'{pid}: skill permission must remain Methodology-owned')
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
        pref=item.get('permission_profile_ref')
        if pref not in permission_known:err(f'{rid}: unknown permission_profile_ref {pref}')
        if item.get('read_only'):
            profile=next((x for x in permission_entries if isinstance(x,dict) and x.get('id')==pref),{})
            edit=[r for r in profile.get('rules',[]) if isinstance(r,dict) and r.get('capability')=='edit' and 'pattern' not in r]
            if len(edit)!=1 or edit[0].get('action')!='deny':err(f'{rid}: read-only permission profile must explicitly deny edit')
except Exception as e:err(f'bad Hi role contract catalog: {e}')
for rp in roles:
    fm=rp.read_text(encoding='utf-8').split('\n---\n',1)[0]
    if re.search(r'^permission:\s*$',fm,re.M):err(f'{rp.name}: mechanical permission must not remain in role Markdown after M3')
if [p.stem for p in roles]!=sorted(['architect','coder','manager','qa-reviewer','repository-explorer','security-reviewer','visual-qa','working-manager']):err('agent role inventory != canonical 8')
if not skills:err('packaged Hi methodologies missing')
try:
    methodology=json.loads((ROOT/'data/hi-methodologies.json').read_text(encoding='utf-8'))
    profiles=methodology.get('profiles',[])
    profile_names=[x.get('name') for x in profiles]
    skill_names=[p.parent.name for p in skills]
    if len(profile_names)!=len(set(profile_names)):err('duplicate Hi methodology names')
    if sorted(profile_names)!=sorted(skill_names):err('Hi methodology policy != packaged SKILL.md inventory')
    if methodology.get('policy',{}).get('activation_owner')!='Hi methodology activation':err('Hi methodology activation owner mismatch')
    if methodology.get('policy',{}).get('selection_scope')!='mission-task-or-obligation':err('Hi methodology selection scope mismatch')
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
        if any(role not in known for role in compatible):err(f'{name}: compatible role reference unknown')
except Exception as e:err(f'bad Hi methodology policy: {e}')
# PROMPT A immutable reconstruction certification receipt. Historical evidence must not pin future current docs.
try:
    rmm=json.loads((ROOT/'data/validation/prompt-b-role-model-methodology.json').read_text(encoding='utf-8'))
    if rmm.get('schema')!=1 or rmm.get('kind')!='PROMPT_B_ROLE_MODEL_METHODOLOGY_ADVERSARIAL_AUDIT' or rmm.get('program')!='PROMPT_B' or rmm.get('section')!=7 or rmm.get('status')!='PASS':err('bad PROMPT B Role/Model/Methodology audit receipt')
    if rmm.get('violations')!=[] or rmm.get('summary')!={'required':13,'covered':13,'violations':0}:err('PROMPT B Role/Model/Methodology coverage drift')
    expected={'role-agent-model-methodology-separation','requested-selected-projected-observed-model','host-contradiction-handling','unknown-model-capability','model-fallback','methodology-available-admitted-selected-loaded','methodology-lazy-load','methodology-collision','methodology-exit','methodology-cannot-grant-authority','methodology-cannot-own-completion','role-permissions-mechanically-projected','prompt-persona-cannot-override-policy'}
    rows=rmm.get('invariants',[])
    if {x.get('invariant') for x in rows if isinstance(x,dict)}!=expected or len(rows)!=13:err('PROMPT B Role/Model/Methodology invariant inventory drift')
    for row in rows:
        for key in ['owner','proof']:
            rel=row.get(key); expected_hash=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Role/Model/Methodology missing {key}: {rel}')
            elif hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err(f'PROMPT B Role/Model/Methodology {key} hash drift: {rel}')
        owner=(ROOT/row['owner']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('owner'),str) and (ROOT/row['owner']).is_file() else ''
        proof=(ROOT/row['proof']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('proof'),str) and (ROOT/row['proof']).is_file() else ''
        if row.get('owner_anchor') not in owner:err(f"PROMPT B Role/Model/Methodology owner anchor drift: {row.get('invariant')}")
        if row.get('proof_anchor') not in proof:err(f"PROMPT B Role/Model/Methodology proof anchor drift: {row.get('invariant')}")
    guards=rmm.get('static_guards',{})
    if guards.get('skill_count')!=27 or any(guards.get(k)!=[] for k in ['methodology_forbidden_owner_imports','skill_boundary_missing','skill_control_plane_claims','role_markdown_mechanical_owners']):err('PROMPT B Role/Model/Methodology static ownership guard drift')
except Exception as e:err(f'bad PROMPT B Role/Model/Methodology receipt: {e}')

try:
    cpc=json.loads((ROOT/'data/validation/prompt-b-context-project-intelligence-compression.json').read_text(encoding='utf-8'))
    if cpc.get('schema')!=1 or cpc.get('kind')!='PROMPT_B_CONTEXT_PROJECT_INTELLIGENCE_COMPRESSION_ADVERSARIAL_AUDIT' or cpc.get('program')!='PROMPT_B' or cpc.get('section')!=10 or cpc.get('status')!='PASS':err('bad PROMPT B Context/PI/Compression audit receipt')
    if cpc.get('violations')!=[] or cpc.get('summary')!={'required':12,'covered':12,'violations':0}:err('PROMPT B Context/PI/Compression coverage drift')
    expected={'context-consumer-binding','unknown-context-handle-fail-close','stale-context-exclusion','project-intelligence-retrieval-eligibility','compression-source-hash-binding','compression-consumer-isolation','compression-freshness-propagation','privacy-monotonicity','project-intelligence-not-evidence','context-compression-not-evidence','protected-state-budget-survival','cache-source-invalidation'}
    rows=cpc.get('invariants',[])
    if {x.get('invariant') for x in rows if isinstance(x,dict)}!=expected or len(rows)!=12:err('PROMPT B Context/PI/Compression invariant inventory drift')
    for row in rows:
        for key in ['owner','proof']:
            rel=row.get(key); expected_hash=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Context/PI/Compression missing {key}: {rel}')
            elif hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err(f'PROMPT B Context/PI/Compression {key} hash drift: {rel}')
        owner=(ROOT/row['owner']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('owner'),str) and (ROOT/row['owner']).is_file() else ''
        proof=(ROOT/row['proof']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('proof'),str) and (ROOT/row['proof']).is_file() else ''
        if row.get('owner_anchor') not in owner:err(f"PROMPT B Context/PI/Compression owner anchor drift: {row.get('invariant')}")
        if row.get('proof_anchor') not in proof:err(f"PROMPT B Context/PI/Compression proof anchor drift: {row.get('invariant')}")
    guards=cpc.get('static_guards',{})
    if guards.get('project_intelligence_evidence_owner_paths')!=[] or guards.get('context_evidence_owner_paths')!=[] or guards.get('compression_exact_consumer_binding') is not True or guards.get('compression_unknown_freshness_rejected') is not True:err('PROMPT B Context/PI/Compression static guard drift')
    if 'compression-cross-consumer-rescope' not in {x.get('id') for x in cpc.get('closed_defects',[]) if isinstance(x,dict)}:err('PROMPT B Context/PI/Compression closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B Context/PI/Compression receipt: {e}')

try:
    evc=json.loads((ROOT/'data/validation/prompt-b-evidence-verification-completion.json').read_text(encoding='utf-8'))
    if evc.get('schema')!=1 or evc.get('kind')!='PROMPT_B_EVIDENCE_VERIFICATION_COMPLETION_HOSTILE_AUDIT' or evc.get('program')!='PROMPT_B' or evc.get('section')!=9 or evc.get('status')!='PASS':err('bad PROMPT B Evidence/Verification/Completion audit receipt')
    if evc.get('violations')!=[] or evc.get('summary')!={'required':12,'covered':12,'violations':0}:err('PROMPT B Evidence/Verification/Completion coverage drift')
    expected={'evidence-scope','evidence-freshness','source-revision','changed-file-ownership','mutation-invalidation','not-run-not-passed','worker-result-not-evidence','project-intelligence-not-evidence','context-summary-not-evidence','review-disposition','required-evidence-coverage','completion-obligation-reconciliation'}
    rows=evc.get('invariants',[])
    if {x.get('invariant') for x in rows if isinstance(x,dict)}!=expected or len(rows)!=12:err('PROMPT B Evidence/Verification/Completion invariant inventory drift')
    for row in rows:
        for key in ['owner','proof']:
            rel=row.get(key); expected_hash=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Evidence/Verification/Completion missing {key}: {rel}')
            elif hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err(f'PROMPT B Evidence/Verification/Completion {key} hash drift: {rel}')
        owner=(ROOT/row['owner']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('owner'),str) and (ROOT/row['owner']).is_file() else ''
        proof=(ROOT/row['proof']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('proof'),str) and (ROOT/row['proof']).is_file() else ''
        if row.get('owner_anchor') not in owner:err(f"PROMPT B Evidence/Verification/Completion owner anchor drift: {row.get('invariant')}")
        if row.get('proof_anchor') not in proof:err(f"PROMPT B Evidence/Verification/Completion proof anchor drift: {row.get('invariant')}")
    guards=evc.get('static_guards',{})
    if guards.get('project_intelligence_evidence_owner_paths')!=[] or guards.get('context_evidence_owner_paths')!=[] or guards.get('worker_result_is_mission_evidence_owner') is not False:err('PROMPT B Evidence/Verification/Completion ownership guard drift')
    closed={x.get('id') for x in evc.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'reviewer-done-auto-pass-evidence','worker-pass-without-source-state'}<=closed:err('PROMPT B Evidence/Verification/Completion closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B Evidence/Verification/Completion receipt: {e}')

try:
    apa=json.loads((ROOT/'data/validation/prompt-b-authority-permission-external-action.json').read_text(encoding='utf-8'))
    if apa.get('schema')!=1 or apa.get('kind')!='PROMPT_B_AUTHORITY_PERMISSION_EXTERNAL_ACTION_ADVERSARIAL_AUDIT' or apa.get('program')!='PROMPT_B' or apa.get('section')!=8 or apa.get('status')!='PASS':err('bad PROMPT B Authority/Permission/ExternalAction audit receipt')
    if apa.get('violations')!=[] or apa.get('summary')!={'required':18,'covered':18,'violations':0}:err('PROMPT B Authority/Permission/ExternalAction coverage drift')
    expected={'generic-yes-not-authority','continuation-not-approval','exact-action-scope','exact-target','exact-parameters','once-vs-reusable','consumed-authority','replay-idempotency','deny-precedence','lower-level-cannot-widen-safety','host-permission-cannot-widen-hi-authority','stale-approvals-rejected','credential-mfa-oauth-boundary','paid-irreversible-boundary','push-tag-release-publish-deploy-authority','destructive-filesystem-boundary','secret-sensitive-boundary','no-natural-language-regex-authority'}
    rows=apa.get('invariants',[])
    if {x.get('invariant') for x in rows if isinstance(x,dict)}!=expected or len(rows)!=18:err('PROMPT B Authority/Permission/ExternalAction invariant inventory drift')
    for row in rows:
        for key in ['owner','proof']:
            rel=row.get(key); expected_hash=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Authority/Permission/ExternalAction missing {key}: {rel}')
            elif hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err(f'PROMPT B Authority/Permission/ExternalAction {key} hash drift: {rel}')
        owner=(ROOT/row['owner']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('owner'),str) and (ROOT/row['owner']).is_file() else ''
        proof=(ROOT/row['proof']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('proof'),str) and (ROOT/row['proof']).is_file() else ''
        if row.get('owner_anchor') not in owner:err(f"PROMPT B Authority/Permission/ExternalAction owner anchor drift: {row.get('invariant')}")
        if row.get('proof_anchor') not in proof:err(f"PROMPT B Authority/Permission/ExternalAction proof anchor drift: {row.get('invariant')}")
    guards=apa.get('static_guards',{})
    if guards.get('natural_language_authority_regex_owner') is not False or guards.get('structured_authority_protocol') is not True or guards.get('persistent_authority_classes')!=['git-push','release-create','package-publish','deploy']:err('PROMPT B Authority/Permission/ExternalAction static guard drift')
    closed={x.get('id') for x in apa.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'natural-language-regex-owned-authority','stale-one-shot-approval','destructive-irreversible-secret-boundaries'}<=closed:err('PROMPT B Authority/Permission/ExternalAction closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B Authority/Permission/ExternalAction receipt: {e}')

try:
    mtw=json.loads((ROOT/'data/validation/prompt-b-mission-task-worker.json').read_text(encoding='utf-8'))
    if mtw.get('schema')!=1 or mtw.get('kind')!='PROMPT_B_MISSION_TASK_WORKER_ADVERSARIAL_AUDIT' or mtw.get('program')!='PROMPT_B' or mtw.get('section')!=6 or mtw.get('status')!='PASS':err('bad PROMPT B Mission/Task/Worker audit receipt')
    if mtw.get('violations')!=[] or mtw.get('summary')!={'required':15,'covered':15,'violations':0}:err('PROMPT B Mission/Task/Worker coverage drift')
    expected={'unique-identities','mission-ownership','task-dag-validity','worker-binding','no-ghost-workers','no-orphan-tasks','no-duplicate-completion','out-of-order-callback','stale-worker-result','task-cancellation','task-recovery','dependency-unblock','concurrent-write-safety','restart-reconstruction','terminal-state-correctness'}
    rows=mtw.get('invariants',[])
    if {x.get('invariant') for x in rows if isinstance(x,dict)}!=expected or len(rows)!=15:err('PROMPT B Mission/Task/Worker invariant inventory drift')
    for row in rows:
        for key in ['owner','proof']:
            rel=row.get(key); expected_hash=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Mission/Task/Worker missing {key}: {rel}')
            elif hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err(f'PROMPT B Mission/Task/Worker {key} hash drift: {rel}')
        owner=(ROOT/row['owner']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('owner'),str) and (ROOT/row['owner']).is_file() else ''
        proof=(ROOT/row['proof']).read_text(encoding='utf-8',errors='ignore') if isinstance(row.get('proof'),str) and (ROOT/row['proof']).is_file() else ''
        if row.get('owner_anchor') not in owner:err(f"PROMPT B Mission/Task/Worker owner anchor drift: {row.get('invariant')}")
        if row.get('proof_anchor') not in proof:err(f"PROMPT B Mission/Task/Worker proof anchor drift: {row.get('invariant')}")
    closed=mtw.get('closed_defects',[])
    if not any(x.get('id')=='ambiguous-native-session-callback-ownership' for x in closed if isinstance(x,dict)):err('PROMPT B Mission/Task/Worker closed defect receipt missing')
except Exception as e:err(f'bad PROMPT B Mission/Task/Worker receipt: {e}')

try:
    life=json.loads((ROOT/'data/validation/prompt-b-process-workspace-browser-lifecycle.json').read_text(encoding='utf-8'))
    if life.get('schema')!=1 or life.get('kind')!='PROMPT_B_PROCESS_WORKSPACE_BROWSER_LIFECYCLE_ADVERSARIAL_AUDIT' or life.get('program')!='PROMPT_B' or life.get('sections')!=[12,13,14] or life.get('status')!='PASS':err('bad PROMPT B Process/Workspace/Browser lifecycle audit receipt')
    expected_summary={'required':61,'covered':61,'violations':0,'by_section':{'12':{'required':23,'covered':23},'13':{'required':24,'covered':24},'14':{'required':14,'covered':14}}}
    if life.get('violations')!=[] or life.get('summary')!=expected_summary:err('PROMPT B Process/Workspace/Browser lifecycle coverage drift')
    rows=life.get('invariants') or []
    if len(rows)!=61 or {12:sum(1 for x in rows if x.get('section')==12),13:sum(1 for x in rows if x.get('section')==13),14:sum(1 for x in rows if x.get('section')==14)}!={12:23,13:24,14:14}:err('PROMPT B Process/Workspace/Browser invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key); expected_hash=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B lifecycle missing {key}: {rel}')
            elif hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err(f'PROMPT B lifecycle {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(errors='replace'):err(f"PROMPT B lifecycle owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(errors='replace'):err(f"PROMPT B lifecycle proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B lifecycle row invalid: {e}')
    eq=life.get('capability_source_equivalence') or {}
    if set(eq)!={'process-lifecycle','workspace-isolation-binding','browser-execution'} or not all(x.get('status')=='SUPPORTED_T3' and x.get('equivalent') is True and x.get('runtime_hash_drift')==[] for x in eq.values() if isinstance(x,dict)):err('PROMPT B lifecycle capability source equivalence drift')
    closed={x.get('id') for x in life.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'browser-cross-execution-owner-state-leak','workspace-forged-isolation-decision','process-kill-failure-false-termination','process-group-unverified-signal','duplicate-active-workspace-identity'}<=closed:err('PROMPT B lifecycle closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B Process/Workspace/Browser lifecycle receipt: {e}')

try:
    hd=json.loads((ROOT/'data/validation/prompt-b-human-decision.json').read_text(encoding='utf-8'))
    if hd.get('schema')!=1 or hd.get('kind')!='PROMPT_B_HUMAN_DECISION_ADVERSARIAL_AUDIT' or hd.get('program')!='PROMPT_B' or hd.get('section')!=15 or hd.get('status')!='PASS':err('bad PROMPT B HumanDecision audit receipt')
    if hd.get('violations')!=[] or hd.get('summary')!={'required':15,'covered':15,'violations':0}:err('PROMPT B HumanDecision audit coverage drift')
    rows=hd.get('invariants') or []
    if len(rows)!=15 or len({x.get('invariant') for x in rows})!=15:err('PROMPT B HumanDecision invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B HumanDecision missing {key}: {rel}')
            elif hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B HumanDecision {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(errors='replace'):err(f"PROMPT B HumanDecision owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(errors='replace'):err(f"PROMPT B HumanDecision proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B HumanDecision row invalid: {e}')
    closed={x.get('id') for x in hd.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'idle-human-decision-authority-reclassification','authority-request-semantic-coherence','reason-label-authority-inference'}<=closed:err('PROMPT B HumanDecision closed defect drift')
except Exception as e:err(f'bad PROMPT B HumanDecision audit receipt: {e}')


try:
    pc=json.loads((ROOT/'data/validation/prompt-b-persistence-concurrency.json').read_text(encoding='utf-8'))
    if pc.get('schema')!=1 or pc.get('kind')!='PROMPT_B_PERSISTENCE_CONCURRENCY_ADVERSARIAL_AUDIT' or pc.get('program')!='PROMPT_B' or pc.get('sections')!=[16,17] or pc.get('status')!='PASS':err('bad PROMPT B Persistence/Concurrency audit receipt')
    if pc.get('violations')!=[] or pc.get('summary')!={'required':31,'covered':31,'violations':0,'by_section':{'16':{'required':19,'covered':19},'17':{'required':12,'covered':12}}}:err('PROMPT B Persistence/Concurrency coverage drift')
    rows=pc.get('invariants') or []
    if len(rows)!=31 or {x.get('section') for x in rows if isinstance(x,dict)}!={16,17}:err('PROMPT B Persistence/Concurrency invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Persistence/Concurrency missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B Persistence/Concurrency {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(errors='replace'):err(f"PROMPT B Persistence/Concurrency owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(errors='replace'):err(f"PROMPT B Persistence/Concurrency proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B Persistence/Concurrency row invalid: {e}')
    if not all((pc.get('static_guards') or {}).values()):err('PROMPT B Persistence/Concurrency static guard drift')
    closed={x.get('id') for x in pc.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'duplicate-persisted-mission-replay','waiting-user-unclean-restart-gap','malformed-current-runtime-envelope','cancelled-worker-late-result-resurrection','permission-reply-before-ask-phantom-wait'}<=closed:err('PROMPT B Persistence/Concurrency closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B Persistence/Concurrency receipt: {e}')

try:
    vp=json.loads((ROOT/'data/validation/prompt-b-vcs-path-portability.json').read_text(encoding='utf-8'))
    if vp.get('schema')!=1 or vp.get('kind')!='PROMPT_B_VCS_PATH_PORTABILITY_ADVERSARIAL_AUDIT' or vp.get('program')!='PROMPT_B' or vp.get('sections')!=[18,19] or vp.get('status')!='PASS':err('bad PROMPT B VCS/Path audit receipt')
    if vp.get('violations')!=[] or vp.get('summary')!={'required':31,'covered':31,'violations':0,'by_section':{'18':{'required':13,'covered':13},'19':{'required':18,'covered':18}}}:err('PROMPT B VCS/Path coverage drift')
    rows=vp.get('invariants') or []
    if len(rows)!=31 or {x.get('section') for x in rows if isinstance(x,dict)}!={18,19}:err('PROMPT B VCS/Path invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B VCS/Path missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B VCS/Path {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(errors='replace'):err(f"PROMPT B VCS/Path owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(errors='replace'):err(f"PROMPT B VCS/Path proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B VCS/Path row invalid: {e}')
    if not all((vp.get('static_guards') or {}).values()):err('PROMPT B VCS/Path static guard drift')
    closed={x.get('id') for x in vp.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'unbounded-repository-path-identity','browser-host-user-cache-literal','browser-stale-spa-route-observation'}<=closed:err('PROMPT B VCS/Path closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B VCS/Path receipt: {e}')


try:
    sp=json.loads((ROOT/'data/validation/prompt-b-security-privacy.json').read_text(encoding='utf-8'))
    if sp.get('schema')!=1 or sp.get('kind')!='PROMPT_B_SECURITY_PRIVACY_ADVERSARIAL_AUDIT' or sp.get('program')!='PROMPT_B' or sp.get('section')!=20 or sp.get('status')!='PASS':err('bad PROMPT B Security/Privacy audit receipt')
    if sp.get('violations')!=[] or sp.get('summary')!={'required':20,'covered':20,'violations':0}:err('PROMPT B Security/Privacy coverage drift')
    rows=sp.get('invariants') or []
    expected={'path-traversal','symlink-escape','command-injection','shell-interpolation','prompt-injection','malicious-repo-content','malicious-methodology-resource','secret-exfiltration','environment-leaks','logs','telemetry','external-memory','mcp','browser','subprocess','package-scripts','dependency-confusion','permission-widening','approval-spoofing','source-reuse-license'}
    if len(rows)!=20 or {x.get('invariant') for x in rows if isinstance(x,dict)}!=expected:err('PROMPT B Security/Privacy invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected_hash=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Security/Privacy missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err(f'PROMPT B Security/Privacy {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(errors='replace'):err(f"PROMPT B Security/Privacy owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(errors='replace'):err(f"PROMPT B Security/Privacy proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B Security/Privacy row invalid: {e}')
    if not all((sp.get('static_guards') or {}).values()):err('PROMPT B Security/Privacy static guard drift')
    closed={x.get('id') for x in sp.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'process-secret-before-authority-persistence','durable-authority-secret-command','durable-ledger-secret-leak','temporary-rollback-secret-persistence','system-projection-secret-reexposure'}<=closed:err('PROMPT B Security/Privacy closed defect receipt drift')
    if 'PROMPT B §20 current-architecture security/privacy closure' not in (ROOT/'docs/THREAT-MODEL.md').read_text(errors='replace'):err('PROMPT B Security/Privacy threat model projection missing')
except Exception as e:err(f'bad PROMPT B Security/Privacy receipt: {e}')

try:
    sm=json.loads((ROOT/'data/validation/prompt-b-skills-methodology-security.json').read_text(encoding='utf-8'))
    if sm.get('schema')!=1 or sm.get('kind')!='PROMPT_B_SKILLS_METHODOLOGY_SECURITY_ADVERSARIAL_AUDIT' or sm.get('program')!='PROMPT_B' or sm.get('section')!=21 or sm.get('status')!='PASS':err('bad PROMPT B Skills/Methodology Security audit receipt')
    if sm.get('violations')!=[] or sm.get('summary')!={'required':13,'covered':13,'violations':0}:err('PROMPT B Skills/Methodology Security coverage drift')
    rows=sm.get('invariants') or []
    if len(rows)!=13 or len({x.get('invariant') for x in rows if isinstance(x,dict)})!=13:err('PROMPT B Skills/Methodology Security invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Skills/Methodology Security missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B Skills/Methodology Security {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(errors='replace'):err(f"PROMPT B Skills/Methodology Security owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(errors='replace'):err(f"PROMPT B Skills/Methodology Security proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B Skills/Methodology Security row invalid: {e}')
    if not all((sm.get('static_guards') or {}).values()):err('PROMPT B Skills/Methodology Security static guard drift')
    if sm.get('state_separation')!=['installed skill','admitted methodology','selected methodology','loaded methodology']:err('PROMPT B Skills/Methodology state separation drift')
    closed={x.get('id') for x in sm.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'skill-discovery-symlink-escape','repo-provenance-silent-skill-trust','project-methodology-artifact-symlink-escape'}<=closed:err('PROMPT B Skills/Methodology Security closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B Skills/Methodology Security receipt: {e}')

try:
    hp=json.loads((ROOT/'data/validation/prompt-b-host-port-portability.json').read_text(encoding='utf-8'))
    if hp.get('schema')!=1 or hp.get('kind')!='PROMPT_B_HOST_PORT_PORTABILITY_ADVERSARIAL_AUDIT' or hp.get('program')!='PROMPT_B' or hp.get('section')!=22 or hp.get('status')!='PASS':err('bad PROMPT B HostPort portability audit receipt')
    if hp.get('violations')!=[] or hp.get('summary')!={'required':11,'covered':11,'violations':0}:err('PROMPT B HostPort portability coverage drift')
    rows=hp.get('invariants') or []
    if len(rows)!=11 or len({x.get('invariant') for x in rows if isinstance(x,dict)})!=11:err('PROMPT B HostPort portability invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B HostPort portability missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B HostPort portability {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(errors='replace'):err(f"PROMPT B HostPort portability owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(errors='replace'):err(f"PROMPT B HostPort portability proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B HostPort portability row invalid: {e}')
    if not all((hp.get('static_guards') or {}).values()):err('PROMPT B HostPort portability static guard drift')
    alt=hp.get('alternate_host_feasibility') or {}
    if alt.get('status')!='FEASIBLE_BY_PORT_CONTRACT_NOT_IMPLEMENTED' or alt.get('semantic_core_changes_required') is not False:err('PROMPT B HostPort alternate-host feasibility boundary drift')
    closed={x.get('id') for x in hp.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'host-port-renamed-sdk-interface','runtime-event-controller-opencode-lifecycle-leak','task-runtime-opencode-client-leak','runtime-service-opencode-construction-leak','process-error-opencode-owner-leak','routing-provider-policy-opencode-owner-leak'}<=closed:err('PROMPT B HostPort portability closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B HostPort portability receipt: {e}')

try:
    nr=json.loads((ROOT/'data/validation/opencode-native-reevaluation.json').read_text(encoding='utf-8'))
    if nr.get('schema')!=1 or nr.get('kind')!='EXACT_CURRENT_OPENCODE_NATIVE_REEVALUATION' or nr.get('program')!='PROMPT_B' or nr.get('status')!='PASS':err('bad PROMPT B native reevaluation receipt identity/status')
    oc=nr.get('opencode',{})
    if oc.get('version')!='1.18.18' or oc.get('source_commit')!='e23586af2623f1bc2e8e6965d2d7acf7bd03d5c3' or oc.get('source_worktree_used') is not False or oc.get('source_read_mode')!='git-blob':err('PROMPT B native reevaluation exact-source identity drift')
    decisions=nr.get('decisions',[])
    expected={'sessions','task-delegation','permission','tool-events','lsp','pty','workspace','provider-model-observation','skill-loading','lifecycle-events','human-decision-structured-open','compaction'}
    surfaces={x.get('surface') for x in decisions if isinstance(x,dict)}
    if surfaces!=expected or len(decisions)!=12:err('PROMPT B native reevaluation surface inventory drift')
    if nr.get('missing_hi_paths')!=[]:err('PROMPT B native reevaluation has missing Hi paths')
    summary=nr.get('summary',{})
    if summary!={'surfaces':12,'remove_custom_mechanism':0,'keep_thin_or_stronger':11,'unsupported':1}:err('PROMPT B native reevaluation summary drift')
    by={x.get('surface'):x for x in decisions if isinstance(x,dict)}
    if by.get('lsp',{}).get('hi_decision')!='KEEP_LOCAL_SEMANTIC_ADAPTER; NATIVE_DISCOVERY_OPTIONAL':err('PROMPT B LSP boundary drift')
    if by.get('human-decision-structured-open',{}).get('hi_decision')!='UNSUPPORTED_STRUCTURED_OPEN_KEEP_CHAT_TRANSPORT':err('PROMPT B HumanDecision boundary drift')
    for x in decisions:
        for rel in x.get('hi_paths',[]):
            if not (ROOT/rel).is_file():err(f'PROMPT B native reevaluation Hi path missing: {rel}')
    blobs=nr.get('upstream_blob_sha256',{})
    if set(blobs)!={'plugin-hooks','session','task','permission','pty','workspace','workspace-adapter','skill','lsp','sdk','sdk-v2','sdk-types','package'}:err('PROMPT B upstream blob inventory drift')
    for meta in blobs.values():
        if not isinstance(meta,dict) or not isinstance(meta.get('path'),str) or not re.fullmatch(r'[a-f0-9]{64}',str(meta.get('sha256',''))):err('PROMPT B upstream blob metadata invalid')
except Exception as e:err(f'bad PROMPT B native reevaluation receipt: {e}')

try:
    dr=json.loads((ROOT/'data/validation/documentation-reconstruction.json').read_text(encoding='utf-8'))
    if dr.get('schema')!=1 or dr.get('kind')!='FINAL_PRODUCT_TRUTH_RECONSTRUCTION' or dr.get('program')!='PROMPT_A' or dr.get('status')!='COMPLETED':err('PROMPT A reconstruction receipt header/status invalid')
    if dr.get('version')!='0.1.0':err('PROMPT A historical reconstruction receipt version drift')
    source=dr.get('certified_source') or {}; head=source.get('head'); tree=source.get('tree')
    if head!='5ced215ed57f28f8d963376ca702efc0dac75503' or tree!='b22db990942ad291997a8ad564ac1235283036bb':err('PROMPT A certified product source identity drift')
    record=dr.get('completion_record') or {}; record_commit=record.get('commit'); record_tree=record.get('tree')
    if record_commit!='9f0624383db038f55e280ab7834b7dd12bc281ca' or record_tree!='b39dd548b1ceba28ff6fc67575ad9389ccf4f5b2':err('PROMPT A completion-record identity drift')
    import hashlib,subprocess
    try:
        actual_tree=subprocess.check_output(['git','rev-parse',f'{head}^{{tree}}'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
        actual_record_tree=subprocess.check_output(['git','rev-parse',f'{record_commit}^{{tree}}'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
        if actual_tree!=tree:err('PROMPT A certified product source tree does not resolve from recorded HEAD')
        if actual_record_tree!=record_tree:err('PROMPT A completion-record tree does not resolve from recorded commit')
    except Exception as e:err(f'PROMPT A certification commits unavailable: {e}')
    if not all(v is True for v in (dr.get('exit_gate') or {}).values()) or len(dr.get('exit_gate') or {})!=16:err('PROMPT A exit gate incomplete')
    parity=dr.get('source_doc_parity') or {}
    if parity.get('status')!='PASS' or parity.get('product_trace_missing_paths')!=[] or parity.get('documentation_violations')!=[]:err('PROMPT A source/docs parity receipt is not closed')
    gen=dr.get('generated_or_parity_validated') or {}
    if (gen.get('config_options'),gen.get('exact_t3_capabilities'),gen.get('product_areas'),gen.get('documentation_parity_violations'),gen.get('broken_links'))!=(32,3,24,0,0):err('PROMPT A generated/parity evidence drift')
    for name,meta in (dr.get('inputs') or {}).items():
        rel=meta.get('path') if isinstance(meta,dict) else None; expected=meta.get('sha256') if isinstance(meta,dict) else None
        if not isinstance(rel,str):err(f'PROMPT A receipt input path invalid: {name}');continue
        try: blob=subprocess.check_output(['git','show',f'{record_commit}:{rel}'],cwd=ROOT,stderr=subprocess.DEVNULL)
        except Exception:err(f'PROMPT A historical receipt input missing from completion commit: {rel}');continue
        if hashlib.sha256(blob).hexdigest()!=expected:err(f'PROMPT A historical receipt input hash drift: {rel}')
    master=(ROOT/'docs/engineering-constitution/MASTER-CONTINUATION.md').read_text(encoding='utf-8')
    if 'PROMPT A final exit gate — **COMPLETED**' not in master:err('PROMPT A completed status lost from current continuation ledger')
except Exception as e:err(f'bad PROMPT A reconstruction receipt: {e}')

for p in (ROOT/'data').rglob('*.json'):
    try:json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:err(f'bad json {p.name}: {e}')
if ERR:
    print('VALIDATION FAIL'); [print('- '+x) for x in ERR]; sys.exit(1)
print('VALIDATION PASS'); print(f'version={version} roles={len(roles)} methodologies={len(skills)} product=HI docs={len(actual_docs)}')
