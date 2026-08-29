import { createHash } from 'node:crypto';
import { authorityClassForPatterns } from '../safety/project-authority.js';
import { appendLedger } from '../ledger/ledger.js';
import { addEvidence, markMutation, normalizeProjectPath } from '../evidence/evidence-runtime.js';
import { evidenceProducerAttemptForWorker } from '../evidence/applicability.js';
import { automaticContinuationEnabled, adaptiveIdleEvaluatorEnabled } from '../../config/execution-policy.js';
import { dispatchContinuation } from '../continuation/dispatcher.js';
import { classifyRuntimeHumanDecision, openHumanDecision } from '../human-decision/runtime.js';
import { runtimeSignal } from '../events/event-sink.js';
import { evaluateIdle, shouldCountStagnation } from '../continuation/evaluator.js';
import { evaluateCompletion } from '../completion/evaluator.js';
import { assessMissionLiveness } from '../liveness/assessment.js';
function resetCompactionSensitiveRecovery(m, sessionID, workerID) {
    const priorStagnation = m.continuation.stagnation_count, recoveryHistoryPreserved = m.continuation.recovery_history?.length ?? 0, stagnationNudgeCleared = Boolean(m.continuation.pending_nudge?.reason.startsWith('stagnation-level-'));
    m.continuation.stagnation_count = 0;
    if (stagnationNudgeCleared)
        m.continuation.pending_nudge = undefined;
    appendLedger(m, 'session.compacted', { worker_id: workerID, payload: { source: 'native-event', session_id: sessionID, stagnation_reset_from: priorStagnation, recovery_history_preserved: recoveryHistoryPreserved, stagnation_nudge_cleared: stagnationNudgeCleared, semantic_progress_preserved: true } });
}
function nativePermissionKey(sessionID, permissionID) { return `${sessionID}\0${permissionID}`; }
export class RuntimeEventController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    clearNativePermissionsForSession(sessionID) { const prefix = `${sessionID}\0`; let cleared = 0; for (const key of this.deps.pendingNativePermissions.keys())
        if (key.startsWith(prefix)) {
            this.deps.pendingNativePermissions.delete(key);
            cleared++;
        } return cleared; }
    clearNativePermissionsForMission(m) { let cleared = this.clearNativePermissionsForSession(m.identity.session_id); for (const worker of m.execution.workers)
        if (worker.session_id)
            cleared += this.clearNativePermissionsForSession(worker.session_id); return cleared; }
    clearAllNativePermissions() { this.deps.pendingNativePermissions.clear(); }
    async handle(ev) {
        const { state, host, services, projectAuthority, pendingNativePermissions, projectRoot } = this.deps;
        const { store, persistence, tasks, processRuntime, workspaceRuntime, eventSink, scopedStores } = services;
        const refreshRuntimeInventory = async (reason) => { await host.refreshRuntimeInventory(reason); await host.log('debug', 'Hi refreshed OpenCode-owned runtime model inventory', { reason, models: host.getModels().length, persisted_inferred_role_models: false }); };
        const settleCanonicalParentWake = async (m, source) => { const decision = evaluateIdle(m, Date.now(), projectRoot); appendLedger(m, 'runtime.decision', { payload: { decision: decision.decision, reason: decision.reason, reason_code: decision.reason_code, source, stagnation_count: m.continuation.stagnation_count } }); if (decision.decision === 'STOP') {
            const completion = evaluateCompletion(m, projectRoot);
            if (completion.complete)
                store.complete(m.identity.session_id);
            return;
        } if (decision.decision === 'USER_ACTION_REQUIRED') {
            if (m.authority.human_decision?.status !== 'OPEN') {
                const human = classifyRuntimeHumanDecision(decision.reason_code);
                openHumanDecision(m, { ...human, reason_code: decision.reason_code, summary: decision.reason });
            }
            return;
        } if (decision.decision === 'RECOVER' && decision.reason_code === 'stagnation-recovery') {
            const match = /^stagnation-level-(\d+):(same-worker-resume|model-escalation|narrow-task|alternate-plan|fresh-worker)$/.exec(decision.reason), level = match ? Number(match[1]) : 0, action = match?.[2];
            if (level && (action === 'same-worker-resume' || action === 'model-escalation') && await tasks.recoverStagnation(m, level, action)) {
                store.updateProgress(m);
                return;
            }
        } if (decision.prompt && ['CONTINUE', 'RECONCILE', 'VERIFY', 'RECOVER'].includes(decision.decision))
            await dispatchContinuation(host, m, decision.prompt, decision.reason); };
        if (ev.kind === 'installation-updated') {
            await refreshRuntimeInventory('installation-updated');
            return;
        }
        if (ev.rawType === 'server.connected') {
            await refreshRuntimeInventory('server-connected');
            let reconciled = 0;
            for (const restored of store.all())
                reconciled += await tasks.reconcileRestoredChildren(restored);
            if (reconciled) {
                for (const restored of store.all())
                    store.updateProgress(restored);
                persistence.save(store.all());
            }
            return;
        }
        const sid = ev.sessionID;
        if (!sid)
            return;
        const nativePermissionID = ev.permission?.id;
        const child = tasks.resolveChildCallback(sid);
        const childMission = child ? store.get(child.parent_session_id) : undefined;
        const mission = childMission ?? store.get(sid);
        if (mission && child?.status === 'cancelled') {
            this.clearNativePermissionsForSession(sid);
            const callback_index_cleared = ev.kind === 'session-deleted' ? tasks.forgetChildCallback(sid) : false;
            appendLedger(mission, 'worker.callback.after-cancel-ignored', { worker_id: child.id, payload: { session_id: sid, event: ev.rawType, callback_index_cleared } });
            persistence.save(store.all());
            return;
        }
        if (child && mission && tasks.childCallbackDisposition(mission, child) === 'stale-mission') {
            this.clearNativePermissionsForSession(sid);
            const callback_index_cleared = ev.kind === 'session-deleted' ? tasks.forgetChildCallback(sid) : false;
            appendLedger(mission, 'worker.callback.stale-mission-ignored', { worker_id: child?.id, payload: { worker_mission_id: child?.parent_mission_id, mission_id: mission.identity.mission_id, worker_generation: child?.generation_at_spawn, mission_generation: mission.continuation.generation, event: ev.rawType, callback_index_cleared } });
            persistence.save(store.all());
            return;
        }
        if (mission && (mission.continuation.user_interrupted || mission.identity.status === 'stopped')) {
            this.clearNativePermissionsForMission(mission);
            const callback_index_cleared = Boolean(child && ev.kind === 'session-deleted' && tasks.forgetChildCallback(sid));
            appendLedger(mission, callback_index_cleared ? 'worker.callback.after-stop-deleted' : 'runtime.event.after-user-stop-ignored', { worker_id: child?.id, payload: { session_id: sid, event: ev.rawType, callback_index_cleared } });
            persistence.save(store.all());
            return;
        }
        // Terminal missions are immutable with respect to late host progress/callback events. OpenCode may
        // publish session.diff/file/idle/status callbacks after the tool that canonically completed the mission.
        // A new user message starts a fresh mission for this session, so late callbacks must not retroactively
        // reopen obligations or mutate finalized evidence. session-deleted remains lifecycle cleanup below.
        if (mission?.identity.status === 'completed' && ev.kind !== 'session-deleted') {
            this.clearNativePermissionsForMission(mission);
            return;
        }
        if (ev.kind === 'permission-asked' && nativePermissionID && mission)
            pendingNativePermissions.set(nativePermissionKey(sid, nativePermissionID), ev.permission?.patterns ?? []);
        let repliedPermissionPatterns = [];
        if (ev.kind === 'permission-replied' && nativePermissionID && mission) {
            const key = nativePermissionKey(sid, nativePermissionID), patterns = [...new Set([...(pendingNativePermissions.get(key) ?? []), ...(ev.permission?.patterns ?? [])])];
            repliedPermissionPatterns = patterns;
            if (ev.permission?.reply === 'always') {
                const cls = authorityClassForPatterns(patterns);
                if (cls) {
                    projectAuthority.grant(cls);
                    await host.log('info', 'Hi project authority persisted from native always approval', { authority_class: cls, patterns });
                }
            }
            pendingNativePermissions.delete(key);
        }
        if (ev.kind === 'permission-asked' && mission) {
            const pid = ev.permission?.id;
            mission.authority.pending_permission_ids ??= [];
            const alreadyReplied = Boolean(pid && mission.execution.ledger.some(e => e.type === 'permission.replied' && e.payload?.permission_id === pid || e.type === 'permission.duplicate-ignored' && e.payload?.permission_id === pid && e.payload?.event === 'replied'));
            if (alreadyReplied) {
                if (pid)
                    pendingNativePermissions.delete(nativePermissionKey(sid, pid));
                appendLedger(mission, 'permission.stale-ask-ignored', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid, reason: 'reply-observed-first' } });
            }
            else if (!pid || !mission.authority.pending_permission_ids.includes(pid)) {
                if (pid)
                    mission.authority.pending_permission_ids.push(pid);
                mission.authority.pending_permissions = (mission.authority.pending_permissions ?? 0) + 1;
                appendLedger(mission, 'permission.asked', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid } });
            }
            else
                appendLedger(mission, 'permission.duplicate-ignored', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid, event: 'asked' } });
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'permission-replied' && mission) {
            const pid = ev.permission?.id;
            mission.authority.pending_permission_ids ??= [];
            const idx = pid ? mission.authority.pending_permission_ids.indexOf(pid) : -1, priorReply = Boolean(pid && mission.execution.ledger.some(e => e.type === 'permission.replied' && e.payload?.permission_id === pid));
            if (child && pid && ev.permission?.decision === 'deny' && !priorReply && !child.pending_native_permission_denial) {
                child.pending_native_permission_denial = { permission_id: pid, session_id: sid, patterns: repliedPermissionPatterns.slice(0, 32).map(x => x.slice(0, 1000)), attempt: child.attempt, generation: child.generation_at_spawn ?? mission.continuation.generation, observed_at: Date.now() };
                appendLedger(mission, 'worker.permission-denial.recorded', { task_id: child.task_id, worker_id: child.id, payload: { permission_id: pid, session_id: sid, attempt: child.attempt, generation: child.generation_at_spawn, patterns: repliedPermissionPatterns.slice(0, 12), policy: 'native-deny-may-stop-opencode-generation' } });
            }
            if (pid && idx < 0) {
                appendLedger(mission, 'permission.duplicate-ignored', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid, event: 'replied' } });
            }
            else {
                if (idx >= 0)
                    mission.authority.pending_permission_ids.splice(idx, 1);
                mission.authority.pending_permissions = Math.max(0, (mission.authority.pending_permissions ?? 0) - 1);
                appendLedger(mission, 'permission.replied', { worker_id: child?.id, payload: { session_id: sid, permission_id: pid, decision: ev.permission?.decision ?? 'unknown' } });
            }
            persistence.save(store.all());
            return;
        }
        if (child) {
            const m = childMission;
            if (!m)
                return;
            const afterChildWake = async (result, source, detail, failureKind) => { appendLedger(m, 'parent.wake', { worker_id: child.id, payload: { result, event: ev.rawType } }); if (result === 'RUNTIME_FALLBACK')
                return; const siblingPending = tasks.pendingExecutionWorkers(m, child.id); if (failureKind === 'permission') {
                m.continuation.stagnation_count = 0;
                openHumanDecision(m, { semantic_type: 'operational_action', reason_code: 'permission-failure', summary: `Native child permission failure requires user/runtime intervention before retry. ${(detail ?? '').slice(0, 240)}`, task_id: child.task_id, worker_id: child.id, response_schema: { kind: 'external-action' } });
            }
            else if (automaticContinuationEnabled(state.config.executionPolicy) && !m.continuation.user_interrupted && !siblingPending.length)
                await settleCanonicalParentWake(m, source);
            else if (siblingPending.length)
                appendLedger(m, 'parent.wake.deferred', { worker_id: child.id, payload: { reason: 'sibling-workers-pending', pending: siblingPending.map(w => w.id).slice(0, 20) } }); };
            if (ev.kind === 'file-edited' || ev.kind === 'file-watcher-updated' || ev.kind === 'session-diff') {
                const files = ev.filePaths;
                const stateHash = ev.kind === 'session-diff' ? createHash('sha256').update(JSON.stringify(ev.properties ?? {})).digest('hex') : undefined;
                if (files.length)
                    await tasks.noteNativeWriteSet(m, child.id, files, ev.rawType, stateHash);
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'assistant-message-updated') {
                if (ev.assistant?.structured !== undefined && typeof tasks.recordHostAssistantResultEvent === 'function')
                    tasks.recordHostAssistantResultEvent(m, child, ev.assistant);
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'session-status') {
                const nativeStatus = ev.status;
                tasks.noteNativeStatus(m, child.id, nativeStatus);
                if (child.runtime_recovery_pending && !/idle|completed|stopped/i.test(nativeStatus)) {
                    child.runtime_recovery_pending = false;
                    appendLedger(m, 'worker.runtime-fallback.active', { task_id: child.task_id, worker_id: child.id, payload: { status: nativeStatus, attempt: child.runtime_recovery_attempt ?? 0 } });
                }
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'lsp-diagnostics') {
                const diagnostics = Array.isArray(ev.properties?.diagnostics) ? ev.properties.diagnostics : [];
                const errors = diagnostics.filter((d) => ['error', 1].includes(d?.severity)).length;
                addEvidence(m, { kind: 'lsp-diagnostics', summary: `native LSP diagnostics: ${errors} error(s), ${diagnostics.length} total`, scope: child.write_set ?? [], source: `session:${sid}:lsp`, source_session_id: sid, source_state_hash: child.native_state_hash, task_id: child.task_id, obligation_ids: m.execution.tasks.find(t => t.id === child.task_id)?.obligation_ids ?? [], producer_attempt: evidenceProducerAttemptForWorker(m, child), pass: errors === 0, outcome: errors === 0 ? 'passed' : 'failed', reason: errors ? `${errors} error diagnostic(s)` : undefined });
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'session-compacted') {
                resetCompactionSensitiveRecovery(m, sid, child.id);
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'session-error') {
                const rawError = ev.properties?.error, hostError = ev.error ?? { ...(typeof rawError?.name === 'string' ? { name: rawError.name } : {}), message: String(rawError?.message ?? rawError?.data?.message ?? rawError?.name ?? ev.rawType) }, detail = hostError.message;
                const admission = await tasks.admitTerminalEvent(m, child);
                if (admission.decision !== 'ACCEPT') {
                    const type = admission.decision === 'WAIT' ? 'worker.error-deferred-host-active' : admission.decision === 'STALE' ? 'worker.error-stale-binding' : 'worker.error-unverified-host-status';
                    appendLedger(m, type, { task_id: child.task_id, worker_id: child.id, payload: { session_id: sid, event: ev.rawType, decision: admission.decision, reason: admission.reason, host_status: admission.hostStatus, attempt_id: admission.binding?.attempt.attemptId, generation: admission.binding?.generation, error: detail.slice(0, 500) } });
                    persistence.save(store.all());
                    return;
                }
                const settled = await tasks.settleHostIdleRuntimeError(m, child, hostError);
                if (!settled.applied) {
                    appendLedger(m, 'worker.error-settlement-deferred', { task_id: child.task_id, worker_id: child.id, payload: { session_id: sid, reason: settled.reason } });
                    persistence.save(store.all());
                    return;
                }
                store.updateProgress(m);
                await afterChildWake(settled.wakeResult ?? 'FAILED', 'child-error', detail, settled.failureKind);
                persistence.save(store.all());
                return;
            }
            if (ev.kind === 'session-deleted') {
                this.clearNativePermissionsForSession(sid);
                const detail = String(ev.properties?.error?.message ?? ev.properties?.error?.data?.message ?? ev.rawType);
                await tasks.cleanupBrowserForTask(m, child.task_id, child.id);
                tasks.fail(m, child.id, detail);
                await tasks.cleanupWorkspaceForTask(m, child.task_id);
                store.updateProgress(m);
                await afterChildWake('FAILED', 'child-deleted', detail, child.last_runtime_failure_kind);
                persistence.save(store.all());
                return;
            }
            if (ev.kind !== 'session-idle')
                return;
            const terminalAdmission = await tasks.admitTerminalEvent(m, child);
            if (terminalAdmission.decision !== 'ACCEPT') {
                const type = terminalAdmission.decision === 'WAIT' ? 'worker.terminal-event-deferred-host-active' : terminalAdmission.decision === 'STALE' ? 'worker.terminal-event-stale-binding' : 'worker.terminal-event-unverified-host-status';
                appendLedger(m, type, { task_id: child.task_id, worker_id: child.id, payload: { session_id: sid, event: ev.rawType, decision: terminalAdmission.decision, reason: terminalAdmission.reason, host_status: terminalAdmission.hostStatus, attempt_id: terminalAdmission.binding?.attempt.attemptId, generation: terminalAdmission.binding?.generation } });
                persistence.save(store.all());
                return;
            }
            if (child.status === 'completed' || child.status === 'failed' || child.status === 'cancelled')
                return;
            try {
                if (child.pending_native_permission_denial) {
                    const denied = await tasks.settleHostIdlePermissionDenial(m, child);
                    if (denied.applied) {
                        store.updateProgress(m);
                        await afterChildWake(denied.result?.status ?? 'NEEDS_CONTEXT', 'child-permission-denied');
                        persistence.save(store.all());
                        return;
                    }
                }
                if (child.pending_host_assistant_result && typeof tasks.settlePendingHostAssistantResult === 'function') {
                    const pending = await tasks.settlePendingHostAssistantResult(m, child);
                    if (pending.applied) {
                        store.updateProgress(m);
                        const wakeResult = pending.wakeResult ?? pending.result?.status ?? 'UNKNOWN';
                        await afterChildWake(wakeResult, 'child-result-event-cache', undefined, pending.failureKind);
                        persistence.save(store.all());
                        return;
                    }
                }
                let assistant;
                try {
                    assistant = await host.readAssistantResult(sid);
                }
                catch (readError) {
                    appendLedger(m, 'worker.idle.assistant-read-deferred', { task_id: child.task_id, worker_id: child.id, payload: { session_id: sid, error: String(readError).slice(0, 500), policy: 'await-message-updated-or-later-readback' } });
                    persistence.save(store.all());
                    return;
                }
                const settled = await tasks.settleHostIdleAssistantResult(m, child, assistant);
                if (!settled.applied) {
                    appendLedger(m, 'worker.idle.pre-assistant-ignored', { task_id: child.task_id, worker_id: child.id, payload: { session_id: sid, reason: settled.reason } });
                    persistence.save(store.all());
                    return;
                }
                store.updateProgress(m);
                const wakeResult = settled.wakeResult ?? settled.result?.status ?? 'UNKNOWN';
                await afterChildWake(wakeResult, 'child-result-ready', assistant.error?.message, settled.failureKind);
            }
            catch (e) {
                await tasks.cleanupBrowserForTask(m, child.task_id, child.id);
                tasks.fail(m, child.id, String(e));
                await tasks.cleanupWorkspaceForTask(m, child.task_id);
                store.updateProgress(m);
                appendLedger(m, 'worker.result.failed', { worker_id: child.id, payload: { error: String(e) } });
                await afterChildWake('FAILED', 'child-result-failed', String(e), child.last_runtime_failure_kind);
            }
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'session-deleted') {
            const parent = store.get(sid);
            if (parent) {
                this.clearNativePermissionsForMission(parent);
                store.stop(sid, 'parent-session-deleted');
                await processRuntime.stopMission(parent);
                await tasks.cancelAll(parent);
                if (workspaceRuntime)
                    await workspaceRuntime.cleanupMission(parent);
                persistence.save(store.all());
            }
            else
                this.clearNativePermissionsForSession(sid);
            return;
        }
        if (ev.kind === 'todo-updated') {
            const m = store.get(sid);
            if (m) {
                const todos = ev.properties?.todos ?? ev.properties?.items ?? [];
                if (Array.isArray(todos))
                    m.execution.native_todos_incomplete = todos.filter((t) => !['completed', 'cancelled', 'done'].includes(String(t?.status ?? '').toLowerCase())).length;
                store.updateProgress(m);
                persistence.save(store.all());
            }
            return;
        }
        if ((ev.kind === 'file-edited' || ev.kind === 'file-watcher-updated' || ev.kind === 'session-diff') && mission) {
            const files = ev.filePaths.map(file => normalizeProjectPath(file, projectRoot)).filter(Boolean);
            if (files.length) {
                markMutation(mission, files, ev.rawType);
                scopedStores.contextArtifacts.invalidateChanged(files);
                void files;
            }
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'lsp-diagnostics' && mission) {
            const diagnostics = Array.isArray(ev.properties?.diagnostics) ? ev.properties.diagnostics : [];
            const errors = diagnostics.filter((d) => ['error', 1].includes(d?.severity)).length;
            addEvidence(mission, { kind: 'lsp-diagnostics', summary: `native LSP diagnostics: ${errors} error(s), ${diagnostics.length} total`, scope: mission.vcs.changed_files, source: `session:${sid}:lsp`, source_session_id: sid, obligation_ids: mission.execution.obligations.filter(o => o.kind === 'verification' && o.status === 'open').map(o => o.id), pass: errors === 0, outcome: errors === 0 ? 'passed' : 'failed', reason: errors ? `${errors} error diagnostic(s)` : undefined });
            persistence.save(store.all());
            return;
        }
        if (ev.kind === 'session-compacted' && mission) {
            resetCompactionSensitiveRecovery(mission, sid);
            persistence.save(store.all());
            return;
        }
        if (ev.kind !== 'session-idle')
            return;
        const m = store.get(sid);
        if (!m || !adaptiveIdleEvaluatorEnabled(state.config.executionPolicy))
            return;
        const progressed = store.updateProgress(m, false);
        void eventSink(runtimeSignal('mission.idle', m.identity.mission_id));
        const processLiveness = typeof processRuntime.livenessObservations === 'function' ? processRuntime.livenessObservations(m) : {};
        let liveness = typeof tasks.assessLiveness === 'function' ? await tasks.assessLiveness(m, Date.now(), processLiveness, { [m.identity.session_id]: 'idle' }) : assessMissionLiveness(m, { now: Date.now(), processes: processLiveness, hostSessions: { [m.identity.session_id]: 'idle' } });
        appendLedger(m, 'runtime.liveness-assessment', { payload: { state: liveness.state, inflight: liveness.inflight, last_durable_progress_at: liveness.last_durable_progress_at, no_progress_ms: liveness.no_progress_ms, no_progress_window_ms: liveness.no_progress_window_ms, reasons: liveness.reasons.slice(0, 12) } });
        if (liveness.state === 'RECONCILE') {
            const reconciled = typeof tasks.reconcileRestoredChildren === 'function' ? await tasks.reconcileRestoredChildren(m) : 0;
            if (reconciled) {
                store.updateProgress(m);
                liveness = await tasks.assessLiveness(m, Date.now(), processRuntime.livenessObservations(m), { [m.identity.session_id]: 'idle' });
            }
            if (liveness.state === 'RECONCILE') {
                persistence.save(store.all());
                return;
            }
        }
        if (liveness.state === 'STALLED') {
            const recovery = typeof tasks.recoverStalledExecution === 'function' ? await tasks.recoverStalledExecution(m, liveness) : { disposition: 'NOOP', reason: 'liveness-recovery-port-unavailable' };
            appendLedger(m, 'runtime.liveness-recovery', { worker_id: recovery.worker_id, task_id: recovery.task_id, payload: { disposition: recovery.disposition, reason: recovery.reason } });
            if (recovery.disposition === 'RECOVERED') {
                store.updateProgress(m);
                persistence.save(store.all());
                return;
            }
        }
        let decision = evaluateIdle(m, Date.now(), projectRoot);
        if (!progressed && shouldCountStagnation(decision)) {
            store.updateProgress(m, true);
            decision = evaluateIdle(m, Date.now(), projectRoot);
        }
        appendLedger(m, 'runtime.decision', { payload: { decision: decision.decision, reason: decision.reason, reason_code: decision.reason_code, progressed, stagnation_count: m.continuation.stagnation_count, liveness_state: liveness.state, liveness_inflight: liveness.inflight } });
        if (decision.decision === 'STOP') {
            const c = evaluateCompletion(m, projectRoot);
            if (c.complete)
                store.complete(sid);
            persistence.save(store.all());
            return;
        }
        if (decision.decision === 'USER_ACTION_REQUIRED') {
            if (m.authority.human_decision?.status !== 'OPEN') {
                const human = classifyRuntimeHumanDecision(decision.reason_code);
                openHumanDecision(m, { ...human, reason_code: decision.reason_code, summary: decision.reason });
            }
            persistence.save(store.all());
            return;
        }
        if (decision.decision === 'RECOVER' && decision.reason_code === 'stagnation-recovery') {
            const match = /^stagnation-level-(\d+):(same-worker-resume|model-escalation|narrow-task|alternate-plan|fresh-worker)$/.exec(decision.reason);
            const level = match ? Number(match[1]) : 0, action = match?.[2];
            if (level && (action === 'same-worker-resume' || action === 'model-escalation') && await tasks.recoverStagnation(m, level, action)) {
                store.updateProgress(m);
                persistence.save(store.all());
                return;
            }
        }
        if (decision.prompt && ['CONTINUE', 'RECONCILE', 'VERIFY', 'RECOVER'].includes(decision.decision))
            await dispatchContinuation(host, m, decision.prompt, decision.reason);
        persistence.save(store.all());
    }
}
