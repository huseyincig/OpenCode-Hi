import { createHash } from 'node:crypto';
import { ProcessSpawnPermissionError } from './executor.js';
import { evaluateProcessSpawnAuthority } from './authority.js';
import { appendLedger } from '../ledger/ledger.js';
import { addEvidence } from '../evidence/evidence-runtime.js';
import { actionContract, beginAuthorizedAction, completeAuthorizedAction, completeAuthorizedActionByHash, isAuthorized, requireAuthority } from '../safety/authority.js';
import { evaluateShellCommand } from './shell-policy.js';
import { externalActionType } from '../safety/command-classifier.js';
import { normalizeBrowserAllowedOrigins, observedLocalBrowserOriginsFromText } from '../browser/backend-policy.js';
function replaceProcess(m, contract) {
    const index = m.execution.processes.findIndex(p => p.process_id === contract.process_id);
    if (index < 0)
        m.execution.processes.push(structuredClone(contract));
    else
        m.execution.processes[index] = structuredClone(contract);
}
function workerFor(m, id) {
    const worker = m.execution.workers.find(w => w.id === id);
    if (!worker)
        throw new Error(`Hi process owner worker not found: ${id}`);
    const task = m.execution.tasks.find(t => t.id === worker.task_id);
    if (!task)
        throw new Error(`Hi process owner task not found: ${worker.task_id}`);
    if (worker.parent_mission_id !== m.identity.mission_id)
        throw new Error('Hi process worker mission identity mismatch');
    return worker;
}
function hash(text) { return createHash('sha256').update(text).digest('hex'); }
function addProcessBlocker(m, marker) { if (!m.execution.blockers.includes(marker))
    m.execution.blockers.push(marker); }
function clearProcessBlockers(m, id, kinds) { const prefixes = new Set(kinds.map(kind => `${kind}:${id}`)); m.execution.blockers = m.execution.blockers.filter(x => !prefixes.has(x)); }
function mergedServiceOrigins(...sets) { return normalizeBrowserAllowedOrigins(sets.flatMap(values => values ?? [])); }
function exactTaskBrowserOrigins(task) { if (task.execution_profile?.browser_backend !== 'bounded-playwright')
    return []; const required = task.execution_profile.browser_required_origins ?? []; return required.length ? [...required] : [...(task.execution_profile.browser_allowed_origins ?? [])]; }
function assertProcessServiceOriginsWithinBrowserPlan(m, task, workerID, origins, source) { const declared = normalizeBrowserAllowedOrigins(origins), plan = exactTaskBrowserOrigins(task); if (!declared.length || !plan.length)
    return; const incompatible = declared.filter(origin => !plan.includes(origin)); if (!incompatible.length)
    return; appendLedger(m, 'process.service-origin-plan-rejected', { task_id: task.id, worker_id: workerID, payload: { declared_service_origins: declared, required_browser_origins: plan, incompatible_service_origins: incompatible, source, policy: 'exact-browser-origin-authority-before-process-contract-merge' } }); throw new Error(`Process service origin outside immutable browser plan: declared=${declared.join(', ')} required=${plan.join(', ')}`); }
