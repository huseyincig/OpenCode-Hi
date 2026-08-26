from __future__ import annotations
import hashlib, importlib.util, json, os, subprocess, sys, zipfile,re
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
V=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
PKG=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
HOST_TARGET=PKG['dependencies']['@opencode-ai/sdk']
assert re.fullmatch(r'\d+\.\d+\.\d+',HOST_TARGET)
assert PKG['peerDependencies']['@opencode-ai/plugin']==HOST_TARGET

def run(*args):return subprocess.run([sys.executable,*map(str,args)],text=True,capture_output=True)
def load_module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);assert spec and spec.loader;spec.loader.exec_module(m);return m

def test_identity_is_hi():
    d=json.loads((ROOT/'data/product.json').read_text(encoding='utf-8'))
    assert d['product_name']=='OpenCode-Hi' and d['short_name']=='HI' and d['version']==V
    assert d['plugin_package']=='opencode-hi' and d['repository']=='https://github.com/huseyincig/OpenCode-Hi'

def test_root_git_package_contract():
    d=PKG; assert d['name']=='opencode-hi' and d['version']==V
    assert d['main']=='plugin/dist/plugin.js' and (ROOT/d['main']).is_file() and {'skills','scripts/native_plugin_setup.py','scripts/opencode-hi.mjs','VERSION','docs','.github/CONTRIBUTING.md','.github/SECURITY.md','.github/SUPPORT.md'}<=set(d['files'])
    assert d['bin']=={'opencode-hi':'scripts/opencode-hi.mjs','hi':'scripts/opencode-hi.mjs','opencode-hi-setup':'scripts/native_plugin_setup.py'}
    assert d['peerDependencies']['@opencode-ai/plugin']==HOST_TARGET
    assert d['dependencies']=={'@opencode-ai/sdk':HOST_TARGET}
    assert d['optionalDependencies']['playwright-core']=='1.62.1'

def test_root_is_product_clean():
    assert not any((ROOT/x).exists() for x in ['KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','HI.cmd','HI.sh','HI-VALIDATE.cmd','HI-RELEASE-PREP.cmd','README.tr.md','CONTRIBUTING.md','SECURITY.md'])
    docs={p.relative_to(ROOT/'docs').as_posix() for p in (ROOT/'docs').rglob('*.md')}
    assert docs=={'README.md','ARCHITECTURE.md','INSTALLATION.md','CONFIGURATION.md','SKILLS.md','HOSTS.md','HUMAN-DECISIONS.md','VERIFICATION.md','SECURITY-MODEL.md','RELEASE.md','locales/tr/README.md','locales/tr/CONFIGURATION.md'}
    assert not (ROOT/'docs/engineering-constitution').exists()
    ignore=(ROOT/'.gitignore').read_text(encoding='utf-8')
    assert '.project-docs/' in ignore
    for pattern in ['/AGENTS.md','/PROJECT_POLICY.md','/PROTOCOL.md','/ROADMAP.md','/TASKS.md','/agent-archive/']:
        assert pattern in ignore
    tracked=subprocess.check_output(['git','-c',f'safe.directory={ROOT}','ls-files','--','AGENTS.md','PROJECT_POLICY.md','PROTOCOL.md','ROADMAP.md','TASKS.md','agent-archive'],cwd=ROOT,text=True).splitlines()
    assert tracked==[]
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

def test_validate_passes():
    r=run(ROOT/'scripts/validate.py'); assert r.returncode==0,r.stdout+r.stderr

def test_validator_rejects_incomplete_dependency_lock_metadata(tmp_path):
    import shutil
    probe=tmp_path/'repo'
    shutil.copytree(ROOT,probe,ignore=shutil.ignore_patterns('node_modules','dist','.pytest_cache','__pycache__','.agent-work'))
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
    shutil.copytree(ROOT,probe,ignore=shutil.ignore_patterns('node_modules','dist','.pytest_cache','__pycache__','.agent-work'))
    leaked=probe/'plugin'/'.opencode'/'.hi'
    leaked.mkdir(parents=True,exist_ok=True)
    (leaked/'runtime-state.json').write_text('{}')
    r=subprocess.run([sys.executable,str(probe/'scripts/validate.py')],text=True,capture_output=True,cwd=probe)
    assert r.returncode!=0 and 'nested project-local runtime directory' in (r.stdout+r.stderr)

