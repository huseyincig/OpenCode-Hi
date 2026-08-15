from __future__ import annotations
import hashlib, importlib.util, json, os, subprocess, sys, zipfile,re
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
V=(ROOT/'VERSION').read_text().strip()

def run(*args):return subprocess.run([sys.executable,*map(str,args)],text=True,capture_output=True)
def load_module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);assert spec and spec.loader;spec.loader.exec_module(m);return m

def test_identity_is_hi():
    d=json.loads((ROOT/'data/product.json').read_text())
    assert d['product_name']=='OpenCode-Hi' and d['short_name']=='HI' and d['version']==V
    assert d['plugin_package']=='opencode-hi' and d['repository']=='https://github.com/huseyincig/OpenCode-Hi'

def test_root_git_package_contract():
    d=json.loads((ROOT/'package.json').read_text()); assert d['name']=='opencode-hi' and d['version']==V
    assert d['main']=='plugin/dist/plugin.js' and (ROOT/d['main']).is_file() and 'skills' in d['files']
    assert 'dependencies' not in d and 'README.tr.md' in d['files']

def test_root_is_product_clean():
    assert not any((ROOT/x).exists() for x in ['KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','HI.cmd','HI.sh','HI-VALIDATE.cmd','HI-RELEASE-PREP.cmd'])
    assert {p.name for p in (ROOT/'docs').glob('*.md')}=={'ARCHITECTURE.md','INSTALLATION.md','SKILLS.md','VALIDATION.md','THREAT-MODEL.md','SOURCE-REUSE-MATRIX.md','BASELINE-RECEIPT.md','ARCHITECTURE-REALITY-MAP.md','CONTEXT.md','EXECUTION-POLICY.md','HOSTS.md','HUMAN-DECISIONS.md','PRIVACY.md','PROJECT-INTELLIGENCE.md','RELEASE.md','VERIFICATION.md','BENCHMARKS.md','IMPLEMENTATION-REPORT.md','TERMINOLOGY.md','PRODUCT-IDENTITY.md','FILESYSTEM-LAYOUT.md','STORAGE-ARCHITECTURE.md','STORAGE-OWNERSHIP-MATRIX.md','SKILL-ARTIFACT-OWNERSHIP.md','FINAL-ACCEPTANCE.md','HI-NAMING-NAMESPACE.md'}

def test_semantic_contract_names_only():
    for rel in ['data/validation/implementation-coverage.json','data/validation/native-coverage.json','data/validation/flow-coverage.json','data/validation/flow-acceptance.json','data/validation/source-gates.json']:assert (ROOT/rel).is_file()
    for rel in ['data/feature-ledger-09-coverage.json','data/native-first-10-coverage.json','data/flow-11-coverage.json','data/flow-11-acceptance.json','data/observed-runtime-smoke-1.18.16.json']:assert not (ROOT/rel).exists()

def test_setup_adds_only_hi_and_preserves_other_plugins(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['user-plugin@1']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);assert r.returncode==0,r.stderr
    p=json.loads((tmp_path/'opencode.json').read_text())['plugin']; assert 'opencode-hi@0.1.0' in p
    assert 'user-plugin@1' in p and len([x for x in p if x.startswith('opencode-hi@')])==1

def test_setup_blocks_conflicting_hi_registration(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['opencode-hi@9.9.9']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path); assert r.returncode==2 and json.loads(r.stdout)['status']=='BLOCKED'

def test_uninstall_removes_only_hi(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    assert run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path).returncode==0
    p=json.loads((tmp_path/'opencode.json').read_text())['plugin']; assert not any('OpenCode-Hi' in x for x in p)



def test_exact_package_version_install_doctor_and_uninstall_preserve_user_fields(tmp_path):
    version='0.1.0'
    cfg=tmp_path/'opencode.json'
    cfg.write_text(json.dumps({'plugin':['user-plugin@example'],'mcp':{'user':{'type':'remote','url':'https://example.invalid/mcp'}},'theme':'user-theme'}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path,'--version',version); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='APPLIED'
    expected=f'opencode-hi@{version}'
    assert out['plugin_spec']==expected
    data=json.loads(cfg.read_text()); assert expected in data['plugin'] and 'user-plugin@example' in data['plugin']
    assert data['mcp']['user']['url']=='https://example.invalid/mcp' and data['theme']=='user-theme'
    d=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); doctor=json.loads(d.stdout)
    assert d.returncode==0 and doctor['status']=='OK' and doctor['hi_specs']==[expected]
    u=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path); un=json.loads(u.stdout)
    assert u.returncode==0 and un['status']=='APPLIED' and un['removed']==[expected]
    after=json.loads(cfg.read_text()); assert after['plugin']==['user-plugin@example']
    assert after['mcp']['user']['url']=='https://example.invalid/mcp' and after['theme']=='user-theme'

def test_doctor_is_machine_readable(tmp_path):
    run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path); r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); d=json.loads(r.stdout)
    assert r.returncode==0 and d['status']=='OK' and d['short']=='HI'

def test_source_contract_evidence_exists():
    d=json.loads((ROOT/'data/validation/source-contracts.json').read_text()); assert d['release']==V
    for c in d['contracts'].values():
        for e in c.get('evidence',[]):assert (ROOT/e.split('#',1)[0]).exists(),e

def test_validate_passes():
    r=run(ROOT/'scripts/validate.py'); assert r.returncode==0,r.stdout+r.stderr

def test_validator_rejects_incomplete_dependency_lock_metadata(tmp_path):
    import shutil
    probe=tmp_path/'repo'
    shutil.copytree(ROOT,probe,ignore=shutil.ignore_patterns('node_modules','dist','.pytest_cache','__pycache__'))
    lock_path=probe/'plugin'/'package-lock.json'
    lock=json.loads(lock_path.read_text())
    target=next(k for k,v in lock['packages'].items() if k and not v.get('link'))
    lock['packages'][target].pop('resolved',None)
    lock_path.write_text(json.dumps(lock))
    # validation also needs a runtime entrypoint; use the current built file as a fixture.
    dist=probe/'plugin'/'dist'; dist.mkdir(parents=True,exist_ok=True); (dist/'plugin.js').write_text('// fixture')
    r=subprocess.run([sys.executable,str(probe/'scripts/validate.py')],text=True,capture_output=True,cwd=probe)
    assert r.returncode!=0 and 'package-lock entry missing resolved/integrity' in (r.stdout+r.stderr)

def test_plugin_install_script_allowlist_is_exact():
    pp=json.loads((ROOT/'plugin/package.json').read_text())
    assert pp.get('allowScripts')=={'msgpackr-extract@3.0.4':True}

def test_validator_rejects_nested_project_runtime_state(tmp_path):
    import shutil
    probe=tmp_path/'repo'
    shutil.copytree(ROOT,probe,ignore=shutil.ignore_patterns('node_modules','dist','.pytest_cache','__pycache__'))
    leaked=probe/'plugin'/'.opencode'/'.hi'
    leaked.mkdir(parents=True,exist_ok=True)
    (leaked/'runtime-state.json').write_text('{}')
    r=subprocess.run([sys.executable,str(probe/'scripts/validate.py')],text=True,capture_output=True,cwd=probe)
    assert r.returncode!=0 and 'nested project-local runtime directory' in (r.stdout+r.stderr)

def _build(tmp_path):
    out=tmp_path/'dist';src=tmp_path/'source';r=run(ROOT/'scripts/release-build.py','--out',out,'--source-out',src);assert r.returncode==0,r.stderr
    return out/f'OpenCode-Hi-{V}-DISTRIBUTABLE.zip',src/f'OpenCode-Hi-{V}-SOURCE.zip'

def test_canonical_generators_write_platform_stable_lf_bytes():
    generators=['generate_config_policy.py','generate_methodology_policy.py','generate_methodology_skills.py','generate_permission_policy.py','generate_plugin_agents.py','generate_role_policy.py']
    for name in generators:
        text=(ROOT/'scripts'/name).read_text()
        assert '.write_bytes(' in text, name
        assert '.write_text(' not in text, name
    receipt=(ROOT/'scripts/projection_receipts.mjs').read_text()
    assert "replace(/\\r\\n?/g,'\\n')" in receipt

def test_node_release_scripts_use_platform_safe_file_url_paths():
    for rel in ['scripts/generate_projection_receipts.mjs','scripts/architecture_lint.mjs']:
        text=(ROOT/rel).read_text()
        assert 'fileURLToPath' in text
        assert "import.meta.url).pathname" not in text

def test_release_names_and_source_integrity(tmp_path):
    dist,src=_build(tmp_path); assert dist.is_file() and src.is_file()
    with zipfile.ZipFile(src) as z:n=set(z.namelist())
    assert {'package.json','README.tr.md','plugin/package-lock.json','plugin/dist/plugin.js','docs/ARCHITECTURE.md','docs/INSTALLATION.md','docs/SKILLS.md','docs/VALIDATION.md'}<=n
    assert 'WORK-STATE.md' not in n and 'KURULUM.md' not in n
    assert not any(part == '.opencode' for name in n for part in Path(name).parts), sorted(x for x in n if '.opencode' in Path(x).parts)[:10]
    assert 'plugin/.opencode/hi/runtime/runtime-state.json' not in n

def test_release_has_no_duplicate_entries(tmp_path):
    for z in _build(tmp_path):
        with zipfile.ZipFile(z) as f:n=f.namelist();assert len(n)==len(set(n))