function mergeProcessTargetAuthority(current, next) { const serviceOrigins = mergedServiceOrigins(current?.service_origins, next.service_origins); return { ...next, ...(serviceOrigins.length ? { service_origins: serviceOrigins } : {}) }; }
export class ProcessRuntime {
    executor;
    projectRoot;
    getHostConfig;
    #verifiedRunningOwners = new Set();
    constructor(executor, projectRoot, getHostConfig) {
        this.executor = executor;
        this.projectRoot = projectRoot;
        this.getHostConfig = getHostConfig;
    }
    contract(m, id) { const item = m.execution.processes.find(p => p.process_id === id); if (!item)
        throw new Error(`Hi process not found in mission: ${id}`); return item; }
    async spawn(m, input) {
        if (m.identity.status !== 'active' || m.continuation.user_interrupted)
            throw new Error('Mission is stopped; process spawn is forbidden');
        const worker = workerFor(m, input.worker_id), task = m.execution.tasks.find(t => t.id === worker.task_id);
        if (['completed', 'failed', 'cancelled'].includes(worker.status) || ['completed', 'failed', 'cancelled', 'blocked'].includes(task.status))
            throw new Error('Process owner task/worker is terminal');
        const ordinaryAuthority = `native-permission:${worker.id}:bash`;
        const commandLine = [input.command, ...input.args ?? []].join(' '), shell = evaluateShellCommand(commandLine);
        if (shell.decision === 'DENY' || shell.decision === 'USER_ACTION_REQUIRED' || shell.decision === 'REWRITE')
            throw new ProcessSpawnPermissionError(shell.decision === 'DENY' ? 'DENY' : 'ASK', `shell-policy:${shell.reason}`);
        const actionType = externalActionType(commandLine);
        let authorityRef = ordinaryAuthority;
        if (actionType) {
            if (!m.identity.intent.requestedExternalActions.includes(actionType))
                throw new Error(`Hi process external action ${actionType} was not requested by the mission`);
            const exact = actionContract(commandLine, input.cwd);
            authorityRef = exact.hash;
            if (!isAuthorized(m, commandLine, input.cwd))
                requireAuthority(m, commandLine, input.cwd);
        }
        const serviceOrigins = normalizeBrowserAllowedOrigins(input.service_origins ?? []);
        assertProcessServiceOriginsWithinBrowserPlan(m, task, worker.id, serviceOrigins, 'spawn-request');
        let request = { mission_id: m.identity.mission_id, task_id: task.id, worker_id: worker.id, role: worker.role, command: input.command, args: input.args, cwd: input.cwd, env: input.env, title: input.title, timeout_ms: input.timeout_ms, ...(serviceOrigins.length ? { service_origins: serviceOrigins } : {}), authority_ref: authorityRef, ...(actionType ? { external_action: { action_type: actionType, target: commandLine, requested_explicitly: true, required_authority_ref: authorityRef, executor: 'hi-process-executor' } } : {}) };
        for (let attempts = 0; attempts < 3; attempts++) {
            const auth = evaluateProcessSpawnAuthority(request, this.projectRoot, this.getHostConfig());
            if (auth.decision === 'DENY')
                throw new ProcessSpawnPermissionError('DENY', auth.reason);
            if (auth.decision === 'ASK') {
                if (!auth.permission_request || !input.ask)
                    throw new ProcessSpawnPermissionError('ASK', auth.reason);
                await input.ask(auth.permission_request);
                request = { ...request, native_permission_grants: [...(request.native_permission_grants ?? []), { permission: auth.permission_request.permission, pattern: auth.permission_request.pattern }] };
                continue;
            }
            let privilegedStarted = false;
            if (actionType) {
                beginAuthorizedAction(m, commandLine, input.cwd);
                privilegedStarted = true;
            }
            try {
                const handle = await this.executor.spawn(request), contract = mergeProcessTargetAuthority(undefined, handle.contract);
                replaceProcess(m, contract);
                if (contract.status === 'RUNNING')
                    this.#verifiedRunningOwners.add(contract.process_id);
                appendLedger(m, 'process.spawned', { task_id: task.id, worker_id: worker.id, payload: { process_id: contract.process_id, pid: contract.pid, host: contract.host, timeout_at: contract.timeout_at, service_origins: contract.service_origins ?? [] } });
                return structuredClone(contract);
            }
            catch (error) {
                if (privilegedStarted)
                    completeAuthorizedAction(m, commandLine, input.cwd, 'unknown', String(error));
                throw error;
            }
        }
        throw new Error('Hi process native permission resolution exceeded bounded attempts');
    }
    async write(m, id, input) { this.contract(m, id); await this.executor.write(id, input); appendLedger(m, 'process.stdin', { payload: { process_id: id, chars: input.length } }); }
    async observe(m, id) { const before = this.contract(m, id), observedRaw = await this.executor.observe(id); if (observedRaw.process_id !== before.process_id || observedRaw.mission_id !== before.mission_id || observedRaw.task_id !== before.task_id || observedRaw.worker_id !== before.worker_id)
        throw new Error(`Hi process observation identity mismatch: ${id}`); const observed = mergeProcessTargetAuthority(before, observedRaw); if (observed.status !== 'RUNNING')
        this.noteExit(m, observed);
    else
        replaceProcess(m, observed); appendLedger(m, 'process.status-observed', { task_id: observed.task_id, worker_id: observed.worker_id, payload: { process_id: id, status: observed.status, cleanup_state: observed.cleanup_state, service_origins: observed.service_origins ?? [] } }); return structuredClone(observed); }
    async read(m, id, cursor, maxChars) { let current = this.contract(m, id); const out = await this.executor.read(id, { cursor, max_chars: maxChars }), observedOrigins = observedLocalBrowserOriginsFromText(out.text), task = m.execution.tasks.find(item => item.id === current.task_id); if (!task)
        throw new Error(`Hi process owner task not found: ${current.task_id}`); assertProcessServiceOriginsWithinBrowserPlan(m, task, current.worker_id, observedOrigins, 'bounded-process-output'); const serviceOrigins = mergedServiceOrigins(current.service_origins, observedOrigins); if (JSON.stringify(serviceOrigins) !== JSON.stringify(current.service_origins ?? [])) {
        current = mergeProcessTargetAuthority(current, { ...current, service_origins: serviceOrigins });
        replaceProcess(m, current);
        appendLedger(m, 'process.service-origin-observed', { task_id: current.task_id, worker_id: current.worker_id, payload: { process_id: id, service_origins: serviceOrigins, source: 'bounded-process-output' } });
    } if (out.status !== 'RUNNING') {
        const terminal = await this.executor.wait(id);
        this.noteExit(m, terminal.contract);
    } const stateHash = hash(out.text), duplicate = !out.text.length || out.end_cursor <= out.start_cursor || m.execution.ledger.some(e => e.type === 'process.output-observed' && e.payload?.process_id === id && e.payload?.state_hash === stateHash); if (!duplicate) {
        const source = `process:${id}:${out.start_cursor}-${out.end_cursor}`;
        addEvidence(m, { kind: 'diagnostic-evidence', summary: `Bounded process output observed (${out.text.length} chars${out.truncated ? ', truncated' : ''})`, scope: m.execution.tasks.find(t => t.id === current.task_id)?.scope ?? [], source, source_state_hash: stateHash, task_id: current.task_id, obligation_ids: m.execution.tasks.find(t => t.id === current.task_id)?.obligation_ids ?? [], outcome: 'pending', reason: 'process-output-observation' });
        appendLedger(m, 'process.output-observed', { task_id: current.task_id, worker_id: current.worker_id, payload: { process_id: id, start_cursor: out.start_cursor, end_cursor: out.end_cursor, available_start: out.available_start_cursor, available_end: out.available_end_cursor, truncated: out.truncated, state_hash: stateHash } });
    }
    else
        appendLedger(m, 'process.output-repeat', { task_id: current.task_id, worker_id: current.worker_id, payload: { process_id: id, start_cursor: out.start_cursor, end_cursor: out.end_cursor, state_hash: stateHash } }); return out; }
    noteExit(m, contract) { contract = mergeProcessTargetAuthority(m.execution.processes.find(p => p.process_id === contract.process_id), contract); replaceProcess(m, contract); if (contract.status !== 'RUNNING') {
        this.#verifiedRunningOwners.delete(contract.process_id);
        clearProcessBlockers(m, contract.process_id, ['process-termination-unverified', 'process-wait-failed']);
    } appendLedger(m, 'process.exited', { task_id: contract.task_id, worker_id: contract.worker_id, payload: { process_id: contract.process_id, status: contract.status, exit_code: contract.exit_code, cleanup_state: contract.cleanup_state } }); return contract; }
    async wait(m, id) { const before = this.contract(m, id); try {
        const result = await this.executor.wait(id), terminal = this.noteExit(m, result.contract);
        const action = m.authority.authority?.executing;
        if (action?.hash === terminal.authority_ref) {
            completeAuthorizedActionByHash(m, action.hash, terminal.status === 'EXITED' && terminal.exit_code === 0 ? 'success' : 'failure', `process ${terminal.status}${terminal.exit_code !== undefined ? ` exit=${terminal.exit_code}` : ''}`, action.action.match(/(?:^|\n)command=([^\n]*)/)?.[1] ?? '');
        }
        return structuredClone(terminal);
    }
    catch (error) {
        const marker = `process-wait-failed:${id}`;
        addProcessBlocker(m, marker);
        appendLedger(m, 'process.wait-failed', { task_id: before.task_id, worker_id: before.worker_id, payload: { process_id: id, error: String(error), marker } });
        if (m.authority.authority?.executing?.hash === before.authority_ref) {
            const command = m.authority.authority.executing.action.match(/(?:^|\n)command=([^\n]*)/)?.[1] ?? '';
            if (command)
                completeAuthorizedActionByHash(m, m.authority.authority.executing.hash, 'unknown', String(error), command);
        }
        throw error;
    } }
    async kill(m, id, signal = 'SIGTERM') { const before = this.contract(m, id); try {
        const result = await this.executor.kill(id, signal), terminal = this.noteExit(m, result.contract);
        if (m.identity.status === 'active' && m.authority.authority?.executing?.hash === before.authority_ref) {
            const command = m.authority.authority.executing.action.match(/(?:^|\n)command=([^\n]*)/)?.[1] ?? '';
            if (command)
                completeAuthorizedActionByHash(m, m.authority.authority.executing.hash, 'failure', `process terminated by ${signal}`, command);
        }
        return structuredClone(terminal);
    }
    catch (error) {
        const marker = `process-termination-unverified:${id}`;
        addProcessBlocker(m, marker);
        appendLedger(m, 'process.kill-failed', { task_id: before.task_id, worker_id: before.worker_id, payload: { process_id: id, signal, error: String(error), marker } });
        throw error;
    } }
    async cleanup(m, id) { const current = this.contract(m, id); try {
        const cleaned = await this.executor.cleanup(id);
        if (cleaned.process_id !== current.process_id || cleaned.mission_id !== current.mission_id || cleaned.task_id !== current.task_id || cleaned.worker_id !== current.worker_id)
            throw new Error(`Hi process cleanup identity mismatch: ${id}`);
        if (cleaned.status === 'RUNNING' || cleaned.status === 'ORPHANED' || cleaned.cleanup_state !== 'CLEANED')
            throw new Error(`Hi process cleanup returned non-terminal contract: ${id}`);
        replaceProcess(m, cleaned);
        clearProcessBlockers(m, id, ['process-cleanup']);
        appendLedger(m, 'process.cleaned', { task_id: cleaned.task_id, worker_id: cleaned.worker_id, payload: { process_id: id, status: cleaned.status } });
    }
    catch (error) {
        const marker = `process-cleanup:${id}`;
        addProcessBlocker(m, marker);
        appendLedger(m, 'process.cleanup-failed', { task_id: current.task_id, worker_id: current.worker_id, payload: { process_id: id, error: String(error), marker } });
        throw error;
    } }
    async settleTaskOwner(m, taskID, workerID) { let settled = 0; const owned = [...m.execution.processes].filter(process => process.task_id === taskID && process.worker_id === workerID && process.cleanup_state !== 'CLEANED'); for (const process of owned) {
        let current = m.execution.processes.find(item => item.process_id === process.process_id);
        if (current.status === 'RUNNING')
            await this.kill(m, current.process_id, 'SIGTERM');
        current = m.execution.processes.find(item => item.process_id === process.process_id);
        if (current.status === 'RUNNING' || current.status === 'ORPHANED')
            throw new Error(`Exact task-owned process ${current.process_id} could not be settled safely from status ${current.status}`);
        if (current.cleanup_state !== 'CLEANED') {
            await this.cleanup(m, current.process_id);
            settled++;
        }
    } if (owned.length)
        appendLedger(m, 'process.task-owner-settled', { task_id: taskID, worker_id: workerID, payload: { process_ids: owned.map(process => process.process_id), settled } }); return settled; }
    list(m) { return m.execution.processes.map(item => structuredClone(item)); }
    livenessObservations(m) { const out = {}; for (const process of m.execution.processes) {
        if (process.status === 'RUNNING')
            out[process.process_id] = { owner_verified: this.#verifiedRunningOwners.has(process.process_id), status: this.#verifiedRunningOwners.has(process.process_id) ? 'running' : 'unknown' };
        else if (process.status === 'ORPHANED')
            out[process.process_id] = { owner_verified: false, status: 'unknown' };
        else
            out[process.process_id] = { owner_verified: true, status: 'exited' };
    } return out; }
    async stopMission(m) { let stopped = 0; for (const process of [...m.execution.processes]) {
        if (process.status === 'RUNNING') {
            try {
                await this.kill(m, process.process_id, 'SIGTERM');
                stopped++;
            }
            catch (error) {
                const latest = m.execution.processes.find(p => p.process_id === process.process_id);
                if (latest) {
                    latest.status = 'ORPHANED';
                    latest.cleanup_state = 'QUARANTINED';
                    latest.termination_reason = 'stop-termination-unverified';
                }
                m.execution.blockers = [...new Set([...m.execution.blockers, `process-orphan:${process.process_id}`])];
                appendLedger(m, 'process.stop-failed', { task_id: process.task_id, worker_id: process.worker_id, payload: { process_id: process.process_id, error: String(error) } });
                continue;
            }
        }
        const latest = m.execution.processes.find(p => p.process_id === process.process_id);
        if (latest && latest.status !== 'RUNNING' && latest.status !== 'ORPHANED' && latest.cleanup_state !== 'CLEANED') {
            try {
                await this.cleanup(m, process.process_id);
            }
            catch (error) {
                m.execution.blockers = [...new Set([...m.execution.blockers, `process-cleanup:${process.process_id}`])];
                appendLedger(m, 'process.cleanup-failed', { task_id: process.task_id, worker_id: process.worker_id, payload: { process_id: process.process_id, error: String(error) } });
            }
        }
    } return stopped; }
    async reconcileRestored(missions) { for (const m of missions)
        for (const stored of [...m.execution.processes]) {
            if (stored.cleanup_state === 'CLEANED')
                continue;
            try {
                const result = await this.executor.reconcile(stored), contract = mergeProcessTargetAuthority(stored, result.contract);
                result.contract = contract;
                replaceProcess(m, contract);
                if (result.disposition === 'ADOPTED' && result.contract.status === 'RUNNING')
                    this.#verifiedRunningOwners.add(stored.process_id);
                else
                    this.#verifiedRunningOwners.delete(stored.process_id);
                if (result.disposition !== 'ORPHANED')
                    clearProcessBlockers(m, stored.process_id, ['process-termination-unverified', 'process-wait-failed']);
                appendLedger(m, 'process.restart-reconciled', { task_id: stored.task_id, worker_id: stored.worker_id, payload: { process_id: stored.process_id, disposition: result.disposition, status: result.contract.status, cleanup_state: result.contract.cleanup_state } });
                if (result.disposition === 'ORPHANED')
                    m.execution.blockers = [...new Set([...m.execution.blockers, `process-orphan:${stored.process_id}`])];
            }
            catch (error) {
                const orphan = { ...stored, status: 'ORPHANED', cleanup_state: 'QUARANTINED', termination_reason: 'restart-reconcile-error' };
                delete orphan.exit_code;
                replaceProcess(m, orphan);
                this.#verifiedRunningOwners.delete(stored.process_id);
                m.execution.blockers = [...new Set([...m.execution.blockers, `process-orphan:${stored.process_id}`])];
                appendLedger(m, 'process.restart-reconcile-failed', { task_id: stored.task_id, worker_id: stored.worker_id, payload: { process_id: stored.process_id, error: String(error) } });
            }
        } }
}