def test_validator_ignores_agent_work_research_state(tmp_path):
    import shutil
    probe=tmp_path/'repo'
    shutil.copytree(ROOT,probe,ignore=shutil.ignore_patterns('node_modules','dist','.pytest_cache','__pycache__','.agent-work'))
    retained=probe/'.agent-work'/'external'/'repos'/'reference'
    (retained/'.opencode').mkdir(parents=True,exist_ok=True)
    (retained/'historical-note.md').write_text('Hi Next\nfeature-ledger-09\n')
    dist=probe/'plugin'/'dist'; dist.mkdir(parents=True,exist_ok=True); (dist/'plugin.js').write_text('// fixture')
    r=subprocess.run([sys.executable,str(probe/'scripts/validate.py')],text=True,capture_output=True,cwd=probe)
    output=r.stdout+r.stderr
    assert '.agent-work/external/repos/reference/.opencode' not in output
    assert '.agent-work/external/repos/reference/historical-note.md' not in output

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
    assert {'package.json','package-lock.json','docs/locales/tr/README.md','plugin/package-lock.json','plugin/dist/plugin.js','docs/ARCHITECTURE.md','docs/INSTALLATION.md','docs/SKILLS.md','docs/VERIFICATION.md','.github/SECURITY.md','.github/CONTRIBUTING.md'}<=n
    manifest=json.loads((tmp_path/'dist'/f'RELEASE-MANIFEST-{V}.json').read_text(encoding='utf-8'))
    assert manifest['supply_chain']['dependency_locks']==['package-lock.json','plugin/package-lock.json']
    assert set(manifest['supply_chain']['dependency_lock_sha256'])=={'package-lock.json','plugin/package-lock.json'}
    assert re.fullmatch(r'[a-f0-9]{64}',manifest['supply_chain']['dependency_graph_sha256'])

    assert 'README.tr.md' not in n and 'WORK-STATE.md' not in n and 'KURULUM.md' not in n
    assert not {'AGENTS.md','PROJECT_POLICY.md','PROTOCOL.md','ROADMAP.md','TASKS.md'} & n
    assert not any(name.startswith('agent-archive/') for name in n)
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

def test_canonical_agent_sources_match_eleven_role_contracts():
    assert sorted(p.stem for p in (ROOT/'roles').glob('*.md'))==sorted(['working-manager','manager','coder','architect','repository-explorer','researcher','technical-writer','test-engineer','qa-reviewer','security-reviewer','visual-qa'])

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


def test_version_truth_is_semver_and_not_validator_hard_pinned_to_0_1_0():
    version=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
    assert re.fullmatch(r'(?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?',version)
    validator=(ROOT/'scripts/validate.py').read_text(encoding='utf-8')
    assert "VERSION must be 0.1.0" not in validator
    assert json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']==version
    assert json.loads((ROOT/'plugin/package.json').read_text(encoding='utf-8'))['version']==version


