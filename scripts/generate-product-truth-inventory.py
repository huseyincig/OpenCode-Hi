#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/product-truth-inventory.json'
AREAS=[
('mission','MissionStore','plugin/src/runtime/mission/mission-store.ts',['plugin/src/runtime/mission/types.ts','plugin/src/runtime/mission/validators.ts'],['plugin/src/runtime/task/task-runtime.ts'],['plugin/test/mission.test.mjs','plugin/test/a3-mission-slices.test.mjs'],'docs/ARCHITECTURE.md'),
('task-runtime','TaskRuntime','plugin/src/runtime/task/task-runtime.ts',['plugin/src/runtime/task/contracts.ts'],['plugin/src/runtime/task/child-execution-coordinator.ts','plugin/src/runtime/task/task-result-reconciler.ts','plugin/src/runtime/task/task-recovery-coordinator.ts'],['plugin/test/task-worker-contract.test.mjs','plugin/test/a2-task-runtime-collaborators.test.mjs'],'docs/ARCHITECTURE.md'),
('worker','WorkerRuntime','plugin/src/runtime/worker/worker-runtime.ts',['plugin/src/contracts/worker.ts','plugin/src/contracts/worker-result.ts'],['plugin/src/runtime/task/task-result-reconciler.ts'],['plugin/test/task-worker-contract.test.mjs','plugin/test/worker-result-contract.test.mjs'],'docs/ARCHITECTURE.md'),
('roles-permissions','RoleContract + PermissionProfileContract','data/hi-roles.json',['data/hi-permission-profiles.json','plugin/src/runtime/roles/catalog.ts'],['plugin/src/opencode/agent-binding.ts'],['plugin/test/stage2-role-contract.test.mjs','plugin/test/agent-binding-contract.test.mjs'],'docs/ARCHITECTURE.md'),
('methodologies-skills','MethodologyContract','data/hi-methodologies.json',['plugin/src/runtime/methodology/catalog.ts','plugin/src/runtime/skills/catalog-index.ts'],['plugin/src/runtime/methodology/activation.ts','plugin/src/runtime/methodology/native-loading.ts'],['plugin/test/methodology-signal-contract.test.mjs','plugin/test/c7-skill-catalog-index.test.mjs'],'docs/SKILLS.md'),
('routing-models','Hi routing/model resolver','plugin/src/runtime/routing/model-resolver.ts',['plugin/src/runtime/routing/execution-profile.ts','plugin/src/runtime/routing/minimum-team.ts','plugin/src/runtime/routing/model-feedback.ts'],['plugin/src/runtime/task/task-runtime.ts'],['plugin/test/profile-system.test.mjs','plugin/test/per-role-routing-runtime.test.mjs'],'docs/EXECUTION-POLICY.md'),
('configuration','Hi config catalog/resolver','data/hi-config-options.json',['plugin/src/config/schema.ts','plugin/src/config/resolver.ts'],['plugin/src/plugin.ts'],['plugin/test/config.test.mjs','plugin/test/config-option-contract.test.mjs','plugin/test/config-executable-effect.test.mjs'],'docs/INSTALLATION.md'),
('authority','AuthorityContract/runtime','plugin/src/contracts/authority.ts',['plugin/src/runtime/safety/authority.ts','plugin/src/runtime/safety/project-authority.ts'],['plugin/src/runtime/application/hi-tool-surface.ts','plugin/src/runtime/process/authority.ts'],['plugin/test/authority-contract.test.mjs','plugin/test/authority-side-effect-idempotency.test.mjs'],'docs/HUMAN-DECISIONS.md'),
('external-actions-release','ExternalAction + release chain','plugin/src/contracts/external-action.ts',['plugin/src/runtime/safety/release-chain.ts'],['scripts/release-build.py','.github/workflows/npm-publish.yml'],['plugin/test/real-hosted-release-transaction.test.mjs','plugin/test/r1-npm-oidc-workflow.test.mjs'],'docs/RELEASE.md'),
('human-decisions','HumanDecisionContract/runtime','plugin/src/contracts/human-decision.ts',['plugin/src/runtime/human-decision/runtime.ts','plugin/src/runtime/human-decision/transport.ts'],['plugin/src/plugin.ts'],['plugin/test/human-decision-contract.test.mjs','plugin/test/h1-human-decision-transport.test.mjs'],'docs/HUMAN-DECISIONS.md'),
('context','ContextGovernor','plugin/src/runtime/context/governor.ts',['plugin/src/runtime/context/mission-runtime-projection.ts','plugin/src/runtime/context/budget-estimator.ts','plugin/src/runtime/context/artifact-store.ts'],['plugin/src/hooks/session-compacting.ts','plugin/src/runtime/task/task-runtime.ts'],['plugin/test/context-survival-hardening.test.mjs','plugin/test/c4-context-budget-estimator.test.mjs'],'docs/CONTEXT.md'),
('semantic-context','SemanticContextAdapter','plugin/src/runtime/semantic/adapter.ts',['plugin/src/runtime/semantic/typescript-context.ts','plugin/src/contracts/semantic-context.ts'],['plugin/src/runtime/task/task-runtime.ts'],['plugin/test/c6-semantic-context-adapter.test.mjs'],'docs/CONTEXT.md'),
('project-intelligence','ProjectIntelligence store/retrieval','plugin/src/runtime/project-intelligence/store.ts',['plugin/src/runtime/project-intelligence/retrieval.ts','plugin/src/contracts/project-intelligence.ts'],['plugin/src/runtime/task/task-runtime.ts'],['plugin/test/c5-project-intelligence-hybrid-retrieval.test.mjs'],'docs/PROJECT-INTELLIGENCE.md'),
('evidence-verification','EvidenceRuntime + VerificationEnvelope','plugin/src/runtime/evidence/evidence-runtime.ts',['plugin/src/contracts/evidence.ts','plugin/src/contracts/verification-envelope.ts','plugin/src/runtime/verification/policy.ts'],['plugin/src/runtime/task/task-result-reconciler.ts','plugin/src/runtime/completion/evaluator.ts'],['plugin/test/verification-envelope-contract.test.mjs','plugin/test/evidence-freshness-ordering.test.mjs'],'docs/VERIFICATION.md'),
('completion-continuation','Completion + continuation','plugin/src/runtime/completion/evaluator.ts',['plugin/src/runtime/continuation/evaluator.ts','plugin/src/runtime/continuation/dispatcher.ts','plugin/src/runtime/continuation/recovery.ts'],['plugin/src/runtime/application/runtime-event-controller.ts'],['plugin/test/flow-consistency.test.mjs','plugin/test/continuation-evaluator-wide-batch.test.mjs'],'docs/VERIFICATION.md'),
('process','ProcessContract/Runtime','plugin/src/contracts/process.ts',['plugin/src/runtime/process/runtime.ts','plugin/src/runtime/process/executor.ts'],['plugin/src/opencode/open-code-pty-adapter.ts'],['plugin/test/p1-process-contract.test.mjs','plugin/test/p2-opencode-pty-executor.test.mjs'],'docs/HOSTS.md'),
('workspace-isolation','IsolationDecision/WorkspaceLease/Runtime','plugin/src/contracts/workspace.ts',['plugin/src/runtime/workspace/runtime.ts','plugin/src/runtime/workspace/executor.ts'],['plugin/src/opencode/open-code-workspace-adapter.ts'],['plugin/test/w1-workspace-contract.test.mjs','plugin/test/w2-workspace-executor.test.mjs'],'docs/HOSTS.md'),
('browser','BrowserObservation/Runtime','plugin/src/contracts/browser-observation.ts',['plugin/src/runtime/browser/runtime.ts','plugin/src/runtime/browser/executor.ts','plugin/src/runtime/browser/ownership.ts'],['plugin/src/opencode/playwright-browser-adapter.ts'],['plugin/test/b1-browser-observation-contract.test.mjs','plugin/test/b3-playwright-browser-runtime.test.mjs','plugin/test/b3-methodology-exit-evidence.test.mjs'],'docs/HOSTS.md'),
('host-port','OpenCodeHostPort','plugin/src/opencode/host-port.ts',['plugin/src/opencode/client-adapter.ts','plugin/src/opencode/event-adapter.ts','plugin/src/opencode/capabilities.ts'],['plugin/src/plugin.ts'],['plugin/test/a6-host-port-typing.test.mjs'],'docs/HOSTS.md'),
('persistence-storage','Mission persistence + storage ownership','plugin/src/runtime/state/persistence.ts',['plugin/src/runtime/state/snapshot.ts','plugin/src/runtime/storage/ownership.ts','plugin/src/contracts/storage-ownership.ts'],['plugin/src/runtime/mission/mission-store.ts'],['plugin/test/a4-persistence-validator-composition.test.mjs','plugin/test/storage-ownership-contract.test.mjs'],'docs/STORAGE-ARCHITECTURE.md'),
('install-lifecycle','native_plugin_setup.py','scripts/native_plugin_setup.py',[],['project-opencode-config'],['tests/test_hi.py'],'docs/INSTALLATION.md'),
('privacy','PrivacyBoundary','plugin/src/runtime/privacy/boundary.ts',[],['plugin/src/runtime/task/task-runtime.ts'],['plugin/test/hi-core-evolution.test.mjs'],'docs/PRIVACY.md'),
('scheduler','ConcurrencyScheduler','plugin/src/runtime/scheduler/concurrency.ts',['plugin/src/runtime/scheduler/parallel-safety.ts'],['plugin/src/runtime/task/task-runtime.ts'],['plugin/test/scheduler-hardening.test.mjs'],'docs/BENCHMARKS.md'),
('telemetry','Mission-derived ledger metrics','plugin/src/runtime/ledger/ledger.ts',['plugin/src/runtime/ledger/metrics.ts','plugin/src/runtime/ledger/report.ts','plugin/src/runtime/ledger/status.ts'],['plugin/src/runtime/telemetry/benchmarks.ts'],['plugin/test/ledger-status-metrics.test.mjs','plugin/test/hi-benchmarks.test.mjs'],'docs/BENCHMARKS.md'),
]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    rows=[]; missing=[]
    for area,owner,owner_path,producers,consumers,proofs,doc in AREAS:
        paths=[owner_path,*producers,*consumers,*proofs,doc]
        for x in paths:
            # symbolic host/config consumer names are allowed only when explicitly not repository paths
            if '/' not in x and '.' not in x:continue
            p=ROOT/x
            if not p.exists():missing.append({'area':area,'path':x})
        op=ROOT/owner_path
        rows.append({'area':area,'canonical_owner':owner,'owner_path':owner_path,'owner_sha256':digest(op) if op.is_file() else None,'producer_or_contract_paths':producers,'consumer_or_executor_paths':consumers,'proof_paths':proofs,'canonical_doc':doc})
    status='PASS' if not missing else 'FAIL'
    out={'schema':1,'release':(ROOT/'VERSION').read_text(encoding='utf-8').strip(),'kind':'PRODUCT_TRUTH_TRACE_INVENTORY','status':status,'claim_boundary':'Derived documentation/reconstruction trace map only; listed runtime/contracts remain semantic owners.','areas':rows,'violations':{'missing_paths':missing}}
    OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'product truth inventory {status}: areas={len(rows)} missing={len(missing)}')
    if missing:print(json.dumps(missing,indent=2))
    return 0 if status=='PASS' else 1
if __name__=='__main__':sys.exit(main())
