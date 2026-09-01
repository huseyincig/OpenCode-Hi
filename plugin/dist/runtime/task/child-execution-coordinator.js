import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { redactProviderContext } from '../privacy/boundary.js';
import { appendLedger } from '../ledger/ledger.js';
import { reconcileModelExecutionIdentity } from '../../contracts/model.js';
import { normalizeBoundedProjectPath } from '../../contracts/common.js';
import { workerResultOutputFormat } from '../../contracts/worker-result-schema.js';
import { clearCapabilityUnavailable, markCapabilityUnavailable } from '../readiness/capability-failure.js';
function normFile(value) { return normalizeBoundedProjectPath(value) ?? ''; }
function nativeDiffMap(raw) {
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    const out = {};
    for (const item of items) {
        const file = typeof item?.file === 'string' ? normFile(item.file) : '';
        if (!file)
            continue;
        const signature = createHash('sha256').update(JSON.stringify({ file, additions: item?.additions ?? null, deletions: item?.deletions ?? null, status: item?.status ?? null, before: item?.before ?? null, after: item?.after ?? null, patch: item?.patch ?? null })).digest('hex');
        out[file] = signature;
    }
    return out;
}
export function diffDelta(before, after) { const b = before ?? {}; return Object.keys(after).filter(file => b[file] !== after[file]); }
export { normFile };
function samePath(a, b) { try {
    return realpathSync(resolve(a)) === realpathSync(resolve(b));
}
catch {
    return resolve(a) === resolve(b);
} }
export class ChildExecutionCoordinator {
    host;
    registry;
    constructor(host, registry) {
        this.host = host;
        this.registry = registry;
    }
    resolveCallbackWorker(sessionID) { const matches = this.registry?.list().filter(w => w.session_id === sessionID) ?? []; return matches.length === 1 ? matches[0] : undefined; }
    async create(parentSessionID, title, role, model, variant, workspace) { const created = await this.host.create({ parentSessionID, title, role, model, variant, workspace }), child = created.child; if (workspace && (child?.workspaceID !== workspace.workspaceID || typeof child?.directory !== 'string' || !samePath(child.directory, workspace.directory))) {
        if (child?.id)
            try {
                await this.host.abort(String(child.id));
            }
            catch { }
        ;
        throw new Error(`Host child workspace binding mismatch: expected ${workspace.workspaceID} @ ${workspace.directory}, observed ${String(child?.workspaceID)} @ ${String(child?.directory)}`);
    } return child; }
    async createForTask(parentSessionID, title, role, model, variant, forkFromSession, workspace) { const created = await this.host.create({ parentSessionID, title, role, model, variant, workspace, forkFromSession }); const child = created.child; if (workspace && (child?.workspaceID !== workspace.workspaceID || typeof child?.directory !== 'string' || !samePath(child.directory, workspace.directory))) {
        if (child?.id)
            try {
                await this.host.abort(String(child.id));
            }
            catch { }
        ;
        throw new Error(`Host child workspace binding mismatch: expected ${workspace.workspaceID} @ ${workspace.directory}, observed ${String(child?.workspaceID)} @ ${String(child?.directory)}`);
    } return created; }
    async sendProviderPrompt(sessionID, text, role, model, variant, tools, messageID, transport = 'structured') { const safe = redactProviderContext(text), format = transport === 'structured' && this.host.capabilities.structuredOutput === true ? workerResultOutputFormat() : undefined; return this.host.prompt(sessionID, safe.providerText, role, model, variant, tools, messageID, format); }
    async status(sessionID) { return this.host.status(sessionID); }
    recordModelProjection(worker, model, variant) { worker.projected_model = model ?? 'host-default'; worker.projected_model_variant = variant; worker.updated_at = Date.now(); }
    async abortNativeSession(m, sessionID, reason, workerID, taskID) { try {
        const transport = await this.host.abort(sessionID);
        appendLedger(m, 'worker.session-abort', { task_id: taskID, worker_id: workerID, payload: { session_id: sessionID, reason, transport } });
        if (transport === 'unavailable') {
            markCapabilityUnavailable(m, { capability: 'session-abort', reason: `OpenCode session abort is unavailable while ${reason}`, taskId: taskID, workerId: workerID });
            return false;
        }
        clearCapabilityUnavailable(m, 'session-abort');
        return true;
    }
    catch (error) {
        appendLedger(m, 'worker.session-abort', { task_id: taskID, worker_id: workerID, payload: { session_id: sessionID, reason, transport: 'error', error: String(error) } });
        markCapabilityUnavailable(m, { capability: 'session-abort', reason: `OpenCode session abort failed while ${reason}: ${String(error)}`, taskId: taskID, workerId: workerID });
        return false;
    } }
    async captureNativeDiff(worker, phase) {
        if (!worker.session_id || !this.host.capabilities.diff)
            return undefined;
        try {
            const map = nativeDiffMap(await this.host.diff(worker.session_id)), stateHash = createHash('sha256').update(JSON.stringify(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
            if (phase === 'baseline')
                worker.native_diff_baseline = map;
            else {
                worker.native_diff_final = map;
                worker.native_state_hash = stateHash;
            }
            return map;
        }
        catch {
            return undefined;
        }
    }
    noteEffectiveModel(m, workerID, observed) {
        const worker = m.execution.workers.find(w => w.id === workerID);
        if (!worker)
            return { ok: false, reason: 'worker-not-found' };
        const task = m.execution.tasks.find(t => t.id === worker.task_id), expected = worker.model, expectedVariant = worker.model_variant, taskID = task?.id ?? worker.task_id;
        const clearModelMarkers = () => { m.execution.blockers = m.execution.blockers.filter(b => !b.startsWith(`model-projection-mismatch:${taskID}:`) && !b.startsWith(`model-effective-unverified:${taskID}:`) && !b.startsWith(`model-effective-mismatch:${taskID}:`) && !b.startsWith(`model-variant-unverified:${taskID}:`) && !b.startsWith(`model-variant-mismatch:${taskID}:`)); };
        const requested = (worker.requested_model || worker.requested_model_variant) ? { model: worker.requested_model, variant: worker.requested_model_variant, source: 'task-override' } : undefined;
        const selected = (worker.model || worker.model_variant) ? { model: worker.model, variant: worker.model_variant, source: 'runtime-resolver/current-worker-selection' } : undefined;
        const projected = (worker.projected_model || worker.projected_model_variant) ? { model: worker.projected_model, variant: worker.projected_model_variant, source: 'host-child-or-prompt' } : undefined;
        const identity = reconcileModelExecutionIdentity({ requested, selected, projected, observed: observed ? { model: observed.model, variant: observed.variant, source: observed.source ?? 'assistant-message-metadata' } : undefined });
        worker.effective_model = identity.effective?.model;
        worker.effective_model_variant = identity.effective?.variant;
        worker.effective_model_source = identity.effective?.source ?? observed?.source ?? 'assistant-message-metadata';
        worker.effective_model_observed_at = Date.now();
        worker.effective_model_verified = identity.modelVerified;
        worker.effective_model_variant_verified = identity.variantVerified;
        if (identity.status === 'host-default-or-unconstrained') {
            clearModelMarkers();
            appendLedger(m, 'model.effective.observed', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected ?? 'host-default', projected: worker.projected_model ?? 'host-default/unrecorded', observed: observed?.model ?? 'host-default/unreported', expected_variant: expectedVariant, projected_variant: worker.projected_model_variant, variant: observed?.variant, source: worker.effective_model_source } });
            return { ok: true, expected, observed: observed?.model, reason: 'host-default-or-unconstrained' };
        }
        if (identity.status === 'projection-mismatch') {
            const marker = `model-projection-mismatch:${taskID}:${expected ?? 'unknown'}->${worker.projected_model ?? 'unrecorded'}`;
            clearModelMarkers();
            m.execution.blockers.push(marker);
            appendLedger(m, 'model.projection.mismatch', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, selected_variant: expectedVariant, projected_variant: worker.projected_model_variant } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        if (identity.status === 'model-unverified') {
            const marker = `model-effective-unverified:${taskID}:${expected}`;
            if (!m.execution.blockers.includes(marker))
                m.execution.blockers.push(marker);
            appendLedger(m, 'model.effective.unverified', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, expected_variant: expectedVariant, source: worker.effective_model_source } });
            return { ok: false, expected, reason: marker };
        }
        if (identity.status === 'model-mismatch') {
            const marker = `model-effective-mismatch:${taskID}:${expected}->${observed?.model}`;
            clearModelMarkers();
            m.execution.blockers.push(marker);
            appendLedger(m, 'model.effective.mismatch', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, observed: observed?.model, expected_variant: expectedVariant, variant: observed?.variant, source: worker.effective_model_source } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        if (identity.status === 'variant-unverified') {
            const marker = `model-variant-unverified:${taskID}:${expectedVariant}`;
            clearModelMarkers();
            m.execution.blockers.push(marker);
            appendLedger(m, 'model.variant.unverified', { task_id: task?.id, worker_id: worker.id, payload: { model: expected, projected: worker.projected_model, expected_variant: expectedVariant, projected_variant: worker.projected_model_variant, source: worker.effective_model_source } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        if (identity.status === 'variant-mismatch') {
            const marker = `model-variant-mismatch:${taskID}:${expectedVariant}->${observed?.variant}`;
            clearModelMarkers();
            m.execution.blockers.push(marker);
            appendLedger(m, 'model.variant.mismatch', { task_id: task?.id, worker_id: worker.id, payload: { model: expected, projected: worker.projected_model, expected_variant: expectedVariant, projected_variant: worker.projected_model_variant, observed_variant: observed?.variant, source: worker.effective_model_source } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        clearModelMarkers();
        appendLedger(m, 'model.effective.verified', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, observed: observed?.model, expected_variant: expectedVariant, projected_variant: worker.projected_model_variant, variant: observed?.variant, variant_verified: identity.variantVerified, source: worker.effective_model_source } });
        return { ok: true, expected, observed: observed?.model, reason: expectedVariant ? 'effective-model-and-variant-match-runtime-selection' : 'effective-model-matches-runtime-selection' };
    }
}