def test_direct_git_host_acceptance_archive_extraction_is_python311_compatible_and_traversal_safe(tmp_path):
    import importlib.util, io, tarfile, zipfile
    spec=importlib.util.spec_from_file_location('hi_direct_git_host',ROOT/'scripts/run-direct-git-host-acceptance.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    tar_path=tmp_path/'host.tar.gz'
    payload=b'opencode-binary'
    with tarfile.open(tar_path,'w:gz') as t:
        info=tarfile.TarInfo('opencode');info.size=len(payload);t.addfile(info,io.BytesIO(payload))
    tar_out=tmp_path/'tar-out';tar_out.mkdir();mod.safe_extract_tar(tar_path,tar_out)
    assert (tar_out/'opencode').read_bytes()==payload
    bad_tar=tmp_path/'bad.tar.gz'
    with tarfile.open(bad_tar,'w:gz') as t:
        info=tarfile.TarInfo('../escape');info.size=1;t.addfile(info,io.BytesIO(b'x'))
    with pytest.raises(RuntimeError,match='unsafe archive member path'):mod.safe_extract_tar(bad_tar,tar_out)
    zip_path=tmp_path/'host.zip'
    with zipfile.ZipFile(zip_path,'w') as z:z.writestr('opencode.exe',payload)
    zip_out=tmp_path/'zip-out';zip_out.mkdir();mod.safe_extract_zip(zip_path,zip_out)
    assert (zip_out/'opencode.exe').read_bytes()==payload
    bad_zip=tmp_path/'bad.zip'
    with zipfile.ZipFile(bad_zip,'w') as z:z.writestr('../escape',b'x')
    with pytest.raises(RuntimeError,match='unsafe archive member path'):mod.safe_extract_zip(bad_zip,zip_out)


def test_first_use_docs_are_npm_runner_first_and_truthful_about_publication_state():
    readme=(ROOT/'README.md').read_text(encoding='utf-8'); tr=(ROOT/'docs/locales/tr/README.md').read_text(encoding='utf-8'); arch=(ROOT/'docs/ARCHITECTURE.md').read_text(encoding='utf-8'); install=(ROOT/'docs/INSTALLATION.md').read_text(encoding='utf-8'); config=(ROOT/'docs/CONFIGURATION.md').read_text(encoding='utf-8'); tr_config=(ROOT/'docs/locales/tr/CONFIGURATION.md').read_text(encoding='utf-8')
    exact=f'opencode-hi@{V}'
    for text in (readme,tr,install,config,tr_config):
        assert exact in text
        assert 'npx --yes' in text
        assert 'git dep preparation failed' not in text
    combined=(readme+tr+install+config+tr_config).lower()
    assert 'normal user' in combined or 'normal kullanıcı' in combined
    published=(ROOT/f'data/validation/release-publication-{V}.json').is_file()
    if published:
        assert 'published' in combined or 'yayınlan' in combined
        assert 'trusted publishing' in combined and 'fresh-registry' in combined
    else:
        assert 'pre-publication' in combined or 'prepublication' in combined
    assert 'project-root `node_modules`' in readme or 'root `node_modules`' in readme
    assert 'npm run build:plugin' in readme+tr+install
    assert f'`{V}`' in readme
    assert 'ProcessContract' in arch and 'WorkspaceLease' in arch and 'BrowserObservation' in arch
    assert 'contains no raw stdout/stderr buffer' in arch


def test_role_models_cli_rejects_primary_role_model_assignment_and_accepts_child_roles(tmp_path):
    script=ROOT/'scripts/native_plugin_setup.py'
    project=tmp_path/'project';project.mkdir()
    for primary in ('manager','working-manager'):
        blocked=subprocess.run([sys.executable,str(script),'role-models',str(project),'--set',f'{primary}=provider/model','--policy','manual'],cwd=ROOT,text=True,capture_output=True)
        assert blocked.returncode==2
        out=json.loads(blocked.stdout)
        assert out['status']=='BLOCKED' and out['reason']=='role-model-primary-owned-by-opencode'
        assert primary in out['detail'] and 'OpenCode' in out['action']
    unknown=subprocess.run([sys.executable,str(script),'role-models',str(project),'--set','unknown=provider/model','--policy','manual'],cwd=ROOT,text=True,capture_output=True)
    assert unknown.returncode==2 and json.loads(unknown.stdout)['reason']=='unsupported-role-model'
    applied=subprocess.run([sys.executable,str(script),'role-models',str(project),'--set','coder=provider/code,provider/fallback','--policy','manual'],cwd=ROOT,text=True,capture_output=True,check=True)
    data=json.loads(applied.stdout)
    assert data['status']=='APPLIED' and data['roleModels']=={'coder':['provider/code','provider/fallback']}
    cfg=project/'.opencode/hi/policy/routing.json';raw=json.loads(cfg.read_text(encoding='utf-8'));raw['routing']['roleModels']['manager']=['provider/stale'];raw['routing']['roleModels']['unknown']=['provider/unknown'];cfg.write_text(json.dumps(raw),encoding='utf-8')
    printed=subprocess.run([sys.executable,str(script),'role-models',str(project),'--print'],cwd=ROOT,text=True,capture_output=True,check=True)
    current=json.loads(printed.stdout)
    assert current['roleModels']=={'coder':['provider/code','provider/fallback']}
    assert current['ignoredRoleModelRoles']==['manager','unknown']


def test_python_model_discovery_uses_plain_effective_opencode_inventory_without_catalog_fallback(monkeypatch):
    mod=load_module('native_plugin_setup_models',ROOT/'scripts/native_plugin_setup.py')
    calls=[]
    class Result:
        returncode=0
        stdout='\n'.join([f'provider/model-{i}' for i in range(1,13)])+'\n'
    def fake_run(argv,**kwargs):calls.append((argv,kwargs));return Result()
    monkeypatch.setattr(mod.subprocess,'run',fake_run)
    assert mod.discover_available_models()==[f'provider/model-{i}' for i in range(1,13)]
    assert calls[0][0]==['opencode','models','--pure']
    class Failed:
        returncode=1
        stdout=''
    monkeypatch.setattr(mod.subprocess,'run',lambda *a,**k:Failed())
    assert mod.discover_available_models()==[]


def test_python_recommended_defaults_defer_to_runtime_scoring_without_vendor_model_ids(tmp_path,monkeypatch):
    mod=load_module('native_plugin_setup_recommended',ROOT/'scripts/native_plugin_setup.py')
    monkeypatch.setattr(mod,'discover_available_models',lambda:['alpha/model-a','beta/model-b','vision/model-c'])
    out=mod.role_models(tmp_path,defaults=True,policy='recommended')
    assert out['status']=='DEFERRED' and out['reason']=='live-runtime-selection-required'
    assert out['roleModels']=={} and out['available_models_observed']==['alpha/model-a','beta/model-b','vision/model-c']
    assert 'hi_role_models' in out['action'] and 'never persisted as user preferences' in out['action']
    assert not (tmp_path/'.opencode/hi/policy/routing.json').exists()


def test_python_recommended_defaults_never_overwrite_existing_user_role_models(tmp_path,monkeypatch):
    mod=load_module('native_plugin_setup_existing',ROOT/'scripts/native_plugin_setup.py')
    cfg=tmp_path/'.opencode/hi/policy/routing.json';cfg.parent.mkdir(parents=True)
    original={'schema':1,'type':'hi-routing','routing':{'strategy':'quality','modelPolicy':'manual','roleModels':{'coder':['user/model']},'roleVariants':{},'adaptiveRoles':[]}}
    cfg.write_text(json.dumps(original,indent=2)+'\n',encoding='utf-8')
    monkeypatch.setattr(mod,'discover_available_models',lambda:['other/new-model'])
    before=cfg.read_text(encoding='utf-8');out=mod.role_models(tmp_path,defaults=True,policy='recommended')
    assert out['status']=='DEFERRED' and out['roleModels']=={'coder':['user/model']}
    assert cfg.read_text(encoding='utf-8')==before


def test_python_manual_role_model_chain_is_not_arbitrarily_capped_at_seven(tmp_path):
    script=ROOT/'scripts/native_plugin_setup.py';models=[f'provider/model-{i}' for i in range(1,13)]
    r=run(script,'role-models',tmp_path,'--set','coder='+','.join(models),'--policy','manual');out=json.loads(r.stdout)
    assert r.returncode==0 and out['roleModels']['coder']==models


def test_configuration_guide_covers_supported_variations_and_is_readme_linked():
    readme=(ROOT/'README.md').read_text(encoding='utf-8')
    guide=(ROOT/'docs/CONFIGURATION.md').read_text(encoding='utf-8')
    guide_tr=(ROOT/'docs/locales/tr/CONFIGURATION.md').read_text(encoding='utf-8')
    assert '[Configuration Guide](docs/CONFIGURATION.md)' in readme
    assert 'OpenCode-Hi Türkçe Kurulum ve Yapılandırma Rehberi' in guide_tr
    for platform in ['Windows','Linux','macOS']:
        assert platform in guide
    for role in ['working-manager','manager','coder','architect','repository-explorer','researcher','technical-writer','test-engineer','qa-reviewer','security-reviewer','visual-qa']:
        assert f'`{role}`' in guide
    for category in ['quick','standard','deep','visual','critical']:
        assert f'`{category}`' in guide
    for phrase in ['routing.roleModels','routing.roleVariants','routing.allowedModels','routing.categoryVariants','routing.allowedProviders','routing.deniedModels','parallel.max','execution.parallelism','maxFallbacks']:
        assert phrase in guide
    assert '`routing.allowedModels`' in guide
    assert 'The setup CLI rejects primary-role model assignments explicitly.' in guide
    assert 'role-model-primary-owned-by-opencode' in guide_tr
    assert '"model": "provider/model-x"' in guide
    assert 'This requires configuring both ownership layers with the same model ID.' in guide
    assert 'rejects incompatible same-name agent definitions as collisions' in guide
    assert '.opencode/hi/policy/routing.json' in guide
    options=json.loads((ROOT/'data/hi-config-options.json').read_text(encoding='utf-8'))['options']
    assert all(f"`{x['path']}`" in guide for x in options)
    assert all(f"`{x['path']}`" in guide_tr for x in options)


def test_dead_browser_cli_executor_is_absent_from_living_surface():
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


def test_internal_exports_have_repository_consumers():
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

def test_cli_malformed_config_fails_closed_without_overwrite(tmp_path):
    cfg=tmp_path/'opencode.json';original='{broken json\n';cfg.write_text(original)
    for command in ('plan','install'):
        r=run(ROOT/'scripts/native_plugin_setup.py',command,tmp_path)
        assert r.returncode==2 and r.stderr==''
        out=json.loads(r.stdout);assert out['status']=='BLOCKED' and out['reason']=='invalid-json-input'
        assert out['path']==str(cfg) and out['action'] and 'will not overwrite' in out['action']
        assert 'Traceback' not in r.stdout and cfg.read_text(encoding='utf-8')==original


def test_cli_jsonc_plan_is_truthful_actionable_and_non_mutating(tmp_path):
    cfg=tmp_path/'opencode.jsonc';original='// comment\n{"plugin":[]}\n';cfg.write_text(original)
    r=run(ROOT/'scripts/native_plugin_setup.py','plan',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and r.stderr=='' and out['status']=='BLOCKED'
    assert out['reason']=='jsonc-safe-mutation-not-supported' and 'JSONC' in out['action']
    assert cfg.read_text(encoding='utf-8')==original and 'Traceback' not in r.stdout


def test_cli_reconfigure_rejects_out_of_range_and_malformed_limits(tmp_path):
    bad=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--parallel-max','-4')
    assert bad.returncode==2 and bad.stdout=='' and 'parallel-max must be in 1..8' in bad.stderr and 'Traceback' not in bad.stderr
    malformed=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--provider-limit','nope')
    out=json.loads(malformed.stdout);assert malformed.returncode==2 and malformed.stderr==''
    assert out['status']=='BLOCKED' and out['reason']=='invalid-concurrency-limit' and out['action']
    assert not (tmp_path/'.opencode/hi/policy/routing.json').exists()


def test_cli_first_run_doctor_supplies_recovery_action(tmp_path):
    r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path);out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='FAIL' and 'hi-plugin-not-registered' in out['issues']
    assert any('npx opencode-hi' in x and 'setup' in x for x in out['actions'])
    assert 'Traceback' not in r.stdout+r.stderr


def test_publishable_package_carries_node_bootstrap_and_runtime_contract():
    pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    assert pkg['bin']=={'opencode-hi':'scripts/opencode-hi.mjs','hi':'scripts/opencode-hi.mjs','opencode-hi-setup':'scripts/native_plugin_setup.py'}
    assert {'plugin/dist','skills','scripts/opencode-hi.mjs','scripts/native_plugin_setup.py','VERSION'}<=set(pkg['files'])
    assert pkg['peerDependencies']['@opencode-ai/plugin']==HOST_TARGET
    assert pkg['dependencies']['@opencode-ai/sdk']==HOST_TARGET
    assert pkg['optionalDependencies']['playwright-core']=='1.62.1'
    setup=ROOT/'scripts/native_plugin_setup.py'
    if os.name=='nt':
        mode=subprocess.check_output(['git','-c',f'safe.directory={ROOT}','ls-files','-s','--','scripts/native_plugin_setup.py'],cwd=ROOT,text=True).split()[0]
        assert mode=='100755'
    else:
        assert setup.stat().st_mode & 0o111


# OpenCode upstream churn control: frequent stable releases are observed separately
# from exact certified target state, and only capability-relevant upstream deltas
# may expand recertification scope.
def test_opencode_upstream_tracker_classifies_capability_delta_without_full_t3():
    m=load_module('opencode_upstream_tracker',ROOT/'scripts/opencode_upstream_tracker.py')
    policy=json.loads((ROOT/'data/opencode-host-compatibility-policy.json').read_text(encoding='utf-8'))
    result=m.classify_changed_paths(policy,[
        'packages/opencode/src/provider/provider.ts',
        'packages/opencode/src/session/prompt.ts',
        'packages/plugin/package.json',
        'packages/sdk/js/package.json',
        'packages/opencode/test/session/prompt.test.ts',
    ])
    assert result['classification']=='CAPABILITY_RELEVANT'
    assert result['surface_ids']==['provider-runtime','session-lifecycle']
    assert result['t3_capabilities']==['process-lifecycle','workspace-isolation-binding']
    assert result['fresh_consumer_required'] is True
    assert result['full_t3_required'] is False
    assert result['manual_review_required'] is False
    assert result['unclassified']==[]


def test_opencode_upstream_tracker_metadata_only_patch_does_not_recertify():
    m=load_module('opencode_upstream_tracker_metadata',ROOT/'scripts/opencode_upstream_tracker.py')
    policy=json.loads((ROOT/'data/opencode-host-compatibility-policy.json').read_text(encoding='utf-8'))
    result=m.classify_changed_paths(policy,[
        'packages/opencode/package.json',
        'packages/plugin/package.json',
        'packages/sdk/js/package.json',
        'packages/server/package.json',
        'packages/opencode/test/provider/provider.test.ts',
    ])
    assert result['classification']=='METADATA_ONLY'
    assert result['surface_ids']==[]
    assert result['t3_capabilities']==[]
    assert result['fresh_consumer_required'] is False
    assert result['full_t3_required'] is False
    assert result['manual_review_required'] is False


def test_opencode_upstream_tracker_registry_skew_fails_closed():
    m=load_module('opencode_upstream_tracker_skew',ROOT/'scripts/opencode_upstream_tracker.py')
    state=m.resolve_registry_state('1.18.20',{
        'opencode-ai':'1.18.21',
        '@opencode-ai/sdk':'1.18.21',
        '@opencode-ai/plugin':'1.18.20',
    })
    assert state['status']=='REGISTRY_SKEW'
    assert state['latest'] is None
    assert state['target_current'] is False
    assert state['support_promotion_allowed'] is False
