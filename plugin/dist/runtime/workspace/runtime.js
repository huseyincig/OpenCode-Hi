import { createHash, randomUUID } from 'node:crypto';
import { isIsolationDecisionContract, isWorkspaceLeaseContract } from '../../contracts/workspace.js';
import { appendLedger } from '../ledger/ledger.js';
function leaseID() { return `lease_${createHash('sha256').update(randomUUID()).digest('hex').slice(0, 24)}`; }
function replaceLease(m, lease) { const i = m.execution.workspace_leases.findIndex(x => x.lease_id === lease.lease_id); if (i >= 0)
    m.execution.workspace_leases[i] = lease;
else
    m.execution.workspace_leases.push(lease); }
export class WorkspaceRuntime {
    executor;
    projectRoot;
    constructor(executor, projectRoot) {
        this.executor = executor;
        this.projectRoot = projectRoot;
    }
    decision(m, task, input) {
        const d = { required: input.required, reason: input.reason.trim(), strategy: input.required ? 'git-worktree' : 'none', scope: [...task.scope], requested_by: `task:${task.id}` };
        if (!isIsolationDecisionContract(d))
            throw new Error('Invalid Hi IsolationDecision');
        m.execution.isolation_decisions.push(d);
        appendLedger(m, 'workspace.isolation-decided', { task_id: task.id, payload: { required: d.required, strategy: d.strategy, scope: d.scope.slice(0, 40), reason: d.reason.slice(0, 300) } });
        return d;
    }
    async provision(m, task, decision) {
        if (!decision.required || decision.strategy !== 'git-worktree')
            throw new Error('Hi WorkspaceRuntime provision requires a git-worktree isolation decision');
        if (m.execution.workspace_leases.some(x => x.task_id === task.id && x.status !== 'CLOSED'))
            throw new Error(`Task ${task.id} already owns an active workspace lease`);
        const sourceBaseline = await this.executor.sourceBaseline(this.projectRoot), native = await this.executor.provision({ mission_id: m.identity.mission_id, task_id: task.id, repository_root: this.projectRoot, source_baseline: sourceBaseline });
        const lease = { lease_id: leaseID(), mission_id: m.identity.mission_id, task_id: task.id, repository_root: this.projectRoot, base_ref: sourceBaseline, workspace_path: native.workspace_path, host_workspace_id: native.host_workspace_id, ...(native.branch ? { branch: native.branch } : {}), created_at: Date.now(), status: 'ACTIVE', cleanup_state: 'ACTIVE', source_baseline: sourceBaseline };
        if (!isWorkspaceLeaseContract(lease)) {
            try {
                await this.executor.cleanup(lease);
            }
            catch { }
            ;
            throw new Error('Workspace adapter returned an invalid Hi WorkspaceLease');
        }
        m.execution.workspace_leases.push(lease);
        appendLedger(m, 'workspace.provisioned', { task_id: task.id, payload: { lease_id: lease.lease_id, host_workspace_id: lease.host_workspace_id, workspace_path: lease.workspace_path, source_baseline: lease.source_baseline } });
        return lease;
    }
    forTask(m, taskID) { return m.execution.workspace_leases.find(x => x.task_id === taskID && x.status !== 'CLOSED'); }
    async cleanup(m, leaseID) {
        const lease = m.execution.workspace_leases.find(x => x.lease_id === leaseID);
        if (!lease)
            return false;
        if (lease.status === 'CLOSED' && lease.cleanup_state === 'CLEANED')
            return true;
        if (lease.status === 'ORPHANED')
            return false;
        lease.status = 'RECONCILING';
        lease.cleanup_state = 'CLEANUP_PENDING';
        appendLedger(m, 'workspace.cleanup-started', { task_id: lease.task_id, payload: { lease_id: lease.lease_id, workspace_path: lease.workspace_path } });
        try {
            await this.executor.cleanup(lease);
            lease.status = 'CLOSED';
            lease.cleanup_state = 'CLEANED';
            appendLedger(m, 'workspace.cleaned', { task_id: lease.task_id, payload: { lease_id: lease.lease_id } });
            return true;
        }
        catch (error) {
            lease.status = 'ORPHANED';
            lease.cleanup_state = 'QUARANTINED';
            const marker = `workspace-orphan:${lease.lease_id}`;
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
            appendLedger(m, 'workspace.cleanup-failed', { task_id: lease.task_id, payload: { lease_id: lease.lease_id, error: String(error) } });
            return false;
        }
    }
    async cleanupTask(m, taskID) { const lease = this.forTask(m, taskID); return lease ? this.cleanup(m, lease.lease_id) : true; }
    async cleanupMission(m) { let n = 0; for (const lease of [...m.execution.workspace_leases])
        if (!['CLOSED', 'ORPHANED'].includes(lease.status))
            if (await this.cleanup(m, lease.lease_id))
                n++; return n; }
    async reconcileRestored(missions) {
        for (const m of missions)
            for (const stored of m.execution.workspace_leases) {
                if (stored.status === 'CLOSED' && stored.cleanup_state === 'CLEANED')
                    continue;
                try {
                    const result = await this.executor.reconcile(stored);
                    replaceLease(m, result.lease);
                    appendLedger(m, 'workspace.restart-reconciled', { task_id: stored.task_id, payload: { lease_id: stored.lease_id, disposition: result.disposition, status: result.lease.status, cleanup_state: result.lease.cleanup_state } });
                    if (result.disposition === 'ORPHANED') {
                        m.execution.blockers = [...new Set([...m.execution.blockers, `workspace-orphan:${stored.lease_id}`])];
                        const task = m.execution.tasks.find(t => t.id === stored.task_id), worker = m.execution.workers.find(w => w.task_id === stored.task_id);
                        if (task && !['completed', 'failed', 'cancelled'].includes(task.status)) {
                            task.status = 'blocked';
                            task.updated_at = Date.now();
                            task.result = { status: 'BLOCKED', summary: 'Required isolated workspace ownership could not be reconciled after restart.', changed_files: [], evidence: [], open_issues: [`workspace-orphan:${stored.lease_id}`], needs_context: ['reconcile or explicitly replace the orphaned workspace lease'] };
                        }
                        if (worker && !['completed', 'failed', 'cancelled'].includes(worker.status)) {
                            worker.status = 'ready';
                            worker.restart_reconcile_pending = true;
                            worker.updated_at = Date.now();
                        }
                    }
                }
                catch (error) {
                    const orphan = { ...stored, status: 'ORPHANED', cleanup_state: 'QUARANTINED' };
                    replaceLease(m, orphan);
                    m.execution.blockers = [...new Set([...m.execution.blockers, `workspace-orphan:${stored.lease_id}`])];
                    const task = m.execution.tasks.find(t => t.id === stored.task_id), worker = m.execution.workers.find(w => w.task_id === stored.task_id);
                    if (task && !['completed', 'failed', 'cancelled'].includes(task.status)) {
                        task.status = 'blocked';
                        task.updated_at = Date.now();
                        task.result = { status: 'BLOCKED', summary: 'Required isolated workspace ownership could not be reconciled after restart.', changed_files: [], evidence: [], open_issues: [`workspace-orphan:${stored.lease_id}`], needs_context: ['reconcile or explicitly replace the orphaned workspace lease'] };
                    }
                    if (worker && !['completed', 'failed', 'cancelled'].includes(worker.status)) {
                        worker.status = 'ready';
                        worker.restart_reconcile_pending = true;
                        worker.updated_at = Date.now();
                    }
                    appendLedger(m, 'workspace.restart-reconcile-failed', { task_id: stored.task_id, payload: { lease_id: stored.lease_id, error: String(error) } });
                }
            }
    }
}
