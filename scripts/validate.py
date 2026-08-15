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
