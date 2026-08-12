from __future__ import annotations
import hashlib, importlib.util, json, os, subprocess, sys, zipfile
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
V='2.0.10'

def run(*args):return subprocess.run([sys.executable,*map(str,args)],text=True,capture_output=True)
def load_module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);assert spec and spec.loader;spec.loader.exec_module(m);return m

def test_identity_is_oho():
    d=json.loads((ROOT/'data/product.json').read_text())
    assert d['product_name']=='OpenCode HHC Orchestrator' and d['short_name']=='OHO' and d['version']==V
    assert d['plugin_package']=='opencode-hhc-orchestrator' and d['repository']=='https://github.com/huseyincig/OpenCode-HHC-Orchestrator'

def test_root_git_package_contract():
    d=json.loads((ROOT/'package.json').read_text()); assert d['name']=='opencode-hhc-orchestrator' and d['version']==V
    assert d['main']=='plugin/dist/plugin.js' and (ROOT/d['main']).is_file() and 'skills' in d['files']

def test_root_is_product_clean():
    assert not any((ROOT/x).exists() for x in ['KURULUM.md','RELEASE-READINESS.md','WORK-STATE.md','work-state.json','OHO.cmd','OHO.sh','OHO-VALIDATE.cmd','OHO-RELEASE-PREP.cmd'])
    assert {p.name for p in (ROOT/'docs').glob('*.md')}=={'ARCHITECTURE.md','INSTALLATION.md','SKILLS.md','VALIDATION.md','THREAT-MODEL.md'}

def test_semantic_contract_names_only():
    for rel in ['data/validation/implementation-coverage.json','data/validation/native-coverage.json','data/validation/flow-coverage.json','data/validation/flow-acceptance.json','data/validation/source-gates.json']:assert (ROOT/rel).is_file()
    for rel in ['data/feature-ledger-09-coverage.json','data/native-first-10-coverage.json','data/flow-11-coverage.json','data/flow-11-acceptance.json','data/observed-runtime-smoke-1.18.16.json']:assert not (ROOT/rel).exists()

def test_setup_adds_only_oho_and_preserves_other_plugins(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['user-plugin@1']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path);assert r.returncode==0,r.stderr
    p=json.loads((tmp_path/'opencode.json').read_text())['plugin']; assert any('OpenCode-HHC-Orchestrator.git' in x for x in p)
    assert 'user-plugin@1' in p and len([x for x in p if 'OpenCode-HHC-Orchestrator' in x])==1

def test_setup_blocks_conflicting_oho_registration(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['opencode-hhc-orchestrator@git+https://example.invalid/fork.git']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path); assert r.returncode==2 and json.loads(r.stdout)['status']=='BLOCKED'

def test_uninstall_removes_only_oho(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    assert run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path).returncode==0
    p=json.loads((tmp_path/'opencode.json').read_text())['plugin']; assert not any('OpenCode-HHC-Orchestrator' in x for x in p)



def test_exact_git_ref_install_doctor_and_uninstall_preserve_user_fields(tmp_path):
    ref='0123456789abcdef0123456789abcdef01234567'
    cfg=tmp_path/'opencode.json'
    cfg.write_text(json.dumps({'plugin':['user-plugin@example'],'mcp':{'user':{'type':'remote','url':'https://example.invalid/mcp'}},'theme':'user-theme'}))
    r=run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path,'--ref',ref); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='APPLIED'
    expected=f'opencode-hhc-orchestrator@git+https://github.com/huseyincig/OpenCode-HHC-Orchestrator.git#{ref}'
    assert out['plugin_spec']==expected
    data=json.loads(cfg.read_text()); assert expected in data['plugin'] and 'user-plugin@example' in data['plugin']
    assert data['mcp']['user']['url']=='https://example.invalid/mcp' and data['theme']=='user-theme'
    d=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); doctor=json.loads(d.stdout)
    assert d.returncode==0 and doctor['status']=='OK' and doctor['oho_specs']==[expected]
    u=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path); un=json.loads(u.stdout)
    assert u.returncode==0 and un['status']=='APPLIED' and un['removed']==[expected]
    after=json.loads(cfg.read_text()); assert after['plugin']==['user-plugin@example']
    assert after['mcp']['user']['url']=='https://example.invalid/mcp' and after['theme']=='user-theme'

