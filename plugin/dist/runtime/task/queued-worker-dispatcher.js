import { runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { EMPTY_PROJECT_SCHEDULING_PEER_VIEW } from '../scheduler/project-peer-view.js';
import { runtimeSignal } from '../events/event-sink.js';
import { appendLedger } from '../ledger/ledger.js';
import { clearCapabilityUnavailable, markCapabilityUnavailable } from '../readiness/capability-failure.js';
import { reserveTaskRuntimeDispatch, bindTaskRuntimeHost, releaseTaskRuntimeReservation } from '../scheduler/task-runtime-adapter.js';
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js';
import { beginWorkerAttempt } from '../worker/worker-runtime.js';
import { projectDirectDependencyOutcomes, renderDirectDependencyOutcomeContext, DependencyOutcomeProjectionError } from '../execution/dependency-outcome-projection.js';
import { targetedVerificationHint } from '../verification/discovery.js';
import { renderSemanticContext, semanticContextsForTargets } from '../semantic/typescript-context.js';
import { projectContextGroups, renderProjectedContext } from '../context/projection.js';
import { clipList, clipText } from '../context/budget.js';
import { workerHandoffText } from './contracts.js';
import { taskSpecificResultContractInstructions } from './result-contract-instructions.js';
import { methodologyCatalog } from '../methodology/catalog.js';
import { ownershipContract } from '../skills/methodology.js';
import { verificationEconomyInstruction } from '../verification/policy.js';
import { isHiReviewerRole } from '../roles/catalog.js';
import { taskPromptToolOverrides } from '../routing/execution-profile.js';
/**
 * Stateless post-admission dispatcher. Durable Task/Worker/ExecutionProfile state is the
 * dispatch recipe; process-local queue entries only schedule when that recipe may run.
 */
export class QueuedWorkerDispatcher {
    childHost;
    child;
    registry;
    scheduler;
    projectRoot;
    scopedStores;
    getConfig;
    getModels;
    getHostConfig;
    workspaceBinding;
    cleanupWorkspaceForTask;
    blockDependencyOutcome;
    events;
    previewManager;
    getProjectPeerView;
    constructor(childHost, child, registry, scheduler, projectRoot, scopedStores, getConfig, getModels, getHostConfig, workspaceBinding, cleanupWorkspaceForTask, blockDependencyOutcome, events, previewManager, getProjectPeerView = () => EMPTY_PROJECT_SCHEDULING_PEER_VIEW) {
        this.childHost = childHost;
        this.child = child;
        this.registry = registry;
        this.scheduler = scheduler;
        this.projectRoot = projectRoot;
        this.scopedStores = scopedStores;
        this.getConfig = getConfig;
        this.getModels = getModels;
        this.getHostConfig = getHostConfig;
        this.workspaceBinding = workspaceBinding;
        this.cleanupWorkspaceForTask = cleanupWorkspaceForTask;
        this.blockDependencyOutcome = blockDependencyOutcome;
        this.events = events;
        this.previewManager = previewManager;
        this.getProjectPeerView = getProjectPeerView;
    }
    run(m, task, worker, transient = {}) {
        const profile = task.execution_profile;
        if (!profile)
            throw new Error(`Queued task ${task.id} has no durable execution profile`);
        const role = worker.role, objective = task.objective, catalog = methodologyCatalog(this.projectRoot), contextArtifactStore = this.scopedStores.contextArtifacts;
        const primary = profile.model ?? worker.model, chain = [...new Set([primary, ...profile.fallback_models].filter((x) => Boolean(x)))];
        if (!chain.length)
            throw new Error(`Queued task ${task.id} has no durable model chain`);
        const approvalGated = worker.methodologies.filter(item => item.permission === 'ask' && worker.selected_methodologies.includes(item.name)).map(item => item.name);
        const requiredBrowserOrigins = profile.browser_required_origins ?? [], localPreviewHint = role === 'visual-qa' && profile.browser_backend === 'bounded-playwright' && this.previewManager && !(profile.browser_allowed_origins ?? []).length && !requiredBrowserOrigins.length ? `LOCAL STATIC PREVIEW: task_id=${task.id}. For a task-scoped local HTML target, call hi_browser_preview_open with task_id=${task.id} and the exact project-relative path before inspect/click/screenshot. This Hi-owned loopback preview writes no project files and owns cleanup.` : undefined, requiredBrowserHint = role === 'visual-qa' && requiredBrowserOrigins.length ? `REQUIRED LIVE BROWSER ORIGIN(S): ${requiredBrowserOrigins.join(', ')}. Navigate to the exact live URL named by the task objective on one of these origins. hi_browser_preview_open is a static-file fallback only and MUST NOT substitute for this live target. Browser-derived PASS evidence from any other origin is inadmissible.` : undefined;
        const artifactGroups = task.context_artifacts.map(a => { const id = a.source_ref.startsWith('hi-artifact:') ? a.source_ref.slice('hi-artifact:'.length) : undefined, stored = id ? contextArtifactStore.get(id) : undefined, text = stored?.freshness === 'FRESH' ? `artifact:${stored.artifact_id}:${stored.summary}\n${clipText(stored.content, 3000)}` : stored ? `artifact-stale:${stored.artifact_id}:${stored.summary}` : `${a.kind}:${a.title ?? a.source_handle_id ?? a.id}${a.summary ? ` — ${a.summary}` : ''}`; return { id: `artifact:${a.id}`, items: [text], priority: a.priority, protection: a.protection, freshness: stored?.freshness ?? a.freshness, content_hash: stored?.content_hash ?? a.content_hash, source_ref: a.source_ref }; });
        const verificationHint = targetedVerificationHint(this.projectRoot, task.scope.length ? task.scope : (m.vcs.changed_files.length ? m.vcs.changed_files : m.identity.intent.likelyTargets ?? [])), semanticContexts = semanticContextsForTargets(this.projectRoot, task.scope, task.id, 3000), semanticGroups = semanticContexts.map(x => ({ id: `semantic:${x.id}`, items: [renderSemanticContext(x)], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'FRESH', content_hash: x.source_hash, source_ref: x.source_ref })), explicitGroups = (transient.relevantContext ?? []).map((text, index) => ({ id: `explicit:${index}`, items: [text], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'UNKNOWN' })), runtimeGroups = [...(requiredBrowserHint ? [{ id: 'runtime:required-browser-target', items: [requiredBrowserHint], priority: 'high', protection: 'PROTECTED', freshness: 'FRESH', required: true }] : []), ...(localPreviewHint ? [{ id: 'runtime:local-preview', items: [localPreviewHint], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'FRESH' }] : []), ...(verificationHint ? [{ id: 'runtime:verification-hint', items: [verificationHint], priority: 'normal', protection: 'COMPRESSIBLE', freshness: 'FRESH' }] : []), ...semanticGroups, ...artifactGroups];
        if (semanticContexts.length)
            appendLedger(m, 'context.semantic-selected', { task_id: task.id, payload: { items: semanticContexts.slice(0, 6).map(x => ({ id: x.id, source_ref: x.source_ref, source_hash: x.source_hash.slice(0, 16), symbols: x.symbols.length, chars: x.budget.used_chars })), total_chars: semanticContexts.reduce((n, x) => n + x.budget.used_chars, 0) } });
        const prepareBaseContext = async () => { let groups = [...explicitGroups, ...runtimeGroups], raw = groups.flatMap(g => g.items).join('\n').length; if (raw > profile.max_context_chars && this.childHost.capabilities.summarize)
            try {
                const summary = await this.childHost.summarize(m.identity.session_id), nativeSummary = clipText(typeof summary === 'string' ? summary : JSON.stringify(summary), Math.min(6000, Math.floor(profile.max_context_chars / 2)));
                groups = [{ id: 'native:session-summary', items: [`native-session-summary:${nativeSummary}`], priority: 'high', protection: 'COMPRESSIBLE', freshness: 'FRESH' }, ...runtimeGroups];
                appendLedger(m, 'context.native-summary-used', { task_id: task.id, payload: { source_session: m.identity.session_id, replaced_explicit_context: true } });
            }
            catch (error) {
                appendLedger(m, 'context.native-summary-unavailable', { task_id: task.id, payload: { error: String(error) } });
            } return groups; };
        return this.registry.dedupeSpawn(`${m.identity.mission_id}\0${worker.fingerprint}`, async () => {
            const baseContextGroups = await prepareBaseContext(), askGatedTools = Object.entries(profile.permission_profile.native?.decisions ?? {}).filter(([, value]) => value === 'ask').map(([name]) => name).sort(), askGatedInstruction = askGatedTools.length ? `host ask-gated tools remain available under OpenCode native permission control: ${askGatedTools.join(', ')}. Use them only when materially required. If OpenCode denies a required action, do not retry or bypass the denial; return BLOCKED/NEEDS_CONTEXT with the exact required action.` : undefined, processLifecycleInstruction = profile.process_lifecycle === true ? `This exact child task owns long-running process execution; the parent cannot proxy hi_process_* calls for you. For a command that must outlive one shell turn (dev/app server, watcher, service), use hi_process_spawn with worker_id=${worker.id}. hi_process_spawn is executable+argv, not a shell command string: put only argv[0] in command and all arguments in args_json (for example command="python3", args_json="[\"app.py\"]"). If explicit shell semantics are truly required, use command="bash" with args_json="[\"-c\",\"...\"]"; never embed arguments inside command. Persistent service path: OMIT timeout_ms so the service is not killed by a hard wall-clock deadline; inspect bounded output/health and exercise only the running service behavior needed to establish lifecycle readiness.${requiredBrowserOrigins.length ? ` This visual task has immutable exact browser origin(s): ${requiredBrowserOrigins.join(', ')}. Any browser-verified service you spawn MUST bind and declare one of those exact origins including the exact port in service_origins. Do not choose a different port and do not expect process output to widen browser authority; if the exact planned origin cannot be served, return BLOCKED/FIX_REQUIRED so the parent can replan.` : ''} A lifecycle-support task with no required_evidence/obligation ownership must not run mission-wide test/build/review suites or claim mission verification; leave those to the parent or a separately admitted verification owner. Then hi_process_kill followed by hi_process_cleanup when the parent/dedicated verification flow no longer needs the service. hi_process_wait is only for a process that is expected to terminate naturally or by an intentionally requested finite hard deadline; do not call it merely to keep a server/watcher/service alive. Never inflate timeout_ms and replay the same healthy persistent command. Use hi_process_read/write/kill/cleanup/list only for this worker's own returned process IDs. Do not use shell '&', nohup, setsid, disown, pkill, killall, or adopt a foreign PID as a substitute.` : undefined;
            const buildHandoff = (dependencyContext) => { const preexisting = Object.keys(worker.native_diff_baseline ?? {}).slice(0, 60), priorOutcome = this.scopedStores.taskOutcomeMemory.renderAdvisory(m, task, 1200), groups = [...(dependencyContext ? [{ id: 'dependency:direct-outcomes', items: [dependencyContext], priority: 'high', protection: 'PROTECTED', freshness: 'FRESH', required: true }] : []), ...(priorOutcome ? [{ id: 'project:prior-task-outcomes', items: [priorOutcome], priority: 'normal', protection: 'COMPRESSIBLE', freshness: 'FRESH' }] : []), ...baseContextGroups], projection = projectContextGroups(groups, 5000); if (!projection.complete)
                throw new Error(`Required context projection exceeds worker handoff budget: ${projection.missing_required.join(', ')}`); const dispatchRelevant = renderProjectedContext(projection); if (priorOutcome && projection.selected.some(g => g.id === 'project:prior-task-outcomes'))
                appendLedger(m, 'task-outcome-memory.recalled', { task_id: task.id, worker_id: worker.id, payload: { chars: priorOutcome.length, evidence_authority: false, routing_authority: false, source_state_bound: true } }); appendLedger(m, 'context.projection-selected', { task_id: task.id, worker_id: worker.id, payload: { budget_chars: projection.budget_chars, used_chars: projection.used_chars, selected: projection.selected.map(g => g.id).slice(0, 24), omitted: projection.omitted.slice(0, 24), duplicates: projection.duplicate_groups.slice(0, 24), atomic: true, utility: 'deterministic-metadata-only' } }); const visualCoverage = taskSpecificResultContractInstructions(task, worker.role); const explorationClearance = m.identity.intent.ambiguity !== 'none' && worker.role === 'repository-explorer' ? [`EXPLORATION CLEARANCE RESULT CONTRACT: this is separate from TASK REQUIRED EVIDENCE and mission verification. If repository context is sufficient, return context_gap=\"none\" and one passed evidence claim with kind=\"source-provenance-evidence\", summary, exact project-relative scope, evidence_refs containing only HI_SOURCE_READ_RECEIPT evidence_ref tokens appended to successful current-attempt OpenCode read outputs, and outcome=\"passed\". Every scope file must have a matching cited read receipt; never invent or alias receipt IDs. If the required source is not actually read/current, return NEEDS_CONTEXT/FIX_REQUIRED instead of claiming clearance.`, ...(m.identity.intent.ambiguity === 'contract-critical' ? [`CONTRACT-CRITICAL EXPLORATION: also return one passed evidence claim with kind=\"decision-evidence\", the same bounded source scope, and evidence_refs citing the same current-attempt HI_SOURCE_READ_RECEIPT tokens. This is a structured decision claim for ambiguity clearance, not mission verification proof.`] : [])] : []; const core = workerHandoffText({ objective, scope: task.scope, constraints: clipList([...(task.constraints ?? []), 'minimum sufficient change', 'no unrequested publish/push/deploy', 'return compact evidence', askGatedInstruction ?? '', processLifecycleInstruction ?? '', preexisting.length ? `pre-existing user dirty paths at worker start: ${preexisting.join(', ')}; preserve their exact baseline state unless the task explicitly requires changing them; never use git checkout/reset/restore in a way that discards user-owned edits` : 'no pre-existing native dirty paths were observed at worker start', verificationEconomyInstruction(m, task.requiredEvidence)], 5000), required_evidence: task.requiredEvidence, relevant_context: dispatchRelevant, methodologies: worker.selected_methodologies, methodology_exit_requirements: worker.selected_methodologies.flatMap(name => { const item = catalog.find(x => x.name === name); return item ? [`${name}: ${item.exitRequirements.join(', ')}`] : []; }), approval_gated_methodologies: approvalGated, result_contract_instructions: [...explorationClearance, ...visualCoverage], expected_output: { status: true, summary: true, changed_files: true, scope_expansions: true, evidence: true, verification_coverage: visualCoverage.length ? true : undefined, findings: isHiReviewerRole(worker.role) ? true : undefined, open_issues: true } }, profile.max_handoff_chars); return clipText([ownershipContract('child', worker.selected_methodologies), core].filter(Boolean).join('\n\n'), profile.max_handoff_chars); };
            let dependencyContext;
            try {
                const outcomes = projectDirectDependencyOutcomes(m, task);
                dependencyContext = renderDirectDependencyOutcomeContext(outcomes, Math.min(5000, profile.max_context_chars));
                if (dependencyContext)
                    appendLedger(m, 'dependency.outcomes-projected', { task_id: task.id, worker_id: worker.id, payload: { dependencies: outcomes.map(item => item.task_id), chars: dependencyContext.length, evidence_authority: false } });
            }
            catch (error) {
                if (error instanceof DependencyOutcomeProjectionError)
                    await this.blockDependencyOutcome(m, task, worker, error);
                throw error;
            }
            let lastError = new Error('No runtime model available');
            for (let i = 0; i < chain.length; i++) {
                if (m.identity.status !== 'active' || m.continuation.user_interrupted || worker.status === 'cancelled') {
                    worker.status = 'cancelled';
                    task.status = 'cancelled';
                    throw new Error('Mission stopped before worker dispatch');
                }
                const model = chain[i], variant = model === primary ? profile.model_variant : profile.fallback_variants?.[model], runtimeCandidate = runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig(), role);
                if (!runtimeCandidate.ok) {
                    lastError = new Error(`Runtime model candidate rejected at dispatch: ${model}: ${runtimeCandidate.reason}`);
                    appendLedger(m, 'model.fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: runtimeCandidate.reason, index: i, phase: 'dispatch-revalidation' } });
                    continue;
                }
                clearCapabilityUnavailable(m, 'model-dispatch');
                const reservation = reserveTaskRuntimeDispatch(m, worker, model, this.scheduler, Date.now(), this.getProjectPeerView(m));
                if (!reservation.accepted) {
                    lastError = new Error(`Worker scheduler admission unavailable: ${reservation.reason}`);
                    appendLedger(m, 'model.fallback.skipped', { task_id: task.id, worker_id: worker.id, payload: { model, reason: reservation.reason, index: i, source: 'scheduler' } });
                    continue;
                }
                worker.model = model;
                worker.model_variant = variant;
                try {
                    worker.status = 'starting';
                    task.status = 'queued';
                    this.child.recordModelProjection(worker, model, variant);
                    const spawned = await this.child.createForTask(m.identity.session_id, `Hi · ${role} · ${objective.slice(0, 60)}`, role, model === 'host-default' ? undefined : model, variant, transient.forkFromSession, this.workspaceBinding(m, task.id)), child = spawned.child;
                    if (transient.forkFromSession)
                        appendLedger(m, 'worker.session-fork', { task_id: task.id, worker_id: worker.id, payload: { source_session: transient.forkFromSession, native: spawned.fork.nativeAvailable, used: spawned.fork.used, reason: spawned.fork.reason } });
                    if (m.identity.status !== 'active' || m.continuation.user_interrupted || worker.status === 'cancelled') {
                        if (child?.id)
                            try {
                                await this.child.abortNativeSession(m, child.id, 'spawn-cancelled', worker.id, task.id);
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
                    recordPreexistingUserBaseline(m, await this.child.captureNativeDiff(worker, 'baseline'));
                    worker.generation_at_spawn = m.continuation.generation;
                    worker.status = 'busy';
                    worker.started_at = Date.now();
                    task.status = 'running';
                    this.registry.set(worker);
                    if (i > 0) {
                        const fallbackReason = profile.fallback_reasons?.[i - 1]?.reason ?? `fallback-index:${i}`;
                        worker.fallback_history = [...(worker.fallback_history ?? []), { from: chain[i - 1], to: model, variant, reason: fallbackReason, phase: 'dispatch', at: Date.now() }];
                    }
                    void this.events?.(runtimeSignal('worker.started', m.identity.mission_id, { task_id: task.id, worker_id: worker.id, payload: { model, variant, role } }));
                    appendLedger(m, 'worker.started', { task_id: task.id, worker_id: worker.id, payload: { session_id: worker.session_id, model, variant, index: i, reason: i === 0 ? (worker.requested_model_variant ? [...(worker.model_selection_reason ?? []), 'user-specified-variant'] : (worker.model_selection_reason ?? [])) : [profile.fallback_reasons?.[i - 1]?.reason ?? 'runtime fallback', `fallback-index:${i}`] } });
                    const refreshedOutcomes = projectDirectDependencyOutcomes(m, task), refreshedDependencyContext = renderDirectDependencyOutcomeContext(refreshedOutcomes, Math.min(5000, profile.max_context_chars));
                    if (refreshedDependencyContext !== dependencyContext) {
                        appendLedger(m, 'dependency.outcomes-refreshed', { task_id: task.id, worker_id: worker.id, payload: { dependencies: refreshedOutcomes.map(item => item.task_id), previous_chars: dependencyContext?.length ?? 0, current_chars: refreshedDependencyContext?.length ?? 0 } });
                        dependencyContext = refreshedDependencyContext;
                    }
                    const handoff = buildHandoff(dependencyContext);
                    appendLedger(m, 'worker.handoff', { task_id: task.id, worker_id: worker.id, payload: { chars: handoff.length, methodologies: worker.selected_methodologies.length, tools: profile.tools.slice(0, 20), permission_source: profile.permission_profile.native?.source, context_budget: profile.max_context_chars, handoff_budget: profile.max_handoff_chars, result_budget: profile.max_result_chars } });
                    beginWorkerAttempt(task, worker);
                    await this.child.sendProviderPrompt(worker.session_id, handoff, role, model === 'host-default' ? undefined : model, variant, taskPromptToolOverrides(profile.tools, this.getHostConfig(), profile.mcp_servers ?? []), worker.attempt_prompt_message_id);
                    return worker;
                }
                catch (error) {
                    lastError = error;
                    const hostExecutionStarted = Boolean(worker.session_id);
                    let hostStopped = true;
                    if (worker.session_id) {
                        try {
                            hostStopped = await this.child.abortNativeSession(m, worker.session_id, 'dispatch-fallback', worker.id, task.id);
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
                    worker.status = 'created';
                    task.status = 'created';
                    if (hostExecutionStarted) {
                        appendLedger(m, 'worker.start.post-child-failure', { task_id: task.id, worker_id: worker.id, payload: { model, index: i, error: String(error), fallback_allowed: false } });
                        break;
                    }
                    appendLedger(m, 'model.fallback.failed', { task_id: task.id, worker_id: worker.id, payload: { model, index: i, error: String(error) } });
                }
            }
            worker.status = 'failed';
            const liveStatuses = chain.map(model => ({ model, ...runtimeModelCandidateStatus(model, this.getModels(), this.getConfig(), this.getHostConfig(), role) })), policyUnavailable = liveStatuses.length > 0 && liveStatuses.every(x => !x.ok);
            if (policyUnavailable) {
                task.status = 'blocked';
                const marker = `model-dispatch-unavailable:${task.id}`;
                markCapabilityUnavailable(m, { capability: 'model-dispatch', reason: 'No selected role model/fallback remains runtime-available and policy-permitted at dispatch time.', taskId: task.id, workerId: worker.id });
                task.result = { status: 'BLOCKED', summary: 'No selected role model/fallback remains runtime-available and policy-permitted at dispatch time.', changed_files: [], evidence: [], open_issues: [marker], needs_context: ['refresh provider/model inventory or routing/provider permissions'] };
                appendLedger(m, 'worker.start.model-unavailable', { task_id: task.id, worker_id: worker.id, payload: { attempted: liveStatuses } });
            }
            else
                task.status = 'failed';
            await this.cleanupWorkspaceForTask(m, task.id);
            appendLedger(m, 'worker.start.failed', { task_id: task.id, worker_id: worker.id, payload: { error: String(lastError), attempted_models: chain } });
            throw lastError;
        });
    }
}