def test_release_mtime_invariant(tmp_path):
    a=_build(tmp_path);h1=[hashlib.sha256(x.read_bytes()).hexdigest() for x in a];targets=[ROOT/'README.md',ROOT/'package.json'];old=[x.stat().st_mtime_ns for x in targets]
    try:
        for x in targets:s=x.stat();os.utime(x,ns=(s.st_atime_ns,s.st_mtime_ns+7_000_000_000))
        b=_build(tmp_path);assert h1==[hashlib.sha256(x.read_bytes()).hexdigest() for x in b]
    finally:
        for x,m in zip(targets,old):s=x.stat();os.utime(x,ns=(s.st_atime_ns,m))

def test_safe_archive_rejects_traversal(tmp_path):
    z=tmp_path/'bad.zip'
    with zipfile.ZipFile(z,'w') as f:f.writestr('../escape.txt','x')
    m=load_module('safe_archive',ROOT/'scripts/safe_archive.py')
    with pytest.raises(m.UnsafeArchive):m.inspect_zip(z)

def test_canonical_agent_sources_are_eight():
    assert sorted(p.stem for p in (ROOT/'roles').glob('*.md'))==sorted(['working-manager','manager','coder','repository-explorer','qa-reviewer','architect','security-reviewer','visual-qa'])

def test_living_validation_receipts_do_not_hardcode_stale_test_counts():
    gates=json.loads((ROOT/'data/validation/release-gates.json').read_text())
    assert gates['gates']['node_runtime_acceptance']=='PASS_LOCAL_CURRENT_SOURCE'
    assert gates['gates']['python_acceptance']=='PASS_LOCAL_CURRENT_SOURCE'
    assert 'tests' not in gates['current_local_evidence']['node']
    assert 'tests' not in gates['current_local_evidence']['python']
    audit=json.loads((ROOT/'data/validation/final-dod-audit.json').read_text())
    assert isinstance(audit['local_acceptance']['node'],dict) and 'node_tests' not in audit['local_acceptance']
    assert isinstance(audit['local_acceptance']['python'],dict) and 'python_tests' not in audit['local_acceptance']

def test_release_gate_stays_blocked_until_exact_candidate_external_completion():
    d=json.loads((ROOT/'data/validation/release-gates.json').read_text())
    assert d['release']==V
    assert d['gates']['source_integrity'].startswith('PASS_LOCAL_')
    assert d['gates']['deterministic_release']=='PASS_LOCAL_CURRENT_WORKTREE'
    assert d['current_local_evidence']['deterministic_release']['status']=='PASS'
    assert 'self-referential' in d['current_local_evidence']['deterministic_release']['hash_binding']
    assert d['gates']['node_runtime_acceptance'].startswith('PASS_LOCAL_')
    assert d['gates']['python_acceptance'].startswith('PASS_LOCAL_')
    for gate in ('plain_opencode_smoke','packaged_agents_skills','opencode_native_child_sessions','opencode_model_provider_binding','permission_denial_runtime'):
        assert d['gates'][gate]=='PASS_EXACT_SOURCE_HOST_1_18_18'
    assert d['gates']['native_package_plugin_install_exact_candidate']=='PASS_EXACT_FINAL_SOURCE_F1A2C1C_OPENCODE_1_18_18'
    assert d['gates']['windows_runtime_smoke']=='PASS_GITHUB_ACTIONS_EXACT_FINAL_SOURCE_F1A2C1C'
    assert d['gates']['dependency_supply_chain_external']=='PASS_CLEAN_CONSUMER_EXACT_FINAL_SOURCE_F1A2C1C'
    pre=d['current_local_evidence']['pre_freeze_external']
    assert pre['status']=='PASS_EXACT_SOURCE_9F3A1A9' and pre['github_actions_run']==31813070875
    rr=ROOT/pre['receipt']; assert rr.is_file()
    receipt=json.loads(rr.read_text())
    assert receipt['source_binding']['tested_git_commit']=='9f3a1a9025f73f0da46dcd88da31a6f5ef44c545'
    assert receipt['github_actions']['conclusion']=='success'
    assert {j['name']:j['conclusion'] for j in receipt['github_actions']['jobs']}=={'ubuntu-latest / node-22 / python-3.11':'success','windows-latest / node-22 / python-3.11':'success'}
    assert receipt['clean_consumer']['dependency_audit']['total']==0 and receipt['clean_consumer']['fresh_consumer_install']['esm_import']=='PASS'
    assert receipt['opencode_loader']['host_version']=='1.18.18' and receipt['opencode_loader']['plugin_initialized_log'] is True
    assert d['gates']['github_release_publication']=='PASS_T4_V0_1_0_EXACT_SOURCE_F1A2C1C'
    assert d['gates']['npm_registry_publication'].startswith('PENDING_AUTH_T4_')
    pub=d['current_local_evidence']['final_publication']; assert pub['released_source']=='f1a2c1c4358e5a63656da7a585b6b5793d1ed3be'
    pr=ROOT/pub['receipt']; assert pr.is_file(); publication=json.loads(pr.read_text())
    assert publication['github_release']['status']=='PASS_T4' and publication['github_release']['asset_digest_match'] is True
    assert publication['released_source']['peeled_commit']=='f1a2c1c4358e5a63656da7a585b6b5793d1ed3be'
    assert publication['final_exact_ref_ci']['conclusion']=='success'
    assert publication['final_clean_consumer']['dependency_audit']['total']==0
    assert publication['npm_registry']['status']=='BLOCKED_T4_AUTH' and publication['npm_registry']['publish_attempted'] is False
    assert d['release_blocked'] is True
    assert d['external_blockers']
    assert d['current_local_evidence']['host_acceptance']['receipt']=='data/validation/external-opencode-hi-0.1.0-host-1.18.18-head-c5d8287.json'
    assert d['current_local_evidence']['host_acceptance']['runtime_source'].startswith('c5d8287')
    progress=json.loads((ROOT/'data/validation/forensic-61-progress.json').read_text())
    assert progress['summary']['total']==61
    assert progress['summary']['complete_local']+progress['summary']['partial_external']==61
    assert progress['summary']['failed']==0
    assert progress['summary']['unresolved_internal']==0
    assert len(progress['items'])==61
    assert [x['item'] for x in progress['items']]==list(range(1,62))
    assert d['historical_receipts_not_valid_for_current_candidate']['release']!='2.0.10'

