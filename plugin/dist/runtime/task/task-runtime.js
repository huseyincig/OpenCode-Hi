import { resolveCategory } from '../routing/category.js';
import { resolveModel, runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { methodologySkillCandidates, resolveSkillPlan } from '../skills/registry.js';
import { resolveSkillPermissionMap, resolveSkillToolEnabled } from '../skills/permissions.js';
import { createTask, createWorker, beginWorkerAttempt, workerFingerprint } from '../worker/worker-runtime.js';
import { workerHandoffText } from './contracts.js';
import { parseWorkerResult } from './result-parser.js';
import { appendLedger } from '../ledger/ledger.js';
import { routeCapabilities } from '../routing/capability-router.js';
import { verificationEconomyInstruction } from '../verification/policy.js';
import { targetedVerificationHint } from '../verification/discovery.js';
import { bindMethodologyNeeds, methodologyNames } from '../methodology/activation.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { methodologyProvenance, ownershipContract } from '../skills/methodology.js';
import { DEFAULT_CONTEXT_BUDGET, clipList, clipText } from '../context/budget.js';
import { projectContextGroups, renderProjectedContext } from '../context/projection.js';
import { runtimeSignal } from '../events/event-sink.js';
import { syncMissionGates } from '../gates/gates.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { evaluateTaskPreconditions, TaskPreconditionError } from '../readiness/preconditions.js';
import { effectiveExecutionSurface, resolveMcpServerExposure, taskPromptToolOverrides } from '../routing/execution-profile.js';
import { HI_BROWSER_EXECUTION_TOOL_IDS } from '../browser/executor.js';
import { browserOriginsFromTargets, normalizeBrowserAllowedOrigins, resolveBrowserBackend } from '../browser/backend-policy.js';
import { ProjectMethodologyLearningStore } from '../project-intelligence/methodology-learning.js';
import { executionProfileFor } from '../../config/execution-policy.js';
import { applyAdmittedProjectMethodologyPermissions } from '../methodology/host-permissions.js';
import { HI_CHILD_ROLES, isHiChildRole, isHiReadOnlyChildRole, isHiReviewerRole, roleCanOwnObligation } from '../roles/catalog.js';
import { renderSemanticContext, semanticContextsForTargets } from '../semantic/typescript-context.js';
import { createRuntimeScopedStores } from '../application/runtime-scoped-stores.js';
import { ChildExecutionCoordinator } from './child-execution-coordinator.js';
import { admitHostTerminalEvent } from './host-child-binding.js';
import { TaskResultReconciler } from './task-result-reconciler.js';
import { TaskRecoveryCoordinator } from './task-recovery-coordinator.js';
import { taskRuntimeAdmittedModel, taskRuntimeUnitDecision, reserveTaskRuntimeDispatch, bindTaskRuntimeHost, releaseTaskRuntimeReservation, reconcileTaskRuntimeRestart } from '../scheduler/task-runtime-adapter.js';
import { clearCapabilityUnavailable, markCapabilityUnavailable, markVerificationCapabilityUnavailable, reconcileTaskCapabilityPreconditions } from '../readiness/capability-failure.js';
import { bindWorkerUsageObservation } from '../economics/usage-runtime.js';
import { DependencyOutcomeProjectionError, projectDirectDependencyOutcomes, renderDirectDependencyOutcomeContext } from '../execution/dependency-outcome-projection.js';
import { recordRecoveryStrategy, recoveryModelHazard } from '../continuation/recovery-governor.js';
import { deniedMutationAtoms } from '../constraint/constraint-atoms.js';
const CATEGORIES = new Set(['quick', 'standard', 'deep', 'visual', 'critical']);
const MAX_QUEUE = 32;
class TaskQueueCapacityError extends Error {
    constructor() { super('Hi bounded dispatch queue is full'); this.name = 'TaskQueueCapacityError'; }
}
function inferObligationIds(m, role, requiredEvidence, explicit = []) {
    const requested = [...new Set(explicit)].map(id => m.execution.obligations.find(o => o.id === id && o.status === 'open')).filter(Boolean);
    const disallowed = requested.filter(o => !roleCanOwnObligation(role, o.kind));
    if (disallowed.length)
        throw new Error(`Role ${role} cannot own obligation(s): ${disallowed.map(o => `${o.id}:${o.kind}`).join(', ')}`);
    if (requested.length)
        return requested.map(o => o.id);
    const kinds = [];
    if (role === 'coder')
        kinds.push('implementation');
    if (['repository-explorer', 'architect'].includes(role) || role === 'coder' && ['bug-fix', 'diagnosis', 'performance'].includes(m.identity.intent.taskKind))
        kinds.push('analysis');
    if (isHiReviewerRole(role))
        kinds.push('review');
    if (requiredEvidence.length)
        kinds.push('verification');
    const out = [];
    for (const kind of [...new Set(kinds)].filter(k => roleCanOwnObligation(role, k))) {
        const candidates = m.execution.obligations.filter(o => o.kind === kind && o.status === 'open');
        if (candidates.length === 1)
            out.push(candidates[0].id);
    }
    return [...new Set(out)];
}
function providerOf(model) { return model && model !== 'host-default' && model.includes('/') ? model.slice(0, model.indexOf('/')) : undefined; }
export class TaskRuntime {
    childHost;
    registry;
    scheduler;
    projectRoot;
    hiRoot;
    getConfig;
    getModels;
    getHostConfig;
    events;
    hostCapabilitySource;
    workspaceRuntime;
    extraHostResources;
    browserExecutor;
    ensureBrowserResource;
    readAssistantResult;
    previewManager;
    #queue = [];
    #draining = false;
    #methodologyLearning;
    #child;
    #results;
    #recovery;
    #scopedStores;
    constructor(childHost, registry, scheduler, projectRoot, hiRoot, getConfig, getModels, getHostConfig, events, hostCapabilitySource = [], scopedStores, workspaceRuntime, extraHostResources = () => new Set(), browserExecutor, ensureBrowserResource, readAssistantResult, previewManager) {
        this.childHost = childHost;
        this.registry = registry;
        this.scheduler = scheduler;
        this.projectRoot = projectRoot;
        this.hiRoot = hiRoot;
        this.getConfig = getConfig;
        this.getModels = getModels;
        this.getHostConfig = getHostConfig;
        this.events = events;
        this.hostCapabilitySource = hostCapabilitySource;
        this.workspaceRuntime = workspaceRuntime;
        this.extraHostResources = extraHostResources;
        this.browserExecutor = browserExecutor;
        this.ensureBrowserResource = ensureBrowserResource;
        this.readAssistantResult = readAssistantResult;
        this.previewManager = previewManager;
        this.#scopedStores = scopedStores ?? createRuntimeScopedStores(projectRoot, hiRoot);
        this.#methodologyLearning = new ProjectMethodologyLearningStore(projectRoot);
        this.#child = new ChildExecutionCoordinator(childHost, registry);
        this.#results = new TaskResultReconciler(scheduler, registry, projectRoot, events, this.#methodologyLearning, this.#child, getHostConfig, (m, w, run) => this.queueTask(m, w, run), () => this.drainQueue(), this.#scopedStores);
        this.#recovery = new TaskRecoveryCoordinator(scheduler, registry, projectRoot, getConfig, getModels, getHostConfig, events, this.#child, () => this.drainQueue(), (m, taskID) => this.workspaceBinding(m, taskID));
    }
    async sendProviderPrompt(sessionID, text, role, model, variant, tools) { return this.#child.sendProviderPrompt(sessionID, text, role, model, variant, tools); }
    recordModelProjection(worker, model, variant) { this.#child.recordModelProjection(worker, model, variant); }
    async abortNativeSession(m, sessionID, reason, workerID, taskID) { return this.#child.abortNativeSession(m, sessionID, reason, workerID, taskID); }
    async captureNativeDiff(worker, phase) { return this.#child.captureNativeDiff(worker, phase); }
    async reconcileNativeResult(m, workerID, result) { return this.#results.reconcileNativeResult(m, workerID, result); }
    async reintegrateWorkspaceResult(m, workerID, result) {
        const worker = m.execution.workers.find(w => w.id === workerID), task = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : undefined, lease = task ? this.workspaceRuntime?.forTask(m, task.id) : undefined;
        if (!worker || !task || !lease || isHiReadOnlyChildRole(worker.role) || result.status !== 'DONE' || !result.changed_files.length)
            return result;
        if (!worker.session_id) {
            const marker = `workspace-reintegration-failed:${task.id}:session-missing`;
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
            appendLedger(m, 'workspace.reintegration-blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: 'session-missing', lease_id: lease.lease_id } });
            return { ...result, status: 'BLOCKED', summary: 'Isolated write result cannot be reintegrated because the exact child session identity is missing.', open_issues: [...new Set([...result.open_issues, marker])], needs_context: [...new Set([...result.needs_context, 'preserve the isolated workspace lease and reconcile exact child/session ownership before retrying reintegration'])] };
        }
        try {
            const applied = await this.workspaceRuntime.reintegrate(m, task.id, worker.session_id, result.changed_files);
            return { ...result, changed_files: applied };
        }
        catch (error) {
            const marker = `workspace-reintegration-failed:${task.id}`;
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
            appendLedger(m, 'workspace.reintegration-blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: String(error), lease_id: lease.lease_id, changed_files: result.changed_files.slice(0, 40) } });
            return { ...result, status: 'BLOCKED', summary: `Isolated workspace result could not be safely reintegrated into the primary checkout. ${String(error)}`.slice(0, 1200), open_issues: [...new Set([...result.open_issues, marker])], needs_context: [...new Set([...result.needs_context, 'preserve the isolated workspace lease; reconcile primary dirty state/native workspace ownership before retrying'])] };
        }
    }
    noteUsage(m, workerID, usage) { const worker = m.execution.workers.find(w => w.id === workerID); if (worker)
        bindWorkerUsageObservation(m, worker, usage); }
    noteEffectiveModel(m, workerID, observed) { return this.#child.noteEffectiveModel(m, workerID, observed); }
    resolveChildCallback(sessionID) { return this.#child.resolveCallbackWorker(sessionID); }
    admitTerminalEvent(m, worker) { return admitHostTerminalEvent(m, worker, this.childHost); }
    async settleHostIdleRuntimeError(m, worker, error) {
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return { applied: false, reason: 'task-not-found' };
        const detail = [error.name, error.message].filter(Boolean).join(': ');
        await this.cleanupBrowserForTask(m, worker.task_id, worker.id);
        const recovery = await this.#recovery.recoverHostTerminalFailure(m, worker.id, error);
        worker.restart_reconcile_pending = false;
        if (recovery === 'RECOVERED')
            return { applied: true, reason: 'host-idle-runtime-fallback', wakeResult: 'RUNTIME_FALLBACK', failureKind: worker.last_runtime_failure_kind };
        if (recovery === 'QUARANTINED')
            return { applied: true, reason: 'host-idle-runtime-fallback-quarantined', wakeResult: 'QUARANTINED', failureKind: worker.last_runtime_failure_kind };
        if (task.status === 'blocked') {
            await this.cleanupWorkspaceForTask(m, worker.task_id);
            return { applied: true, reason: 'host-idle-runtime-blocked', wakeResult: 'BLOCKED', failureKind: worker.last_runtime_failure_kind };
        }
        this.fail(m, worker.id, detail);
        await this.cleanupWorkspaceForTask(m, worker.task_id);
        return { applied: true, reason: 'host-idle-runtime-failed', wakeResult: 'FAILED', failureKind: worker.last_runtime_failure_kind };
    }
    async settleHostIdleAssistantResult(m, worker, assistant) {
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return { applied: false, reason: 'task-not-found' };
        if (assistant.usage)
            this.noteUsage(m, worker.id, assistant.usage);
        if (assistant.error)
            return this.settleHostIdleRuntimeError(m, worker, assistant.error);
        if (!assistant.model && !assistant.text)
            return { applied: false, reason: 'assistant-result-not-ready' };
        const effective = this.noteEffectiveModel(m, worker.id, assistant.model ? { ...assistant.model, source: 'assistant-message-metadata' } : undefined);
        let result = parseWorkerResult(assistant.text);
        const unparseableWorkerContract = result.status === 'FAILED' && (result.open_issues ?? []).includes('Worker did not return parseable structured result');
        if (unparseableWorkerContract) {
            result = { ...result, status: 'FIX_REQUIRED', summary: result.summary || 'Worker response did not satisfy the structured WorkerResult contract.', open_issues: [...new Set([...(result.open_issues ?? []), 'worker-result-contract-invalid'])], needs_context: [...new Set([...(result.needs_context ?? []), 'worker-result-contract-retry: continue the same task/session and return the exact structured WorkerResult contract; do not claim completion from prose'])] };
            appendLedger(m, 'worker.result-contract-retryable', { task_id: task.id, worker_id: worker.id, payload: { model: worker.model, attempt: worker.attempt, generation: m.continuation.generation } });
        }
        if (!effective.ok)
            result = { ...result, status: 'BLOCKED', summary: `Effective child model could not be verified against the selected execution model. ${effective.reason}`, open_issues: [...new Set([...(result.open_issues ?? []), effective.reason])], needs_context: [...new Set([...(result.needs_context ?? []), 'effective-model-reconcile: refresh runtime inventory/provider policy and resume with a verified role-selected model'])] };
        result = await this.reconcileNativeResult(m, worker.id, result);
        result = await this.reintegrateWorkspaceResult(m, worker.id, result);
        this.applyResult(m, worker.id, result);
        worker.restart_reconcile_pending = false;
        if (['completed', 'failed', 'cancelled'].includes(worker.status)) {
            await this.cleanupBrowserForTask(m, worker.task_id, worker.id);
            await this.cleanupWorkspaceForTask(m, worker.task_id);
            this.registry.delete(worker.id);
        }
        else
            this.registry.set(worker);
        return { applied: true, reason: 'assistant-result-applied', result };
    }
    childCallbackDisposition(m, worker) { return this.#recovery.callbackDisposition(m, worker); }
    async reconcileRestoredChildren(m) { let reconciled = 0; for (const worker of m.execution.workers.filter(w => w.restart_reconcile_pending && Boolean(w.session_id))) {
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            continue;
        const beforePending = worker.restart_reconcile_pending, beforeStatus = worker.status, beforeTaskStatus = task.status, beforeSchedulerRevision = m.execution.scheduler?.revision ?? 0;
        await this.reconcileRestartBeforeResume(m, worker, task);
        if (worker.restart_reconcile_pending !== beforePending || worker.status !== beforeStatus || task.status !== beforeTaskStatus || (m.execution.scheduler?.revision ?? 0) !== beforeSchedulerRevision)
            reconciled++;
    } if (reconciled)
        syncMissionGates(m); return reconciled; }
    pendingExecutionWorkers(m, excludeWorkerID) { const reserved = new Set((m.execution.scheduler?.reservations ?? []).map(item => item.workerId)), queued = new Set(this.#queue.filter(item => item.mission.identity.mission_id === m.identity.mission_id).map(item => item.worker.id)); return m.execution.workers.filter(worker => worker.id !== excludeWorkerID && (reserved.has(worker.id) || queued.has(worker.id))); }
    queueDepth() { return this.#queue.length; }
    workspaceBinding(m, taskID) { const required = m.execution.isolation_decisions.some(d => d.required && d.requested_by === `task:${taskID}`), lease = this.workspaceRuntime?.forTask(m, taskID); if (required && (!lease || lease.status !== 'ACTIVE' || lease.cleanup_state !== 'ACTIVE' || !lease.host_workspace_id))
        throw new Error(`Required workspace lease is not active for task ${taskID}`); return lease?.host_workspace_id && lease.status === 'ACTIVE' && lease.cleanup_state === 'ACTIVE' ? { workspaceID: lease.host_workspace_id, directory: lease.workspace_path } : undefined; }
    async cleanupWorkspaceForTask(m, taskID) { return this.workspaceRuntime ? this.workspaceRuntime.cleanupTask(m, taskID) : true; }
    async cleanupBrowserForTask(m, taskID, workerID) { await this.previewManager?.stop(taskID); const worker = workerID ? m.execution.workers.find(w => w.id === workerID && w.task_id === taskID) : m.execution.workers.find(w => w.task_id === taskID); if (!this.browserExecutor || !worker?.session_id)
        return true; const context = { task_id: taskID, execution_owner_ref: `${m.identity.mission_id}:${worker.id}:${worker.session_id}:${worker.generation_at_spawn ?? m.continuation.generation}`, executor_version: 'hi-playwright-browser@1', allowed_origins: [...(m.execution.tasks.find(t => t.id === taskID)?.execution_profile?.browser_allowed_origins ?? [])] }; const result = await this.browserExecutor.cleanup(context); if (result.reason === 'close-failed') {
        const marker = `browser-cleanup-failed:${taskID}:${worker.id}`;
        m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
        appendLedger(m, 'browser.cleanup-failed', { task_id: taskID, worker_id: worker.id, payload: { reason: result.reason, error: result.error } });
        return false;
    } appendLedger(m, result.reason === 'owner-mismatch' ? 'browser.cleanup-stale-owner' : 'browser.cleanup', { task_id: taskID, worker_id: worker.id, payload: { reason: result.reason, cleaned: result.cleaned } }); return true; }
    failedDeps(m, deps) { return deps.filter(id => { const status = m.execution.tasks.find(t => t.id === id)?.status; return status === 'failed' || status === 'cancelled'; }); }
    async blockDependencyOutcome(m, task, worker, error) { worker.status = 'failed'; task.status = 'blocked'; task.updated_at = Date.now(); const marker = `dependency-outcome-unavailable:${task.id}`; task.result = { status: 'BLOCKED', summary: `Direct dependency outcome could not be projected safely before dispatch: ${error.message}`.slice(0, 1200), changed_files: [], evidence: [], open_issues: [marker], needs_context: ['reconcile completed dependency result/worker attempt identity before dispatch'] }; m.execution.blockers = [...new Set([...m.execution.blockers, marker])]; this.registry.delete(worker.id); this.scheduler.release(worker.id); releaseTaskRuntimeReservation(m, worker.id); await this.cleanupWorkspaceForTask(m, task.id); appendLedger(m, 'worker.dependency-outcome-blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: error.message, dependencies: [...task.dependencies] } }); syncMissionGates(m); }
    admittedModel(m, worker, chain) { return taskRuntimeAdmittedModel(m, worker, chain, this.scheduler); }
    reserveExistingSessionAttempt(m, worker, model) {
        if (!model || !worker.session_id)
            return { ok: false, reason: 'model-or-session-missing' };
        if (this.admittedModel(m, worker, [model]) !== model)
            return { ok: false, reason: 'scheduler-not-admitted' };
        const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler);
        if (!reservation.accepted)
            return { ok: false, reason: reservation.reason };
        const provider = providerOf(model);
        if (!this.scheduler.acquire(worker.id, provider, model === 'host-default' ? undefined : model)) {
            releaseTaskRuntimeReservation(m, worker.id);
            return { ok: false, reason: 'legacy-resource-backstop' };
        }
        const bound = bindTaskRuntimeHost(m, worker.id, worker.session_id);
        if (!bound.accepted) {
            this.scheduler.release(worker.id);
            releaseTaskRuntimeReservation(m, worker.id);
            return { ok: false, reason: bound.reason };
        }
        return { ok: true, reason: 'reserved-and-bound' };
    }
    async reconcileRestartBeforeResume(m, worker, task) {
        if (!worker.restart_reconcile_pending)
            return 'CONTINUE';
        const observed = await this.admitTerminalEvent(m, worker);
        if (observed.decision === 'WAIT') {
            const reconciled = reconcileTaskRuntimeRestart(m, worker, 'ACTIVE');
            if (!reconciled.accepted) {
                appendLedger(m, 'scheduler.restart-reconcile-blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: reconciled.reason, session_id: worker.session_id, host_status: observed.hostStatus } });
                return 'WAIT';
            }
            worker.restart_reconcile_pending = false;
            worker.status = 'busy';
            task.status = 'running';
            this.registry.set(worker);
            appendLedger(m, 'scheduler.restart-reconciled', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, outcome: 'host-active', host_status: observed.hostStatus, attempt_id: observed.binding?.attempt.attemptId } });
            return 'WAIT';
        }
        if (observed.decision !== 'ACCEPT') {
            const reconciled = reconcileTaskRuntimeRestart(m, worker, 'UNKNOWN');
            appendLedger(m, 'scheduler.restart-reconcile-deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: observed.reason, session_id: worker.session_id, host_status: observed.hostStatus, scheduler_reason: reconciled.reason, attempt_id: observed.binding?.attempt.attemptId } });
            return 'WAIT';
        }
        const reconciled = reconcileTaskRuntimeRestart(m, worker, 'TERMINAL');
        if (!reconciled.accepted) {
            appendLedger(m, 'scheduler.restart-reconcile-blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: reconciled.reason, session_id: worker.session_id, host_status: observed.hostStatus } });
            return 'WAIT';
        }
        appendLedger(m, 'scheduler.restart-reconciled', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, outcome: 'host-idle-result-pending', host_status: observed.hostStatus, attempt_id: observed.binding?.attempt.attemptId } });
        if (!this.readAssistantResult) {
            appendLedger(m, 'worker.restart-result-deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: 'assistant-result-reader-unavailable', session_id: worker.session_id } });
            return 'WAIT';
        }
        let assistant;
        try {
            assistant = await this.readAssistantResult(worker.session_id, 12);
        }
        catch (error) {
            appendLedger(m, 'worker.restart-result-deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: 'assistant-result-read-failed', session_id: worker.session_id, error: String(error) } });
            return 'WAIT';
        }
        const settled = await this.settleHostIdleAssistantResult(m, worker, assistant);
        if (!settled.applied) {
            appendLedger(m, 'worker.restart-result-deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: settled.reason, session_id: worker.session_id } });
            return 'WAIT';
        }
        const recoveredResult = settled.wakeResult ?? settled.result?.status ?? 'UNKNOWN';
        worker.restart_reconcile_pending = false;
        appendLedger(m, 'worker.restart-result-recovered', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, result: recoveredResult, attempt_id: observed.binding?.attempt.attemptId } });
        if (settled.wakeResult === 'RUNTIME_FALLBACK' || settled.wakeResult === 'QUARANTINED')
            return 'WAIT';
        return ['completed', 'failed', 'cancelled'].includes(worker.status) || settled.wakeResult === 'BLOCKED' ? 'TERMINAL' : 'CONTINUE';
    }
    queueTask(m, worker, run) { if (this.#queue.length >= MAX_QUEUE)
        throw new TaskQueueCapacityError(); const t = m.execution.tasks.find(x => x.id === worker.task_id); worker.status = 'queued'; if (t)
        t.status = 'queued'; if (!this.#queue.some(x => x.worker.id === worker.id))
        this.#queue.push({ mission: m, worker, run, created: Date.now() }); this.registry.set(worker); appendLedger(m, 'worker.queued', { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length } }); void this.events?.(runtimeSignal('worker.queued', m.identity.mission_id, { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length } })); syncMissionGates(m); }
    async rollbackQueueCapacityRejection(m, task, worker) {
        const cleaned = await this.cleanupWorkspaceForTask(m, task.id);
        if (!cleaned) {
            const marker = `queue-overflow-cleanup-failed:${task.id}`;
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
            const now = Date.now();
            worker.status = 'failed';
            worker.completed_at = now;
            task.status = 'blocked';
            task.updated_at = now;
            task.result = { status: 'BLOCKED', summary: 'Bounded dispatch queue rejected this task, but its isolated workspace could not be safely cleaned. Exact workspace ownership remains quarantined for explicit reconciliation.', changed_files: [], evidence: [], open_issues: [marker], needs_context: ['reconcile the quarantined task workspace before retrying or removing this task'] };
            appendLedger(m, 'worker.queue-rejection-cleanup-blocked', { task_id: task.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length, reason: 'workspace-cleanup-failed' } });
            syncMissionGates(m);
            return false;
        }
        m.execution.workspace_leases = m.execution.workspace_leases.filter(lease => lease.task_id !== task.id);
        m.execution.isolation_decisions = m.execution.isolation_decisions.filter(decision => decision.requested_by !== `task:${task.id}`);
        this.registry.delete(worker.id);
        this.scheduler.release(worker.id);
        releaseTaskRuntimeReservation(m, worker.id, 'CANCEL');
        m.execution.workers = m.execution.workers.filter(item => item.id !== worker.id);
        m.execution.tasks = m.execution.tasks.filter(item => item.id !== task.id);
        appendLedger(m, 'worker.queue-rejected', { payload: { discarded_task_id: task.id, discarded_worker_id: worker.id, queue_depth: this.#queue.length, reason: 'bounded-dispatch-queue-full' } });
        syncMissionGates(m);
        return true;
    }
    drainQueue() { if (this.#draining)
        return; this.#draining = true; queueMicrotask(async () => { try {
        let progress = true;
        while (progress) {
            progress = false;
            for (let i = 0; i < this.#queue.length; i++) {
                const e = this.#queue[i], t = e.mission.execution.tasks.find(x => x.id === e.worker.task_id), chain = [e.worker.model, ...e.worker.fallbacks].filter((x) => Boolean(x));
                if (e.mission.identity.status !== 'active' || e.mission.continuation.user_interrupted || e.worker.status === 'cancelled') {
                    this.#queue.splice(i--, 1);
                    continue;
                }
                if (!t) {
                    this.#queue.splice(i--, 1);
                    continue;
                }
                const decision = taskRuntimeUnitDecision(e.mission, e.worker, chain[0], this.scheduler), failed = decision?.disposition === 'BLOCKED_DEPENDENCY' ? decision.blockingDependencyIds.filter(id => { const status = e.mission.execution.tasks.find(task => task.id === id)?.status; return status === 'failed' || status === 'cancelled'; }) : [];
                if (failed.length) {
                    this.#queue.splice(i--, 1);
                    e.worker.status = 'failed';
                    t.status = 'blocked';
                    t.updated_at = Date.now();
                    const reason = `dependency-unavailable:${failed.join(',')}`;
                    t.result = { status: 'BLOCKED', summary: 'Required dependency did not complete successfully.', changed_files: [], evidence: [], open_issues: [reason], needs_context: [] };
                    e.mission.execution.blockers = [...new Set([...e.mission.execution.blockers, reason])];
                    this.registry.delete(e.worker.id);
                    await this.cleanupWorkspaceForTask(e.mission, t.id);
                    appendLedger(e.mission, 'worker.dependency-blocked', { task_id: t.id, worker_id: e.worker.id, payload: { dependencies: failed, source: 'scheduler' } });
                    void this.events?.(runtimeSignal('worker.dependency-blocked', e.mission.identity.mission_id, { task_id: t.id, worker_id: e.worker.id, payload: { dependencies: failed } }));
                    syncMissionGates(e.mission);
                    progress = true;
                    continue;
                }
                if (!this.admittedModel(e.mission, e.worker, chain))
                    continue;
                this.#queue.splice(i--, 1);
                progress = true;
                try {
                    await e.run();
                }
                catch { }
            }
        }
    }
    finally {
        this.#draining = false;
    } }); }
    async start(m, input = {}) {
        if (m.identity.status !== 'active' || m.continuation.user_interrupted)
            throw new Error('Mission is not active');
        if (m.identity.semantic_assessment.status !== 'assessed')
            throw new Error('Hi semantic assessment is pending; assess mission intent before starting a worker');
        const objective = input.objective?.trim() || m.identity.objective;
        const taskIntent = m.identity.intent;
        const cfg = this.getConfig(), routingProfile = cfg.profile[executionProfileFor(cfg.executionPolicy, taskIntent)], routed = routeCapabilities(taskIntent, { specialistThreshold: routingProfile.specialistThreshold, reviewThreshold: routingProfile.reviewThreshold }), defaultCategory = resolveCategory(taskIntent), category = (CATEGORIES.has(String(input.category)) ? input.category : (routed.category ?? defaultCategory)), defaultRole = isHiChildRole(routed.role) ? routed.role : 'coder', requestedRole = String(input.role ?? '').trim();
        if (requestedRole && !isHiChildRole(requestedRole))
            throw new Error(`Unsupported Hi child role '${requestedRole}'. Use one of: ${HI_CHILD_ROLES.join(', ')}`);
        const role = isHiChildRole(requestedRole) ? requestedRole : defaultRole;
        const hostConfig = this.getHostConfig();
        applyAdmittedProjectMethodologyPermissions(hostConfig, this.projectRoot);
        const selected = resolveModel(category, this.getModels(), this.getConfig(), input.model, role, hostConfig);
        if (selected.rejected.length)
            appendLedger(m, 'model.policy.rejected', { payload: { items: selected.rejected.slice(0, 20) } });
        const taskMethodologyNeeds = m.methodology.methodology_needs.filter(need => input.resumeTaskId ? need.task_id === input.resumeTaskId || (!need.task_id && (!need.obligation_id || input.obligationIds?.includes(need.obligation_id))) : !need.task_id && (!need.obligation_id || input.obligationIds?.includes(need.obligation_id)));
        const catalog = methodologyCatalog(this.projectRoot), requestedMethodologyNames = methodologyNames(taskMethodologyNeeds);
        const requestedMcpServers = [...new Set(input.mcpServers ?? [])].map(x => String(x).trim()).filter(Boolean).slice(0, 8);
        if (requestedMcpServers.length && !m.identity.intent.requiredCapabilities.includes('mcp'))
            throw new Error('Exact MCP server use requires semantic capability mcp');
        let mcpExposure;
        try {
            mcpExposure = resolveMcpServerExposure(hostConfig, requestedMcpServers);
            for (const name of requestedMcpServers)
                clearCapabilityUnavailable(m, `mcp-server-${name}`);
        }
        catch (error) {
            const message = String(error);
            if (/Requested MCP server\(s\) unavailable:/i.test(message)) {
                for (const name of requestedMcpServers)
                    markCapabilityUnavailable(m, { capability: `mcp-server-${name}`, reason: message });
                throw new Error(`USER_ACTION_REQUIRED: ${message}`);
            }
            markCapabilityUnavailable(m, { capability: 'mcp-tool-namespace', reason: message });
            throw new Error(`USER_ACTION_REQUIRED: ${message}`);
        }
        const requiredEvidence = input.requiredEvidence ?? m.execution.verification_policy.requiredKinds, obligationIds = inferObligationIds(m, role, requiredEvidence, input.obligationIds);
        let extraResources = this.extraHostResources();
        const browserRequested = role === 'visual-qa' && requestedMethodologyNames.some(name => ['hi-browser-testing', 'hi-visual-qa'].includes(name));
        let browserBootstrap;
        if (browserRequested && !extraResources.has('host-capability:browser-execution') && this.ensureBrowserResource) {
            browserBootstrap = await this.ensureBrowserResource();
            appendLedger(m, 'browser.bootstrap', { payload: { available: browserBootstrap.available, attempted: browserBootstrap.attempted === true, reason: browserBootstrap.reason } });
            if (browserBootstrap.available) {
                extraResources = new Set([...extraResources, 'host-capability:browser-execution']);
                clearCapabilityUnavailable(m, 'browser-execution');
            }
        }
        let browserDecision;
        try {
            browserDecision = resolveBrowserBackend({ role, browserRequested, requested: input.browserBackend, localBrowserAvailable: extraResources.has('host-capability:browser-execution'), semanticCapabilities: m.identity.intent.requiredCapabilities, selectedMcpServers: mcpExposure.selected });
        }
        catch (error) {
            if (!browserRequested || input.browserBackend !== 'bounded-playwright')
                throw error;
            browserDecision = { reason: 'browser-execution-resource-unavailable' };
        }
        if (browserRequested && !browserDecision.backend) {
            const browserKinds = [...new Set(requiredEvidence.flatMap(kind => kind === 'visual-check' ? ['visual-evidence'] : ['visual-evidence', 'browser-evidence', 'accessibility-evidence'].includes(kind) ? [kind] : []))];
            markVerificationCapabilityUnavailable(m, { capability: 'browser-execution', reason: browserBootstrap?.reason ?? browserDecision.reason, requiredKinds: browserKinds.length ? browserKinds : ['visual-evidence'], obligationIds });
        }
        else if (browserDecision.backend)
            clearCapabilityUnavailable(m, 'browser-execution');
        const browserAllowedOrigins = normalizeBrowserAllowedOrigins(input.browserAllowedOrigins ?? browserOriginsFromTargets(taskIntent.likelyTargets ?? []));
        if (browserDecision.backend === 'bounded-playwright' && browserRequested && !browserAllowedOrigins.length && !this.previewManager)
            throw new Error('Bounded Playwright browser backend requires at least one exact allowed origin or the Hi-owned local preview capability');
        if (browserDecision.backend === 'mcp' && browserAllowedOrigins.length)
            throw new Error('browser_allowed_origins belongs only to the bounded-playwright backend; MCP origin policy remains native-authoritative');
        const candidates = methodologySkillCandidates(requestedMethodologyNames, this.projectRoot, this.hiRoot, hostConfig, catalog), permissionMap = resolveSkillPermissionMap(hostConfig, role), skillToolEnabled = resolveSkillToolEnabled(hostConfig, role), surface = effectiveExecutionSurface(hostConfig, role, skillToolEnabled), hostCapabilities = typeof this.hostCapabilitySource === 'function' ? this.hostCapabilitySource() : Array.isArray(this.hostCapabilitySource) ? this.hostCapabilitySource : [], availableResources = new Set([...hostCapabilities.filter(item => item.status === 'SUPPORTED' && item.runtime_health_required !== true).map(item => `host-capability:${item.id}`), ...extraResources, ...(browserDecision.backend ? ['runtime-capability:browser-execution'] : [])]), skillPlan = resolveSkillPlan(requestedMethodologyNames, candidates, permissionMap, skillToolEnabled, role, catalog, availableResources), methodologies = skillPlan.selected.map(s => s.name), methodologyResourceFailures = skillPlan.outcomes.filter(item => item.outcome === 'resource-unavailable').map(item => item.name);
        appendLedger(m, 'skill.resolved', { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } });
        void this.events?.(runtimeSignal('skill.resolved', m.identity.mission_id, { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } }));
        if (skillPlan.missing.length)
            appendLedger(m, 'skill.fallback', { payload: { missing: skillPlan.missing, requested: skillPlan.requested, skillToolEnabled } });
        const scope = input.scope ?? (isHiReadOnlyChildRole(role) && m.vcs.changed_files.length ? m.vcs.changed_files : taskIntent.likelyTargets ?? []);
        if (!isHiReadOnlyChildRole(role)) {
            const denied = [...new Map(scope.flatMap(path => deniedMutationAtoms(m.execution.constraint_atoms, path)).map(atom => [atom.id, atom])).values()];
            if (denied.length) {
                appendLedger(m, 'task.constraint-preflight-blocked', { payload: { role, scope: scope.slice(0, 40), atoms: denied.map(a => a.id) } });
                throw new Error(`Hi task scope conflicts with active user mutation constraint(s): ${denied.map(a => `${a.id}:${a.subject}`).join(', ')}`);
            }
        }
        const dependencies = [...new Set(input.dependencies ?? [])];
        const unknownDependencies = dependencies.filter(id => !m.execution.tasks.some(t => t.id === id)), unavailableDependencies = this.failedDeps(m, dependencies), incompleteDependencies = dependencies.filter(id => { const t = m.execution.tasks.find(x => x.id === id); return Boolean(t) && t.status !== 'completed' && !unavailableDependencies.includes(id); });
        const isolationRequired = input.isolationRequired === true, isolationReason = String(input.isolationReason ?? '').trim();
        if (isolationRequired && !isolationReason)
            throw new Error('Hi isolated task requires a bounded isolation reason');
        const constraints = [...new Set([...(m.execution.constraints ?? []), ...(input.constraints ?? []), ...(isolationRequired ? ['hi-isolation:git-worktree'] : []), ...mcpExposure.selected.map(name => `hi-mcp:${name}`), ...(browserDecision.backend ? [`hi-browser-backend:${browserDecision.backend}`] : []), ...browserAllowedOrigins.map(origin => `hi-browser-origin:${origin}`)])], desiredFingerprint = workerFingerprint(role, category, selected.primary, taskIntent.taskKind, objective, { scope, constraints, dependencies, requiredEvidence, obligationIds }), existing = input.resumeTaskId ? m.execution.workers.find(w => w.task_id === input.resumeTaskId && !['completed', 'failed', 'cancelled'].includes(w.status)) : m.execution.workers.find(w => w.fingerprint === desiredFingerprint && !['completed', 'failed', 'cancelled'].includes(w.status));
        if (input.resumeTaskId && !existing)
            throw new Error(`Hi task ${input.resumeTaskId} has no resumable worker`);
        const resumeCapable = Boolean(existing?.session_id), preflight = evaluateTaskPreconditions({ role, implementation: role === 'coder', dependencies: { unknown: unknownDependencies, failed: unavailableDependencies, incomplete: incompleteDependencies }, modelAvailable: Boolean(selected.primary), native: { childSession: resumeCapable || this.childHost.capabilities.create, prompt: this.childHost.capabilities.prompt }, hostConfig, methodologyResourceFailures, contractCriticalAmbiguity: m.identity.intent.ambiguity === 'contract-critical', authorityRequired: false });
        reconcileTaskCapabilityPreconditions(m, role, preflight);
        appendLedger(m, 'task.preflight', { payload: { role, decision: preflight.decision, resume_capable: resumeCapable, items: preflight.items.slice(0, 12) } });
        void this.events?.(runtimeSignal('task.preflight', m.identity.mission_id, { payload: { role, decision: preflight.decision, resume_capable: resumeCapable, items: preflight.items.slice(0, 12) } }));
        if (preflight.decision === 'RESOLVE' || preflight.decision === 'USER_ACTION_REQUIRED')
            throw new TaskPreconditionError(preflight);
        if (existing) {
            this.workspaceBinding(m, existing.task_id);
            const oldTask = m.execution.tasks.find(t => t.id === existing.task_id);
            if (existing.status === 'ready' && existing.session_id && oldTask?.result && ['FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED'].includes(oldTask.result.status)) {
                const hazardBeforeResume = recoveryModelHazard(m);
                if (hazardBeforeResume.open && hazardBeforeResume.worker_id === existing.id && hazardBeforeResume.model === existing.model) {
                    const escalated = await this.#recovery.recoverStagnation(m, 3, 'model-escalation');
                    if (escalated)
                        return { task_id: oldTask.id, worker_id: existing.id, session_id: existing.session_id, model: existing.model, methodologies: existing.selected_methodologies, selection_reason: ['behavioral-recovery:model-escalation-after-two-no-gain-corrections'], readiness: 'READY', preconditions: preflight.items };
                }
                const chain = [selected.primary, ...selected.fallbacks].filter((x) => Boolean(x));
                if (existing.restart_reconcile_pending) {
                    const restart = await this.reconcileRestartBeforeResume(m, existing, oldTask);
                    if (restart === 'WAIT')
                        return { task_id: oldTask.id, worker_id: existing.id, session_id: existing.session_id, model: existing.model, methodologies: existing.selected_methodologies, selection_reason: ['restart-reconciliation:host-truth-pending-or-active'], readiness: 'WAIT', preconditions: preflight.items };
                    if (restart === 'TERMINAL')
                        return { task_id: oldTask.id, worker_id: existing.id, session_id: existing.session_id, model: existing.model, methodologies: existing.selected_methodologies, selection_reason: ['restart-reconciliation:terminal-result-recovered'], readiness: 'READY', preconditions: preflight.items };
                }
                const nextModel = this.admittedModel(m, existing, chain) ?? existing.model;
                if (!nextModel)
                    throw new Error('Worker resume scheduler admission unavailable');
                const resumeAdmission = this.reserveExistingSessionAttempt(m, existing, nextModel);
                if (!resumeAdmission.ok)
                    throw new Error(`Worker resume scheduler admission unavailable: ${resumeAdmission.reason}`);
                const previousModel = existing.model, attemptBaseline = await this.captureNativeDiff(existing, 'baseline');
                if (!attemptBaseline)
                    existing.native_diff_baseline = undefined;
                existing.native_diff_final = undefined;
                existing.model = nextModel;
                existing.generation_at_spawn = m.continuation.generation;
                existing.status = 'busy';
                existing.started_at = Date.now();
                oldTask.status = 'running';
                this.registry.set(existing);
                const issues = oldTask.result.open_issues.join(' | '), missing = oldTask.result.needs_context.join(' | '), freshEvidence = m.execution.evidence.items.filter(e => !e.invalidated_at && ((e.outcome === 'passed') || e.pass === true) && (e.task_id === oldTask.id || e.obligation_ids?.some(id => oldTask.obligation_ids.includes(id)) || (e.scope ?? []).some(file => oldTask.scope.includes(file)))).slice(-8).map(e => `${e.kind}: ${e.summary}`).join(' | '), reviewScope = isHiReadOnlyChildRole(existing.role) ? `Scoped rereview only: previous findings=${issues || 'none'}; changed scope=${m.vcs.changed_files.slice(-20).join(',') || 'none'}; affected evidence=${freshEvidence || 'none'}.` : '', resumeExitRequirements = existing.selected_methodologies.flatMap(name => { const item = catalog.find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const resumeVariant = nextModel === selected.primary ? selected.primaryVariant : selected.fallbackVariants[nextModel];
                const protectedBaseline = Object.keys(m.vcs.preexisting_user_changes ?? {}).slice(0, 60);
                const correctionLevel = Math.min(2, hazardBeforeResume.attempts + 1);
                beginWorkerAttempt(oldTask, existing);
                this.recordModelProjection(existing, nextModel, resumeVariant);
                await this.sendProviderPrompt(existing.session_id, clipText([`Hi corrective resume for existing task ${oldTask.id}.`, `Previous status: ${oldTask.result.status}.`, `Missing context: ${missing || 'none'}.`, `Open issues: ${issues || 'none'}.`, `Current user constraints: ${(oldTask.constraints ?? []).join(' | ') || 'none'}.`, `CURRENT FRESH EVIDENCE: ${freshEvidence || 'none'}.`, `METHODOLOGY EXIT REQUIREMENTS: ${resumeExitRequirements.join(' | ') || 'none'}.`, protectedBaseline.length ? `PRE-EXISTING USER DIRTY BASELINE: ${protectedBaseline.join(', ')}. Cleanup means restore these paths to their exact worker-start baseline, NOT to HEAD. Never discard user-owned edits with git checkout/reset/restore.` : 'Pre-existing user dirty baseline: none observed.', reviewScope, correctionLevel === 1 ? 'Resume from current session context. Apply the smallest correction. Do not restart planning or create sub-orchestrators. Return the structured WorkerResult again.' : 'Resume the SAME task/session, but use a materially different corrective hypothesis or action from the prior correction. Do not repeat the failed strategy, restart planning, or create sub-orchestrators. Return the structured WorkerResult again.'].filter(Boolean).join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), existing.role, nextModel === 'host-default' ? undefined : nextModel, resumeVariant, taskPromptToolOverrides(oldTask.execution_profile?.tools ?? [], this.getHostConfig(), oldTask.execution_profile?.mcp_servers ?? []));
                recordRecoveryStrategy(m, { level: correctionLevel, action: 'same-worker-resume' }, 'started', Date.now(), { task_id: oldTask.id, worker_id: existing.id, model: nextModel, failure_signature: existing.last_runtime_failure_kind });
                existing.model_variant = resumeVariant;
                existing.restart_reconcile_pending = false;
                appendLedger(m, nextModel !== previousModel ? 'worker.model-escalated' : 'worker.resumed', { task_id: oldTask.id, worker_id: existing.id, payload: { status: oldTask.result.status, model: nextModel, correction_level: correctionLevel, recovery_progress_signature: hazardBeforeResume.progress_signature } });
            }
            return { task_id: oldTask?.id ?? existing.task_id, worker_id: existing.id, session_id: existing.session_id, model: existing.model, methodologies: existing.selected_methodologies, selection_reason: ['same-session worker reuse'], readiness: 'READY', preconditions: preflight.items };
        }
        const requestedArtifactIds = [...new Set(input.contextArtifactIds ?? [])].slice(0, DEFAULT_CONTEXT_BUDGET.max_artifacts), unknownArtifactIds = requestedArtifactIds.filter(id => !m.context.context_artifacts.some(a => a.id === id));
        if (unknownArtifactIds.length)
            throw new Error(`Unknown context artifact id(s): ${unknownArtifactIds.join(', ')}`);
        const contextArtifactStore = this.#scopedStores.contextArtifacts, selectedContextHandles = requestedArtifactIds.map(id => m.context.context_artifacts.find(a => a.id === id)).filter(Boolean), selectedContextReferences = selectedContextHandles.map(a => { const durableId = a.uri?.startsWith('hi-artifact:') ? a.uri.slice('hi-artifact:'.length) : undefined, stored = durableId ? contextArtifactStore.get(durableId) : undefined; return { source_ref: a.uri ?? `mission-context:${a.id}`, reason: 'explicit-task-selection', priority: 'normal', protection: 'COMPRESSIBLE', budget_cost: stored ? Math.min(stored.content.length, 3000) : Math.min((a.summary ?? a.title ?? a.kind).length, 3000), freshness: stored?.freshness ?? 'UNKNOWN', retention: 'task', privacy_class: stored?.privacy_class ?? 'project-private', kind: a.kind, title: a.title, summary: a.summary, content_hash: stored?.content_hash ?? a.sha256, source_handle_id: a.id }; });
        const approvalGated = skillPlan.selected.filter(s => s.permission === 'ask').map(s => s.name), browserTools = browserDecision.backend === 'bounded-playwright' && role === 'visual-qa' && methodologies.some(name => ['hi-browser-testing', 'hi-visual-qa', 'hi-accessibility-review'].includes(name)) ? [...HI_BROWSER_EXECUTION_TOOL_IDS] : [], askGatedPermissionKeys = Object.entries(surface.permissions.decisions).filter(([, value]) => value === 'ask').map(([name]) => name), taskTools = [...surface.tools.filter(t => (t !== 'skill' || methodologies.length > 0)), ...browserTools];
        const profile = { role, category, task: { objective, scope: [...scope], dependencies: [...dependencies], required_evidence: [...requiredEvidence] }, tools: taskTools, ...(mcpExposure.selected.length ? { mcp_servers: mcpExposure.selected } : {}), ...(browserDecision.backend ? { browser_backend: browserDecision.backend } : {}), ...(browserAllowedOrigins.length ? { browser_allowed_origins: browserAllowedOrigins } : {}), model: selected.primary, model_variant: input.modelVariant ?? selected.primaryVariant, fallback_models: selected.fallbacks, fallback_variants: selected.fallbackVariants, fallback_reasons: selected.fallbackReasons, methodologies, permission_profile: { skill_tool_enabled: skillToolEnabled, skill_permissions: permissionMap ?? {}, external_effects: 'parent-only', recursive_task: 'deny', native: surface.permissions }, verification_policy: { ...m.execution.verification_policy, requiredKinds: [...m.execution.verification_policy.requiredKinds] }, max_context_chars: DEFAULT_CONTEXT_BUDGET.max_context_chars, max_handoff_chars: DEFAULT_CONTEXT_BUDGET.max_handoff_chars, max_result_chars: DEFAULT_CONTEXT_BUDGET.max_result_chars, max_artifacts: DEFAULT_CONTEXT_BUDGET.max_artifacts };
        const task = createTask(m, { objective, role, category, scope, constraints, dependencies, requiredEvidence, obligationIds, contextReferences: selectedContextReferences, executionProfile: profile });
        if (isolationRequired) {
            if (!this.workspaceRuntime) {
                task.status = 'blocked';
                markCapabilityUnavailable(m, { capability: 'workspace-isolation-binding', reason: 'Hi WorkspaceExecutor is unavailable for required isolation', taskId: task.id });
                throw new Error('USER_ACTION_REQUIRED: Hi WorkspaceExecutor is unavailable for required isolation');
            }
            const decision = this.workspaceRuntime.decision(m, task, { required: true, reason: isolationReason });
            try {
                await this.workspaceRuntime.provision(m, task, decision);
                clearCapabilityUnavailable(m, 'workspace-isolation-binding');
            }
            catch (error) {
                task.status = 'blocked';
                task.updated_at = Date.now();
                const marker = `workspace-provision-failed:${task.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                markCapabilityUnavailable(m, { capability: 'workspace-isolation-binding', reason: String(error), taskId: task.id });
                appendLedger(m, 'workspace.provision-failed', { task_id: task.id, payload: { error: String(error) } });
                throw new Error(`USER_ACTION_REQUIRED: ${String(error)}`);
            }
        }
        const provenance = methodologyProvenance(skillPlan.selected), worker = createWorker(m, task, selected.primary, selected.fallbacks, methodologies, provenance);
        worker.recovery_candidates = [...selected.recoveryCandidates];
        worker.requested_model = input.model;
        worker.requested_model_variant = input.modelVariant;
        worker.model_selection_reason = [...selected.reason];
        worker.fallback_history = [];
        let acceptedTaskBound = false;
        const bindAcceptedTask = () => { if (acceptedTaskBound)
            return; bindMethodologyNeeds(m, methodologies, { taskId: task.id, obligationIds: task.obligation_ids }); for (const ref of task.context_artifacts)
            if (ref.source_ref.startsWith('hi-artifact:'))
                contextArtifactStore.bindConsumer(ref.source_ref.slice('hi-artifact:'.length), task.id); acceptedTaskBound = true; };
        const localPreviewHint = role === 'visual-qa' && browserDecision.backend === 'bounded-playwright' && this.previewManager && !browserAllowedOrigins.length ? `LOCAL STATIC PREVIEW: task_id=${task.id}. For a task-scoped local HTML target, call hi_browser_preview_open with task_id=${task.id} and the exact project-relative path before inspect/click/screenshot. This Hi-owned loopback preview writes no project files and owns cleanup.` : undefined;
        const artifactGroups = task.context_artifacts.map(a => { const id = a.source_ref.startsWith('hi-artifact:') ? a.source_ref.slice('hi-artifact:'.length) : undefined, stored = id ? contextArtifactStore.get(id) : undefined, text = stored?.freshness === 'FRESH' ? `artifact:${stored.artifact_id}:${stored.summary}\n${clipText(stored.content, 3000)}` : stored ? `artifact-stale:${stored.artifact_id}:${stored.summary}` : `${a.kind}:${a.title ?? a.source_handle_id ?? a.id}${a.summary ? ` — ${a.summary}` : ''}`; return { id: `artifact:${a.id}`, items: [text], priority: a.priority, protection: a.protection, freshness: stored?.freshness ?? a.freshness, content_hash: stored?.content_hash ?? a.content_hash, source_ref: a.source_ref }; }), verificationHint = targetedVerificationHint(this.projectRoot, task.scope.length ? task.scope : (m.vcs.changed_files.length ? m.vcs.changed_files : m.identity.intent.likelyTargets ?? [])), semanticContexts = semanticContextsForTargets(this.projectRoot, task.scope, task.id, 3000), semanticGroups = semanticContexts.map(x => ({ id: `semantic:${x.id}`, items: [renderSemanticContext(x)], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'FRESH', content_hash: x.source_hash, source_ref: x.source_ref })), explicitGroups = (input.relevantContext ?? []).map((text, index) => ({ id: `explicit:${index}`, items: [text], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'UNKNOWN' })), runtimeGroups = [...(localPreviewHint ? [{ id: 'runtime:local-preview', items: [localPreviewHint], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'FRESH' }] : []), ...(verificationHint ? [{ id: 'runtime:verification-hint', items: [verificationHint], priority: 'normal', protection: 'COMPRESSIBLE', freshness: 'FRESH' }] : []), ...semanticGroups, ...artifactGroups];
        if (semanticContexts.length)
            appendLedger(m, 'context.semantic-selected', { task_id: task.id, payload: { items: semanticContexts.slice(0, 6).map(x => ({ id: x.id, source_ref: x.source_ref, source_hash: x.source_hash.slice(0, 16), symbols: x.symbols.length, chars: x.budget.used_chars })), total_chars: semanticContexts.reduce((n, x) => n + x.budget.used_chars, 0) } });
        let nativeSummary, baseContextGroups = [...explicitGroups, ...runtimeGroups], rawContextChars = baseContextGroups.flatMap(g => g.items).join('\n').length;
        if (rawContextChars > profile.max_context_chars && this.childHost.capabilities.summarize)
            try {
                const summary = await this.childHost.summarize(m.identity.session_id);
                nativeSummary = clipText(typeof summary === 'string' ? summary : JSON.stringify(summary), Math.min(6000, Math.floor(profile.max_context_chars / 2)));
                baseContextGroups = [{ id: 'native:session-summary', items: [`native-session-summary:${nativeSummary}`], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'FRESH' }, ...runtimeGroups];
                appendLedger(m, 'context.native-summary-used', { task_id: task.id, payload: { source_session: m.identity.session_id, replaced_explicit_context: true } });
            }
            catch (error) {
                appendLedger(m, 'context.native-summary-unavailable', { task_id: task.id, payload: { error: String(error) } });
            }
        const askGatedTools = [...askGatedPermissionKeys].sort(), askGatedInstruction = askGatedTools.length ? `host ask-gated tools remain available under OpenCode native permission control: ${askGatedTools.join(', ')}. Use them only when materially required. If OpenCode denies a required action, do not retry or bypass the denial; return BLOCKED/NEEDS_CONTEXT with the exact required action.` : undefined;
        const buildHandoff = (dependencyContext) => { const preexisting = Object.keys(worker.native_diff_baseline ?? {}).slice(0, 60), groups = [...(dependencyContext ? [{ id: 'dependency:direct-outcomes', items: [dependencyContext], priority: 'high', protection: 'PROTECTED', freshness: 'FRESH', required: true }] : []), ...baseContextGroups], projection = projectContextGroups(groups, 5000); if (!projection.complete)
            throw new Error(`Required context projection exceeds worker handoff budget: ${projection.missing_required.join(', ')}`); const dispatchRelevant = renderProjectedContext(projection); appendLedger(m, 'context.projection-selected', { task_id: task.id, worker_id: worker.id, payload: { budget_chars: projection.budget_chars, used_chars: projection.used_chars, selected: projection.selected.map(g => g.id).slice(0, 24), omitted: projection.omitted.slice(0, 24), duplicates: projection.duplicate_groups.slice(0, 24), atomic: true, utility: 'deterministic-metadata-only' } }); const core = workerHandoffText({ objective, scope: task.scope, constraints: clipList([...(task.constraints ?? []), 'minimum sufficient change', 'no unrequested publish/push/deploy', 'return compact evidence', askGatedInstruction ?? '', preexisting.length ? `pre-existing user dirty paths at worker start: ${preexisting.join(', ')}; preserve their exact baseline state unless the task explicitly requires changing them; never use git checkout/reset/restore in a way that discards user-owned edits` : 'no pre-existing native dirty paths were observed at worker start', verificationEconomyInstruction(m)], 5000), required_evidence: task.requiredEvidence, relevant_context: dispatchRelevant, methodologies: worker.selected_methodologies, methodology_exit_requirements: worker.selected_methodologies.flatMap(name => { const item = catalog.find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; }), approval_gated_methodologies: approvalGated, expected_output: { status: true, summary: true, changed_files: true, scope_expansions: true, evidence: true, findings: isHiReviewerRole(worker.role) ? true : undefined, open_issues: true } }, profile.max_handoff_chars), full = [ownershipContract('child', worker.selected_methodologies), core].filter(Boolean).join('\n\n'); return clipText(full, profile.max_handoff_chars); };
        const chain = [selected.primary, ...selected.fallbacks].filter((x) => Boolean(x)), toolOverrides = taskPromptToolOverrides(profile.tools, this.getHostConfig(), profile.mcp_servers ?? []);
        const run = () => this.registry.dedupeSpawn(worker.fingerprint, async () => { let dependencyContext; try {
            const outcomes = projectDirectDependencyOutcomes(m, task);
            dependencyContext = renderDirectDependencyOutcomeContext(outcomes, Math.min(5000, profile.max_context_chars));
            if (dependencyContext)
                appendLedger(m, 'dependency.outcomes-projected', { task_id: task.id, worker_id: worker.id, payload: { dependencies: outcomes.map(item => item.task_id), chars: dependencyContext.length, evidence_authority: false } });
        }
        catch (error) {
            if (error instanceof DependencyOutcomeProjectionError)
                await this.blockDependencyOutcome(m, task, worker, error);
            throw error;
        } let lastError = new Error('No runtime model available'); for (let i = 0; i < chain.length; i++) {
            if (m.identity.status !== 'active' || m.continuation.user_interrupted || worker.status === 'cancelled') {
                worker.status = 'cancelled';
                task.status = 'cancelled';
                throw new Error('Mission stopped before worker dispatch');
            }
            const model = chain[i], variant = model === selected.primary ? (input.modelVariant ?? selected.primaryVariant) : selected.fallbackVariants[model], provider = providerOf(model), runtimeCandidate = runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig(), role);
            if (!runtimeCandidate.ok) {
                lastError = new Error(`Runtime model candidate rejected at dispatch: ${model}: ${runtimeCandidate.reason}`);
                appendLedger(m, 'model.fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: runtimeCandidate.reason, index: i, phase: 'dispatch-revalidation' } });
                continue;
            }
            clearCapabilityUnavailable(m, 'model-dispatch');
            const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler);
            if (!reservation.accepted) {
                lastError = new Error(`Worker scheduler admission unavailable: ${reservation.reason}`);
                appendLedger(m, 'model.fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: reservation.reason, index: i, source: 'scheduler' } });
                continue;
            }
            if (!this.scheduler.acquire(worker.id, provider, model === 'host-default' ? undefined : model)) {
                releaseTaskRuntimeReservation(m, worker.id);
                lastError = new Error('Legacy resource tracker disagreed with scheduler admission');
                appendLedger(m, 'scheduler.resource-tracker-mismatch', { task_id: task.id, worker_id: worker.id, payload: { model, index: i } });
                continue;
            }
            worker.model = model;
            worker.model_variant = variant;
            try {
                worker.status = 'starting';
                task.status = 'queued';
                this.recordModelProjection(worker, model, variant);
                const spawned = await this.#child.createForTask(m.identity.session_id, `Hi · ${role} · ${objective.slice(0, 60)}`, role, model === 'host-default' ? undefined : model, variant, input.forkFromSession, this.workspaceBinding(m, task.id)), child = spawned.child;
                if (input.forkFromSession)
                    appendLedger(m, 'worker.session-fork', { task_id: task.id, worker_id: worker.id, payload: { source_session: input.forkFromSession, native: spawned.fork.nativeAvailable, used: spawned.fork.used, reason: spawned.fork.reason } });
                if (m.identity.status !== 'active' || m.continuation.user_interrupted || worker.status === 'cancelled') {
                    if (child?.id)
                        try {
                            await this.abortNativeSession(m, child.id, 'spawn-cancelled', worker.id, task.id);
                        }
                        catch { }
                    ;
                    throw new Error('Mission stopped during worker spawn');
                }
                worker.session_id = child?.id;
                if (!worker.session_id)
                    throw new Error('Child session id missing');
                const bound = bindTaskRuntimeHost(m, worker.id, worker.session_id);
                if (!bound.accepted)
                    throw new Error(`Scheduler host binding failed: ${bound.reason}`);
                recordPreexistingUserBaseline(m, await this.captureNativeDiff(worker, 'baseline'));
                worker.generation_at_spawn = m.continuation.generation;
                worker.status = 'busy';
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                if (i > 0) {
                    const fallbackReason = selected.fallbackReasons[i - 1]?.reason ?? `fallback-index:${i}`;
                    worker.fallback_history = [...(worker.fallback_history ?? []), { from: chain[i - 1], to: model, variant, reason: fallbackReason, phase: 'dispatch', at: Date.now() }];
                }
                void this.events?.(runtimeSignal('worker.started', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { model, variant, role } }));
                appendLedger(m, 'worker.started', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, model, variant, index: i, reason: i === 0 ? (input.modelVariant ? [...selected.reason, 'user-specified-variant'] : selected.reason) : [selected.fallbackReasons[i - 1]?.reason ?? 'runtime fallback', `fallback-index:${i}`] } });
                const refreshedOutcomes = projectDirectDependencyOutcomes(m, task), refreshedDependencyContext = renderDirectDependencyOutcomeContext(refreshedOutcomes, Math.min(5000, profile.max_context_chars));
                if (refreshedDependencyContext !== dependencyContext) {
                    appendLedger(m, 'dependency.outcomes-refreshed', { task_id: task.id, worker_id: worker.id, payload: { dependencies: refreshedOutcomes.map(item => item.task_id), previous_chars: dependencyContext?.length ?? 0, current_chars: refreshedDependencyContext?.length ?? 0 } });
                    dependencyContext = refreshedDependencyContext;
                }
                const handoff = buildHandoff(dependencyContext);
                appendLedger(m, 'worker.handoff', { task_id: task.id, worker_id: worker.id, payload: { chars: handoff.length, methodologies: worker.selected_methodologies.length, tools: profile.tools.slice(0, 20), permission_source: profile.permission_profile.native?.source, context_budget: profile.max_context_chars, handoff_budget: profile.max_handoff_chars, result_budget: profile.max_result_chars } });
                beginWorkerAttempt(task, worker);
                await this.sendProviderPrompt(worker.session_id, handoff, role, model === 'host-default' ? undefined : model, variant, toolOverrides);
                return worker;
            }
            catch (error) {
                lastError = error;
                let hostStopped = true;
                if (worker.session_id) {
                    try {
                        hostStopped = await this.abortNativeSession(m, worker.session_id, 'dispatch-fallback', worker.id, task.id);
                    }
                    catch {
                        hostStopped = false;
                    }
                    if (hostStopped)
                        worker.session_id = undefined;
                }
                if (!hostStopped) {
                    appendLedger(m, 'worker.start.abort-blocked', { task_id: task.id, worker_id: worker.id, payload: { model, index: i, error: String(error) } });
                    throw new Error(`Scheduler reservation retained because host abort could not be verified for worker ${worker.id}`);
                }
                this.scheduler.release(worker.id);
                releaseTaskRuntimeReservation(m, worker.id);
                if (error instanceof DependencyOutcomeProjectionError) {
                    await this.blockDependencyOutcome(m, task, worker, error);
                    throw error;
                }
                if (m.identity.status !== 'active' || m.continuation.user_interrupted || worker.status === 'cancelled') {
                    worker.status = 'cancelled';
                    task.status = 'cancelled';
                    appendLedger(m, 'worker.start.cancelled', { task_id: task.id, worker_id: worker.id, payload: { model, index: i, error: String(error) } });
                    throw error;
                }
                appendLedger(m, 'model.fallback.failed', { task_id: task.id, worker_id: worker.id, payload: { model, index: i, error: String(error) } });
                worker.status = 'created';
                task.status = 'created';
            }
        } worker.status = 'failed'; const liveStatuses = chain.map(model => ({ model, ...runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig(), role) })); const policyUnavailable = liveStatuses.length > 0 && liveStatuses.every(x => !x.ok); if (policyUnavailable) {
            task.status = 'blocked';
            const marker = `model-dispatch-unavailable:${task.id}`;
            markCapabilityUnavailable(m, { capability: 'model-dispatch', reason: 'No selected role model/fallback remains runtime-available and policy-permitted at dispatch time.', taskId: task.id, workerId: worker.id });
            task.result = { status: 'BLOCKED', summary: 'No selected role model/fallback remains runtime-available and policy-permitted at dispatch time.', changed_files: [], evidence: [], open_issues: [marker], needs_context: ['refresh provider/model inventory or routing/provider permissions'] };
            appendLedger(m, 'worker.start.model-unavailable', { task_id: task.id, worker_id: worker.id, payload: { attempted: liveStatuses } });
        }
        else
            task.status = 'failed'; await this.cleanupWorkspaceForTask(m, task.id); appendLedger(m, 'worker.start.failed', { task_id: task.id, worker_id: worker.id, payload: { error: String(lastError), attempted_models: chain } }); throw lastError; });
        syncMissionGates(m);
        if (!this.admittedModel(m, worker, chain)) {
            try {
                this.queueTask(m, worker, run);
            }
            catch (error) {
                if (error instanceof TaskQueueCapacityError) {
                    const rolledBack = await this.rollbackQueueCapacityRejection(m, task, worker);
                    if (!rolledBack)
                        throw new Error(`Hi bounded dispatch queue is full; rejected task ${task.id} remains BLOCKED because isolated workspace cleanup failed`);
                }
                throw error;
            }
            ;
            bindAcceptedTask();
            return { task_id: task.id, worker_id: worker.id, model: worker.model, methodologies: worker.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), 'queued:runtime-capacity-or-prerequisite', ...skillPlan.reason], readiness: 'WAIT', preconditions: preflight.items };
        }
        bindAcceptedTask();
        const spawned = await run();
        if (spawned.id !== worker.id) {
            const duplicateTask = m.execution.tasks.find(t => t.id === task.id);
            if (duplicateTask && ['created', 'queued'].includes(duplicateTask.status))
                m.execution.tasks = m.execution.tasks.filter(t => t.id !== duplicateTask.id);
            m.execution.workers = m.execution.workers.filter(w => w.id !== worker.id);
            await this.cleanupWorkspaceForTask(m, task.id);
            appendLedger(m, 'worker.spawn.deduped', { worker_id: spawned.id, payload: { discarded_worker_id: worker.id, fingerprint: worker.fingerprint } });
            const spawnedTask = m.execution.tasks.find(t => t.id === spawned.task_id);
            return { task_id: spawnedTask?.id ?? spawned.task_id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, 'deduped:existing-spawn', ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
        }
        return { task_id: task.id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
    }
    async resume(m, taskID) {
        const task = m.execution.tasks.find(t => t.id === taskID);
        if (!task)
            throw new Error(`Unknown Hi task ${taskID}`);
        const worker = m.execution.workers.find(w => w.id === task.worker_id || w.task_id === task.id);
        if (!worker)
            throw new Error(`Hi task ${taskID} has no worker`);
        if (!worker.session_id)
            throw new Error(`Hi task ${taskID} has no reusable child session`);
        if (worker.status !== 'ready' || !task.result || !['FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED'].includes(task.result.status))
            throw new Error(`Hi task ${taskID} is not resumable from status ${task.status}/${task.result?.status ?? 'none'}`);
        return this.start(m, { objective: task.objective, role: task.role, category: task.category, scope: [...task.scope], dependencies: [...task.dependencies], requiredEvidence: [...task.requiredEvidence], obligationIds: [...task.obligation_ids], model: worker.model, modelVariant: worker.model_variant, constraints: [...task.constraints], mcpServers: [...(task.execution_profile?.mcp_servers ?? [])], browserBackend: task.execution_profile?.browser_backend, browserAllowedOrigins: [...(task.execution_profile?.browser_allowed_origins ?? [])], resumeTaskId: task.id });
    }
    async pauseForSemanticAssessment(m) {
        if (m.identity.semantic_assessment.status !== 'pending')
            return 0;
        let paused = 0;
        for (const worker of m.execution.workers.filter(w => ['created', 'queued', 'starting', 'ready', 'busy'].includes(w.status))) {
            const task = m.execution.tasks.find(t => t.id === worker.task_id);
            if (!task)
                continue;
            worker.semantic_pause_revision = m.identity.semantic_assessment.revision;
            if (!worker.session_id) {
                worker.status = 'cancelled';
                task.status = 'cancelled';
                this.scheduler.release(worker.id);
                releaseTaskRuntimeReservation(m, worker.id, 'CANCEL');
                this.registry.delete(worker.id);
                this.#queue = this.#queue.filter(q => q.worker.id !== worker.id);
                await this.cleanupWorkspaceForTask(m, task.id);
                appendLedger(m, 'worker.semantic-cancelled-before-start', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision } });
                paused++;
                continue;
            }
            if (['starting', 'busy'].includes(worker.status)) {
                const stopped = await this.abortNativeSession(m, worker.session_id, 'semantic-quarantine', worker.id, task.id);
                if (!stopped) {
                    const marker = `semantic-abort-unavailable:${task.id}:${worker.id}`;
                    m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                    appendLedger(m, 'worker.semantic-pause-blocked', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, reason: 'abort-unavailable' } });
                    continue;
                }
                await this.cleanupBrowserForTask(m, task.id, worker.id);
                this.scheduler.release(worker.id);
                releaseTaskRuntimeReservation(m, worker.id);
            }
            worker.status = 'ready';
            task.status = task.result ? 'waiting' : 'waiting';
            this.registry.set(worker);
            appendLedger(m, 'worker.semantic-paused', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, session_id: worker.session_id } });
            paused++;
        }
        this.#queue = this.#queue.filter(q => q.mission.identity.mission_id !== m.identity.mission_id || q.worker.status !== 'cancelled');
        syncMissionGates(m);
        return paused;
    }
    async resumeAfterSemanticAssessment(m, messageKind) {
        if (m.identity.semantic_assessment.status !== 'assessed' || m.identity.status !== 'active')
            return 0;
        let resumed = 0;
        for (const worker of m.execution.workers.filter(w => w.semantic_pause_revision === m.identity.semantic_assessment.revision && w.status === 'ready' && Boolean(w.session_id))) {
            const task = m.execution.tasks.find(t => t.id === worker.task_id);
            if (!task || !worker.session_id)
                continue;
            try {
                this.workspaceBinding(m, task.id);
            }
            catch (error) {
                const marker = `workspace-orphan:${task.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                appendLedger(m, 'worker.semantic-resume-blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: String(error) } });
                continue;
            }
            const model = worker.model, resumeAdmission = this.reserveExistingSessionAttempt(m, worker, model);
            if (!resumeAdmission.ok) {
                appendLedger(m, 'worker.semantic-resume-deferred', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, reason: resumeAdmission.reason } });
                continue;
            }
            worker.generation_at_spawn = m.continuation.generation;
            worker.parent_mission_id = m.identity.mission_id;
            worker.status = 'busy';
            worker.semantic_pause_revision = undefined;
            worker.started_at = Date.now();
            task.status = 'running';
            this.registry.set(worker);
            beginWorkerAttempt(task, worker);
            this.recordModelProjection(worker, model, worker.model_variant);
            await this.sendProviderPrompt(worker.session_id, clipText([`Hi semantic follow-up reconciliation for existing task ${task.id}.`, `Follow-up kind: ${messageKind}.`, `Current mission objective: ${m.identity.objective}`, `Current user constraints: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `Still-selected methodologies: ${worker.selected_methodologies.join(', ') || 'none'}.`, 'Continue the SAME task/session from current context. Preserve completed work and evidence. Do not restart planning. If the follow-up creates separate work outside this task, report it rather than silently expanding scope. Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, worker.model_variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []));
            appendLedger(m, 'worker.semantic-resumed', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, message_kind: messageKind, session_id: worker.session_id } });
            resumed++;
        }
        return resumed;
    }
    async reconcileUserConstraint(m, text) {
        if (m.identity.status !== 'active' || m.continuation.user_interrupted)
            return 0;
        let reconciled = 0;
        for (const worker of m.execution.workers.filter(w => ['created', 'queued', 'starting', 'busy', 'ready'].includes(w.status))) {
            const task = m.execution.tasks.find(t => t.id === worker.task_id);
            if (!task)
                continue;
            try {
                this.workspaceBinding(m, task.id);
            }
            catch (error) {
                const marker = `workspace-orphan:${task.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                appendLedger(m, 'worker.constraint-rebase.blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: String(error) } });
                continue;
            }
            const beforeMethodologies = [...worker.selected_methodologies];
            const stillRequired = (name) => m.methodology.methodology_needs.some(need => need.name === name && (!need.task_id || need.task_id === task.id));
            worker.selected_methodologies = worker.selected_methodologies.filter(stillRequired);
            worker.methodologies = worker.methodologies.filter(item => worker.selected_methodologies.includes(item.name));
            if (task.execution_profile)
                task.execution_profile.methodologies = [...worker.selected_methodologies];
            const suppressedMethodologies = beforeMethodologies.filter(name => !worker.selected_methodologies.includes(name));
            if (suppressedMethodologies.length)
                appendLedger(m, 'worker.methodology-suppressed', { task_id: task.id, worker_id: worker.id, payload: { methodologies: suppressedMethodologies, generation: m.continuation.generation, reason: 'user-constraint-superseded-intent' } });
            task.constraints ??= [];
            if (!task.constraints.includes(text))
                task.constraints.push(text);
            task.updated_at = Date.now();
            // Queued/not-running work will build its handoff lazily from task.constraints.
            if (!worker.session_id || ['created', 'queued'].includes(worker.status) || (worker.status === 'ready' && !worker.semantic_pause_revision)) {
                worker.generation_at_spawn = m.continuation.generation;
                worker.parent_mission_id = m.identity.mission_id;
                appendLedger(m, 'worker.constraint-updated', { task_id: task.id, worker_id: worker.id, payload: { mode: 'deferred', generation: m.continuation.generation, constraint: text.slice(0, 300) } });
                reconciled++;
                continue;
            }
            const oldSession = worker.session_id, model = worker.model, variant = worker.model_variant;
            // A restrictive user constraint invalidates the in-flight prompt. Abort and rebase the SAME
            // task/worker identity onto a fresh child session so late idle/result callbacks from the old
            // session cannot be mistaken for work performed under the new constraint.
            this.registry.delete(worker.id);
            try {
                const stopped = await this.abortNativeSession(m, oldSession, 'constraint-rebase', worker.id, task.id);
                if (!stopped)
                    throw new Error('OpenCode session abort unavailable for constraint rebase');
                await this.cleanupBrowserForTask(m, task.id, worker.id);
            }
            catch (error) {
                const marker = `constraint-abort-unavailable:${task.id}:${worker.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                worker.status = 'busy';
                task.status = 'running';
                appendLedger(m, 'worker.constraint-rebase.blocked', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, error: String(error), generation: m.continuation.generation } });
                this.registry.set(worker);
                continue;
            }
            this.scheduler.release(worker.id);
            releaseTaskRuntimeReservation(m, worker.id);
            worker.session_id = undefined;
            worker.status = 'ready';
            task.status = 'waiting';
            this.registry.set(worker);
            if (!model) {
                appendLedger(m, 'worker.constraint-rebase.deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: 'model-missing' } });
                continue;
            }
            const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler);
            if (!reservation.accepted) {
                appendLedger(m, 'worker.constraint-rebase.deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: reservation.reason } });
                continue;
            }
            if (!this.scheduler.acquire(worker.id, providerOf(model), model === 'host-default' ? undefined : model)) {
                releaseTaskRuntimeReservation(m, worker.id);
                appendLedger(m, 'worker.constraint-rebase.deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: 'legacy-resource-backstop' } });
                continue;
            }
            try {
                this.recordModelProjection(worker, model, variant);
                const child = await this.#child.create(m.identity.session_id, `Hi · ${worker.role} · constraint update · ${task.objective.slice(0, 45)}`, worker.role, model === 'host-default' ? undefined : model, variant, this.workspaceBinding(m, task.id));
                if (!child?.id)
                    throw new Error('Constraint rebase child session id missing');
                const recoverySessionID = String(child.id);
                worker.session_id = recoverySessionID;
                const bound = bindTaskRuntimeHost(m, worker.id, recoverySessionID);
                if (!bound.accepted)
                    throw new Error(`Scheduler host binding failed during constraint rebase: ${bound.reason}`);
                worker.loaded_methodologies = [];
                worker.semantic_pause_revision = undefined;
                recordPreexistingUserBaseline(m, await this.captureNativeDiff(worker, 'baseline'));
                worker.parent_mission_id = m.identity.mission_id;
                worker.generation_at_spawn = m.continuation.generation;
                worker.status = 'busy';
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                const constraintExit = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const handoff = clipText([ownershipContract('child', worker.selected_methodologies), `Hi USER CONSTRAINT UPDATE for existing task ${task.id}.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${task.constraints.join(' | ')}`, `OBSERVED CHANGED FILES SO FAR: ${m.vcs.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${constraintExit.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'This is a fresh child session. Reload every still-selected methodology through the native skill tool before applying it.' : 'No methodology remains selected after the user constraint.', 'The previous child session was aborted because the user changed constraints. The latest constraint supersedes conflicting prior instructions. Do not write to prohibited surfaces. If prohibited files were already changed, report that explicitly; do not conceal or assume those edits are acceptable. Reconcile the existing task under the new constraint with the minimum safe change.', 'Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
                beginWorkerAttempt(task, worker);
                await this.sendProviderPrompt(child.id, handoff, worker.role, model === 'host-default' ? undefined : model, variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []));
                appendLedger(m, 'worker.constraint-rebased', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, to_session: worker.session_id, generation: m.continuation.generation, constraint: text.slice(0, 300) } });
                void this.events?.(runtimeSignal('worker.constraint-rebased', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { generation: m.continuation.generation } }));
                reconciled++;
            }
            catch (error) {
                let stopped = true;
                if (worker.session_id)
                    try {
                        stopped = await this.abortNativeSession(m, worker.session_id, 'constraint-rebase-failed', worker.id, task.id);
                    }
                    catch {
                        stopped = false;
                    }
                ;
                if (stopped) {
                    this.scheduler.release(worker.id);
                    releaseTaskRuntimeReservation(m, worker.id);
                    worker.session_id = undefined;
                    worker.status = 'ready';
                    task.status = task.result ? 'waiting' : 'blocked';
                }
                else {
                    const marker = `constraint-rebase-recovery-abort-unavailable:${task.id}:${worker.id}`;
                    m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                    worker.status = 'busy';
                    task.status = 'running';
                }
                this.registry.set(worker);
                appendLedger(m, 'worker.constraint-rebase.failed', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, error: String(error), generation: m.continuation.generation, host_stopped: stopped } });
            }
        }
        syncMissionGates(m);
        return reconciled;
    }
    async noteNativeWriteSet(m, workerID, files, source = 'session-diff', stateHash) { return this.#results.noteNativeWriteSet(m, workerID, files, source, stateHash); }
    noteNativeStatus(m, workerID, status) { this.#results.noteNativeStatus(m, workerID, status); }
    applyResult(m, workerID, result) { this.#results.applyResult(m, workerID, result); }
    async recoverStagnation(m, level, action = 'same-worker-resume') { return this.#recovery.recoverStagnation(m, level, action); }
    fail(m, workerID, error) { this.#recovery.fail(m, workerID, error); }
    peek(m, id) { const task = m.execution.tasks.find(t => t.id === id), worker = m.execution.workers.find(w => w.id === id || w.id === task?.worker_id); return { task, worker }; }
    async awaitTask(m, id, timeoutMs = 30_000) { let current = this.peek(m, id), status = current?.task?.status ?? current?.worker?.status ?? 'unknown'; if (['completed', 'failed', 'cancelled', 'blocked'].includes(status))
        return { ...current, status, terminal: true, changed: false, timed_out: false }; const worker = current?.worker; if (!worker)
        return { ...current, status, terminal: false, changed: false, timed_out: false }; const changed = await this.registry.waitForChange(worker.id, timeoutMs); current = this.peek(m, id); status = current?.task?.status ?? current?.worker?.status ?? 'unknown'; const terminal = ['completed', 'failed', 'cancelled', 'blocked'].includes(status); return { ...current, status, terminal, changed, timed_out: !changed && !terminal }; }
    list(m) { return m.execution.tasks.map(t => ({ task: t, worker: m.execution.workers.find(w => w.id === t.worker_id) })); }
    async cancelAll(m) { let n = 0; for (const w of [...m.execution.workers])
        if (['created', 'queued', 'starting', 'ready', 'busy'].includes(w.status))
            if (await this.cancel(m, w.id))
                n++; return n; }
    async cancel(m, id) { const task = m.execution.tasks.find(t => t.id === id), worker = m.execution.workers.find(w => w.id === id || w.id === task?.worker_id); if (!worker)
        return false; if (worker.session_id) {
        const stopped = await this.abortNativeSession(m, worker.session_id, 'worker-cancel', worker.id, worker.task_id);
        if (!stopped) {
            appendLedger(m, 'worker.cancel.blocked', { task_id: worker.task_id, worker_id: worker.id, payload: { reason: 'abort-unavailable' } });
            return false;
        }
        await this.cleanupBrowserForTask(m, worker.task_id, worker.id);
    } const reservationRelease = releaseTaskRuntimeReservation(m, worker.id, 'CANCEL'); if (!reservationRelease.accepted) {
        appendLedger(m, 'worker.cancel.scheduler-blocked', { task_id: worker.task_id, worker_id: worker.id, payload: { reason: reservationRelease.reason } });
        return false;
    } worker.status = 'cancelled'; this.scheduler.release(worker.id); const t = m.execution.tasks.find(x => x.id === worker.task_id); if (t)
        t.status = 'cancelled'; this.registry.delete(worker.id); this.#queue = this.#queue.filter(q => q.worker.id !== worker.id); await this.cleanupWorkspaceForTask(m, worker.task_id); appendLedger(m, 'worker.cancelled', { task_id: t?.id, worker_id: worker.id }); syncMissionGates(m); this.drainQueue(); return true; }
}
