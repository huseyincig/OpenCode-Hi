import { resolveModel, runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { classifyWorkerFailure } from '../worker/failure-classifier.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { ownershipContract } from '../skills/methodology.js';
import { DEFAULT_CONTEXT_BUDGET, clipText } from '../context/budget.js';
import { promptToolOverrides } from '../routing/execution-profile.js';
import { beginWorkerAttempt } from '../worker/worker-runtime.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { appendLedger } from '../ledger/ledger.js';
import { runtimeSignal } from '../events/event-sink.js';
import { syncMissionGates } from '../gates/gates.js';
function providerOf(model) { return model && model !== 'host-default' && model.includes('/') ? model.slice(0, model.indexOf('/')) : undefined; }
function missionModelFeedback(m) {
    const failures = {}, successes = {}, retries = {};
    const inc = (r, id, n = 1) => { if (id)
        r[id] = (r[id] ?? 0) + n; };
    for (const w of m.execution.workers) {
        const observed = w.effective_model ?? w.model;
        if (w.status === 'completed')
            inc(successes, observed);
        if (w.status === 'failed')
            inc(failures, observed);
        if (w.last_runtime_failure_kind && w.model)
            inc(failures, w.model);
        for (const h of w.fallback_history ?? []) {
            inc(retries, h.from);
            if (/failure=|provider|transport|tool|context/i.test(h.reason))
                inc(failures, h.from);
        }
    }
    return { failures, successes, retries };
}
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
    callbackDisposition(m, worker) { if (worker.restart_reconcile_pending)
        return 'restart-reconcile-pending'; if ((worker.parent_mission_id !== undefined && worker.parent_mission_id !== m.identity.mission_id) || (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.continuation.generation))
        return 'stale-mission'; return 'accept'; }
    constructor(scheduler, registry, projectRoot, getConfig, getModels, getHostConfig, events, child, drainQueueCallback) {
        this.scheduler = scheduler;
        this.registry = registry;
        this.projectRoot = projectRoot;
        this.getConfig = getConfig;
        this.getModels = getModels;
        this.getHostConfig = getHostConfig;
        this.events = events;
        this.child = child;
        this.drainQueueCallback = drainQueueCallback;
    }
    async recoverStagnation(m, level) {
        if (![1, 2].includes(level) || m.identity.status !== 'active' || m.continuation.user_interrupted)
            return false;
        const worker = [...m.execution.workers].reverse().find(w => Boolean(w.session_id) && !['failed', 'cancelled', 'busy', 'starting', 'queued'].includes(w.status));
        if (!worker?.session_id)
            return false;
        const task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return false;
        let model = worker.model, variant = worker.model_variant, action = 'same-worker-resume';
        if (level === 2) {
            const stronger = { quick: 'standard', standard: 'deep', visual: 'deep', deep: 'critical', critical: 'critical' };
            const target = stronger[worker.category];
            const selected = resolveModel(target, this.getModels(), this.getConfig(), undefined, worker.role, this.getHostConfig(), missionModelFeedback(m));
            const next = [selected.primary, ...selected.fallbacks].find(x => Boolean(x) && x !== worker.model);
            if (!next)
                return false;
            model = next;
            variant = next === selected.primary ? selected.primaryVariant : selected.fallbackVariants[next];
            action = 'model-escalation';
        }
        const capacity = this.scheduler.canStart(worker.id, providerOf(model), model === 'host-default' ? undefined : model);
        if (!capacity.ok)
            return false;
        try {
            this.scheduler.acquire(worker.id, providerOf(model), model === 'host-default' ? undefined : model);
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
                : `Hi stagnation recovery: continue the SAME task/session with policy escalation from ${previous ?? 'default'} to ${model ?? 'default'}. Preserve completed work and evidence. Do not restart planning.`;
            beginWorkerAttempt(task, worker);
            this.child.recordModelProjection(worker, model, variant);
            await this.child.sendProviderPrompt(worker.session_id, clipText(`${instruction}\nReturn the normal structured WorkerResult.`, DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, variant, promptToolOverrides(task.execution_profile?.tools ?? []));
            appendLedger(m, 'worker.stagnation-recovery', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant, generation: m.continuation.generation } });
            void this.events?.(runtimeSignal('worker.recovered', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant } }));
            return true;
        }
        catch (error) {
            this.scheduler.release(worker.id);
            worker.status = 'ready';
            task.status = task.result?.status === 'DONE' ? 'completed' : task.result ? 'waiting' : 'blocked';
            this.registry.set(worker);
            appendLedger(m, 'worker.stagnation-recovery.failed', { task_id: task.id, worker_id: worker.id, payload: { level, action, error: String(error) } });
            return false;
        }
    }
    async recoverRuntimeFailure(m, workerID, error) {
        const worker = m.execution.workers.find(w => w.id === workerID);
        if (!worker)
            return false;
        const task = m.execution.tasks.find(t => t.id === worker.task_id), failure = classifyWorkerFailure(error);
        worker.last_runtime_failure_kind = failure.kind;
        worker.runtime_fallback_exhausted = false;
        appendLedger(m, 'worker.failure.classified', { task_id: task?.id, worker_id: worker.id, payload: { kind: failure.kind, stagnation: failure.stagnation, retryable: failure.retryable, reason: failure.reason } });
        if (!failure.retryable || !['provider-transport', 'tool-incompatibility', 'context-overflow'].includes(failure.kind) || !worker.session_id || !task)
            return false;
        this.scheduler.release(worker.id);
        const failedSession = worker.session_id, candidates = worker.fallbacks.filter(x => x && x !== worker.model);
        for (const model of candidates) {
            const runtimeCandidate = runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig());
            if (!runtimeCandidate.ok) {
                appendLedger(m, 'worker.runtime-fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: runtimeCandidate.reason, failure_class: failure.kind, phase: 'runtime-policy-revalidation' } });
                continue;
            }
            const provider = providerOf(model), capacity = this.scheduler.canStart(worker.id, provider, model === 'host-default' ? undefined : model);
            if (!capacity.ok) {
                appendLedger(m, 'worker.runtime-fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: capacity.reason, failure_class: failure.kind } });
                continue;
            }
            try {
                this.scheduler.acquire(worker.id, provider, model === 'host-default' ? undefined : model);
                const variant = task.execution_profile?.fallback_variants?.[model], previous = worker.model, fallbackReason = task.execution_profile?.fallback_reasons?.find(x => x.model === model)?.reason ?? `runtime fallback after ${failure.kind}`;
                let stopped = false;
                try {
                    stopped = await this.child.abortNativeSession(m, failedSession, 'terminal-runtime-fallback', worker.id, task.id);
                }
                catch { }
                ;
                if (!stopped) {
                    const marker = `runtime-fallback-abort-unavailable:${task.id}:${worker.id}`;
                    m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                    worker.runtime_fallback_exhausted = true;
                    appendLedger(m, 'worker.runtime-fallback.abort-blocked', { task_id: task.id, worker_id: worker.id, payload: { session_id: failedSession, failure_class: failure.kind, marker } });
                    return false;
                }
                this.child.recordModelProjection(worker, model, variant);
                const child = await this.child.create(m.identity.session_id, `Hi · ${worker.role} · runtime recovery · ${task.objective.slice(0, 45)}`, worker.role, model === 'host-default' ? undefined : model, variant);
                if (!child?.id)
                    throw new Error('Runtime fallback child session id missing');
                const recoverySessionID = String(child.id);
                worker.session_id = recoverySessionID;
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
                await this.child.sendProviderPrompt(recoverySessionID, prompt, worker.role, model === 'host-default' ? undefined : model, variant, promptToolOverrides(task.execution_profile?.tools ?? []));
                appendLedger(m, 'worker.runtime-fallback', { task_id: task.id, worker_id: worker.id, payload: { from: previous, to: model, variant, reason: fallbackReason, failure_class: failure.kind, attempt: worker.runtime_recovery_attempt, from_session: failedSession, to_session: worker.session_id, session_mode: 'fresh' } });
                return true;
            }
            catch (nextError) {
                worker.runtime_recovery_pending = false;
                this.scheduler.release(worker.id);
                appendLedger(m, 'worker.runtime-fallback.failed', { task_id: task.id, worker_id: worker.id, payload: { model, error: String(nextError), failure_class: failure.kind, from_session: failedSession } });
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
        return false;
    }
    fail(m, workerID, error) { const worker = m.execution.workers.find(w => w.id === workerID); if (!worker)
        return; if (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.continuation.generation) {
        appendLedger(m, 'worker.failure.stale-generation-ignored', { worker_id: worker.id });
        return;
    } const task = m.execution.tasks.find(t => t.id === worker.task_id), permissionFailure = worker.last_runtime_failure_kind === 'permission', marker = permissionFailure ? `permission-failure:${worker.id}` : error; worker.status = 'failed'; worker.completed_at = Date.now(); this.scheduler.release(worker.id); this.registry.delete(worker.id); if (permissionFailure)
        m.continuation.stagnation_count = 0; if (task) {
        task.status = 'failed';
        task.updated_at = Date.now();
        task.result = { status: 'FAILED', summary: error, changed_files: [], evidence: [], open_issues: [marker], needs_context: permissionFailure ? ['resolve OpenCode permission/authority and explicitly resume the mission'] : [] };
    } m.execution.blockers = [...new Set([...m.execution.blockers, marker])]; appendLedger(m, 'worker.failed', { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: worker.last_runtime_failure_kind ?? 'unknown', blocker: marker } }); void this.events?.(runtimeSignal('worker.failed', m.identity.mission_id, { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: worker.last_runtime_failure_kind ?? 'unknown' } })); syncMissionGates(m); this.drainQueueCallback(); }
}