def test_uninstall_preserves_user_adopted_hi_registration(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    cfg=tmp_path/'opencode.json'; data=json.loads(cfg.read_text())
    data['plugin']=[('opencode-hi@9.9.9' if x.startswith('opencode-hi@') else x) for x in data['plugin']]
    cfg.write_text(json.dumps(data))
    r=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='PRESERVED'
    assert 'opencode-hi@9.9.9' in json.loads(cfg.read_text())['plugin']

def test_uninstall_without_ownership_never_deletes_hi_registration(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['opencode-hi@user-managed']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='BLOCKED' and out['reason']=='ownership-proof-missing'
    assert json.loads((tmp_path/'opencode.json').read_text())['plugin']==['opencode-hi@user-managed']

def test_cli_doctor_reports_managed_config_drift(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    cfg=tmp_path/'opencode.json'; data=json.loads(cfg.read_text()); data['share']='manual'; cfg.write_text(json.dumps(data))
    r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='WARN' and out['ownership']['config_drift'] is True
    assert 'managed-config-drift' in out['warnings']

def test_cli_doctor_fails_unsupported_routing_schema(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    p=tmp_path/'.opencode'/'hi'/'policy'/'routing.json'; p.parent.mkdir(parents=True); p.write_text(json.dumps({'schema':99,'routing':{}}))
    r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='FAIL' and 'unsupported-routing-schema' in out['issues']

def test_release_build_identity_contract_matches_version_and_changelog():
    import importlib.util
    spec=importlib.util.spec_from_file_location('hi_release_build',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    assert mod.release_identity(ROOT,V)==[]

def test_release_build_identity_detects_package_and_changelog_drift(tmp_path):
    import importlib.util, shutil
    spec=importlib.util.spec_from_file_location('hi_release_build2',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    (tmp_path/'plugin').mkdir(); (tmp_path/'VERSION').write_text('2.0.10\n'); (tmp_path/'package.json').write_text(json.dumps({'version':'2.0.9'})); (tmp_path/'plugin'/'package.json').write_text(json.dumps({'version':'2.0.10'})); (tmp_path/'CHANGELOG.md').write_text('# Changelog\n\n## 2.0.9\n')
    issues=mod.release_identity(tmp_path,'2.0.10'); assert 'root package version mismatch' in issues and 'CHANGELOG version entry missing' in issues


def test_release_build_identity_detects_plugin_license_drift(tmp_path):
    import importlib.util
    spec=importlib.util.spec_from_file_location('hi_release_build_license',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    (tmp_path/'plugin').mkdir(); (tmp_path/'VERSION').write_text('2.0.10\n')
    (tmp_path/'package.json').write_text(json.dumps({'version':'2.0.10','license':'Apache-2.0'}))
    (tmp_path/'plugin'/'package.json').write_text(json.dumps({'version':'2.0.10','license':'MIT'}))
    (tmp_path/'CHANGELOG.md').write_text('# Changelog\n\n## 2.0.10\n')
    assert 'plugin package license mismatch' in mod.release_identity(tmp_path,'2.0.10')

def test_release_and_setup_technical_paths_are_posix_canonical():
    release=(ROOT/'scripts/release-build.py').read_text(encoding='utf-8')
    setup=(ROOT/'scripts/native_plugin_setup.py').read_text(encoding='utf-8')
    assert "lock.relative_to(root).as_posix()" in release
    assert "cfg.relative_to(project).as_posix()" in setup
    assert "preserved.append(rel.as_posix())" in setup

def test_release_build_identity_detects_package_lock_drift(tmp_path):
    import importlib.util
    spec=importlib.util.spec_from_file_location('hi_release_build3',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    (tmp_path/'plugin').mkdir(); (tmp_path/'VERSION').write_text('2.0.10\n'); (tmp_path/'package.json').write_text(json.dumps({'version':'2.0.10'})); (tmp_path/'plugin'/'package.json').write_text(json.dumps({'version':'2.0.10'})); (tmp_path/'plugin'/'package-lock.json').write_text(json.dumps({'version':'2.0.9','packages':{'':{'version':'2.0.9'}}})); (tmp_path/'CHANGELOG.md').write_text('# Changelog\n\n## 2.0.10\n')
    assert 'plugin/package-lock.json version mismatch' in mod.release_identity(tmp_path,'2.0.10')

def test_release_manifest_contains_deterministic_provenance(tmp_path):
    dist,_=_build(tmp_path); manifest=json.loads((dist.parent/f'RELEASE-MANIFEST-{V}.json').read_text())
    assert manifest['schema']==5
    p=manifest['provenance']
    assert p['schema']==1 and p['builder']=='scripts/release-build.py' and p['deterministic_zip'] is True
    assert p['canonical_zip_time']=='2026-01-01T00:00:00Z' and len(p['inputs_sha256'])==64
    h=hashlib.sha256()
    for rel,digest in sorted(manifest['files'].items()):
        src=(dist.parent/rel) if rel.startswith('SBOM-') else (ROOT/rel)
        assert hashlib.sha256(src.read_bytes()).hexdigest()==digest
        h.update(rel.encode());h.update(b'\0');h.update(digest.encode());h.update(b'\0')
    assert h.hexdigest()==p['inputs_sha256']

def test_release_rebuild_is_byte_for_byte_reproducible(tmp_path):
    a=tmp_path/'a';b=tmp_path/'b';sa=tmp_path/'sa';sb=tmp_path/'sb'
    for out,src in [(a,sa),(b,sb)]:
        r=run(ROOT/'scripts/release-build.py','--out',out,'--source-out',src);assert r.returncode==0,r.stderr
    for name in [f'OpenCode-Hi-{V}-DISTRIBUTABLE.zip',f'RELEASE-MANIFEST-{V}.json']:
        assert hashlib.sha256((a/name).read_bytes()).hexdigest()==hashlib.sha256((b/name).read_bytes()).hexdigest()
    source=f'OpenCode-Hi-{V}-SOURCE.zip'
    assert hashlib.sha256((sa/source).read_bytes()).hexdigest()==hashlib.sha256((sb/source).read_bytes()).hexdigest()


def test_release_manifest_contains_dependency_sbom_and_supply_chain_digest(tmp_path):
    dist,_=_build(tmp_path); manifest=json.loads((dist.parent/f'RELEASE-MANIFEST-{V}.json').read_text())
    sc=manifest['supply_chain']; assert sc['schema']==1 and sc['dependency_lock']=='plugin/package-lock.json'
    sbom_path=dist.parent/sc['sbom']; sbom=json.loads(sbom_path.read_text())
    assert hashlib.sha256(sbom_path.read_bytes()).hexdigest()==sc['sbom_sha256']
    assert sbom['dependency_graph_sha256']==sc['dependency_graph_sha256']
    assert sbom['component_count']==sc['component_count'] and sbom['component_count']>0
    assert any(c['name']=='@opencode-ai/plugin' and c['relation']=='direct-peer' for c in sbom['components'])
    assert any(c['name']=='typescript' and c['relation']=='direct-dev' for c in sbom['components'])

def test_cross_platform_python_launcher_prefers_setup_python_and_validator_reads_utf8():
    launcher=(ROOT/'scripts/run-python.mjs').read_text(encoding='utf-8')
    assert "? [['python', []], ['py', ['-3']], ['python3', []]]" in launcher
    validator=(ROOT/'scripts/validate.py').read_text(encoding='utf-8')
    bare=[line for line in validator.splitlines() if '.read_text()' in line]
    assert bare==[], bare

def test_release_build_notices_cover_direct_dependency_names_and_licenses():
    import importlib.util
    spec=importlib.util.spec_from_file_location('hi_release_build4',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    components,digest=mod.dependency_components(ROOT); assert len(digest)==64
    assert mod.validate_third_party_notices(ROOT,components)==[]

def test_role_models_reconfigure_preserves_unrelated_user_routing_fields(tmp_path, monkeypatch):
    mod=load_module('native_plugin_setup_reconfigure',ROOT/'scripts/native_plugin_setup.py')
    cfg=tmp_path/'.opencode'/'hi'/'policy'/'routing.json'
    cfg.parent.mkdir(parents=True,exist_ok=True)
    original={
        'schema':1,'type':'hi-routing','routing':{
            'strategy':'quality',
            'roleModels':{'coder':['old/model'],'working-manager':['user/wm'],'custom-future-role':['user/custom']},
            'categoryModels':{'deep':['user/deep']},
            'categoryVariants':{'deep':['high']},
            'allowedProviders':['user-provider'],
            'deniedModels':['bad/model'],
            'userFutureField':{'keep':True},
        },
        'userTopLevel':{'preserve':'yes'},
        'ownership':'user-adopted-routing',
    }
    cfg.write_text(json.dumps(original),encoding='utf-8')
    monkeypatch.setattr(mod,'discover_available_models',lambda:['opencode-go/minimax-m3'])
    out=mod.role_models(tmp_path,defaults=True)
    assert out['status']=='APPLIED'
    after=json.loads(cfg.read_text())
    assert after['routing']['roleModels']['coder']==['old/model']
    assert after['routing']['roleModels']['working-manager']==['user/wm']
    assert after['routing']['roleModels']['custom-future-role']==['user/custom']
    assert after['routing']['strategy']=='quality'
    assert after['routing']['categoryModels']=={'deep':['user/deep']}
    assert after['routing']['categoryVariants']=={'deep':['high']}
    assert after['routing']['allowedProviders']==['user-provider']
    assert after['routing']['deniedModels']==['bad/model']
    assert after['routing']['userFutureField']=={'keep':True}
    assert after['userTopLevel']=={'preserve':'yes'}
    assert after['ownership']=='user-adopted-routing'

def test_role_models_manual_advanced_persists_all_roles_fallbacks_variants_and_policy(tmp_path, monkeypatch):
    mod=load_module('native_plugin_setup_manual_advanced',ROOT/'scripts/native_plugin_setup.py')
    available=['p/wm','p/mgr','p/mgr-fb','p/explore','p/arch','p/code','p/code-fb','p/qa','p/sec','p/visual']
    monkeypatch.setattr(mod,'discover_available_models',lambda:available)
    sets=[
      'working-manager=p/wm','manager=p/mgr,p/mgr-fb','repository-explorer=p/explore','architect=p/arch',
      'coder=p/code,p/code-fb','qa-reviewer=p/qa','security-reviewer=p/sec','visual-qa=p/visual',
    ]
    variants=['manager:p/mgr=high','manager:p/mgr-fb=medium','coder:p/code=xhigh','coder:p/code-fb=high']
    out=mod.role_models(tmp_path,sets=sets,variants=variants,policy='manual')
    assert out['status']=='APPLIED'; assert out['modelPolicy']=='manual'; assert out['adaptiveRoles']==[]
    cfg=json.loads((tmp_path/'.opencode'/'hi'/'policy'/'routing.json').read_text())
    assert len([r for r in mod.ROLES_WITH_HINT if r in cfg['routing']['roleModels']])==8
    assert cfg['routing']['roleModels']['coder']==['p/code','p/code-fb']
    assert cfg['routing']['roleVariants']['coder']=={'p/code':'xhigh','p/code-fb':'high'}
    again=mod.role_models(tmp_path,print_only=True)
    assert again['roleModels']['manager']==['p/mgr','p/mgr-fb']
    assert again['roleVariants']['manager']['p/mgr']=='high'
    assert again['modelPolicy']=='manual'


def test_role_models_recommended_only_marks_missing_canonical_roles_for_smart_select(tmp_path, monkeypatch):
    mod=load_module('native_plugin_setup_recommended_missing',ROOT/'scripts/native_plugin_setup.py')
    all_ids=sorted({m for models in mod.DEFAULT_ROLE_MODELS.values() for m in models})
    missing_role='visual-qa'; live=[m for m in all_ids if m not in mod.DEFAULT_ROLE_MODELS[missing_role]]
    monkeypatch.setattr(mod,'discover_available_models',lambda:live)
    out=mod.role_models(tmp_path,defaults=True,policy='recommended')
    assert out['status']=='APPLIED'; assert out['modelPolicy']=='recommended'; assert out['adaptiveRoles']==[missing_role]
    cfg=json.loads((tmp_path/'.opencode'/'hi'/'policy'/'routing.json').read_text())
    assert missing_role not in cfg['routing']['roleModels']
    assert cfg['routing']['roleModels']['coder']==mod.DEFAULT_ROLE_MODELS['coder']
    assert cfg['routing']['adaptiveRoles']==[missing_role]

def test_reconfigure_preserves_user_owned_config_and_updates_main_prompt_runtime_knobs(tmp_path):
    cfg=tmp_path/'opencode.json'
    original={
        'plugin':['user-plugin'],
        'mcp':{'user-server':{'command':['x']}},
        'userFuture':{'keep':True},
        'hi':{'userCustom':{'preserve':'yes'},'profile':{'balanced':{'customThreshold':'keep'}}},
    }
    cfg.write_text(json.dumps(original))
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,
          '--execution-policy','thorough','--primary-mode','manager',
          '--parallel','enabled','--parallel-max','4',
          '--profile-target','balanced','--specialist-threshold','low','--review-threshold','high',
          '--team-mode','enabled','--team-max-members','3',
          '--routing-strategy','quality','--allow-provider','p1','--deny-model','p/bad','--max-fallbacks','2')
    out=json.loads(r.stdout); assert r.returncode==0 and out['status']=='APPLIED'
    # Native OpenCode config is user-owned and is no longer mutated with private Hi keys.
    after=json.loads(cfg.read_text()); assert after==original
    project_cfg=json.loads((tmp_path/'.opencode'/'hi'/'policy'/'routing.json').read_text())
    assert project_cfg['executionPolicy']=='thorough' and project_cfg['primaryMode']=='manager'
    assert project_cfg['parallel']['enabled'] is True and project_cfg['parallel']['max']==4
    assert project_cfg['profile']['balanced']['specialistThreshold']=='low'
    assert project_cfg['profile']['balanced']['reviewThreshold']=='high'
    assert project_cfg['teamMode']['enabled'] is True and project_cfg['teamMode']['maxMembers']==3 and 'auto' not in project_cfg['teamMode']
    routing=project_cfg['routing']
    assert routing['maxFallbacks']==2 and routing['strategy']=='quality' and routing['allowedProviders']==['p1'] and routing['deniedModels']==['p/bad']
    assert after['hi']['userCustom']=={'preserve':'yes'}


def test_reconfigure_only_changes_explicit_fields_and_print_is_non_mutating(tmp_path):
    cfg=tmp_path/'opencode.json'; cfg.write_text(json.dumps({'share':'manual','hi':{'executionPolicy':'minimal','primaryMode':'auto','parallel':{'enabled':False,'max':2}}}))
    before=cfg.read_text()
    p=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--print'); out=json.loads(p.stdout)
    assert p.returncode==0 and out['hi']=={} and cfg.read_text()==before
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--primary-mode','working-manager'); assert r.returncode==0
    assert cfg.read_text()==before
    project_cfg=json.loads((tmp_path/'.opencode'/'hi'/'policy'/'routing.json').read_text())
    assert 'executionPolicy' not in project_cfg and 'parallel' not in project_cfg and project_cfg['primaryMode']=='working-manager'


def test_reconfigure_is_safe_with_jsonc_because_private_settings_live_outside_native_config(tmp_path):
    cfg=tmp_path/'opencode.jsonc'; cfg.write_text('{ // user comments\n "share":"manual"\n}\n')
    before=cfg.read_text()
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--primary-mode','manager','--team-mode','enabled'); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='APPLIED' and cfg.read_text()==before
    project_cfg=json.loads((tmp_path/'.opencode'/'hi'/'policy'/'routing.json').read_text())
    assert project_cfg['primaryMode']=='manager' and project_cfg['teamMode']['enabled'] is True


def test_current_external_checkpoint_tracks_same_session_followup_and_stop():
    receipt=json.loads((ROOT/'data/validation/external-opencode-cli-1.18.16.json').read_text())
    assert receipt['candidate'].startswith('2.0.10-v') and receipt['candidate'].endswith('-checkpoint')
    assert receipt['same_session_external']['follow_up']['status']=='PASS'
    assert receipt['same_session_external']['follow_up']['mission_count_after']==1
    assert receipt['same_session_external']['follow_up']['generation_after']==1
    assert receipt['same_session_external']['user_stop']['status']=='PASS'
    assert receipt['same_session_external']['user_stop']['mission_status']=='stopped'
    assert receipt['same_session_external']['user_stop']['user_interrupted'] is True
    assert 'session.idle' in receipt['same_session_external']['user_stop']['late_native_events_ignored']
    progress=json.loads((ROOT/'data/validation/forensic-61-progress.json').read_text())
    assert progress['summary']=={'total':61,'complete_local':57,'partial_external':4,'failed':0,'unresolved_internal':0}
    by_id={x['item']:x for x in progress['items']}
    assert by_id[9]['status']=='COMPLETE_LOCAL'
    assert by_id[22]['status']=='COMPLETE_LOCAL'
    assert by_id[36]['status']=='COMPLETE_LOCAL'
    assert by_id[12]['status']=='COMPLETE_LOCAL'
    assert by_id[16]['status']=='COMPLETE_LOCAL'
    routing=receipt['real_model_routing_v56']; assert routing['status']=='PASS_LOCAL_REAL_OPENCODE_CHILD_RUNTIME' and routing['effective_model_verified'] is True and routing['selected_model']=='openai/hhc-coder'
    team=receipt['real_team_mode_v56']; assert team['status']=='PASS_LOCAL_REAL_OPENCODE_LIVE_TEAM' and team['team_status']=='shutdown' and team['shutdown_reason']=='members-terminal' and len(team['members'])==2
    hosted=receipt['real_local_hosted_release_v55']
    assert hosted['status']=='PASS_LOCAL_HOSTED_RELEASE_PROTOCOL'
    assert hosted['public_github_oauth'].startswith('PENDING_EXTERNAL')
    reg=receipt['real_local_npm_registry_v54']
    assert reg['status']=='PASS_LOCAL_REAL_NPM_REGISTRY_PROTOCOL' and reg['remote_verified'] is True
    assert reg['package']=='opencode-hhc-orchestrator@2.0.10' and reg['pack_files']==179
    assert reg['pack_integrity'].startswith('sha512-') and len(reg['pack_shasum'])==40

def test_v58_external_blockers_are_exact_and_release_stays_blocked():
    progress=json.loads((ROOT/'data/validation/forensic-61-progress.json').read_text())
    blockers=json.loads((ROOT/'data/validation/external-blockers-v58.json').read_text())
    assert progress['candidate']=='2.0.10-v58-checkpoint'
    assert progress['summary']=={'total':61,'complete_local':57,'partial_external':4,'failed':0,'unresolved_internal':0}
    partial={x['item'] for x in progress['items'] if x['status']=='PARTIAL_EXTERNAL'}
    assert partial=={32,44,46,60}
    assert blockers['candidate']=='2.0.10-v58-checkpoint'
    assert blockers['status']=='BLOCKED_EXTERNAL_ONLY'
    assert blockers['partial_items']==[32,44,46,60]
    assert blockers['internal_unresolved']==0
    release=json.loads((ROOT/'data/validation/release-gates.json').read_text())
    assert release['release_blocked'] is True

def test_living_validation_contracts_are_bound_to_hi_0_1_0():
    for name in ['implementation-coverage.json','native-coverage.json','flow-coverage.json','flow-acceptance.json','source-gates.json','external-protocol.json']:
        d=json.loads((ROOT/'data'/'validation'/name).read_text()); assert d['release']==V,name
    schema=json.loads((ROOT/'data/validation/external-schema.json').read_text())
    assert schema['required_coexistence']==['plain_opencode_smoke','hi_only_smoke']
    assert 'hi_version' in schema['binding'] and 'oho_version' not in schema['binding']

def test_current_0_1_0_receipts_are_not_historical_v58_claims():
    gates=json.loads((ROOT/'data/validation/release-gates.json').read_text())
    assert gates['candidate_status']=='P8_GITHUB_RELEASE_PUBLISHED_NPM_T4_BLOCKED'
    assert gates['current_local_evidence']['benchmarks']['receipt']=='data/validation/benchmarks-0.1.0.json'
    assert gates['current_local_evidence']['install_lifecycle']['receipt']=='data/validation/install-lifecycle-0.1.0.json'
    assert gates['historical_receipts_not_valid_for_current_candidate']['release']=='2.0.10-v58'
    audit=json.loads((ROOT/'data/validation/architecture-audit-0.1.0.json').read_text())
    assert audit['known_internal_blocking_findings']==[]
    assert audit['checks']['opencode_native_behavior']['status']=='PASS_EXACT_SOURCE_HOST_1_18_18'

def test_legacy_product_cli_alias_is_rejected(tmp_path):
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--autonomy','smart')
    assert r.returncode!=0
    assert '--autonomy' in (r.stdout+r.stderr)


def test_legacy_product_config_does_not_change_canonical_execution_policy(tmp_path):
    cfg=tmp_path/'opencode.json'
    cfg.write_text(json.dumps({'hi':{'autonomy':'powerful'}}))
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--primary-mode','auto')
    assert r.returncode==0
    project=json.loads((tmp_path/'.opencode'/'hi'/'policy'/'routing.json').read_text())
    assert project.get('executionPolicy','adaptive')!='thorough'

def test_uninstall_preserves_independently_owned_project_policy_knowledge_artifacts_and_project_skills(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    routing=tmp_path/'.opencode'/'hi'/'policy'/'routing.json'
    authority=tmp_path/'.opencode'/'hi'/'policy'/'authority.json'
    pi=tmp_path/'.opencode'/'hi'/'project-intelligence'/'patterns'/'p1.json'
    artifact=tmp_path/'.opencode'/'hi'/'artifacts'/'review'/'a1.json'
    skill=tmp_path/'.opencode'/'skills'/'hi-project-release-check'/'SKILL.md'
    for p,content in ((routing,json.dumps({'schema':1,'type':'hi-routing','routing':{}})),(authority,json.dumps({'schema':1,'grants':{}})),(pi,'{}'),(artifact,'{}'),(skill,'---\nname: hi-project-release-check\n---\n')):
        p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
    r=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='APPLIED'
    assert routing.exists() and authority.exists() and pi.exists() and artifact.exists() and skill.exists()
    assert not (tmp_path/'.opencode'/'hi'/'provenance'/'setup.json').exists()
    assert '.opencode/hi/policy' in out['preserved_project_data']
    assert '.opencode/hi/project-intelligence' in out['preserved_project_data']
    assert '.opencode/hi/artifacts' in out['preserved_project_data']
    assert '.opencode/skills' in out['preserved_project_data']

def test_skill_artifact_ownership_audit_covers_all_27_skills():
    d=json.loads((ROOT/'data/validation/skill-artifact-ownership-0.1.0.json').read_text())
    assert d['skills_audited']==27
    assert len(d['skills'])==27
    assert all(row['skill_specific_hi_directory'] is False for row in d['skills'])
    assert '.opencode/skills/<project-created-skill>/' in d['canonical_project_families']

def test_setup_blocks_symlinked_managed_config_escape(tmp_path):
    if os.name=='nt':pytest.skip('symlink privilege varies on Windows')
    outside=tmp_path.parent/f'{tmp_path.name}-outside.json';outside.write_text(json.dumps({'plugin':['outside']}))
    (tmp_path/'opencode.json').symlink_to(outside)
    before=outside.read_text()
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='BLOCKED' and out['reason']=='managed-path-escapes-project-or-uses-symlink'
    assert outside.read_text()==before

def test_reconfigure_blocks_symlinked_opencode_directory_escape(tmp_path):
    if os.name=='nt':pytest.skip('symlink privilege varies on Windows')
    outside=tmp_path.parent/f'{tmp_path.name}-outside-dir';outside.mkdir()
    (tmp_path/'.opencode').symlink_to(outside,target_is_directory=True)
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--primary-mode','manager');out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='BLOCKED' and out['reason']=='managed-path-escapes-project-or-uses-symlink'
    assert not (outside/'hi'/'policy'/'routing.json').exists()

def test_uninstall_blocks_symlinked_managed_config_escape(tmp_path):
    if os.name=='nt':pytest.skip('symlink privilege varies on Windows')
    outside=tmp_path.parent/f'{tmp_path.name}-outside-uninstall.json';outside.write_text(json.dumps({'plugin':['opencode-hi@0.1.0']}))
    (tmp_path/'opencode.json').symlink_to(outside)
    before=outside.read_text()
    r=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='BLOCKED'
    assert outside.read_text()==before

def test_release_builder_rejects_source_symlink(tmp_path):
    import importlib.util
    spec=importlib.util.spec_from_file_location('hi_release_symlink',ROOT/'scripts/release-build.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    fake=tmp_path/'repo';(fake/'skills').mkdir(parents=True);outside=tmp_path/'outside.txt';outside.write_text('outside-secret')
    if os.name=='nt':pytest.skip('symlink privilege varies on Windows')
    (fake/'skills'/'escape.txt').symlink_to(outside)
    old=mod.KIT;mod.KIT=fake
    try:
        with pytest.raises(SystemExit,match='release source symlink is not allowed'):mod.collect(['skills'],[])
    finally:mod.KIT=old


def test_r2_install_is_idempotent_once_setup_ownership_exists(tmp_path):
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['foreign@1'],'theme':'mine'}))
    first=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);assert first.returncode==0
    before=cfg.read_text()
    second=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);out=json.loads(second.stdout)
    assert second.returncode==0 and out['status']=='NOOP' and out['reason']=='already-installed-owned'
    assert cfg.read_text()==before
    assert json.loads(cfg.read_text())['plugin']==['foreign@1','opencode-hi@0.1.0']


def test_r2_owned_upgrade_and_one_step_rollback_preserve_foreign_config(tmp_path):
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['foreign@1'],'mcp':{'x':{'type':'remote','url':'https://example.invalid'}}}))
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path,'--version','0.1.0').returncode==0
    up=run(ROOT/'scripts/native_plugin_setup.py','upgrade',tmp_path,'--version','0.2.0');u=json.loads(up.stdout)
    assert up.returncode==0 and u['status']=='APPLIED' and u['from_plugin_spec']=='opencode-hi@0.1.0' and u['to_plugin_spec']=='opencode-hi@0.2.0'
    data=json.loads(cfg.read_text());assert data['plugin']==['foreign@1','opencode-hi@0.2.0'] and data['mcp']['x']['url']=='https://example.invalid'
    assert (tmp_path/'.opencode/hi/provenance/setup-rollback.json').is_file()
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);r=json.loads(rb.stdout)
    assert rb.returncode==0 and r['status']=='APPLIED' and r['rolled_back_operation']=='upgrade' and r['restored_plugin_spec']=='opencode-hi@0.1.0'
    data=json.loads(cfg.read_text());assert data['plugin']==['foreign@1','opencode-hi@0.1.0'] and data['mcp']['x']['url']=='https://example.invalid'
    own=json.loads((tmp_path/'.opencode/hi/provenance/setup.json').read_text());assert own['plugin_spec']=='opencode-hi@0.1.0'
    assert not (tmp_path/'.opencode/hi/provenance/setup-rollback.json').exists()


