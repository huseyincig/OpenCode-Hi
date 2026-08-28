import { evidenceVerdictPassed } from '../../contracts/evidence-kinds.js';
import { resolveCategory } from '../routing/category.js';
import { resolveModel } from '../routing/model-resolver.js';
import { methodologySkillCandidates, resolveSkillPlan } from '../skills/registry.js';
import { resolveSkillPermissionMap, resolveSkillToolEnabled } from '../skills/permissions.js';
import { createTask, createWorker, beginWorkerAttempt, retireTaskResultIssues, workerFingerprint } from '../worker/worker-runtime.js';
import { parseWorkerResult } from './result-parser.js';
import { appendLedger } from '../ledger/ledger.js';
import { routeCapabilities } from '../routing/capability-router.js';
import { bindMethodologyNeeds, methodologyNames, reconcileTaskEvidenceMethodologyNeeds, releaseCancelledTaskMethodologyNeeds, releaseFailedTaskMethodologyNeeds } from '../methodology/activation.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { methodologyProvenance, ownershipContract } from '../skills/methodology.js';
import { DEFAULT_CONTEXT_BUDGET, clipText } from '../context/budget.js';
import { runtimeSignal } from '../events/event-sink.js';
import { syncMissionGates } from '../gates/gates.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { evaluateTaskPreconditions, TaskPreconditionError } from '../readiness/preconditions.js';
import { effectiveExecutionSurface, verificationOnlyExecutionSurface, HI_PROCESS_EXECUTION_TOOL_IDS, resolveMcpServerExposure, taskPromptToolOverrides } from '../routing/execution-profile.js';
import { HI_BROWSER_EXECUTION_TOOL_IDS } from '../browser/executor.js';
import { browserOriginsFromTargets, browserOriginsFromText, normalizeBrowserAllowedOrigins, resolveBrowserBackend } from '../browser/backend-policy.js';
import { ProjectMethodologyLearningStore } from '../project-intelligence/methodology-learning.js';
import { executionProfileFor } from '../../config/execution-policy.js';
import { applyAdmittedProjectMethodologyPermissions } from '../methodology/host-permissions.js';
import { HI_CHILD_ROLES, isHiChildRole, isHiReadOnlyChildRole, isHiReviewerRole, roleCanOwnObligation } from '../roles/catalog.js';
import { createRuntimeScopedStores } from '../application/runtime-scoped-stores.js';
import { ChildExecutionCoordinator } from './child-execution-coordinator.js';
import { admitHostTerminalEvent } from './host-child-binding.js';
import { TaskResultReconciler } from './task-result-reconciler.js';
import { TaskRecoveryCoordinator } from './task-recovery-coordinator.js';
import { taskRuntimeAdmittedModel, taskRuntimeUnitDecision, reserveTaskRuntimeDispatch, bindTaskRuntimeHost, releaseTaskRuntimeReservation, reconcileTaskRuntimeRestart } from '../scheduler/task-runtime-adapter.js';
import { clearCapabilityUnavailable, markCapabilityUnavailable, markVerificationCapabilityUnavailable, reconcileTaskCapabilityPreconditions } from '../readiness/capability-failure.js';
import { bindWorkerUsageObservation } from '../economics/usage-runtime.js';
import { isTaskRequiredEvidenceKind } from '../../contracts/evidence-kinds.js';
import { recordRecoveryStrategy, recoveryModelHazard } from '../continuation/recovery-governor.js';
import { deniedMutationAtoms } from '../constraint/constraint-atoms.js';
import { explorationClearanceFreshness } from '../execution/exploration-clearance.js';
import { QueuedWorkerDispatcher } from './queued-worker-dispatcher.js';
import { projectSchedulingPeerView } from '../scheduler/project-peer-view.js';
import { isPersistentRunningProcess } from '../../contracts/process.js';
import { assessMissionLiveness, recordAssistantProgress } from '../liveness/assessment.js';
import { verificationKindAdmittedForMission } from '../verification/policy.js';
const CATEGORIES = new Set(['quick', 'standard', 'deep', 'visual', 'critical']);
const MAX_QUEUE = 32;
class TaskQueueCapacityError extends Error {
    constructor() { super('Hi bounded dispatch queue is full'); this.name = 'TaskQueueCapacityError'; }
}
function ownerForObligation(m, kind) {
    const caps = new Set(m.identity.intent.requiredCapabilities);
    if (kind === 'research')
        return 'researcher';
    if (kind === 'documentation')
        return 'technical-writer';
    if (kind === 'test-authoring')
        return 'test-engineer';
    if (kind === 'implementation')
        return 'coder';
    if (kind === 'analysis')
        return caps.has('external-research') ? 'researcher' : caps.has('design-exploration') ? 'architect' : 'repository-explorer';
    if (kind === 'review')
        return caps.has('security-review') ? 'security-reviewer' : caps.has('visual-qa') ? 'visual-qa' : 'qa-reviewer';
    if (kind === 'verification')
        return caps.has('visual-qa') ? 'visual-qa' : undefined;
    return undefined;
}
function canonicalRoleForTask(m, routedRole, explicit = [], requestedRole = '') {
    const obligations = [...new Set(explicit)].map(id => m.execution.obligations.find(o => o.id === id && o.status === 'open')).filter(Boolean);
    const owners = [...new Set(obligations.map(o => ownerForObligation(m, o.kind)).filter((x) => Boolean(x)))];
    if (owners.length > 1)
        throw new Error(`Task spans multiple canonical role owners (${owners.join(', ')}); decompose the obligations into separate hi_task_start calls.`);
    if (owners.length === 1)
        return owners[0];
    if (requestedRole && isHiChildRole(requestedRole)) {
        const exactOpenOwner = m.execution.obligations.some(o => o.status === 'open' && ownerForObligation(m, o.kind) === requestedRole);
        if (exactOpenOwner)
            return requestedRole;
        const hardVisual = m.identity.intent.requiredCapabilities.includes('visual-qa') || m.identity.intent.requiredCapabilities.includes('visual-review');
        if (hardVisual && requestedRole !== 'visual-qa')
            return routedRole;
        // Backward-compatible additive support tasks: historical read-only specialists may inspect
        // without becoming the owner of implementation/review obligations. Their result remains
        // obligation/evidence fenced and cannot close a different canonical owner's work.
        if (isHiReadOnlyChildRole(requestedRole))
            return requestedRole;
    }
    if (!requestedRole) {
        const openOwners = [...new Set(m.execution.obligations.filter(o => o.status === 'open').map(o => ownerForObligation(m, o.kind)).filter((x) => Boolean(x)))];
        if (isHiChildRole(routedRole) && openOwners.includes(routedRole))
            return routedRole;
        if (openOwners.length === 1)
            return openOwners[0];
        if (openOwners.length > 1)
            throw new Error(`Open obligations span multiple canonical role owners (${openOwners.join(', ')}); supply exact obligation_ids or decompose the work.`);
    }
    if (isHiChildRole(routedRole))
        return routedRole;
    throw new Error(`No canonical role owner for task semantics; routed=${routedRole || 'none'}`);
}
function ownedProcessResumeContext(m, task, worker) {
    if (task.execution_profile?.process_lifecycle !== true)
        return undefined;
    const owned = m.execution.processes.filter(process => process.task_id === task.id && process.worker_id === worker.id && process.cleanup_state !== 'CLEANED').slice(0, 8);
    if (!owned.length)
        return 'CURRENT OWNED RUNTIME PROCESSES: none recorded for this exact task/worker.';
    const rows = owned.map(process => `${process.process_id} status=${process.status} cleanup=${process.cleanup_state} pid=${process.pid} cwd=${process.cwd}`);
    return `CURRENT OWNED RUNTIME PROCESSES: ${rows.join(' | ')}. These are the canonical ProcessContract records for this exact task/worker. A RUNNING record is not permission to assume host liveness blindly: reobserve your own process with hi_process_list/hi_process_read before deciding whether another spawn is required. Do not spawn a duplicate merely because the previous WorkerResult omitted process state.`;
}
function explicitObligationEvidenceContract(m, explicit = []) {
    const obligations = [...new Set(explicit)].map(id => m.execution.obligations.find(o => o.id === id && o.status === 'open')).filter(Boolean);
    const requiredEvidence = [];
    let authoritative = false;
    for (const obligation of obligations) {
        if (obligation.kind === 'review') {
            authoritative = true;
            requiredEvidence.push('review-evidence');
            continue;
        }
        if ((obligation.requiredEvidence ?? []).length) {
            authoritative = true;
            requiredEvidence.push(...(obligation.requiredEvidence ?? []));
        }
    }
    return { requiredEvidence: [...new Set(requiredEvidence.map(kind => String(kind).trim()).filter(Boolean))], authoritative };
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
    if (role === 'researcher')
        kinds.push('research');
    if (role === 'technical-writer')
        kinds.push('documentation');
    if (role === 'test-engineer')
        kinds.push('test-authoring');
    if (['repository-explorer', 'architect', 'researcher'].includes(role) || role === 'coder' && ['bug-fix', 'diagnosis', 'performance'].includes(m.identity.intent.taskKind))
        kinds.push('analysis');
    if (isHiReviewerRole(role))
        kinds.push('review');
    if (requiredEvidence.length)
        kinds.push('verification');
    const out = [];
    for (const kind of [...new Set(kinds)].filter(k => roleCanOwnObligation(role, k) && ownerForObligation(m, k) === role)) {
        const candidates = m.execution.obligations.filter(o => o.kind === kind && o.status === 'open');
        if (candidates.length === 1)
            out.push(candidates[0].id);
    }
    return [...new Set(out)];
}
function foreignVerificationEvidence(m, role, obligationIds) {
    const owned = new Set(obligationIds), foreign = m.execution.obligations.filter(o => o.kind === 'verification' && o.status === 'open' && !owned.has(o.id) && ownerForObligation(m, o.kind) !== undefined && ownerForObligation(m, o.kind) !== role);
    const owners = [...new Set(foreign.map(o => ownerForObligation(m, o.kind)).filter((x) => Boolean(x)))];
    if (owners.length !== 1)
        return { kinds: [], obligationIds: [] };
    return { owner: owners[0], kinds: [...new Set(foreign.flatMap(o => o.requiredEvidence ?? []).map(kind => String(kind).trim()).filter(Boolean))], obligationIds: foreign.map(o => o.id) };
}
function unresolvedResultOwner(m, obligationIds, excludeTaskId) {
    if (!obligationIds.length)
        return undefined;
    const owned = new Set(obligationIds);
    return m.execution.tasks.find(task => task.id !== excludeTaskId && task.status !== 'cancelled' && task.result && ['FIX_REQUIRED', 'NEEDS_CONTEXT'].includes(task.result.status) && task.obligation_ids.some(id => owned.has(id)));
}
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
    getProjectMissions;
    processCustody;
    #queue = [];
    #draining = false;
    #methodologyLearning;
    #child;
    #dispatcher;
    #results;
    #recovery;
    #scopedStores;
    constructor(childHost, registry, scheduler, projectRoot, hiRoot, getConfig, getModels, getHostConfig, events, hostCapabilitySource = [], scopedStores, workspaceRuntime, extraHostResources = () => new Set(), browserExecutor, ensureBrowserResource, readAssistantResult, previewManager, getProjectMissions = () => [], processCustody) {
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
        this.getProjectMissions = getProjectMissions;
        this.processCustody = processCustody;
        this.#scopedStores = scopedStores ?? createRuntimeScopedStores(projectRoot, hiRoot);
        this.#methodologyLearning = new ProjectMethodologyLearningStore(projectRoot);
        this.#child = new ChildExecutionCoordinator(childHost, registry);
        this.#dispatcher = new QueuedWorkerDispatcher(childHost, this.#child, registry, scheduler, projectRoot, this.#scopedStores, getConfig, getModels, getHostConfig, (m, taskID) => this.workspaceBinding(m, taskID), (m, taskID) => this.cleanupWorkspaceForTask(m, taskID), (m, task, worker, error) => this.blockDependencyOutcome(m, task, worker, error), events, previewManager, (m) => this.projectPeerView(m));
        this.#results = new TaskResultReconciler(scheduler, registry, projectRoot, events, this.#methodologyLearning, this.#child, getHostConfig, (m, w, run) => this.queueTask(m, w, run), () => this.drainQueue(), this.#scopedStores, (m) => this.projectPeerView(m));
        this.#recovery = new TaskRecoveryCoordinator(scheduler, registry, projectRoot, getConfig, getModels, getHostConfig, events, this.#child, () => this.drainQueue(), (m, taskID) => this.workspaceBinding(m, taskID), (m) => this.projectPeerView(m));
    }
    async sendProviderPrompt(sessionID, text, role, model, variant, tools, messageID) { return this.#child.sendProviderPrompt(sessionID, text, role, model, variant, tools, messageID); }
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
    forgetChildCallback(sessionID) { const worker = this.#child.resolveCallbackWorker(sessionID); if (!worker)
        return false; this.registry.delete(worker.id); return true; }
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
    async settleHostIdlePermissionDenial(m, worker) {
        const denial = worker.pending_native_permission_denial, task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!denial)
            return { applied: false, reason: 'native-permission-denial-not-recorded' };
        if (!task) {
            delete worker.pending_native_permission_denial;
            return { applied: false, reason: 'task-not-found' };
        }
        const current = denial.session_id === worker.session_id && denial.attempt === worker.attempt && denial.generation === (worker.generation_at_spawn ?? m.continuation.generation);
        if (!current) {
            appendLedger(m, 'worker.permission-denial.stale-attempt-ignored', { task_id: task.id, worker_id: worker.id, payload: { permission_id: denial.permission_id, receipt_session_id: denial.session_id, worker_session_id: worker.session_id, receipt_attempt: denial.attempt, worker_attempt: worker.attempt, receipt_generation: denial.generation, worker_generation: worker.generation_at_spawn } });
            delete worker.pending_native_permission_denial;
            return { applied: false, reason: 'native-permission-denial-stale-attempt' };
        }
        const marker = `permission-denied:${denial.permission_id}`, patternSummary = denial.patterns.slice(0, 6).join(' | ') || 'native action withheld by OpenCode permission policy';
        let result = { status: 'NEEDS_CONTEXT', summary: 'OpenCode denied a native action and ended this child turn before a structured WorkerResult could be emitted.', changed_files: [], evidence: [], open_issues: [marker], needs_context: [`native-permission-denied: ${patternSummary}. Do not retry or bypass the denied action. Resume this exact task/session only with an allowed materially different path, or report BLOCKED if the denied action is required.`] };
        result = await this.reconcileNativeResult(m, worker.id, result);
        result = await this.reintegrateWorkspaceResult(m, worker.id, result);
        delete worker.pending_native_permission_denial;
        appendLedger(m, 'worker.permission-denial.settling', { task_id: task.id, worker_id: worker.id, payload: { permission_id: denial.permission_id, session_id: denial.session_id, attempt: denial.attempt, generation: denial.generation, patterns: denial.patterns.slice(0, 12), policy: 'preserve-native-deny-no-auto-retry' } });
        this.applyResult(m, worker.id, result);
        worker.restart_reconcile_pending = false;
        if (['completed', 'failed', 'cancelled'].includes(worker.status))
            this.registry.delete(worker.id);
        else
            this.registry.set(worker);
        appendLedger(m, 'worker.permission-denial.settled', { task_id: task.id, worker_id: worker.id, payload: { permission_id: denial.permission_id, status: result.status, attempt: denial.attempt, generation: denial.generation } });
        return { applied: true, reason: 'host-idle-native-permission-denied', result };
    }
    async settleHostIdleAssistantResult(m, worker, assistant) {
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return { applied: false, reason: 'task-not-found' };
        const expectedParent = worker.attempt_prompt_message_id, observedParent = assistant.model?.parent_id, createdAt = assistant.model?.created_at, parentMismatch = Boolean(expectedParent && observedParent && expectedParent !== observedParent), predatesAttempt = Boolean(Number.isFinite(createdAt) && worker.started_at !== undefined && Number(createdAt) < worker.started_at);
        if (parentMismatch || predatesAttempt) {
            appendLedger(m, 'worker.assistant-result.stale-attempt-message', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, message_id: assistant.model?.message_id, parent_id: observedParent, expected_parent_id: expectedParent, created_at: createdAt, attempt_started_at: worker.started_at, attempt: worker.attempt, generation: worker.generation_at_spawn, parent_mismatch: parentMismatch, predates_attempt: predatesAttempt } });
            return { applied: false, reason: 'assistant-result-stale-attempt-message' };
        }
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
    async blockDependencyOutcome(m, task, worker, error) { worker.status = 'failed'; task.status = 'blocked'; task.updated_at = Date.now(); const marker = `dependency-outcome-unavailable:${task.id}`; task.result = { status: 'BLOCKED', summary: `Direct dependency outcome could not be projected safely before dispatch: ${error.message}`.slice(0, 1200), changed_files: [], evidence: [], open_issues: [marker], needs_context: ['reconcile completed dependency result/worker attempt identity before dispatch'] }; m.execution.blockers = [...new Set([...m.execution.blockers, marker])]; this.registry.delete(worker.id); releaseTaskRuntimeReservation(m, worker.id); await this.cleanupWorkspaceForTask(m, task.id); appendLedger(m, 'worker.dependency-outcome-blocked', { task_id: task.id, worker_id: worker.id, payload: { reason: error.message, dependencies: [...task.dependencies] } }); syncMissionGates(m); }
    projectPeerView(m) { return projectSchedulingPeerView(m, this.getProjectMissions()); }
    admittedModel(m, worker, chain, resumeTaskId) { return taskRuntimeAdmittedModel(m, worker, chain, this.scheduler, this.projectPeerView(m), resumeTaskId); }
    reserveExistingSessionAttempt(m, worker, model, resumeTaskId) {
        if (!model || !worker.session_id)
            return { ok: false, reason: 'model-or-session-missing' };
        if (this.admittedModel(m, worker, [model], resumeTaskId) !== model)
            return { ok: false, reason: 'scheduler-not-admitted' };
        const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler, Date.now(), this.projectPeerView(m), resumeTaskId);
        if (!reservation.accepted)
            return { ok: false, reason: reservation.reason };
        const bound = bindTaskRuntimeHost(m, worker.id, worker.session_id);
        if (!bound.accepted) {
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
    queueTask(m, worker, run, source = 'runtime') { if (this.#queue.some(x => x.worker.id === worker.id))
        return; if (this.#queue.length >= MAX_QUEUE)
        throw new TaskQueueCapacityError(); const t = m.execution.tasks.find(x => x.id === worker.task_id); worker.status = 'queued'; if (t)
        t.status = 'queued'; this.#queue.push({ mission: m, worker, run }); this.registry.set(worker); appendLedger(m, 'worker.queued', { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length, source } }); void this.events?.(runtimeSignal('worker.queued', m.identity.mission_id, { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length, source } })); syncMissionGates(m); }
    rehydrateQueued(input) { const missions = Array.isArray(input) ? input : [input], pending = missions.flatMap(m => m.execution.workers.filter(w => w.status === 'queued' && !w.session_id).map(worker => ({ mission: m, worker, task: m.execution.tasks.find(t => t.id === worker.task_id) }))).filter((x) => Boolean(x.task?.status === 'queued' && x.task.execution_profile)).sort((a, b) => a.task.created_at - b.task.created_at || a.mission.identity.mission_id.localeCompare(b.mission.identity.mission_id) || a.task.id.localeCompare(b.task.id)); const unseen = pending.filter(x => !this.#queue.some(q => q.worker.id === x.worker.id)); if (this.#queue.length + unseen.length > MAX_QUEUE)
        throw new Error(`Restored durable dispatch queue exceeds bounded capacity: ${this.#queue.length + unseen.length}/${MAX_QUEUE}`); let restored = 0; for (const { mission, worker, task } of unseen) {
        worker.generation_at_spawn = mission.continuation.generation;
        worker.parent_mission_id = mission.identity.mission_id;
        this.queueTask(mission, worker, () => this.#dispatcher.run(mission, task, worker), 'restart');
        appendLedger(mission, 'worker.restart-queue-rehydrated', { task_id: task.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length } });
        restored++;
    } if (restored)
        this.drainQueue(); return restored; }
    wakeQueued() { this.drainQueue(); }
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
        releaseTaskRuntimeReservation(m, worker.id, 'CANCEL');
        m.execution.workers = m.execution.workers.filter(item => item.id !== worker.id);
        m.execution.tasks = m.execution.tasks.filter(item => item.id !== task.id);
        appendLedger(m, 'worker.queue-rejected', { payload: { discarded_task_id: task.id, discarded_worker_id: worker.id, queue_depth: this.#queue.length, reason: 'bounded-dispatch-queue-full' } });
        syncMissionGates(m);
        return true;
    }
    async invalidateQueuedForUnresolvedOwner(m, task, worker, owner) {
        const cleaned = await this.cleanupWorkspaceForTask(m, task.id), now = Date.now();
        this.registry.delete(worker.id);
        releaseTaskRuntimeReservation(m, worker.id, 'CANCEL');
        if (!cleaned) {
            const marker = `queue-invalidation-cleanup-failed:${task.id}`;
            worker.status = 'failed';
            worker.completed_at = now;
            task.status = 'blocked';
            task.updated_at = now;
            task.result = { status: 'BLOCKED', summary: `Queued task cannot dispatch because canonical task ${owner.id} now owns unresolved ${owner.result?.status ?? 'result'} state, and queued workspace cleanup failed.`, changed_files: [], evidence: [], open_issues: [marker], needs_context: ['reconcile queued workspace ownership before retrying or replacing this task'] };
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
            releaseFailedTaskMethodologyNeeds(m, task.id);
            appendLedger(m, 'worker.queue-invalidation-cleanup-blocked', { task_id: task.id, worker_id: worker.id, payload: { owner_task_id: owner.id, owner_status: owner.result?.status, overlapping_obligations: task.obligation_ids.filter(id => owner.obligation_ids.includes(id)) } });
            syncMissionGates(m);
            return;
        }
        worker.status = 'cancelled';
        worker.completed_at = now;
        task.status = 'cancelled';
        task.updated_at = now;
        releaseCancelledTaskMethodologyNeeds(m, task.id);
        appendLedger(m, 'worker.queue-reconcile-invalidated', { task_id: task.id, worker_id: worker.id, payload: { owner_task_id: owner.id, owner_status: owner.result?.status, overlapping_obligations: task.obligation_ids.filter(id => owner.obligation_ids.includes(id)), reason: 'canonical-unresolved-owner-before-dispatch' } });
        syncMissionGates(m);
    }
    async queuedRuntimeResourcesReady(m, task, worker) {
        if (task.execution_profile?.browser_backend !== 'bounded-playwright')
            return true;
        let available = this.extraHostResources().has('host-capability:browser-execution'), reason = 'browser-execution-resource-unavailable-after-queue-admission';
        if (this.ensureBrowserResource)
            try {
                const refreshed = await this.ensureBrowserResource();
                available = refreshed.available;
                reason = refreshed.reason ?? reason;
                appendLedger(m, 'operational-tool.resolved', { task_id: task.id, worker_id: worker.id, payload: { capability: 'browser-execution', available: refreshed.available, implementation: refreshed.implementationId, status: refreshed.status, scope: refreshed.scope, receipt_path: refreshed.receiptPath, phase: 'queued-readiness' } });
            }
            catch (error) {
                available = false;
                reason = String(error);
            }
        if (available) {
            clearCapabilityUnavailable(m, 'browser-execution');
            return true;
        }
        const requiredKinds = [...new Set(task.requiredEvidence.flatMap(kind => kind === 'visual-check' ? ['visual-evidence'] : ['visual-evidence', 'browser-evidence', 'accessibility-evidence'].includes(kind) ? [kind] : []))];
        markVerificationCapabilityUnavailable(m, { capability: 'browser-execution', reason, requiredKinds: requiredKinds.length ? requiredKinds : ['visual-evidence'], obligationIds: task.obligation_ids, taskId: task.id, workerId: worker.id });
        return false;
    }
    drainQueue() { if (this.#draining)
        return; this.#draining = true; queueMicrotask(async () => { try {
        let progress = true;
        while (progress) {
            progress = false;
            for (let i = 0; i < this.#queue.length; i++) {
                const e = this.#queue[i], t = e.mission.execution.tasks.find(x => x.id === e.worker.task_id), chain = [e.worker.model, ...e.worker.fallbacks].filter((x) => Boolean(x));
                if (e.mission.continuation.user_interrupted || ['completed', 'stopped', 'failed'].includes(e.mission.identity.status) || e.worker.status === 'cancelled') {
                    this.#queue.splice(i--, 1);
                    continue;
                }
                if (e.mission.identity.status !== 'active' || e.mission.identity.semantic_assessment.status !== 'assessed')
                    continue;
                if (!t) {
                    this.#queue.splice(i--, 1);
                    continue;
                }
                const unresolvedOwner = unresolvedResultOwner(e.mission, t.obligation_ids, t.id);
                if (unresolvedOwner) {
                    this.#queue.splice(i--, 1);
                    await this.invalidateQueuedForUnresolvedOwner(e.mission, t, e.worker, unresolvedOwner);
                    progress = true;
                    continue;
                }
                if (!await this.queuedRuntimeResourcesReady(e.mission, t, e.worker))
                    continue;
                const decision = taskRuntimeUnitDecision(e.mission, e.worker, chain[0], this.scheduler, this.projectPeerView(e.mission)), failed = decision?.disposition === 'BLOCKED_DEPENDENCY' ? decision.blockingDependencyIds.filter(id => { const status = e.mission.execution.tasks.find(task => task.id === id)?.status; return status === 'failed' || status === 'cancelled'; }) : [];
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
        const resumeTask = input.resumeTaskId ? m.execution.tasks.find(t => t.id === input.resumeTaskId) : undefined, resumeWorker = resumeTask ? m.execution.workers.find(w => (w.id === resumeTask.worker_id || w.task_id === resumeTask.id) && !['completed', 'failed', 'cancelled'].includes(w.status)) : undefined;
        if (input.resumeTaskId && (!resumeTask || !resumeWorker))
            throw new Error(`Hi task ${input.resumeTaskId} has no resumable worker`);
        if (resumeTask?.obligation_ids.length && resumeTask.obligation_ids.every(id => m.execution.obligations.some(o => o.id === id && o.status === 'closed')))
            throw new Error(`Hi task ${resumeTask.id} owns no open obligations; satisfied task ownership cannot be resumed implicitly. Create separate work only for a newly opened canonical obligation.`);
        if (resumeTask && resumeWorker && resumeTask.role !== resumeWorker.role)
            throw new Error(`Hi task ${resumeTask.id} role identity mismatch: task=${resumeTask.role}, worker=${resumeWorker.role}`);
        const processLifecycleRequested = input.processLifecycle === true, explicitEvidence = (input.requiredEvidence ?? []).map(value => String(value).trim()).filter(Boolean), explicitObligations = (input.obligationIds ?? []).filter(Boolean), invalidExplicitEvidence = explicitEvidence.filter(kind => !isTaskRequiredEvidenceKind(kind));
        if (invalidExplicitEvidence.length)
            throw new Error(`Unsupported Hi required evidence kind(s): ${[...new Set(invalidExplicitEvidence)].join(', ')}. Use canonical task evidence IDs only.`);
        const implicitProcessSupport = processLifecycleRequested && !explicitEvidence.length && !explicitObligations.length;
        if (implicitProcessSupport && !input.resumeTaskId && !input.objective?.trim())
            throw new Error('Implicit process-lifecycle support task requires an explicit bounded objective for the process resource; it cannot inherit the Mission objective');
        const objective = input.objective?.trim() || resumeTask?.objective || m.identity.objective;
        const taskIntent = m.identity.intent;
        const cfg = this.getConfig(), routingProfile = cfg.profile[executionProfileFor(cfg.executionPolicy, taskIntent)], routed = routeCapabilities(taskIntent, { specialistThreshold: routingProfile.specialistThreshold, reviewThreshold: routingProfile.reviewThreshold }), defaultCategory = resolveCategory(taskIntent), category = (resumeTask?.category ?? (CATEGORIES.has(String(input.category)) ? input.category : (routed.category ?? defaultCategory))), requestedRole = String(input.role ?? '').trim();
        if (requestedRole && !isHiChildRole(requestedRole))
            throw new Error(`Unsupported Hi child role '${requestedRole}'. Use one of: ${HI_CHILD_ROLES.join(', ')}`);
        let role;
        if (resumeTask) {
            if (!isHiChildRole(resumeTask.role))
                throw new Error(`Hi task ${resumeTask.id} has invalid stored role '${resumeTask.role}'`);
            if (requestedRole && requestedRole !== resumeTask.role)
                throw new Error(`Exact resume role drift for task ${resumeTask.id}: stored canonical role is '${resumeTask.role}', requested '${requestedRole}'. Resume cannot change task ownership; create separate work only after the existing task is reconciled.`);
            role = resumeTask.role;
        }
        else if (implicitProcessSupport && !requestedRole)
            role = 'coder';
        else {
            if (requestedRole && (input.obligationIds?.length ?? 0) > 0) {
                const requestedObligations = [...new Set(input.obligationIds ?? [])].map(id => m.execution.obligations.find(o => o.id === id && o.status === 'open')).filter(Boolean);
                const disallowed = requestedObligations.filter(o => !roleCanOwnObligation(requestedRole, o.kind));
                if (disallowed.length)
                    throw new Error(`Role ${requestedRole} cannot own obligation(s): ${disallowed.map(o => `${o.id}:${o.kind}`).join(', ')}`);
            }
            const canonicalRole = canonicalRoleForTask(m, routed.role, input.obligationIds ?? [], requestedRole);
            if (!isHiChildRole(canonicalRole))
                throw new Error(`No canonical role owner for task semantics: ${canonicalRole}`);
            if (requestedRole && requestedRole !== canonicalRole)
                throw new Error(`Incompatible requested role '${requestedRole}': canonical role owner is '${canonicalRole}'. Category/model-supplied role hints cannot override semantic ownership.`);
            role = canonicalRole;
        }
        const roleSelectionReason = implicitProcessSupport && !requestedRole ? ['implicit-process-support:canonical-runtime-resource-owner'] : routed.reason;
        const missionVerificationKinds = [...new Set(m.execution.verification_policy.requiredKinds)], admittedExplicitEvidence = explicitEvidence.filter(kind => missionVerificationKinds.length > 0 && verificationKindAdmittedForMission(m, kind)), rejectedExplicitEvidence = explicitEvidence.filter(kind => !admittedExplicitEvidence.includes(kind)), requestedEvidence = implicitProcessSupport ? [] : explicitEvidence.length ? admittedExplicitEvidence : missionVerificationKinds;
        const obligationIds = implicitProcessSupport ? [] : inferObligationIds(m, role, requestedEvidence, explicitObligations), ownedObligationEvidence = implicitProcessSupport ? { requiredEvidence: [], authoritative: false } : explicitObligationEvidenceContract(m, obligationIds), obligationRequiredEvidence = ownedObligationEvidence.authoritative ? ownedObligationEvidence.requiredEvidence : requestedEvidence, foreignVerification = implicitProcessSupport ? { kinds: [], obligationIds: [] } : foreignVerificationEvidence(m, role, obligationIds), foreignVerificationKinds = new Set(foreignVerification.kinds), ownerReconciledEvidence = foreignVerificationKinds.size ? obligationRequiredEvidence.filter(kind => !foreignVerificationKinds.has(kind)) : obligationRequiredEvidence, reviewOwnerMismatch = !isHiReviewerRole(role) && ownerReconciledEvidence.includes('review-evidence'), requiredEvidence = reviewOwnerMismatch ? ownerReconciledEvidence.filter(kind => kind !== 'review-evidence') : ownerReconciledEvidence, invalidEvidence = requiredEvidence.filter(kind => !isTaskRequiredEvidenceKind(kind));
        if (invalidEvidence.length)
            throw new Error(`Unsupported Hi required evidence kind(s): ${[...new Set(invalidEvidence)].join(', ')}. Use canonical task evidence IDs only.`);
        if (rejectedExplicitEvidence.length)
            appendLedger(m, 'task.evidence-contract-reconciled', { payload: { role, obligation_ids: obligationIds, requested_evidence: [...new Set(explicitEvidence)], authoritative_evidence: [...admittedExplicitEvidence], removed_evidence: [...new Set(rejectedExplicitEvidence)], mission_verification: [...missionVerificationKinds], policy: 'mission-verification-admission-wins' } });
        if (ownedObligationEvidence.authoritative && JSON.stringify([...new Set(requestedEvidence)]) !== JSON.stringify(ownedObligationEvidence.requiredEvidence))
            appendLedger(m, 'task.evidence-contract-reconciled', { payload: { role, obligation_ids: obligationIds, requested_evidence: [...new Set(requestedEvidence)], authoritative_evidence: ownedObligationEvidence.requiredEvidence, policy: 'exact-open-obligation-contract-wins' } });
        if (foreignVerificationKinds.size)
            appendLedger(m, 'task.evidence-owner-reconciled', { payload: { role, obligation_ids: obligationIds, verification_owner: foreignVerification.owner, verification_obligation_ids: foreignVerification.obligationIds, requested_evidence: [...new Set(obligationRequiredEvidence)], removed_evidence: [...foreignVerificationKinds].filter(kind => obligationRequiredEvidence.includes(kind)), authoritative_evidence: [...ownerReconciledEvidence], policy: 'distinct-verification-owner-wins' } });
        if (reviewOwnerMismatch)
            appendLedger(m, 'task.evidence-owner-reconciled', { payload: { role, obligation_ids: obligationIds, requested_evidence: [...new Set(ownerReconciledEvidence)], removed_evidence: ['review-evidence'], authoritative_evidence: [...requiredEvidence], policy: 'review-evidence-requires-reviewer-role' } });
        reconcileTaskEvidenceMethodologyNeeds(m, this.projectRoot, { requiredEvidence, obligationIds });
        const hostConfig = this.getHostConfig();
        applyAdmittedProjectMethodologyPermissions(hostConfig, this.projectRoot);
        const selected = resolveModel(category, this.getModels(), this.getConfig(), input.model, role, hostConfig);
        if (selected.rejected.length)
            appendLedger(m, 'model.policy.rejected', { payload: { items: selected.rejected.slice(0, 20) } });
        const taskMethodologyNeeds = implicitProcessSupport ? [] : m.methodology.methodology_needs.filter(need => input.resumeTaskId ? need.task_id === input.resumeTaskId || (!need.task_id && (!need.obligation_id || obligationIds.includes(need.obligation_id))) : !need.task_id && (!need.obligation_id || obligationIds.includes(need.obligation_id)));
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
        let extraResources = this.extraHostResources();
        const browserRequested = role === 'visual-qa' && requestedMethodologyNames.some(name => ['hi-browser-testing', 'hi-visual-qa', 'hi-accessibility-review'].includes(name));
        let browserBootstrap;
        if (browserRequested && this.ensureBrowserResource) {
            browserBootstrap = await this.ensureBrowserResource();
            appendLedger(m, 'operational-tool.resolved', { payload: { capability: 'browser-execution', available: browserBootstrap.available, implementation: browserBootstrap.implementationId, status: browserBootstrap.status, scope: browserBootstrap.scope, receipt_path: browserBootstrap.receiptPath, phase: 'task-requirement' } });
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
        const explicitBrowserRequiredOrigins = normalizeBrowserAllowedOrigins([...(input.browserRequiredOrigins ?? []), ...browserOriginsFromText(objective), ...browserOriginsFromTargets(taskIntent.likelyTargets ?? [])]), persistentProcesses = m.execution.processes.filter(isPersistentRunningProcess), liveServiceOrigins = normalizeBrowserAllowedOrigins(persistentProcesses.flatMap(process => process.service_origins ?? []));
        let browserRequiredOrigins = [...explicitBrowserRequiredOrigins];
        if (browserDecision.backend === 'bounded-playwright' && browserRequested && persistentProcesses.length) {
            if (!browserRequiredOrigins.length && liveServiceOrigins.length === 1)
                browserRequiredOrigins = [...liveServiceOrigins];
            else if (!browserRequiredOrigins.length && liveServiceOrigins.length > 1)
                throw new Error(`Multiple live service browser origins are active (${liveServiceOrigins.join(', ')}); pass browser_required_origins explicitly for this visual task.`);
            else if (!browserRequiredOrigins.length)
                throw new Error(`Live persistent process target is unregistered (${persistentProcesses.map(process => process.process_id).join(', ')}); static preview cannot substitute. Read the exact retained process once to reconcile an observed loopback URL, or pass browser_required_origins explicitly.`);
            else if (liveServiceOrigins.length && browserRequiredOrigins.some(origin => !liveServiceOrigins.includes(origin)))
                throw new Error(`Visual task required origin must match an active registered live service origin while a persistent service is running. required=${browserRequiredOrigins.join(', ')} active=${liveServiceOrigins.join(', ')}`);
        }
        const browserAllowedOrigins = normalizeBrowserAllowedOrigins([...(input.browserAllowedOrigins ?? []), ...browserRequiredOrigins]);
        if (browserDecision.backend === 'bounded-playwright' && browserRequested && !browserAllowedOrigins.length && !this.previewManager)
            throw new Error('Bounded Playwright browser backend requires at least one exact allowed origin or the Hi-owned local preview capability');
        if (browserDecision.backend === 'mcp' && browserAllowedOrigins.length)
            throw new Error('browser_allowed_origins belongs only to the bounded-playwright backend; MCP origin policy remains native-authoritative');
        const candidates = methodologySkillCandidates(requestedMethodologyNames, this.projectRoot, this.hiRoot, hostConfig, catalog), permissionMap = resolveSkillPermissionMap(hostConfig, role), skillToolEnabled = resolveSkillToolEnabled(hostConfig, role), baseSurface = effectiveExecutionSurface(hostConfig, role, skillToolEnabled), verificationOnlyOwnership = obligationIds.length > 0 && obligationIds.every(id => m.execution.obligations.some(o => o.id === id && o.kind === 'verification')), surface = verificationOnlyOwnership ? verificationOnlyExecutionSurface(baseSurface) : baseSurface, hostCapabilities = typeof this.hostCapabilitySource === 'function' ? this.hostCapabilitySource() : Array.isArray(this.hostCapabilitySource) ? this.hostCapabilitySource : [], availableResources = new Set([...hostCapabilities.filter(item => item.status === 'SUPPORTED' && item.runtime_health_required !== true).map(item => `host-capability:${item.id}`), ...extraResources, ...(browserDecision.backend ? ['runtime-capability:browser-execution'] : [])]), skillPlan = resolveSkillPlan(requestedMethodologyNames, candidates, permissionMap, skillToolEnabled, role, catalog, availableResources), methodologies = skillPlan.selected.map(s => s.name), methodologyResourceFailures = skillPlan.outcomes.filter(item => item.outcome === 'resource-unavailable').map(item => item.name), methodologyAdmissionFailures = methodologies.length ? [] : skillPlan.outcomes.filter(item => ['deny', 'disabled', 'missing', 'invalid', 'unknown-policy'].includes(item.outcome)).map(item => `${item.name}:${item.outcome}`);
        appendLedger(m, 'skill.resolved', { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } });
        void this.events?.(runtimeSignal('skill.resolved', m.identity.mission_id, { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } }));
        if (skillPlan.missing.length)
            appendLedger(m, 'skill.fallback', { payload: { missing: skillPlan.missing, requested: skillPlan.requested, skillToolEnabled } });
        const scope = input.scope ?? (implicitProcessSupport ? [] : isHiReadOnlyChildRole(role) && m.vcs.changed_files.length ? m.vcs.changed_files : taskIntent.likelyTargets ?? []);
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
        const constraints = [...new Set([...(m.execution.constraints ?? []), ...(input.constraints ?? []), ...(isolationRequired ? ['hi-isolation:git-worktree'] : []), ...mcpExposure.selected.map(name => `hi-mcp:${name}`), ...(browserDecision.backend ? [`hi-browser-backend:${browserDecision.backend}`] : []), ...browserAllowedOrigins.map(origin => `hi-browser-origin:${origin}`)])], desiredFingerprint = workerFingerprint(role, category, selected.primary, taskIntent.taskKind, objective, { scope, constraints, dependencies, requiredEvidence, obligationIds }), existing = resumeWorker ?? m.execution.workers.find(w => w.fingerprint === desiredFingerprint && !['completed', 'failed', 'cancelled'].includes(w.status));
        const unresolvedOwner = input.resumeTaskId ? undefined : unresolvedResultOwner(m, obligationIds, existing?.task_id);
        if (unresolvedOwner) {
            appendLedger(m, 'task.start.reconcile-required', { task_id: unresolvedOwner.id, payload: { requested_role: role, requested_obligations: obligationIds, unresolved_status: unresolvedOwner.result?.status } });
            throw new Error(`Canonical task ${unresolvedOwner.id} has unresolved ${unresolvedOwner.result?.status}; resume/reconcile that exact task before starting new work for obligation(s): ${obligationIds.filter(id => unresolvedOwner.obligation_ids.includes(id)).join(', ')}`);
        }
        const resumeCapable = Boolean(existing?.session_id), clearanceFreshness = explorationClearanceFreshness(this.projectRoot, m), implementationOwner = !implicitProcessSupport && obligationIds.some(id => m.execution.obligations.some(o => o.id === id && o.kind === 'implementation' && o.status === 'open')), unresolvedRepositoryAmbiguity = m.identity.intent.ambiguity !== 'none' && m.execution.obligations.some(o => o.kind === 'analysis' && o.status === 'open'), preflight = evaluateTaskPreconditions({ role, implementation: implementationOwner, dependencies: { unknown: unknownDependencies, failed: unavailableDependencies, incomplete: incompleteDependencies }, modelAvailable: Boolean(selected.primary), native: { childSession: resumeCapable || this.childHost.capabilities.create, prompt: this.childHost.capabilities.prompt }, hostConfig, methodologyResourceFailures, methodologyAdmissionFailures, contractCriticalAmbiguity: m.identity.intent.ambiguity === 'contract-critical', unresolvedRepositoryAmbiguity, staleExplorationClearance: clearanceFreshness.required && !clearanceFreshness.current, authorityRequired: false });
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
                const nextModel = this.admittedModel(m, existing, chain, oldTask.id) ?? existing.model;
                if (!nextModel)
                    throw new Error('Worker resume scheduler admission unavailable');
                const resumeAdmission = this.reserveExistingSessionAttempt(m, existing, nextModel, oldTask.id);
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
                const issues = oldTask.result.open_issues.join(' | '), missing = oldTask.result.needs_context.join(' | '), freshEvidence = m.execution.evidence.items.filter(e => !e.invalidated_at && evidenceVerdictPassed(e.pass, e.outcome) && (e.task_id === oldTask.id || e.obligation_ids?.some(id => oldTask.obligation_ids.includes(id)))).filter(e => !oldTask.requiredEvidence.length || oldTask.requiredEvidence.some(kind => kind === e.kind || (kind === 'visual-check' && e.kind === 'visual-evidence'))).slice(-8).map(e => `${e.kind}: ${e.summary}`).join(' | '), reviewScope = isHiReadOnlyChildRole(existing.role) ? `Scoped rereview only: previous findings=${issues || 'none'}; task scope=${oldTask.scope.join(',') || 'none'}; task-owned fresh evidence=${freshEvidence || 'none'}.` : '', reviewVerdictContract = isHiReviewerRole(existing.role) && oldTask.requiredEvidence.includes('review-evidence') ? 'REVIEWER CLOSURE CONTRACT: this bounded task passes only by returning evidence.kind="review-evidence" with outcome="passed". Mission verification kinds not listed in TASK REQUIRED EVIDENCE belong to other owners and must not block or be claimed by this reviewer. Do not call parent-only Hi control-plane tools; return the structured WorkerResult claim only.' : '', processResumeContext = ownedProcessResumeContext(m, oldTask, existing), resumeExitRequirements = existing.selected_methodologies.flatMap(name => { const item = catalog.find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const resumeVariant = nextModel === selected.primary ? selected.primaryVariant : selected.fallbackVariants[nextModel];
                const protectedBaseline = Object.keys(m.vcs.preexisting_user_changes ?? {}).slice(0, 60);
                const correctionLevel = Math.min(2, hazardBeforeResume.attempts + 1);
                beginWorkerAttempt(oldTask, existing);
                this.recordModelProjection(existing, nextModel, resumeVariant);
                await this.sendProviderPrompt(existing.session_id, clipText([`Hi corrective resume for existing task ${oldTask.id}.`, `Previous status: ${oldTask.result.status}.`, `TASK REQUIRED EVIDENCE: ${oldTask.requiredEvidence.join(', ') || 'none'}.`, reviewVerdictContract, `Missing context: ${missing || 'none'}.`, `Open issues: ${issues || 'none'}.`, `Current user constraints: ${(oldTask.constraints ?? []).join(' | ') || 'none'}.`, `CURRENT TASK-OWNED FRESH EVIDENCE: ${freshEvidence || 'none'}.`, processResumeContext, `METHODOLOGY EXIT REQUIREMENTS: ${resumeExitRequirements.join(' | ') || 'none'}.`, protectedBaseline.length ? `PRE-EXISTING USER DIRTY BASELINE: ${protectedBaseline.join(', ')}. Cleanup means restore these paths to their exact worker-start baseline, NOT to HEAD. Never discard user-owned edits with git checkout/reset/restore.` : 'Pre-existing user dirty baseline: none observed.', reviewScope, correctionLevel === 1 ? 'Resume from current session context. Apply the smallest correction. Do not restart planning or create sub-orchestrators. Return the structured WorkerResult again.' : 'Resume the SAME task/session, but use a materially different corrective hypothesis or action from the prior correction. Do not repeat the failed strategy, restart planning, or create sub-orchestrators. Return the structured WorkerResult again.'].filter(Boolean).join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), existing.role, nextModel === 'host-default' ? undefined : nextModel, resumeVariant, taskPromptToolOverrides(oldTask.execution_profile?.tools ?? [], this.getHostConfig(), oldTask.execution_profile?.mcp_servers ?? []), existing.attempt_prompt_message_id);
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
        const browserTools = browserDecision.backend === 'bounded-playwright' && role === 'visual-qa' && methodologies.some(name => ['hi-browser-testing', 'hi-visual-qa', 'hi-accessibility-review'].includes(name)) ? [...HI_BROWSER_EXECUTION_TOOL_IDS] : [], processTools = processLifecycleRequested ? [...HI_PROCESS_EXECUTION_TOOL_IDS] : [], taskTools = [...surface.tools.filter(t => (t !== 'skill' || methodologies.length > 0)), ...processTools, ...browserTools];
        const verificationCases = role === 'visual-qa' ? [...new Map(obligationIds.flatMap(id => m.execution.obligations.find(o => o.id === id)?.verificationCases ?? []).map(c => [c.id, c])).values()].map(c => ({ ...c, required_browser_actions: [...c.required_browser_actions] })) : [];
        const profile = { role, category, task: { objective, scope: [...scope], dependencies: [...dependencies], required_evidence: [...requiredEvidence], ...(verificationCases.length ? { verification_cases: verificationCases } : {}) }, tools: taskTools, ...(mcpExposure.selected.length ? { mcp_servers: mcpExposure.selected } : {}), ...(processLifecycleRequested ? { process_lifecycle: true } : {}), ...(browserDecision.backend ? { browser_backend: browserDecision.backend } : {}), ...(browserAllowedOrigins.length ? { browser_allowed_origins: browserAllowedOrigins } : {}), ...(browserRequiredOrigins.length ? { browser_required_origins: browserRequiredOrigins } : {}), model: selected.primary, model_variant: input.modelVariant ?? selected.primaryVariant, fallback_models: selected.fallbacks, fallback_variants: selected.fallbackVariants, fallback_reasons: selected.fallbackReasons, methodologies, permission_profile: { skill_tool_enabled: skillToolEnabled, skill_permissions: permissionMap ?? {}, external_effects: 'parent-only', recursive_task: 'deny', native: surface.permissions }, verification_policy: { ...m.execution.verification_policy, requiredKinds: [...m.execution.verification_policy.requiredKinds] }, max_context_chars: DEFAULT_CONTEXT_BUDGET.max_context_chars, max_handoff_chars: DEFAULT_CONTEXT_BUDGET.max_handoff_chars, max_result_chars: DEFAULT_CONTEXT_BUDGET.max_result_chars, max_artifacts: DEFAULT_CONTEXT_BUDGET.max_artifacts };
        const task = createTask(m, { objective, role, category, scope, constraints, dependencies, requiredEvidence, obligationIds, verificationCases, contextReferences: selectedContextReferences, executionProfile: profile });
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
        const chain = [profile.model, ...profile.fallback_models].filter((x) => Boolean(x)), run = () => this.#dispatcher.run(m, task, worker, { relevantContext: input.relevantContext, forkFromSession: input.forkFromSession });
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
            return { task_id: task.id, worker_id: worker.id, model: worker.model, methodologies: worker.selected_methodologies, selection_reason: [...roleSelectionReason, ...selected.reason, ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), 'queued:runtime-capacity-or-prerequisite', ...skillPlan.reason], readiness: 'WAIT', preconditions: preflight.items };
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
            return { task_id: spawnedTask?.id ?? spawned.task_id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...roleSelectionReason, ...selected.reason, 'deduped:existing-spawn', ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
        }
        return { task_id: task.id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...roleSelectionReason, ...selected.reason, ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
    }
    async resume(m, taskID) {
        const task = m.execution.tasks.find(t => t.id === taskID);
        if (!task)
            throw new Error(`Unknown Hi task ${taskID}`);
        const worker = m.execution.workers.find(w => w.id === task.worker_id || w.task_id === task.id);
        if (!worker)
            throw new Error(`Hi task ${taskID} has no worker`);
        if (!worker.session_id) {
            const recovered = await this.#recovery.resumeBlockedProviderFailure(m, worker.id);
            if (recovered)
                return { task_id: task.id, worker_id: worker.id, session_id: worker.session_id, model: worker.model, methodologies: worker.selected_methodologies, selection_reason: ['provider-terminal-recovery:bounded-automatic-candidate'], readiness: 'READY', preconditions: [] };
            throw new Error(`Hi task ${taskID} has no reusable child session`);
        }
        if (worker.status !== 'ready' || !task.result || !['FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED'].includes(task.result.status))
            throw new Error(`Hi task ${taskID} is not resumable from status ${task.status}/${task.result?.status ?? 'none'}`);
        return this.start(m, { objective: task.objective, role: task.role, category: task.category, scope: [...task.scope], dependencies: [...task.dependencies], requiredEvidence: [...task.requiredEvidence], obligationIds: [...task.obligation_ids], model: worker.model, modelVariant: worker.model_variant, constraints: [...task.constraints], mcpServers: [...(task.execution_profile?.mcp_servers ?? [])], browserBackend: task.execution_profile?.browser_backend, browserAllowedOrigins: [...(task.execution_profile?.browser_allowed_origins ?? [])], processLifecycle: task.execution_profile?.process_lifecycle === true, resumeTaskId: task.id });
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
                const acceptedQueued = worker.status === 'queued' && task.status === 'queued' && this.#queue.some(q => q.worker.id === worker.id);
                if (acceptedQueued) {
                    this.registry.set(worker);
                    appendLedger(m, 'worker.semantic-queue-paused', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, reason: 'followup-meaning-pending' } });
                    paused++;
                    continue;
                }
                worker.status = 'cancelled';
                task.status = 'cancelled';
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
        const pausedQueued = m.execution.workers.filter(w => w.semantic_pause_revision === m.identity.semantic_assessment.revision && w.status === 'queued' && !w.session_id);
        if (['non-material', 'resume'].includes(messageKind)) {
            for (const worker of pausedQueued) {
                const task = m.execution.tasks.find(t => t.id === worker.task_id);
                if (!task)
                    continue;
                worker.generation_at_spawn = m.continuation.generation;
                worker.parent_mission_id = m.identity.mission_id;
                worker.semantic_pause_revision = undefined;
                this.registry.set(worker);
                appendLedger(m, 'worker.semantic-queue-resumed', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, message_kind: messageKind, generation: m.continuation.generation } });
                resumed++;
            }
        }
        else
            for (const worker of pausedQueued) {
                const task = m.execution.tasks.find(t => t.id === worker.task_id);
                if (!task)
                    continue;
                worker.status = 'cancelled';
                task.status = 'cancelled';
                worker.semantic_pause_revision = undefined;
                releaseTaskRuntimeReservation(m, worker.id, 'CANCEL');
                this.registry.delete(worker.id);
                this.#queue = this.#queue.filter(q => q.worker.id !== worker.id);
                await this.cleanupWorkspaceForTask(m, task.id);
                appendLedger(m, 'worker.semantic-cancelled-before-start', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, message_kind: messageKind, reason: 'material-followup-invalidated-queued-recipe' } });
            }
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
            await this.sendProviderPrompt(worker.session_id, clipText([`Hi semantic follow-up reconciliation for existing task ${task.id}.`, `Follow-up kind: ${messageKind}.`, `Current mission objective: ${m.identity.objective}`, `Current user constraints: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `Still-selected methodologies: ${worker.selected_methodologies.join(', ') || 'none'}.`, 'Continue the SAME task/session from current context. Preserve completed work and evidence. Do not restart planning. If the follow-up creates separate work outside this task, report it rather than silently expanding scope. Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, worker.model_variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
            appendLedger(m, 'worker.semantic-resumed', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, message_kind: messageKind, session_id: worker.session_id } });
            resumed++;
        }
        this.#queue = this.#queue.filter(q => q.mission.identity.mission_id !== m.identity.mission_id || q.worker.status !== 'cancelled');
        this.drainQueue();
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
                worker.semantic_pause_revision = undefined;
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
            releaseTaskRuntimeReservation(m, worker.id);
            worker.session_id = undefined;
            worker.status = 'ready';
            task.status = 'waiting';
            this.registry.set(worker);
            if (!model) {
                appendLedger(m, 'worker.constraint-rebase.deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: 'model-missing' } });
                continue;
            }
            const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler, Date.now(), this.projectPeerView(m));
            if (!reservation.accepted) {
                appendLedger(m, 'worker.constraint-rebase.deferred', { task_id: task.id, worker_id: worker.id, payload: { reason: reservation.reason } });
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
                await this.sendProviderPrompt(child.id, handoff, worker.role, model === 'host-default' ? undefined : model, variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
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
        this.drainQueue();
        return reconciled;
    }
    async noteNativeWriteSet(m, workerID, files, source = 'session-diff', stateHash) { return this.#results.noteNativeWriteSet(m, workerID, files, source, stateHash); }
    noteNativeStatus(m, workerID, status) { this.#results.noteNativeStatus(m, workerID, status); }
    async assessLiveness(m, now = Date.now(), processes = {}, knownHostSessions = {}) { const hostSessions = { ...knownHostSessions }; for (const worker of m.execution.workers) {
        if (!worker.session_id || ['completed', 'failed', 'cancelled'].includes(worker.status) || worker.generation_at_spawn !== m.continuation.generation)
            continue;
        let status = 'unknown';
        try {
            status = await this.#child.status(worker.session_id);
        }
        catch { }
        hostSessions[worker.session_id] = status;
        if ((status === 'busy' || status === 'retry') && this.readAssistantResult)
            try {
                const activity = (await this.readAssistantResult(worker.session_id, 12)).activity;
                if (activity)
                    recordAssistantProgress(m, { worker_id: worker.id, task_id: worker.task_id, session_id: worker.session_id, generation: worker.generation_at_spawn ?? m.continuation.generation, message_id: activity.message_id, observed_at: activity.observed_at, output_tokens: activity.output_tokens, reasoning_tokens: activity.reasoning_tokens, tool_calls: activity.tool_calls, text_chars: activity.text_chars });
            }
            catch { }
    } return assessMissionLiveness(m, { now, hostSessions, processes }); }
    async recoverStalledExecution(m, assessment) { return this.#recovery.recoverCanonicalStall(m, assessment); }
    applyResult(m, workerID, result) { const worker = m.execution.workers.find(w => w.id === workerID), task = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : undefined; this.#results.applyResult(m, workerID, result); if (task?.status === 'failed')
        releaseFailedTaskMethodologyNeeds(m, task.id); }
    async recoverStagnation(m, level, action = 'same-worker-resume') { return this.#recovery.recoverStagnation(m, level, action); }
    fail(m, workerID, error) { this.#recovery.fail(m, workerID, error); }
    peek(m, id) { const task = m.execution.tasks.find(t => t.id === id), worker = m.execution.workers.find(w => w.id === id || w.id === task?.worker_id); return { task, worker }; }
    async observeWorkerLiveness(m, worker) {
        if (!worker.session_id || worker.generation_at_spawn !== m.continuation.generation)
            return { live_status: 'unknown', progress_observed: false };
        let live_status = 'unknown';
        try {
            live_status = await this.#child.status(worker.session_id);
        }
        catch { }
        let progress_observed = false;
        if ((live_status === 'busy' || live_status === 'retry') && this.readAssistantResult)
            try {
                const activity = (await this.readAssistantResult(worker.session_id, 12)).activity;
                if (activity)
                    progress_observed = recordAssistantProgress(m, { worker_id: worker.id, task_id: worker.task_id, session_id: worker.session_id, generation: worker.generation_at_spawn ?? m.continuation.generation, message_id: activity.message_id, observed_at: activity.observed_at, output_tokens: activity.output_tokens, reasoning_tokens: activity.reasoning_tokens, tool_calls: activity.tool_calls, text_chars: activity.text_chars });
            }
            catch { }
        return { live_status, progress_observed };
    }
    async awaitTask(m, id, timeoutMs = 30_000) { let current = this.peek(m, id), status = current?.task?.status ?? current?.worker?.status ?? 'unknown'; if (['completed', 'failed', 'cancelled', 'blocked'].includes(status))
        return { ...current, status, terminal: true, changed: false, timed_out: false, live_status: 'idle', progress_observed: false }; const worker = current?.worker; if (!worker)
        return { ...current, status, terminal: false, changed: false, timed_out: false, live_status: 'unknown', progress_observed: false }; await this.observeWorkerLiveness(m, worker); const changed = await this.registry.waitForChange(worker.id, timeoutMs); current = this.peek(m, id); status = current?.task?.status ?? current?.worker?.status ?? 'unknown'; const terminal = ['completed', 'failed', 'cancelled', 'blocked'].includes(status), observed = terminal ? { live_status: 'idle', progress_observed: false } : await this.observeWorkerLiveness(m, current?.worker ?? worker); if (!changed && !terminal && observed.progress_observed)
        appendLedger(m, 'worker.await-progress-observed', { task_id: current?.task?.id, worker_id: (current?.worker ?? worker).id, payload: { session_id: (current?.worker ?? worker).session_id, attempt: (current?.worker ?? worker).attempt, live_status: observed.live_status } }); return { ...current, status, terminal, changed, timed_out: !changed && !terminal, ...observed }; }
    async modelCancelAdmission(m, id) {
        const task = m.execution.tasks.find(t => t.id === id), worker = m.execution.workers.find(w => w.id === id || w.id === task?.worker_id), resolvedTask = worker ? m.execution.tasks.find(t => t.id === worker.task_id) : task;
        if (!worker)
            return { allowed: false, reason: 'worker-not-found' };
        if (['completed', 'failed', 'cancelled'].includes(worker.status) || ['completed', 'failed', 'cancelled'].includes(resolvedTask?.status ?? ''))
            return { allowed: false, reason: 'task-already-terminal', task_id: resolvedTask?.id, worker_id: worker.id };
        if (worker.status === 'ready' || worker.status === 'created' || worker.status === 'queued')
            return { allowed: true, reason: 'non-running-task', task_id: resolvedTask?.id, worker_id: worker.id };
        if (!worker.session_id)
            return { allowed: false, reason: 'active-worker-session-unverified', live_status: 'unknown', task_id: resolvedTask?.id, worker_id: worker.id };
        const observed = await this.observeWorkerLiveness(m, worker);
        const reason = observed.live_status === 'busy' || observed.live_status === 'retry' ? 'healthy-worker-active' : observed.live_status === 'idle' ? 'child-result-reconcile-required' : 'active-worker-liveness-unverified';
        appendLedger(m, 'worker.cancel.admission-blocked', { task_id: resolvedTask?.id, worker_id: worker.id, payload: { reason, live_status: observed.live_status, progress_observed: observed.progress_observed, session_id: worker.session_id, attempt: worker.attempt } });
        return { allowed: false, reason, live_status: observed.live_status, task_id: resolvedTask?.id, worker_id: worker.id };
    }
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
        const browserClean = await this.cleanupBrowserForTask(m, worker.task_id, worker.id);
        if (!browserClean) {
            appendLedger(m, 'worker.cancel.blocked', { task_id: worker.task_id, worker_id: worker.id, payload: { reason: 'browser-cleanup-failed' } });
            return false;
        }
    } if (this.processCustody)
        try {
            await this.processCustody.settleTaskOwner(m, worker.task_id, worker.id);
        }
        catch (error) {
            appendLedger(m, 'worker.cancel.blocked', { task_id: worker.task_id, worker_id: worker.id, payload: { reason: 'process-cleanup-failed', error: String(error) } });
            return false;
        } const reservationRelease = releaseTaskRuntimeReservation(m, worker.id, 'CANCEL'); if (!reservationRelease.accepted) {
        appendLedger(m, 'worker.cancel.scheduler-blocked', { task_id: worker.task_id, worker_id: worker.id, payload: { reason: reservationRelease.reason } });
        return false;
    } worker.status = 'cancelled'; const t = m.execution.tasks.find(x => x.id === worker.task_id), cancelledIssues = [...(t?.result?.open_issues ?? [])]; if (t)
        t.status = 'cancelled'; const retiredIssues = retireTaskResultIssues(m, worker.task_id, cancelledIssues); releaseCancelledTaskMethodologyNeeds(m, worker.task_id); this.registry.delete(worker.id); this.#queue = this.#queue.filter(q => q.worker.id !== worker.id); await this.cleanupWorkspaceForTask(m, worker.task_id); appendLedger(m, 'worker.cancelled', { task_id: t?.id, worker_id: worker.id, payload: { retired_result_issues: retiredIssues.slice(0, 30) } }); syncMissionGates(m); this.drainQueue(); return true; }
}
