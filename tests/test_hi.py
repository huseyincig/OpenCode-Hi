from __future__ import annotations
import hashlib, importlib.util, json, os, subprocess, sys, zipfile,re
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
V=(ROOT/'VERSION').read_text(encoding='utf-8').strip()

def run(*args):return subprocess.run([sys.executable,*map(str,args)],text=True,capture_output=True)
def load_module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);assert spec and spec.loader;spec.loader.exec_module(m);return m

def git_blob(commit,rel):
    return subprocess.check_output(['git','show',f'{commit}:{rel}'],cwd=ROOT)

def git_blob_sha256(commit,rel):
    return hashlib.sha256(git_blob(commit,rel)).hexdigest()

def git_blob_oid(commit,rel):
    return subprocess.check_output(['git','rev-parse',f'{commit}:{rel}'],cwd=ROOT,text=True).strip()

def test_identity_is_hi():
    d=json.loads((ROOT/'data/product.json').read_text(encoding='utf-8'))
    assert d['product_name']=='OpenCode-Hi' and d['short_name']=='HI' and d['version']==V
    assert d['plugin_package']=='opencode-hi' and d['repository']=='https://github.com/huseyincig/OpenCode-Hi'

def test_root_git_package_contract():
    d=json.loads((ROOT/'package.json').read_text(encoding='utf-8')); assert d['name']=='opencode-hi' and d['version']==V
    assert d['main']=='plugin/dist/plugin.js' and (ROOT/d['main']).is_file() and {'skills','scripts/native_plugin_setup.py','VERSION','docs','.github/CONTRIBUTING.md','.github/SECURITY.md','.github/SUPPORT.md'}<=set(d['files'])
    assert d['bin']=={'opencode-hi-setup':'scripts/native_plugin_setup.py'}
    assert d['peerDependencies']['@opencode-ai/plugin']=='1.18.18'
    assert d['dependencies']=={'@opencode-ai/sdk':'1.18.18'}
    assert d['optionalDependencies']['playwright-core']=='1.62.1'

def test_root_is_product_clean():
    assert not any((ROOT/x).exists() for x in ['KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','HI.cmd','HI.sh','HI-VALIDATE.cmd','HI-RELEASE-PREP.cmd','README.tr.md','CONTRIBUTING.md','SECURITY.md'])
    docs={p.relative_to(ROOT/'docs').as_posix() for p in (ROOT/'docs').rglob('*.md')}
    assert docs=={'README.md','ARCHITECTURE.md','INSTALLATION.md','SKILLS.md','HOSTS.md','HUMAN-DECISIONS.md','VERIFICATION.md','SECURITY-MODEL.md','RELEASE.md','locales/tr/README.md'}
    assert not (ROOT/'docs/engineering-constitution').exists()
    assert '.project-docs/' in (ROOT/'.gitignore').read_text(encoding='utf-8')
    for rel in ['.github/CONTRIBUTING.md','.github/SECURITY.md','.github/SUPPORT.md','.github/pull_request_template.md','.github/ISSUE_TEMPLATE/bug_report.yml','.github/ISSUE_TEMPLATE/feature_request.yml']:
        assert (ROOT/rel).is_file()


def test_semantic_contract_names_only():
    for rel in ['data/validation/implementation-coverage.json','data/validation/native-coverage.json','data/validation/flow-coverage.json','data/validation/flow-acceptance.json','data/validation/source-gates.json']:assert (ROOT/rel).is_file()
    for rel in ['data/feature-ledger-09-coverage.json','data/native-first-10-coverage.json','data/flow-11-coverage.json','data/flow-11-acceptance.json','data/observed-runtime-smoke-1.18.16.json']:assert not (ROOT/rel).exists()

def test_setup_adds_only_hi_and_preserves_other_plugins(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['user-plugin@1']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);assert r.returncode==0,r.stderr
    p=json.loads((tmp_path/'opencode.json').read_text(encoding='utf-8'))['plugin']; assert f'opencode-hi@{V}' in p
    assert 'user-plugin@1' in p and len([x for x in p if x.startswith('opencode-hi@')])==1

def test_setup_blocks_conflicting_hi_registration(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['opencode-hi@9.9.9']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path); assert r.returncode==2 and json.loads(r.stdout)['status']=='BLOCKED'

def test_uninstall_removes_only_hi(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    assert run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path).returncode==0
    p=json.loads((tmp_path/'opencode.json').read_text(encoding='utf-8'))['plugin']; assert not any('OpenCode-Hi' in x for x in p)



def test_exact_package_version_install_doctor_and_uninstall_preserve_user_fields(tmp_path):
    version='0.1.0'
    cfg=tmp_path/'opencode.json'
    cfg.write_text(json.dumps({'plugin':['user-plugin@example'],'mcp':{'user':{'type':'remote','url':'https://example.invalid/mcp'}},'theme':'user-theme'}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path,'--version',version); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='APPLIED'
    expected=f'opencode-hi@{version}'
    assert out['plugin_spec']==expected
    data=json.loads(cfg.read_text(encoding='utf-8')); assert expected in data['plugin'] and 'user-plugin@example' in data['plugin']
    assert data['mcp']['user']['url']=='https://example.invalid/mcp' and data['theme']=='user-theme'
    d=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); doctor=json.loads(d.stdout)
    assert d.returncode==0 and doctor['status']=='OK' and doctor['hi_specs']==[expected]
    u=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path); un=json.loads(u.stdout)
    assert u.returncode==0 and un['status']=='APPLIED' and un['removed']==[expected]
    after=json.loads(cfg.read_text(encoding='utf-8')); assert after['plugin']==['user-plugin@example']
    assert after['mcp']['user']['url']=='https://example.invalid/mcp' and after['theme']=='user-theme'

def test_doctor_is_machine_readable(tmp_path):
    run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path); r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); d=json.loads(r.stdout)
    assert r.returncode==0 and d['status']=='OK' and d['short']=='HI'

def test_source_contract_evidence_exists():
    d=json.loads((ROOT/'data/validation/source-contracts.json').read_text(encoding='utf-8')); assert d['release']==V
    for c in d['contracts'].values():
        for e in c.get('evidence',[]):assert (ROOT/e.split('#',1)[0]).exists(),e

@pytest.mark.evidence
def test_validate_passes():
    r=run(ROOT/'scripts/validate.py'); assert r.returncode==0,r.stdout+r.stderr

def test_validator_rejects_incomplete_dependency_lock_metadata(tmp_path):
    import shutil
    probe=tmp_path/'repo'
    shutil.copytree(ROOT,probe,ignore=shutil.ignore_patterns('node_modules','dist','.pytest_cache','__pycache__'))
    lock_path=probe/'plugin'/'package-lock.json'
    lock=json.loads(lock_path.read_text(encoding='utf-8'))
    target=next(k for k,v in lock['packages'].items() if k and not v.get('link'))
    lock['packages'][target].pop('resolved',None)
    lock_path.write_text(json.dumps(lock))
    # validation also needs a runtime entrypoint; use the current built file as a fixture.
    dist=probe/'plugin'/'dist'; dist.mkdir(parents=True,exist_ok=True); (dist/'plugin.js').write_text('// fixture')
    r=subprocess.run([sys.executable,str(probe/'scripts/validate.py')],text=True,capture_output=True,cwd=probe)
    assert r.returncode!=0 and 'package-lock entry missing resolved/integrity' in (r.stdout+r.stderr)

def test_plugin_install_script_allowlist_is_exact():
    pp=json.loads((ROOT/'plugin/package.json').read_text(encoding='utf-8'))
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
        text=(ROOT/'scripts'/name).read_text(encoding='utf-8')
        assert '.write_bytes(' in text, name
        assert '.write_text(' not in text, name
    receipt=(ROOT/'scripts/projection_receipts.mjs').read_text(encoding='utf-8')
    assert "replace(/\\r\\n?/g,'\\n')" in receipt

def test_node_release_scripts_use_platform_safe_file_url_paths():
    for rel in ['scripts/generate_projection_receipts.mjs','scripts/architecture_lint.mjs']:
        text=(ROOT/rel).read_text(encoding='utf-8')
        assert 'fileURLToPath' in text
        assert "import.meta.url).pathname" not in text

def test_release_names_and_source_integrity(tmp_path):
    dist,src=_build(tmp_path); assert dist.is_file() and src.is_file()
    with zipfile.ZipFile(src) as z:n=set(z.namelist())
    assert {'package.json','docs/locales/tr/README.md','plugin/package-lock.json','plugin/dist/plugin.js','docs/ARCHITECTURE.md','docs/INSTALLATION.md','docs/SKILLS.md','docs/VERIFICATION.md','.github/SECURITY.md','.github/CONTRIBUTING.md'}<=n
    assert 'README.tr.md' not in n and 'WORK-STATE.md' not in n and 'KURULUM.md' not in n
    assert not any(name.startswith('docs/engineering-constitution/') for name in n)
    assert not any(part == '.project-docs' for name in n for part in Path(name).parts)
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
    gates=json.loads((ROOT/'data/validation/release-gates.json').read_text(encoding='utf-8'))
    assert gates['gates']['node_runtime_acceptance']=='PASS_LOCAL_CURRENT_SOURCE'
    assert gates['gates']['python_acceptance']=='PASS_LOCAL_CURRENT_SOURCE'
    assert 'tests' not in gates['current_local_evidence']['node']
    assert 'tests' not in gates['current_local_evidence']['python']
    audit=json.loads((ROOT/'data/validation/final-dod-audit.json').read_text(encoding='utf-8'))
    assert isinstance(audit['local_acceptance']['node'],dict) and 'node_tests' not in audit['local_acceptance']
    assert isinstance(audit['local_acceptance']['python'],dict) and 'python_tests' not in audit['local_acceptance']