def test_r2_uninstall_rollback_restores_owned_registration_without_touching_foreign_state(tmp_path):
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['a@1','b@1'],'theme':'user-theme','unknown':{'keep':True}}))
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    un=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path);u=json.loads(un.stdout)
    assert un.returncode==0 and u['status']=='APPLIED' and u['rollback_available'] is True
    assert json.loads(cfg.read_text())['plugin']==['a@1','b@1']
    assert not (tmp_path/'.opencode/hi/provenance/setup.json').exists()
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);r=json.loads(rb.stdout)
    assert rb.returncode==0 and r['rolled_back_operation']=='uninstall'
    data=json.loads(cfg.read_text());assert data['plugin']==['a@1','b@1','opencode-hi@0.1.0']
    assert data['theme']=='user-theme' and data['unknown']=={'keep':True}
    assert (tmp_path/'.opencode/hi/provenance/setup.json').is_file()


def test_r2_recover_completes_interrupted_upgrade_when_config_matches_recorded_after_state(tmp_path):
    mod=load_module('native_plugin_setup_r2_recover',ROOT/'scripts/native_plugin_setup.py')
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['foreign@1']}))
    assert mod.install(tmp_path,'0.1.0')['status']=='APPLIED'
    # consume the install rollback point so the synthetic interrupted upgrade is the only lifecycle edge under test
    (tmp_path/mod.SETUP_ROLLBACK).unlink()
    own=json.loads((tmp_path/mod.OWNERSHIP).read_text());before_text=cfg.read_text();data=json.loads(before_text);idx=data['plugin'].index('opencode-hi@0.1.0')
    after=dict(data);after['plugin']=list(data['plugin']);after['plugin'][idx]='opencode-hi@0.2.0';after_text=mod.dump(after)
    next_own=mod._ownership_doc(tmp_path,cfg,'opencode-hi@0.2.0',mod.sha_text(before_text),mod.sha_text(after_text),own.get('installed_at'))
    tx=mod._lifecycle_record('upgrade',cfg,tmp_path,before_text,after_text,'opencode-hi@0.1.0','opencode-hi@0.2.0',idx,idx,own,next_own)
    tx['status']='config-applied';mod._write_state(tmp_path/mod.SETUP_TRANSACTION,tx);mod._atomic_write_text(cfg,after_text)
    # ownership is intentionally still old, modeling interruption after config replace
    assert json.loads((tmp_path/mod.OWNERSHIP).read_text())['plugin_spec']=='opencode-hi@0.1.0'
    rec=run(ROOT/'scripts/native_plugin_setup.py','recover',tmp_path);r=json.loads(rec.stdout)
    assert rec.returncode==0 and r['status']=='RECOVERED' and r['disposition']=='completed-interrupted-operation'
    assert json.loads((tmp_path/mod.OWNERSHIP).read_text())['plugin_spec']=='opencode-hi@0.2.0'
    assert json.loads(cfg.read_text())['plugin']==['foreign@1','opencode-hi@0.2.0']
    assert not (tmp_path/mod.SETUP_TRANSACTION).exists() and (tmp_path/mod.SETUP_ROLLBACK).exists()


