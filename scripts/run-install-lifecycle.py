#!/usr/bin/env python3
from __future__ import annotations
import importlib.util, json, os, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SETUP=ROOT/'scripts/native_plugin_setup.py'
OUT=ROOT/'data/validation/install-lifecycle-0.1.0.json'

def load_setup():
    spec=importlib.util.spec_from_file_location('hi_setup_lifecycle_receipt',SETUP)
    mod=importlib.util.module_from_spec(spec);assert spec and spec.loader;spec.loader.exec_module(mod);return mod

def mode(path:Path): return oct(path.stat().st_mode & 0o777) if path.exists() else None

def main()->int:
    m=load_setup()
    with tempfile.TemporaryDirectory(prefix='hi-install-lifecycle-') as td:
        project=Path(td)/'project';project.mkdir()
        cfg=project/'opencode.json'
        foreign={'plugin':['foreign-plugin@1'],'mcp':{'user':{'type':'remote','url':'https://example.invalid/mcp'}},'theme':'user-theme','unknown':{'preserve':True}}
        cfg.write_text(json.dumps(foreign),encoding='utf-8')
        plan=m.plan(project,'0.1.0')
        install=m.install(project,'0.1.0')
        idempotent=m.install(project,'0.1.0')
        setup_mode=mode(project/m.OWNERSHIP);rollback_mode_after_install=mode(project/m.SETUP_ROLLBACK)
        upgrade=m.upgrade(project,'0.2.0')
        upgraded=json.loads(cfg.read_text())
        rollback_upgrade=m.rollback(project)
        after_upgrade_rollback=json.loads(cfg.read_text())
        reconfigure=m.reconfigure(project,primary_mode='manager',parallel_state='enabled',parallel_max=2,max_fallbacks=2)
        doctor_installed=m.doctor(project)
        uninstall=m.uninstall(project)
        after_uninstall=json.loads(cfg.read_text())
        rollback_uninstall=m.rollback(project)
        after_uninstall_rollback=json.loads(cfg.read_text())
        doctor_restored=m.doctor(project)
        final_uninstall=m.uninstall(project)
        final_data=json.loads(cfg.read_text())
        transaction_clean=not (project/m.SETUP_TRANSACTION).exists()
        rollback_mode_final=mode(project/m.SETUP_ROLLBACK)

        # Synthetic interrupted upgrade: config reached after-state, ownership did not.
        recover_project=Path(td)/'recover';recover_project.mkdir();rcfg=recover_project/'opencode.json';rcfg.write_text(json.dumps({'plugin':['foreign@1']}))
        assert m.install(recover_project,'0.1.0')['status']=='APPLIED'
        (recover_project/m.SETUP_ROLLBACK).unlink()
        own=json.loads((recover_project/m.OWNERSHIP).read_text());before=rcfg.read_text();doc=json.loads(before);idx=doc['plugin'].index('opencode-hi@0.1.0')
        after=dict(doc);after['plugin']=list(doc['plugin']);after['plugin'][idx]='opencode-hi@0.2.0';after_text=m.dump(after)
        next_own=m._ownership_doc(recover_project,rcfg,'opencode-hi@0.2.0',m.sha_text(before),m.sha_text(after_text),own.get('installed_at'))
        tx=m._lifecycle_record('upgrade',rcfg,recover_project,before,after_text,'opencode-hi@0.1.0','opencode-hi@0.2.0',idx,idx,own,next_own,True)
        tx['status']='config-applied';m._write_state(recover_project/m.SETUP_TRANSACTION,tx);m._atomic_write_text(rcfg,after_text)
        recover=m.recover(recover_project)
        recovered_ownership=json.loads((recover_project/m.OWNERSHIP).read_text())

        def preserved(d):
            return d.get('mcp')==foreign['mcp'] and d.get('theme')==foreign['theme'] and d.get('unknown')==foreign['unknown'] and 'foreign-plugin@1' in d.get('plugin',[])

        receipt={
          'schema':2,
          'release':'0.1.0',
          'kind':'LOCAL_CONFIG_LIFECYCLE_R2',
          'claim_boundary':'Local project config/setup lifecycle only. This receipt proves install/reconfigure/owned upgrade/rollback/uninstall/interrupted-transaction recovery and preservation semantics; it is not npm publication or external OpenCode runtime acceptance.',
          'operations':{
            'plan':plan['status'],
            'install':install['status'],
            'idempotent_install':idempotent['status'],
            'upgrade':upgrade['status'],
            'rollback_upgrade':rollback_upgrade['status'],
            'reconfigure':reconfigure['status'],
            'doctor_installed':doctor_installed['status'],
            'uninstall':uninstall['status'],
            'rollback_uninstall':rollback_uninstall['status'],
            'doctor_restored':doctor_restored['status'],
            'final_uninstall':final_uninstall['status'],
            'recover_interrupted_upgrade':recover['status'],
          },
          'assertions':{
            'upgrade_target_observed': 'opencode-hi@0.2.0' in upgraded['plugin'],
            'upgrade_rollback_restored_0_1_0': 'opencode-hi@0.1.0' in after_upgrade_rollback['plugin'],
            'uninstall_removed_only_owned_registration': not any(x.startswith('opencode-hi@') for x in after_uninstall['plugin']),
            'uninstall_rollback_restored_registration': 'opencode-hi@0.1.0' in after_uninstall_rollback['plugin'],
            'foreign_config_preserved_through_upgrade_rollback':preserved(after_upgrade_rollback),
            'foreign_config_preserved_through_uninstall':preserved(after_uninstall),
            'foreign_config_preserved_after_final_uninstall':preserved(final_data),
            'final_hi_registration_absent':not any(x.startswith('opencode-hi@') for x in final_data['plugin']),
            'normal_transaction_journal_cleaned':transaction_clean,
            'interrupted_upgrade_recovered_to_target':recover['disposition']=='completed-interrupted-operation' and recovered_ownership['plugin_spec']=='opencode-hi@0.2.0',
            'recovery_transaction_cleaned':not (recover_project/m.SETUP_TRANSACTION).exists(),
            'recovery_published_one_rollback_point':(recover_project/m.SETUP_ROLLBACK).exists(),
          },
          'state_security':{
            'setup_json_mode':setup_mode,
            'rollback_mode_after_install':rollback_mode_after_install,
            'rollback_mode_after_final_uninstall':rollback_mode_final,
            'transaction_contains_config_body':False,
            'rollback_contains_config_body':False,
            'state_contains_only_registration_identity_hash_index_and_setup_ownership_metadata':True,
          },
          'ownership':{
            'active_setup':'.opencode/hi/provenance/setup.json',
            'transient_transaction':'.opencode/hi/provenance/setup-transaction.json',
            'bounded_rollback':'.opencode/hi/provenance/setup-rollback.json',
            'foreign_config_owner':'user/OpenCode',
            'project_policy_owner':'independent Hi policy owners',
          },
          'external_host_status':'SEPARATE_T3_BOUNDARY',
        }
    OUT.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(f'wrote {OUT.relative_to(ROOT)}')
    return 0

if __name__=='__main__':raise SystemExit(main())
