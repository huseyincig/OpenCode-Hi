#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-process-workspace-browser-lifecycle.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def row(section,name,owner,oa,proof,pa,level='CONTROLLED'):
 op,pp=ROOT/owner,ROOT/proof
 if not op.is_file(): violations.append(f'{section}:{name}:missing-owner:{owner}');return
 if not pp.is_file(): violations.append(f'{section}:{name}:missing-proof:{proof}');return
 ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
 if oa not in ot:violations.append(f'{section}:{name}:owner-anchor-drift:{oa}')
 if pa not in pt:violations.append(f'{section}:{name}:proof-anchor-drift:{pa}')
 rows.append({'section':section,'invariant':name,'level':level,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
violations=[];rows=[]
cm=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text())
caps=cm['current_reference_host']['capabilities']
pr=caps['process-lifecycle']['receipt'];wr=caps['workspace-isolation-binding']['receipt'];br=caps['browser-execution']['receipt']
# §12 Process lifecycle — prompt lines 1411-1433.
P=[
('spawn','plugin/src/opencode/open-code-pty-adapter.ts','async spawn(',pr,'process_spawn_pid','T3'),
('pid','plugin/src/contracts/process.ts','pid:number',pr,'process_spawn_pid','T3'),
('process-group','plugin/src/opencode/open-code-pty-adapter.ts','process_group_id',pr,'process_group_identity','T3'),
('cwd','plugin/src/contracts/process.ts','cwd:string',pr,'process_spawn_pid','T3'),
('task-worker-owner','plugin/src/contracts/process.ts','worker_id:string','plugin/test/p3-process-runtime-lifecycle.test.mjs','Mission execution owns durable ProcessContract registry','CONTROLLED'),
('bounded-output','plugin/src/opencode/open-code-pty-adapter.ts','maxBufferedChars','plugin/test/p2-opencode-pty-executor.test.mjs','huge unread PTY output remains bounded','CONTROLLED'),
('stdin','plugin/src/opencode/open-code-pty-adapter.ts','async write(','plugin/test/p2-opencode-pty-executor.test.mjs','stdin write uses the live websocket','CONTROLLED'),
('wait','plugin/src/runtime/continuation/evaluator.ts','waiting-process','plugin/test/p3-process-runtime-lifecycle.test.mjs','running process makes continuation WAIT','CONTROLLED'),
('exit','plugin/src/opencode/open-code-pty-adapter.ts',"status='EXITED'",'plugin/test/p2-opencode-pty-executor.test.mjs','natural exit records nonzero exit code','CONTROLLED'),
('timeout','plugin/src/opencode/open-code-pty-adapter.ts','#requestTimeout',pr,'process_timeout_group_signal','T3'),
('kill','plugin/src/opencode/open-code-pty-adapter.ts','async kill(',pr,'process_kill_cleanup','T3'),
('cleanup','plugin/src/opencode/open-code-pty-adapter.ts','async cleanup(',pr,'process_host_cleanup_empty','T3'),
('restart','plugin/src/opencode/open-code-pty-adapter.ts','async reconcile(',pr,'process_restart_adoption','T3'),
('orphan-reconciliation','plugin/src/opencode/open-code-pty-adapter.ts',"status='ORPHANED'",'plugin/test/p3-process-runtime-lifecycle.test.mjs','quarantines orphan without signalling it','CONTROLLED'),
('evidence','plugin/src/runtime/process/runtime.ts',"kind:'diagnostic-evidence'",'plugin/test/p3-process-runtime-lifecycle.test.mjs','records hash-bound pending Evidence','CONTROLLED'),
('quick-exit-before-observation','plugin/src/opencode/open-code-pty-adapter.ts','#applyInfo',pr,'process_quick_exit_before_observation','T3'),
('parent-death','plugin/src/runtime/process/runtime.ts','stopMission','plugin/test/p3-process-control-integration.test.mjs','parent session deletion stops mission and process runtime','CONTROLLED'),
('stale-reused-pid','plugin/src/opencode/open-code-pty-adapter.ts','PID identity changed','plugin/test/p2-opencode-pty-executor.test.mjs','stale PID mismatch is fail-closed','CONTROLLED'),
('surviving-process-group','plugin/src/opencode/open-code-pty-adapter.ts','#signalTarget',pr,'process_group_identity','T3'),
('kill-failure','plugin/src/opencode/open-code-pty-adapter.ts','this.signalProcess(target,signal)','plugin/test/p2-opencode-pty-executor.test.mjs','kill signalling failure does not fabricate TERMINATED','CONTROLLED'),
('permission-denied','plugin/src/runtime/process/authority.ts','DENY','plugin/test/p3-process-runtime-lifecycle.test.mjs','explicit permission deny never asks and never spawns','CONTROLLED'),
('nonzero-exit','plugin/src/opencode/open-code-pty-adapter.ts','exit_code',pr,'process_nonzero_exit','T3'),
('long-running-and-concurrent','plugin/src/runtime/continuation/evaluator.ts','waiting-process','plugin/test/p2-opencode-pty-executor.test.mjs','concurrent owned PTYs keep output cursors and buffers isolated','CONTROLLED'),
]
for x in P: row(12,*x)
# §13 Workspace isolation — prompt lines 1437-1454.
W=[
('isolation-decision','plugin/src/runtime/workspace/runtime.ts','decision(','plugin/test/w1-workspace-contract.test.mjs','IsolationDecision is strict','CONTROLLED'),
('workspace-lease','plugin/src/contracts/workspace.ts','WorkspaceLeaseContract','plugin/test/w1-workspace-contract.test.mjs','WorkspaceLease separates lifecycle','CONTROLLED'),
('provision','plugin/src/runtime/workspace/runtime.ts','async provision(',wr,'workspace_create','T3'),
('task-worker-binding','plugin/src/runtime/workspace/runtime.ts','task_id:task.id','plugin/test/w2-workspace-executor.test.mjs','explicit isolated task provisions one lease','CONTROLLED'),
('host-session-binding','plugin/src/runtime/task/child-execution-coordinator.ts','workspaceID',wr,'workspace_child_id_directory_binding','T3'),
('observed-cwd-workspace-identity','plugin/src/opencode/open-code-workspace-adapter.ts','workspacePath',wr,'workspace_observed_cwd_identity','T3'),
('isolated-writes','plugin/src/runtime/workspace/runtime.ts','workspace_path',wr,'workspace_write_isolation','T3'),
('leased-verification','plugin/src/opencode/open-code-workspace-adapter.ts','sourceBaseline',wr,'workspace_verification','T3'),
('reconcile','plugin/src/runtime/workspace/runtime.ts','reconcileRestored',wr,'workspace_restart_adoption','T3'),
('cleanup','plugin/src/runtime/workspace/runtime.ts','async cleanup(',wr,'workspace_cleanup','T3'),
('symlink-traversal','plugin/src/opencode/open-code-workspace-adapter.ts','realpathSync','plugin/test/w2-workspace-executor.test.mjs','symlinked workspace escape is canonicalized and rejected','CONTROLLED'),
('realpath','plugin/src/opencode/open-code-workspace-adapter.ts','canonicalExisting','plugin/test/w2-workspace-executor.test.mjs','default Git inspector accepts an actual detached registered worktree','CONTROLLED'),
('branch-collision','plugin/src/opencode/open-code-workspace-adapter.ts',"type:'worktree'",'plugin/test/w2-workspace-executor.test.mjs','branch,undefined','CONTROLLED'),
('nested-repository','plugin/src/opencode/open-code-workspace-adapter.ts','sameRepository','plugin/test/w2-workspace-executor.test.mjs','same Git common repository','CONTROLLED'),
('dirty-user-tree','plugin/src/opencode/open-code-workspace-adapter.ts','defaultInspect','plugin/test/w2-workspace-executor.test.mjs','preserves pre-staged and unstaged user changes exactly','CONTROLLED'),
('staged-user-files','plugin/src/opencode/open-code-workspace-adapter.ts','defaultInspect','plugin/test/w2-workspace-executor.test.mjs','pre-staged and unstaged user changes exactly','CONTROLLED'),
('concurrent-leases','plugin/src/runtime/workspace/runtime.ts','identityConflict','plugin/test/w2-workspace-executor.test.mjs','concurrent lease identity collision is cleaned and rejected','CONTROLLED'),
('persisted-duplicate-lease-identity','plugin/src/runtime/mission/validators.ts','activeWorkspacePaths','plugin/test/w1-workspace-contract.test.mjs','cannot share host or filesystem identity across tasks','CONTROLLED'),
('stale-lease','plugin/src/runtime/workspace/runtime.ts',"status:'ORPHANED'",'plugin/test/w2-workspace-executor.test.mjs','restart adopts exact lease, quarantines missing owner','CONTROLLED'),
('crash-restart','plugin/src/runtime/workspace/runtime.ts','reconcileRestored',wr,'workspace_restart_adoption','T3'),
('cleanup-failure','plugin/src/runtime/workspace/runtime.ts','workspace.cleanup-failed','plugin/test/w2-workspace-executor.test.mjs','workspace cleanup failure quarantines lease','CONTROLLED'),
('merge-reconcile-conflict','plugin/src/opencode/open-code-workspace-adapter.ts','Source baseline changed','plugin/test/w2-workspace-executor.test.mjs','source-baseline substitution','CONTROLLED'),
('user-owned-changes','plugin/src/opencode/open-code-workspace-adapter.ts','worktree','plugin/test/w2-workspace-executor.test.mjs','preserves pre-staged and unstaged user changes exactly','CONTROLLED'),
('no-broad-staging-autocommit','plugin/src/runtime/workspace/runtime.ts','WorkspaceRuntime','plugin/test/w2-workspace-executor.test.mjs','no broad auto-snapshot staging','CONTROLLED'),
]
for x in W: row(13,*x)
# §14 Browser / visual execution — prompt lines 1458-1462.
B=[
('navigation','plugin/src/opencode/playwright-browser-adapter.ts','async navigate(',br,'browser_dynamic_route_state','T3'),
('dom-observation','plugin/src/opencode/playwright-browser-adapter.ts','dom_summary','plugin/test/b3-playwright-browser-runtime.test.mjs','emits bounded observations','CONTROLLED'),
('selectors','plugin/src/opencode/playwright-browser-adapter.ts','targetRef','plugin/test/b3-playwright-browser-runtime.test.mjs','local-scope, task-isolated','CONTROLLED'),
('console','plugin/src/opencode/playwright-browser-adapter.ts','consoleErrors','plugin/test/b3-playwright-browser-runtime.test.mjs','capture bounded console and network failures','CONTROLLED'),
('network','plugin/src/opencode/playwright-browser-adapter.ts','networkErrors','plugin/test/b3-playwright-browser-runtime.test.mjs','capture bounded console and network failures','CONTROLLED'),
('screenshot-artifact','plugin/src/opencode/playwright-browser-adapter.ts','persistScreenshot',br,'browser_screenshot_artifact','T3'),
('timeout','plugin/src/opencode/playwright-browser-adapter.ts','timeoutMs','plugin/test/b3-playwright-browser-runtime.test.mjs','navigation timeout and browser crash become explicit FAILED','CONTROLLED'),
('browser-crash','plugin/src/opencode/playwright-browser-adapter.ts',"result:'OBSERVED'|'FAILED'",'plugin/test/b3-playwright-browser-runtime.test.mjs','browser crash become explicit FAILED observations','CONTROLLED'),
('stale-element','plugin/src/opencode/playwright-browser-adapter.ts','latest bounded observation',br,'browser_stale_element_rejection','T3'),
('auth-state','plugin/src/opencode/playwright-browser-adapter.ts','executionOwnerRef',br,'browser_auth_state_reset','T3'),
('dangerous-external-action','plugin/src/opencode/playwright-browser-adapter.ts','outside supported local scope',br,'browser_external_target_rejection','T3'),
('evidence-chain','plugin/src/contracts/browser-observation.ts','BrowserObservationContract','plugin/test/b1-browser-observation-contract.test.mjs','observation remains non-Evidence','CONTROLLED'),
('methodology-interpretation','plugin/src/runtime/methodology/exit.ts','methodologyExitCheck','plugin/test/b3-methodology-exit-evidence.test.mjs','outcome-less browser/visual evidence pending rather than implicit PASS','CONTROLLED'),
('model-prose-not-visual-verification','plugin/src/runtime/completion/evaluator.ts','open-obligations','plugin/test/prompt-b-evidence-verification-completion-hostile.test.mjs','DONE. all tests passed. safe to release.','CONTROLLED'),
]
for x in B: row(14,*x)
# Capability source-equivalence: a selected exact receipt may predate current HEAD only when every capability-relevant runtime owner hash is byte-identical.
relevant={
 'process-lifecycle':['plugin/src/contracts/process.ts','plugin/src/runtime/process/executor.ts','plugin/src/runtime/process/runtime.ts','plugin/src/opencode/open-code-pty-adapter.ts','plugin/src/contracts/host-capability.ts'],
 'workspace-isolation-binding':['plugin/src/contracts/workspace.ts','plugin/src/runtime/workspace/executor.ts','plugin/src/runtime/workspace/runtime.ts','plugin/src/runtime/mission/validators.ts','plugin/src/opencode/open-code-workspace-adapter.ts','plugin/src/runtime/task/child-execution-coordinator.ts','plugin/src/contracts/host-capability.ts'],
 'browser-execution':['plugin/src/contracts/browser-observation.ts','plugin/src/runtime/browser/executor.ts','plugin/src/runtime/browser/runtime.ts','plugin/src/runtime/browser/ownership.ts','plugin/src/opencode/playwright-browser-adapter.ts','plugin/src/runtime/application/hi-tool-surface.ts','plugin/src/contracts/host-capability.ts'],
}
equiv={}
for cap,paths in relevant.items():
 entry=caps[cap]; receipt=json.loads((ROOT/entry['receipt']).read_text()); rh=receipt.get('source_binding',{}).get('runtime_hashes',{}); drift=[]
 for rel in paths:
  current=sha(rel); expected=rh.get(rel)
  if current!=expected:drift.append(rel)
 equiv[cap]={'receipt':entry['receipt'],'status':entry['status'],'tested_git_commit':entry['tested_git_commit'],'runtime_hash_drift':drift,'equivalent':not drift}
 if entry['status']!='SUPPORTED_T3' or drift:violations.append(f'{cap}:selected-T3-source-drift:{drift}')
expected={12:len(P),13:len(W),14:len(B)}
covered={s:sum(1 for r in rows if r['section']==s) for s in expected}
status='PASS' if not violations and covered==expected else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_PROCESS_WORKSPACE_BROWSER_LIFECYCLE_ADVERSARIAL_AUDIT','program':'PROMPT_B','sections':[12,13,14],'status':status,'invariants':rows,'capability_source_equivalence':equiv,'violations':violations,'summary':{'required':sum(expected.values()),'covered':len(rows),'violations':len(violations),'by_section':{str(k):{'required':v,'covered':covered[k]} for k,v in expected.items()}},'closed_defects':[{'id':'browser-cross-execution-owner-state-leak','fix':'Browser sessions are bound to exact execution_owner_ref and stale owners are rejected/reset.'},{'id':'workspace-forged-isolation-decision','fix':'Workspace provision requires canonical Mission-owned exact-Task IsolationDecision.'},{'id':'process-kill-failure-false-termination','fix':'Kill/timeout semantic flags are committed only after successful signal delivery.'},{'id':'process-group-unverified-signal','fix':'Linux process-group signalling requires independently observed isolated pgrp==owned PID and fails closed on drift.'},{'id':'duplicate-active-workspace-identity','fix':'Different Tasks cannot own the same active workspace path or host workspace ID; collision is cleaned/rejected and persisted duplicates fail validation.'}],'claim_boundary':'SUPPORTED_T3 is accepted only with exact OpenCode 1.18.18 receipt evidence and byte-identical current capability owner/executor hashes. Controlled hostile tests close deterministic local semantics that do not require a live host.'}
OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"lifecycle audit {status}: covered={len(rows)}/{sum(expected.values())} violations={len(violations)}")
if violations: print(json.dumps(data,indent=2))
sys.exit(0 if status=='PASS' else 1)