def test_r2_pending_transaction_blocks_new_mutation_until_recover(tmp_path):
    mod=load_module('native_plugin_setup_r2_pending',ROOT/'scripts/native_plugin_setup.py')
    assert mod.install(tmp_path,'0.1.0')['status']=='APPLIED'
    cfg=tmp_path/'opencode.json';before=cfg.read_text();own=json.loads((tmp_path/mod.OWNERSHIP).read_text())
    tx=mod._lifecycle_record('upgrade',cfg,tmp_path,before,before,'opencode-hi@0.1.0','opencode-hi@0.2.0',0,0,own,own);tx['status']='planned';mod._write_state(tmp_path/mod.SETUP_TRANSACTION,tx)
    up=run(ROOT/'scripts/native_plugin_setup.py','upgrade',tmp_path,'--version','0.2.0');out=json.loads(up.stdout)
    assert up.returncode==2 and out['status']=='BLOCKED' and out['reason']=='pending-setup-transaction-run-recover'
    doc=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path);d=json.loads(doc.stdout)
    assert doc.returncode==2 and d['status']=='FAIL' and d['lifecycle']['transaction_pending'] is True and 'pending-setup-transaction' in d['issues']


def test_r2_rollback_fails_closed_after_unrelated_post_operation_config_drift(tmp_path):
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['foreign@1'],'theme':'a'}))
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    data=json.loads(cfg.read_text());data['theme']='user-changed-after-install';cfg.write_text(json.dumps(data))
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);out=json.loads(rb.stdout)
    assert rb.returncode==2 and out['status']=='BLOCKED' and out['reason']=='setup-rollback-config-drift'
    assert json.loads(cfg.read_text())['theme']=='user-changed-after-install'


