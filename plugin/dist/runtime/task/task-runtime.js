import { resolveCategory } from '../routing/category.js';
import { resolveModel, runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { resolveSkillPlan } from '../skills/registry.js';
import { resolveSkillPermissionMap, resolveSkillToolEnabled } from '../skills/permissions.js';
import { createTask, createWorker, beginWorkerAttempt, workerFingerprint } from '../worker/worker-runtime.js';
import { workerHandoffText } from './contracts.js';
import { NativeOpenCodeAdapter } from '../../opencode/native-adapter.js';
import { detectOpenCodeCapabilities } from '../../opencode/capabilities.js';
import { appendLedger } from '../ledger/ledger.js';
import { parallelSafety } from '../scheduler/parallel-safety.js';
import { routeCapabilities } from '../routing/capability-router.js';
import { verificationEconomyInstruction } from '../verification/policy.js';
import { targetedVerificationHint } from '../verification/discovery.js';
import { bindMethodologyNeeds, methodologyNames } from '../methodology/activation.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { methodologyProvenance, ownershipContract } from '../skills/methodology.js';
import { DEFAULT_CONTEXT_BUDGET, clipList, clipText } from '../context/budget.js';
import { modelQuirks } from '../routing/model-quirks.js';
import { runtimeSignal } from '../events/event-sink.js';
import { syncMissionGates } from '../gates/gates.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { evaluateTaskPreconditions, TaskPreconditionError } from '../readiness/preconditions.js';
import { effectiveExecutionSurface, promptToolOverrides } from '../routing/execution-profile.js';
import { ProjectMethodologyLearningStore } from '../project-intelligence/methodology-learning.js';
import { executionProfileFor } from '../../config/execution-policy.js';
import { applyAdmittedProjectMethodologyPermissions } from '../methodology/host-permissions.js';
import { isHiChildRole, isHiReadOnlyChildRole, isHiReviewerRole, roleCanOwnObligation } from '../roles/catalog.js';
import { renderSemanticContext, semanticContextsForTargets } from '../semantic/typescript-context.js';
import { createRuntimeScopedStores } from '../application/runtime-scoped-stores.js';
import { ChildExecutionCoordinator } from './child-execution-coordinator.js';
import { TaskResultReconciler } from './task-result-reconciler.js';
import { TaskRecoveryCoordinator } from './task-recovery-coordinator.js';
const CATEGORIES = new Set(['quick', 'standard', 'deep', 'visual', 'critical']);
const MAX_QUEUE = 32;
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
    if (['repository-explorer', 'architect'].includes(role) || role === 'coder' && ['bug-fix', 'performance'].includes(m.identity.intent.taskKind))
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
    client;
    registry;
    scheduler;
    projectRoot;
    getConfig;
    getModels;
    getHostConfig;
    events;
    #queue = [];
    #draining = false;
    #methodologyLearning;
    #child;
    #results;
    #recovery;
    #scopedStores;
    constructor(client, registry, scheduler, projectRoot, hiRoot, getConfig, getModels, getHostConfig, events, lifecycle = {}, scopedStores) {
        this.client = client;
        this.registry = registry;
        this.scheduler = scheduler;
        this.projectRoot = projectRoot;
        this.getConfig = getConfig;
        this.getModels = getModels;
        this.getHostConfig = getHostConfig;
        this.events = events;
        this.#scopedStores = scopedStores ?? createRuntimeScopedStores(projectRoot, hiRoot);
        this.#methodologyLearning = new ProjectMethodologyLearningStore(projectRoot);
        this.#child = new ChildExecutionCoordinator(client, lifecycle, registry);
        this.#results = new TaskResultReconciler(scheduler, registry, projectRoot, events, this.#methodologyLearning, this.#child, (m, w, run) => this.queueTask(m, w, run), () => this.drainQueue(), this.#scopedStores);
        this.#recovery = new TaskRecoveryCoordinator(scheduler, registry, projectRoot, getConfig, getModels, getHostConfig, events, this.#child, () => this.drainQueue());
    }
    async sendProviderPrompt(sessionID, text, role, model, variant, tools) { return this.#child.sendProviderPrompt(sessionID, text, role, model, variant, tools); }
    recordModelProjection(worker, model, variant) { this.#child.recordModelProjection(worker, model, variant); }
    async abortNativeSession(m, sessionID, reason, workerID, taskID) { return this.#child.abortNativeSession(m, sessionID, reason, workerID, taskID); }
    async captureNativeDiff(worker, phase) { return this.#child.captureNativeDiff(worker, phase); }
    async reconcileNativeResult(m, workerID, result) { return this.#results.reconcileNativeResult(m, workerID, result); }
    noteEffectiveModel(m, workerID, observed) { return this.#child.noteEffectiveModel(m, workerID, observed); }
    resolveChildCallback(sessionID) { return this.#child.resolveCallbackWorker(sessionID); }
    childCallbackDisposition(m, worker) { return this.#recovery.callbackDisposition(m, worker); }
    queueDepth() { return this.#queue.length; }
    depsReady(m, deps) { return deps.every(id => m.execution.tasks.find(t => t.id === id)?.status === 'completed'); }
    failedDeps(m, deps) { return deps.filter(id => { const status = m.execution.tasks.find(t => t.id === id)?.status; return status === 'failed' || status === 'cancelled'; }); }
    canRun(m, worker, chain) { if (m.identity.status !== 'active' || m.continuation.user_interrupted || m.identity.semantic_assessment.status !== 'assessed' || worker.status === 'cancelled')
        return false; if (!this.depsReady(m, m.execution.tasks.find(t => t.id === worker.task_id)?.dependencies ?? []))
        return false; const active = m.execution.workers.filter(w => w.id !== worker.id && ['starting', 'busy'].includes(w.status)).length; if (m.execution.execution_mode === 'single' && active > 0)
        return false; if (m.execution.execution_mode === 'parallel' && active >= Math.max(1, m.execution.topology?.parallelism ?? 1))
        return false; return chain.some(model => this.scheduler.canStart(worker.id, providerOf(model), model === 'host-default' ? undefined : model).ok); }
    queueTask(m, worker, run) { if (this.#queue.length >= MAX_QUEUE)
        throw new Error('Hi bounded dispatch queue is full'); const t = m.execution.tasks.find(x => x.id === worker.task_id); worker.status = 'queued'; if (t)
        t.status = 'queued'; if (!this.#queue.some(x => x.worker.id === worker.id))
        this.#queue.push({ mission: m, worker, run, created: Date.now() }); this.registry.set(worker); appendLedger(m, 'worker.queued', { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length } }); void this.events?.(runtimeSignal('worker.queued', m.identity.mission_id, { task_id: t?.id, worker_id: worker.id, payload: { queue_depth: this.#queue.length } })); syncMissionGates(m); }
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
                const failed = this.failedDeps(e.mission, t.dependencies);
                if (failed.length) {
                    this.#queue.splice(i--, 1);
                    e.worker.status = 'failed';
                    t.status = 'blocked';
                    t.updated_at = Date.now();
                    const reason = `dependency-unavailable:${failed.join(',')}`;
                    t.result = { status: 'BLOCKED', summary: 'Required dependency did not complete successfully.', changed_files: [], evidence: [], open_issues: [reason], needs_context: [] };
                    e.mission.execution.blockers = [...new Set([...e.mission.execution.blockers, reason])];
                    this.registry.delete(e.worker.id);
                    appendLedger(e.mission, 'worker.dependency-blocked', { task_id: t.id, worker_id: e.worker.id, payload: { dependencies: failed } });
                    void this.events?.(runtimeSignal('worker.dependency-blocked', e.mission.identity.mission_id, { task_id: t.id, worker_id: e.worker.id, payload: { dependencies: failed } }));
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
        if (m.identity.status !== 'active' || m.continuation.user_interrupted)
            throw new Error('Mission is not active');
        if (m.identity.semantic_assessment.status !== 'assessed')
            throw new Error('Hi semantic assessment is pending; assess mission intent before starting a worker');
        const objective = input.objective?.trim() || m.identity.objective;
        const taskIntent = m.identity.intent;
        const cfg = this.getConfig(), routingProfile = cfg.profile[executionProfileFor(cfg.executionPolicy, taskIntent)], routed = routeCapabilities(taskIntent, { specialistThreshold: routingProfile.specialistThreshold, reviewThreshold: routingProfile.reviewThreshold }), defaultCategory = resolveCategory(taskIntent), category = (CATEGORIES.has(String(input.category)) ? input.category : (routed.category ?? defaultCategory)), defaultRole = isHiChildRole(routed.role) ? routed.role : 'coder', role = isHiChildRole(String(input.role)) ? String(input.role) : defaultRole;
        const hostConfig = this.getHostConfig();
        applyAdmittedProjectMethodologyPermissions(hostConfig, this.projectRoot);
        const feedback = missionModelFeedback(m), selected = resolveModel(category, this.getModels(), this.getConfig(), input.model, role, hostConfig, feedback);
        if (selected.rejected.length)
            appendLedger(m, 'model.policy.rejected', { payload: { items: selected.rejected.slice(0, 20) } });
        if (selected.scores?.length)
            appendLedger(m, 'model.scored', { payload: { role, category, top: selected.scores.slice(0, 6), feedback } });
        const taskMethodologyNeeds = m.methodology.methodology_needs.filter(need => (!need.task_id && !need.obligation_id) || (need.obligation_id && input.obligationIds?.includes(need.obligation_id))), catalog = methodologyCatalog(this.projectRoot), candidates = this.#scopedStores.skillCatalog.candidates(hostConfig), permissionMap = resolveSkillPermissionMap(hostConfig, role), skillToolEnabled = resolveSkillToolEnabled(hostConfig, role), surface = effectiveExecutionSurface(hostConfig, role, skillToolEnabled), hostCapabilities = detectOpenCodeCapabilities(this.client).contracts, availableResources = new Set(hostCapabilities.filter(item => item.status === 'SUPPORTED').map(item => `host-capability:${item.id}`)), skillPlan = resolveSkillPlan(methodologyNames(taskMethodologyNeeds), candidates, permissionMap, skillToolEnabled, role, catalog, availableResources), methodologies = skillPlan.selected.map(s => s.name), methodologyResourceFailures = skillPlan.outcomes.filter(item => item.outcome === 'resource-unavailable').map(item => item.name);
        appendLedger(m, 'skill.resolved', { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } });
        void this.events?.(runtimeSignal('skill.resolved', m.identity.mission_id, { payload: { role, requested: skillPlan.requested, outcomes: skillPlan.outcomes } }));
        if (skillPlan.missing.length)
            appendLedger(m, 'skill.fallback', { payload: { missing: skillPlan.missing, requested: skillPlan.requested, skillToolEnabled } });
        const scope = input.scope ?? (isHiReadOnlyChildRole(role) && m.vcs.changed_files.length ? m.vcs.changed_files : taskIntent.likelyTargets ?? []), dependencies = [...new Set(input.dependencies ?? [])];
        const unknownDependencies = dependencies.filter(id => !m.execution.tasks.some(t => t.id === id)), unavailableDependencies = this.failedDeps(m, dependencies), incompleteDependencies = dependencies.filter(id => { const t = m.execution.tasks.find(x => x.id === id); return Boolean(t) && t.status !== 'completed' && !unavailableDependencies.includes(id); });
        const requiredEvidence = input.requiredEvidence ?? m.execution.verification_policy.requiredKinds, obligationIds = inferObligationIds(m, role, requiredEvidence, input.obligationIds), constraints = [...new Set([...(m.execution.constraints ?? []), ...(input.constraints ?? [])])], desiredFingerprint = workerFingerprint(role, category, selected.primary, taskIntent.taskKind, objective, { scope, constraints, dependencies, requiredEvidence, obligationIds }), existing = m.execution.workers.find(w => w.fingerprint === desiredFingerprint && !['completed', 'failed', 'cancelled'].includes(w.status));
        const native = new NativeOpenCodeAdapter(this.client), resumeCapable = Boolean(existing?.session_id), preflight = evaluateTaskPreconditions({ role, implementation: role === 'coder', dependencies: { unknown: unknownDependencies, failed: unavailableDependencies, incomplete: incompleteDependencies }, modelAvailable: Boolean(selected.primary), native: { childSession: resumeCapable || native.has('session-create'), prompt: native.has('prompt-async') || native.has('prompt-sync') }, hostConfig, methodologyResourceFailures, contractCriticalAmbiguity: m.identity.intent.ambiguity === 'contract-critical', authorityRequired: false });
        appendLedger(m, 'task.preflight', { payload: { role, decision: preflight.decision, resume_capable: resumeCapable, items: preflight.items.slice(0, 12) } });
        void this.events?.(runtimeSignal('task.preflight', m.identity.mission_id, { payload: { role, decision: preflight.decision, resume_capable: resumeCapable, items: preflight.items.slice(0, 12) } }));
        if (preflight.decision === 'RESOLVE' || preflight.decision === 'USER_ACTION_REQUIRED')
            throw new TaskPreconditionError(preflight);
        if (existing) {
            const oldTask = m.execution.tasks.find(t => t.id === existing.task_id);
            if (existing.status === 'ready' && existing.session_id && oldTask?.result && ['FIX_REQUIRED', 'NEEDS_CONTEXT', 'BLOCKED'].includes(oldTask.result.status)) {
                const chain = [selected.primary, ...selected.fallbacks].filter((x) => Boolean(x)), nextModel = chain.find(model => this.scheduler.canStart(existing.id, providerOf(model), model === 'host-default' ? undefined : model).ok) ?? existing.model;
                if (!nextModel)
                    throw new Error('Worker resume capacity unavailable');
                const previousModel = existing.model;
                this.scheduler.acquire(existing.id, providerOf(nextModel), nextModel === 'host-default' ? undefined : nextModel);
                existing.model = nextModel;
                existing.generation_at_spawn = m.continuation.generation;
                existing.status = 'busy';
                existing.started_at = Date.now();
                oldTask.status = 'running';
                this.registry.set(existing);
                const issues = oldTask.result.open_issues.join(' | '), missing = oldTask.result.needs_context.join(' | '), reviewScope = isHiReadOnlyChildRole(existing.role) ? `Scoped rereview only: previous findings=${issues || 'none'}; changed scope=${m.vcs.changed_files.slice(-20).join(',') || 'none'}; affected evidence=${m.execution.evidence.items.filter(e => !e.invalidated_at).slice(-8).map(e => e.summary).join(' | ') || 'none'}.` : '', resumeExitRequirements = existing.selected_methodologies.flatMap(name => { const item = catalog.find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; });
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
        const safety = parallelSafety(m.execution.tasks, { scope, dependencies, role }), hardParallelConflicts = safety.reasons.filter(reason => !reason.startsWith('dependency:'));
        if (hardParallelConflicts.length && m.execution.tasks.some(t => ['queued', 'running'].includes(t.status)))
            throw new Error(`Unsafe parallel dispatch: ${hardParallelConflicts.join('; ')}`);
        const requestedArtifactIds = [...new Set(input.contextArtifactIds ?? [])].slice(0, DEFAULT_CONTEXT_BUDGET.max_artifacts), unknownArtifactIds = requestedArtifactIds.filter(id => !m.context.context_artifacts.some(a => a.id === id));
        if (unknownArtifactIds.length)
            throw new Error(`Unknown context artifact id(s): ${unknownArtifactIds.join(', ')}`);
        const contextArtifactStore = this.#scopedStores.contextArtifacts, selectedContextHandles = requestedArtifactIds.map(id => m.context.context_artifacts.find(a => a.id === id)).filter(Boolean), selectedContextReferences = selectedContextHandles.map(a => { const durableId = a.uri?.startsWith('hi-artifact:') ? a.uri.slice('hi-artifact:'.length) : undefined, stored = durableId ? contextArtifactStore.get(durableId) : undefined; return { source_ref: a.uri ?? `mission-context:${a.id}`, reason: 'explicit-task-selection', priority: 'normal', protection: 'COMPRESSIBLE', budget_cost: stored ? Math.min(stored.content.length, 3000) : Math.min((a.summary ?? a.title ?? a.kind).length, 3000), freshness: stored?.freshness ?? 'UNKNOWN', retention: 'task', privacy_class: stored?.privacy_class ?? 'project-private', kind: a.kind, title: a.title, summary: a.summary, content_hash: stored?.content_hash ?? a.sha256, source_handle_id: a.id }; });
        const approvalGated = skillPlan.selected.filter(s => s.permission === 'ask').map(s => s.name), taskTools = surface.tools.filter(t => t !== 'skill' || methodologies.length > 0);
        const profile = { role, category, task: { objective, scope: [...scope], dependencies: [...dependencies], required_evidence: [...requiredEvidence] }, tools: taskTools, model: selected.primary, model_variant: input.modelVariant ?? selected.primaryVariant, fallback_models: selected.fallbacks, fallback_variants: selected.fallbackVariants, fallback_reasons: selected.fallbackReasons, methodologies, permission_profile: { skill_tool_enabled: skillToolEnabled, skill_permissions: permissionMap ?? {}, external_effects: 'parent-only', recursive_task: 'deny', native: surface.permissions }, verification_policy: { ...m.execution.verification_policy, requiredKinds: [...m.execution.verification_policy.requiredKinds] }, max_context_chars: DEFAULT_CONTEXT_BUDGET.max_context_chars, max_handoff_chars: DEFAULT_CONTEXT_BUDGET.max_handoff_chars, max_result_chars: DEFAULT_CONTEXT_BUDGET.max_result_chars, max_artifacts: DEFAULT_CONTEXT_BUDGET.max_artifacts };
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
            return `artifact-stale:${stored.artifact_id}:${stored.summary}`; return `${a.kind}:${a.title ?? a.source_handle_id ?? a.id}${a.summary ? ` — ${a.summary}` : ''}`; }), verificationHint = targetedVerificationHint(this.projectRoot, task.scope.length ? task.scope : (m.vcs.changed_files.length ? m.vcs.changed_files : m.identity.intent.likelyTargets ?? [])), semanticContexts = semanticContextsForTargets(this.projectRoot, task.scope, task.id, 3000), semanticContext = semanticContexts.map(renderSemanticContext), projectIntelligenceHits = this.#scopedStores.projectIntelligence.retrieve(`${task.objective} ${m.identity.objective}`, task.scope, 'task-context', 4), projectIntelligence = projectIntelligenceHits.map(hit => hit.item), projectContext = projectIntelligence.map(p => `project-intelligence:${p.id}:${p.statement} [${p.source_refs.map(x => x.ref.slice(5)).join(', ')}]`), explicitRelevant = input.relevantContext ?? [], boundedRuntimeRelevant = [...(verificationHint ? [verificationHint] : []), ...semanticContext, ...projectContext, ...artifactContext];
        if (semanticContexts.length)
            appendLedger(m, 'context.semantic-selected', { task_id: task.id, payload: { items: semanticContexts.slice(0, 6).map(x => ({ id: x.id, source_ref: x.source_ref, source_hash: x.source_hash.slice(0, 16), symbols: x.symbols.length, chars: x.budget.used_chars })), total_chars: semanticContexts.reduce((n, x) => n + x.budget.used_chars, 0) } });
        if (projectIntelligence.length)
            appendLedger(m, 'context.project-intelligence-selected', { task_id: task.id, payload: { consumer: 'task-context', items: projectIntelligenceHits.map(x => ({ id: x.item.id, confidence: x.item.confidence, score: Number(x.score.toFixed(6)), signals: x.signals, source_refs: x.item.source_refs.map(s => s.ref) })) } });
        let nativeSummary, relevantForHandoff = [...explicitRelevant, ...boundedRuntimeRelevant];
        if (relevantForHandoff.join('\n').length > profile.max_context_chars) {
            const native = new NativeOpenCodeAdapter(this.client);
            if (native.has('summarize'))
                try {
                    const summary = await native.summarize(m.identity.session_id);
                    nativeSummary = clipText(typeof summary === 'string' ? summary : JSON.stringify(summary), Math.min(6000, Math.floor(profile.max_context_chars / 2)));
                    relevantForHandoff = [`native-session-summary:${nativeSummary}`, ...boundedRuntimeRelevant];
                    appendLedger(m, 'context.native-summary-used', { task_id: task.id, payload: { source_session: m.identity.session_id, replaced_explicit_context: true } });
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
            if (m.identity.status !== 'active' || m.continuation.user_interrupted || worker.status === 'cancelled') {
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
                this.recordModelProjection(worker, model, variant);
                const spawned = await this.#child.createForTask(m.identity.session_id, `Hi · ${role} · ${objective.slice(0, 60)}`, role, model === 'host-default' ? undefined : model, variant, input.forkFromSession), child = spawned.child;
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
        } worker.status = 'failed'; const liveStatuses = chain.map(model => ({ model, ...runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig()) })); const policyUnavailable = liveStatuses.length > 0 && liveStatuses.every(x => !x.ok); if (policyUnavailable) {
            task.status = 'blocked';
            const marker = `model-dispatch-unavailable:${task.id}`;
            m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
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
            const duplicateTask = m.execution.tasks.find(t => t.id === task.id);
            if (duplicateTask && ['created', 'queued'].includes(duplicateTask.status))
                m.execution.tasks = m.execution.tasks.filter(t => t.id !== duplicateTask.id);
            m.execution.workers = m.execution.workers.filter(w => w.id !== worker.id);
            appendLedger(m, 'worker.spawn.deduped', { worker_id: spawned.id, payload: { discarded_worker_id: worker.id, fingerprint: worker.fingerprint } });
            const spawnedTask = m.execution.tasks.find(t => t.id === spawned.task_id);
            return { task_id: spawnedTask?.id ?? spawned.task_id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, 'deduped:existing-spawn', ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
        }
        return { task_id: task.id, worker_id: spawned.id, session_id: spawned.session_id, model: spawned.model, methodologies: spawned.selected_methodologies, selection_reason: [...routed.reason, ...selected.reason, ...selected.fallbackReasons.map(x => `${x.model}:${x.reason}`), ...skillPlan.reason], readiness: 'READY', preconditions: preflight.items };
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
                this.registry.delete(worker.id);
                this.#queue = this.#queue.filter(q => q.worker.id !== worker.id);
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
                this.scheduler.release(worker.id);
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
            const model = worker.model, provider = providerOf(model), capacity = this.scheduler.canStart(worker.id, provider, model === 'host-default' ? undefined : model);
            if (!capacity.ok) {
                appendLedger(m, 'worker.semantic-resume-deferred', { task_id: task.id, worker_id: worker.id, payload: { revision: m.identity.semantic_assessment.revision, reason: capacity.reason } });
                continue;
            }
            this.scheduler.acquire(worker.id, provider, model === 'host-default' ? undefined : model);
            worker.generation_at_spawn = m.continuation.generation;
            worker.parent_mission_id = m.identity.mission_id;
            worker.status = 'busy';
            worker.semantic_pause_revision = undefined;
            worker.started_at = Date.now();
            task.status = 'running';
            this.registry.set(worker);
            beginWorkerAttempt(task, worker);
            this.recordModelProjection(worker, model, worker.model_variant);
            await this.sendProviderPrompt(worker.session_id, clipText([`Hi semantic follow-up reconciliation for existing task ${task.id}.`, `Follow-up kind: ${messageKind}.`, `Current mission objective: ${m.identity.objective}`, `Current user constraints: ${(task.constraints ?? []).join(' | ') || 'none'}.`, `Still-selected methodologies: ${worker.selected_methodologies.join(', ') || 'none'}.`, 'Continue the SAME task/session from current context. Preserve completed work and evidence. Do not restart planning. If the follow-up creates separate work outside this task, report it rather than silently expanding scope. Return the normal structured WorkerResult.'].join('\n'), DEFAULT_CONTEXT_BUDGET.max_handoff_chars), worker.role, model === 'host-default' ? undefined : model, worker.model_variant, promptToolOverrides(task.execution_profile?.tools ?? []));
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
            }
            catch (error) {
                const marker = `constraint-abort-unavailable:${task.id}:${worker.id}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                worker.status = 'ready';
                task.status = 'waiting';
                appendLedger(m, 'worker.constraint-rebase.blocked', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, error: String(error), generation: m.continuation.generation } });
                this.registry.set(worker);
                continue;
            }
            try {
                this.recordModelProjection(worker, model, variant);
                const child = await this.#child.create(m.identity.session_id, `Hi · ${worker.role} · constraint update · ${task.objective.slice(0, 45)}`, worker.role, model === 'host-default' ? undefined : model, variant);
                if (!child?.id)
                    throw new Error('Constraint rebase child session id missing');
                const recoverySessionID = String(child.id);
                worker.session_id = recoverySessionID;
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
                await this.sendProviderPrompt(child.id, handoff, worker.role, model === 'host-default' ? undefined : model, variant, promptToolOverrides(task.execution_profile?.tools ?? []));
                appendLedger(m, 'worker.constraint-rebased', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, to_session: worker.session_id, generation: m.continuation.generation, constraint: text.slice(0, 300) } });
                void this.events?.(runtimeSignal('worker.constraint-rebased', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { generation: m.continuation.generation } }));
                reconciled++;
            }
            catch (error) {
                this.scheduler.release(worker.id);
                worker.status = 'ready';
                task.status = task.result ? 'waiting' : 'blocked';
                this.registry.set(worker);
                appendLedger(m, 'worker.constraint-rebase.failed', { task_id: task.id, worker_id: worker.id, payload: { from_session: oldSession, error: String(error), generation: m.continuation.generation } });
            }
        }
        syncMissionGates(m);
        return reconciled;
    }
    async noteNativeWriteSet(m, workerID, files, source = 'session-diff', stateHash) { return this.#results.noteNativeWriteSet(m, workerID, files, source, stateHash); }
    noteNativeStatus(m, workerID, status) { this.#results.noteNativeStatus(m, workerID, status); }
    applyResult(m, workerID, result) { this.#results.applyResult(m, workerID, result); }
    async recoverStagnation(m, level) { return this.#recovery.recoverStagnation(m, level); }
    async recoverRuntimeFailure(m, workerID, error) { return this.#recovery.recoverRuntimeFailure(m, workerID, error); }
    fail(m, workerID, error) { this.#recovery.fail(m, workerID, error); }
    peek(m, id) { const task = m.execution.tasks.find(t => t.id === id), worker = m.execution.workers.find(w => w.id === id || w.id === task?.worker_id); return { task, worker }; }
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
    } worker.status = 'cancelled'; this.scheduler.release(worker.id); const t = m.execution.tasks.find(x => x.id === worker.task_id); if (t)
        t.status = 'cancelled'; this.registry.delete(worker.id); this.#queue = this.#queue.filter(q => q.worker.id !== worker.id); appendLedger(m, 'worker.cancelled', { task_id: t?.id, worker_id: worker.id }); syncMissionGates(m); this.drainQueue(); return true; }
}
