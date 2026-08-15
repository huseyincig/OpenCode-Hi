#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,subprocess,tempfile,tarfile,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-install-update-lifecycle.json'
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def row(inv,owner,oa,proof,pa):
    ok=(ROOT/owner).is_file() and (ROOT/proof).is_file() and oa in (ROOT/owner).read_text(errors='replace') and pa in (ROOT/proof).read_text(errors='replace')
    return {'invariant':inv,'status':'PASS' if ok else 'FAIL','owner':owner,'owner_sha256':sha(owner) if (ROOT/owner).is_file() else None,'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof) if (ROOT/proof).is_file() else None,'proof_anchor':pa}
lifecycle=json.loads((ROOT/'data/validation/install-lifecycle-0.1.0.json').read_text())
ops=lifecycle.get('operations',{}); assertions=lifecycle.get('assertions',{}); sec=lifecycle.get('state_security',{})
rows=[
 row('fresh-install','scripts/native_plugin_setup.py','def install(','data/validation/install-lifecycle-0.1.0.json','"install": "APPLIED"'),
 row('first-run-doctor','scripts/native_plugin_setup.py','def doctor(','data/validation/install-lifecycle-0.1.0.json','"doctor_installed": "OK"'),
 row('configure-reconfigure','scripts/native_plugin_setup.py','def reconfigure(','data/validation/install-lifecycle-0.1.0.json','"reconfigure": "APPLIED"'),
 row('owned-update-version-detection','scripts/native_plugin_setup.py','def upgrade(','tests/test_hi.py','test_r2_owned_upgrade_and_one_step_rollback_preserve_foreign_config'),
 row('uninstall','scripts/native_plugin_setup.py','def uninstall(','data/validation/install-lifecycle-0.1.0.json','"uninstall": "APPLIED"'),
 row('reinstall','scripts/run-install-lifecycle.py',"reinstall=m.install(project,'0.1.0')",'data/validation/install-lifecycle-0.1.0.json','"reinstall": "APPLIED"'),
 row('rollback-truth','scripts/native_plugin_setup.py','def rollback(','tests/test_hi.py','test_r2_rollback_fails_closed_after_unrelated_post_operation_config_drift'),
 row('partial-install-recovery','scripts/native_plugin_setup.py','def recover(','tests/test_hi.py','test_r2_recover_completes_interrupted_upgrade_when_config_matches_recorded_after_state'),
 row('user-config-preservation','scripts/run-install-lifecycle.py',"foreign_config_preserved_through_reinstall",'data/validation/install-lifecycle-0.1.0.json','"foreign_config_preserved_through_reinstall": true'),
 row('stale-state-cleanup','scripts/run-install-lifecycle.py','no_stale_setup_ownership_after_cleanup','data/validation/install-lifecycle-0.1.0.json','"no_stale_setup_ownership_after_cleanup": true'),
 row('setup-state-permissions','scripts/native_plugin_setup.py','def _write_state(','data/validation/install-lifecycle-0.1.0.json','"reinstall_setup_json_mode": "0o600"'),
 row('publishable-setup-cli-contract','package.json','"opencode-hi-setup"','tests/test_hi.py','test_prompt_b_publishable_package_carries_setup_cli_and_direct_runtime_dependency_contract'),
 row('no-source-tree-runtime-dependency','package.json','"@opencode-ai/sdk": "1.18.18"','tests/test_hi.py','test_prompt_b_publishable_package_carries_setup_cli_and_direct_runtime_dependency_contract'),
 row('runtime-run-is-separate-exact-host-boundary','data/validation/install-lifecycle-0.1.0.json','"external_host_status": "SEPARATE_T3_BOUNDARY"','data/validation/prompt-b-process-workspace-browser-lifecycle.json','"status": "PASS"'),
]
# dynamic lifecycle truth guards
required_ops={'plan':'READY','install':'APPLIED','idempotent_install':'NOOP','upgrade':'APPLIED','rollback_upgrade':'APPLIED','reconfigure':'APPLIED','doctor_installed':'OK','uninstall':'APPLIED','rollback_uninstall':'APPLIED','doctor_restored':'OK','final_uninstall':'APPLIED','reinstall':'APPLIED','doctor_reinstalled':'OK','reinstall_cleanup':'APPLIED','recover_interrupted_upgrade':'RECOVERED'}
static={
 'all_lifecycle_ops_exact':all(ops.get(k)==v for k,v in required_ops.items()),
 'all_lifecycle_assertions_true':bool(assertions) and all(assertions.values()),
 'state_files_restrictive':sec.get('setup_json_mode')=='0o600' and sec.get('rollback_mode_after_install')=='0o600' and sec.get('reinstall_setup_json_mode')=='0o600' and sec.get('rollback_mode_after_reinstall')=='0o600',
 'state_contains_no_config_body':sec.get('transaction_contains_config_body') is False and sec.get('rollback_contains_config_body') is False,
 'package_setup_bin_declared':json.loads((ROOT/'package.json').read_text()).get('bin')=={'opencode-hi-setup':'scripts/native_plugin_setup.py'},
 'package_setup_script_executable':bool((ROOT/'scripts/native_plugin_setup.py').stat().st_mode & 0o111),
 'runtime_t3_separate':lifecycle.get('external_host_status')=='SEPARATE_T3_BOUNDARY',
}
viol=[]
for r in rows:
    if r['status']!='PASS':viol.append(f"{r['invariant']}:anchor-drift")
for k,v in static.items():
    if not v:viol.append(f'static:{k}')
closed=[
 {'id':'lifecycle-missing-reinstall','resolution':'Local lifecycle receipt now exercises reinstall, doctor and final clean uninstall.'},
 {'id':'packed-setup-cli-missing','resolution':'Publishable package now carries executable opencode-hi-setup plus VERSION.'},
 {'id':'root-runtime-dependency-contract-missing','resolution':'Root package explicitly declares host peer, direct SDK dependency and optional playwright-core runtime dependency.'},
]
out={'schema':1,'kind':'PROMPT_B_INSTALL_UPDATE_LIFECYCLE_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':25,'status':'PASS' if not viol else 'FAIL','summary':{'required':len(rows),'covered':sum(r['status']=='PASS' for r in rows),'violations':len(viol)},'invariants':rows,'static_guards':static,'closed_defects':closed,'claim_boundary':'Local lifecycle/package-content contract plus exact-host runtime proof reference. This does not claim npm publication or replace §26 fresh-consumer exact-host acceptance.','violations':viol}
OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
print(f"install/update lifecycle audit {out['status']}: covered={out['summary']['covered']}/{out['summary']['required']} violations={len(viol)}")
for v in viol:print(v)
raise SystemExit(0 if not viol else 1)