def test_r2_rollback_of_fresh_install_restores_absent_config_file(tmp_path):
    cfg=tmp_path/'opencode.json';assert not cfg.exists()
    ins=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);assert ins.returncode==0 and cfg.exists()
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);out=json.loads(rb.stdout)
    assert rb.returncode==0 and out['status']=='APPLIED' and out['rolled_back_operation']=='install'
    assert not cfg.exists()
    assert not (tmp_path/'.opencode/hi/provenance/setup.json').exists()


def test_r2_install_lifecycle_receipt_covers_full_local_recovery_contract():
    d=json.loads((ROOT/'data/validation/install-lifecycle-0.1.0.json').read_text())
    assert d['schema']==2 and d['kind']=='LOCAL_CONFIG_LIFECYCLE_R2'
    required={'install':'APPLIED','idempotent_install':'NOOP','upgrade':'APPLIED','rollback_upgrade':'APPLIED','uninstall':'APPLIED','rollback_uninstall':'APPLIED','recover_interrupted_upgrade':'RECOVERED'}
    assert all(d['operations'][k]==v for k,v in required.items())
    assert all(d['assertions'].values())
    assert d['state_security']['setup_json_mode']=='0o600' and d['state_security']['rollback_mode_after_install']=='0o600'
    assert d['state_security']['transaction_contains_config_body'] is False and d['state_security']['rollback_contains_config_body'] is False
    assert (ROOT/'scripts/run-install-lifecycle.py').is_file()


def test_r3_generated_compatibility_projection_selects_latest_exact_capability_proofs_without_erasing_history():
    d=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text())
    assert d['schema']==1 and d['kind']=='GENERATED_RECEIPT_COMPATIBILITY_PROJECTION'
    cur=d['current_reference_host'];assert (cur['opencode_version'],cur['platform'],cur['architecture'])==('1.18.18','linux','aarch64')
    caps=cur['capabilities']
    assert caps['process-lifecycle']['receipt'].endswith('head-bc85854.json') and caps['process-lifecycle']['status']=='SUPPORTED_T3'
    assert caps['workspace-isolation-binding']['receipt'].endswith('head-92812a1.json') and caps['workspace-isolation-binding']['status']=='SUPPORTED_T3'
    assert caps['browser-execution']['receipt'].endswith('head-476590e.json') and caps['browser-execution']['status']=='SUPPORTED_T3'
    negative=next(x for x in d['history'] if x['receipt'].endswith('browser-1.18.18-head-707609b.json'))
    assert negative['classification']=='HISTORICAL_EXACT_PROOF' and negative['current_for_capabilities']==[] and negative['gates']['browser-execution']=='UNSUPPORTED'
    old=next(x for x in d['history'] if x['opencode_version']=='1.18.16' and x['exact_source'])
    assert old['classification']=='HISTORICAL_EXACT_PROOF'
    nonexact=next(x for x in d['history'] if x['receipt'].endswith('host-current-worktree.json'))
    assert nonexact['classification']=='NON_EXACT_WORKTREE' and nonexact['current_for_capabilities']==[]
    for row in d['history']:
        path=ROOT/row['receipt'];assert path.is_file();assert hashlib.sha256(path.read_bytes()).hexdigest()==row['receipt_sha256']
    assert (ROOT/'scripts/generate-compatibility-matrix.py').is_file()



def test_r4_generated_release_status_is_hash_bound_and_docs_marker_owned():
    d=json.loads((ROOT/'data/validation/release-status-0.1.0.json').read_text())
    assert d['schema']==1 and d['kind']=='GENERATED_RELEASE_STATUS_PROJECTION' and d['release']=='0.1.0'
    assert d['status']=='PARTIAL_EXTERNAL_NPM_BOOTSTRAP_AUTH' and d['release_blocked'] is True
    assert d['github']['status']=='PASS_T4' and d['github']['tag']=='v0.1.0' and d['github']['asset_digest_match'] is True
    assert d['npm']['status']=='BLOCKED_T4_AUTH' and d['npm']['publish_attempted'] is False and d['npm']['trusted_publisher_configurable_now'] is False
    assert d['verification']['persisted_test_count'] is False
    c=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text())['current_reference_host']
    assert (d['reference_host']['opencode_version'],d['reference_host']['platform'],d['reference_host']['architecture'])==(c['opencode_version'],c['platform'],c['architecture'])
    assert {k:v['status'] for k,v in d['reference_host']['capabilities'].items()}=={k:v['status'] for k,v in c['capabilities'].items()}
    for meta in d['inputs'].values():
        path=ROOT/meta['path'];assert path.is_file();assert hashlib.sha256(path.read_bytes()).hexdigest()==meta['sha256']
    release=(ROOT/'docs/RELEASE.md').read_text()
    assert release.count('<!-- BEGIN GENERATED RELEASE STATUS -->')==1 and release.count('<!-- END GENERATED RELEASE STATUS -->')==1
    block=release.split('<!-- BEGIN GENERATED RELEASE STATUS -->',1)[1].split('<!-- END GENERATED RELEASE STATUS -->',1)[0]
    assert 'PARTIAL_EXTERNAL_NPM_BOOTSTRAP_AUTH' in block and 'OpenCode `1.18.18`' in block and 'Test counts are intentionally not persisted' in block
    assert (ROOT/'scripts/generate-release-status.py').is_file()


def test_n1_final_namespace_normalization_is_hash_bound_and_preserves_historical_exclusions():
    d=json.loads((ROOT/'data/validation/namespace-normalization-0.1.0.json').read_text())
    assert d['schema']==1 and d['kind']=='FINAL_HI_NAMESPACE_NORMALIZATION' and d['status']=='PASS'
    assert d['guard']['violations']==[] and d['path_audit']['violations']==[] and not any(d['stale_living_status'].values())
    assert d['public_surface']['skill_namespace'] is True and d['public_surface']['skill_count']==27
    assert d['public_surface']['tool_namespace_guard_present'] is True and d['public_surface']['config_option_count']==32
    assert 'plugin/test/config-no-legacy-superpowers.test.mjs' in d['path_audit']['excluded_provenance_or_negative_surfaces']
    assert 'docs/engineering-constitution/sources/' in d['path_audit']['excluded_prefixes']
    for meta in d['inputs'].values():
        path=ROOT/meta['path'];assert path.is_file();assert hashlib.sha256(path.read_bytes()).hexdigest()==meta['sha256']
    assert (ROOT/'scripts/generate-namespace-audit.mjs').is_file()


def test_prompt_a_documentation_inventory_classifies_all_truth_surfaces_and_has_unique_current_owners():
    policy=json.loads((ROOT/'data/documentation-ownership.json').read_text())
    inv=json.loads((ROOT/'data/validation/documentation-inventory.json').read_text())
    assert policy['schema']==1 and policy['type']=='hi-documentation-ownership'
    assert inv['schema']==1 and inv['kind']=='DOCUMENTATION_TRUTH_INVENTORY' and inv['status']=='PASS'
    assert inv['violations']=={'unclassified':[],'duplicate_meaning_owner':[],'missing_owner':[],'historical_as_current_owner':[]}
    meanings=policy['meanings']; assert len(meanings)==len({x['meaning'] for x in meanings})==36
    artifacts={x['path']:x for x in inv['artifacts']}
    assert artifacts['README.md']['lifecycle']=='CANONICAL_CURRENT'
    assert artifacts['README.tr.md']['lifecycle']=='DERIVED_CURRENT'
    assert artifacts['docs/FINAL-ACCEPTANCE.md']['lifecycle']=='HISTORICAL'
    assert artifacts['docs/engineering-constitution/15-ENGINEERING-CONSTITUTION.md']['lifecycle']=='CANONICAL_CURRENT'
    assert artifacts['docs/engineering-constitution/history/17-IMPLEMENTATION-PROOF.md']['lifecycle']=='HISTORICAL'
    for m in meanings:
        assert (ROOT/m['owner']).is_file()
        if m['owner'] in artifacts: assert artifacts[m['owner']]['lifecycle']!='HISTORICAL'
    assert hashlib.sha256((ROOT/inv['policy']['path']).read_bytes()).hexdigest()==inv['policy']['sha256']


def test_version_truth_is_semver_and_not_validator_hard_pinned_to_0_1_0():
    version=(ROOT/'VERSION').read_text().strip()
    assert re.fullmatch(r'(?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?',version)
    validator=(ROOT/'scripts/validate.py').read_text()
    assert "VERSION must be 0.1.0" not in validator
    assert json.loads((ROOT/'package.json').read_text())['version']==version
    assert json.loads((ROOT/'plugin/package.json').read_text())['version']==version


