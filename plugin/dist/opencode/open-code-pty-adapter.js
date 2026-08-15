import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createOpencodeClient as createOpenCodeV2Client } from '@opencode-ai/sdk/v2/client';
import { isProcessContract, processCommandIdentity } from '../contracts/process.js';
import { evaluateProcessSpawnAuthority, processCommandLine } from '../runtime/process/authority.js';
export class ProcessSpawnPermissionError extends Error {
    decision;
    reason;
    constructor(decision, reason) {
        super(`Hi ProcessExecutor spawn ${decision.toLowerCase()}: ${reason}`);
        this.decision = decision;
        this.reason = reason;
        this.name = 'ProcessSpawnPermissionError';
    }
}
function nativeData(value) { const first = value && typeof value === 'object' && 'data' in value ? value.data : value; return (first && typeof first === 'object' && 'data' in first ? first.data : first); }
function cloneContract(value) { return structuredClone(value); }
function processID() { return `proc_${createHash('sha256').update(randomUUID()).digest('hex').slice(0, 24)}`; }
function wsUrl(serverUrl, ptyID, directory, ticket, cursor) { const url = new URL(`/api/pty/${encodeURIComponent(ptyID)}/connect`, serverUrl); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('location[directory]', directory); url.searchParams.set('cursor', String(cursor)); url.searchParams.set('ticket', ticket); return url.toString(); }
async function bytes(value) { if (value instanceof ArrayBuffer)
    return new Uint8Array(value); if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength); if (typeof Blob !== 'undefined' && value instanceof Blob)
    return new Uint8Array(await value.arrayBuffer()); return undefined; }