def test_doctor_is_machine_readable(tmp_path):
    run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path); r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); d=json.loads(r.stdout)
    assert r.returncode==0 and d['status']=='OK' and d['short']=='OHO'

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
    leaked=probe/'plugin'/'.opencode'/'.oho'
    leaked.mkdir(parents=True,exist_ok=True)
    (leaked/'runtime-state.json').write_text('{}')
    r=subprocess.run([sys.executable,str(probe/'scripts/validate.py')],text=True,capture_output=True,cwd=probe)
    assert r.returncode!=0 and 'nested project-local runtime directory' in (r.stdout+r.stderr)

def _build(tmp_path):
    out=tmp_path/'dist';src=tmp_path/'source';r=run(ROOT/'scripts/release-build.py','--out',out,'--source-out',src);assert r.returncode==0,r.stderr
    return out/f'OpenCode-HHC-Orchestrator-{V}-DISTRIBUTABLE.zip',src/f'OpenCode-HHC-Orchestrator-{V}-SOURCE.zip'

def test_release_names_and_source_integrity(tmp_path):
    dist,src=_build(tmp_path); assert dist.is_file() and src.is_file()
    with zipfile.ZipFile(src) as z:n=set(z.namelist())
    assert {'package.json','plugin/package-lock.json','plugin/dist/plugin.js','docs/ARCHITECTURE.md','docs/INSTALLATION.md','docs/SKILLS.md','docs/VALIDATION.md'}<=n
    assert 'WORK-STATE.md' not in n and 'KURULUM.md' not in n
    assert not any(part == '.opencode' for name in n for part in Path(name).parts), sorted(x for x in n if '.opencode' in Path(x).parts)[:10]
    assert 'plugin/.opencode/.oho/runtime-state.json' not in n

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

def test_release_gate_stays_blocked_before_external_lab():
    d=json.loads((ROOT/'data/validation/release-gates.json').read_text())
    assert d['release']==V
    assert d['gates']['source_integrity']=='PASS_LOCAL'
    assert d['gates']['deterministic_release']=='PASS_LOCAL'
    assert d['gates']['node_runtime_acceptance'].startswith('PASS_LOCAL_')
    assert d['gates']['python_acceptance'].startswith('PASS_LOCAL_')
    local_gates={'source_integrity','deterministic_release','node_runtime_acceptance','python_acceptance','worktree_path_acceptance','optional_tool_surface_economy','native_skill_inventory','native_methodology_ownership'}
    external={gate:state for gate,state in d['gates'].items() if gate not in local_gates}
    assert external
    # Checkpoint-level external evidence may legitimately become PASS before the exact-bound
    # release lab is complete. What must remain true is that exact candidate/full-matrix/
    # Windows blockers cannot be promoted by a partial CLI checkpoint.
    assert all(state.startswith(('PENDING_EXTERNAL','PASS_EXTERNAL_CLI_')) for state in external.values())
    for gate in ('native_git_plugin_install','acceptance_scenarios_A_H_external','native_acceptance_01_18_external','flow_acceptance_01_08_external','windows_runtime_smoke'):
        assert external[gate].startswith('PENDING_EXTERNAL')
    assert d['release_blocked'] is True
    progress=json.loads((ROOT/'data/validation/forensic-61-progress.json').read_text())
    assert progress['summary']['total']==61
    assert progress['summary']['complete_local']+progress['summary']['partial_external']==61
    assert progress['summary']['failed']==0
    assert progress['summary']['unresolved_internal']==0
    assert len(progress['items'])==61
    assert [x['item'] for x in progress['items']]==list(range(1,62))
    assert d['release_blocked'] is True
    assert d['external_blockers']
    assert d['historical_receipts_not_valid_for_current_candidate']['release']!='2.0.10'