def test_prompt_a_documentation_parity_binds_current_docs_to_machine_truth_and_links():
    d=json.loads((ROOT/'data/validation/documentation-parity.json').read_text())
    assert d['schema']==1 and d['kind']=='DOCUMENTATION_PARITY' and d['status']=='PASS'
    assert d['violations']==[]
    assert {'version_package_product_parity','local_markdown_links','stale_current_status_patterns','release_availability','host_capabilities','semantic_adapter_boundary'}==set(d['checks'])
    assert 'README.md' in d['checked_current_documents'] and 'docs/ARCHITECTURE.md' in d['checked_current_documents']
    assert 'docs/engineering-constitution/MASTER-CONTINUATION.md' in d['checked_current_documents']
    for meta in d['inputs'].values():
        path=ROOT/meta['path']; assert path.is_file(); assert hashlib.sha256(path.read_bytes()).hexdigest()==meta['sha256']
    pkg=json.loads((ROOT/'package.json').read_text())
    assert 'docs:check' in pkg['scripts'] and 'npm run docs:check' in pkg['scripts']['check']


def test_prompt_a_first_use_docs_do_not_advertise_unavailable_registry_or_stale_capabilities():
    readme=(ROOT/'README.md').read_text(); tr=(ROOT/'README.tr.md').read_text(); arch=(ROOT/'docs/ARCHITECTURE.md').read_text(); install=(ROOT/'docs/INSTALLATION.md').read_text()
    for text in (readme,tr):
        assert 'first coherent OpenCode-Hi candidate' not in text
        assert 'opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git#' not in text
    assert 'not currently available from the npm registry' in readme
    assert 'npm bootstrap publication is not yet complete' in readme
    assert 'registry distribution availability' in install
    assert 'ProcessContract' in arch and 'WorkspaceLease' in arch and 'BrowserObservation' in arch
    assert 'contains no raw stdout/stderr buffer' in arch


def test_prompt_a_constitution_separates_current_law_from_program_history():
    root=ROOT/'docs/engineering-constitution'
    historical=['00-PROGRAM-PLAN.md','01-SOURCE-ARCHITECTURE-STUDY.md','02-RUNTIME-REALITY-MAP.md','13-MIGRATION-MATRIX.md','17-IMPLEMENTATION-PROOF.md']
    for name in historical:
        assert not (root/name).exists()
        assert (root/'history'/name).is_file()
    readme=(root/'README.md').read_text(); law=(root/'15-ENGINEERING-CONSTITUTION.md').read_text()
    assert 'Current law and navigation' in readme and 'Historical program material' in readme
    assert 'Current mutable facts such as supported host version, release status, test count' in readme
    assert 'one meaning -> one canonical documentation owner' in law
    assert 'Development HEAD, application version and an existing immutable release tag are separate identities' in law
    assert 'Historical migration plans/proof ledgers are retained under `history/`' in law


def test_prompt_a_generated_config_and_host_tables_are_catalog_receipt_derived():
    install=(ROOT/'docs/INSTALLATION.md').read_text(); hosts=(ROOT/'docs/HOSTS.md').read_text()
    cfg=json.loads((ROOT/'data/hi-config-options.json').read_text())
    compat=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text())['current_reference_host']
    assert install.count('<!-- BEGIN GENERATED CONFIG REFERENCE -->')==1 and install.count('<!-- END GENERATED CONFIG REFERENCE -->')==1
    assert all(f"`{x['path']}`" in install for x in cfg['options'])
    assert hosts.count('<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->')==1 and hosts.count('<!-- END GENERATED HOST CAPABILITY MATRIX -->')==1
    for cap,x in compat['capabilities'].items():
        assert f'`{cap}`' in hosts and f"**{x['status']}**" in hosts and f"`{x['receipt']}`" in hosts
    assert (ROOT/'scripts/generate-documentation-projections.py').is_file()
    assert 'generate-documentation-projections.py' in json.loads((ROOT/'package.json').read_text())['scripts']['docs:check']


def test_prompt_a_product_truth_inventory_traces_24_major_areas_to_owners_consumers_and_proof():
    d=json.loads((ROOT/'data/validation/product-truth-inventory.json').read_text())
    assert d['schema']==1 and d['kind']=='PRODUCT_TRUTH_TRACE_INVENTORY' and d['status']=='PASS'
    assert d['violations']=={'missing_paths':[]}
    areas={x['area']:x for x in d['areas']}; assert len(areas)==24
    for key in ['mission','task-runtime','roles-permissions','methodologies-skills','authority','context','project-intelligence','evidence-verification','process','workspace-isolation','browser','host-port','persistence-storage','install-lifecycle','external-actions-release']:
        assert key in areas
    for x in areas.values():
        assert (ROOT/x['owner_path']).exists() and (ROOT/x['canonical_doc']).is_file()
        assert x['proof_paths']
        assert all((ROOT/ref).is_file() for ref in x['proof_paths'])
    reality=(ROOT/'docs/ARCHITECTURE-REALITY-MAP.md').read_text()
    assert reality.count('<!-- BEGIN GENERATED PRODUCT TRUTH TRACE -->')==1
    assert all(f"`{area}`" in reality for area in areas)


def test_prompt_a_current_storage_terminology_and_identity_docs_have_no_preimplementation_language():
    storage=(ROOT/'docs/STORAGE-OWNERSHIP-MATRIX.md').read_text(); terminology=(ROOT/'docs/TERMINOLOGY.md').read_text(); identity=(ROOT/'docs/PRODUCT-IDENTITY.md').read_text()
    assert 'ProcessGovernor' not in storage
    assert 'future Git/OpenCode adapter' not in storage
    assert 'ProcessRuntime' in storage and 'OpenCodeWorkspaceAdapter' in storage
    assert 'Final source-driven normalization is reserved for `N1' not in terminology
    assert 'N1 completed the final source-driven normalization' in terminology
    assert 'OpenCode-Hi 0.1.0 is a new product identity' not in identity
    assert 'application version is owned by `VERSION`' in identity


def test_prompt_a_final_reconstruction_receipt_is_hash_bound_to_certified_source():
    d=json.loads((ROOT/'data/validation/documentation-reconstruction.json').read_text())
    assert d['schema']==1 and d['kind']=='FINAL_PRODUCT_TRUTH_RECONSTRUCTION' and d['program']=='PROMPT_A' and d['status']=='COMPLETED'
    assert d['version']=='0.1.0'
    assert d['certified_source']['head']=='5ced215ed57f28f8d963376ca702efc0dac75503'
    assert d['certified_source']['tree']=='b22db990942ad291997a8ad564ac1235283036bb' and d['certified_source']['working_tree']=='CLEAN'
    record=d['completion_record']; assert record['commit']=='9f0624383db038f55e280ab7834b7dd12bc281ca' and record['tree']=='b39dd548b1ceba28ff6fc67575ad9389ccf4f5b2'
    assert d['documentation_inventory']['canonical_meanings']==36 and d['canonical_ownership']['meaning_count']==36
    assert d['generated_or_parity_validated']=={'config_options':32,'exact_t3_capabilities':3,'product_areas':24,'documentation_parity_violations':0,'broken_links':0}
    assert d['source_doc_parity']['product_trace_missing_paths']==[] and d['source_doc_parity']['documentation_violations']==[]
    assert all(d['exit_gate'].values())
    for meta in d['inputs'].values():
        blob=subprocess.check_output(['git','show',f"{record['commit']}:{meta['path']}"])
        assert hashlib.sha256(blob).hexdigest()==meta['sha256']
    continuation=(ROOT/'docs/engineering-constitution/MASTER-CONTINUATION.md').read_text()
    assert 'PROMPT A final exit gate — **COMPLETED**' in continuation
def test_prompt_b_removes_dead_browser_cli_executor_from_living_product_surface():
    assert not (ROOT/'plugin/src/opencode/browser-cli-adapter.ts').exists()
    assert not (ROOT/'plugin/test/b2-browser-executor.test.mjs').exists()
    services=(ROOT/'plugin/src/runtime/application/runtime-services.ts').read_text()
    assert 'PlaywrightBrowserAdapter' in services and 'BrowserCliAdapter' not in services
    for rel in ['plugin/src','plugin/test']:
        for path in (ROOT/rel).rglob('*'):
            if path.is_file() and path.suffix in {'.ts','.mjs'}:
                text=path.read_text(errors='ignore')
                assert 'agent-browser' not in text and 'BrowserCliAdapter' not in text


def test_prompt_b_baseline_is_bound_to_exact_starting_commit_and_hashes():
    d=json.loads((ROOT/'data/validation/zero-defect-baseline.json').read_text())
    assert d['schema']==1 and d['kind']=='ZERO_DEFECT_CERTIFICATION_BASELINE' and d['program']=='PROMPT_B' and d['status']=='BASELINE_CAPTURED'
    assert d['source']=={'head':'9f0624383db038f55e280ab7834b7dd12bc281ca','tree':'b39dd548b1ceba28ff6fc67575ad9389ccf4f5b2','branch':'main','working_tree':'CLEAN'}
    assert d['host']['opencode_installed']=='1.18.18' and d['host']['opencode_registry_latest']=='1.18.18' and d['host']['architecture']=='aarch64'
    assert d['schemas']['hi_config']==2 and d['schemas']['runtime_state']==10 and d['schemas']['setup_ownership']==2 and d['schemas']['setup_state']==1 and d['schemas']['project_routing']==1
    assert d['initial_architecture_scan']=={'typescript_source_files':168,'relative_import_edges':507,'import_cycles':0}
    commit=d['source']['head']
    for rel,expected in d['dependency_lock_hashes'].items():
        blob=subprocess.check_output(['git','show',f'{commit}:{rel}']); assert hashlib.sha256(blob).hexdigest()==expected
    for rel,expected in d['generated_artifact_hashes'].items():
        blob=subprocess.check_output(['git','show',f'{commit}:{rel}']); assert hashlib.sha256(blob).hexdigest()==expected