def test_release_gate_stays_blocked_until_exact_candidate_external_completion():
    d=json.loads((ROOT/'data/validation/release-gates.json').read_text(encoding='utf-8'))
    assert d['release']==V and d['release_blocked'] is True
    assert d['gates']['source_integrity'].startswith(('PENDING_','PASS_LOCAL_'))
    assert d['gates']['node_runtime_acceptance'].startswith(('PENDING_','PASS_LOCAL_'))
    assert d['gates']['python_acceptance'].startswith(('PENDING_','PASS_LOCAL_'))
    for gate in ('plain_opencode_smoke','packaged_agents_skills','opencode_native_child_sessions','opencode_model_provider_binding','permission_denial_runtime','native_package_plugin_install_exact_candidate','windows_runtime_smoke','dependency_supply_chain_external'):
        assert d['gates'][gate].startswith('PENDING_'),(gate,d['gates'][gate])
    assert d['gates']['github_release_publication'].startswith('PENDING_')
    assert d['gates']['npm_registry_publication'].startswith('PENDING_AUTH_T4_')
    hist=d['historical_release_evidence']
    assert hist['release']=='0.1.3' and hist['github_release_status']=='PASS_T4' and hist['npm_registry_status']=='PASS_T4'
    assert (ROOT/hist['release_status_receipt']).is_file()
    assert '0.2.0' in d['reason'] and d['external_blockers']


def test_living_validation_contracts_are_bound_to_hi_0_1_0():
    for name in ['implementation-coverage.json','native-coverage.json','flow-coverage.json','flow-acceptance.json','source-gates.json','external-protocol.json']:
        d=json.loads((ROOT/'data'/'validation'/name).read_text(encoding='utf-8')); assert d['release']==V,name
    schema=json.loads((ROOT/'data/validation/external-schema.json').read_text(encoding='utf-8'))
    assert schema['required_coexistence']==['plain_opencode_smoke','hi_only_smoke']
    assert 'hi_version' in schema['binding'] and 'oho_version' not in schema['binding']

def test_current_0_1_0_receipts_are_not_historical_v58_claims():
    gates=json.loads((ROOT/'data/validation/release-gates.json').read_text(encoding='utf-8'))
    assert gates['candidate_status']==f"PROMPT_B_{V.replace('.','_')}_PREPUBLICATION_CERTIFICATION_IN_PROGRESS"
    assert gates['current_local_evidence']['benchmarks']['receipt']=='data/validation/benchmarks-0.1.0.json'
    assert gates['current_local_evidence']['install_lifecycle']['receipt']=='data/validation/install-lifecycle-0.1.0.json'
    assert gates['historical_receipts_not_valid_for_current_candidate']['release']=='2.0.10-v58'
    audit=json.loads((ROOT/'data/validation/architecture-audit-0.1.0.json').read_text(encoding='utf-8'))
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
    project=json.loads((tmp_path/'.opencode'/'hi'/'policy'/'routing.json').read_text(encoding='utf-8'))
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
    d=json.loads((ROOT/'data/validation/skill-artifact-ownership-0.1.0.json').read_text(encoding='utf-8'))
    assert d['skills_audited']==27
    assert len(d['skills'])==27
    assert all(row['skill_specific_hi_directory'] is False for row in d['skills'])
    assert '.opencode/skills/<project-created-skill>/' in d['canonical_project_families']

def test_setup_blocks_symlinked_managed_config_escape(tmp_path):
    if os.name=='nt':pytest.skip('symlink privilege varies on Windows')
    outside=tmp_path.parent/f'{tmp_path.name}-outside.json';outside.write_text(json.dumps({'plugin':['outside']}))
    (tmp_path/'opencode.json').symlink_to(outside)
    before=outside.read_text(encoding='utf-8')
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='BLOCKED' and out['reason']=='managed-path-escapes-project-or-uses-symlink'
    assert outside.read_text(encoding='utf-8')==before

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
    before=outside.read_text(encoding='utf-8')
    r=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='BLOCKED'
    assert outside.read_text(encoding='utf-8')==before

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
    before=cfg.read_text(encoding='utf-8')
    second=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);out=json.loads(second.stdout)
    assert second.returncode==0 and out['status']=='NOOP' and out['reason']=='already-installed-owned'
    assert cfg.read_text(encoding='utf-8')==before
    assert json.loads(cfg.read_text(encoding='utf-8'))['plugin']==['foreign@1',f'opencode-hi@{V}']


def test_r2_owned_upgrade_and_one_step_rollback_preserve_foreign_config(tmp_path):
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['foreign@1'],'mcp':{'x':{'type':'remote','url':'https://example.invalid'}}}))
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path,'--version','0.1.0').returncode==0
    up=run(ROOT/'scripts/native_plugin_setup.py','upgrade',tmp_path,'--version','0.2.0');u=json.loads(up.stdout)
    assert up.returncode==0 and u['status']=='APPLIED' and u['from_plugin_spec']=='opencode-hi@0.1.0' and u['to_plugin_spec']=='opencode-hi@0.2.0'
    data=json.loads(cfg.read_text(encoding='utf-8'));assert data['plugin']==['foreign@1','opencode-hi@0.2.0'] and data['mcp']['x']['url']=='https://example.invalid'
    assert (tmp_path/'.opencode/hi/provenance/setup-rollback.json').is_file()
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);r=json.loads(rb.stdout)
    assert rb.returncode==0 and r['status']=='APPLIED' and r['rolled_back_operation']=='upgrade' and r['restored_plugin_spec']=='opencode-hi@0.1.0'
    data=json.loads(cfg.read_text(encoding='utf-8'));assert data['plugin']==['foreign@1','opencode-hi@0.1.0'] and data['mcp']['x']['url']=='https://example.invalid'
    own=json.loads((tmp_path/'.opencode/hi/provenance/setup.json').read_text(encoding='utf-8'));assert own['plugin_spec']=='opencode-hi@0.1.0'
    assert not (tmp_path/'.opencode/hi/provenance/setup-rollback.json').exists()


def test_r2_uninstall_rollback_restores_owned_registration_without_touching_foreign_state(tmp_path):
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['a@1','b@1'],'theme':'user-theme','unknown':{'keep':True}}))
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    un=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path);u=json.loads(un.stdout)
    assert un.returncode==0 and u['status']=='APPLIED' and u['rollback_available'] is True
    assert json.loads(cfg.read_text(encoding='utf-8'))['plugin']==['a@1','b@1']
    assert not (tmp_path/'.opencode/hi/provenance/setup.json').exists()
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);r=json.loads(rb.stdout)
    assert rb.returncode==0 and r['rolled_back_operation']=='uninstall'
    data=json.loads(cfg.read_text(encoding='utf-8'));assert data['plugin']==['a@1','b@1',f'opencode-hi@{V}']
    assert data['theme']=='user-theme' and data['unknown']=={'keep':True}
    assert (tmp_path/'.opencode/hi/provenance/setup.json').is_file()


def test_r2_recover_completes_interrupted_upgrade_when_config_matches_recorded_after_state(tmp_path):
    mod=load_module('native_plugin_setup_r2_recover',ROOT/'scripts/native_plugin_setup.py')
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['foreign@1']}))
    assert mod.install(tmp_path,'0.1.0')['status']=='APPLIED'
    # consume the install rollback point so the synthetic interrupted upgrade is the only lifecycle edge under test
    (tmp_path/mod.SETUP_ROLLBACK).unlink()
    own=json.loads((tmp_path/mod.OWNERSHIP).read_text(encoding='utf-8'));before_text=cfg.read_text(encoding='utf-8');data=json.loads(before_text);idx=data['plugin'].index('opencode-hi@0.1.0')
    after=dict(data);after['plugin']=list(data['plugin']);after['plugin'][idx]='opencode-hi@0.2.0';after_text=mod.dump(after)
    next_own=mod._ownership_doc(tmp_path,cfg,'opencode-hi@0.2.0',mod.sha_text(before_text),mod.sha_text(after_text),own.get('installed_at'))
    tx=mod._lifecycle_record('upgrade',cfg,tmp_path,before_text,after_text,'opencode-hi@0.1.0','opencode-hi@0.2.0',idx,idx,own,next_own)
    tx['status']='config-applied';mod._write_state(tmp_path/mod.SETUP_TRANSACTION,tx);mod._atomic_write_text(cfg,after_text)
    # ownership is intentionally still old, modeling interruption after config replace
    assert json.loads((tmp_path/mod.OWNERSHIP).read_text(encoding='utf-8'))['plugin_spec']=='opencode-hi@0.1.0'
    rec=run(ROOT/'scripts/native_plugin_setup.py','recover',tmp_path);r=json.loads(rec.stdout)
    assert rec.returncode==0 and r['status']=='RECOVERED' and r['disposition']=='completed-interrupted-operation'
    assert json.loads((tmp_path/mod.OWNERSHIP).read_text(encoding='utf-8'))['plugin_spec']=='opencode-hi@0.2.0'
    assert json.loads(cfg.read_text(encoding='utf-8'))['plugin']==['foreign@1','opencode-hi@0.2.0']
    assert not (tmp_path/mod.SETUP_TRANSACTION).exists() and (tmp_path/mod.SETUP_ROLLBACK).exists()


def test_r2_pending_transaction_blocks_new_mutation_until_recover(tmp_path):
    mod=load_module('native_plugin_setup_r2_pending',ROOT/'scripts/native_plugin_setup.py')
    assert mod.install(tmp_path,'0.1.0')['status']=='APPLIED'
    cfg=tmp_path/'opencode.json';before=cfg.read_text(encoding='utf-8');own=json.loads((tmp_path/mod.OWNERSHIP).read_text(encoding='utf-8'))
    tx=mod._lifecycle_record('upgrade',cfg,tmp_path,before,before,'opencode-hi@0.1.0','opencode-hi@0.2.0',0,0,own,own);tx['status']='planned';mod._write_state(tmp_path/mod.SETUP_TRANSACTION,tx)
    up=run(ROOT/'scripts/native_plugin_setup.py','upgrade',tmp_path,'--version','0.2.0');out=json.loads(up.stdout)
    assert up.returncode==2 and out['status']=='BLOCKED' and out['reason']=='pending-setup-transaction-run-recover'
    doc=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path);d=json.loads(doc.stdout)
    assert doc.returncode==2 and d['status']=='FAIL' and d['lifecycle']['transaction_pending'] is True and 'pending-setup-transaction' in d['issues']