export function linuxProcessGroup(pid) {
    if (process.platform !== 'linux' || !Number.isInteger(pid) || pid <= 0)
        return undefined;
    try {
        const raw = readFileSync(`/proc/${pid}/stat`, 'utf8'), end = raw.lastIndexOf(')');
        if (end < 0)
            return undefined;
        const fields = raw.slice(end + 2).trim().split(/\s+/);
        const pgrp = Number(fields[2]);
        return Number.isInteger(pgrp) && pgrp > 0 ? pgrp : undefined;
    }
    catch {
        return undefined;
    }
}
export class OpenCodePtyAdapter {
    client;
    serverUrl;
    directory;
    projectRoot;
    getHostConfig;
    socketFactory;
    signalProcess;
    maxBufferedChars;
    maxReadChars;
    resolveProcessGroup;
    #states = new Map();
    #v2Client;
    constructor(client, serverUrl, directory, projectRoot, getHostConfig, socketFactory = (url) => new WebSocket(url), signalProcess = (pid, signal) => process.kill(pid, signal), maxBufferedChars = 256 * 1024, maxReadChars = 64 * 1024, resolveProcessGroup = linuxProcessGroup) {
        this.client = client;
        this.serverUrl = serverUrl;
        this.directory = directory;
        this.projectRoot = projectRoot;
        this.getHostConfig = getHostConfig;
        this.socketFactory = socketFactory;
        this.signalProcess = signalProcess;
        this.maxBufferedChars = maxBufferedChars;
        this.maxReadChars = maxReadChars;
        this.resolveProcessGroup = resolveProcessGroup;
    }
    #edge() { return this.client; }
    #pty() { const injected = this.#edge()?.v2?.pty; if (injected)
        return injected; if (!this.#v2Client && this.serverUrl)
        this.#v2Client = createOpenCodeV2Client({ baseUrl: this.serverUrl.toString(), directory: this.directory }); const pty = this.#v2Client?.v2?.pty ?? this.#v2Client?.pty; if (!pty || typeof pty.create !== 'function' || typeof pty.get !== 'function' || typeof pty.remove !== 'function' || typeof pty.connectToken !== 'function')
        throw new Error('OpenCode canonical v2 PTY API unavailable'); return pty; }
    #location() { return { directory: this.directory }; }
    #state(id) { const state = this.#states.get(id); if (!state)
        throw new Error(`Hi ProcessExecutor process not found: ${id}`); return state; }
    #signalTarget(state) {
        const expected = state.contract.process_group_id, observed = this.resolveProcessGroup(state.contract.pid);
        if (expected !== undefined) {
            if (observed !== expected)
                throw new Error(`Refusing process-group signal for ${state.contract.process_id}: expected ${expected}, observed ${String(observed)}`);
            return expected === state.contract.pid ? -expected : state.contract.pid;
        }
        return state.contract.pid;
    }
    #append(state, text, beforeMeta = false) {
        if (!text)
            return;
        if (beforeMeta) {
            state.beforeMetaChars += text.length;
            state.buffer = (state.buffer + text).slice(-this.maxBufferedChars);
            return;
        }
        const end = state.availableEnd + text.length;
        state.buffer = (state.buffer + text).slice(-this.maxBufferedChars);
        state.availableEnd = end;
        state.availableStart = Math.max(0, end - state.buffer.length);
    }
    #settleExit(state) { if (state.exitSettled)
        return; state.exitSettled = true; if (state.timeoutTimer)
        clearTimeout(state.timeoutTimer); state.resolveExit({ contract: cloneContract(state.contract) }); }
    #failExit(state, error) { if (state.exitSettled)
        return; state.exitSettled = true; if (state.timeoutTimer)
        clearTimeout(state.timeoutTimer); state.rejectExit(error); }
    #applyInfo(state, info) {
        if (info.pid !== state.contract.pid)
            throw new Error(`OpenCode PTY PID identity changed for ${state.contract.process_id}: expected ${state.contract.pid}, observed ${info.pid}`);
        if (info.status !== 'exited' || state.contract.status !== 'RUNNING')
            return;
        const now = Date.now();
        state.contract.ended_at = now;
        state.contract.cleanup_state = 'CLEANUP_PENDING';
        if (state.timeoutRequested) {
            state.contract.status = 'TIMED_OUT';
            state.contract.termination_reason = 'timeout-policy';
            state.contract.timeout_at = state.contract.timeout_at ?? now;
        }
        else if (state.killRequested) {
            state.contract.status = 'TERMINATED';
            state.contract.termination_reason = `signal:${state.killRequested}`;
        }
        else {
            state.contract.status = 'EXITED';
            state.contract.exit_code = Number.isInteger(info.exitCode) ? info.exitCode : 0;
        }
        const candidate = structuredClone(state.contract);
        if (!isProcessContract(candidate))
            throw new Error(`OpenCode PTY produced invalid Hi ProcessContract state for ${state.contract.process_id}`);
        this.#settleExit(state);
    }
    async #nativeInfo(state) { const raw = await this.#pty().get({ ptyID: state.ptyID, location: this.#location() }); const info = nativeData(raw); if (!info || typeof info.id !== 'string')
        throw new Error(`OpenCode PTY get returned invalid data for ${state.ptyID}`); return info; }
    async #refresh(state) { this.#applyInfo(state, await this.#nativeInfo(state)); }
    async #ticket(state) { const raw = await this.#pty().connectToken({ ptyID: state.ptyID, location: this.#location() }, { headers: { 'x-opencode-ticket': '1' } }); const token = nativeData(raw); if (!token?.ticket)
        throw new Error(`OpenCode PTY connect token unavailable for ${state.ptyID}`); return token.ticket; }
    async #onFrame(state, data) {
        const raw = await bytes(data);
        if (raw?.length && raw[0] === 0) {
            try {
                const meta = JSON.parse(new TextDecoder().decode(raw.slice(1)));
                if (!Number.isSafeInteger(meta?.cursor) || meta.cursor < 0)
                    throw new Error('invalid cursor');
                state.availableEnd = meta.cursor;
                state.availableStart = Math.max(0, meta.cursor - state.buffer.length);
                state.cursorKnown = true;
                return;
            }
            catch (error) {
                this.#failExit(state, new Error(`Invalid OpenCode PTY cursor frame: ${String(error)}`));
                return;
            }
        }
        if (typeof data === 'string') {
            this.#append(state, data, !state.cursorKnown);
            return;
        }
        if (raw) {
            try {
                const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
                this.#append(state, text, !state.cursorKnown);
            }
            catch { }
        }
    }
    async #connect(state, cursor) {
        const ticket = await this.#ticket(state), socket = this.socketFactory(wsUrl(this.serverUrl, state.ptyID, this.directory, ticket, cursor));
        state.socket = socket;
        state.cursorKnown = false;
        state.beforeMetaChars = 0;
        await new Promise((resolve, reject) => {
            let opened = false;
            socket.addEventListener('message', (event) => { void this.#onFrame(state, event.data); });
            socket.addEventListener('open', () => { opened = true; resolve(); }, { once: true });
            socket.addEventListener('error', () => { if (!opened)
                reject(new Error(`OpenCode PTY websocket failed for ${state.ptyID}`)); }, { once: true });
            socket.addEventListener('close', () => { void this.#onSocketClose(state); }, { once: true });
        });
    }
    async #onSocketClose(state) {
        try {
            await this.#refresh(state);
            if (state.contract.status !== 'RUNNING')
                return;
            if (state.reconnects >= 1) {
                this.#failExit(state, new Error(`OpenCode PTY transport lost while process ${state.contract.process_id} remains running`));
                return;
            }
            state.reconnects++;
            await this.#connect(state, state.availableEnd);
        }
        catch (error) {
            try {
                await this.#refresh(state);
                if (state.contract.status !== 'RUNNING')
                    return;
            }
            catch { }
            this.#failExit(state, error);
        }
    }
    async #requestTimeout(state) {
        if (state.contract.status !== 'RUNNING')
            return;
        try {
            const info = await this.#nativeInfo(state);
            if (info.pid !== state.contract.pid)
                throw new Error(`Refusing stale PID timeout signal for ${state.contract.process_id}`);
            if (info.status === 'exited') {
                this.#applyInfo(state, info);
                return;
            }
            const target = this.#signalTarget(state);
            this.signalProcess(target, 'SIGTERM');
            state.timeoutRequested = true;
        }
        catch (error) {
            this.#failExit(state, error);
        }
    }
    async spawn(request) {
        const auth = evaluateProcessSpawnAuthority(request, this.projectRoot, this.getHostConfig());
        if (auth.decision !== 'ALLOW')
            throw new ProcessSpawnPermissionError(auth.decision, auth.reason);
        if (!request.command.trim() || !request.cwd.trim() || !request.authority_ref.trim())
            throw new Error('Hi ProcessExecutor requires command, cwd and authority_ref');
        if (request.timeout_ms !== undefined && (!Number.isFinite(request.timeout_ms) || request.timeout_ms < 50 || request.timeout_ms > 24 * 60 * 60 * 1000))
            throw new Error('Hi ProcessExecutor timeout_ms must be between 50ms and 24h');
        const raw = await this.#pty().create({ location: this.#location(), command: request.command, args: request.args ?? [], cwd: request.cwd, title: request.title, env: request.env }), info = nativeData(raw);
        if (!info || info.status !== 'running' || !Number.isInteger(info.pid) || info.pid <= 0 || typeof info.id !== 'string')
            throw new Error('OpenCode PTY create did not return a running PID-bound session');
        const started = Date.now(), processGroup = this.resolveProcessGroup(info.pid), contract = { process_id: processID(), mission_id: request.mission_id, task_id: request.task_id, worker_id: request.worker_id, host: 'opencode', command_identity: processCommandIdentity({ host: 'opencode', command: processCommandLine({ command: info.command, args: info.args }), cwd: info.cwd }), cwd: info.cwd, pid: info.pid, ...(processGroup ? { process_group_id: processGroup } : {}), status: 'RUNNING', started_at: started, ...(request.timeout_ms ? { timeout_at: started + request.timeout_ms } : {}), output_artifact_refs: [], authority_ref: request.authority_ref, cleanup_state: 'ACTIVE' };
        if (!isProcessContract(contract)) {
            try {
                await this.#pty().remove({ ptyID: info.id, location: this.#location() });
            }
            catch { }
            throw new Error('Hi ProcessExecutor created invalid ProcessContract');
        }
        let resolveExit, rejectExit;
        const exitPromise = new Promise((resolve, reject) => { resolveExit = resolve; rejectExit = reject; });
        const state = { contract, ptyID: info.id, buffer: '', availableStart: 0, availableEnd: 0, cursorKnown: false, beforeMetaChars: 0, timeoutRequested: false, exitPromise, resolveExit, rejectExit, exitSettled: false, reconnects: 0 };
        this.#states.set(contract.process_id, state);
        try {
            await this.#connect(state, 0);
        }
        catch (error) {
            try {
                await this.#refresh(state);
            }
            catch { }
            if (state.contract.status === 'RUNNING') {
                try {
                    await this.#pty().remove({ ptyID: state.ptyID, location: this.#location() });
                }
                catch { }
                this.#states.delete(contract.process_id);
                throw error;
            }
        }
        if (request.timeout_ms)
            state.timeoutTimer = setTimeout(() => { void this.#requestTimeout(state); }, request.timeout_ms);
        return { contract: cloneContract(state.contract), host_process_id: state.ptyID };
    }
    async write(processId, input) { const state = this.#state(processId); await this.#refresh(state); if (state.contract.status !== 'RUNNING')
        throw new Error(`Cannot write to terminal process ${processId}`); if (typeof input !== 'string' || input.length > 64 * 1024)
        throw new Error('Process input exceeds 64KiB bound'); if (!state.socket || state.socket.readyState !== 1)
        await this.#connect(state, state.availableEnd); state.socket?.send(input); }
    async read(processId, window = {}) { const state = this.#state(processId); await this.#refresh(state); const requested = Number.isSafeInteger(window.cursor) ? Math.max(0, window.cursor) : state.availableStart, max = Math.max(1, Math.min(this.maxReadChars, Number.isFinite(window.max_chars) ? Math.floor(window.max_chars) : 8192)), start = Math.min(state.availableEnd, Math.max(state.availableStart, requested)), offset = start - state.availableStart, text = state.buffer.slice(offset, offset + max), end = start + text.length; return { text, start_cursor: start, end_cursor: end, available_start_cursor: state.availableStart, available_end_cursor: state.availableEnd, truncated: requested < state.availableStart || end < state.availableEnd, status: state.contract.status }; }
    async wait(processId) { const state = this.#state(processId); await this.#refresh(state); if (state.contract.status !== 'RUNNING')
        return { contract: cloneContract(state.contract) }; return state.exitPromise; }
    async kill(processId, signal = 'SIGTERM') { const state = this.#state(processId); await this.#refresh(state); if (state.contract.status !== 'RUNNING')
        return { contract: cloneContract(state.contract) }; const info = await this.#nativeInfo(state); if (info.pid !== state.contract.pid)
        throw new Error(`Refusing stale PID kill for ${processId}`); const target = this.#signalTarget(state); this.signalProcess(target, signal); state.killRequested = signal; return this.wait(processId); }
    async cleanup(processId) { const state = this.#state(processId); await this.#refresh(state); if (state.contract.status === 'RUNNING')
        throw new Error(`Refusing cleanup of running process ${processId}; kill/exit must occur first`); await this.#pty().remove({ ptyID: state.ptyID, location: this.#location() }); state.socket?.close(1000, 'Hi cleanup'); state.contract.cleanup_state = 'CLEANED'; if (!isProcessContract(state.contract))
        throw new Error(`Invalid cleanup state for ${processId}`); this.#states.delete(processId); }
    async reconcile(contract) {
        const persisted = structuredClone(contract);
        if (!isProcessContract(persisted) || persisted.host !== 'opencode')
            throw new Error('Hi ProcessExecutor reconcile requires a valid OpenCode ProcessContract');
        const raw = await this.#pty().list({ location: this.#location() }), items = nativeData(raw) ?? [];
        const samePid = Array.isArray(items) ? items.filter(info => info && info.pid === persisted.pid) : [];
        const exact = samePid.find(info => info.cwd === persisted.cwd && processCommandIdentity({ host: 'opencode', command: processCommandLine({ command: info.command, args: info.args }), cwd: info.cwd }) === persisted.command_identity);
        if (!exact) {
            if (persisted.status !== 'RUNNING' && samePid.length === 0) {
                persisted.cleanup_state = 'CLEANED';
                return { disposition: 'TERMINAL', contract: persisted };
            }
            persisted.status = 'ORPHANED';
            persisted.cleanup_state = 'QUARANTINED';
            persisted.termination_reason = samePid.length ? 'restart-owner-identity-mismatch' : 'restart-owner-missing';
            delete persisted.exit_code;
            return { disposition: 'ORPHANED', contract: persisted };
        }
        if (persisted.status !== 'RUNNING' && exact.status === 'running') {
            persisted.status = 'ORPHANED';
            persisted.cleanup_state = 'QUARANTINED';
            persisted.termination_reason = 'restart-terminal-contract-host-running';
            delete persisted.exit_code;
            return { disposition: 'ORPHANED', contract: persisted };
        }
        if (persisted.process_group_id !== undefined) {
            const observedGroup = this.resolveProcessGroup(persisted.pid);
            if (observedGroup !== persisted.process_group_id) {
                persisted.status = 'ORPHANED';
                persisted.cleanup_state = 'QUARANTINED';
                persisted.termination_reason = 'restart-process-group-identity-mismatch';
                delete persisted.exit_code;
                return { disposition: 'ORPHANED', contract: persisted };
            }
        }
        let resolveExit, rejectExit;
        const exitPromise = new Promise((resolve, reject) => { resolveExit = resolve; rejectExit = reject; });
        const state = { contract: persisted, ptyID: exact.id, buffer: '', availableStart: 0, availableEnd: 0, cursorKnown: false, beforeMetaChars: 0, timeoutRequested: false, exitPromise, resolveExit, rejectExit, exitSettled: false, reconnects: 0 };
        this.#states.set(persisted.process_id, state);
        if (exact.status === 'exited') {
            if (persisted.status === 'RUNNING') {
                persisted.status = 'EXITED';
                persisted.ended_at = Date.now();
                persisted.exit_code = Number.isInteger(exact.exitCode) ? exact.exitCode : 0;
                persisted.cleanup_state = 'CLEANUP_PENDING';
            }
            state.contract = persisted;
            this.#settleExit(state);
            return { disposition: 'TERMINAL', contract: cloneContract(persisted) };
        }
        await this.#connect(state, 0);
        return { disposition: 'ADOPTED', contract: cloneContract(persisted) };
    }
    snapshot(processId) { return cloneContract(this.#state(processId).contract); }
    list() { return [...this.#states.values()].map(state => cloneContract(state.contract)); }
}
