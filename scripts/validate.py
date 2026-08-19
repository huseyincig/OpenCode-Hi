#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re,sys,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def git_blob_sha256(commit,rel):
    blob=subprocess.check_output(['git','show',f'{commit}:{rel}'],cwd=ROOT,stderr=subprocess.DEVNULL)
    return hashlib.sha256(blob).hexdigest()

def git_blob_oid(commit,rel):
    return subprocess.check_output(['git','rev-parse',f'{commit}:{rel}'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()

def source_binding_valid(binding):
    try:
        commit=(binding or {}).get('tested_git_commit');tree=(binding or {}).get('tested_git_tree')
        if not isinstance(commit,str) or not re.fullmatch(r'[a-f0-9]{40}',commit) or not isinstance(tree,str) or not re.fullmatch(r'[a-f0-9]{40}',tree):return False
        if subprocess.check_output(['git','rev-parse',f'{commit}^{{tree}}'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()!=tree:return False
        return subprocess.run(['git','merge-base','--is-ancestor',commit,'HEAD'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
    except Exception:return False
ERR=[]
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
required_root={'README.md','CHANGELOG.md','THIRD_PARTY_NOTICES.md','LICENSE','VERSION','package.json'}
for name in required_root:
    if not (ROOT/name).is_file():err(f'required root file missing: {name}')
for forbidden in ('KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','HI.cmd','HI.sh','HI-VALIDATE.cmd','HI-VALIDATE.sh','HI-RELEASE-PREP.cmd','HI-RELEASE-PREP.sh','docs/HI-TEST-LAB-HANDOFF.md','docs/FLOW-11-COVERAGE.md','docs/NATIVE-FIRST-10-COVERAGE.md','docs/MIGRATION-Hi-NEXT.md'):
    if (ROOT/forbidden).exists():err(f'non-product/legacy file present: {forbidden}')
required_docs={'README.md','ARCHITECTURE.md','INSTALLATION.md','SKILLS.md','HOSTS.md','HUMAN-DECISIONS.md','RELEASE.md','VERIFICATION.md','SECURITY-MODEL.md','locales/tr/README.md'}
actual_docs={p.relative_to(ROOT/'docs').as_posix() for p in (ROOT/'docs').rglob('*.md')}
if actual_docs!=required_docs:err(f'docs set mismatch: {sorted(actual_docs)}')
for rel in ('.github/CONTRIBUTING.md','.github/SECURITY.md','.github/SUPPORT.md','.github/pull_request_template.md','.github/ISSUE_TEMPLATE/bug_report.yml','.github/ISSUE_TEMPLATE/feature_request.yml'):
    if not (ROOT/rel).is_file():err(f'community health file missing: {rel}')
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

# Public documentation ownership/inventory: bounded current surface only.
try:
    doc_policy=json.loads((ROOT/'data/documentation-ownership.json').read_text(encoding='utf-8'))
    doc_inv=json.loads((ROOT/'data/validation/documentation-inventory.json').read_text(encoding='utf-8'))
    if doc_policy.get('schema')!=1 or doc_policy.get('type')!='hi-documentation-ownership':err('documentation ownership policy header invalid')
    if doc_inv.get('schema')!=1 or doc_inv.get('kind')!='DOCUMENTATION_TRUTH_INVENTORY' or doc_inv.get('status')!='PASS':err('documentation inventory receipt invalid')
    if doc_inv.get('release')!=version:err('documentation inventory version drift')
    meta=doc_inv.get('policy') or {}; policy_path=ROOT/meta.get('path','')
    if not policy_path.is_file() or hashlib.sha256(policy_path.read_bytes()).hexdigest()!=meta.get('sha256'):err('documentation ownership policy hash drift')
    violations=doc_inv.get('violations') or {}
    if any(violations.get(k)!=[] for k in ('missing','duplicate_area','budget_or_tracking')):err('documentation inventory reports violations')
    public=doc_policy.get('public_documents') or []; machine=doc_policy.get('machine_owners') or []
    areas=[x.get('area') for x in public+machine if isinstance(x,dict)]
    if not areas or len(areas)!=len(set(areas)):err('documentation area ownership is duplicate/empty')
    for item in public+machine:
        rel=item.get('path')
        if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'documentation owner missing: {item.get("area")} -> {rel}')
    summary=doc_inv.get('summary') or {}
    if summary.get('docs_markdown',999)>doc_policy.get('policy',{}).get('public_docs_budget',10):err('documentation public budget exceeded')
    if summary.get('root_markdown',999)>doc_policy.get('policy',{}).get('root_markdown_budget',3):err('documentation root budget exceeded')
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
required_data={'data/documentation-ownership.json','data/validation/documentation-inventory.json','data/validation/documentation-parity.json','data/validation/product-truth-inventory.json','data/product.json','data/validation/implementation-coverage.json','data/validation/native-coverage.json','data/validation/flow-coverage.json','data/validation/flow-acceptance.json','data/validation/source-gates.json','data/validation/release-gates.json','data/validation/source-contracts.json','data/validation/final-dod-audit.json','data/hi-methodologies.json','data/hi-roles.json','data/hi-permission-profiles.json','data/hi-config-options.json','data/validation/benchmarks-0.1.0.json','data/validation/install-lifecycle-0.1.0.json','data/validation/compatibility-matrix-0.1.0.json',f'data/validation/release-status-{version}.json','data/validation/terminology-audit-0.1.0.json','data/validation/projection-receipts.json'}
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
    rs=json.loads((ROOT/f'data/validation/release-status-{version}.json').read_text(encoding='utf-8'))
    if rs.get('schema')!=1 or rs.get('kind')!='GENERATED_RELEASE_STATUS_PROJECTION':err('release status projection header invalid')
    if rs.get('release')!=version:err('release status projection release mismatch')
    if rs.get('status') not in {'PREPUBLICATION_CERTIFICATION_IN_PROGRESS','PREPUBLICATION_CERTIFIED_PENDING_T4','CERTIFIED_T4'}:err('release status projection current state drift')
    if (rs.get('historical_github_release') or {}).get('status')!='PASS_T4' or (rs.get('historical_github_release') or {}).get('tag')!='v0.1.0':err('historical release projection drift')
    cand=rs.get('candidate') or {}; expected_npm={'PREPUBLICATION_CERTIFICATION_IN_PROGRESS':'PENDING_T4','PREPUBLICATION_CERTIFIED_PENDING_T4':'PENDING_T4','CERTIFIED_T4':'PASS_T4'}.get(rs.get('status'));
    if cand.get('npm_status')!=expected_npm or cand.get('publication_attempted')!=(rs.get('status')=='CERTIFIED_T4'):err('release status npm projection drift')
    if (rs.get('verification') or {}).get('persisted_test_count') is not False:err('release status must not persist test counts')
    host=rs.get('reference_host') or {}
    if (host.get('opencode_version'),host.get('platform'),host.get('architecture'))!=('1.18.18','linux','aarch64'):err('release status reference host drift')
    for cap in ('process-lifecycle','workspace-isolation-binding','browser-execution'):
        if ((host.get('baseline_capabilities') or {}).get(cap) or {}).get('status')!='SUPPORTED_T3':err(f'release status baseline {cap} drift')
    if not isinstance(host.get('candidate_certification'),dict):err('release status candidate certification missing')
    if (rs.get('publication_authority') or {}).get('granted') is not False:err('release status must not self-grant publication authority')
    import hashlib
    for name,meta in (rs.get('inputs') or {}).items():
        rel=meta.get('path') if isinstance(meta,dict) else None;expected_sha=meta.get('sha256') if isinstance(meta,dict) else None
        if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'release status input missing: {name}');continue
        actual=hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
        if actual!=expected_sha:err(f'release status input hash drift: {name} / {rel}')
    release_doc=(ROOT/'docs/RELEASE.md').read_text(encoding='utf-8')
    begin='<!-- BEGIN GENERATED RELEASE STATUS -->';end='<!-- END GENERATED RELEASE STATUS -->'
    if release_doc.count(begin)!=1 or release_doc.count(end)!=1:err('release status generated marker count invalid')
    if f'data/validation/release-status-{version}.json' not in release_doc or rs.get('status','') not in release_doc:err('release status generated docs block stale')
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
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B lifecycle owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B lifecycle proof anchor drift: {row.get('invariant')}")
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
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B HumanDecision owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B HumanDecision proof anchor drift: {row.get('invariant')}")
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
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Persistence/Concurrency owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Persistence/Concurrency proof anchor drift: {row.get('invariant')}")
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
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B VCS/Path owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B VCS/Path proof anchor drift: {row.get('invariant')}")
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
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Security/Privacy owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Security/Privacy proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B Security/Privacy row invalid: {e}')
    if not all((sp.get('static_guards') or {}).values()):err('PROMPT B Security/Privacy static guard drift')
    closed={x.get('id') for x in sp.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'process-secret-before-authority-persistence','durable-authority-secret-command','durable-ledger-secret-leak','temporary-rollback-secret-persistence','system-projection-secret-reexposure'}<=closed:err('PROMPT B Security/Privacy closed defect receipt drift')
    if '## Trust boundaries' not in (ROOT/'docs/SECURITY-MODEL.md').read_text(encoding='utf-8',errors='replace'):err('PROMPT B Security/Privacy public security model missing')
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
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Skills/Methodology Security owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Skills/Methodology Security proof anchor drift: {row.get('invariant')}")
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
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B HostPort portability owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B HostPort portability proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B HostPort portability row invalid: {e}')
    if not all((hp.get('static_guards') or {}).values()):err('PROMPT B HostPort portability static guard drift')
    alt=hp.get('alternate_host_feasibility') or {}
    if alt.get('status')!='FEASIBLE_BY_PORT_CONTRACT_NOT_IMPLEMENTED' or alt.get('semantic_core_changes_required') is not False:err('PROMPT B HostPort alternate-host feasibility boundary drift')
    closed={x.get('id') for x in hp.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'host-port-renamed-sdk-interface','runtime-event-controller-opencode-lifecycle-leak','task-runtime-opencode-client-leak','runtime-service-opencode-construction-leak','process-error-opencode-owner-leak','routing-provider-policy-opencode-owner-leak'}<=closed:err('PROMPT B HostPort portability closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B HostPort portability receipt: {e}')

try:
    cfg=json.loads((ROOT/'data/validation/prompt-b-configuration.json').read_text(encoding='utf-8'))
    if cfg.get('schema')!=1 or cfg.get('kind')!='PROMPT_B_CONFIGURATION_ADVERSARIAL_AUDIT' or cfg.get('program')!='PROMPT_B' or cfg.get('section')!=23 or cfg.get('status')!='PASS':err('bad PROMPT B Configuration audit receipt')
    if cfg.get('violations')!=[] or cfg.get('summary')!={'required':29,'covered':29,'violations':0,'runtime':26,'diagnostic':2,'schema_marker':1}:err('PROMPT B Configuration coverage drift')
    rows=cfg.get('leaves') or []
    if len(rows)!=29 or len({x.get('path') for x in rows if isinstance(x,dict)})!=29:err('PROMPT B Configuration leaf inventory drift')
    import hashlib
    for row in rows:
        for key in ('schema','consumer','documentation','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B Configuration missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B Configuration {key} hash drift: {rel}')
        try:
            if row.get('consumer_anchor') not in (ROOT/row['consumer']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Configuration consumer anchor drift: {row.get('path')}")
            if f"`{row.get('path')}`" not in (ROOT/row['documentation']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B Configuration documentation drift: {row.get('path')}")
        except Exception as e:err(f'PROMPT B Configuration row invalid: {e}')
    if not all((cfg.get('static_guards') or {}).values()):err('PROMPT B Configuration static guard drift')
    closed={x.get('id') for x in cfg.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'profile-unknown-config-injection','block-level-precedence-widening','project-routing-synthetic-default-override'}<=closed:err('PROMPT B Configuration closed defect receipt drift')
except Exception as e:err(f'bad PROMPT B Configuration receipt: {e}')

try:
    ux=json.loads((ROOT/'data/validation/prompt-b-cli-developer-tooling-ux.json').read_text(encoding='utf-8'))
    if ux.get('schema')!=1 or ux.get('kind')!='PROMPT_B_CLI_DEVELOPER_TOOLING_UX_ADVERSARIAL_AUDIT' or ux.get('program')!='PROMPT_B' or ux.get('section')!=24 or ux.get('status')!='PASS':err('bad PROMPT B CLI/developer tooling UX audit receipt')
    if ux.get('violations')!=[] or ux.get('summary')!={'required':11,'covered':11,'violations':0}:err('PROMPT B CLI/developer tooling UX coverage drift')
    rows=ux.get('invariants') or []
    if len(rows)!=11 or len({x.get('invariant') for x in rows if isinstance(x,dict)})!=11:err('PROMPT B CLI/developer tooling UX invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B CLI/developer tooling UX missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B CLI/developer tooling UX {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B CLI/developer tooling UX owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B CLI/developer tooling UX proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B CLI/developer tooling UX row invalid: {e}')
    if not all((ux.get('static_guards') or {}).values()):err('PROMPT B CLI/developer tooling UX static guard drift')
    if ux.get('ux_contract')!=['specific','actionable','truthful','bounded']:err('PROMPT B CLI/developer tooling UX contract drift')
except Exception as e:err(f'bad PROMPT B CLI/developer tooling UX receipt: {e}')

try:
    iu=json.loads((ROOT/'data/validation/prompt-b-install-update-lifecycle.json').read_text(encoding='utf-8'))
    if iu.get('schema')!=1 or iu.get('kind')!='PROMPT_B_INSTALL_UPDATE_LIFECYCLE_ADVERSARIAL_AUDIT' or iu.get('program')!='PROMPT_B' or iu.get('section')!=25 or iu.get('status')!='PASS':err('bad PROMPT B install/update lifecycle audit receipt')
    if iu.get('violations')!=[] or iu.get('summary')!={'required':14,'covered':14,'violations':0}:err('PROMPT B install/update lifecycle coverage drift')
    rows=iu.get('invariants') or []
    if len(rows)!=14 or len({x.get('invariant') for x in rows if isinstance(x,dict)})!=14:err('PROMPT B install/update lifecycle invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B install/update lifecycle missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B install/update lifecycle {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B install/update lifecycle owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B install/update lifecycle proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B install/update lifecycle row invalid: {e}')
    if not all((iu.get('static_guards') or {}).values()):err('PROMPT B install/update lifecycle static guard drift')
    closed={x.get('id') for x in iu.get('closed_defects',[]) if isinstance(x,dict)}
    if not {'lifecycle-missing-reinstall','packed-setup-cli-missing','root-runtime-dependency-contract-missing'}<=closed:err('PROMPT B install/update lifecycle closed defect drift')
    ps=json.loads((ROOT/'data/validation/packed-setup-smoke-0.1.0.json').read_text(encoding='utf-8'))
    if ps.get('schema')!=1 or ps.get('kind')!='PACKED_SETUP_FRESH_CONSUMER_SMOKE' or ps.get('release')!='0.1.0' or ps.get('status')!='PASS':err('packed setup smoke receipt invalid')
    if not (ps.get('tarball') or {}).get('all_required_present') or (ps.get('tarball') or {}).get('setup_mode')!='0o755':err('packed setup tarball membership/mode drift')
    fc=ps.get('fresh_consumer') or {}
    if fc.get('install_rc')!=0 or fc.get('setup_help_rc')!=0 or fc.get('module_import_output')!='function' or not (fc.get('module_import_rc')==0 or fc.get('module_import_teardown_noise') is True):err('packed setup fresh consumer smoke drift')
except Exception as e:err(f'bad PROMPT B install/update lifecycle receipt: {e}')

try:
    pf=json.loads((ROOT/'data/validation/prompt-b-packaging-fresh-consumer.json').read_text(encoding='utf-8'))
    if pf.get('schema')!=1 or pf.get('kind')!='PROMPT_B_PACKAGING_FRESH_CONSUMER_ADVERSARIAL_AUDIT' or pf.get('program')!='PROMPT_B' or pf.get('section')!=26 or pf.get('status')!='PASS':err('bad PROMPT B packaging/fresh consumer audit receipt')
    if pf.get('violations')!=[] or pf.get('summary')!={'required':8,'covered':8,'violations':0}:err('PROMPT B packaging/fresh consumer coverage drift')
    rows=pf.get('invariants') or []
    if len(rows)!=8 or len({x.get('invariant') for x in rows if isinstance(x,dict)})!=8:err('PROMPT B packaging/fresh consumer invariant inventory drift')
    import hashlib
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B packaging/fresh consumer missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B packaging/fresh consumer {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B packaging/fresh consumer owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B packaging/fresh consumer proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B packaging/fresh consumer row invalid: {e}')
    if not all((pf.get('static_guards') or {}).values()):err('PROMPT B packaging/fresh consumer static guard drift')
    ar=pf.get('acceptance_receipt')
    if not isinstance(ar,str) or not (ROOT/ar).is_file():err('PROMPT B fresh consumer acceptance receipt missing')
    else:
        a=json.loads((ROOT/ar).read_text(encoding='utf-8'))
        host=a.get('host') or {}
        if a.get('status')!='PASS' or host.get('opencode')!='1.18.18' or host.get('platform')!='linux' or host.get('architecture')!='aarch64' or not isinstance(host.get('binary_sha256'),str) or len(host.get('binary_sha256'))!=64:err('PROMPT B fresh consumer exact-host acceptance drift')
        if not all((a.get('checks') or {}).values()):err('PROMPT B fresh consumer acceptance check drift')
except Exception as e:err(f'bad PROMPT B packaging/fresh consumer receipt: {e}')

# PROMPT B §30 test-suite certification
try:
    t30=json.loads((ROOT/'data/validation/prompt-b-test-suite-audit.json').read_text(encoding='utf-8'))
    if t30.get('schema')!=1 or t30.get('kind')!='PROMPT_B_TEST_SUITE_ADVERSARIAL_AUDIT' or t30.get('program')!='PROMPT_B' or t30.get('section')!=30 or t30.get('status')!='PASS':err('bad PROMPT B test-suite audit receipt identity/status')
    if t30.get('summary')!={'required':11,'covered':11,'violations':0} or t30.get('violations')!=[]:err('PROMPT B test-suite audit summary drift')
    if not all((t30.get('static_guards') or {}).values()):err('PROMPT B test-suite static guard drift')
    for row in t30.get('invariants',[]):
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B test-suite missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B test-suite {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B test-suite owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B test-suite proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B test-suite row invalid: {e}')
    ha=json.loads((ROOT/'data/validation/test-harness-isolation-0.1.0.json').read_text(encoding='utf-8'))
    if ha.get('status')!='PASS' or ha.get('section')!=30:err('PROMPT B test harness acceptance drift')
    obs=ha.get('canonical_suite_observation') or {}
    if ha.get('schema')!=2 or not isinstance(obs.get('tests'),int) or obs.get('tests',0)<=0 or obs.get('pass')!=obs.get('tests') or obs.get('fail')!=0 or obs.get('cancelled')!=0 or obs.get('home_hi_state_delta')!={'entries':0,'bytes':0}:err('PROMPT B canonical test harness observation drift')
    for k in ('plugin_cwd','repo_root_cwd'):
        x=(ha.get('cwd_dual_run') or {}).get(k) or {}
        if not isinstance(x.get('tests'),int) or x.get('tests',0)<=0 or x.get('pass')!=x.get('tests') or x.get('fail')!=0 or x.get('cancelled')!=0:err(f'PROMPT B cwd dual-run drift: {k}')
    cm30=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))
    caps30=cm30.get('current_reference_host',{}).get('capabilities',{})
    for cap in ('process-lifecycle','workspace-isolation-binding','browser-execution'):
        x=caps30.get(cap) or {}; selected=x.get('tested_git_commit')
        if x.get('status')!='SUPPORTED_T3' or not isinstance(selected,str):err(f'PROMPT B §30 exact T3 selection drift: {cap}');continue
        receipt=x.get('receipt')
        if not isinstance(receipt,str) or not (ROOT/receipt).is_file():err(f'PROMPT B §30 T3 receipt missing: {cap}')
except Exception as e:err(f'bad PROMPT B test-suite receipt: {e}')


# PROMPT B §31 mutation testing certification
try:
    m31=json.loads((ROOT/'data/validation/prompt-b-mutation-testing.json').read_text(encoding='utf-8'))
    if m31.get('schema')!=1 or m31.get('kind')!='PROMPT_B_MUTATION_TESTING_AUDIT' or m31.get('program')!='PROMPT_B' or m31.get('section')!=31 or m31.get('status')!='PASS':err('bad PROMPT B mutation testing audit receipt identity/status')
    expected_summary={'required_areas':9,'configured_mutants':15,'killed_mutants':15,'survived_mutants':0,'compile_only_kills':0,'violations':0}
    if m31.get('summary')!=expected_summary or m31.get('violations')!=[]:err('PROMPT B mutation testing summary drift')
    required={'authority_deny_allow','completion_evidence','permission_monotonicity','owner_uniqueness','stale_evidence','path_confinement','restart_schema_rejection','config_executable_effect','capability_support_truth'}
    if set(m31.get('required_areas') or [])!=required:err('PROMPT B mutation testing required area drift')
    if not all((m31.get('static_guards') or {}).values()):err('PROMPT B mutation testing static guard drift')
    mutants=m31.get('mutants') or []
    if len(mutants)!=15 or len({x.get('id') for x in mutants if isinstance(x,dict)})!=15 or any(x.get('status')!='KILLED_BY_INVARIANT_TEST' for x in mutants if isinstance(x,dict)):err('PROMPT B mutation inventory/kill drift')
    for rel,expected in (m31.get('proof_hashes') or {}).items():
        if not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B mutation proof hash drift: '+str(rel))
    ar=m31.get('acceptance_receipt')
    if not isinstance(ar,str) or not (ROOT/ar).is_file():err('PROMPT B mutation acceptance receipt missing')
    else:
        ma=json.loads((ROOT/ar).read_text(encoding='utf-8'))
        if ma.get('status')!='PASS' or ma.get('summary')!={'configured':15,'killed':15,'survived':0,'compile_only_kills':0}:err('PROMPT B mutation acceptance drift')
except Exception as e:err(f'bad PROMPT B mutation testing receipt: {e}')

# PROMPT B §32 property / fuzz testing certification
try:
    f32=json.loads((ROOT/'data/validation/prompt-b-property-fuzz-testing.json').read_text(encoding='utf-8'))
    if f32.get('schema')!=1 or f32.get('kind')!='PROMPT_B_PROPERTY_FUZZ_TESTING_AUDIT' or f32.get('program')!='PROMPT_B' or f32.get('section')!=32 or f32.get('status')!='PASS':err('bad PROMPT B property/fuzz audit receipt identity/status')
    if f32.get('summary')!={'required_areas':9,'covered_areas':9,'generated_cases':864,'violations':0} or f32.get('violations')!=[]:err('PROMPT B property/fuzz summary drift')
    if not all((f32.get('static_guards') or {}).values()):err('PROMPT B property/fuzz static guard drift')
    expected_areas={'ids','paths','schemas','event-ordering','host-observations','config','decision-payloads','tool-outputs','persistence-envelopes'}
    rows=f32.get('areas') or []
    if len(rows)!=9 or {x.get('area') for x in rows if isinstance(x,dict)}!=expected_areas:err('PROMPT B property/fuzz area inventory drift')
    for row in rows:
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B property/fuzz missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B property/fuzz {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B property/fuzz owner anchor drift: {row.get('area')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B property/fuzz proof anchor drift: {row.get('area')}")
        except Exception as e:err(f'PROMPT B property/fuzz row invalid: {e}')
    ar=json.loads((ROOT/f32['acceptance_receipt']).read_text(encoding='utf-8'))
    if ar.get('status')!='PASS' or not source_binding_valid(ar.get('source_binding')):err('PROMPT B property/fuzz source binding drift')
    cfg=ar.get('configuration') or {}
    if cfg.get('generated_cases')!=864 or cfg.get('cases_per_seed')!=32 or cfg.get('seeds_hex')!=['0x00c0ffee','0x5eed1234','0x000a11ce']:err('PROMPT B property/fuzz bounded seed configuration drift')
    if ar.get('terminal')!={'tests':9,'pass':9,'fail':0,'cancelled':0,'skipped':0,'todo':0} or ar.get('failures')!=[]:err('PROMPT B property/fuzz acceptance terminal drift')
    case=json.loads((ROOT/'data/validation/property-fuzz-failures/persistence-envelopes-seed-c0ffee-case-0.json').read_text(encoding='utf-8'))
    if case.get('kind')!='PROPERTY_FUZZ_HISTORICAL_REGRESSION_CASE' or case.get('observed_before_fix')!='accepted-malformed-persisted-mission':err('PROMPT B property/fuzz historical regression case drift')
except Exception as e:err(f'bad PROMPT B property/fuzz testing receipt: {e}')

# PROMPT B §38 cross-platform acceptance certification
try:
    c38=json.loads((ROOT/'data/validation/prompt-b-cross-platform-acceptance.json').read_text(encoding='utf-8'))
    if c38.get('schema')!=1 or c38.get('kind')!='PROMPT_B_CROSS_PLATFORM_ACCEPTANCE_AUDIT' or c38.get('program')!='PROMPT_B' or c38.get('section')!=38 or c38.get('status')!='PASS':err('bad PROMPT B cross-platform audit identity/status')
    if c38.get('summary')!={'required_surfaces':7,'covered_surfaces':7,'violations':0} or c38.get('violations')!=[]:err('PROMPT B cross-platform summary drift')
    if c38.get('linux_current_certified') is not True or c38.get('windows_current_certified') is not True or c38.get('windows_historical_release_evidence') is not True:err('PROMPT B cross-platform certification boundary drift')
    ar=c38.get('acceptance_receipt'); a=json.loads((ROOT/ar).read_text(encoding='utf-8'))
    if ar!=f'data/validation/cross-platform-acceptance-{version}.json' or a.get('status')!='PASS':err('PROMPT B cross-platform current receipt drift')
    ab=a.get('source_binding') or {}; cp=c38.get('source_checkpoint') or {}
    if ab.get('tested_git_commit')!=cp.get('commit') or ab.get('tested_git_tree')!=cp.get('tree'):err('PROMPT B cross-platform source checkpoint drift')
    ga=a.get('github_actions') or {}; w=ga.get('windows') or {}; u=ga.get('ubuntu') or {}
    if ga.get('conclusion')!='success' or w.get('conclusion')!='success' or u.get('conclusion')!='success':err('PROMPT B cross-platform CI conclusion drift')
    if c38.get('post_ci_material_drift')!=[]:err('PROMPT B cross-platform post-CI material drift')
    for row in c38.get('surfaces',[]):
        rel=row.get('proof');expected=row.get('proof_sha256')
        if not isinstance(rel,str) or not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B cross-platform proof hash drift: '+str(rel))
except Exception as e:err(f'bad PROMPT B cross-platform acceptance receipt: {e}')

# PROMPT B §37 developer journey acceptance certification
try:
    d37=json.loads((ROOT/'data/validation/prompt-b-developer-journey-acceptance.json').read_text(encoding='utf-8'))
    if d37.get('schema')!=1 or d37.get('kind')!='PROMPT_B_DEVELOPER_JOURNEY_ACCEPTANCE_AUDIT' or d37.get('program')!='PROMPT_B' or d37.get('section')!=37 or d37.get('status')!='PASS':err('bad PROMPT B developer journey audit receipt identity/status')
    if d37.get('summary')!={'required':4,'covered':4,'violations':0} or d37.get('violations')!=[]:err('PROMPT B developer journey summary drift')
    if d37.get('required_journeys')!=['add-config','add-methodology','add-host-adapter-behavior','add-validation-rule']:err('PROMPT B developer journey inventory drift')
    a=json.loads((ROOT/d37['acceptance_receipt']).read_text(encoding='utf-8'))
    if a.get('status')!='PASS':err('PROMPT B developer journey acceptance not PASS')
    db=a.get('source_binding') or {}; dcommit=db.get('tested_git_commit'); dtree=db.get('tested_git_tree')
    try:
        if not isinstance(dcommit,str) or subprocess.run(['git','merge-base','--is-ancestor',dcommit,'HEAD'],cwd=ROOT).returncode!=0:err('PROMPT B developer journey source is not an ancestor of HEAD')
        if subprocess.check_output(['git','rev-parse',f'{dcommit}^{{tree}}'],cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()!=dtree:err('PROMPT B developer journey source tree drift')
        developer_surfaces=['plugin/test/q7-developer-journey-acceptance.test.mjs','data/hi-config-options.json','data/hi-methodologies.json','scripts/generate_config_policy.py','scripts/generate_methodology_policy.py','scripts/architecture_lint.mjs','docs/INSTALLATION.md','docs/SKILLS.md','docs/ARCHITECTURE.md','docs/VERIFICATION.md','data/documentation-ownership.json']
        if subprocess.run(['git','diff','--quiet',dcommit,'HEAD','--',*developer_surfaces],cwd=ROOT).returncode!=0:err('PROMPT B developer journey source-bound surface drift')
    except Exception as e:err(f'PROMPT B developer journey source binding unavailable: {e}')
    if a.get('terminal')!={'tests':4,'pass':4,'fail':0,'cancelled':0,'skipped':0,'todo':0}:err('PROMPT B developer journey terminal drift')
    rel=a.get('proof');expected=a.get('proof_sha256')
    if not isinstance(rel,str) or not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B developer journey proof hash drift')
except Exception as e:err(f'bad PROMPT B developer journey acceptance receipt: {e}')

# PROMPT B §36 user journey acceptance certification
try:
    u36=json.loads((ROOT/'data/validation/prompt-b-user-journey-acceptance.json').read_text(encoding='utf-8'))
    if u36.get('schema')!=1 or u36.get('kind')!='PROMPT_B_USER_JOURNEY_ACCEPTANCE_AUDIT' or u36.get('program')!='PROMPT_B' or u36.get('section')!=36 or u36.get('status')!='PASS':err('bad PROMPT B user journey audit receipt identity/status')
    if u36.get('summary')!={'required':7,'covered':7,'violations':0} or u36.get('violations')!=[]:err('PROMPT B user journey summary drift')
    if u36.get('required_scenarios')!=['small-task','medium-feature','complex-mission','failure','authority','unsupported','restart']:err('PROMPT B user journey scenario inventory drift')
    a=json.loads((ROOT/u36['acceptance_receipt']).read_text(encoding='utf-8'))
    if a.get('status')!='PASS' or not source_binding_valid(a.get('source_binding')):err('PROMPT B user journey source binding drift')
    if a.get('terminal')!={'tests':7,'pass':7,'fail':0,'cancelled':0,'skipped':0,'todo':0}:err('PROMPT B user journey terminal drift')
    rel=a.get('proof'); expected=a.get('proof_sha256')
    if not isinstance(rel,str) or not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B user journey proof hash drift')
except Exception as e:err(f'bad PROMPT B user journey acceptance receipt: {e}')

# PROMPT B §33 replay testing certification
try:
    r33=json.loads((ROOT/'data/validation/prompt-b-replay-testing.json').read_text(encoding='utf-8'))
    if r33.get('schema')!=1 or r33.get('kind')!='PROMPT_B_REPLAY_TESTING_AUDIT' or r33.get('program')!='PROMPT_B' or r33.get('section')!=33 or r33.get('status')!='PASS':err('bad PROMPT B replay testing audit receipt identity/status')
    if r33.get('summary')!={'required_surfaces':5,'covered_surfaces':5,'cases':28,'nondeterministic_drift':0,'violations':0} or r33.get('violations')!=[]:err('PROMPT B replay testing summary drift')
    if r33.get('surface_counts')!={'semantic_routing':5,'worker_scheduling':5,'host_events':5,'completion':5,'recovery':8}:err('PROMPT B replay surface inventory drift')
    if not all((r33.get('static_guards') or {}).values()):err('PROMPT B replay static guard drift')
    for rel,expected in (r33.get('proof_hashes') or {}).items():
        if not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B replay proof hash drift: '+str(rel))
    a=json.loads((ROOT/r33['acceptance_receipt']).read_text(encoding='utf-8'))
    if a.get('status')!='PASS' or not source_binding_valid(a.get('source_binding')):err('PROMPT B replay source binding drift')
    if a.get('nondeterministic_semantic_drift') is not False or a.get('first_pass_digest')!=a.get('second_pass_digest') or a.get('mismatches')!=[]:err('PROMPT B replay deterministic digest drift')
    for rel,expected in {**(a.get('inputs') or {}),**(a.get('owner_hashes') or {})}.items():
        if not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B replay acceptance source/input drift: '+str(rel))
except Exception as e:err(f'bad PROMPT B replay testing receipt: {e}')


# PROMPT B §34 failure injection certification
try:
    f34=json.loads((ROOT/'data/validation/prompt-b-failure-injection.json').read_text(encoding='utf-8'))
    if f34.get('schema')!=1 or f34.get('kind')!='PROMPT_B_FAILURE_INJECTION_AUDIT' or f34.get('program')!='PROMPT_B' or f34.get('section')!=34 or f34.get('status')!='PASS':err('bad PROMPT B failure injection audit receipt identity/status')
    if f34.get('summary')!={'required':12,'covered':12,'violations':0} or f34.get('violations')!=[]:err('PROMPT B failure injection summary drift')
    expected=['provider-timeout','model-unavailable','rate-limit','tool-error','permission-deny','process-crash','workspace-failure','disk-write-failure','corrupt-state','child-session-failure','browser-failure','network-failure']
    if f34.get('required_injections')!=expected or not all((f34.get('static_guards') or {}).values()):err('PROMPT B failure injection inventory/static guard drift')
    a=json.loads((ROOT/f34['acceptance_receipt']).read_text(encoding='utf-8'))
    if a.get('status')!='PASS' or not source_binding_valid(a.get('source_binding')):err('PROMPT B failure injection source binding drift')
    terminal=a.get('terminal') or {}
    if not isinstance(terminal.get('tests'),int) or terminal.get('tests',0)<=0 or terminal.get('pass')!=terminal.get('tests') or terminal.get('fail')!=0 or terminal.get('cancelled')!=0 or terminal.get('skipped')!=0 or terminal.get('todo')!=0:err('PROMPT B failure injection terminal drift')
    if not (a.get('bounded_recovery') or {}).get('no_infinite_retry') or a.get('summary')!={'required':12,'covered':12,'violations':0} or a.get('violations')!=[]:err('PROMPT B failure injection bounded recovery drift')
    for row in a.get('injections',[]):
        rel=row.get('proof');expected_hash=row.get('proof_sha256');anchor=row.get('proof_anchor')
        if not isinstance(rel,str) or not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected_hash:err('PROMPT B failure injection proof hash drift: '+str(rel));continue
        if not isinstance(anchor,str) or anchor not in (ROOT/rel).read_text(encoding='utf-8',errors='replace'):err('PROMPT B failure injection proof anchor drift: '+str(row.get('injection')))
except Exception as e:err(f'bad PROMPT B failure injection receipt: {e}')


# PROMPT B §35 performance/token/resource benchmark certification
try:
    p35=json.loads((ROOT/'data/validation/prompt-b-performance-resource-benchmarks.json').read_text(encoding='utf-8'))
    if p35.get('schema')!=2 or p35.get('kind')!='PROMPT_B_PERFORMANCE_RESOURCE_BENCHMARK_AUDIT' or p35.get('program')!='PROMPT_B' or p35.get('section')!=35 or p35.get('status')!='PASS':err('bad PROMPT B performance/resource benchmark audit identity/status')
    required=['startup','task_initialization','skill_selection','project_methodology_learning','context_projection','persistence','scheduling','process_output','memory_growth','token_usage']
    if p35.get('required_metrics')!=required or p35.get('summary')!={'required':10,'covered':10,'violations':0} or p35.get('violations')!=[] or not all((p35.get('static_guards') or {}).values()):err('PROMPT B performance/resource benchmark summary drift')
    b=json.loads((ROOT/p35['benchmark_receipt']).read_text(encoding='utf-8'))
    if b.get('status')!='PASS' or not source_binding_valid(b.get('source_binding')):err('PROMPT B performance/resource benchmark source binding drift')
    if list((b.get('metrics') or {}).keys())!=required:err('PROMPT B performance/resource benchmark metric inventory drift')
    metrics=b.get('metrics') or {}
    if any((metrics.get(k) or {}).get('status')!='PASS' for k in required):err('PROMPT B performance/resource metric failure')
    if (metrics.get('skill_selection') or {}).get('selected_total',0)<=0:err('PROMPT B skill selection benchmark drift')
    if (metrics.get('project_methodology_learning') or {}).get('ready_at_observation')!=2:err('PROMPT B project methodology learning benchmark drift')
    if (metrics.get('context_projection') or {}).get('total_projected_chars',0)<=0:err('PROMPT B context projection benchmark drift')
    tok=metrics.get('token_usage') or {};obs=tok.get('provider_observed') or {};est=tok.get('estimated') or {}
    if not (obs.get('confidence')=='exact' and obs.get('source')=='provider-usage' and est.get('confidence')=='estimated' and est.get('source')=='estimated'):err('PROMPT B token benchmark truth boundary drift')
    if b.get('optimization_decision')!='NO_NEW_SCHEDULER_OR_WORK_STEALING_COMPLEXITY_WITHOUT_MEASURED_BENEFIT':err('PROMPT B benchmark optimization decision drift')
except Exception as e:err(f'bad PROMPT B performance/resource benchmark receipt: {e}')

# PROMPT B §41 hygiene certification
try:
    h41=json.loads((ROOT/'data/validation/prompt-b-hygiene.json').read_text(encoding='utf-8'))
    if h41.get('schema')!=1 or h41.get('kind')!='PROMPT_B_HYGIENE_AUDIT' or h41.get('section')!=41 or h41.get('status')!='PASS':err('bad PROMPT B hygiene audit identity/status')
    if not all((h41.get('checks') or {}).values()) or len(h41.get('checks') or {})!=12 or h41.get('violations')!=[]:err('PROMPT B hygiene checks incomplete')
    hcommit=h41.get('audited_source_commit')
    for rel,expected in (h41.get('proof_hashes') or {}).items():
        try:
            if git_blob_sha256(hcommit,rel)!=expected:err('PROMPT B hygiene checkpoint proof drift: '+str(rel))
        except Exception:err('PROMPT B hygiene checkpoint proof unavailable: '+str(rel))
except Exception as e:err(f'bad PROMPT B hygiene audit: {e}')

# PROMPT B §40 zero-known-defect closure loop
try:
    z40=json.loads((ROOT/'data/validation/prompt-b-zero-known-defect-loop.json').read_text(encoding='utf-8'))
    if z40.get('schema')!=2 or z40.get('kind')!='PROMPT_B_ZERO_KNOWN_DEFECT_CLOSURE_LOOP' or z40.get('section')!=40 or z40.get('status')!='PASS':err('bad PROMPT B zero-known-defect loop identity/status')
    zs=z40.get('summary') or {}
    if zs.get('recorded_findings')!=len(z40.get('defects') or []) or zs.get('unresolved_known_defects')!=0 or zs.get('closure_receipts_checked')!=len(z40.get('defects') or []) or zs.get('exact_t3_capabilities')!=3 or zs.get('lifecycle_invariants_pass')!=61 or zs.get('documentation_parity_violations')!=0:err('PROMPT B zero-known-defect summary drift')
    if z40.get('violations')!=[] or len({x.get('id') for x in z40.get('defects') or []})!=len(z40.get('defects') or []):err('PROMPT B zero-known-defect ledger drift')
    required_post_t4={'npm-view-json-shape-verifier-drift','npm-postpublish-registry-read-after-write-race','post-t4-documentation-stale-publication-state','npm-packed-public-document-links-incomplete','windows-packed-doc-audit-npm-shim-resolution'}
    if not required_post_t4<={x.get('id') for x in z40.get('defects') or []}:err('PROMPT B zero-known-defect post-T4 closure drift')
    zcommit=(z40.get('source_checkpoint') or {}).get('commit')
    for row in z40.get('defects') or []:
        rel=row.get('regression_receipt');expected=row.get('regression_receipt_sha256')
        if not isinstance(rel,str):err('PROMPT B zero-known-defect proof path invalid: '+str(rel));continue
        try:
            if git_blob_sha256(zcommit,rel)!=expected:err('PROMPT B zero-known-defect checkpoint proof drift: '+str(rel))
        except Exception:err('PROMPT B zero-known-defect checkpoint proof unavailable: '+str(rel))
        if len(row.get('closure_pipeline') or [])!=12:err('PROMPT B zero-known-defect closure pipeline incomplete: '+str(row.get('id')))
except Exception as e:err(f'bad PROMPT B zero-known-defect loop: {e}')

# PROMPT B §39 exact-current OpenCode T3 certification
try:
    q39=json.loads((ROOT/'data/validation/prompt-b-exact-current-opencode-t3.json').read_text(encoding='utf-8'))
    if q39.get('schema')!=1 or q39.get('kind')!='PROMPT_B_EXACT_CURRENT_OPENCODE_T3_AUDIT' or q39.get('program')!='PROMPT_B' or q39.get('section')!=39 or q39.get('status')!='PASS':err('bad PROMPT B exact-current OpenCode T3 receipt identity/status')
    if q39.get('summary')!={'required_capabilities':3,'exact_current_capabilities':3,'lifecycle_invariants':61,'violations':0} or q39.get('violations')!=[]:err('PROMPT B exact-current OpenCode T3 summary drift')
    obs=q39.get('current_version_observation') or {}
    if obs.get('tested_binary_version')!='1.18.18' or obs.get('locked_sdk')!='1.18.18' or not isinstance(obs.get('tested_binary_sha256'),str) or len(obs.get('tested_binary_sha256'))!=64:err('PROMPT B exact-current OpenCode version observation drift')
    if q39.get('candidate_release')!=version:err('PROMPT B exact-current candidate release drift')
    if not re.fullmatch(r'[a-f0-9]{40}',str(q39.get('exact_source_commit',''))) or not re.fullmatch(r'[a-f0-9]{40}',str(q39.get('exact_source_tree',''))):err('PROMPT B exact-current source binding invalid')
    fresh39=json.loads((ROOT/q39.get('fresh_consumer_receipt','')).read_text(encoding='utf-8'))
    if fresh39.get('status')!='PASS' or fresh39.get('source',{}).get('commit')!=q39.get('exact_source_commit') or fresh39.get('package',{}).get('release')!=version:err('PROMPT B exact-current fresh-consumer binding drift')
    if hashlib.sha256((ROOT/q39['fresh_consumer_receipt']).read_bytes()).hexdigest()!=q39.get('fresh_consumer_sha256'):err('PROMPT B exact-current fresh-consumer hash drift')
    if q39.get('capability_evidence_mode')!='CURRENT_EXACT_HOST_PACKAGE_PLUS_RUNTIME_EQUIVALENT_EXACT_T3':err('PROMPT B exact-current capability evidence mode drift')
    for cap,row in (q39.get('capabilities') or {}).items():
        rel=row.get('receipt');expected=row.get('receipt_sha256')
        if row.get('status')!='SUPPORTED_T3' or row.get('runtime_equivalent_to_current') is not True or row.get('runtime_hash_drift')!=[] or not re.fullmatch(r'[a-f0-9]{40}',str(row.get('receipt_source_commit',''))):err('PROMPT B exact-current capability equivalence/status drift: '+str(cap))
        if not isinstance(rel,str) or not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B exact-current receipt hash drift: '+str(rel))
    for key in ['compatibility_projection','lifecycle_audit']:
        rel=q39.get(key); expected=q39.get(key.replace('_projection','').replace('_audit','')+'_sha256') if False else None
    if hashlib.sha256((ROOT/q39['compatibility_projection']).read_bytes()).hexdigest()!=q39.get('compatibility_sha256'):err('PROMPT B exact-current compatibility hash drift')
    if hashlib.sha256((ROOT/q39['lifecycle_audit']).read_bytes()).hexdigest()!=q39.get('lifecycle_sha256'):err('PROMPT B exact-current lifecycle hash drift')
except Exception as e:err(f'bad PROMPT B exact-current OpenCode T3 receipt: {e}')

try:
    nr=json.loads((ROOT/'data/validation/opencode-native-reevaluation.json').read_text(encoding='utf-8'))
    if nr.get('schema')!=1 or nr.get('kind')!='EXACT_CURRENT_OPENCODE_NATIVE_REEVALUATION' or nr.get('program')!='PROMPT_B' or nr.get('status')!='PASS':err('bad PROMPT B native reevaluation receipt identity/status')
    oc=nr.get('opencode',{})
    if oc.get('version')!='1.18.18' or oc.get('source_ref')!='v1.18.18' or not isinstance(oc.get('source_commit'),str) or not re.fullmatch(r'[a-f0-9]{40}',oc.get('source_commit')) or oc.get('source_worktree_used') is not False or oc.get('source_read_mode')!='git-blob':err('PROMPT B native reevaluation exact-source identity drift')
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
except Exception as e:err(f'bad PROMPT A reconstruction receipt: {e}')


# PROMPT B §27 dependency / supply-chain / license certification
try:
    d27=json.loads((ROOT/'data/validation/prompt-b-dependency-supply-chain-license.json').read_text(encoding='utf-8'))
    if d27.get('schema')!=1 or d27.get('kind')!='PROMPT_B_DEPENDENCY_SUPPLY_CHAIN_LICENSE_AUDIT' or d27.get('program')!='PROMPT_B' or d27.get('section')!=27 or d27.get('status')!='PASS':err('bad PROMPT B dependency/supply-chain/license receipt identity/status')
    if d27.get('summary')!={'required':8,'covered':8,'violations':0} or d27.get('violations')!=[]:err('PROMPT B dependency/supply-chain/license summary drift')
    import hashlib
    for row in d27.get('invariants',[]):
        for key in ('owner','proof'):
            rel=row.get(key); expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B dependency/supply-chain/license missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B dependency/supply-chain/license {key} hash drift: {rel}')
        try:
            if row.get('owner_anchor') not in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B dependency/supply-chain/license owner anchor drift: {row.get('invariant')}")
            if row.get('proof_anchor') not in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace'):err(f"PROMPT B dependency/supply-chain/license proof anchor drift: {row.get('invariant')}")
        except Exception as e:err(f'PROMPT B dependency/supply-chain/license row invalid: {e}')
    if not all((d27.get('static_guards') or {}).values()):err('PROMPT B dependency/supply-chain/license static guard drift')
except Exception as e:err(f'bad PROMPT B dependency/supply-chain/license receipt: {e}')


# PROMPT B §28 release engineering certification
try:
    r28=json.loads((ROOT/'data/validation/prompt-b-release-engineering.json').read_text(encoding='utf-8'))
    if r28.get('schema')!=1 or r28.get('kind')!='PROMPT_B_RELEASE_ENGINEERING_AUDIT' or r28.get('program')!='PROMPT_B' or r28.get('section')!=28 or r28.get('violations')!=[]:err('bad PROMPT B release engineering receipt identity/status')
    published=(ROOT/f'data/validation/release-publication-{version}.json').is_file()
    expected_status='CLOSED_T4' if published else 'CLOSED_LOCAL_T4_BLOCKED'
    expected_summary={'stages':13,'local_pass_or_historical':13 if published else 8,'blocked_external_or_identity':0 if published else 5,'violations':0}
    if r28.get('status')!=expected_status:err('bad PROMPT B release engineering receipt identity/status')
    if r28.get('summary')!=expected_summary:err('PROMPT B release engineering summary drift')
    if not all((r28.get('checks') or {}).values()):err('PROMPT B release engineering check drift')
    for rel,expected in (r28.get('proof_hashes') or {}).items():
        if not (ROOT/rel).is_file() or hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err('PROMPT B release engineering proof hash drift: '+str(rel))
    obs=r28.get('registry_observation',{}); expected_view='PUBLISHED_T4' if published else 'PREPUBLICATION'
    if obs.get('view')!=expected_view or obs.get('publish_attempted') is not published or obs.get('authority_granted') is not True or obs.get('authority_condition')!='effective only after all engineering/final certification completes':err('PROMPT B release engineering authority boundary drift')
    pub=json.loads((ROOT/'data/validation/release-publication-0.1.1.json').read_text(encoding='utf-8'))
    if pub.get('status')!='PASS_T4' or (pub.get('github_release') or {}).get('status')!='PASS_T4' or (pub.get('npm_registry') or {}).get('status')!='PASS_T4' or (pub.get('fresh_registry_consumer') or {}).get('status')!='PASS_T4':err('PROMPT B release publication T4 drift')
except Exception as e:err(f'bad PROMPT B release engineering receipt: {e}')


# PROMPT B §29 documentation defect-cycle certification
try:
    d29=json.loads((ROOT/'data/validation/prompt-b-documentation-defect-cycle.json').read_text(encoding='utf-8'))
    if d29.get('schema')!=1 or d29.get('kind')!='PROMPT_B_DOCUMENTATION_DEFECT_CYCLE_AUDIT' or d29.get('program')!='PROMPT_B' or d29.get('section')!=29 or d29.get('status')!='PASS':err('bad PROMPT B documentation defect-cycle receipt identity/status')
    if d29.get('summary')!={'required':5,'covered':5,'violations':0} or d29.get('violations')!=[]:err('PROMPT B documentation defect-cycle summary drift')
    for row in d29.get('cycle',[]):
        for key in ('owner','proof'):
            rel=row.get(key);expected=row.get(f'{key}_sha256')
            if not isinstance(rel,str) or not (ROOT/rel).is_file():err(f'PROMPT B documentation defect-cycle missing {key}: {rel}');continue
            if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=expected:err(f'PROMPT B documentation defect-cycle {key} hash drift: {rel}')
    if not all((d29.get('static_guards') or {}).values()):err('PROMPT B documentation defect-cycle static guard drift')
except Exception as e:err(f'bad PROMPT B documentation defect-cycle receipt: {e}')

# PROMPT B §§42-47 final certification chain
try:
    f42=json.loads((ROOT/'data/validation/prompt-b-final-documentation-reaudit.json').read_text(encoding='utf-8'))
    if f42.get('schema')!=1 or f42.get('kind')!='PROMPT_B_FINAL_DOCUMENTATION_REAUDIT' or f42.get('section')!=42 or f42.get('status')!='PASS':err('bad PROMPT B final documentation re-audit')
    if f42.get('summary',{}).get('violations')!=0 or f42.get('violations')!=[]:err('PROMPT B final documentation re-audit incomplete')
    f42commit=(f42.get('source_checkpoint') or {}).get('commit')
    for row in f42.get('areas',[]):
        rel=row.get('path'); expected=row.get('checkpoint_sha256'); expected_oid=row.get('checkpoint_blob_oid')
        if not isinstance(rel,str):err('PROMPT B final documentation path invalid: '+str(rel));continue
        try:
            if git_blob_sha256(f42commit,rel)!=expected or git_blob_oid(f42commit,rel)!=expected_oid:err('PROMPT B final documentation checkpoint drift: '+str(rel))
        except Exception:err('PROMPT B final documentation checkpoint unavailable: '+str(rel))

    f43=json.loads((ROOT/'data/validation/prompt-b-certification-evidence-tiers.json').read_text(encoding='utf-8'))
    if f43.get('schema')!=1 or f43.get('kind')!='PROMPT_B_CERTIFICATION_EVIDENCE_TIERS' or f43.get('section')!=43 or f43.get('status')!='PASS':err('bad PROMPT B certification evidence tiers')
    if f43.get('violations')!=[] or len(f43.get('claims') or [])!=7:err('PROMPT B certification evidence tier coverage drift')
    ranks={'NONE':-1,'T0':0,'T1':1,'T2':2,'T3':3,'T4':4}
    for row in f43.get('claims',[]):
        if row.get('claim')!='external-publication' and ranks.get(row.get('available_tier'),-1)<ranks.get(row.get('required_tier'),99):err('PROMPT B insufficient evidence tier: '+str(row.get('claim')))

    f44=json.loads((ROOT/f'data/validation/final-system-certification-{version}.json').read_text(encoding='utf-8'))
    if f44.get('schema')!=1 or f44.get('kind')!='FINAL_SYSTEM_CERTIFICATION' or f44.get('section')!=44 or f44.get('release')!=version:err('bad final system certification identity')
    if f44.get('status') not in {'PARTIAL','CERTIFIED'}:err('invalid final system certification state')
    blockers=f44.get('blockers') or []
    if f44.get('status')=='CERTIFIED' and blockers:err('CERTIFIED final system has blockers')
    if f44.get('status')=='PARTIAL' and not blockers:err('PARTIAL final system has no blocker')
    if f44.get('known_defect_count')!=0:err('final system certification has known defects')

    f45=json.loads((ROOT/'data/validation/prompt-b-certification-vocabulary.json').read_text(encoding='utf-8'))
    if f45.get('schema')!=1 or f45.get('kind')!='PROMPT_B_CERTIFICATION_VOCABULARY_AUDIT' or f45.get('section')!=45 or f45.get('status')!='PASS' or f45.get('violations')!=[]:err('bad PROMPT B certification vocabulary audit')
    if f45.get('current_label')!=f44.get('status'):err('certification vocabulary/final status mismatch')

    f46=json.loads((ROOT/'data/validation/prompt-b-final-product-quality.json').read_text(encoding='utf-8'))
    if f46.get('schema')!=1 or f46.get('kind')!='PROMPT_B_FINAL_PRODUCT_QUALITY_AUDIT' or f46.get('section')!=46 or f46.get('status')!='PASS':err('bad PROMPT B final product quality audit')
    if f46.get('summary')!={'required':10,'covered':10,'violations':0} or not all((f46.get('checks') or {}).values()):err('PROMPT B final product quality incomplete')

    f47=json.loads((ROOT/'data/validation/prompt-b-final-mandatory-state.json').read_text(encoding='utf-8'))
    if f47.get('schema')!=1 or f47.get('kind')!='PROMPT_B_FINAL_MANDATORY_END_STATE_AUDIT' or f47.get('section')!=47 or f47.get('status')!='PASS':err('bad PROMPT B final mandatory state audit')
    if f47.get('summary')!={'required':12,'coherent':12,'violations':0} or not all((f47.get('coherence') or {}).values()):err('PROMPT B final mandatory state incoherent')
    if f47.get('certification_state')!=f44.get('status'):err('final mandatory state/certification mismatch')
except Exception as e:err(f'bad PROMPT B §§42-47 final certification chain: {e}')

for p in (ROOT/'data').rglob('*.json'):
    try:json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:err(f'bad json {p.name}: {e}')
if ERR:
    print('VALIDATION FAIL'); [print('- '+x) for x in ERR]; sys.exit(1)
print('VALIDATION PASS'); print(f'version={version} roles={len(roles)} methodologies={len(skills)} product=HI docs={len(actual_docs)}')
