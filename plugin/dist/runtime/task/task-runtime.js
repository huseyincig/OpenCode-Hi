import { createHash } from 'node:crypto';
import { resolveCategory } from '../routing/category.js';
import { resolveModel, runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { configuredSkillPaths, discoverSkills, resolveSkillPlan } from '../skills/registry.js';
import { resolveSkillPermissionMap, resolveSkillToolEnabled } from '../skills/permissions.js';
import { createTask, createWorker, applyWorkerResult, beginWorkerAttempt, workerFingerprint } from '../worker/worker-runtime.js';
import { workerHandoffText } from './contracts.js';
import { createChildSession, sendPromptAsync, abortSession } from '../../opencode/client-adapter.js';
import { NativeOpenCodeAdapter } from '../../opencode/native-adapter.js';
import { detectOpenCodeCapabilities } from '../../opencode/capabilities.js';
import { appendLedger } from '../ledger/ledger.js';
import { addEvidence, markMutation } from '../evidence/evidence-runtime.js';
import { parallelSafety } from '../scheduler/parallel-safety.js';
import { routeCapabilities } from '../routing/capability-router.js';
import { replanVerificationForChangedSurface, verificationEconomyInstruction, verificationSatisfied } from '../verification/policy.js';
import { targetedVerificationHint } from '../verification/discovery.js';
import { collectRepoContext } from '../intent/repo-context.js';
import { activateMethodologySignal, bindMethodologyNeeds, methodologyNames } from '../methodology/activation.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { methodologyExitCheck, reconcileMethodologyExits } from '../methodology/exit.js';
import { changedSurfaceMethodologySignals, verificationMethodologySignals, workerResultMethodologySignals } from '../methodology/signals.js';
import { methodologyProvenance, ownershipContract } from '../skills/methodology.js';
import { DEFAULT_CONTEXT_BUDGET, clipList, clipText } from '../context/budget.js';
import { modelQuirks } from '../routing/model-quirks.js';
import { runtimeSignal } from '../events/event-sink.js';
import { syncMissionGates } from '../gates/gates.js';
import { classifyWorkerFailure } from '../worker/failure-classifier.js';
import { assessDiffOwnership } from './diff-ownership.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { evaluateTaskPreconditions, TaskPreconditionError } from '../readiness/preconditions.js';
import { effectiveExecutionSurface, promptToolOverrides } from '../routing/execution-profile.js';
import { redactProviderContext } from '../privacy/boundary.js';
import { ProjectMethodologyLearningStore } from '../project-intelligence/methodology-learning.js';
import { executionProfileFor } from '../../config/execution-policy.js';
import { applyAdmittedProjectMethodologyPermissions } from '../methodology/host-permissions.js';
import { isHiChildRole, isHiReadOnlyChildRole, isHiReviewerRole, roleCanOwnObligation } from '../roles/catalog.js';
import { renderSemanticContext, typescriptSemanticContextsForTargets } from '../semantic/typescript-context.js';
import { ProjectIntelligenceStore } from '../project-intelligence/store.js';
import { ContextArtifactStore } from '../context/artifact-store.js';
import { reviewFindingMarker, reviewFindingNeedsCorrection } from '../../contracts/review-finding.js';
import { openHumanDecision } from '../human-decision/runtime.js';
import { reconcileModelExecutionIdentity } from '../../contracts/model.js';
const CATEGORIES = new Set(['quick', 'standard', 'deep', 'visual', 'critical']);
const MAX_QUEUE = 32;
function missionModelFeedback(m) {
    const failures = {}, successes = {}, retries = {};
    const inc = (r, id, n = 1) => { if (id)
        r[id] = (r[id] ?? 0) + n; };
    for (const w of m.workers) {
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
function inferObligationIds(m, role, requiredEvidence, explicit = []) {
    const requested = [...new Set(explicit)].map(id => m.obligations.find(o => o.id === id && o.status === 'open')).filter(Boolean);
    const disallowed = requested.filter(o => !roleCanOwnObligation(role, o.kind));
    if (disallowed.length)
        throw new Error(`Role ${role} cannot own obligation(s): ${disallowed.map(o => `${o.id}:${o.kind}`).join(', ')}`);
    if (requested.length)
        return requested.map(o => o.id);
    const kinds = [];
    if (role === 'coder')
        kinds.push('implementation');
    if (['repository-explorer', 'architect'].includes(role) || role === 'coder' && ['bug-fix', 'performance'].includes(m.intent.taskKind))
        kinds.push('analysis');
    if (isHiReviewerRole(role))
        kinds.push('review');
    if (requiredEvidence.length)
        kinds.push('verification');
    const out = [];
    for (const kind of [...new Set(kinds)].filter(k => roleCanOwnObligation(role, k))) {
        const candidates = m.obligations.filter(o => o.kind === kind && o.status === 'open');
        if (candidates.length === 1)
            out.push(candidates[0].id);
    }
    return [...new Set(out)];
}
function resultDigest(result) { return createHash('sha256').update(JSON.stringify(result)).digest('hex'); }
function providerOf(model) { return model && model !== 'host-default' && model.includes('/') ? model.slice(0, model.indexOf('/')) : undefined; }
function normFile(value) { return value.trim().replace(/\\/g, '/').replace(/^\.\//, ''); }
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
function diffDelta(before, after) { const b = before ?? {}; return Object.keys(after).filter(file => b[file] !== after[file]); }
export class TaskRuntime {
    client;
    registry;
    scheduler;
    projectRoot;
    hiRoot;
    getConfig;
    getModels;
    getHostConfig;
    events;
    lifecycle;
    #queue = [];
    #draining = false;
    #methodologyLearning;
    constructor(client, registry, scheduler, projectRoot, hiRoot, getConfig, getModels, getHostConfig, events, lifecycle = {}) {
        this.client = client;
        this.registry = registry;
        this.scheduler = scheduler;
        this.projectRoot = projectRoot;
        this.hiRoot = hiRoot;
        this.getConfig = getConfig;
        this.getModels = getModels;
        this.getHostConfig = getHostConfig;
        this.events = events;
        this.lifecycle = lifecycle;
        this.#methodologyLearning = new ProjectMethodologyLearningStore(projectRoot);
    }
    async sendProviderPrompt(sessionID, text, role, model, variant, tools) { const safe = redactProviderContext(text); return sendPromptAsync(this.client, sessionID, safe.providerText, role, model, variant, tools); }
    recordModelProjection(worker, model, variant) { worker.projected_model = model ?? 'host-default'; worker.projected_model_variant = variant; worker.updated_at = Date.now(); }
    async abortNativeSession(m, sessionID, reason, workerID, taskID) { const transport = await abortSession(this.client, sessionID, this.lifecycle); appendLedger(m, 'worker.session-abort', { task_id: taskID, worker_id: workerID, payload: { session_id: sessionID, reason, transport } }); return transport !== 'unavailable'; }
    async captureNativeDiff(worker, phase) {
        if (!worker.session_id)
            return undefined;
        const native = new NativeOpenCodeAdapter(this.client);
        if (!native.has('diff'))
            return undefined;
        try {
            const map = nativeDiffMap(await native.diff(worker.session_id));
            if (phase === 'baseline')
                worker.native_diff_baseline = map;
            else
                worker.native_diff_final = map;
            return map;
        }
        catch {
            return undefined;
        }
    }
    async reconcileNativeResult(m, workerID, result) {
        const worker = m.workers.find(w => w.id === workerID);
        if (!worker)
            return result;
        const task = m.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return result;
        const final = await this.captureNativeDiff(worker, 'final');
        const baseline = worker.native_diff_baseline ?? {};
        const nativeDelta = final ? diffDelta(baseline, final) : [];
        const reportedRaw = [...new Set((result.changed_files ?? []).map(normFile).filter(Boolean))];
        const observedRaw = [...new Set((worker.write_set ?? []).map(normFile).filter(Boolean))];
        // Session diff can contain user-owned dirty files that existed before this worker started.
        // A file whose native diff signature is identical to the worker baseline is not part of the
        // worker's net delta, even if the worker self-reports it or briefly touched and restored it.
        // This prevents Hi cleanup from stealing/reverting pre-existing user work.
        const preservedPreexisting = final ? reportedRaw.filter(file => baseline[file] !== undefined && final[file] === baseline[file]) : [];
        const reported = reportedRaw.filter(file => !preservedPreexisting.includes(file));
        const observed = final ? observedRaw.filter(file => !(baseline[file] !== undefined && final[file] === baseline[file])) : observedRaw;
        if (preservedPreexisting.length)
            appendLedger(m, 'user-diff.preserved', { task_id: task.id, worker_id: worker.id, payload: { files: preservedPreexisting.slice(0, 40), policy: 'baseline-owned-by-user' } });
        const previousCollateral = [...new Set((task.diff_cleanliness?.collateral ?? []).map(normFile).filter(Boolean))];
        if (previousCollateral.length) {
            if (!final) {
                const marker = `cleanup-unverified:${task.id}:${previousCollateral.slice(0, 12).sort().join(',')}`;
                appendLedger(m, 'diff.cleanup.unverified', { task_id: task.id, worker_id: worker.id, payload: { files: previousCollateral.slice(0, 40), reason: 'native-diff-unavailable' } });
                return { ...result, status: 'FIX_REQUIRED', summary: `Cleanup cannot be accepted without native diff evidence. Verify that collateral files are restored before completion: ${previousCollateral.slice(0, 12).join(', ')}.`, open_issues: [...new Set([...(result.open_issues ?? []), marker])], needs_context: [...new Set([...(result.needs_context ?? []), 'cleanup-verification: native/session diff evidence is unavailable; do not claim collateral revert as complete until current diff can be deterministically verified'])] };
            }
            const stillDirty = previousCollateral.filter(file => baseline[file] !== final[file]);
            if (stillDirty.length) {
                const marker = `cleanup-not-reverted:${task.id}:${stillDirty.slice(0, 12).sort().join(',')}`;
                appendLedger(m, 'diff.cleanup.failed', { task_id: task.id, worker_id: worker.id, payload: { files: stillDirty.slice(0, 40) } });
                return { ...result, status: 'FIX_REQUIRED', summary: `Worker reported cleanup, but native diff still shows collateral changes: ${stillDirty.slice(0, 12).join(', ')}.`, changed_files: [...new Set([...reported, ...stillDirty])], open_issues: [...new Set([...(result.open_issues ?? []), marker])], needs_context: [...new Set([...(result.needs_context ?? []), 'cleanup-verification: inspect native/session diff and actually revert remaining collateral changes before reporting DONE'])] };
            }
            task.diff_cleanliness = { collateral: [...(task.diff_cleanliness?.collateral ?? [])], accepted_expansions: [...(task.diff_cleanliness?.accepted_expansions ?? [])], native_verified_reverts: [...previousCollateral] };
            appendLedger(m, 'diff.cleanup.verified', { task_id: task.id, worker_id: worker.id, payload: { reverted: previousCollateral.slice(0, 40), source: 'native-session-diff-baseline' } });
        }
        const activeWriters = m.workers.filter(w => !isHiReadOnlyChildRole(w.role) && ['starting', 'busy'].includes(w.status));
        const soleWriter = activeWriters.length <= 1 || activeWriters.every(w => w.id === worker.id);
        const attributedNative = nativeDelta.filter(file => observed.includes(file) || task.scope.map(normFile).includes(file) || (soleWriter && !reported.includes(file)));
        const actual = [...new Set([...observed, ...attributedNative])];
        const missing = actual.filter(file => !reported.includes(file));
        if (!missing.length) {
            if (final)
                appendLedger(m, 'native.diff.reconciled', { task_id: task.id, worker_id: worker.id, payload: { reported: reported.length, observed: observed.length, native_delta: nativeDelta.length, sole_writer: soleWriter } });
            return { ...result, changed_files: reported };
        }
        const marker = `native-diff-mismatch:${task.id}:${missing.slice(0, 12).sort().join(',')}`;
        appendLedger(m, 'native.diff.mismatch', { task_id: task.id, worker_id: worker.id, payload: { missing: missing.slice(0, 40), reported: reported.slice(0, 40), observed: observed.slice(0, 40), native_delta: nativeDelta.slice(0, 40), sole_writer: soleWriter } });
        return { ...result, status: 'FIX_REQUIRED', summary: `Native/session write evidence disagrees with WorkerResult changed_files. Reconcile before completion: ${missing.slice(0, 12).join(', ')}.`, changed_files: [...new Set([...reported, ...actual])], open_issues: [...new Set([...(result.open_issues ?? []), marker])], needs_context: [...new Set([...(result.needs_context ?? []), 'native-diff-reconcile: inspect the current native/session diff and return a complete changed_files list; do not conceal or silently discard writes'])] };
    }
    noteEffectiveModel(m, workerID, observed) {
        const worker = m.workers.find(w => w.id === workerID);
        if (!worker)
            return { ok: false, reason: 'worker-not-found' };
        const task = m.tasks.find(t => t.id === worker.task_id), expected = worker.model, expectedVariant = worker.model_variant, taskID = task?.id ?? worker.task_id;
        const clearModelMarkers = () => { m.blockers = m.blockers.filter(b => !b.startsWith(`model-projection-mismatch:${taskID}:`) && !b.startsWith(`model-effective-unverified:${taskID}:`) && !b.startsWith(`model-effective-mismatch:${taskID}:`) && !b.startsWith(`model-variant-unverified:${taskID}:`) && !b.startsWith(`model-variant-mismatch:${taskID}:`)); };
        const requested = (worker.requested_model || worker.requested_model_variant) ? { model: worker.requested_model, variant: worker.requested_model_variant, source: 'task-override' } : undefined;
        const selected = (worker.model || worker.model_variant) ? { model: worker.model, variant: worker.model_variant, source: 'runtime-resolver/current-worker-selection' } : undefined;
        const projected = (worker.projected_model || worker.projected_model_variant) ? { model: worker.projected_model, variant: worker.projected_model_variant, source: 'opencode-child-or-prompt' } : undefined;
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
            m.blockers.push(marker);
            appendLedger(m, 'model.projection.mismatch', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, selected_variant: expectedVariant, projected_variant: worker.projected_model_variant } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        if (identity.status === 'model-unverified') {
            const marker = `model-effective-unverified:${taskID}:${expected}`;
            if (!m.blockers.includes(marker))
                m.blockers.push(marker);
            appendLedger(m, 'model.effective.unverified', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, expected_variant: expectedVariant, source: worker.effective_model_source } });
            return { ok: false, expected, reason: marker };
        }
        if (identity.status === 'model-mismatch') {
            const marker = `model-effective-mismatch:${taskID}:${expected}->${observed?.model}`;
            clearModelMarkers();
            m.blockers.push(marker);
            appendLedger(m, 'model.effective.mismatch', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, observed: observed?.model, expected_variant: expectedVariant, variant: observed?.variant, source: worker.effective_model_source } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        if (identity.status === 'variant-unverified') {
            const marker = `model-variant-unverified:${taskID}:${expectedVariant}`;
            clearModelMarkers();
            m.blockers.push(marker);
            appendLedger(m, 'model.variant.unverified', { task_id: task?.id, worker_id: worker.id, payload: { model: expected, projected: worker.projected_model, expected_variant: expectedVariant, projected_variant: worker.projected_model_variant, source: worker.effective_model_source } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        if (identity.status === 'variant-mismatch') {
            const marker = `model-variant-mismatch:${taskID}:${expectedVariant}->${observed?.variant}`;
            clearModelMarkers();
            m.blockers.push(marker);
            appendLedger(m, 'model.variant.mismatch', { task_id: task?.id, worker_id: worker.id, payload: { model: expected, projected: worker.projected_model, expected_variant: expectedVariant, projected_variant: worker.projected_model_variant, observed_variant: observed?.variant, source: worker.effective_model_source } });
            return { ok: false, expected, observed: observed?.model, reason: marker };
        }
        clearModelMarkers();
        appendLedger(m, 'model.effective.verified', { task_id: task?.id, worker_id: worker.id, payload: { requested: worker.requested_model, selected: expected, projected: worker.projected_model, observed: observed?.model, expected_variant: expectedVariant, projected_variant: worker.projected_model_variant, variant: observed?.variant, variant_verified: identity.variantVerified, source: worker.effective_model_source } });
        return { ok: true, expected, observed: observed?.model, reason: expectedVariant ? 'effective-model-and-variant-match-runtime-selection' : 'effective-model-matches-runtime-selection' };
    }
    queueDepth() { return this.#queue.length; }
    depsReady(m, deps) { return deps.every(id => m.tasks.find(t => t.id === id)?.status === 'completed'); }
    failedDeps(m, deps) { return deps.filter(id => { const status = m.tasks.find(t => t.id === id)?.status; return status === 'failed' || status === 'cancelled'; }); }
    canRun(m, worker, chain) { if (m.status !== 'active' || m.user_interrupted || m.semantic_assessment.status !== 'assessed' || worker.status === 'cancelled')
        return false; if (!this.depsReady(m, m.tasks.find(t => t.id === worker.task_id)?.dependencies ?? []))
        return false; const active = m.workers.filter(w => w.id !== worker.id && ['starting', 'busy'].includes(w.status)).length; if (m.execution_mode === 'single' && active > 0)
        return false; if (m.execution_mode === 'parallel' && active >= Math.max(1, m.topology?.parallelism ?? 1))
        return false; return chain.some(model => this.scheduler.canStart(worker.id, providerOf(model), model === 'host-default' ? undefined : model).ok); }
    queueTask(m, worker, run) { if (this.#queue.length >= MAX_QUEUE)
        throw new Error('Hi bounded dispatch queue is full'); const t = m.tasks.find(x => x.id === worker.task_id); worker.status = 'queued'; if (t)
        t.status = 'queued'; if (!this.#queue.some(x => x.worker.id === worker.id))
        this.#queue.push({ mission: m, worker, run, created: Date.now() }); this.registry.set(worker); appendLedger(m, 'worker.queued', { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length } }); void this.events?.(runtimeSignal('worker.queued', m.mission_id, { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length } })); syncMissionGates(m); }
    drainQueue() { if (this.#draining)
        return; this.#draining = true; queueMicrotask(async () => { try {
        let progress = true;
        while (progress) {
            progress = false;
            for (let i = 0; i < this.#queue.length; i++) {
                const e = this.#queue[i], t = e.mission.tasks.find(x => x.id === e.worker.task_id), chain = [e.worker.model, ...e.worker.fallbacks].filter((x) => Boolean(x));
                if (e.mission.status !== 'active' || e.mission.user_interrupted || e.worker.status === 'cancelled') {
                    this.#queue.splice(i--, 1);
                    continue;
                }
                if (!t) {
                    this.#queue.splice(i--, 1);
                    continue;
                }
                const failed = this.failedDeps(e.mission, t.dependencies);
                if (failed.length) {
                    this.#queue.splice(i--, 1);
                    e.worker.status = 'failed';
                    t.status = 'blocked';
                    t.updated_at = Date.now();
                    const reason = `dependency-unavailable:${failed.join(',')}`;
                    t.result = { status: 'BLOCKED', summary: 'Required dependency did not complete successfully.', changed_files: [], evidence: [], open_issues: [reason], needs_context: [] };
                    e.mission.blockers = [...new Set([...e.mission.blockers, reason])];
                    this.registry.delete(e.worker.id);
                    appendLedger(e.mission, 'worker.dependency-blocked', { task_id: t.id, worker_id: e.worker.id, payload: { dependencies: failed } });
                    void this.events?.(runtimeSignal('worker.dependency-blocked', e.mission.mission_id, { task_id: t.id, worker_id: e.worker.id, payload: { dependencies: failed } }));
                    syncMissionGates(e.mission);
                    progress = true;
                    continue;
                }
                if (!this.depsReady(e.mission, t.dependencies) || !this.canRun(e.mission, e.worker, chain))
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
        if (m.status !== 'active' || m.user_interrupted)
            throw new Error('Mission is not active');
        if (m.semantic_assessment.status !== 'assessed')
            throw new Error('Hi semantic assessment is pending; assess mission intent before starting a worker');
        const objective = input.objective?.trim() || m.objective;
        const taskIntent = m.intent;
        const cfg = this.getConfig(), routingProfile = cfg.profile[executionProfileFor(cfg.executionPolicy, taskIntent)], routed = routeCapabilities(taskIntent, { specialistThreshold: routingProfile.specialistThreshold, reviewThreshold: routingProfile.reviewThreshold }), defaultCategory = resolveCategory(taskIntent), category = (CATEGORIES.has(String(input.category)) ? input.category : (routed.category ?? defaultCategory)), defaultRole = isHiChildRole(routed.role) ? routed.role : 'coder', role = isHiChildRole(String(input.role)) ? String(input.role) : defaultRole;
        const hostConfig = this.getHostConfig();
        applyAdmittedProjectMethodologyPermissions(hostConfig, this.projectRoot);
        const feedback = missionModelFeedback(m), selected = resolveModel(category, this.getModels(), this.getConfig(), input.model, role, hostConfig, feedback);
        if (selected.rejected.length)
            appendLedger(m, 'model.policy.rejected', { payload: { items: selected.rejected.slice(0, 20) } });
        if (selected.scores?.length)
            appendLedger(m, 'model.scored', { payload: { role, category, top: selected.scores.slice(0, 6), feedback } });
        const taskMethodologyNeeds = m.methodology_needs.filter(need => (!need.task_id && !need.obligation_id) || (need.obligation_id && input.obligationIds?.includes(need.obligation_id))), catalog = methodologyCatalog(this.projectRoot), candidates = discoverSkills(this.projectRoot, this.hiRoot, configuredSkillPaths(hostConfig)), permissionMap = resolveSkillPermissionMap(hostConfig, role), skillToolEnabled = resolveSkillToolEnabled(hostConfig, role), surface = effectiveExecutionSurface(hostConfig, role, skillToolEnabled), hostCapabilities = detectOpenCodeCapabilities(this.client).contracts, availableResources = new Set(hostCapabilities.filter(item => item.status === 'SUPPORTED').map(item => `host-capability:${item.id}`)), skillPlan = resolveSkillPlan(methodologyNames(taskMethodologyNeeds), candidates, permissionMap, skillToolEnabled, role, catalog, availableResources), methodologies = skillPlan.selected.map(s => s.name), methodologyResourceFailures = skillPlan.outcomes.filter(item => item.outcome === 'resource-unavailable').map(item => item.name);
        appendLedger(m, 'skill.resolved', { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } });
        void this.events?.(runtimeSignal('skill.resolved', m.mission_id, { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } }));
        if (skillPlan.missing.length)
            appendLedger(m, 'skill.fallback', { payload: { missing: skillPlan.missing, requested: skillPlan.requested, skillToolEnabled } });
        const scope = input.scope ?? (isHiReadOnlyChildRole(role) && m.changed_files.length ? m.changed_files : taskIntent.likelyTargets ?? []), dependencies = [...new Set(input.dependencies ?? [])];
        const unknownDependencies = dependencies.filter(id => !m.tasks.some(t => t.id === id)), unavailableDependencies = this.failedDeps(m, dependencies), incompleteDependencies = dependencies.filter(id => { const t = m.tasks.find(x => x.id === id); return Boolean(t) && t.status !== 'completed' && !unavailableDependencies.includes(id); });
        const requiredEvidence = input.requiredEvidence ?? m.verification_policy.requiredKinds, obligationIds = inferObligationIds(m, role, requiredEvidence, input.obligationIds), constraints = [...new Set([...(m.constraints ?? []), ...(input.constraints ?? [])])], desiredFingerprint = workerFingerprint(role, category, selected.primary, taskIntent.taskKind, objective, { scope, constraints, dependencies, requiredEvidence, obligationIds }), existing = m.workers.find(w => w.fingerprint === desiredFingerprint && !['completed', 'failed', 'cancelled'].includes(w.status));
        const native = new NativeOpenCodeAdapter(this.client), resumeCapable = Boolean(existing?.session_id), preflight = evaluateTaskPreconditions({ role, implementation: role === 'coder', dependencies: { unknown: unknownDependencies, failed: unavailableDependencies, incomplete: incompleteDependencies }, modelAvailable: Boolean(selected.primary), native: { childSession: resumeCapable || native.has('session-create'), prompt: native.has('prompt-async') || native.has('prompt-sync') }, hostConfig, methodologyResourceFailures, contractCriticalAmbiguity: m.intent.ambiguity === 'contract-critical', authorityRequired: false });
        appendLedger(m, 'task.preflight', { payload: { role, decision: preflight.decision, resume_capable: resumeCapable, items: preflight.items.slice(0, 12) } });
        void this.events?.(runtimeSignal('task.preflight', m.mission_id, { payload: { role, decision: preflight.decision, resume_capable: resumeCapable, items: preflight.items.slice(0, 12) } }));
        if (preflight.decision === 'RESOLVE' || preflight.decision === 'USER_ACTION_REQUIRED')
            throw new TaskPreconditionError(preflight);
        if (existing) {
            const oldTask = m.tasks.find(t => t.id === existing.task_id);
            if (existing.status === 'ready' && existing.session_id && oldTask?.result && ['FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED'].includes(oldTask.result.status)) {
                const chain = [selected.primary, ...selected.fallbacks].filter((x) => Boolean(x)), nextModel = chain.find(model => this.scheduler.canStart(existing.id, providerOf(model), model === 'host-default' ? undefined : model).ok) ?? existing.model;
                if (!nextModel)
                    throw new Error('Worker resume capacity unavailable');
                const previousModel = existing.model;
                this.scheduler.acquire(existing.id, providerOf(nextModel), nextModel === 'host-default' ? undefined : nextModel);
                existing.model = nextModel;
                existing.generation_at_spawn = m.generation;
                existing.status = 'busy';
                existing.started_at = Date.now();
                oldTask.status = 'running';
                this.registry.set(existing);
                const issues = oldTask.result.open_issues.join(' | '), missing = oldTask.result.needs_context.join(' | '), reviewScope = isHiReadOnlyChildRole(existing.role) ? `Scoped rereview only: previous findings=${issues || 'none'}; changed scope=${m.changed_files.slice(-20).join(',') || 'none'}; affected evidence=${m.evidence.items.filter(e => !e.invalidated_at).slice(-8).map(e => e.summary).join(' | ') || 'none'}.` : '', resumeExitRequirements = existing.selected_methodologies.flatMap(name => { const item = catalog.find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const resumeVariant = nextModel === selected.primary ? selected.primaryVariant : selected.fallbackVariants[nextModel];
                const protectedBaseline = Object.keys(existing.native_diff_baseline ?? {}).slice(0, 60);
                beginWorkerAttempt(oldTask, existing);
                this.recordModelProjection(existing, nextModel, resumeVariant);
                await this.sendProviderPrompt(existing.session_id, clipText([`Hi corrective resume for existing task ${oldTask.id}.`, `Previous status: ${oldTask.result.status}.`, `Missing context: ${missing || 'none'}.`, `Open issues: ${issues || 'none'}.`, `Current user constraints: ${(oldTask.constraints ?? []).join(' | ') || 'none'}.`, `METHODOLOGY EXIT REQUIREMENTS: ${resumeExitRequirements.join(' | ') || 'none'}.`, protectedBaseline.length ? `PRE-EXISTING USER DIRTY BASELINE: ${protectedBaseline.join(', ')}. Cleanup means restore these paths to their exact worker-start baseline, NOT to HEAD. Never discard user-owned edits with git checkout/reset/restore.` : 'Pre-existing user dirty baseline: none observed.', reviewScope, 'Resume from current session context. Apply the smallest correction. Do not restart planning or create sub-orchestrators. Return the structured WorkerResult again.'].filter(Boolean).join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), existing.role, nextModel === 'host-default' ? undefined : nextModel, resumeVariant, promptToolOverrides(oldTask.execution_profile?.tools ?? []));
                existing.model_variant = resumeVariant;
                existing.restart_reconcile_pending = false;
                appendLedger(m, nextModel !== previousModel ? 'worker.model-escalated' : 'worker.resumed', { task_id: oldTask.id, worker_id: existing.id, payload: { status: oldTask.result.status, model: nextModel } });
            }
            return { task_id: oldTask?.id ?? existing.task_id, worker_id: existing.id, session_id: existing.session_id, model: existing.model, methodologies: existing.selected_methodologies, selection_reason: ['same-session worker reuse'], readiness: 'READY', preconditions: preflight.items };
        }
        const safety = parallelSafety(m.tasks, { scope, dependencies, role }), hardParallelConflicts = safety.reasons.filter(reason => !reason.startsWith('dependency:'));
        if (hardParallelConflicts.length && m.tasks.some(t => ['queued', 'running'].includes(t.status)))
            throw new Error(`Unsafe parallel dispatch: ${hardParallelConflicts.join('; ')}`);
        const requestedArtifactIds = [...new Set(input.contextArtifactIds ?? [])].slice(0, DEFAULT_CONTEXT_BUDGET.max_artifacts), unknownArtifactIds = requestedArtifactIds.filter(id => !m.context_artifacts.some(a => a.id === id));
        if (unknownArtifactIds.length)
            throw new Error(`Unknown context artifact id(s): ${unknownArtifactIds.join(', ')}`);
        const contextArtifactStore = new ContextArtifactStore(this.projectRoot), selectedContextHandles = requestedArtifactIds.map(id => m.context_artifacts.find(a => a.id === id)).filter(Boolean), selectedContextReferences = selectedContextHandles.map(a => { const durableId = a.uri?.startsWith('hi-artifact:') ? a.uri.slice('hi-artifact:'.length) : undefined, stored = durableId ? contextArtifactStore.get(durableId) : undefined; return { source_ref: a.uri ?? `mission-context:${a.id}`, reason: 'explicit-task-selection', priority: 'normal', protection: 'COMPRESSIBLE', budget_cost: stored ? Math.min(stored.content.length, 3000) : Math.min((a.summary ?? a.title ?? a.kind).length, 3000), freshness: stored?.freshness ?? 'UNKNOWN', retention: 'task', privacy_class: stored?.privacy_class ?? 'project-private', kind: a.kind, title: a.title, summary: a.summary, content_hash: stored?.content_hash ?? a.sha256, source_handle_id: a.id }; });
        const approvalGated = skillPlan.selected.filter(s => s.permission === 'ask').map(s => s.name), taskTools = surface.tools.filter(t => t !== 'skill' || methodologies.length > 0);
        const profile = { role, category, task: { objective, scope: [...scope], dependencies: [...dependencies], required_evidence: [...requiredEvidence] }, tools: taskTools, model: selected.primary, model_variant: input.modelVariant ?? selected.primaryVariant, fallback_models: selected.fallbacks, fallback_variants: selected.fallbackVariants, fallback_reasons: selected.fallbackReasons, methodologies, permission_profile: { skill_tool_enabled: skillToolEnabled, skill_permissions: permissionMap ?? {}, external_effects: 'parent-only', recursive_task: 'deny', native: surface.permissions }, verification_policy: { ...m.verification_policy, requiredKinds: [...m.verification_policy.requiredKinds] }, max_context_chars: DEFAULT_CONTEXT_BUDGET.max_context_chars, max_handoff_chars: DEFAULT_CONTEXT_BUDGET.max_handoff_chars, max_result_chars: DEFAULT_CONTEXT_BUDGET.max_result_chars, max_artifacts: DEFAULT_CONTEXT_BUDGET.max_artifacts };
        const task = createTask(m, { objective, role, category, scope, constraints, dependencies, requiredEvidence, obligationIds, contextReferences: selectedContextReferences, executionProfile: profile });
        bindMethodologyNeeds(m, methodologies, { taskId: task.id, obligationIds: task.obligation_ids });
        const provenance = methodologyProvenance(skillPlan.selected), worker = createWorker(m, task, selected.primary, selected.fallbacks, methodologies, provenance);
        worker.requested_model = input.model;
        worker.requested_model_variant = input.modelVariant;
        worker.model_selection_reason = [...selected.reason];
        worker.fallback_history = [];
        for (const ref of task.context_artifacts)
            if (ref.source_ref.startsWith('hi-artifact:'))
                contextArtifactStore.bindConsumer(ref.source_ref.slice('hi-artifact:'.length), task.id);
        const quirks = modelQuirks(selected.primary, this.getModels().find(x => x.id === selected.primary));
        const artifactContext = task.context_artifacts.map(a => { const id = a.source_ref.startsWith('hi-artifact:') ? a.source_ref.slice('hi-artifact:'.length) : undefined, stored = id ? contextArtifactStore.get(id) : undefined; if (stored?.freshness === 'FRESH')
            return `artifact:${stored.artifact_id}:${stored.summary}\n${clipText(stored.content, 3000)}`; if (stored)
            return `artifact-stale:${stored.artifact_id}:${stored.summary}`; return `${a.kind}:${a.title ?? a.source_handle_id ?? a.id}${a.summary ? ` — ${a.summary}` : ''}`; }), verificationHint = targetedVerificationHint(this.projectRoot, task.scope.length ? task.scope : (m.changed_files.length ? m.changed_files : m.intent.likelyTargets ?? [])), semanticContexts = typescriptSemanticContextsForTargets(this.projectRoot, task.scope, task.id, 3000), semanticContext = semanticContexts.map(renderSemanticContext), projectIntelligence = new ProjectIntelligenceStore(this.projectRoot).relevantToFiles(task.scope, 'task-context', 4), projectContext = projectIntelligence.map(p => `project-intelligence:${p.id}:${p.statement} [${p.source_refs.map(x => x.ref.slice(5)).join(', ')}]`), explicitRelevant = input.relevantContext ?? [], boundedRuntimeRelevant = [...(verificationHint ? [verificationHint] : []), ...semanticContext, ...projectContext, ...artifactContext];
        if (semanticContexts.length)
            appendLedger(m, 'context.semantic-selected', { task_id: task.id, payload: { items: semanticContexts.slice(0, 6).map(x => ({ id: x.id, source_ref: x.source_ref, source_hash: x.source_hash.slice(0, 16), symbols: x.symbols.length, chars: x.budget.used_chars })), total_chars: semanticContexts.reduce((n, x) => n + x.budget.used_chars, 0) } });
        if (projectIntelligence.length)
            appendLedger(m, 'context.project-intelligence-selected', { task_id: task.id, payload: { consumer: 'task-context', items: projectIntelligence.map(x => ({ id: x.id, confidence: x.confidence, source_refs: x.source_refs.map(s => s.ref) })) } });
        let nativeSummary, relevantForHandoff = [...explicitRelevant, ...boundedRuntimeRelevant];
        if (relevantForHandoff.join('\n').length > profile.max_context_chars) {
            const native = new NativeOpenCodeAdapter(this.client);
            if (native.has('summarize'))
                try {
                    const summary = await native.summarize(m.session_id);
                    nativeSummary = clipText(typeof summary === 'string' ? summary : JSON.stringify(summary), Math.min(6000, Math.floor(profile.max_context_chars / 2)));
                    relevantForHandoff = [`native-session-summary:${nativeSummary}`, ...boundedRuntimeRelevant];
                    appendLedger(m, 'context.native-summary-used', { task_id: task.id, payload: { source_session: m.session_id, replaced_explicit_context: true } });
                }
                catch (error) {
                    appendLedger(m, 'context.native-summary-unavailable', { task_id: task.id, payload: { error: String(error) } });
                }
            ;
            if (!nativeSummary)
                relevantForHandoff = clipList(relevantForHandoff, profile.max_context_chars);
        }
        const buildHandoff = () => { const preexisting = Object.keys(worker.native_diff_baseline ?? {}).slice(0, 60), core = workerHandoffText({ objective, scope: task.scope, constraints: clipList([...(task.constraints ?? []), 'minimum sufficient change', 'no unrequested publish/push/deploy', 'return compact evidence', preexisting.length ? `pre-existing user dirty paths at worker start: ${preexisting.join(', ')}; preserve their exact baseline state unless the task explicitly requires changing them; never use git checkout/reset/restore in a way that discards user-owned edits` : 'no pre-existing native dirty paths were observed at worker start', verificationEconomyInstruction(m), `model-quirks:${JSON.stringify(quirks)}`], 5000), required_evidence: task.requiredEvidence, relevant_context: clipList(relevantForHandoff, profile.max_context_chars), methodologies: worker.selected_methodologies, methodology_exit_requirements: worker.selected_methodologies.flatMap(name => { const item = catalog.find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; }), approval_gated_methodologies: approvalGated, expected_output: { status: true, summary: true, changed_files: true, scope_expansions: true, evidence: true, findings: isHiReviewerRole(worker.role) ? true : undefined, open_issues: true } }, profile.max_handoff_chars), full = [ownershipContract('child', worker.selected_methodologies), core].filter(Boolean).join('\n\n'); return clipText(full, profile.max_handoff_chars); };
        const chain = [selected.primary, ...selected.fallbacks].filter((x) => Boolean(x)), toolOverrides = promptToolOverrides(profile.tools);
        const run = () => this.registry.dedupeSpawn(worker.fingerprint, async () => { let lastError = new Error('No runtime model available'); for (let i = 0; i < chain.length; i++) {
            if (m.status !== 'active' || m.user_interrupted || worker.status === 'cancelled') {
                worker.status = 'cancelled';
                task.status = 'cancelled';
                throw new Error('Mission stopped before worker dispatch');
            }
            const model = chain[i], variant = model === selected.primary ? (input.modelVariant ?? selected.primaryVariant) : selected.fallbackVariants[model], provider = providerOf(model), runtimeCandidate = runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig());
            if (!runtimeCandidate.ok) {
                lastError = new Error(`Runtime model candidate rejected at dispatch: ${model}: ${runtimeCandidate.reason}`);
                appendLedger(m, 'model.fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: runtimeCandidate.reason, index: i, phase: 'dispatch-revalidation' } });
                continue;
            }
            const capacity = this.scheduler.canStart(worker.id, provider, model === 'host-default' ? undefined : model);
            if (!capacity.ok) {
                lastError = new Error(`Worker capacity unavailable: ${capacity.reason}`);
                appendLedger(m, 'model.fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: capacity.reason, index: i } });
                continue;
            }
            this.scheduler.acquire(worker.id, provider, model === 'host-default' ? undefined : model);
            worker.model = model;
            worker.model_variant = variant;
            try {
                worker.status = 'starting';
                task.status = 'queued';
                const native = new NativeOpenCodeAdapter(this.client);
                const canFork = false;
                this.recordModelProjection(worker, model, variant);
                const child = input.forkFromSession && canFork && native.has('fork') ? await native.fork(input.forkFromSession, `Hi · ${role} · ${objective.slice(0, 60)}`) : await createChildSession(this.client, m.session_id, `Hi · ${role} · ${objective.slice(0, 60)}`, role, model === 'host-default' ? undefined : model, variant);
                if (input.forkFromSession)
                    appendLedger(m, 'worker.session-fork', { task_id: task.id, worker_id: worker.id, payload: { source_session: input.forkFromSession, native: native.has('fork'), used: false, reason: 'native fork cannot set specialist agent; created isolated child instead' } });
                if (m.status !== 'active' || m.user_interrupted || worker.status === 'cancelled') {
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
                recordPreexistingUserBaseline(m, await this.captureNativeDiff(worker, 'baseline'));
                worker.generation_at_spawn = m.generation;
                worker.status = 'busy';
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                if (i > 0) {
                    const fallbackReason = selected.fallbackReasons[i - 1]?.reason ?? `fallback-index:${i}`;
                    worker.fallback_history = [...(worker.fallback_history ?? []), { from: chain[i - 1], to: model, variant, reason: fallbackReason, phase: 'dispatch', at: Date.now() }];
                }
                void this.events?.(runtimeSignal('worker.started', m.mission_id, { task_id: task.id, worker_id: worker.id, payload: { model, variant, role } }));
                appendLedger(m, 'worker.started', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, model, variant, index: i, reason: i === 0 ? (input.modelVariant ? [...selected.reason, 'user-specified-variant'] : selected.reason) : [selected.fallbackReasons[i - 1]?.reason ?? 'runtime fallback', `fallback-index:${i}`] } });
                const handoff = buildHandoff();
                appendLedger(m, 'worker.handoff', { task_id: task.id, worker_id: worker.id, payload: { chars: handoff.length, methodologies: worker.selected_methodologies.length, tools: profile.tools.slice(0, 20), permission_source: profile.permission_profile.native?.source, context_budget: profile.max_context_chars, handoff_budget: profile.max_handoff_chars, result_budget: profile.max_result_chars } });
                beginWorkerAttempt(task, worker);
                await this.sendProviderPrompt(worker.session_id, handoff, role, model === 'host-default' ? undefined : model, variant, toolOverrides);
                return worker;
            }
            catch (error) {
                lastError = error;
                this.scheduler.release(worker.id);
                if (worker.session_id) {
                    try {
                        await this.abortNativeSession(m, worker.session_id, 'dispatch-fallback', worker.id, task.id);
                    }
                    catch { }
                    ;
                    worker.session_id = undefined;
                }
                if (m.status !== 'active' || m.user_interrupted || worker.status === 'cancelled') {
                    worker.status = 'cancelled';
                    task.status = 'cancelled';
                    appendLedger(m, 'worker.start.cancelled', { task_id: task.id, worker_id: worker.id, payload: { model, index: i, error: String(error) } });
                    throw error;
                }
                appendLedger(m, 'model.fallback.failed', { task_id: task.id, worker_id: worker.id, payload: { model, index: i, error: String(error) } });
                worker.status = 'created';
                task.status = 'created';
            }
        } worker.status = 'failed'; const liveStatuses = chain.map(model => ({ model, ...runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig()) })); const policyUnavailable = liveStatuses.length > 0 && liveStatuses.every(x => !x.ok); if (policyUnavailable) {
            task.status = 'blocked';
            const marker = `model-dispatch-unavailable:${task.id}`;
            m.blockers = [...new Set([...m.blockers, marker])];
            task.result = { status: 'BLOCKED', summary: 'No selected role model/fallback remains runtime-available and policy-permitted at dispatch time.', changed_files: [], evidence: [], open_issues: [marker], needs_context: ['refresh provider/model inventory or routing/provider permissions'] };
            appendLedger(m, 'worker.start.model-unavailable', { task_id: task.id, worker_id: worker.id, payload: { attempted: liveStatuses } });
        }
        else
            task.status = 'failed'; appendLedger(m, 'worker.start.failed', { task_id: task.id, worker_id: worker.id, payload: { error: String(lastError), attempted_models: chain } }); throw lastError; });
        syncMissionGates(m);
        if (!this.canRun(m, worker, chain)) {
            this.queueTask(m, worker, run);
            return { task_id: task.id, worker_id: worker.id, model: worker.model, methodologies: worker.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), 'queued:runtime-capacity-or-prerequisite', ...skillPlan.reason], readiness: 'WAIT', preconditions: preflight.items };
        }
        const spawned = await run();
        if (spawned.id !== worker.id) {
            const duplicateTask = m.tasks.find(t => t.id === task.id);
            if (duplicateTask && ['created', 'queued'].includes(duplicateTask.status))
                m.tasks = m.tasks.filter(t => t.id !== duplicateTask.id);
            m.workers = m.workers.filter(w => w.id !== worker.id);
            appendLedger(m, 'worker.spawn.deduped', { worker_id: spawned.id, payload: { discarded_worker_id: worker.id, fingerprint: worker.fingerprint } });
            const spawnedTask = m.tasks.find(t => t.id === spawned.task_id);
            return { task_id: spawnedTask?.id ?? spawned.task_id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, 'deduped:existing-spawn', ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
        }
        return { task_id: task.id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
    }
    async pauseForSemanticAssessment(m) {
        if (m.semantic_assessment.status !== 'pending')
            return 0;
        let paused = 0;
        for (const worker of m.workers.filter(w => ['created', 'queued', 'starting', 'ready', 'busy'].includes(w.status))) {
            const task = m.tasks.find(t => t.id === worker.task_id);
            if (!task)
                continue;
            worker.semantic_pause_revision = m.semantic_assessment.revision;
            if (!worker.session_id) {
                worker.status = 'cancelled';
                task.status = 'cancelled';
                this.scheduler.release(worker.id);
                this.registry.delete(worker.id);
                this.#queue = this.#queue.filter(q => q.worker.id !== worker.id);
                appendLedger(m, 'worker.semantic-cancelled-before-start', { task_id: task.id, worker_id: worker.id, payload: { revision: m.semantic_assessment.revision } });
                paused++;
                continue;
            }
            if (['starting', 'busy'].includes(worker.status)) {
                const stopped = await this.abortNativeSession(m, worker.session_id, 'semantic-quarantine', worker.id, task.id);
                if (!stopped) {
                    const marker = `semantic-abort-unavailable:${task.id}:${worker.id}`;
                    m.blockers = [...new Set([...m.blockers, marker])];
                    appendLedger(m, 'worker.semantic-pause-blocked', { task_id: task.id, worker_id: worker.id, payload: { revision: m.semantic_assessment.revision, reason: 'abort-unavailable' } });
                    continue;
                }
                this.scheduler.release(worker.id);
            }
            worker.status = 'ready';
            task.status = task.result ? 'waiting' : 'waiting';
            this.registry.set(worker);
            appendLedger(m, 'worker.semantic-paused', { task_id: task.id, worker_id: worker.id, payload: { revision: m.semantic_assessment.revision, session_id: worker.session_id } });
            paused++;
        }
        this.#queue = this.#queue.filter(q => q.mission.mission_id !== m.mission_id || q.worker.status !== 'cancelled');
        syncMissionGates(m);
        return paused;
    }
    async resumeAfterSemanticAssessment(m, messageKind) {
        if (m.semantic_assessment.status !== 'assessed' || m.status !== 'active')
            return 0;
        let resumed = 0;
        for (const worker of m.workers.filter(w => w.semantic_pause_revision === m.semantic_assessment.revision && w.status === 'ready' && Boolean(w.session_id))) {
            const task = m.tasks.find(t => t.id === worker.task_id);
            if (!task || !worker.session_id)
                continue;
            const model = worker.model, provider = providerOf(model), capacity = this.scheduler.canStart(worker.id, provider, model === 'host-default' ? undefined : model);
            if (!capacity.ok) {
                appendLedger(m, 'worker.semantic-resume-deferred', { task_id: task.id, worker_id: worker.id, payload: { revision: m.semantic_assessment.revision, reason: capacity.reason } });
                continue;
            }
            this.scheduler.acquire(worker.id, provider, model === 'host-default' ? undefined : model);
            worker.generation_at_spawn = m.generation;
            worker.parent_mission_id = m.mission_id;
            worker.status = 'busy';
            worker.semantic_pause_revision = undefined;
            worker.started_at = Date.now();
            task.status = 'running';
            this.registry.set(worker);
            beginWorkerAttempt(task, worker);
            this.recordModelProjection(worker, model, worker.model_variant);
            await this.sendProviderPrompt(worker.session_id, clipText([`Hi semantic follow-up reconciliation for existing task ${task.id}.`, `Follow-up kind: ${messageKind}.`, `Current mission objective: ${m.objective}`, `Current user constraints: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `Still-selected methodologies: ${worker.selected_methodologies.join(', ') || 'none'}.`, 'Continue the SAME task/session from current context. Preserve completed work and evidence. Do not restart planning. If the follow-up creates separate work outside this task, report it rather than silently expanding scope. Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, worker.model_variant, promptToolOverrides(task.execution_profile?.tools ?? []));
            appendLedger(m, 'worker.semantic-resumed', { task_id: task.id, worker_id: worker.id, payload: { revision: m.semantic_assessment.revision, message_kind: messageKind, session_id: worker.session_id } });
            resumed++;
        }
        return resumed;
    }
    async reconcileUserConstraint(m, text) {
        if (m.status !== 'active' || m.user_interrupted)
            return 0;
        let reconciled = 0;
        for (const worker of m.workers.filter(w => ['created', 'queued', 'starting', 'busy', 'ready'].includes(w.status))) {
            const task = m.tasks.find(t => t.id === worker.task_id);
            if (!task)
                continue;
            const beforeMethodologies = [...worker.selected_methodologies];
            const stillRequired = (name) => m.methodology_needs.some(need => need.name === name && (!need.task_id || need.task_id === task.id));
            worker.selected_methodologies = worker.selected_methodologies.filter(stillRequired);
            worker.methodologies = worker.methodologies.filter(item => worker.selected_methodologies.includes(item.name));
            if (task.execution_profile)
                task.execution_profile.methodologies = [...worker.selected_methodologies];
            const suppressedMethodologies = beforeMethodologies.filter(name => !worker.selected_methodologies.includes(name));
            if (suppressedMethodologies.length)
                appendLedger(m, 'worker.methodology-suppressed', { task_id: task.id, worker_id: worker.id, payload: { methodologies: suppressedMethodologies, generation: m.generation, reason: 'user-constraint-superseded-intent' } });
            task.constraints ??= [];
            if (!task.constraints.includes(text))
                task.constraints.push(text);
            task.updated_at = Date.now();
            // Queued/not-running work will build its handoff lazily from task.constraints.
            if (!worker.session_id || ['created', 'queued'].includes(worker.status) || (worker.status === 'ready' && !worker.semantic_pause_revision)) {
                worker.generation_at_spawn = m.generation;
                worker.parent_mission_id = m.mission_id;
                appendLedger(m, 'worker.constraint-updated', { task_id: task.id, worker_id: worker.id, payload: { mode: 'deferred', generation: m.generation, constraint: text.slice(0, 300) } });
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
            }
            catch (error) {
                const marker = `constraint-abort-unavailable:${task.id}:${worker.id}`;
                m.blockers = [...new Set([...m.blockers, marker])];
                worker.status = 'ready';
                task.status = 'waiting';
                appendLedger(m, 'worker.constraint-rebase.blocked', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, error: String(error), generation: m.generation } });
                this.registry.set(worker);
                continue;
            }
            try {
                this.recordModelProjection(worker, model, variant);
                const child = await createChildSession(this.client, m.session_id, `Hi · ${worker.role} · constraint update · ${task.objective.slice(0, 45)}`, worker.role, model === 'host-default' ? undefined : model, variant);
                if (!child?.id)
                    throw new Error('Constraint rebase child session id missing');
                const recoverySessionID = String(child.id);
                worker.session_id = recoverySessionID;
                worker.loaded_methodologies = [];
                worker.semantic_pause_revision = undefined;
                recordPreexistingUserBaseline(m, await this.captureNativeDiff(worker, 'baseline'));
                worker.parent_mission_id = m.mission_id;
                worker.generation_at_spawn = m.generation;
                worker.status = 'busy';
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                const constraintExit = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const handoff = clipText([ownershipContract('child', worker.selected_methodologies), `Hi USER CONSTRAINT UPDATE for existing task ${task.id}.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${task.constraints.join(' | ')}`, `OBSERVED CHANGED FILES SO FAR: ${m.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${constraintExit.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'This is a fresh child session. Reload every still-selected methodology through the native skill tool before applying it.' : 'No methodology remains selected after the user constraint.', 'The previous child session was aborted because the user changed constraints. The latest constraint supersedes conflicting prior instructions. Do not write to prohibited surfaces. If prohibited files were already changed, report that explicitly; do not conceal or assume those edits are acceptable. Reconcile the existing task under the new constraint with the minimum safe change.', 'Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
                beginWorkerAttempt(task, worker);
                await this.sendProviderPrompt(child.id, handoff, worker.role, model === 'host-default' ? undefined : model, variant, promptToolOverrides(task.execution_profile?.tools ?? []));
                appendLedger(m, 'worker.constraint-rebased', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, to_session: worker.session_id, generation: m.generation, constraint: text.slice(0, 300) } });
                void this.events?.(runtimeSignal('worker.constraint-rebased', m.mission_id, { task_id: task.id, worker_id: worker.id, payload: { generation: m.generation } }));
                reconciled++;
            }
            catch (error) {
                this.scheduler.release(worker.id);
                worker.status = 'ready';
                task.status = task.result ? 'waiting' : 'blocked';
                this.registry.set(worker);
                appendLedger(m, 'worker.constraint-rebase.failed', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, error: String(error), generation: m.generation } });
            }
        }
        syncMissionGates(m);
        return reconciled;
    }
    async noteNativeWriteSet(m, workerID, files, source = 'session-diff', stateHash) {
        const worker = m.workers.find(w => w.id === workerID);
        if (!worker || !files.length)
            return;
        worker.write_set = [...new Set([...(worker.write_set ?? []), ...files])].slice(0, 300);
        if (stateHash)
            worker.native_state_hash = stateHash;
        markMutation(m, files, source);
        new ProjectIntelligenceStore(this.projectRoot).invalidateChanged(files);
        new ContextArtifactStore(this.projectRoot).invalidateChanged(files);
        if (isHiReadOnlyChildRole(worker.role))
            return;
        for (const other of m.workers) {
            if (other.id === worker.id || isHiReadOnlyChildRole(other.role) || !(other.write_set ?? []).length || !['starting', 'busy'].includes(other.status) || !['starting', 'busy'].includes(worker.status))
                continue;
            const overlap = (worker.write_set ?? []).filter(x => (other.write_set ?? []).includes(x));
            if (!overlap.length)
                continue;
            // The worker whose overlapping write is observed second is quarantined. The already-running
            // writer is allowed to finish, then the quarantined task resumes in the SAME child session
            // after an explicit dependency gate. This prevents blind concurrent merging while preserving
            // task/worker identity and context.
            const winner = other, loser = worker, winnerTask = m.tasks.find(t => t.id === winner.task_id), loserTask = m.tasks.find(t => t.id === loser.task_id);
            if (!winnerTask || !loserTask)
                continue;
            const pair = [winner.id, loser.id].sort().join(':');
            const marker = `parallel-write-conflict:${pair}:${overlap.slice(0, 8).sort().join(',')}`;
            if (!m.blockers.includes(marker))
                m.blockers.push(marker);
            if (!loserTask.dependencies.includes(winnerTask.id))
                loserTask.dependencies.push(winnerTask.id);
            loserTask.result = { status: 'FIX_REQUIRED', summary: `Runtime write conflict detected with ${winner.id}; serialized reconciliation required.`, changed_files: [...new Set(loser.write_set ?? [])], evidence: [], open_issues: [marker], needs_context: [] };
            loserTask.updated_at = Date.now();
            loser.completed_at = undefined;
            this.scheduler.release(loser.id);
            this.registry.delete(loser.id);
            const stopped = loser.session_id ? await this.abortNativeSession(m, loser.session_id, 'parallel-write-conflict', loser.id, loserTask.id) : false;
            if (!stopped) {
                const abortMarker = `parallel-conflict-abort-unavailable:${loserTask.id}:${loser.id}`;
                m.blockers = [...new Set([...m.blockers, abortMarker])];
                loser.status = 'ready';
                loserTask.status = 'blocked';
                loserTask.result = { ...loserTask.result, status: 'BLOCKED', open_issues: [...new Set([...loserTask.result.open_issues, abortMarker])], needs_context: [...new Set([...loserTask.result.needs_context, 'OpenCode lifecycle abort is unavailable; do not assume the conflicting writer is quarantined'])] };
                this.registry.set(loser);
                appendLedger(m, 'parallel.write-conflict.abort-blocked', { task_id: loserTask.id, worker_id: loser.id, payload: { winner_worker_id: winner.id, files: overlap.slice(0, 30) } });
                break;
            }
            loser.status = 'queued';
            const resume = async () => { const model = loser.model, provider = providerOf(model), capacity = this.scheduler.canStart(loser.id, provider, model === 'host-default' ? undefined : model); if (!capacity.ok)
                throw new Error(`Conflict resume capacity unavailable: ${capacity.reason}`); this.scheduler.acquire(loser.id, provider, model === 'host-default' ? undefined : model); loser.status = 'busy'; loser.started_at = Date.now(); loser.generation_at_spawn = m.generation; loser.parent_mission_id = m.mission_id; loserTask.status = 'running'; this.registry.set(loser); if (!loser.session_id)
                throw new Error('Conflict resume child session missing'); beginWorkerAttempt(loserTask, loser); this.recordModelProjection(loser, model, loser.model_variant); await this.sendProviderPrompt(loser.session_id, clipText([`Hi runtime write-conflict reconciliation for existing task ${loserTask.id}.`, `Conflicting task ${winnerTask.id} has completed before this resume gate opened.`, `Conflicting files: ${overlap.join(', ')}`, `Current task objective: ${loserTask.objective}`, `Current user constraints: ${(loserTask.constraints ?? []).join(' | ') || 'none'}.`, 'Inspect the current diff/state first. Preserve valid work from the completed task. Reconcile only this task sequentially; do not blindly overwrite or restart planning. Re-run the required scoped verification and return the structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), loser.role, model === 'host-default' ? undefined : model, loser.model_variant, promptToolOverrides(loserTask.execution_profile?.tools ?? [])); appendLedger(m, 'parallel.write-conflict.resumed', { task_id: loserTask.id, worker_id: loser.id, payload: { after_task: winnerTask.id, files: overlap.slice(0, 30) } }); return loser; };
            this.queueTask(m, loser, resume);
            appendLedger(m, 'parallel.write-conflict.quarantined', { task_id: loserTask.id, worker_id: loser.id, payload: { winner_worker_id: winner.id, winner_task_id: winnerTask.id, files: overlap.slice(0, 30), policy: 'verified-abort-then-serialize' } });
            void this.events?.(runtimeSignal('parallel.write-conflict', m.mission_id, { task_id: loserTask.id, worker_id: loser.id, payload: { other_worker_id: winner.id, files: overlap.slice(0, 30), action: 'quarantined' } }));
            break;
        }
        syncMissionGates(m);
    }
    noteNativeStatus(m, workerID, status) { const worker = m.workers.find(w => w.id === workerID); if (!worker)
        return; appendLedger(m, 'worker.native-status', { worker_id: worker.id, payload: { status } }); }
    applyResult(m, workerID, result) {
        const worker = m.workers.find(w => w.id === workerID);
        if (!worker)
            return;
        if (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.generation) {
            appendLedger(m, 'worker.result.stale-generation-ignored', { worker_id: worker.id, payload: { worker_generation: worker.generation_at_spawn, mission_generation: m.generation } });
            return;
        }
        const task = m.tasks.find(t => t.id === worker.task_id);
        if (!task)
            return;
        const digest = resultDigest(result);
        if (worker.last_result_digest === digest) {
            appendLedger(m, 'worker.result.duplicate-ignored', { task_id: task.id, worker_id: worker.id, payload: { digest } });
            return;
        }
        worker.last_result_digest = digest;
        worker.last_result_at = Date.now();
        const observedMutationDuringWorker = Boolean(worker.started_at && m.evidence.last_mutation_at && m.evidence.last_mutation_at >= worker.started_at);
        const previousIssues = task.result?.open_issues ?? [];
        if (previousIssues.length)
            m.blockers = m.blockers.filter(b => !previousIssues.includes(b) || m.tasks.some(other => other.id !== task.id && (other.result?.open_issues ?? []).includes(b)));
        const previousCollateral = [...(task.diff_cleanliness?.collateral ?? [])];
        const ownership = isHiReadOnlyChildRole(worker.role) && result.changed_files.length
            ? { outside: [...result.changed_files], accepted: [], collateral: [...result.changed_files] }
            : assessDiffOwnership(task, result);
        if (ownership.accepted.length) {
            task.diff_cleanliness = { collateral: previousCollateral, accepted_expansions: [...new Set([...(task.diff_cleanliness?.accepted_expansions ?? []), ...ownership.accepted])] };
        }
        const cleanlinessMarker = ownership.collateral.length ? `diff-cleanliness:${task.id}:${ownership.collateral.slice(0, 12).sort().join(',')}` : undefined;
        const claimedReverted = previousCollateral.filter(file => !new Set(result.changed_files.map(normFile)).has(normFile(file)));
        const verifiedReverts = new Set((task.diff_cleanliness?.native_verified_reverts ?? []).map(normFile));
        const unverifiedReverts = !cleanlinessMarker ? claimedReverted.filter(file => !verifiedReverts.has(normFile(file))) : [];
        const cleanupMarker = unverifiedReverts.length ? `cleanup-unverified:${task.id}:${unverifiedReverts.slice(0, 12).sort().join(',')}` : undefined;
        let effectiveResult = cleanlinessMarker ? {
            ...result,
            status: 'FIX_REQUIRED',
            summary: `Diff cleanliness reconciliation required before completion. Unowned/collateral changed files: ${ownership.collateral.slice(0, 12).join(', ')}.`,
            open_issues: [...new Set([...result.open_issues, cleanlinessMarker])],
            needs_context: [...new Set([...result.needs_context, 'diff-cleanliness-reconcile: inspect current diff; revert collateral files or explicitly justify necessary bounded scope expansion'])]
        } : cleanupMarker ? {
            ...result,
            status: 'FIX_REQUIRED',
            summary: `Cleanup was reported but deterministic native diff evidence is still required for: ${unverifiedReverts.slice(0, 12).join(', ')}.`,
            open_issues: [...new Set([...result.open_issues, cleanupMarker])],
            needs_context: [...new Set([...result.needs_context, 'cleanup-verification: do not close collateral-diff blockers from WorkerResult claims alone; provide native/session diff confirmation'])]
        } : result;
        const missingMethodologyLoads = effectiveResult.status === 'DONE' ? (worker.selected_methodologies ?? []).filter(name => !(worker.loaded_methodologies ?? []).includes(name)) : [];
        if (missingMethodologyLoads.length) {
            const marker = `methodology-not-loaded:${task.id}:${missingMethodologyLoads.join(',')}`;
            effectiveResult = { ...effectiveResult, status: 'FIX_REQUIRED', summary: `Selected Hi methodology was not loaded through the native skill tool: ${missingMethodologyLoads.join(', ')}.`, open_issues: [...new Set([...effectiveResult.open_issues, marker])], needs_context: [...new Set([...effectiveResult.needs_context, 'load the Hi-selected methodology through the OpenCode native skill tool before retrying the bounded task'])] };
            appendLedger(m, 'methodology.load-missing', { task_id: task.id, worker_id: worker.id, payload: { selected: worker.selected_methodologies, loaded: worker.loaded_methodologies ?? [], missing: missingMethodologyLoads } });
        }
        if (cleanlinessMarker) {
            task.diff_cleanliness = { collateral: [...ownership.collateral], accepted_expansions: [...(task.diff_cleanliness?.accepted_expansions ?? [])] };
            appendLedger(m, 'diff.cleanliness.blocked', { task_id: task.id, worker_id: worker.id, payload: { collateral: ownership.collateral.slice(0, 40), outside: ownership.outside.slice(0, 40), role: worker.role } });
            void this.events?.(runtimeSignal('diff.cleanliness.blocked', m.mission_id, { task_id: task.id, worker_id: worker.id, payload: { collateral: ownership.collateral.slice(0, 40) } }));
        }
        else if (previousCollateral.length && !cleanupMarker) {
            const stillChanged = new Set(result.changed_files.map(normFile));
            const reverted = previousCollateral.filter(file => !stillChanged.has(normFile(file)) && verifiedReverts.has(normFile(file)));
            if (reverted.length) {
                m.changed_files = m.changed_files.filter(file => !reverted.includes(file) || m.tasks.some(t => t.id !== task.id && (t.result?.changed_files ?? []).includes(file)));
                appendLedger(m, 'diff.cleanliness.resolved', { task_id: task.id, worker_id: worker.id, payload: { reverted: reverted.slice(0, 40), source: 'native-session-diff' } });
            }
            const unresolved = previousCollateral.filter(file => !reverted.includes(file));
            task.diff_cleanliness = { collateral: unresolved, accepted_expansions: [...(task.diff_cleanliness?.accepted_expansions ?? [])], native_verified_reverts: [] };
        }
        if (effectiveResult.findings?.length) {
            const findings = effectiveResult.findings;
            const invalidRole = findings.filter(f => !isHiReviewerRole(worker.role) || f.reviewer_role !== worker.role);
            const actionable = findings.filter(f => f.reviewer_role === worker.role && reviewFindingNeedsCorrection(f));
            const unresolvedCausality = findings.filter(f => f.reviewer_role === worker.role && f.disposition === 'open' && f.blocking && f.causality === 'unknown');
            const roleMarkers = invalidRole.map(f => `review-finding-role-mismatch:${f.id}:${worker.role}->${f.reviewer_role}`);
            const actionableMarkers = actionable.map(reviewFindingMarker);
            const causalityMarkers = unresolvedCausality.map(f => `review-finding-causality-unresolved:${f.id}`);
            if (roleMarkers.length) {
                effectiveResult = { ...effectiveResult, status: 'FIX_REQUIRED', open_issues: [...new Set([...effectiveResult.open_issues, ...roleMarkers])], needs_context: [...new Set([...effectiveResult.needs_context, 'review-finding-role-reconcile: structured findings must be emitted by the actual canonical reviewer role'])] };
                appendLedger(m, 'review.finding-role-rejected', { task_id: task.id, worker_id: worker.id, payload: { findings: invalidRole.map(f => f.id), worker_role: worker.role } });
            }
            if (actionableMarkers.length) {
                effectiveResult = { ...effectiveResult, status: 'FIX_REQUIRED', open_issues: [...new Set([...effectiveResult.open_issues, ...actionableMarkers])] };
                appendLedger(m, 'review.finding-actionable', { task_id: task.id, worker_id: worker.id, payload: { findings: actionable.map(f => ({ id: f.id, severity: f.severity, causality: f.causality, blocking: f.blocking, scope: f.scope.slice(0, 20) })) } });
            }
            if (causalityMarkers.length) {
                effectiveResult = { ...effectiveResult, status: 'FIX_REQUIRED', open_issues: [...new Set([...effectiveResult.open_issues, ...causalityMarkers])], needs_context: [...new Set([...effectiveResult.needs_context, 'review-finding-causality-reconcile: blocking findings with unknown causality cannot become mission blockers until introduced/worsened/pre-existing ownership is established'])] };
                appendLedger(m, 'review.finding-causality-unresolved', { task_id: task.id, worker_id: worker.id, payload: { findings: unresolvedCausality.map(f => f.id) } });
            }
            const preExisting = findings.filter(f => f.causality === 'pre-existing' && f.disposition === 'open');
            if (preExisting.length)
                appendLedger(m, 'review.finding-pre-existing', { task_id: task.id, worker_id: worker.id, payload: { findings: preExisting.map(f => ({ id: f.id, severity: f.severity, scope: f.scope.slice(0, 20) })), policy: 'record-without-unrelated-mission-blocker' } });
        }
        // Proof ownership: ingest worker-reported proof into the canonical Evidence owner before
        // methodology exit evaluation. A WorkerResult is not itself proof. If changed files were
        // only reported after the fact, mark that mutation first so same-result evidence is stale.
        const fallbackMutation = effectiveResult.changed_files.length > 0 && !observedMutationDuringWorker;
        if (fallbackMutation)
            markMutation(m, effectiveResult.changed_files, 'worker-result-fallback');
        const evidenceSource = isHiReadOnlyChildRole(worker.role) ? `worker:${worker.id}:reviewer` : `worker:${worker.id}`;
        for (const e of effectiveResult.evidence)
            addEvidence(m, { kind: e.kind, summary: e.summary, scope: e.scope ?? effectiveResult.changed_files, source: evidenceSource, source_session_id: worker.session_id, source_state_hash: worker.native_state_hash, task_id: task.id, obligation_ids: task.obligation_ids, pass: e.pass, outcome: e.outcome, reason: e.reason, invalidated_at: (cleanlinessMarker || fallbackMutation && !isHiReadOnlyChildRole(worker.role)) ? (m.evidence.last_mutation_at ?? Date.now()) : undefined });
        if (effectiveResult.status === 'DONE' && (worker.loaded_methodologies?.length ?? 0) > 0) {
            const missingExit = [...new Set((worker.loaded_methodologies ?? []).flatMap(name => methodologyExitCheck(m, name, { task, worker, result: effectiveResult, projectRoot: this.projectRoot, scope: 'worker' }).missing))];
            if (missingExit.length) {
                const exitMarker = `methodology-exit-unsatisfied:${task.id}:${missingExit.join(',')}`;
                effectiveResult = { ...effectiveResult, status: 'FIX_REQUIRED', summary: `Hi methodology exit contract is not satisfied: ${missingExit.join(', ')}.`, open_issues: [...new Set([...effectiveResult.open_issues, exitMarker])], needs_context: [...new Set([...effectiveResult.needs_context, `methodology-exit: provide the required evidence/result for ${missingExit.join(', ')}`])] };
                appendLedger(m, 'methodology.exit-unsatisfied', { task_id: task.id, worker_id: worker.id, payload: { methodologies: worker.loaded_methodologies, missing: missingExit } });
            }
        }
        applyWorkerResult(m, task, worker, effectiveResult);
        this.scheduler.release(worker.id);
        this.registry.delete(worker.id);
        for (const signal of changedSurfaceMethodologySignals(effectiveResult.changed_files))
            activateMethodologySignal(m, this.projectRoot, { signal: signal.name, producer: 'changed-surface', reason: signal.reason });
        for (const signal of workerResultMethodologySignals({ status: effectiveResult.status, needsContext: effectiveResult.needs_context, contextGap: effectiveResult.context_gap, failureFinding: effectiveResult.failure_finding })) {
            const producer = signal.name.startsWith('context.') ? 'context' : 'runtime-failure';
            activateMethodologySignal(m, this.projectRoot, { signal: signal.name, producer, reason: signal.reason });
        }
        void this.events?.(runtimeSignal('worker.completed', m.mission_id, { task_id: task.id, worker_id: worker.id, payload: { status: effectiveResult.status } }));
        if (effectiveResult.open_issues.some(x => String(x).toUpperCase().includes('USER_ACTION_REQUIRED'))) {
            openHumanDecision(m, { semantic_type: 'operational_action', reason_code: 'worker-user-action-required', summary: effectiveResult.summary.slice(0, 500) || 'Worker requires external user action before this task can continue.', task_id: task.id, worker_id: worker.id, response_schema: { kind: 'external-action' } });
        }
        const replan = replanVerificationForChangedSurface(m, task, effectiveResult.changed_files, collectRepoContext(this.projectRoot));
        if (replan.changed) {
            appendLedger(m, 'verification.replanned', { task_id: task.id, worker_id: worker.id, payload: { changed_files: effectiveResult.changed_files.slice(0, 30), added_kinds: replan.addedKinds, scope_expanded: replan.scopeExpanded, risk_escalated: replan.riskEscalated, reason: replan.reason } });
            void this.events?.(runtimeSignal('verification.replanned', m.mission_id, { task_id: task.id, worker_id: worker.id, payload: { added_kinds: replan.addedKinds, scope_expanded: replan.scopeExpanded, risk_escalated: replan.riskEscalated } }));
        }
        for (const signal of verificationMethodologySignals({ changed: replan.changed, scopeExpanded: replan.scopeExpanded, riskEscalated: replan.riskEscalated, requireReview: m.verification_policy.requireReview, changedFiles: effectiveResult.changed_files })) {
            const producer = signal.name.startsWith('risk.') ? 'risk' : 'verification';
            activateMethodologySignal(m, this.projectRoot, { signal: signal.name, producer, reason: signal.reason });
        }
        if (ownership.accepted.length) {
            task.scope = [...new Set([...task.scope, ...ownership.accepted])];
            appendLedger(m, 'task.scope-expanded', { task_id: task.id, worker_id: worker.id, payload: { files: ownership.accepted.slice(0, 40), policy: 'bounded-explicit-ownership' } });
        }
        if (effectiveResult.status === 'DONE' && effectiveResult.methodology_observations?.length) {
            const mutation = m.evidence.last_mutation_at ?? 0, evidenceRefs = m.evidence.items.filter(e => e.task_id === task.id && !e.invalidated_at && (e.outcome === 'passed' || e.pass === true) && e.observed_at >= mutation).map(e => e.kind);
            for (const observation of effectiveResult.methodology_observations)
                this.#methodologyLearning.observe(m, worker, observation, evidenceRefs);
        }
        const ownsReviewObligation = task.obligation_ids.some(id => m.obligations.some(o => o.id === id && o.kind === 'review'));
        if (effectiveResult.status === 'DONE' && isHiReadOnlyChildRole(worker.role) && ownsReviewObligation && !effectiveResult.evidence.some(e => e.kind === 'review-evidence'))
            addEvidence(m, { kind: 'review-evidence', summary: effectiveResult.summary || `Independent ${worker.role} completed owned review task`, scope: effectiveResult.changed_files, source: evidenceSource, source_session_id: worker.session_id, source_state_hash: worker.native_state_hash, task_id: task.id, obligation_ids: task.obligation_ids, pass: true, outcome: 'passed' });
        if (effectiveResult.status === 'DONE') {
            const now = Date.now();
            if (worker.role === 'repository-explorer' && m.intent.ambiguity !== 'none') {
                m.intent.ambiguity = 'none';
                appendLedger(m, 'intent.ambiguity.resolved', { task_id: task.id, worker_id: worker.id, payload: { source: 'repository-explorer-result' } });
            }
            for (const id of task.obligation_ids) {
                const owned = m.obligations.find(o => o.id === id && o.status === 'open');
                if (!owned)
                    continue;
                if (owned.kind === 'verification') {
                    if (verificationSatisfied(m, owned.id).ok) {
                        owned.status = 'closed';
                        owned.closedAt = now;
                    }
                }
                else {
                    owned.status = 'closed';
                    owned.closedAt = now;
                }
                if (owned.status === 'closed')
                    appendLedger(m, 'obligation.closed', { task_id: task.id, worker_id: worker.id, payload: { obligation: owned.id, owner: 'task' } });
            }
            reconcileMethodologyExits(m, this.projectRoot);
        }
        syncMissionGates(m);
        this.drainQueue();
    }
    async recoverStagnation(m, level) {
        if (![1, 2].includes(level) || m.status !== 'active' || m.user_interrupted)
            return false;
        const worker = [...m.workers].reverse().find(w => Boolean(w.session_id) && !['failed', 'cancelled', 'busy', 'starting', 'queued'].includes(w.status));
        if (!worker?.session_id)
            return false;
        const task = m.tasks.find(t => t.id === worker.task_id);
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
            worker.generation_at_spawn = m.generation;
            worker.parent_mission_id = m.mission_id;
            worker.status = 'busy';
            task.status = 'running';
            this.registry.set(worker);
            const instruction = level === 1
                ? 'Hi stagnation recovery: continue the SAME task/session with one narrowly scoped corrective attempt. Preserve completed work and evidence. Do not restart planning.'
                : `Hi stagnation recovery: continue the SAME task/session with policy escalation from ${previous ?? 'default'} to ${model ?? 'default'}. Preserve completed work and evidence. Do not restart planning.`;
            beginWorkerAttempt(task, worker);
            this.recordModelProjection(worker, model, variant);
            await this.sendProviderPrompt(worker.session_id, clipText(`${instruction}\nReturn the normal structured WorkerResult.`, DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, variant, promptToolOverrides(task.execution_profile?.tools ?? []));
            appendLedger(m, 'worker.stagnation-recovery', { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant, generation: m.generation } });
            void this.events?.(runtimeSignal('worker.recovered', m.mission_id, { task_id: task.id, worker_id: worker.id, payload: { level, action, from: previous, to: model, variant } }));
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
        const worker = m.workers.find(w => w.id === workerID);
        if (!worker)
            return false;
        const task = m.tasks.find(t => t.id === worker.task_id), failure = classifyWorkerFailure(error);
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
                    stopped = await this.abortNativeSession(m, failedSession, 'terminal-runtime-fallback', worker.id, task.id);
                }
                catch { }
                ;
                if (!stopped) {
                    const marker = `runtime-fallback-abort-unavailable:${task.id}:${worker.id}`;
                    m.blockers = [...new Set([...m.blockers, marker])];
                    worker.runtime_fallback_exhausted = true;
                    appendLedger(m, 'worker.runtime-fallback.abort-blocked', { task_id: task.id, worker_id: worker.id, payload: { session_id: failedSession, failure_class: failure.kind, marker } });
                    return false;
                }
                this.recordModelProjection(worker, model, variant);
                const child = await createChildSession(this.client, m.session_id, `Hi · ${worker.role} · runtime recovery · ${task.objective.slice(0, 45)}`, worker.role, model === 'host-default' ? undefined : model, variant);
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
                worker.generation_at_spawn = m.generation;
                worker.parent_mission_id = m.mission_id;
                worker.started_at = Date.now();
                task.status = 'running';
                this.registry.set(worker);
                recordPreexistingUserBaseline(m, await this.captureNativeDiff(worker, 'baseline'));
                const exitRequirements = worker.selected_methodologies.flatMap(name => { const item = methodologyCatalog(this.projectRoot).find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
                const prompt = clipText([ownershipContract('child', worker.selected_methodologies), `Hi terminal runtime recovery for existing task ${task.id}.`, `Failure class: ${failure.kind}.`, `Previous failed session: ${failedSession}.`, `Fallback model: ${model}.`, `OBJECTIVE: ${task.objective}`, `SCOPE: ${task.scope.join(', ') || 'bounded by objective'}`, `CURRENT USER CONSTRAINTS: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `OBSERVED CHANGED FILES SO FAR: ${m.changed_files.slice(-30).join(', ') || 'none'}`, `METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ') || 'none'}`, worker.selected_methodologies.length ? 'This is a fresh child session. Reload every still-selected methodology through the native skill tool before applying it.' : 'No methodology is selected for this recovery.', 'Preserve already-observed repository changes and bounded evidence, but do not assume the failed session context is present. Inspect only the minimum current state needed to continue the SAME task. Do not restart top-level planning. Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars);
                beginWorkerAttempt(task, worker);
                await this.sendProviderPrompt(recoverySessionID, prompt, worker.role, model === 'host-default' ? undefined : model, variant, promptToolOverrides(task.execution_profile?.tools ?? []));
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
        m.stagnation_count = 0;
        const blocker = `provider-failure:${failure.kind}:${worker.model ?? 'unknown'}`;
        m.blockers = [...new Set([...m.blockers, blocker])];
        task.status = 'blocked';
        task.updated_at = Date.now();
        task.result = { status: 'BLOCKED', summary: 'Runtime provider/model fallback chain exhausted.', changed_files: [], evidence: [], open_issues: [blocker], needs_context: ['provider/model availability or alternate execution path'] };
        appendLedger(m, 'worker.runtime-fallback.exhausted', { task_id: task.id, worker_id: worker.id, payload: { failure_class: failure.kind, attempted: [worker.model, ...candidates].filter(Boolean) } });
        return false;
    }
    fail(m, workerID, error) { const worker = m.workers.find(w => w.id === workerID); if (!worker)
        return; if (worker.generation_at_spawn !== undefined && worker.generation_at_spawn !== m.generation) {
        appendLedger(m, 'worker.failure.stale-generation-ignored', { worker_id: worker.id });
        return;
    } const task = m.tasks.find(t => t.id === worker.task_id), permissionFailure = worker.last_runtime_failure_kind === 'permission', marker = permissionFailure ? `permission-failure:${worker.id}` : error; worker.status = 'failed'; worker.completed_at = Date.now(); this.scheduler.release(worker.id); this.registry.delete(worker.id); if (permissionFailure)
        m.stagnation_count = 0; if (task) {
        task.status = 'failed';
        task.updated_at = Date.now();
        task.result = { status: 'FAILED', summary: error, changed_files: [], evidence: [], open_issues: [marker], needs_context: permissionFailure ? ['resolve OpenCode permission/authority and explicitly resume the mission'] : [] };
    } m.blockers = [...new Set([...m.blockers, marker])]; appendLedger(m, 'worker.failed', { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: worker.last_runtime_failure_kind ?? 'unknown', blocker: marker } }); void this.events?.(runtimeSignal('worker.failed', m.mission_id, { task_id: task?.id, worker_id: worker.id, payload: { error, failure_class: worker.last_runtime_failure_kind ?? 'unknown' } })); syncMissionGates(m); this.drainQueue(); }
    peek(m, id) { const task = m.tasks.find(t => t.id === id), worker = m.workers.find(w => w.id === id || w.id === task?.worker_id); return { task, worker }; }
    list(m) { return m.tasks.map(t => ({ task: t, worker: m.workers.find(w => w.id === t.worker_id) })); }
    async cancelAll(m) { let n = 0; for (const w of [...m.workers])
        if (['created', 'queued', 'starting', 'ready', 'busy'].includes(w.status))
            if (await this.cancel(m, w.id))
                n++; return n; }
    async cancel(m, id) { const task = m.tasks.find(t => t.id === id), worker = m.workers.find(w => w.id === id || w.id === task?.worker_id); if (!worker)
        return false; if (worker.session_id) {
        const stopped = await this.abortNativeSession(m, worker.session_id, 'worker-cancel', worker.id, worker.task_id);
        if (!stopped) {
            appendLedger(m, 'worker.cancel.blocked', { task_id: worker.task_id, worker_id: worker.id, payload: { reason: 'abort-unavailable' } });
            return false;
        }
    } worker.status = 'cancelled'; this.scheduler.release(worker.id); const t = m.tasks.find(x => x.id === worker.task_id); if (t)
        t.status = 'cancelled'; this.registry.delete(worker.id); this.#queue = this.#queue.filter(q => q.worker.id !== worker.id); appendLedger(m, 'worker.cancelled', { task_id: t?.id, worker_id: worker.id }); syncMissionGates(m); this.drainQueue(); return true; }
}
