#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys,re
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-security-privacy.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
checks=[
 ('path-traversal','plugin/src/contracts/common.ts','normalizeBoundedProjectPath','plugin/test/prompt-b-vcs-path-portability.test.mjs','WorkerResult cannot persist absolute or traversal changed-file ownership'),
 ('symlink-escape','plugin/src/opencode/open-code-workspace-adapter.ts','realpathSync','plugin/test/w2-workspace-executor.test.mjs','symlinked workspace escape is canonicalized and rejected'),
 ('command-injection','plugin/src/runtime/process/shell-policy.ts','evaluateShellCommand','plugin/test/prompt-b-authority-destructive-boundary.test.mjs','credential and destructive shell boundaries use distinct HumanDecision types'),
 ('shell-interpolation','plugin/src/runtime/process/runtime.ts','evaluateShellCommand(commandLine)','plugin/test/prompt-b-security-privacy-hostile.test.mjs','blocks secret-sensitive external action before Authority state mutation'),
 ('prompt-injection','plugin/src/runtime/safety/authority.ts','authorityProtocolMatches','plugin/test/authority-input-split.test.mjs','plain approval prose is not an authority response'),
 ('malicious-repo-content','plugin/src/runtime/verification/policy.ts','verificationSatisfied','plugin/test/prompt-b-evidence-verification-completion-hostile.test.mjs','DONE. all tests passed. safe to release.'),
 ('malicious-methodology-resource','plugin/src/runtime/methodology/provenance.ts','readProjectMethodologyProvenance','plugin/test/project-methodology-admission-contract.test.mjs','update requires fresh provenance hash before re-admission'),
 ('secret-exfiltration','plugin/src/runtime/privacy/boundary.ts','redactDurableText','plugin/test/prompt-b-security-privacy-hostile.test.mjs','durable Authority descriptors preserve raw hash identity without persisting secret values'),
 ('environment-leaks','plugin/src/contracts/process.ts','ProcessContract','plugin/test/prompt-b-security-privacy-hostile.test.mjs','process environment is execution-ephemeral'),
 ('logs','plugin/src/runtime/ledger/ledger.ts','redactDurableText','plugin/test/prompt-b-security-privacy-hostile.test.mjs','durable ledger redacts nested tokens'),
 ('telemetry','plugin/src/runtime/telemetry/execution.ts','deriveEfficiencyMetrics','plugin/test/hi-core-evolution.test.mjs','telemetry'),
 ('external-memory','plugin/src/runtime/context/artifact-store.ts','export class ContextArtifactStore','plugin/test/context-survival-hardening.test.mjs','without a generic project-memory injection layer'),
 ('mcp','plugin/src/runtime/host/capability-manifest.ts',"mcp:'NATIVE'",'plugin/test/main-prompt-coexistence-platform-batch.test.mjs','default plugin surface does not invent MCP runtime'),
 ('browser','plugin/src/opencode/playwright-browser-adapter.ts','safeLocalUrl','plugin/test/b3-playwright-browser-runtime.test.mjs','outside supported local scope'),
 ('subprocess','plugin/src/runtime/process/runtime.ts','evaluateProcessSpawnAuthority','plugin/test/p3-process-runtime-lifecycle.test.mjs','explicit permission deny never asks and never spawns'),
 ('package-scripts','package.json','"build:plugin": "npm --prefix plugin run build"','.github/workflows/npm-publish.yml','npm publish --ignore-scripts --access public'),
 ('dependency-confusion','plugin/package-lock.json','"lockfileVersion": 3','plugin/test/release-quality-batch.test.mjs','supply-chain metadata are mandatory'),
 ('permission-widening','plugin/src/generated/permission-policy.ts','mayBeWidenedByLowerLayer','plugin/test/permission-profile-contract.test.mjs','mayBeWidenedByLowerLayer'),
 ('approval-spoofing','plugin/src/runtime/safety/authority.ts','approve-exact-action','plugin/test/authority-input-split.test.mjs','assistant text can never settle a pending authority response'),
 ('source-reuse-license','THIRD_PARTY_NOTICES.md','license/provenance boundaries','docs/SECURITY-MODEL.md','trust boundaries'),
]
violations=[];rows=[]
for name,owner,oa,proof,pa in checks:
 op,pp=ROOT/owner,ROOT/proof
 if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');continue
 if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');continue
 ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
 if oa not in ot:violations.append(f'{name}:owner-anchor-drift:{oa}')
 if pa not in pt:violations.append(f'{name}:proof-anchor-drift:{pa}')
 rows.append({'section':20,'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
privacy=(ROOT/'plugin/src/runtime/privacy/boundary.ts').read_text(errors='replace')
ledger=(ROOT/'plugin/src/runtime/ledger/ledger.ts').read_text(errors='replace')
authority=(ROOT/'plugin/src/runtime/safety/authority.ts').read_text(errors='replace')
process=(ROOT/'plugin/src/runtime/process/runtime.ts').read_text(errors='replace')
telemetry='\n'.join(x.read_text(errors='replace') for x in (ROOT/'plugin/src/runtime/telemetry').glob('*.ts'))
pluginpkg=json.loads((ROOT/'plugin/package.json').read_text());rootpkg=json.loads((ROOT/'package.json').read_text());lock=json.loads((ROOT/'plugin/package-lock.json').read_text())
lockpkgs=[v for k,v in lock.get('packages',{}).items() if k]
prod='\n'.join(x.read_text(errors='replace') for x in (ROOT/'plugin/src').rglob('*.ts'))
guards={
 'durable_secret_redactor_covers_cli_and_bearer':all(x in privacy for x in ['redactDurableText','--(?:password|secret|token|api[_-]?key)','Bearer']),
 'ledger_redacts_at_owner_boundary':'redactDurableText' in ledger,
 'authority_persists_redacted_action':'durableAction(c.action)' in authority,
 'process_shell_policy_runs_before_action_contract':process.index('evaluateShellCommand(commandLine)')<process.index('actionContract(commandLine'),
 'telemetry_has_no_network_sink':not re.search(r'\b(fetch|WebSocket|https?\s*[:(]|axios|request\s*\()',telemetry,re.I),
 'external_memory_provider_absent':not (ROOT/'plugin/src/runtime/memory').exists() and 'generic project-memory injection layer' in (ROOT/'plugin/test/context-survival-hardening.test.mjs').read_text(errors='replace'),
 'core_does_not_own_mcp_transport':not re.search(r'@modelcontextprotocol|\bMcp(?:Client|Server|Transport)\b|\bMCP(?:Client|Server|Transport)\b|createMcp(?:Client|Server|Transport)|startMcp(?:Client|Server)',prod),
 'no_git_dependency_preparation_triggers':all(k not in (rootpkg.get('scripts') or {}) for k in ['postinstall','build','preinstall','install','prepack','prepare']),
 'no_plugin_install_postinstall_scripts':all(k not in (pluginpkg.get('scripts') or {}) for k in ['install','preinstall','postinstall']),
 'lockfile_integrity_complete':lock.get('lockfileVersion')==3 and bool(lockpkgs) and all(bool(x.get('resolved')) and bool(x.get('integrity')) for x in lockpkgs),
 'script_allowlist_exact':pluginpkg.get('allowScripts')=={'msgpackr-extract@3.0.4':True},
 'env_not_in_process_contract':'env?:' not in (ROOT/'plugin/src/contracts/process.ts').read_text(errors='replace'),
 'provider_child_prompt_redacted':'redactProviderContext(text)' in (ROOT/'plugin/src/runtime/task/child-execution-coordinator.ts').read_text(errors='replace'),
 'provider_system_projection_redacted':'redactProviderContext(renderMissionRuntimeProjection(projection)).providerText' in (ROOT/'plugin/src/hooks/system-transform.ts').read_text(errors='replace'),
 'no_host_user_literals':'/root/' not in prod and '/home/node/' not in prod,
}
for k,v in guards.items():
 if not v:violations.append('static-guard:'+k)
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_SECURITY_PRIVACY_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':20,'status':status,'invariants':rows,'static_guards':guards,'violations':violations,'summary':{'required':20,'covered':20-len([v for v in violations if not v.startswith('static-guard:')]),'violations':len(violations)},'closed_defects':[
 {'id':'process-secret-before-authority-persistence','fix':'ProcessRuntime evaluates shell/credential safety before constructing or persisting external-action Authority state.'},
 {'id':'durable-authority-secret-command','fix':'Authority hashes remain raw-command-bound but pending/executing descriptors are durable-redacted; hash-based completion avoids reconstructing identity from persisted text.'},
 {'id':'durable-ledger-secret-leak','fix':'Ledger string payloads are redacted at the durable observability owner boundary before storage.'},
 {'id':'temporary-rollback-secret-persistence','fix':'Secret-bearing executable rollback commands are rejected; durable mutation descriptions and failure details are redacted.'},
 {'id':'system-projection-secret-reexposure','fix':'Hi-added Mission runtime system projection is provider-redacted before insertion.'},
 ],'claim_boundary':'Security closure proves Hi-owned controls and current package/source boundaries. It does not claim the host/provider, user-installed MCP servers, third-party packages, or arbitrary repository content are intrinsically trustworthy; those inputs remain constrained/untrusted.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"security/privacy audit {status}: covered={data['summary']['covered']}/20 violations={len(violations)}")
if violations:print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
