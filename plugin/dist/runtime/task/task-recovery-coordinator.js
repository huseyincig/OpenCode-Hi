import { runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { classifyWorkerFailure } from '../worker/failure-classifier.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { releaseFailedTaskMethodologyNeeds } from '../methodology/activation.js';
import { ownershipContract } from '../skills/methodology.js';
import { DEFAULT_CONTEXT_BUDGET, clipText } from '../context/budget.js';
import { taskPromptToolOverrides } from '../routing/execution-profile.js';
import { beginWorkerAttempt } from '../worker/worker-runtime.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { appendLedger } from '../ledger/ledger.js';
import { runtimeSignal } from '../events/event-sink.js';
import { syncMissionGates } from '../gates/gates.js';
import { EMPTY_PROJECT_SCHEDULING_PEER_VIEW } from '../scheduler/project-peer-view.js';
import { taskRuntimeAdmittedModel, reserveTaskRuntimeDispatch, bindTaskRuntimeHost, beginTaskRuntimeSettlement, releaseTaskRuntimeReservation } from '../scheduler/task-runtime-adapter.js';
import { recordRecoveryStrategy, recoveryModelHazard } from '../continuation/recovery-governor.js';
export class TaskRecoveryCoordinator {
    scheduler;
    registry;
    projectRoot;
    getConfig;
    getModels;
    getHostConfig;
    events;
    child;
    drainQueueCallback;
    workspaceBinding;
    cleanupBrowser;
    readAssistantResult;
    getProjectPeerView;
    callbackDisposition(m, worker) { if ((worker.parent_mission_id !== undefined && worker.parent_mission_id !== m.identity.mission_id) || (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.continuation.generation))
        return 'stale-mission'; return 'accept'; }
    constructor(scheduler, registry, projectRoot, getConfig, getModels, getHostConfig, events, child, drainQueueCallback, workspaceBinding, cleanupBrowser, readAssistantResult, getProjectPeerView = () => EMPTY_PROJECT_SCHEDULING_PEER_VIEW) {
        this.scheduler = scheduler;
        this.registry = registry;
        this.projectRoot = projectRoot;
        this.getConfig = getConfig;
        this.getModels = getModels;
        this.getHostConfig = getHostConfig;
        this.events = events;
        this.child = child;
        this.drainQueueCallback = drainQueueCallback;
        this.workspaceBinding = workspaceBinding;
        this.cleanupBrowser = cleanupBrowser;
        this.readAssistantResult = readAssistantResult;
        this.getProjectPeerView = getProjectPeerView;
    }
    async recoverStalledAwaitWorker(m) {
        if (m.identity.status !== 'active' || m.continuation.user_interrupted)
            return { disposition: 'NOOP', reason: 'mission-not-active' };
        const candidates = [...m.execution.workers].reverse().filter(w => w.status === 'busy' && Boolean(w.session_id) && Boolean(w.model));
        for (const worker of candidates) {
            const task = m.execution.tasks.find(t => t.id === worker.task_id);
            if (!task || task.status !== 'running' || !worker.session_id || !worker.model)
                continue;
            const allTimeouts = m.execution.ledger.filter(e => e.type === 'worker.await-timeout' && e.task_id === task.id && e.worker_id === worker.id && String(e.payload?.session_id ?? '') === worker.session_id && Number(e.payload?.attempt) === worker.attempt).slice(-8);
            const allWait = allTimeouts.reduce((n, e) => n + Math.max(0, Number(e.payload?.timeout_ms ?? 0)), 0);
            if (allTimeouts.length < 3 || allWait < 120_000)
                continue;
            if (!this.readAssistantResult) {
                appendLedger(m, 'worker.busy-stall-recovery.skipped', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, attempt: worker.attempt, reason: 'host-activity-reader-unavailable' } });
                return { disposition: 'NOOP', reason: 'host-activity-reader-unavailable', worker_id: worker.id, task_id: task.id, from_model: worker.model };
            }
            let activity;
            try {
                activity = (await this.readAssistantResult(worker.session_id, 24)).activity;
            }
            catch (error) {
                appendLedger(m, 'worker.busy-stall-recovery.skipped', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, attempt: worker.attempt, reason: 'host-activity-read-failed', error: String(error).slice(0, 500) } });
                return { disposition: 'NOOP', reason: 'host-activity-read-failed', worker_id: worker.id, task_id: task.id, from_model: worker.model };
            }
            const attemptStart = worker.started_at ?? 0, activityAt = activity && Number.isFinite(activity.observed_at) && activity.observed_at >= attemptStart ? activity.observed_at : 0;
            const timeouts = activityAt ? allTimeouts.filter(e => e.at > activityAt) : allTimeouts, total = timeouts.reduce((n, e) => n + Math.max(0, Number(e.payload?.timeout_ms ?? 0)), 0);
            if (timeouts.length < 3 || total < 120_000) {
                if (activityAt) {
                    const already = m.execution.ledger.some(e => e.type === 'worker.await-progress-observed' && e.task_id === task.id && e.worker_id === worker.id && String(e.payload?.session_id ?? '') === worker.session_id && Number(e.payload?.attempt) === worker.attempt && String(e.payload?.activity_message_id ?? '') === String(activity?.message_id ?? ''));
                    if (!already)
                        appendLedger(m, 'worker.await-progress-observed', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, attempt: worker.attempt, activity_at: activityAt, activity_message_id: activity?.message_id, output_tokens: activity?.output_tokens, reasoning_tokens: activity?.reasoning_tokens, tool_calls: activity?.tool_calls, text_chars: activity?.text_chars, await_timeouts_after_progress: timeouts.length, observed_wait_ms_after_progress: total } });
                    return { disposition: 'NOOP', reason: 'meaningful-host-progress-observed', worker_id: worker.id, task_id: task.id, from_model: worker.model };
                }
                continue;
            }
            const hostStatus = await this.child.status(worker.session_id);
            if (hostStatus !== 'busy' && hostStatus !== 'retry') {
                appendLedger(m, 'worker.busy-stall-recovery.skipped', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, attempt: worker.attempt, host_status: hostStatus, await_timeouts: timeouts.length, observed_wait_ms: total, reason: 'host-not-active' } });
                continue;
            }
            const fromModel = worker.model, fromSession = worker.session_id, next = (worker.recovery_candidates ?? []).find(id => id !== fromModel && runtimeModelCandidateStatus(id, this.getModels(), this.getConfig(), this.getHostConfig(), worker.role).ok);
            const blockAfterAbort = (reason, detail) => { const marker = `host-liveness-recovery:${reason}:${task.id}`; worker.status = 'ready'; worker.session_id = undefined; task.status = 'blocked'; task.updated_at = Date.now(); task.result = { status: 'BLOCKED', summary: `Bounded host-liveness recovery could not continue: ${detail ?? reason}`.slice(0, 1200), changed_files: [], evidence: [], open_issues: [marker], needs_context: ['an admissible recovery model or repaired runtime capability is required before this task can continue'] }; m.execution.blockers = [...new Set([...m.execution.blockers, marker])]; this.registry.set(worker); syncMissionGates(m); appendLedger(m, 'worker.busy-stall-recovery.blocked', { task_id: task.id, worker_id: worker.id, payload: { session_id: fromSession, attempt: worker.attempt, model: fromModel, reason, detail } }); return { disposition: 'BLOCKED', reason, worker_id: worker.id, task_id: task.id, from_model: fromModel }; };
            const stopped = await this.child.abortNativeSession(m, fromSession, 'bounded-await-host-liveness-stall', worker.id, task.id);
            if (!stopped) {
                appendLedger(m, 'worker.busy-stall-recovery.quarantined', { task_id: task.id, worker_id: worker.id, payload: { session_id: fromSession, attempt: worker.attempt, model: fromModel, host_status: hostStatus, await_timeouts: timeouts.length, observed_wait_ms: total, reason: 'abort-unavailable' } });
                return { disposition: 'QUARANTINED', reason: 'abort-unavailable', worker_id: worker.id, task_id: task.id, from_model: fromModel };
            }
            const browserClean = await this.cleanupBrowser?.(m, task.id, worker.id) ?? true;
            const released = releaseTaskRuntimeReservation(m, worker.id);
            worker.session_id = undefined;
            worker.status = 'ready';
            task.status = 'waiting';
            this.registry.set(worker);
            if (!released.accepted) {
                appendLedger(m, 'worker.busy-stall-recovery.quarantined', { task_id: task.id, worker_id: worker.id, payload: { session_id: fromSession, attempt: worker.attempt, reason: released.reason } });
                return { disposition: 'QUARANTINED', reason: released.reason, worker_id: worker.id, task_id: task.id, from_model: fromModel };
            }
            if (!next)
                return blockAfterAbort('no-admissible-recovery-model', `No recovery-only candidate is currently admissible from ${fromModel}.`);
            if (!browserClean)
                return blockAfterAbort('browser-cleanup-failed', 'The prior visual execution owner could not be cleaned after its host session was aborted.');
            const priorFork = worker.forked_from_session_id, priorVariant = worker.model_variant, nextVariant = task.execution_profile?.fallback_variants?.[next];
            const reservation = reserveTaskRuntimeDispatch(m, worker, next, this.scheduler, Date.now(), this.getProjectPeerView(m));
            if (!reservation.accepted)
                return blockAfterAbort('replacement-reservation-unavailable', reservation.reason);
            try {
                this.child.recordModelProjection(worker, next, nextVariant);
                const created = await this.child.create(m.identity.session_id, `Hi · ${worker.role} · liveness recovery · ${task.objective.slice(0, 40)}`, worker.role, next === 'host-default' ? undefined : next, nextVariant, this.workspaceBinding?.(m, task.id));
                if (!created.id)
                    throw new Error('Host-liveness recovery child session id missing');
                const recoverySessionID = String(created.id);
                worker.session_id = recoverySessionID;
                worker.forked_from_session_id = fromSession;
                const bound = bindTaskRuntimeHost(m, worker.id, recoverySessionID);
                if (!bound.accepted)
                    throw new Error(`Scheduler host binding failed during host-liveness recovery: ${bound.reason}`);
                worker.loaded_methodologies = [];
                worker.model = next;
                worker.model_variant = nextVariant;
                worker.fallback_history = [...(worker.fallback_history ?? []), { from: fromModel, to: next, variant: nextVariant, reason: 'bounded host-liveness stall after repeated task await timeouts', phase: 'runtime', at: Date.now() }];
                worker.runtime_recovery_pending = true;
                worker.runtime_recovery_attempt = (worker.runtime_recovery_attempt ?? 0) + 1;
                worker.status = 'busy';
                worker.generation_at_spawn = m.continuation.generation;
                worker.parent_mission_id = m.identity.mission_id;
                task.status = 'running';
                this.registry.set(worker);
                recordPreexistingUserBaseline(m, await this.child.captureNativeDiff(worker, 'baseline'));
                const exits = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const prompt = clipText([ownershipContract('child', worker.selected_methodologies), `Hi host-liveness stall recovery for existing task ${task.id}.`, `The prior child remained host ${hostStatus} after ${timeouts.length} bounded task-await timeouts totaling ${total}ms and was explicitly aborted before this replacement.`, `Previous session: ${fromSession}.`, `Recovery model: ${next}.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `OBSERVED CHANGED FILES SO FAR: ${m.vcs.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${exits.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'This is a fresh recovery session for the SAME task. Reload every still-selected methodology through the native skill tool before continuing.' : 'No methodology is selected for this recovery.', 'Preserve already-observed project state/evidence, inspect only the minimum current state needed, do not restart top-level planning, and return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
                beginWorkerAttempt(task, worker);
                await this.child.sendProviderPrompt(recoverySessionID, prompt, worker.role, next === 'host-default' ? undefined : next, nextVariant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
                appendLedger(m, 'worker.busy-stall-recovery', { task_id: task.id, worker_id: worker.id, payload: { from: fromModel, to: next, from_session: fromSession, to_session: recoverySessionID, prior_attempt: worker.attempt - 1, current_attempt: worker.attempt, host_status: hostStatus, await_timeouts: timeouts.length, observed_wait_ms: total } });
                void this.events?.(runtimeSignal('worker.recovered', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { reason: 'host-liveness-stall', from: fromModel, to: next } }));
                return { disposition: 'RECOVERED', reason: 'host-liveness-stall', worker_id: worker.id, task_id: task.id, from_model: fromModel, to_model: next };
            }
            catch (error) {
                let replacementStopped = true;
                if (worker.session_id)
                    try {
                        replacementStopped = await this.child.abortNativeSession(m, worker.session_id, 'host-liveness-recovery-failed', worker.id, task.id);
                    }
                    catch {
                        replacementStopped = false;
                    }
                ;
                if (replacementStopped) {
                    releaseTaskRuntimeReservation(m, worker.id);
                    worker.forked_from_session_id = priorFork;
                    worker.model = fromModel;
                    worker.model_variant = priorVariant;
                    return { ...blockAfterAbort('replacement-dispatch-failed', String(error)), to_model: next };
                }
                worker.status = 'busy';
                task.status = 'running';
                this.registry.set(worker);
                appendLedger(m, 'worker.busy-stall-recovery.failed', { task_id: task.id, worker_id: worker.id, payload: { from: fromModel, to: next, error: String(error), replacement_stopped: false } });
                return { disposition: 'QUARANTINED', reason: String(error), worker_id: worker.id, task_id: task.id, from_model: fromModel, to_model: next };
            }
        }
        return { disposition: 'NOOP', reason: 'bounded-await-threshold-not-met' };
    }
    async recoverStagnation(m, level, action = 'same-worker-resume') {
        if ((action === 'same-worker-resume' && ![1, 2].includes(level)) || (action === 'model-escalation' && level !== 3) || m.identity.status !== 'active' || m.continuation.user_interrupted)
            return false;
        const worker = [...m.execution.workers].reverse().find(w => Boolean(w.session_id) && !['failed', 'cancelled', 'busy', 'starting', 'queued'].includes(w.status));
        if (!worker?.session_id)
            return false;
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return false;
        try {
            this.workspaceBinding?.(m, task.id);
        }
        catch (error) {
            const marker = `workspace-orphan:${task.id}`;
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
            appendLedger(m, 'worker.recovery.workspace-blocked', { task_id: task.id, worker_id: worker.id, payload: { error: String(error) } });
            return false;
        }
        const model = worker.model, variant = worker.model_variant;
        if (!model)
            return false;
        if (action === 'model-escalation') {
            const hazard = recoveryModelHazard(m);
            if (!hazard.open || hazard.worker_id !== worker.id || hazard.model !== model) {
                appendLedger(m, 'worker.behavioral-model-escalation.rejected', { task_id: task.id, worker_id: worker.id, payload: { reason: hazard.reason, attempts: hazard.attempts } });
                return false;
            }
            const candidates = hazard.recovery_candidates;
            const next = candidates.find(id => runtimeModelCandidateStatus(id, this.getModels(), this.getConfig(), this.getHostConfig(), worker.role).ok);
            if (!next) {
                appendLedger(m, 'worker.behavioral-model-escalation.unavailable', { task_id: task.id, worker_id: worker.id, payload: { from: model, candidates } });
                return false;
            }
            const previousSession = worker.session_id, previousFork = worker.forked_from_session_id, previousStatus = worker.status, previousTaskStatus = task.status, nextVariant = task.execution_profile?.fallback_variants?.[next];
            worker.status = 'ready';
            task.status = 'waiting';
            const reservation = reserveTaskRuntimeDispatch(m, worker, next, this.scheduler, Date.now(), this.getProjectPeerView(m));
            if (!reservation.accepted) {
                worker.status = previousStatus;
                task.status = previousTaskStatus;
                return false;
            }
            try {
                this.child.recordModelProjection(worker, next, nextVariant);
                const child = await this.child.create(m.identity.session_id, `Hi · ${worker.role} · behavioral recovery · ${task.objective.slice(0, 40)}`, worker.role, next === 'host-default' ? undefined : next, nextVariant, this.workspaceBinding?.(m, task.id));
                if (!child?.id)
                    throw new Error('Behavioral recovery child session id missing');
                const recoverySessionID = String(child.id);
                worker.session_id = recoverySessionID;
                worker.forked_from_session_id = previousSession;
                const bound = bindTaskRuntimeHost(m, worker.id, recoverySessionID);
                if (!bound.accepted)
                    throw new Error(`Scheduler host binding failed during behavioral recovery: ${bound.reason}`);
                worker.loaded_methodologies = [];
                worker.model = next;
                worker.model_variant = nextVariant;
                worker.fallback_history = [...(worker.fallback_history ?? []), { from: model, to: next, variant: nextVariant, reason: 'recovery-only model escalation after two same-model corrections without semantic gain', phase: 'runtime', at: Date.now() }];
                worker.status = 'busy';
                worker.generation_at_spawn = m.continuation.generation;
                worker.parent_mission_id = m.identity.mission_id;
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                recordPreexistingUserBaseline(m, await this.child.captureNativeDiff(worker, 'baseline'));
                const exitRequirements = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const prompt = clipText([ownershipContract('child', worker.selected_methodologies), `Hi behavioral recovery for existing task ${task.id}.`, `The prior model ${model} received two bounded corrective attempts without semantic progress.`, `Recovery model: ${next}. This is recovery-only and does not change user routing preferences.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `OBSERVED CHANGED FILES SO FAR: ${m.vcs.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'Fresh context: reload every still-selected methodology through the native skill tool before applying it.' : 'No methodology is selected for this recovery.', 'Independently inspect the minimum current repository/evidence state needed to continue the SAME task. Do not trust or repeat the prior model strategy, do not restart top-level planning, and return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
                beginWorkerAttempt(task, worker);
                await this.child.sendProviderPrompt(recoverySessionID, prompt, worker.role, next === 'host-default' ? undefined : next, nextVariant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
                recordRecoveryStrategy(m, { level: 3, action: 'model-escalation' }, 'started', Date.now(), { task_id: task.id, worker_id: worker.id, model, failure_signature: worker.last_runtime_failure_kind });
                appendLedger(m, 'worker.behavioral-model-escalation', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: model, to: next, from_session: previousSession, to_session: recoverySessionID, generation: m.continuation.generation, reason: 'same-model-bounded-corrections-exhausted' } });
                void this.events?.(runtimeSignal('worker.recovered', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { level, action, from: model, to: next } }));
                return true;
            }
            catch (error) {
                let stopped = true;
                if (worker.session_id && worker.session_id !== previousSession)
                    try {
                        stopped = await this.child.abortNativeSession(m, worker.session_id, 'behavioral-model-escalation-failed', worker.id, task.id);
                    }
                    catch {
                        stopped = false;
                    }
                if (stopped) {
                    releaseTaskRuntimeReservation(m, worker.id);
                    worker.session_id = previousSession;
                    worker.forked_from_session_id = previousFork;
                    worker.model = model;
                    worker.model_variant = variant;
                    worker.status = previousStatus;
                    task.status = previousTaskStatus;
                }
                else {
                    const marker = `behavioral-recovery-abort-unavailable:${task.id}:${worker.id}`;
                    m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                    worker.status = 'busy';
                    task.status = 'running';
                }
                this.registry.set(worker);
                appendLedger(m, 'worker.behavioral-model-escalation.failed', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: model, to: next, error: String(error), host_stopped: stopped } });
                return false;
            }
        }
        const previousWorkerStatus = worker.status, previousTaskStatus = task.status;
        worker.status = 'ready';
        task.status = 'waiting';
        if (taskRuntimeAdmittedModel(m, worker, [model], this.scheduler, this.getProjectPeerView(m)) !== model) {
            worker.status = previousWorkerStatus;
            task.status = previousTaskStatus;
            return false;
        }
        const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler, Date.now(), this.getProjectPeerView(m));
        if (!reservation.accepted) {
            worker.status = previousWorkerStatus;
            task.status = previousTaskStatus;
            return false;
        }
        try {
            const bound = bindTaskRuntimeHost(m, worker.id, worker.session_id);
            if (!bound.accepted) {
                releaseTaskRuntimeReservation(m, worker.id);
                worker.status = previousWorkerStatus;
                task.status = previousTaskStatus;
                return false;
            }
            const previous = worker.model;
            worker.model = model;
            worker.model_variant = variant;
            worker.generation_at_spawn = m.continuation.generation;
            worker.parent_mission_id = m.identity.mission_id;
            worker.status = 'busy';
            task.status = 'running';
            this.registry.set(worker);
            const instruction = level === 1
                ? 'Hi stagnation recovery: continue the SAME task/session with one narrowly scoped corrective attempt. Preserve completed work and evidence. Do not restart planning.'
                : 'Hi stagnation recovery: continue the SAME task/session/model, but use a materially different corrective hypothesis or action from the prior attempt. Preserve completed work and evidence. Do not restart planning or change models.';
            beginWorkerAttempt(task, worker);
            this.child.recordModelProjection(worker, model, variant);
            await this.child.sendProviderPrompt(worker.session_id, clipText(`${instruction}\nReturn the normal structured WorkerResult.`, DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
            recordRecoveryStrategy(m, { level: level, action }, 'started', Date.now(), { task_id: task.id, worker_id: worker.id, model, failure_signature: worker.last_runtime_failure_kind });
            appendLedger(m, 'worker.stagnation-recovery', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant, generation: m.continuation.generation } });
            void this.events?.(runtimeSignal('worker.recovered', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant } }));
            return true;
        }
        catch (error) {
            let stopped = true;
            if (worker.session_id)
                try {
                    stopped = await this.child.abortNativeSession(m, worker.session_id, 'stagnation-recovery-failed', worker.id, task.id);
                }
                catch {
                    stopped = false;
                }
            if (stopped) {
                releaseTaskRuntimeReservation(m, worker.id);
                worker.status = 'ready';
                task.status = task.result?.status === 'DONE' ? 'completed' : task.result ? 'waiting' : 'blocked';
            }
            else {
                const marker = `stagnation-recovery-abort-unavailable:${task.id}:${worker.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                worker.status = 'busy';
                task.status = 'running';
            }
            this.registry.set(worker);
            appendLedger(m, 'worker.stagnation-recovery.failed', { task_id: task.id, worker_id: worker.id, payload: { level, action, error: String(error), host_stopped: stopped } });
            return false;
        }
    }
    async recoverHostTerminalFailure(m, workerID, error) {
        const worker = m.execution.workers.find(w => w.id === workerID);
        if (!worker)
            return 'NOT_RECOVERED';
        const task = m.execution.tasks.find(t => t.id === worker.task_id), failure = classifyWorkerFailure(error);
        worker.last_runtime_failure_kind = failure.kind;
        worker.runtime_fallback_exhausted = false;
        appendLedger(m, 'worker.failure.classified', { task_id: task?.id, worker_id: worker.id, payload: { kind: failure.kind, stagnation: failure.stagnation, retryable: failure.retryable, reason: failure.reason } });
        // OpenCode owns transient provider retry/backoff and context compaction. Hi may only
        // start an alternate-model child after a host-terminal, retryable provider failure.
        // Context/tool failures need explicit capability proof before model switching.
        if (!failure.retryable || failure.kind !== 'provider-transport' || !worker.session_id || !task)
            return 'NOT_RECOVERED';
        const failedSession = worker.session_id, candidates = worker.fallbacks.filter(x => x && x !== worker.model);
        appendLedger(m, 'worker.runtime-fallback.host-terminal-confirmed', { task_id: task.id, worker_id: worker.id, payload: { session_id: failedSession, failure_class: failure.kind, action: 'release-without-abort' } });
        releaseTaskRuntimeReservation(m, worker.id);
        worker.session_id = undefined;
        worker.restart_reconcile_pending = false;
        worker.status = 'ready';
        task.status = 'waiting';
        this.registry.set(worker);
        for (const model of candidates) {
            const runtimeCandidate = runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig(), worker.role);
            if (!runtimeCandidate.ok) {
                appendLedger(m, 'worker.runtime-fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: runtimeCandidate.reason, failure_class: failure.kind, phase: 'runtime-policy-revalidation' } });
                continue;
            }
            const variant = task.execution_profile?.fallback_variants?.[model], previous = worker.model, fallbackReason = task.execution_profile?.fallback_reasons?.find(x => x.model === model)?.reason ?? `runtime fallback after ${failure.kind}`;
            const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler, Date.now(), this.getProjectPeerView(m));
            if (!reservation.accepted) {
                appendLedger(m, 'worker.runtime-fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: reservation.reason, failure_class: failure.kind, source: 'scheduler' } });
                continue;
            }
            try {
                this.child.recordModelProjection(worker, model, variant);
                const child = await this.child.create(m.identity.session_id, `Hi · ${worker.role} · runtime recovery · ${task.objective.slice(0, 45)}`, worker.role, model === 'host-default' ? undefined : model, variant, this.workspaceBinding?.(m, task.id));
                if (!child?.id)
                    throw new Error('Runtime fallback child session id missing');
                const recoverySessionID = String(child.id);
                worker.session_id = recoverySessionID;
                const bound = bindTaskRuntimeHost(m, worker.id, recoverySessionID);
                if (!bound.accepted)
                    throw new Error(`Scheduler host binding failed during runtime fallback: ${bound.reason}`);
                worker.loaded_methodologies = [];
                worker.model = model;
                worker.model_variant = variant;
                worker.fallback_history = [...(worker.fallback_history ?? []), { from: previous, to: model, variant, reason: `${fallbackReason}; failure=${failure.kind}`, phase: 'runtime', at: Date.now() }];
                worker.status = 'busy';
                worker.runtime_recovery_pending = true;
                worker.runtime_recovery_attempt = (worker.runtime_recovery_attempt ?? 0) + 1;
                worker.generation_at_spawn = m.continuation.generation;
                worker.parent_mission_id = m.identity.mission_id;
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                recordPreexistingUserBaseline(m, await this.child.captureNativeDiff(worker, 'baseline'));
                const exitRequirements = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const prompt = clipText([ownershipContract('child', worker.selected_methodologies), `Hi terminal runtime recovery for existing task ${task.id}.`, `Failure class: ${failure.kind}.`, `Previous failed session: ${failedSession}.`, `Fallback model: ${model}.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `OBSERVED CHANGED FILES SO FAR: ${m.vcs.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'This is a fresh child session. Reload every still-selected methodology through the native skill tool before applying it.' : 'No methodology is selected for this recovery.', 'Preserve already-observed repository changes and bounded evidence, but do not assume the failed session context is present. Inspect only the minimum current state needed to continue the SAME task. Do not restart top-level planning. Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
                beginWorkerAttempt(task, worker);
                await this.child.sendProviderPrompt(recoverySessionID, prompt, worker.role, model === 'host-default' ? undefined : model, variant, taskPromptToolOverrides(task.execution_profile?.tools ?? [], this.getHostConfig(), task.execution_profile?.mcp_servers ?? []), worker.attempt_prompt_message_id);
                appendLedger(m, 'worker.runtime-fallback', { task_id: task.id, worker_id: worker.id, payload: { from: previous, to: model, variant, reason: fallbackReason, failure_class: failure.kind, attempt: worker.runtime_recovery_attempt, from_session: failedSession, to_session: worker.session_id, session_mode: 'fresh' } });
                return 'RECOVERED';
            }
            catch (nextError) {
                worker.runtime_recovery_pending = false;
                let recoveryStopped = true;
                if (worker.session_id)
                    try {
                        recoveryStopped = await this.child.abortNativeSession(m, worker.session_id, 'runtime-fallback-failed', worker.id, task.id);
                    }
                    catch {
                        recoveryStopped = false;
                    }
                if (recoveryStopped) {
                    releaseTaskRuntimeReservation(m, worker.id);
                    worker.session_id = undefined;
                    worker.status = 'ready';
                    task.status = 'waiting';
                    this.registry.set(worker);
                }
                else {
                    const marker = `runtime-fallback-recovery-abort-unavailable:${task.id}:${worker.id}`;
                    m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                    worker.status = 'busy';
                    task.status = 'running';
                    this.registry.set(worker);
                }
                appendLedger(m, 'worker.runtime-fallback.failed', { task_id: task.id, worker_id: worker.id, payload: { model, error: String(nextError), failure_class: failure.kind, from_session: failedSession, host_stopped: recoveryStopped } });
                if (!recoveryStopped)
                    return 'QUARANTINED';
            }
        }
        worker.runtime_fallback_exhausted = true;
        m.continuation.stagnation_count = 0;
        const blocker = `provider-failure:${failure.kind}:${worker.model ?? 'unknown'}`;
        m.execution.blockers = [...new Set([...m.execution.blockers, blocker])];
        task.status = 'blocked';
        task.updated_at = Date.now();
        task.result = { status: 'BLOCKED', summary: 'Runtime provider/model fallback chain exhausted.', changed_files: [], evidence: [], open_issues: [blocker], needs_context: ['provider/model availability or alternate execution path'] };
        appendLedger(m, 'worker.runtime-fallback.exhausted', { task_id: task.id, worker_id: worker.id, payload: { failure_class: failure.kind, attempted: [worker.model, ...candidates].filter(Boolean) } });
        return 'NOT_RECOVERED';
    }
    fail(m, workerID, error) {
        const worker = m.execution.workers.find(w => w.id === workerID);
        if (!worker)
            return;
        if (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.continuation.generation) {
            appendLedger(m, 'worker.failure.stale-generation-ignored', { worker_id: worker.id });
            return;
        }
        const settlement = beginTaskRuntimeSettlement(m, worker);
        if (!settlement.accepted && settlement.reason !== 'reservation-not-found') {
            appendLedger(m, 'worker.failure.scheduler-fence-rejected', { worker_id: worker.id, payload: { reason: settlement.reason } });
            return;
        }
        const task = m.execution.tasks.find(t => t.id === worker.task_id), failureClass = worker.last_runtime_failure_kind, permissionFailure = failureClass === 'permission', providerFailure = failureClass === 'provider-transport', contextFailure = failureClass === 'context-overflow', toolFailure = failureClass === 'tool-incompatibility', model = worker.model ?? 'unknown';
        const marker = permissionFailure ? `permission-failure:${worker.id}` : providerFailure ? `provider-failure:provider-transport:${model}` : contextFailure ? `capability-unavailable:context-capacity:${model}` : toolFailure ? `capability-unavailable:tool-compatibility:${model}` : error;
        const needsContext = permissionFailure ? ['resolve OpenCode permission/authority and explicitly resume the mission'] : providerFailure ? ['provider/model availability or alternate execution path'] : contextFailure ? ['OpenCode context compaction was exhausted or could not resolve terminal context capacity; reduce bounded context/task scope or explicitly choose a model with known sufficient context capacity'] : toolFailure ? ['terminal tool/model compatibility failure was observed; repair tool availability or explicitly choose a model with proven required tool capability'] : [];
        worker.status = 'failed';
        worker.completed_at = Date.now();
        releaseTaskRuntimeReservation(m, worker.id);
        this.registry.delete(worker.id);
        if (permissionFailure || providerFailure || contextFailure || toolFailure)
            m.continuation.stagnation_count = 0;
        if (task) {
            task.status = 'failed';
            task.updated_at = Date.now();
            task.result = { status: 'FAILED', summary: error, changed_files: [], evidence: [], open_issues: [marker], needs_context: needsContext };
            releaseFailedTaskMethodologyNeeds(m, task.id);
        }
        m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
        appendLedger(m, 'worker.failed', { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: failureClass ?? 'unknown', blocker: marker } });
        void this.events?.(runtimeSignal('worker.failed', m.identity.mission_id, { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: failureClass ?? 'unknown' } }));
        syncMissionGates(m);
        this.drainQueueCallback();
    }
}
