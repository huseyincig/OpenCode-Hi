#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-cli-developer-tooling-ux.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
checks=[
 ('installation','scripts/opencode-hi.mjs','function install(project,version)','tests/test_node_setup.mjs','0.2.3 friendly install ensures an owned registration while setup remains strict first-install'),
 ('first-run','scripts/opencode-hi.mjs',"routing_initialization:'pending-effective-runtime-inventory'",'tests/test_node_setup.mjs','M16 Node doctor distinguishes package registration truth from pending effective runtime routing'),
 ('doctor-diagnostics','scripts/opencode-hi.mjs','function doctor(project)', 'tests/test_node_setup.mjs','M16 Node doctor distinguishes package registration truth from pending effective runtime routing'),
 ('help','scripts/opencode-hi.mjs','function usage()', 'tests/test_node_setup.mjs','M16 package-runner help is Node-native'),
 ('command-inventory','scripts/opencode-hi.mjs','npx ${PACKAGE} check-update [project]','tests/test_node_setup.mjs','M16 package-runner help is Node-native'),
 ('bounded-errors-no-stack','scripts/opencode-hi.mjs','slice(0,500)','tests/test_node_setup.mjs','CLI did not return JSON'),
 ('recovery-instructions','scripts/opencode-hi.mjs','Run: npx opencode-hi recover <project>','tests/test_node_setup.mjs','M16 Node setup is idempotent and update changes only the owned Hi spec'),
 ('config-errors','scripts/native_plugin_setup.py',"_bounded_cli_int('parallel-max',1,8)",'tests/test_hi.py','test_prompt_b_cli_reconfigure_rejects_out_of_range_and_malformed_limits'),
 ('permission-prompts','plugin/src/runtime/process/runtime.ts','auth.permission_request','plugin/test/p3-process-runtime-lifecycle.test.mjs','native permission ask uses exact ToolContext-style request once'),
 ('unsupported-capability-messages','plugin/src/runtime/readiness/preconditions.ts','OpenCode session.create is unavailable','plugin/test/methodology-host-capability.test.mjs','browser and visual methodologies require canonical runtime browser-execution resource'),
 ('truthful-nonmutating-blocked-state','scripts/native_plugin_setup.py','jsonc-safe-mutation-not-supported','tests/test_hi.py','test_prompt_b_cli_jsonc_plan_is_truthful_actionable_and_non_mutating'),
]
violations=[];rows=[]
for name,owner,oa,proof,pa in checks:
    op,pp=ROOT/owner,ROOT/proof
    if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');continue
    if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');continue
    ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
    if oa not in ot:violations.append(f'{name}:owner-anchor-drift:{oa}')
    if pa not in pt:violations.append(f'{name}:proof-anchor-drift:{pa}')
    rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
setup=(ROOT/'scripts/native_plugin_setup.py').read_text(errors='replace');node_cli=(ROOT/'scripts/opencode-hi.mjs').read_text(errors='replace');docs=(ROOT/'docs/INSTALLATION.md').read_text(errors='replace');pre=(ROOT/'plugin/src/runtime/readiness/preconditions.ts').read_text(errors='replace')
guards={
 'structured_blocked_exit_code':"['BLOCKED','FAIL'].includes(out?.status)?2:0" in node_cli,
 'malformed_json_fail_closed':"new SetupError('invalid-json-input'" in node_cli,
 'jsonc_no_rewrite':'jsonc-safe-mutation-not-supported' in node_cli,
 'bounded_cli_scalar_validation':all(x in setup for x in ["max-fallbacks',0,6","parallel-max',1,8","team-max-members',2,8","team-wall-minutes',1,240"]),
 'bounded_error_detail':'slice(0,500)' in node_cli,
 'doctor_actions':'actions' in node_cli and 'pending-setup-transaction' in node_cli,
 'install_next_step':'Restart OpenCode. Hi will initialize recommended child routing only from the effective runtime inventory' in node_cli,
 'permission_ask_authoritative':'permission_request' in (ROOT/'plugin/src/runtime/process/authority.ts').read_text(errors='replace'),
 'unsupported_capability_resolve':'RESOLVE' in pre and 'unavailable' in pre,
 'docs_operator_commands':all(f'opencode-hi@0.2.2 {cmd}' in docs for cmd in ['setup','update','doctor','rollback','recover']) and 'native_plugin_setup.py reconfigure' in docs,
}
for k,v in guards.items():
    if not v:violations.append('static-guard:'+k)
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_CLI_DEVELOPER_TOOLING_UX_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':24,'status':status,'invariants':rows,'static_guards':guards,'violations':violations,'summary':{'required':len(checks),'covered':len(rows),'violations':len(violations)},'closed_defects':[{'id':'malformed-opencode-config-silent-overwrite-risk','fix':'Existing malformed JSON now blocks setup with bounded structured repair guidance and is never treated as an empty config.'},{'id':'reconfigure-invalid-limit-accepted','fix':'Scalar and keyed concurrency/config limits are validated at the CLI boundary before persistence.'},{'id':'blocked-plan-missing-recovery-guidance','fix':'Plan/doctor blocked states now carry truthful reason/action guidance; JSONC is classified as unsupported safe mutation rather than malformed JSON.'}],'ux_contract':['specific','actionable','truthful','bounded'],'claim_boundary':'This audit covers repository-owned setup/operator CLI and runtime-facing permission/capability messages. It does not claim an external shell installer, package manager UI, or alternate-host CLI exists.'}
OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"cli/developer tooling UX audit {status}: covered={len(rows)}/{len(checks)} violations={len(violations)}")
if violations:print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