def test_uninstall_preserves_user_adopted_hhc_registration(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    cfg=tmp_path/'opencode.json'; data=json.loads(cfg.read_text())
    data['plugin']=[('opencode-hhc-orchestrator@git+https://example.invalid/user-fork.git' if 'OpenCode-HHC-Orchestrator.git' in x else x) for x in data['plugin']]
    cfg.write_text(json.dumps(data))
    r=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='PRESERVED'
    assert any('example.invalid/user-fork.git' in x for x in json.loads(cfg.read_text())['plugin'])

def test_uninstall_without_ownership_never_deletes_hhc_registration(tmp_path):
    (tmp_path/'opencode.json').write_text(json.dumps({'plugin':['opencode-hhc-orchestrator@user-managed']}))
    r=run(ROOT/'scripts/native_plugin_setup.py','uninstall',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='BLOCKED' and out['reason']=='ownership-proof-missing'
    assert json.loads((tmp_path/'opencode.json').read_text())['plugin']==['opencode-hhc-orchestrator@user-managed']

def test_cli_doctor_reports_managed_config_drift(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    cfg=tmp_path/'opencode.json'; data=json.loads(cfg.read_text()); data['share']='manual'; cfg.write_text(json.dumps(data))
    r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='WARN' and out['ownership']['config_drift'] is True
    assert 'managed-config-drift' in out['warnings']

def test_cli_doctor_fails_unsupported_routing_schema(tmp_path):
    assert run(ROOT/'scripts/native_plugin_setup.py','install',tmp_path).returncode==0
    p=tmp_path/'.opencode'/'oho-routing.json'; p.write_text(json.dumps({'schema':99,'routing':{}}))
    r=run(ROOT/'scripts/native_plugin_setup.py','doctor',tmp_path); out=json.loads(r.stdout)
    assert r.returncode==2 and out['status']=='FAIL' and 'unsupported-routing-schema' in out['issues']

def test_release_build_identity_contract_matches_version_and_changelog():
    import importlib.util
    spec=importlib.util.spec_from_file_location('hhc_release_build',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    assert mod.release_identity(ROOT,V)==[]

def test_release_build_identity_detects_package_and_changelog_drift(tmp_path):
    import importlib.util, shutil
    spec=importlib.util.spec_from_file_location('hhc_release_build2',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    (tmp_path/'plugin').mkdir(); (tmp_path/'VERSION').write_text('2.0.10\n'); (tmp_path/'package.json').write_text(json.dumps({'version':'2.0.9'})); (tmp_path/'plugin'/'package.json').write_text(json.dumps({'version':'2.0.10'})); (tmp_path/'CHANGELOG.md').write_text('# Changelog\n\n## 2.0.9\n')
    issues=mod.release_identity(tmp_path,'2.0.10'); assert 'root package version mismatch' in issues and 'CHANGELOG version entry missing' in issues


def test_release_build_identity_detects_plugin_license_drift(tmp_path):
    import importlib.util
    spec=importlib.util.spec_from_file_location('hhc_release_build_license',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    (tmp_path/'plugin').mkdir(); (tmp_path/'VERSION').write_text('2.0.10\n')
    (tmp_path/'package.json').write_text(json.dumps({'version':'2.0.10','license':'Apache-2.0'}))
    (tmp_path/'plugin'/'package.json').write_text(json.dumps({'version':'2.0.10','license':'MIT'}))
    (tmp_path/'CHANGELOG.md').write_text('# Changelog\n\n## 2.0.10\n')
    assert 'plugin package license mismatch' in mod.release_identity(tmp_path,'2.0.10')

def test_release_build_identity_detects_package_lock_drift(tmp_path):
    import importlib.util
    spec=importlib.util.spec_from_file_location('hhc_release_build3',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
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
    for name in [f'OpenCode-HHC-Orchestrator-{V}-DISTRIBUTABLE.zip',f'RELEASE-MANIFEST-{V}.json']:
        assert hashlib.sha256((a/name).read_bytes()).hexdigest()==hashlib.sha256((b/name).read_bytes()).hexdigest()
    source=f'OpenCode-HHC-Orchestrator-{V}-SOURCE.zip'
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

def test_release_build_notices_cover_direct_dependency_names_and_licenses():
    import importlib.util
    spec=importlib.util.spec_from_file_location('hhc_release_build4',ROOT/'scripts/release-build.py'); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    components,digest=mod.dependency_components(ROOT); assert len(digest)==64
    assert mod.validate_third_party_notices(ROOT,components)==[]

def test_role_models_reconfigure_preserves_unrelated_user_routing_fields(tmp_path, monkeypatch):
    mod=load_module('native_plugin_setup_reconfigure',ROOT/'scripts/native_plugin_setup.py')
    cfg=tmp_path/'.opencode'/'oho-routing.json'
    cfg.parent.mkdir(parents=True,exist_ok=True)
    original={
        'schema':1,'type':'oho-routing','routing':{
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
    assert out['status']=='APPLIED'; assert out['modelPolicy']=='manual'; assert out['smartSelectRoles']==[]
    cfg=json.loads((tmp_path/'.opencode'/'oho-routing.json').read_text())
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
    assert out['status']=='APPLIED'; assert out['modelPolicy']=='recommended'; assert out['smartSelectRoles']==[missing_role]
    cfg=json.loads((tmp_path/'.opencode'/'oho-routing.json').read_text())
    assert missing_role not in cfg['routing']['roleModels']
    assert cfg['routing']['roleModels']['coder']==mod.DEFAULT_ROLE_MODELS['coder']
    assert cfg['routing']['smartSelectRoles']==[missing_role]

def test_reconfigure_preserves_user_owned_config_and_updates_main_prompt_runtime_knobs(tmp_path):
    cfg=tmp_path/'opencode.json'
    original={
        'plugin':['user-plugin'],
        'mcp':{'user-server':{'command':['x']}},
        'userFuture':{'keep':True},
        'hhc':{'userCustom':{'preserve':'yes'},'profile':{'standard':{'customThreshold':'keep'}}},
    }
    cfg.write_text(json.dumps(original))
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,
          '--autonomy','powerful','--primary-mode','manager',
          '--parallel','enabled','--parallel-max','4',
          '--profile-target','standard','--specialist-threshold','low','--parallel-threshold','low','--review-threshold','high',
          '--team-mode','enabled','--team-auto','false','--team-max-members','3',
          '--routing-strategy','quality','--model-policy','manual','--allow-provider','p1','--deny-model','p/bad','--max-fallbacks','2')
    out=json.loads(r.stdout); assert r.returncode==0 and out['status']=='APPLIED'
    # Native OpenCode config is user-owned and is no longer mutated with private HHC keys.
    after=json.loads(cfg.read_text()); assert after==original
    project_cfg=json.loads((tmp_path/'.opencode'/'oho-routing.json').read_text())
    assert project_cfg['autonomy']=='powerful' and project_cfg['primaryMode']=='manager'
    assert project_cfg['parallel']['enabled'] is True and project_cfg['parallel']['max']==4
    assert project_cfg['profile']['standard']['customThreshold']=='keep'
    assert project_cfg['profile']['standard']['specialistThreshold']=='low'
    assert project_cfg['profile']['standard']['parallelThreshold']=='low'
    assert project_cfg['profile']['standard']['reviewThreshold']=='high'
    assert project_cfg['teamMode']['enabled'] is True and project_cfg['teamMode']['auto'] is False and project_cfg['teamMode']['maxMembers']==3
    routing=project_cfg['routing']
    assert routing['maxFallbacks']==2 and routing['strategy']=='quality' and routing['modelPolicy']=='manual' and routing['allowedProviders']==['p1'] and routing['deniedModels']==['p/bad']
    assert after['hhc']['userCustom']=={'preserve':'yes'}


def test_reconfigure_only_changes_explicit_fields_and_print_is_non_mutating(tmp_path):
    cfg=tmp_path/'opencode.json'; cfg.write_text(json.dumps({'share':'manual','hhc':{'autonomy':'basic','primaryMode':'auto','parallel':{'enabled':False,'max':2}}}))
    before=cfg.read_text()
    p=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--print'); out=json.loads(p.stdout)
    assert p.returncode==0 and out['hhc']['autonomy']=='basic' and cfg.read_text()==before
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--primary-mode','working-manager'); assert r.returncode==0
    assert cfg.read_text()==before
    project_cfg=json.loads((tmp_path/'.opencode'/'oho-routing.json').read_text())
    assert project_cfg['autonomy']=='basic' and project_cfg['parallel']=={'enabled':False,'max':2} and project_cfg['primaryMode']=='working-manager'


def test_reconfigure_is_safe_with_jsonc_because_private_settings_live_outside_native_config(tmp_path):
    cfg=tmp_path/'opencode.jsonc'; cfg.write_text('{ // user comments\n "share":"manual"\n}\n')
    before=cfg.read_text()
    r=run(ROOT/'scripts/native_plugin_setup.py','reconfigure',tmp_path,'--primary-mode','manager','--team-mode','enabled'); out=json.loads(r.stdout)
    assert r.returncode==0 and out['status']=='APPLIED' and cfg.read_text()==before
    project_cfg=json.loads((tmp_path/'.opencode'/'oho-routing.json').read_text())
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