def test_r2_rollback_fails_closed_after_unrelated_post_operation_config_drift(tmp_path):
    cfg=tmp_path/'opencode.json';cfg.write_text(json.dumps({'plugin':['foreign@1'],'theme':'a'}))
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    data=json.loads(cfg.read_text(encoding='utf-8'));data['theme']='user-changed-after-install';cfg.write_text(json.dumps(data))
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);out=json.loads(rb.stdout)
    assert rb.returncode==2 and out['status']=='BLOCKED' and out['reason']=='setup-rollback-config-drift'
    assert json.loads(cfg.read_text(encoding='utf-8'))['theme']=='user-changed-after-install'


def test_r2_rollback_of_fresh_install_restores_absent_config_file(tmp_path):
    cfg=tmp_path/'opencode.json';assert not cfg.exists()
    ins=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);assert ins.returncode==0 and cfg.exists()
    rb=run(ROOT/'scripts/native_plugin_setup.py','rollback',tmp_path);out=json.loads(rb.stdout)
    assert rb.returncode==0 and out['status']=='APPLIED' and out['rolled_back_operation']=='install'
    assert not cfg.exists()
    assert not (tmp_path/'.opencode/hi/provenance/setup.json').exists()


def test_r2_install_lifecycle_receipt_covers_full_local_recovery_contract():
    d=json.loads((ROOT/'data/validation/install-lifecycle-0.1.0.json').read_text(encoding='utf-8'))
    assert d['schema']==2 and d['kind']=='LOCAL_CONFIG_LIFECYCLE_R2'
    required={'install':'APPLIED','idempotent_install':'NOOP','upgrade':'APPLIED','rollback_upgrade':'APPLIED','uninstall':'APPLIED','rollback_uninstall':'APPLIED','reinstall':'APPLIED','doctor_reinstalled':'OK','reinstall_cleanup':'APPLIED','recover_interrupted_upgrade':'RECOVERED'}
    assert all(d['operations'][k]==v for k,v in required.items())
    assert all(d['assertions'].values())
    assert d['state_security']['setup_json_mode']=='0o600' and d['state_security']['rollback_mode_after_install']=='0o600' and d['state_security']['reinstall_setup_json_mode']=='0o600'
    assert d['state_security']['transaction_contains_config_body'] is False and d['state_security']['rollback_contains_config_body'] is False
    assert (ROOT/'scripts/run-install-lifecycle.py').is_file()


def test_r3_generated_compatibility_projection_selects_latest_exact_capability_proofs_without_erasing_history():
    d=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='GENERATED_RECEIPT_COMPATIBILITY_PROJECTION'
    cur=d['current_reference_host'];assert (cur['opencode_version'],cur['platform'],cur['architecture'])==('1.18.18','linux','aarch64')
    caps=cur['capabilities'];q39=json.loads((ROOT/'data/validation/prompt-b-exact-current-opencode-t3.json').read_text(encoding='utf-8'));exact=q39['exact_source_commit'];short=exact[:7]
    for cap,kind in [('process-lifecycle','process'),('workspace-isolation-binding','workspace'),('browser-execution','browser')]:
        qcap=q39['capabilities'][cap]
        assert caps[cap]['status']=='SUPPORTED_T3' and caps[cap]['tested_git_commit']==qcap['receipt_source_commit']
        assert caps[cap]['receipt']==qcap['receipt'] and qcap['runtime_equivalent_to_current'] is True and qcap['runtime_hash_drift']==[]
        receipt_short=qcap['receipt_source_commit'][:7]
        assert caps[cap]['receipt'].endswith(f'{kind}-1.18.18-head-{receipt_short}.json')
    superseded={x['receipt']:x for x in d['history']}
    assert superseded['data/validation/external-opencode-hi-0.1.0-host-1.18.18-head-bc85854.json']['classification']=='HISTORICAL_EXACT_PROOF'
    assert superseded['data/validation/external-opencode-hi-0.1.0-workspace-1.18.18-head-92812a1.json']['classification']=='HISTORICAL_EXACT_PROOF'
    assert superseded['data/validation/external-opencode-hi-0.1.0-browser-1.18.18-head-476590e.json']['classification']=='HISTORICAL_EXACT_PROOF'
    assert superseded['data/validation/external-opencode-hi-0.1.0-lifecycle-1.18.18-head-2e7813f.json']['classification']=='HISTORICAL_EXACT_PROOF'
    assert superseded['data/validation/external-opencode-hi-0.1.0-lifecycle-1.18.18-head-2e7813f.json']['current_for_capabilities']==[]
    negative=next(x for x in d['history'] if x['receipt'].endswith('browser-1.18.18-head-707609b.json'))
    assert negative['classification']=='HISTORICAL_EXACT_PROOF' and negative['current_for_capabilities']==[] and negative['gates']['browser-execution']=='UNSUPPORTED'
    old=next(x for x in d['history'] if x['opencode_version']=='1.18.16' and x['exact_source'])
    assert old['classification']=='HISTORICAL_EXACT_PROOF'
    nonexact=next(x for x in d['history'] if x['receipt'].endswith('host-current-worktree.json'))
    assert nonexact['classification']=='NON_EXACT_WORKTREE' and nonexact['current_for_capabilities']==[]
    for row in d['history']:
        path=ROOT/row['receipt'];assert path.is_file();assert hashlib.sha256(path.read_bytes()).hexdigest()==row['receipt_sha256']
    assert (ROOT/'scripts/generate-compatibility-matrix.py').is_file()