def test_prompt_b_internal_exports_have_a_repository_consumer():
    source_files=list((ROOT/'plugin/src').rglob('*.ts'))
    source={path:path.read_text(errors='ignore') for path in source_files}
    support=[]
    for base in [ROOT/'plugin/test',ROOT/'tests',ROOT/'scripts']:
        for path in base.rglob('*'):
            if path.is_file() and path.suffix in {'.mjs','.js','.ts','.py'}: support.append(path.read_text(errors='ignore'))
    all_support='\n'.join(support)
    combined='\n'.join(source.values())
    dead=[]
    decl=re.compile(r'export\s+(?:class|function|interface|type)\s+([A-Za-z_][A-Za-z0-9_]*)')
    for path,text in source.items():
        if '/generated/' in path.as_posix(): continue
        for name in decl.findall(text):
            count=len(re.findall(rf'\b{re.escape(name)}\b',combined))+len(re.findall(rf'\b{re.escape(name)}\b',all_support))
            if count<=1: dead.append(f'{path.relative_to(ROOT)}::{name}')
    assert dead==[]

def test_prompt_b_exact_current_opencode_native_reevaluation_is_source_bound_and_fail_closed():
    d=json.loads((ROOT/'data/validation/opencode-native-reevaluation.json').read_text())
    assert d['schema']==1 and d['kind']=='EXACT_CURRENT_OPENCODE_NATIVE_REEVALUATION' and d['program']=='PROMPT_B' and d['status']=='PASS'
    assert d['opencode']=={'version':'1.18.18','source_commit':'e23586af2623f1bc2e8e6965d2d7acf7bd03d5c3','source_worktree_used':False,'source_read_mode':'git-blob'}
    assert d['missing_hi_paths']==[]
    assert d['summary']=={'surfaces':12,'remove_custom_mechanism':0,'keep_thin_or_stronger':11,'unsupported':1}
    decisions={x['surface']:x for x in d['decisions']}
    assert set(decisions)=={'sessions','task-delegation','permission','tool-events','lsp','pty','workspace','provider-model-observation','skill-loading','lifecycle-events','human-decision-structured-open','compaction'}
    assert decisions['lsp']['hi_decision']=='KEEP_LOCAL_SEMANTIC_ADAPTER; NATIVE_DISCOVERY_OPTIONAL'
    assert 'source hash' in decisions['lsp']['reason'] and 'freshness' in decisions['lsp']['reason']
    assert decisions['human-decision-structured-open']['hi_decision']=='UNSUPPORTED_STRUCTURED_OPEN_KEEP_CHAT_TRANSPORT'
    assert 'cannot deterministically open a question' in decisions['human-decision-structured-open']['reason']
    assert decisions['task-delegation']['hi_decision']=='KEEP_STRONGER_SEMANTIC_CONTROL'
    assert decisions['permission']['hi_decision']=='KEEP_THIN_AUTHORITY_BINDING'
    for item in decisions.values():
        assert item['hi_paths'] and all((ROOT/p).is_file() for p in item['hi_paths'])
    assert (ROOT/'scripts/audit-opencode-native.py').is_file()

def test_prompt_b_mission_task_worker_adversarial_audit_covers_all_section_6_invariants():
    d=json.loads((ROOT/'data/validation/prompt-b-mission-task-worker.json').read_text())
    assert d['schema']==1 and d['kind']=='PROMPT_B_MISSION_TASK_WORKER_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==6 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':15,'covered':15,'violations':0}
    expected={'unique-identities','mission-ownership','task-dag-validity','worker-binding','no-ghost-workers','no-orphan-tasks','no-duplicate-completion','out-of-order-callback','stale-worker-result','task-cancellation','task-recovery','dependency-unblock','concurrent-write-safety','restart-reconstruction','terminal-state-correctness'}
    assert {x['invariant'] for x in d['invariants']}==expected
    for row in d['invariants']:
        owner=ROOT/row['owner']; proof=ROOT/row['proof']
        assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(errors='ignore') and row['proof_anchor'] in proof.read_text(errors='ignore')
    assert any(x['id']=='ambiguous-native-session-callback-ownership' for x in d['closed_defects'])
    assert (ROOT/'scripts/audit-mission-task-worker.py').is_file()

def test_prompt_b_role_model_methodology_audit_keeps_semantic_planes_separate():
    d=json.loads((ROOT/'data/validation/prompt-b-role-model-methodology.json').read_text())
    assert d['schema']==1 and d['kind']=='PROMPT_B_ROLE_MODEL_METHODOLOGY_ADVERSARIAL_AUDIT' and d['section']==7 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':13,'covered':13,'violations':0}
    expected={'role-agent-model-methodology-separation','requested-selected-projected-observed-model','host-contradiction-handling','unknown-model-capability','model-fallback','methodology-available-admitted-selected-loaded','methodology-lazy-load','methodology-collision','methodology-exit','methodology-cannot-grant-authority','methodology-cannot-own-completion','role-permissions-mechanically-projected','prompt-persona-cannot-override-policy'}
    assert {x['invariant'] for x in d['invariants']}==expected
    assert d['static_guards']=={'methodology_forbidden_owner_imports':[],'skill_boundary_missing':[],'skill_control_plane_claims':[],'role_markdown_mechanical_owners':[],'skill_count':27}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof']
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(errors='ignore') and row['proof_anchor'] in proof.read_text(errors='ignore')
    assert (ROOT/'scripts/audit-role-model-methodology.py').is_file()

def test_prompt_b_authority_permission_external_action_audit_is_structured_fail_closed_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-authority-permission-external-action.json').read_text())
    assert d['schema']==1 and d['kind']=='PROMPT_B_AUTHORITY_PERMISSION_EXTERNAL_ACTION_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==8 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':18,'covered':18,'violations':0}
    expected={'generic-yes-not-authority','continuation-not-approval','exact-action-scope','exact-target','exact-parameters','once-vs-reusable','consumed-authority','replay-idempotency','deny-precedence','lower-level-cannot-widen-safety','host-permission-cannot-widen-hi-authority','stale-approvals-rejected','credential-mfa-oauth-boundary','paid-irreversible-boundary','push-tag-release-publish-deploy-authority','destructive-filesystem-boundary','secret-sensitive-boundary','no-natural-language-regex-authority'}
    assert {x['invariant'] for x in d['invariants']}==expected
    assert d['static_guards']=={'natural_language_authority_regex_owner':False,'structured_authority_protocol':True,'persistent_authority_classes':['git-push','release-create','package-publish','deploy']}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof']
        assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(errors='ignore') and row['proof_anchor'] in proof.read_text(errors='ignore')
    closed={x['id'] for x in d['closed_defects']}
    assert {'natural-language-regex-owned-authority','stale-one-shot-approval','destructive-irreversible-secret-boundaries'}<=closed
    assert (ROOT/'scripts/audit-authority-permission-external-action.py').is_file()

def test_prompt_b_evidence_verification_completion_audit_is_source_bound_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-evidence-verification-completion.json').read_text())
    assert d['schema']==1 and d['kind']=='PROMPT_B_EVIDENCE_VERIFICATION_COMPLETION_HOSTILE_AUDIT' and d['program']=='PROMPT_B' and d['section']==9 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':12,'covered':12,'violations':0}
    expected={'evidence-scope','evidence-freshness','source-revision','changed-file-ownership','mutation-invalidation','not-run-not-passed','worker-result-not-evidence','project-intelligence-not-evidence','context-summary-not-evidence','review-disposition','required-evidence-coverage','completion-obligation-reconciliation'}
    assert {x['invariant'] for x in d['invariants']}==expected
    assert d['static_guards']=={'project_intelligence_evidence_owner_paths':[],'context_evidence_owner_paths':[],'worker_result_is_mission_evidence_owner':False}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256'];assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(errors='ignore') and row['proof_anchor'] in proof.read_text(errors='ignore')
    assert {'reviewer-done-auto-pass-evidence','worker-pass-without-source-state'}<={x['id'] for x in d['closed_defects']}
    assert (ROOT/'scripts/audit-evidence-verification-completion.py').is_file()

def test_prompt_b_context_project_intelligence_compression_audit_is_consumer_bound_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-context-project-intelligence-compression.json').read_text())
    assert d['schema']==1 and d['kind']=='PROMPT_B_CONTEXT_PROJECT_INTELLIGENCE_COMPRESSION_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==10 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':12,'covered':12,'violations':0}
    expected={'context-consumer-binding','unknown-context-handle-fail-close','stale-context-exclusion','project-intelligence-retrieval-eligibility','compression-source-hash-binding','compression-consumer-isolation','compression-freshness-propagation','privacy-monotonicity','project-intelligence-not-evidence','context-compression-not-evidence','protected-state-budget-survival','cache-source-invalidation'}
    assert {x['invariant'] for x in d['invariants']}==expected
    assert d['static_guards']=={'project_intelligence_evidence_owner_paths':[],'context_evidence_owner_paths':[],'compression_exact_consumer_binding':True,'compression_unknown_freshness_rejected':True}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256'];assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(errors='ignore') and row['proof_anchor'] in proof.read_text(errors='ignore')
    assert 'compression-cross-consumer-rescope' in {x['id'] for x in d['closed_defects']}
    assert (ROOT/'scripts/audit-context-project-intelligence-compression.py').is_file()