def test_r4_generated_release_status_projects_current_candidate_without_rewriting_history():
    version=(ROOT/'VERSION').read_text(encoding='utf-8').strip();d=json.loads((ROOT/f'data/validation/release-status-{version}.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='GENERATED_RELEASE_STATUS_PROJECTION' and d['release']==version
    assert d['status'] in {'PREPUBLICATION_CERTIFICATION_IN_PROGRESS','PREPUBLICATION_CERTIFIED_PENDING_T4','CERTIFIED_T4'}
    assert d['historical_github_release']['tag']=='v0.1.0' and d['historical_github_release']['status']=='PASS_T4'
    assert d['candidate']['tag']==f'v{version}' and d['publication_authority']=={'required':True,'granted':False,'condition':'requires explicit current user authority after final certification; this projection never grants authority'}
    assert all(x['status']=='SUPPORTED_T3' for x in d['reference_host']['baseline_capabilities'].values())
    if d['status']=='PREPUBLICATION_CERTIFICATION_IN_PROGRESS': assert d['candidate']['prepublication_ready'] is False and any(str(v).startswith('PENDING_') for v in d['reference_host']['candidate_certification'].values())
    block=(ROOT/'docs/RELEASE.md').read_text(encoding='utf-8')
    assert f'`{version}` (`v{version}`)' in block and d['status'] in block and 'Test counts are intentionally not persisted' in block


@pytest.mark.evidence
def test_n1_final_namespace_normalization_is_hash_bound_and_preserves_historical_exclusions():
    d=json.loads((ROOT/'data/validation/namespace-normalization-0.1.0.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='FINAL_HI_NAMESPACE_NORMALIZATION' and d['status']=='PASS'
    assert d['guard']['violations']==[] and d['path_audit']['violations']==[] and not any(d['stale_living_status'].values())
    assert d['public_surface']['skill_namespace'] is True and d['public_surface']['skill_count']==27
    assert d['public_surface']['tool_namespace_guard_present'] is True and d['public_surface']['config_option_count']==29
    assert 'plugin/test/config-no-legacy-superpowers.test.mjs' in d['path_audit']['excluded_provenance_or_negative_surfaces']
    assert not any(x.startswith('docs/engineering-constitution/') for x in d['path_audit']['excluded_prefixes'])
    for meta in d['inputs'].values():
        path=ROOT/meta['path'];assert path.is_file();assert hashlib.sha256(path.read_bytes()).hexdigest()==meta['sha256']
    assert (ROOT/'scripts/generate-namespace-audit.mjs').is_file()


def test_prompt_a_documentation_inventory_classifies_all_truth_surfaces_and_has_unique_current_owners():
    policy=json.loads((ROOT/'data/documentation-ownership.json').read_text(encoding='utf-8'))
    inv=json.loads((ROOT/'data/validation/documentation-inventory.json').read_text(encoding='utf-8'))
    assert policy['schema']==1 and policy['type']=='hi-documentation-ownership'
    assert policy['policy']['rule']=='one-current-area-one-public-owner'
    assert policy['policy']['public_docs_budget']==10 and policy['policy']['root_markdown_budget']==3
    assert inv['schema']==1 and inv['kind']=='DOCUMENTATION_TRUTH_INVENTORY' and inv['status']=='PASS'
    assert inv['violations']=={'missing':[],'duplicate_area':[],'budget_or_tracking':[]}
    areas=[x['area'] for x in policy['public_documents']+policy['machine_owners']]
    assert len(areas)==len(set(areas))
    artifacts={x['path']:x for x in inv['artifacts']}
    assert artifacts['README.md']['lifecycle']=='CANONICAL_CURRENT'
    assert artifacts['docs/locales/tr/README.md']['lifecycle']=='DERIVED_CURRENT'
    assert 'docs/engineering-constitution/15-ENGINEERING-CONSTITUTION.md' not in artifacts
    assert inv['summary']['docs_markdown']==10 and inv['summary']['root_markdown']==3
    for item in policy['public_documents']+policy['machine_owners']:assert (ROOT/item['path']).is_file()
    assert hashlib.sha256((ROOT/inv['policy']['path']).read_bytes()).hexdigest()==inv['policy']['sha256']


def test_version_truth_is_semver_and_not_validator_hard_pinned_to_0_1_0():
    version=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
    assert re.fullmatch(r'(?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?',version)
    validator=(ROOT/'scripts/validate.py').read_text(encoding='utf-8')
    assert "VERSION must be 0.1.0" not in validator
    assert json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']==version
    assert json.loads((ROOT/'plugin/package.json').read_text(encoding='utf-8'))['version']==version


@pytest.mark.evidence
def test_prompt_a_documentation_parity_binds_current_docs_to_machine_truth_and_links():
    d=json.loads((ROOT/'data/validation/documentation-parity.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='DOCUMENTATION_PARITY' and d['status']=='PASS' and d['violations']==[]
    assert {'bounded_public_surface','local_markdown_links','stale_current_status_patterns','release_availability','localized_version_parity','localized_release_status','host_capabilities','generated_config_host_projections','community_health_files'}==set(d['checks'])
    assert 'README.md' in d['checked_current_documents'] and 'docs/ARCHITECTURE.md' in d['checked_current_documents']
    assert 'docs/engineering-constitution/MASTER-CONTINUATION.md' not in d['checked_current_documents']
    assert '.github/CONTRIBUTING.md' in d['checked_current_documents']
    version=(ROOT/'VERSION').read_text(encoding='utf-8').strip(); tr=(ROOT/'docs/locales/tr/README.md').read_text(encoding='utf-8')
    assert f'`{version}`' in tr and f'opencode-hi@{version}' in tr
    assert not re.search(r'npm bootstrap|registry package oluşana kadar|release-status-0\.1\.0',tr,re.I)
    for meta in d['inputs'].values():
        path=ROOT/meta['path']; assert path.is_file(); assert hashlib.sha256(path.read_bytes()).hexdigest()==meta['sha256']
    pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    assert 'docs:check' in pkg['scripts'] and 'npm run docs:check' in pkg['scripts']['check:product'] and pkg['scripts']['check']=='npm run check:product && npm run check:evidence'


def test_prompt_a_first_use_docs_do_not_advertise_unavailable_registry_or_stale_capabilities():
    readme=(ROOT/'README.md').read_text(encoding='utf-8'); tr=(ROOT/'docs/locales/tr/README.md').read_text(encoding='utf-8'); arch=(ROOT/'docs/ARCHITECTURE.md').read_text(encoding='utf-8'); install=(ROOT/'docs/INSTALLATION.md').read_text(encoding='utf-8')
    for text in (readme,tr):
        assert 'first coherent OpenCode-Hi candidate' not in text
        assert 'opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git#' not in text
    assert f'`{V}`' in readme and 'Published availability is external state' in readme
    assert 'npm bootstrap publication is not yet complete' not in readme+install
    assert 'ProcessContract' in arch and 'WorkspaceLease' in arch and 'BrowserObservation' in arch
    assert 'contains no raw stdout/stderr buffer' in arch


def test_prompt_a_constitution_separates_current_law_from_program_history():
    assert not (ROOT/'docs/engineering-constitution').exists()
    assert '.project-docs/' in (ROOT/'.gitignore').read_text(encoding='utf-8')
    policy=json.loads((ROOT/'data/documentation-ownership.json').read_text(encoding='utf-8'))
    current_paths={x['path'] for x in policy['public_documents']}
    assert not any('engineering-constitution' in x or 'MASTER-CONTINUATION' in x for x in current_paths)
    assert policy['policy']['historical_or_local_notes_may_not_own_current_truth'] is True


def test_prompt_a_generated_config_and_host_tables_are_catalog_receipt_derived():
    install=(ROOT/'docs/INSTALLATION.md').read_text(encoding='utf-8'); hosts=(ROOT/'docs/HOSTS.md').read_text(encoding='utf-8')
    cfg=json.loads((ROOT/'data/hi-config-options.json').read_text(encoding='utf-8'))
    compat=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))['current_reference_host']
    assert install.count('<!-- BEGIN GENERATED CONFIG REFERENCE -->')==1 and install.count('<!-- END GENERATED CONFIG REFERENCE -->')==1
    assert all(f"`{x['path']}`" in install for x in cfg['options'])
    assert hosts.count('<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->')==1 and hosts.count('<!-- END GENERATED HOST CAPABILITY MATRIX -->')==1
    for cap,x in compat['capabilities'].items():
        assert f'`{cap}`' in hosts and f"**{x['status']}**" in hosts and f"`{x['receipt']}`" in hosts
    assert (ROOT/'scripts/generate-documentation-projections.py').is_file()
    assert 'generate-documentation-projections.py' in json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['scripts']['docs:check']


def test_prompt_a_product_truth_inventory_traces_24_major_areas_to_owners_consumers_and_proof():
    d=json.loads((ROOT/'data/validation/product-truth-inventory.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PRODUCT_TRUTH_TRACE_INVENTORY' and d['status']=='PASS'
    assert d['violations']=={'missing_paths':[]}
    areas={x['area']:x for x in d['areas']}; assert len(areas)==24
    for key in ['mission','task-runtime','roles-permissions','methodologies-skills','authority','context','project-intelligence','evidence-verification','process','workspace-isolation','browser','host-port','persistence-storage','install-lifecycle','external-actions-release']:
        assert key in areas
    for x in areas.values():
        assert (ROOT/x['owner_path']).exists() and (ROOT/x['canonical_doc']).is_file()
        assert x['proof_paths'] and all((ROOT/ref).is_file() for ref in x['proof_paths'])
    assert not (ROOT/'docs/ARCHITECTURE-REALITY-MAP.md').exists()
    assert {x['canonical_doc'] for x in areas.values()}<= {'docs/ARCHITECTURE.md','docs/INSTALLATION.md','docs/SKILLS.md','docs/HUMAN-DECISIONS.md','docs/RELEASE.md','docs/VERIFICATION.md','docs/HOSTS.md','docs/SECURITY-MODEL.md'}


def test_prompt_a_current_storage_terminology_and_identity_docs_have_no_preimplementation_language():
    arch=(ROOT/'docs/ARCHITECTURE.md').read_text(encoding='utf-8'); readme=(ROOT/'README.md').read_text(encoding='utf-8')
    assert '## Storage and filesystem ownership' in arch and 'ProcessRuntime' in arch and 'OpenCodeWorkspaceAdapter' in arch
    assert '## Context and Project Intelligence' in arch and '## Execution policy' in arch
    assert 'application version is owned by `VERSION`' not in readme or (ROOT/'VERSION').is_file()
    for old in ['STORAGE-OWNERSHIP-MATRIX.md','TERMINOLOGY.md','PRODUCT-IDENTITY.md','CONTEXT.md','PROJECT-INTELLIGENCE.md','EXECUTION-POLICY.md']:
        assert not (ROOT/'docs'/old).exists()


def test_prompt_a_final_reconstruction_receipt_is_hash_bound_to_certified_source():
    d=json.loads((ROOT/'data/validation/documentation-reconstruction.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='FINAL_PRODUCT_TRUTH_RECONSTRUCTION' and d['program']=='PROMPT_A' and d['status']=='COMPLETED'
    record=d['completion_record']; assert record['commit']=='9f0624383db038f55e280ab7834b7dd12bc281ca'
    assert d['certified_source']['head']=='5ced215ed57f28f8d963376ca702efc0dac75503'
    assert all(d['exit_gate'].values())
    for meta in d['inputs'].values():
        blob=subprocess.check_output(['git','show',f"{record['commit']}:{meta['path']}"])
        assert hashlib.sha256(blob).hexdigest()==meta['sha256']
    # Historical reconstruction remains immutable Git evidence; it is no longer a current public-doc dependency.
    historical=subprocess.check_output(['git','show',f"{record['commit']}:docs/engineering-constitution/MASTER-CONTINUATION.md"],cwd=ROOT,text=True,encoding='utf-8')
    assert 'PROMPT A final exit gate — **COMPLETED**' in historical
    assert not (ROOT/'docs/engineering-constitution/MASTER-CONTINUATION.md').exists()


def test_prompt_b_removes_dead_browser_cli_executor_from_living_product_surface():
    assert not (ROOT/'plugin/src/opencode/browser-cli-adapter.ts').exists()
    assert not (ROOT/'plugin/test/b2-browser-executor.test.mjs').exists()
    services=(ROOT/'plugin/src/runtime/application/runtime-services.ts').read_text(encoding='utf-8')
    plugin=(ROOT/'plugin/src/plugin.ts').read_text(encoding='utf-8')
    assert 'PlaywrightBrowserAdapter' not in services and 'BrowserCliAdapter' not in services
    assert 'createBrowser:' in services and 'new PlaywrightBrowserAdapter' in plugin
    for rel in ['plugin/src','plugin/test']:
        for path in (ROOT/rel).rglob('*'):
            if path.is_file() and path.suffix in {'.ts','.mjs'}:
                text=path.read_text(encoding='utf-8',errors='ignore')
                assert 'agent-browser' not in text and 'BrowserCliAdapter' not in text


def test_prompt_b_baseline_is_bound_to_exact_starting_commit_and_hashes():
    d=json.loads((ROOT/'data/validation/zero-defect-baseline.json').read_text(encoding='utf-8'))
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
    source={path:path.read_text(encoding='utf-8',errors='ignore') for path in source_files}
    support=[]
    for base in [ROOT/'plugin/test',ROOT/'tests',ROOT/'scripts']:
        for path in base.rglob('*'):
            if path.is_file() and path.suffix in {'.mjs','.js','.ts','.py'}: support.append(path.read_text(encoding='utf-8',errors='ignore'))
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
    d=json.loads((ROOT/'data/validation/opencode-native-reevaluation.json').read_text(encoding='utf-8'))
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
    d=json.loads((ROOT/'data/validation/prompt-b-mission-task-worker.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_MISSION_TASK_WORKER_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==6 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':15,'covered':15,'violations':0}
    expected={'unique-identities','mission-ownership','task-dag-validity','worker-binding','no-ghost-workers','no-orphan-tasks','no-duplicate-completion','out-of-order-callback','stale-worker-result','task-cancellation','task-recovery','dependency-unblock','concurrent-write-safety','restart-reconstruction','terminal-state-correctness'}
    assert {x['invariant'] for x in d['invariants']}==expected
    for row in d['invariants']:
        owner=ROOT/row['owner']; proof=ROOT/row['proof']
        assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='ignore') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='ignore')
    assert any(x['id']=='ambiguous-native-session-callback-ownership' for x in d['closed_defects'])
    assert (ROOT/'scripts/audit-mission-task-worker.py').is_file()

def test_prompt_b_role_model_methodology_audit_keeps_semantic_planes_separate():
    d=json.loads((ROOT/'data/validation/prompt-b-role-model-methodology.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_ROLE_MODEL_METHODOLOGY_ADVERSARIAL_AUDIT' and d['section']==7 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':13,'covered':13,'violations':0}
    expected={'role-agent-model-methodology-separation','requested-selected-projected-observed-model','host-contradiction-handling','unknown-model-capability','model-fallback','methodology-available-admitted-selected-loaded','methodology-lazy-load','methodology-collision','methodology-exit','methodology-cannot-grant-authority','methodology-cannot-own-completion','role-permissions-mechanically-projected','prompt-persona-cannot-override-policy'}
    assert {x['invariant'] for x in d['invariants']}==expected
    assert d['static_guards']=={'methodology_forbidden_owner_imports':[],'skill_boundary_missing':[],'skill_control_plane_claims':[],'role_markdown_mechanical_owners':[],'skill_count':27}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof']
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='ignore') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='ignore')
    assert (ROOT/'scripts/audit-role-model-methodology.py').is_file()

def test_prompt_b_authority_permission_external_action_audit_is_structured_fail_closed_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-authority-permission-external-action.json').read_text(encoding='utf-8'))
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
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='ignore') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='ignore')
    closed={x['id'] for x in d['closed_defects']}
    assert {'natural-language-regex-owned-authority','stale-one-shot-approval','destructive-irreversible-secret-boundaries'}<=closed
    assert (ROOT/'scripts/audit-authority-permission-external-action.py').is_file()

def test_prompt_b_evidence_verification_completion_audit_is_source_bound_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-evidence-verification-completion.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_EVIDENCE_VERIFICATION_COMPLETION_HOSTILE_AUDIT' and d['program']=='PROMPT_B' and d['section']==9 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':12,'covered':12,'violations':0}
    expected={'evidence-scope','evidence-freshness','source-revision','changed-file-ownership','mutation-invalidation','not-run-not-passed','worker-result-not-evidence','project-methodology-learning-not-evidence','context-artifact-not-evidence','review-disposition','required-evidence-coverage','completion-obligation-reconciliation'}
    assert {x['invariant'] for x in d['invariants']}==expected
    assert d['static_guards']=={'project_intelligence_evidence_owner_paths':[],'context_evidence_owner_paths':[],'worker_result_is_mission_evidence_owner':False}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256'];assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='ignore') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='ignore')
    assert {'reviewer-done-auto-pass-evidence','worker-pass-without-source-state'}<={x['id'] for x in d['closed_defects']}
    assert (ROOT/'scripts/audit-evidence-verification-completion.py').is_file()

def test_prompt_b_context_project_learning_audit_is_consumer_bound_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-context-project-intelligence-compression.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_CONTEXT_PROJECT_LEARNING_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==10 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':12,'covered':12,'violations':0}
    expected={'context-consumer-binding','unknown-context-handle-fail-close','stale-context-exclusion','durable-artifact-source-provenance','durable-artifact-consumer-binding','durable-artifact-freshness-invalidation','artifact-privacy-boundary','mission-runtime-projection-bounded','provider-duplicate-pruning-state-bound','project-methodology-learning-evidence-binding','project-methodology-independent-readiness','context-project-learning-not-evidence'}
    assert {x['invariant'] for x in d['invariants']}==expected
    assert d['static_guards']=={'project_methodology_learning_evidence_owner_paths':[],'context_evidence_owner_paths':[],'general_project_intelligence_retrieval_present':False,'compression_subsystem_present':False}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256'];assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='ignore') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='ignore')
    assert (ROOT/'scripts/audit-context-project-intelligence-compression.py').is_file()


def test_prompt_b_process_workspace_browser_lifecycle_audit_is_complete_and_source_equivalent():
    d=json.loads((ROOT/'data/validation/prompt-b-process-workspace-browser-lifecycle.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_PROCESS_WORKSPACE_BROWSER_LIFECYCLE_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['sections']==[12,13,14] and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':61,'covered':61,'violations':0,'by_section':{'12':{'required':23,'covered':23},'13':{'required':24,'covered':24},'14':{'required':14,'covered':14}}}
    expected_counts={12:23,13:24,14:14}
    assert {k:sum(1 for x in d['invariants'] if x['section']==k) for k in expected_counts}==expected_counts
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof']
        assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace')
        assert row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    eq=d['capability_source_equivalence'];assert set(eq)=={'process-lifecycle','workspace-isolation-binding','browser-execution'}
    assert all(x['status']=='SUPPORTED_T3' and x['equivalent'] is True and x['runtime_hash_drift']==[] for x in eq.values())
    closed={x['id'] for x in d['closed_defects']}
    assert {'browser-cross-execution-owner-state-leak','workspace-forged-isolation-decision','process-kill-failure-false-termination','process-group-unverified-signal','duplicate-active-workspace-identity'}<=closed


def test_prompt_b_human_decision_adversarial_audit_is_complete_and_hash_bound():
    d=json.loads((ROOT/'data/validation/prompt-b-human-decision.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_HUMAN_DECISION_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==15 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':15,'covered':15,'violations':0}
    assert len(d['invariants'])==15 and len({x['invariant'] for x in d['invariants']})==15
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    closed={x['id'] for x in d['closed_defects']}
    assert {'idle-human-decision-authority-reclassification','authority-request-semantic-coherence','reason-label-authority-inference'}<=closed

def test_prompt_b_persistence_concurrency_audit_is_strict_fail_closed_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-persistence-concurrency.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_PERSISTENCE_CONCURRENCY_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['sections']==[16,17] and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':31,'covered':31,'violations':0,'by_section':{'16':{'required':19,'covered':19},'17':{'required':12,'covered':12}}}
    assert len(d['invariants'])==31 and {x['section'] for x in d['invariants']}=={16,17}
    for row in d['invariants']:
        for key in ('owner','proof'):
            rel=row[key];assert (ROOT/rel).is_file();assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==row[f'{key}_sha256']
        assert row['owner_anchor'] in (ROOT/row['owner']).read_text(encoding='utf-8',errors='replace')
        assert row['proof_anchor'] in (ROOT/row['proof']).read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    closed={x['id'] for x in d['closed_defects']}
    assert {'duplicate-persisted-mission-replay','waiting-user-unclean-restart-gap','malformed-current-runtime-envelope','cancelled-worker-late-result-resurrection','permission-reply-before-ask-phantom-wait'}<=closed
    assert (ROOT/'scripts/audit-persistence-concurrency.py').is_file()

def test_prompt_b_vcs_path_portability_audit_is_bounded_and_source_bound():
    d=json.loads((ROOT/'data/validation/prompt-b-vcs-path-portability.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_VCS_PATH_PORTABILITY_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['sections']==[18,19] and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':31,'covered':31,'violations':0,'by_section':{'18':{'required':13,'covered':13},'19':{'required':18,'covered':18}}}
    assert len(d['invariants'])==31 and {x['section'] for x in d['invariants']}=={18,19}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    assert {'unbounded-repository-path-identity','browser-host-user-cache-literal','browser-stale-spa-route-observation'}<={x['id'] for x in d['closed_defects']}
    assert (ROOT/'scripts/audit-vcs-path-portability.py').is_file()


@pytest.mark.evidence
def test_prompt_b_security_privacy_audit_is_fail_closed_source_bound_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-security-privacy.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_SECURITY_PRIVACY_ADVERSARIAL_AUDIT' and d['section']==20 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':20,'covered':20,'violations':0}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    security=(ROOT/'docs/SECURITY-MODEL.md').read_text(encoding='utf-8')
    assert '## Trust boundaries' in security and 'host denial is authoritative' in security


def test_prompt_b_skills_methodology_security_audit_is_confined_trust_bounded_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-skills-methodology-security.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_SKILLS_METHODOLOGY_SECURITY_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==21 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':13,'covered':13,'violations':0}
    assert len(d['invariants'])==13 and len({x['invariant'] for x in d['invariants']})==13
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    assert d['state_separation']==['installed skill','admitted methodology','selected methodology','loaded methodology']
    assert {'skill-discovery-symlink-escape','repo-provenance-silent-skill-trust','project-methodology-artifact-symlink-escape'}<={x['id'] for x in d['closed_defects']}
    assert (ROOT/'scripts/audit-skills-methodology-security.py').is_file()


def test_prompt_b_host_port_portability_audit_is_host_agnostic_source_bound_and_complete():
    d=json.loads((ROOT/'data/validation/prompt-b-host-port-portability.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_HOST_PORT_PORTABILITY_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==22 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':11,'covered':11,'violations':0}
    assert len(d['invariants'])==11 and len({x['invariant'] for x in d['invariants']})==11
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    assert d['alternate_host_feasibility']['status']=='FEASIBLE_BY_PORT_CONTRACT_NOT_IMPLEMENTED'
    assert d['alternate_host_feasibility']['semantic_core_changes_required'] is False
    assert {'host-port-renamed-sdk-interface','runtime-event-controller-opencode-lifecycle-leak','task-runtime-opencode-client-leak','runtime-service-opencode-construction-leak','process-error-opencode-owner-leak','routing-provider-policy-opencode-owner-leak'}<={x['id'] for x in d['closed_defects']}
    assert (ROOT/'scripts/audit-host-port-portability.py').is_file()


@pytest.mark.evidence
def test_prompt_b_configuration_audit_covers_every_leaf_and_is_source_bound():
    d=json.loads((ROOT/'data/validation/prompt-b-configuration.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_CONFIGURATION_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==23 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':29,'covered':29,'violations':0,'runtime':26,'diagnostic':2,'schema_marker':1}
    assert len(d['leaves'])==29 and len({x['path'] for x in d['leaves']})==29
    for row in d['leaves']:
        for key in ('schema','consumer','documentation','proof'):
            path=ROOT/row[key];assert path.is_file();assert hashlib.sha256(path.read_bytes()).hexdigest()==row[f'{key}_sha256']
        assert row['consumer_anchor'] in (ROOT/row['consumer']).read_text(encoding='utf-8',errors='replace')
        assert f"`{row['path']}`" in (ROOT/row['documentation']).read_text(encoding='utf-8',errors='replace')
        assert row['validator'] and row['precedence_order'] and row['observable_effect']
    assert all(d['static_guards'].values())
    assert {'profile-unknown-config-injection','block-level-precedence-widening','project-routing-synthetic-default-override'}<={x['id'] for x in d['closed_defects']}
    assert (ROOT/'scripts/audit-configuration.py').is_file()


def test_prompt_b_cli_malformed_config_fails_closed_without_overwrite(tmp_path):
    cfg=tmp_path/'opencode.json';original='{broken json\n';cfg.write_text(original)
    for command in ('plan','install'):
        r=run(ROOT/'scripts/native_plugin_setup.py',command,tmp_path)
        assert r.returncode==2 and r.stderr==''
        out=json.loads(r.stdout);assert out['status']=='BLOCKED' and out['reason']=='invalid-json-input'
        assert out['path']==str(cfg) and out['action'] and 'will not overwrite' in out['action']
        assert 'Traceback' not in r.stdout and cfg.read_text(encoding='utf-8')==original


def test_prompt_b_cli_jsonc_plan_is_truthful_actionable_and_non_mutating(tmp_path):
    cfg=tmp_path/'opencode.jsonc';original='// comment\n{"plugin":[]}\n';cfg.write_text(original)
    r=run(ROOT/'scripts/native_plugin_setup.py','plan',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and r.stderr=='' and out['status']=='BLOCKED'
    assert out['reason']=='jsonc-safe-mutation-not-supported' and 'JSONC' in out['action']
    assert cfg.read_text(encoding='utf-8')==original and 'Traceback' not in r.stdout


def test_prompt_b_cli_reconfigure_rejects_out_of_range_and_malformed_limits(tmp_path):
    bad=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--parallel-max','-4')
    assert bad.returncode==2 and bad.stdout=='' and 'parallel-max must be in 1..8' in bad.stderr and 'Traceback' not in bad.stderr
    malformed=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--provider-limit','nope')
    out=json.loads(malformed.stdout);assert malformed.returncode==2 and malformed.stderr==''
    assert out['status']=='BLOCKED' and out['reason']=='invalid-concurrency-limit' and out['action']
    assert not (tmp_path/'.opencode/hi/policy/routing.json').exists()


def test_prompt_b_cli_first_run_doctor_supplies_recovery_action(tmp_path):
    r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='FAIL' and 'hi-plugin-not-registered' in out['issues']
    assert any('plan' in x and 'install' in x for x in out['actions'])
    assert 'Traceback' not in r.stdout+r.stderr


@pytest.mark.evidence
def test_prompt_b_cli_developer_tooling_ux_audit_is_actionable_bounded_and_source_bound():
    d=json.loads((ROOT/'data/validation/prompt-b-cli-developer-tooling-ux.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_CLI_DEVELOPER_TOOLING_UX_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==24 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':11,'covered':11,'violations':0}
    assert d['ux_contract']==['specific','actionable','truthful','bounded']
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    assert {'malformed-opencode-config-silent-overwrite-risk','reconfigure-invalid-limit-accepted','blocked-plan-missing-recovery-guidance'}<={x['id'] for x in d['closed_defects']}


def test_prompt_b_publishable_package_carries_setup_cli_and_direct_runtime_dependency_contract():
    pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    assert pkg['bin']=={'opencode-hi-setup':'scripts/native_plugin_setup.py'}
    assert {'plugin/dist','skills','scripts/native_plugin_setup.py','VERSION'}<=set(pkg['files'])
    assert pkg['peerDependencies']['@opencode-ai/plugin']=='1.18.18'
    assert pkg['dependencies']['@opencode-ai/sdk']=='1.18.18'
    assert pkg['optionalDependencies']['playwright-core']=='1.62.1'
    setup=ROOT/'scripts/native_plugin_setup.py'
    if os.name=='nt':
        mode=subprocess.check_output(['git','ls-files','-s','--','scripts/native_plugin_setup.py'],cwd=ROOT,text=True).split()[0]
        assert mode=='100755'
    else:
        assert setup.stat().st_mode & 0o111


@pytest.mark.evidence
def test_prompt_b_install_update_lifecycle_audit_is_complete_source_bound_and_truthful():
    d=json.loads((ROOT/'data/validation/prompt-b-install-update-lifecycle.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_INSTALL_UPDATE_LIFECYCLE_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==25 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':14,'covered':14,'violations':0}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    assert {'lifecycle-missing-reinstall','packed-setup-cli-missing','root-runtime-dependency-contract-missing'}<={x['id'] for x in d['closed_defects']}
    assert 'does not claim npm publication' in d['claim_boundary']


def test_prompt_b_packed_setup_fresh_consumer_smoke_is_real_tarball_bound():
    d=json.loads((ROOT/'data/validation/packed-setup-smoke-0.1.0.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PACKED_SETUP_FRESH_CONSUMER_SMOKE' and d['release']=='0.1.0' and d['status']=='PASS'
    assert d['tarball']['all_required_present'] is True and d['tarball']['setup_mode']=='0o755' and d['tarball']['file_count']>300
    assert d['fresh_consumer']['install_rc']==0 and d['fresh_consumer']['setup_bin_present'] is True and d['fresh_consumer']['setup_help_rc']==0 and d['fresh_consumer']['setup_help_has_commands'] is True
    assert d['fresh_consumer']['module_import_output']=='function'
    assert d['fresh_consumer']['module_import_rc']==0 or d['fresh_consumer']['module_import_teardown_noise'] is True
    assert 'exact OpenCode material runtime execution belongs to PROMPT B section 26' in d['claim_boundary']
    assert (ROOT/'scripts/run-packed-setup-smoke.py').is_file()


@pytest.mark.evidence
def test_prompt_b_packaging_fresh_consumer_audit_is_exact_host_and_source_tree_independent():
    d=json.loads((ROOT/'data/validation/prompt-b-packaging-fresh-consumer.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_PACKAGING_FRESH_CONSUMER_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==26 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':8,'covered':8,'violations':0}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    a=json.loads((ROOT/d['acceptance_receipt']).read_text(encoding='utf-8'));assert a['status']=='PASS' and a['host']['opencode']=='1.18.18' and a['host']['platform']=='linux' and a['host']['architecture']=='aarch64' and re.fullmatch(r'[a-f0-9]{64}',a['host']['binary_sha256'])
    assert a['checks']['consumer_resolution'] is True and a['checks']['no_source_tree_in_server_log'] is True
    assert a['material_runtime']['hi_tool_count']>=10 and {'hi_doctor','hi_status','hi_task_start'}<=set(a['material_runtime']['hi_tools'])
    assert a['material_runtime']['provider_run']['attempted'] is False


@pytest.mark.evidence
def test_prompt_b_dependency_supply_chain_license_audit_is_dual_lock_integrity_and_license_bound():
    d=json.loads((ROOT/'data/validation/prompt-b-dependency-supply-chain-license.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_DEPENDENCY_SUPPLY_CHAIN_LICENSE_AUDIT' and d['program']=='PROMPT_B' and d['section']==27 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':8,'covered':8,'violations':0}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())
    assert {'publishable-root-lock-missing','third-party-notices-runtime-drift','release-pack-proof-prepack-output-corruption','single-lock-sbom-omitted-distribution-runtime'}<={x['id'] for x in d['closed_defects']}
    root_lock=json.loads((ROOT/'package-lock.json').read_text(encoding='utf-8'));plugin_lock=json.loads((ROOT/'plugin/package-lock.json').read_text(encoding='utf-8'))
    assert root_lock['lockfileVersion']==3 and plugin_lock['lockfileVersion']==3


@pytest.mark.evidence
def test_prompt_b_release_engineering_closes_t4_only_from_real_current_publication_evidence():
    d=json.loads((ROOT/'data/validation/prompt-b-release-engineering.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_RELEASE_ENGINEERING_AUDIT' and d['section']==28 and d['violations']==[]
    pub_path=ROOT/f'data/validation/release-publication-{V}.json'
    if pub_path.exists():
        assert d['status']=='CLOSED_T4' and d['summary']=={'stages':13,'local_pass_or_historical':13,'blocked_external_or_identity':0,'violations':0}
        assert all(d['checks'].values()) and d['release_source']['tag']==f'v{V}'
        pub=json.loads(pub_path.read_text(encoding='utf-8'))
        assert pub['status']=='PASS_T4' and pub['github_release']['status']=='PASS_T4' and pub['npm_registry']['status']=='PASS_T4' and pub['fresh_registry_consumer']['status']=='PASS_T4'
        assert d['registry_observation']['view']=='PUBLISHED_T4' and d['registry_observation']['publish_attempted'] is True
    else:
        assert d['status']=='CLOSED_LOCAL_T4_BLOCKED' and d['summary']=={'stages':13,'local_pass_or_historical':8,'blocked_external_or_identity':5,'violations':0}
        assert d['registry_observation']['view']=='PREPUBLICATION' and d['registry_observation']['publish_attempted'] is False
        assert d['release_source']['tag'] is None
    assert d['historical_release']['tag']=='v0.1.0' and d['historical_release']['github_status']=='PASS_T4'
    assert d['registry_observation']['authority_granted'] is True and d['registry_observation']['authority_condition']=='effective only after all engineering/final certification completes'
    for rel,digest in d['proof_hashes'].items():assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==digest


@pytest.mark.evidence
def test_prompt_b_documentation_defect_cycle_requires_owner_impact_projection_and_lint():
    d=json.loads((ROOT/'data/validation/prompt-b-documentation-defect-cycle.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_DOCUMENTATION_DEFECT_CYCLE_AUDIT' and d['section']==29 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':5,'covered':5,'violations':0}
    assert [x['step'] for x in d['cycle']]==['source-change','tests','docs-owner-impact-check','generated-parity-update','doc-lint']
    for row in d['cycle']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256'];assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    assert all(d['static_guards'].values())


@pytest.mark.evidence
def test_prompt_b_test_suite_audit_is_isolated_bounded_and_never_promotes_mock_t3():
    d=json.loads((ROOT/'data/validation/prompt-b-test-suite-audit.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_TEST_SUITE_ADVERSARIAL_AUDIT' and d['program']=='PROMPT_B' and d['section']==30 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':11,'covered':11,'violations':0}
    assert all(d['static_guards'].values())
    assert d['conditional_skips']=={'python_windows_symlink_privilege':4,'node_windows_posix_hosted_release':1,'silent_only_or_todo':0}
    assert {'cwd-sensitive-test-root','test-suite-real-home-state-pollution','unbounded-test-runner-timeout','mock-runtime-self-promoted-t3'}<={x['id'] for x in d['closed_defects']}
    for row in d['invariants']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    h=json.loads((ROOT/d['harness_acceptance']).read_text(encoding='utf-8'))
    assert h['status']=='PASS' and h['source_binding']['tested_git_commit']=='5210a12a7b607e0c9048749fa74a4c8b801cd924'
    assert h['canonical_suite_observation']=={'tests':816,'pass':816,'fail':0,'cancelled':0,'home_hi_state_before':5301,'home_hi_state_after':5301,'home_hi_state_delta':0}
    assert all(h['cwd_dual_run'][k]['tests']==17 and h['cwd_dual_run'][k]['pass']==17 and h['cwd_dual_run'][k]['fail']==0 for k in ('plugin_cwd','repo_root_cwd'))
    compat=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text(encoding='utf-8'))
    for cap in ('process-lifecycle','workspace-isolation-binding','browser-execution'):
        current=compat['current_reference_host']['capabilities'][cap];assert current['status']=='SUPPORTED_T3'
        assert subprocess.run(['git','merge-base','--is-ancestor','5210a12a7b607e0c9048749fa74a4c8b801cd924',current['tested_git_commit']],cwd=ROOT).returncode==0



def test_prompt_b_mutation_testing_kills_all_critical_mutants_without_compile_only_credit():
    d=json.loads((ROOT/'data/validation/prompt-b-mutation-testing.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_MUTATION_TESTING_AUDIT' and d['program']=='PROMPT_B' and d['section']==31 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required_areas':9,'configured_mutants':15,'killed_mutants':15,'survived_mutants':0,'compile_only_kills':0,'violations':0}
    required={'authority_deny_allow','completion_evidence','permission_monotonicity','owner_uniqueness','stale_evidence','path_confinement','restart_schema_rejection','config_executable_effect','capability_support_truth'}
    assert set(d['required_areas'])==required and all(d['static_guards'].values())
    assert len(d['mutants'])==15 and len({x['id'] for x in d['mutants']})==15
    assert all(x['status']=='KILLED_BY_INVARIANT_TEST' for x in d['mutants'])
    a=json.loads((ROOT/d['acceptance_receipt']).read_text(encoding='utf-8'))
    assert a['status']=='PASS' and a['summary']=={'configured':15,'killed':15,'survived':0,'compile_only_kills':0}
    for rel,digest in d['proof_hashes'].items():assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==digest


def test_prompt_b_property_fuzz_testing_is_bounded_reproducible_and_source_bound():
    d=json.loads((ROOT/'data/validation/prompt-b-property-fuzz-testing.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_PROPERTY_FUZZ_TESTING_AUDIT' and d['program']=='PROMPT_B' and d['section']==32 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required_areas':9,'covered_areas':9,'generated_cases':864,'violations':0}
    assert all(d['static_guards'].values())
    expected={'ids','paths','schemas','event-ordering','host-observations','config','decision-payloads','tool-outputs','persistence-envelopes'}
    assert {x['area'] for x in d['areas']}==expected and len(d['areas'])==9
    for row in d['areas']:
        owner=ROOT/row['owner'];proof=ROOT/row['proof'];assert owner.is_file() and proof.is_file()
        assert hashlib.sha256(owner.read_bytes()).hexdigest()==row['owner_sha256']
        assert hashlib.sha256(proof.read_bytes()).hexdigest()==row['proof_sha256']
        assert row['owner_anchor'] in owner.read_text(encoding='utf-8',errors='replace') and row['proof_anchor'] in proof.read_text(encoding='utf-8',errors='replace')
    a=json.loads((ROOT/d['acceptance_receipt']).read_text(encoding='utf-8'))
    assert a['status']=='PASS' and a['source_binding']=={'tested_git_commit':'6fe74d7786e25cb6894ddca7d4408a17220cc936','tested_git_tree':'3bf72be8b22082a720f2fa6aa271d56b100e5528'}
    assert a['configuration']['seeds_hex']==['0x00c0ffee','0x5eed1234','0x000a11ce'] and a['configuration']['cases_per_seed']==32 and a['configuration']['generated_cases']==864
    assert a['terminal']=={'tests':9,'pass':9,'fail':0,'cancelled':0,'skipped':0,'todo':0} and a['failures']==[]
    case=json.loads((ROOT/'data/validation/property-fuzz-failures/persistence-envelopes-seed-c0ffee-case-0.json').read_text(encoding='utf-8'))
    assert case['kind']=='PROPERTY_FUZZ_HISTORICAL_REGRESSION_CASE' and case['observed_before_fix']=='accepted-malformed-persisted-mission' and case['expected']=='reject-malformed-persisted-mission'


def test_prompt_b_replay_testing_detects_semantic_drift_across_all_required_surfaces():
    d=json.loads((ROOT/'data/validation/prompt-b-replay-testing.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_REPLAY_TESTING_AUDIT' and d['program']=='PROMPT_B' and d['section']==33 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required_surfaces':5,'covered_surfaces':5,'cases':28,'nondeterministic_drift':0,'violations':0}
    assert d['surface_counts']=={'semantic_routing':5,'worker_scheduling':5,'host_events':5,'completion':5,'recovery':8} and all(d['static_guards'].values())
    a=json.loads((ROOT/d['acceptance_receipt']).read_text(encoding='utf-8'))
    assert a['status']=='PASS' and a['source_binding']=={'tested_git_commit':'bca552865d060d41a629199ae9552a000324a7b2','tested_git_tree':'5ada6731d3b0d15219eb5b37f0dbd44c6b4f21f1'}
    assert a['nondeterministic_semantic_drift'] is False and a['first_pass_digest']==a['second_pass_digest'] and a['mismatches']==[] and a['total_cases']==28
    for rel,digest in {**a['inputs'],**a['owner_hashes']}.items():assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==digest
    for rel,digest in d['proof_hashes'].items():assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==digest



def test_prompt_b_failure_injection_is_complete_bounded_and_terminal():
    d=json.loads((ROOT/'data/validation/prompt-b-failure-injection.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_FAILURE_INJECTION_AUDIT' and d['program']=='PROMPT_B' and d['section']==34 and d['status']=='PASS'
    assert d['violations']==[] and d['summary']=={'required':12,'covered':12,'violations':0} and all(d['static_guards'].values())
    expected=['provider-timeout','model-unavailable','rate-limit','tool-error','permission-deny','process-crash','workspace-failure','disk-write-failure','corrupt-state','child-session-failure','browser-failure','network-failure']
    assert d['required_injections']==expected
    a=json.loads((ROOT/d['acceptance_receipt']).read_text(encoding='utf-8'))
    assert a['status']=='PASS' and a['source_binding']=={'tested_git_commit':'29d3024fb3640a97f244185a393eb133542fb735','tested_git_tree':'e685a589dcd06e8a300421b84cbad8fedb616222'}
    assert a['terminal']=={'tests':54,'pass':54,'fail':0,'cancelled':0,'skipped':0,'todo':0}
    assert a['summary']=={'required':12,'covered':12,'violations':0} and a['violations']==[] and a['bounded_recovery']['no_infinite_retry'] is True
    assert [x['injection'] for x in a['injections']]==expected and all(x['status']=='PASS' for x in a['injections'])
    for row in a['injections']:
        p=ROOT/row['proof'];assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==row['proof_sha256'] and row['proof_anchor'] in p.read_text(encoding='utf-8',errors='replace')



def test_prompt_b_performance_resource_benchmarks_measure_all_required_paths_without_fake_token_truth():
    d=json.loads((ROOT/'data/validation/prompt-b-performance-resource-benchmarks.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_PERFORMANCE_RESOURCE_BENCHMARK_AUDIT' and d['program']=='PROMPT_B' and d['section']==35 and d['status']=='PASS'
    required=['startup','task_initialization','skill_discovery_cache','pi_retrieval','context_build','persistence','scheduling','process_output','memory_growth','token_usage']
    assert d['required_metrics']==required and d['summary']=={'required':10,'covered':10,'violations':0} and d['violations']==[] and all(d['static_guards'].values())
    b=json.loads((ROOT/d['benchmark_receipt']).read_text(encoding='utf-8'))
    assert b['status']=='PASS' and b['source_binding']=={'tested_git_commit':'317a0922c0c51f766a0d6bf22036e5d027330835','tested_git_tree':'a9223da1ecf23426bb8a919e4cf058ccbd6a122a'}
    assert list(b['metrics'])==required
    assert all(b['metrics'][k]['status']=='PASS' for k in required if k!='skill_discovery_cache')
    assert b['metrics']['skill_discovery_cache']['cold']['status']=='PASS' and b['metrics']['skill_discovery_cache']['cached']['status']=='PASS' and b['metrics']['skill_discovery_cache']['full_scans']==1
    assert b['metrics']['process_output']['max_buffered_chars']==256*1024 and b['metrics']['process_output']['max_read_chars']==64*1024
    assert b['metrics']['token_usage']['provider_observed']['confidence']=='exact' and b['metrics']['token_usage']['provider_observed']['source']=='provider-usage'
    assert b['metrics']['token_usage']['estimated']['confidence']=='estimated' and b['metrics']['token_usage']['estimated']['source']=='estimated'
    assert b['optimization_decision']=='NO_NEW_SCHEDULER_OR_WORK_STEALING_COMPLEXITY_WITHOUT_MEASURED_BENEFIT'


def test_prompt_b_user_journey_acceptance_covers_all_required_scenarios():
    d=json.loads((ROOT/'data/validation/prompt-b-user-journey-acceptance.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_USER_JOURNEY_ACCEPTANCE_AUDIT' and d['program']=='PROMPT_B' and d['section']==36 and d['status']=='PASS'
    assert d['summary']=={'required':7,'covered':7,'violations':0} and d['violations']==[]
    assert d['required_scenarios']==['small-task','medium-feature','complex-mission','failure','authority','unsupported','restart']
    a=json.loads((ROOT/d['acceptance_receipt']).read_text(encoding='utf-8'))
    assert a['status']=='PASS' and a['source_binding']=={'tested_git_commit':'69fa226d9df0dc44010d7ba69d58b0f5ab477175','tested_git_tree':'36e99a925d25c19c65dff8cfba8ed17dc414a9df'}
    assert a['terminal']=={'tests':7,'pass':7,'fail':0,'cancelled':0,'skipped':0,'todo':0}
    assert hashlib.sha256((ROOT/a['proof']).read_bytes()).hexdigest()==a['proof_sha256']


@pytest.mark.evidence
def test_prompt_b_developer_journey_acceptance_has_obvious_single_owners():
    d=json.loads((ROOT/'data/validation/prompt-b-developer-journey-acceptance.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_DEVELOPER_JOURNEY_ACCEPTANCE_AUDIT' and d['program']=='PROMPT_B' and d['section']==37 and d['status']=='PASS'
    assert d['summary']=={'required':4,'covered':4,'violations':0} and d['violations']==[]
    assert d['required_journeys']==['add-config','add-methodology','add-host-adapter-behavior','add-validation-rule']
    a=json.loads((ROOT/d['acceptance_receipt']).read_text(encoding='utf-8'))
    assert a['status']=='PASS'
    binding=a['source_binding']; commit=binding['tested_git_commit']; tree=binding['tested_git_tree']
    assert subprocess.run(['git','merge-base','--is-ancestor',commit,'HEAD'],cwd=ROOT).returncode==0
    assert subprocess.check_output(['git','rev-parse',f'{commit}^{{tree}}'],cwd=ROOT,text=True).strip()==tree
    assert a['terminal']=={'tests':4,'pass':4,'fail':0,'cancelled':0,'skipped':0,'todo':0}
    assert hashlib.sha256((ROOT/a['proof']).read_bytes()).hexdigest()==a['proof_sha256']


def test_prompt_b_cross_platform_acceptance_is_fail_closed_and_evidence_bound():
    d=json.loads((ROOT/'data/validation/prompt-b-cross-platform-acceptance.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_CROSS_PLATFORM_ACCEPTANCE_AUDIT' and d['program']=='PROMPT_B' and d['section']==38
    assert d['summary']['required_surfaces']==7 and d['summary']['covered_surfaces']==7
    assert d['windows_historical_release_evidence'] is True
    assert d['acceptance_receipt']==f'data/validation/cross-platform-acceptance-{V}.json'
    receipt=ROOT/d['acceptance_receipt']
    if d['status']=='PASS':
        assert receipt.is_file(); a=json.loads(receipt.read_text(encoding='utf-8'))
        assert a['kind']=='PROMPT_B_CROSS_PLATFORM_CURRENT_SOURCE_CI_ACCEPTANCE' and a['status']=='PASS'
        binding=a['source_binding']; commit=binding['tested_git_commit']; tree=binding['tested_git_tree']
        assert subprocess.check_output(['git','rev-parse',f'{commit}^{{tree}}'],cwd=ROOT,text=True).strip()==tree
        ga=a['github_actions']; assert ga['status']=='completed' and ga['conclusion']=='success'
        assert ga['ubuntu']['status']=='completed' and ga['ubuntu']['conclusion']=='success'
        assert ga['windows']['status']=='completed' and ga['windows']['conclusion']=='success'
        assert d['violations']==[] and d['post_ci_material_drift']==[]
        assert d['linux_current_certified'] is True and d['windows_current_certified'] is True
    else:
        assert d['status']=='FAIL' and d['violations']
        assert d['linux_current_certified'] is False and d['windows_current_certified'] is False
        if receipt.exists(): assert json.loads(receipt.read_text(encoding='utf-8')).get('status')!='PASS'


@pytest.mark.evidence
def test_prompt_b_exact_current_opencode_t3_is_fresh_source_bound_and_not_inferred_from_api_presence():
    d=json.loads((ROOT/'data/validation/prompt-b-exact-current-opencode-t3.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_EXACT_CURRENT_OPENCODE_T3_AUDIT' and d['program']=='PROMPT_B' and d['section']==39 and d['status']=='PASS'
    assert d['summary']=={'required_capabilities':3,'exact_current_capabilities':3,'lifecycle_invariants':61,'violations':0} and d['violations']==[]
    assert re.fullmatch(r'[a-f0-9]{40}',d['exact_source_commit']) and re.fullmatch(r'[a-f0-9]{40}',d['exact_source_tree'])
    assert d['candidate_release']==(ROOT/'VERSION').read_text(encoding='utf-8').strip()
    obs=d['current_version_observation'];assert obs['tested_binary_version']=='1.18.18' and re.fullmatch(r'[a-f0-9]{64}',obs['tested_binary_sha256']) and isinstance(obs['registry_opencode_latest'],(str,type(None))) and isinstance(obs['registry_sdk_latest'],(str,type(None))) and obs['locked_sdk']=='1.18.18'
    fresh=json.loads((ROOT/d['fresh_consumer_receipt']).read_text(encoding='utf-8'));assert fresh['status']=='PASS' and fresh['source']['commit']==d['exact_source_commit'] and fresh['package']['release']==d['candidate_release']
    assert {x['status'] for x in d['capabilities'].values()}=={'SUPPORTED_T3'}
    assert d['capability_evidence_mode']=='CURRENT_EXACT_HOST_PACKAGE_PLUS_RUNTIME_EQUIVALENT_EXACT_T3'
    assert all(x['runtime_equivalent_to_current'] is True and x['runtime_hash_drift']==[] and re.fullmatch(r'[a-f0-9]{40}',x['receipt_source_commit']) for x in d['capabilities'].values())
    for row in d['capabilities'].values():assert hashlib.sha256((ROOT/row['receipt']).read_bytes()).hexdigest()==row['receipt_sha256']
    assert hashlib.sha256((ROOT/d['compatibility_projection']).read_bytes()).hexdigest()==d['compatibility_sha256']
    assert hashlib.sha256((ROOT/d['lifecycle_audit']).read_bytes()).hexdigest()==d['lifecycle_sha256']
    assert 'API presence alone is insufficient' in d['claim_boundary'] and 'never relabeled as current' in d['claim_boundary']


def test_prompt_b_zero_known_defect_loop_closes_every_recorded_finding_and_reaudits_adjacent_systems():
    d=json.loads((ROOT/'data/validation/prompt-b-zero-known-defect-loop.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_ZERO_KNOWN_DEFECT_CLOSURE_LOOP' and d['section']==40 and d['status']=='PASS'
    assert d['summary']['recorded_findings']==68 and d['summary']['unresolved_known_defects']==0 and d['summary']['adjacent_regression_pass']==93
    assert d['summary']['full_python_pass']==118 and d['summary']['full_node_pass']==848 and d['summary']['exact_t3_capabilities']==3 and d['summary']['lifecycle_invariants_pass']==61
    assert d['violations']==[] and len({x['id'] for x in d['defects']})==68
    assert {'npm-view-json-shape-verifier-drift','npm-postpublish-registry-read-after-write-race','post-t4-documentation-stale-publication-state','npm-packed-public-document-links-incomplete','windows-packed-doc-audit-npm-shim-resolution'}<={x['id'] for x in d['defects']}
    commit=d['source_checkpoint']['commit']
    for row in d['defects']:
        assert len(row['closure_pipeline'])==12
        assert git_blob_sha256(commit,row['regression_receipt'])==row['regression_receipt_sha256']


def test_prompt_b_hygiene_audit_has_no_source_package_or_generated_artifact_leakage():
    d=json.loads((ROOT/'data/validation/prompt-b-hygiene.json').read_text(encoding='utf-8'))
    assert d['schema']==1 and d['kind']=='PROMPT_B_HYGIENE_AUDIT' and d['section']==41 and d['status']=='PASS'
    assert len(d['checks'])==12 and all(d['checks'].values()) and d['violations']==[]
    commit=d['audited_source_commit']
    for rel,digest in d['proof_hashes'].items():assert git_blob_sha256(commit,rel)==digest


@pytest.mark.evidence
def test_prompt_b_final_certification_chain_is_truthful_coherent_and_tier_bound():
    f42=json.loads((ROOT/'data/validation/prompt-b-final-documentation-reaudit.json').read_text(encoding='utf-8'))
    assert f42['status']=='PASS' and f42['summary']['violations']==0 and f42['violations']==[]
    commit=f42['source_checkpoint']['commit']
    for row in f42['areas']:
        assert git_blob_sha256(commit,row['path'])==row['checkpoint_sha256']
        assert git_blob_oid(commit,row['path'])==row['checkpoint_blob_oid']
    f43=json.loads((ROOT/'data/validation/prompt-b-certification-evidence-tiers.json').read_text(encoding='utf-8'))
    assert f43['status']=='PASS' and len(f43['claims'])==7 and f43['violations']==[]
    f44=json.loads((ROOT/f'data/validation/final-system-certification-{V}.json').read_text(encoding='utf-8'))
    assert f44['status'] in {'PARTIAL','CERTIFIED'} and f44['known_defect_count']==0
    assert bool(f44['blockers']) == (f44['status']=='PARTIAL')
    assert not (ROOT/'docs/FINAL-SYSTEM-CERTIFICATION.md').exists()
    f45=json.loads((ROOT/'data/validation/prompt-b-certification-vocabulary.json').read_text(encoding='utf-8')); assert f45['status']=='PASS' and f45['current_label']==f44['status'] and f45['violations']==[]
    f46=json.loads((ROOT/'data/validation/prompt-b-final-product-quality.json').read_text(encoding='utf-8')); assert f46['status']=='PASS' and all(f46['checks'].values())
    f47=json.loads((ROOT/'data/validation/prompt-b-final-mandatory-state.json').read_text(encoding='utf-8')); assert f47['status']=='PASS' and all(f47['coherence'].values())
