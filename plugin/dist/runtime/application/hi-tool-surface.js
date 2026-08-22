import { runDoctor, formatDoctor } from '../../doctor/checks.js';
import { compactLedgerReport } from '../ledger/report.js';
import { aggregateMissionMetrics } from '../ledger/metrics.js';
import { formatUserMissionStatus } from '../ledger/status.js';
import { evaluatePreconditions, TaskPreconditionError } from '../readiness/preconditions.js';
import { clearCapabilityUnavailable, firstCapabilityBlocker, markCapabilityUnavailable } from '../readiness/capability-failure.js';
import { parseSemanticIntentAssessment } from '../intent/semantic-assessment.js';
import { syncMissionGates } from '../gates/gates.js';
import { appendLedger } from '../ledger/ledger.js';
import { redactProviderContext } from '../privacy/boundary.js';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { hostCapabilityByID } from '../../contracts/host-capability.js';
import { registerTemporaryMutation, resolveRollback } from '../mutations/temporary-mutations.js';
import { markMutation, normalizeProjectPath, addEvidence } from '../evidence/evidence-runtime.js';
import { evidenceProducerAttemptForWorker } from '../evidence/applicability.js';
import { assessChangedFileOwnership, assessRequiredTargetCoverage } from '../task/diff-ownership.js';
import { replanVerificationForChangedSurface, verificationEnvelopeFor, verificationSatisfied } from '../verification/policy.js';
import { collectRepoContext } from '../intent/repo-context.js';
import { bindParentMethodologyNeeds } from '../methodology/activation.js';
import { reconcileMethodologyExits } from '../methodology/exit.js';
import { evaluateCompletion } from '../completion/evaluator.js';
import { projectControlDecision } from '../completion/control-projection.js';
import { primaryRoleCanDirectImplementation } from '../roles/catalog.js';
import { inspectCurrentGitChangedFiles } from '../safety/staging-safety.js';
import { nativeTool as tool } from '../../opencode/plugin-tool.js';
import { assertHiToolNamespace } from '../../opencode/tool-namespace.js';
import { MODEL_ROUTED_CHILD_ROLES, isModelRoutedChildRole } from '../../config/schema.js';
import { normalizeBoundedProjectPath } from '../../contracts/common.js';
function optionalIdList(value) {
    if (value === undefined || value === null)
        return undefined;
    const raw = Array.isArray(value) ? value.map(String) : String(value).split(',');
    return raw.map(x => x.trim()).filter(x => x.length > 0 && !/^(?:none|null|n\/?a)$/i.test(x));
}
function optionalScopeList(value) {
    if (value === undefined || value === null)
        return undefined;
    const rawParts = Array.isArray(value) ? value.map(String) : undefined, rawString = rawParts ? undefined : String(value), semicolonParts = rawString?.includes(';') ? rawString.split(';').map(x => x.trim()).filter(Boolean) : undefined, semicolonExact = semicolonParts?.length && semicolonParts.every(part => !/\s/.test(part) && Boolean(normalizeBoundedProjectPath(part))), parts = (rawParts ?? (semicolonExact ? semicolonParts : rawString.split(','))).map(x => x.trim()).filter(Boolean);
    if (!parts.length)
        return undefined;
    const out = [];
    for (const part of parts) {
        if (/^(?:none|null|n\/?a)$/i.test(part))
            continue;
        if (!/\s/.test(part)) {
            const exact = normalizeBoundedProjectPath(part);
            if (!exact)
                throw new Error(`Hi task scope must use bounded project-relative paths: ${part}`);
            out.push(exact);
            continue;
        }
        const candidates = [...part.matchAll(/(?:^|[\s`'"(])((?:\.\/)?[A-Za-z0-9_@+.-]+(?:\/[A-Za-z0-9_@+.-]+)+|[A-Za-z0-9_@+-]+\.[A-Za-z0-9]{1,12})(?=$|[\s`'"),.;:!?])/g)].map(m => normalizeBoundedProjectPath(m[1])).filter((x) => Boolean(x));
        const unique = [...new Set(candidates)];
        if (unique.length !== 1)
            throw new Error(`Hi task scope prose must identify exactly one bounded project-relative path; use comma-separated exact paths for multiple targets`);
        out.push(unique[0]);
    }
    return out.length ? [...new Set(out)] : undefined;
}
import { runtimeModelCandidateStatus } from '../routing/model-resolver.js';
import { setProjectRoleModels } from '../../config/auto-init.js';
import { resolveHiConfigWithReport } from '../../config/resolver.js';
import { resolveBrowserExecutionOwner } from '../browser/ownership.js';
function nativeDiffFiles(raw, projectRoot) { const items = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []; return [...new Set(items.map((x) => typeof x?.file === 'string' ? x.file : typeof x?.path === 'string' ? x.path : '').filter((x) => Boolean(x)).map((x) => normalizeProjectPath(x, projectRoot)).filter(Boolean))]; }
export function createHiToolSurface(input) {
    const { state, store, tasks, processRuntime, workspaceRuntime, browserExecutor, previewManager, projectRoot, workingDirectory, capabilities, native, getModels, scopedStores, getBrowserBootstrapStatus } = input;
    const doctorTool = tool({ description: 'Run OpenCode-Hi runtime/configuration health checks', args: {}, execute: async () => { const browserHealth = browserExecutor ? await browserExecutor.health() : { available: false }, runtimeHostResources = new Set(browserHealth.available ? ['host-capability:browser-execution'] : []); return formatDoctor(runDoctor(state.config, store, projectRoot, { models: getModels(), resolution: state.configResolution, capabilities, hostConfig: state.hostConfig, openCodeVersion: state.openCodeVersion, runtimeHostResources, browserBootstrap: getBrowserBootstrapStatus?.() })); } });
    const statusTool = tool({ description: 'Show compact user-facing Hi mission status. This intentionally excludes diagnostic logs and ledger payloads.', args: {}, execute: async (_args, c) => { const m = store.get(c?.sessionID); return m ? formatUserMissionStatus(m) : 'Hi: no active mission'; } });
    const roleModelsTool = tool({ description: 'Configure Hi child-role models from chat using only the effective connected OpenCode runtime inventory. Use action=list first when the user asks to configure role models; action=set persists an explicit role model/fallback list; action=clear returns one role to automatic routing. Primary manager/working-manager models remain OpenCode-owned.', args: { action: tool.schema.string(), role: tool.schema.string().optional(), models: tool.schema.string().optional() }, execute: async (a) => {
            const action = String(a?.action ?? 'list').trim().toLowerCase(), available = getModels(), configured = state.config.routing.roleModels ?? {}, modelRows = available.map(model => ({ id: model.id, provider: model.provider ?? null, vision: model.visionCapable === true, variants: model.variants ?? [] }));
            const roles = Object.fromEntries(MODEL_ROUTED_CHILD_ROLES.map(role => [role, configured[role]?.[0] ?? null]));
            if (action === 'list')
                return JSON.stringify({ status: 'OK', models: modelRows, roles, role_models: Object.fromEntries(MODEL_ROUTED_CHILD_ROLES.map(role => [role, configured[role] ?? []])), note: 'Only effective connected OpenCode models are listed. Tell me which model(s) each child role should use; primary Manager/Working Manager model selection stays in OpenCode.' });
            const role = String(a?.role ?? '').trim();
            if (!isModelRoutedChildRole(role))
                return JSON.stringify({ status: 'BLOCKED', reason: 'unsupported-child-role', allowed_roles: MODEL_ROUTED_CHILD_ROLES });
            if (action === 'clear') {
                setProjectRoleModels(projectRoot, role, []);
                const resolved = resolveHiConfigWithReport(state.hostConfig.hi, projectRoot);
                state.config = resolved.config;
                state.configResolution = resolved.report;
                return JSON.stringify({ status: 'APPLIED', role, role_models: state.config.routing.roleModels, note: 'Role returned to automatic runtime selection; no inferred preference is persisted.' });
            }
            if (action !== 'set')
                return JSON.stringify({ status: 'BLOCKED', reason: 'unsupported-action', allowed_actions: ['list', 'set', 'clear'] });
            const requested = [...new Set(String(a?.models ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
            if (!requested.length)
                return JSON.stringify({ status: 'BLOCKED', reason: 'model-list-empty' });
            const rejected = requested.map(id => ({ id, ...runtimeModelCandidateStatus(id, available, state.config, state.hostConfig, role) })).filter(x => !x.ok);
            if (rejected.length) {
                const vision = rejected.some(x => String(x.reason).includes('vision'));
                return JSON.stringify({ status: 'BLOCKED', reason: vision ? 'role-requires-vision-capable-model' : 'model-unavailable-or-policy-rejected', role, rejected, available_models: modelRows });
            }
            setProjectRoleModels(projectRoot, role, requested);
            const resolved = resolveHiConfigWithReport(state.hostConfig.hi, projectRoot);
            state.config = resolved.config;
            state.configResolution = resolved.report;
            return JSON.stringify({ status: 'APPLIED', role, models: requested, role_models: state.config.routing.roleModels, restart_required: false, note: 'The active Hi runtime now uses this explicit child-role mapping for new worker dispatches.' });
        } });
    const metricsTool = tool({ description: 'Show aggregate Hi runtime metrics derived from bounded mission state. Token/cost telemetry is omitted unless the host provides it.', args: {}, execute: async () => JSON.stringify(aggregateMissionMetrics(store.all())) });
    const ledgerTool = tool({ description: 'Show a bounded Hi execution ledger/report on demand.', args: { limit: tool.schema.number().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(compactLedgerReport(m, a?.limit ?? 40)) : 'No active Hi mission'; } });
    const readinessTool = tool({ description: 'Show machine-readable Hi mission readiness/preconditions and gates.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(evaluatePreconditions(m, projectRoot)) : 'No active Hi mission'; } });
    const intentAssessTool = tool({ description: 'Submit the host-primary semantic interpretation of the current user message to the host-agnostic Hi Core intent contract. Natural-language semantics belong here, not in language-specific runtime regexes.', args: { revision: tool.schema.number(), assessment_json: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; if (m.identity.semantic_assessment.status !== 'pending')
            return JSON.stringify({ status: 'ALREADY_ASSESSED', revision: m.identity.semantic_assessment.revision }); if (Number(a.revision) !== m.identity.semantic_assessment.revision)
            return JSON.stringify({ status: 'STALE_ASSESSMENT', expected_revision: m.identity.semantic_assessment.revision }); try {
            const assessment = parseSemanticIntentAssessment(String(a.assessment_json)), phase = m.identity.semantic_assessment.phase, pendingText = m.identity.semantic_assessment.pending_text;
            const next = phase === 'initial' ? store.applyInitialSemanticAssessment(c.sessionID, assessment) : store.applyFollowupSemanticAssessment(c.sessionID, assessment);
            let reconciledWorkers = 0;
            if (phase === 'followup') {
                if (assessment.message_kind === 'stop') {
                    await processRuntime.stopMission(next);
                    reconciledWorkers = await tasks.cancelAll(next);
                    if (workspaceRuntime)
                        await workspaceRuntime.cleanupMission(next);
                }
                else if (assessment.message_kind === 'constraint')
                    reconciledWorkers = await tasks.reconcileUserConstraint(next, pendingText);
                else
                    reconciledWorkers = await tasks.resumeAfterSemanticAssessment(next, assessment.message_kind);
            }
            return JSON.stringify({ status: assessment.material ? 'ASSESSED' : 'NON_MATERIAL', phase, revision: next.identity.semantic_assessment.revision, message_kind: assessment.message_kind, task_kind: next.identity.intent.taskKind, scope: next.identity.intent.scope, risk: next.identity.risk, methodologies: next.methodology.methodology_needs.map(x => x.name), reconciled_workers: reconciledWorkers, gates: syncMissionGates(next, projectRoot).filter(g => g.status !== 'closed').map(g => ({ id: g.id, status: g.status, reason: g.reason })) });
        }
        catch (error) {
            appendLedger(m, 'semantic.assessment-rejected', { payload: { revision: m.identity.semantic_assessment.revision, error: String(error) } });
            return JSON.stringify({ status: 'INVALID_ASSESSMENT', error: String(error) });
        } } });
    const artifactAddTool = tool({ description: 'Attach one bounded context artifact reference to the current Hi mission. Optional long content is retained by the Context owner and referenced by hash/handle.', args: { kind: tool.schema.string(), title: tool.schema.string().optional(), uri: tool.schema.string().optional(), summary: tool.schema.string().optional(), sha256: tool.schema.string().optional(), content: tool.schema.string().optional(), source_files: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const kind = String(a.kind).slice(0, 80), summary = a.summary ? String(a.summary).slice(0, 2000) : a.title ? String(a.title).slice(0, 300) : kind, sourceFiles = a.source_files ? String(a.source_files).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 32) : [], content = typeof a.content === 'string' && a.content.length ? redactProviderContext(String(a.content)).providerText : undefined, stored = content ? scopedStores.contextArtifacts.add(kind, summary, content, sourceFiles, { producer: 'hi-context-artifact-add', privacyClass: 'redacted' }) : undefined, raw = String(a.uri ?? summary ?? kind), item = { id: stored?.artifact_id ?? `ca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, kind, title: a.title ? String(a.title).slice(0, 300) : undefined, uri: stored ? `hi-artifact:${stored.artifact_id}` : a.uri ? String(a.uri).slice(0, 1200) : undefined, summary, sha256: stored?.content_hash ?? (a.sha256 ? String(a.sha256) : createHash('sha256').update(raw).digest('hex')), added_at: Date.now() }; const existingHandle = m.context.context_artifacts.find(x => x.id === item.id); if (!existingHandle) {
            m.context.context_artifacts.push(item);
            if (m.context.context_artifacts.length > 8)
                m.context.context_artifacts.splice(0, m.context.context_artifacts.length - 8);
        } const effective = existingHandle ?? item; appendLedger(m, existingHandle ? 'context-artifact.reused' : 'context-artifact.added', { payload: { id: effective.id, kind: effective.kind, sha256: effective.sha256, durable: Boolean(stored), source_files: sourceFiles.slice(0, 16), deduplicated: Boolean(existingHandle) } }); return JSON.stringify(effective); } });
    const artifactsTool = tool({ description: 'List bounded Hi context artifact references.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(m.context.context_artifacts) : 'No active Hi mission'; } });
    const mutationTool = tool({ description: 'Register a temporary execution mutation. Prefer native session revert for project-local tracked experiments; use an exact rollback command only for native-coverage gaps.', args: { kind: tool.schema.string(), description: tool.schema.string(), rollback_command: tool.schema.string().optional(), native_revert: tool.schema.boolean().optional(), session_id: tool.schema.string().optional(), message_id: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const mode = a.native_revert ? 'native-revert' : 'command'; if (mode === 'native-revert' && hostCapabilityByID(capabilities.contracts, 'session-revert')?.status !== 'SUPPORTED') {
            const detail = 'OpenCode native session revert is unavailable';
            const marker = markCapabilityUnavailable(m, { capability: 'session-revert', reason: detail });
            return JSON.stringify({ status: 'USER_ACTION_REQUIRED', reason: 'capability-unavailable', capability: 'session-revert', blocker: marker, detail, alternative: 'register an exact command rollback when safe and available' });
        } if (mode === 'native-revert')
            clearCapabilityUnavailable(m, 'session-revert');
        else if (!m.vcs.temporary_mutations.some(x => x.status === 'active' && x.rollback_mode === 'native-revert'))
            clearCapabilityUnavailable(m, 'session-revert'); return JSON.stringify(registerTemporaryMutation(m, { kind: String(a.kind), description: String(a.description), rollback_command: a.rollback_command ? String(a.rollback_command) : undefined, rollback_mode: mode, session_id: a.session_id ? String(a.session_id) : c?.sessionID, message_id: a.message_id ? String(a.message_id) : undefined })); } });
    const nativeRollbackTool = tool({ description: 'Resolve a registered native-revert temporary mutation through OpenCode session.revert. Evidence remains stale until reverified.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const item = m.vcs.temporary_mutations.find(x => x.id === String(a.id)); if (!item)
            return 'Unknown temporary mutation'; if (item.rollback_mode !== 'native-revert')
            return 'BLOCKED: mutation uses command rollback'; const target = item.session_id ?? m.identity.session_id; const belongs = target === m.identity.session_id || m.execution.workers.some(w => w.session_id === target); if (!belongs)
            return 'BLOCKED: target session is outside this mission'; try {
            await native.revert(target, item.message_id);
            clearCapabilityUnavailable(m, 'session-revert');
            resolveRollback(m, item, true, 'native session revert completed; verification must be refreshed');
            markMutation(m, m.vcs.changed_files, 'native-session-revert');
            return JSON.stringify({ status: 'ROLLED_BACK', id: item.id, session_id: target, evidence_fresh: false });
        }
        catch (error) {
            const detail = String(error);
            resolveRollback(m, item, false, detail);
            if (/unavailable/i.test(detail)) {
                const marker = markCapabilityUnavailable(m, { capability: 'session-revert', reason: detail });
                return JSON.stringify({ status: 'USER_ACTION_REQUIRED', reason: 'capability-unavailable', capability: 'session-revert', blocker: marker, detail });
            }
            return `Native revert failed: ${detail}`;
        } } });
    const directProgressTool = tool({ description: 'Record one bounded parent/Working-Manager direct obligation. obligation_id must be the exact ID only (for example o-analysis), never ID+summary. Call separately for each completed obligation. scope_expansions, when needed, is a JSON array of {file,necessary,reason}. The result reports exact remaining obligations/methodology needs. Implementation requires owned mutation; direct review requires fresh review input. Does not bypass verification/review gates.', args: { summary: tool.schema.string(), obligation_id: tool.schema.string().optional(), scope_expansions: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const missionRoot = m.identity.intent.scope === 'local' ? (workingDirectory ?? projectRoot) : projectRoot; if (m.identity.status === 'completed')
            return JSON.stringify({ status: 'ALREADY_COMPLETED', completion_ready: true, mission_status: 'completed', next: 'STOP', verification_required: false, remaining_obligations: [], methodology_needs: [] }); const rawArgs = a?.input && typeof a.input === 'object' && !Array.isArray(a.input) ? { ...a, ...a.input } : a, requested = rawArgs?.obligation_id ? String(rawArgs.obligation_id) : undefined, requestedOpen = requested ? m.execution.obligations.find(x => x.id === requested && x.status === 'open') : undefined, candidates = m.execution.obligations.filter(x => ['analysis', 'implementation', 'review'].includes(x.kind) && x.status === 'open'), exact = requested ? candidates.find(x => x.id === requested) : undefined, requestedVerificationKinds = requestedOpen?.kind === 'verification' ? [...(requestedOpen.requiredEvidence ?? m.execution.verification_policy.requiredKinds)].map(x => String(x).toLowerCase().trim()) : [], directReviewAlias = requestedOpen?.kind === 'verification' && !m.execution.verification_policy.requireReview && requestedVerificationKinds.length === 1 && requestedVerificationKinds[0] === 'review-evidence' && m.execution.evidence.items.some(e => e.kind === 'review-input' && !e.invalidated_at) ? candidates.find(x => x.kind === 'review') : undefined, semanticSingle = requested && !requested.startsWith('o-') && candidates.length === 1 ? candidates[0] : undefined, o = exact ?? directReviewAlias ?? semanticSingle ?? (!requested && candidates.length === 1 ? candidates[0] : undefined), summary = String(rawArgs?.summary ?? '').trim().slice(0, 1000), candidateIDs = candidates.map(x => x.id); if (!summary)
            return 'BLOCKED: direct progress requires a non-empty bounded summary'; if (requestedOpen?.kind === 'verification' && !directReviewAlias) {
            const envelope = verificationEnvelopeFor(m, requestedOpen.id, missionRoot), missing = envelope.checks.filter(check => check.result !== 'passed').map(check => check.kind);
            appendLedger(m, 'verification.direct-progress-rejected', { payload: { obligation: requestedOpen.id, missing, reason: 'verification-is-evidence-owned' } });
            return JSON.stringify({ status: 'EVIDENCE_REQUIRED', reason: 'verification-is-evidence-owned', obligation_id: requestedOpen.id, required_kinds: [...requestedOpen.requiredEvidence ?? m.execution.verification_policy.requiredKinds], missing_kinds: missing, checks: envelope.checks });
        } if (requested && !requestedOpen && requested.startsWith('o-'))
            return JSON.stringify({ status: 'BLOCKED', reason: 'unknown-obligation-id', requested, candidate_ids: candidateIDs }); if (requestedOpen && !exact && !directReviewAlias)
            return JSON.stringify({ status: 'BLOCKED', reason: `direct-progress-does-not-own-${requestedOpen.kind}`, requested, candidate_ids: candidateIDs }); if (!o)
            return candidates.length > 1 ? JSON.stringify({ status: 'BLOCKED', reason: 'obligation-id-required', candidate_ids: candidateIDs }) : 'No open direct-progress obligation'; if (o.kind === 'review' && m.execution.verification_policy.requireReview)
            return 'BLOCKED: independent reviewer required; direct parent progress cannot close this review obligation'; let directFiles = [...m.vcs.changed_files], currentSource = 'historical-write-events'; if (o.kind === 'implementation') {
            if (!primaryRoleCanDirectImplementation(m.execution.primary_mode))
                return `BLOCKED: primary role ${m.execution.primary_mode} lacks canonical repository write authority for direct implementation progress`;
            if (!m.execution.evidence.last_mutation_at)
                return 'BLOCKED: no observed mutation for direct implementation progress';
            if (!m.vcs.changed_files.length) {
                const recovered = inspectCurrentGitChangedFiles(missionRoot);
                if (recovered === undefined)
                    return 'BLOCKED: mutation observed but changed-file surface is unknown; use file-aware native tools or wait for native file/diff evidence before recording direct progress';
                if (recovered.length) {
                    directFiles = [...new Set(recovered)];
                    m.vcs.changed_files = [...new Set([...m.vcs.changed_files, ...directFiles])];
                    currentSource = 'git-status-recovery';
                    appendLedger(m, 'implementation.changed-surface-recovered', { payload: { source: 'current-git-status', files: directFiles.slice(0, 30) } });
                }
                else
                    return 'BLOCKED: mutation observed but no current Git changed surface exists; reconcile the mutation before recording direct progress';
            }
            let expansions = [];
            if (rawArgs.scope_expansions) {
                try {
                    const parsed = JSON.parse(String(rawArgs.scope_expansions));
                    if (!Array.isArray(parsed))
                        throw new Error('scope_expansions must be a JSON array');
                    expansions = parsed.filter(x => x && typeof x === 'object').map(x => ({ file: String(x.file ?? ''), reason: String(x.reason ?? ''), necessary: x.necessary === true })).filter(x => x.file);
                }
                catch (e) {
                    return `BLOCKED: invalid scope_expansions: ${String(e)}`;
                }
            }
            if (currentSource === 'historical-write-events' && capabilities.sessionDiff && directFiles.length)
                try {
                    const raw = await native.diff(m.identity.session_id);
                    if (raw !== undefined && raw !== null) {
                        const current = new Set(nativeDiffFiles(raw, missionRoot));
                        if (current.size) {
                            directFiles = directFiles.filter(file => current.has(file.replace(/\\/g, '/').replace(/^\.\//, '')));
                            currentSource = 'native-session-diff';
                        }
                    }
                }
                catch { }
            ;
            if (currentSource === 'historical-write-events') {
                const current = inspectCurrentGitChangedFiles(missionRoot);
                if (current !== undefined) {
                    if (current.length || resolve(missionRoot) === resolve(projectRoot)) {
                        const set = new Set(current);
                        directFiles = directFiles.filter(file => set.has(file.replace(/\\/g, '/').replace(/^\.\//, '')));
                        currentSource = 'git-status-fallback';
                    }
                    else {
                        directFiles = directFiles.filter(file => existsSync(resolve(missionRoot, file)));
                        currentSource = 'working-directory-current-files';
                    }
                }
            }
            if (!directFiles.length) {
                appendLedger(m, 'implementation.direct-progress-blocked', { payload: { reason: 'no-current-owned-diff', source: currentSource, historical: m.vcs.changed_files.slice(0, 30) } });
                return JSON.stringify({ status: 'BLOCKED', reason: 'no-current-owned-diff', source: currentSource });
            }
            if (currentSource !== 'historical-write-events')
                appendLedger(m, 'implementation.current-diff-reconciled', { payload: { source: currentSource, files: directFiles.slice(0, 30) } });
            const ownership = assessChangedFileOwnership(m.identity.intent.likelyTargets ?? [], directFiles, expansions, 'control-plane');
            if (m.identity.intent.scope === 'local' && ownership.collateral.length) {
                const marker = `direct-diff-cleanliness:${ownership.collateral.slice(0, 12).sort().join(',')}`;
                m.execution.blockers = [...new Set([...m.execution.blockers, marker])];
                appendLedger(m, 'implementation.direct-progress-blocked', { payload: { reason: 'changed-files-outside-requested-scope', collateral: ownership.collateral.slice(0, 30), expected: (m.identity.intent.likelyTargets ?? []).slice(0, 30) } });
                syncMissionGates(m, projectRoot);
                return JSON.stringify({ status: 'BLOCKED', reason: 'changed-files-outside-requested-scope', collateral: ownership.collateral, expected: m.identity.intent.likelyTargets ?? [], scope_expansions_schema: [{ file: 'project/relative/path', necessary: true, reason: 'why this file is required for the requested change' }] });
            }
            const targetCoverage = assessRequiredTargetCoverage(o.requiredTargets ?? [], directFiles);
            if (targetCoverage.missing.length) {
                appendLedger(m, 'implementation.required-targets-uncovered', { payload: { obligation: o.id, required: targetCoverage.required, covered: targetCoverage.covered, missing: targetCoverage.missing, changed_files: directFiles.slice(0, 40), owner: 'parent-direct' } });
                return JSON.stringify({ status: 'BLOCKED', reason: 'required-targets-uncovered', obligation_id: o.id, required_targets: targetCoverage.required, covered_targets: targetCoverage.covered, missing_targets: targetCoverage.missing, changed_files: directFiles });
            }
            if (ownership.accepted.length)
                appendLedger(m, 'scope.expansion.accepted', { payload: { owner: 'parent-direct', files: ownership.accepted.slice(0, 30) } });
            const pseudo = { id: 'parent-direct', scope: [...(m.identity.intent.likelyTargets ?? [])], requiredEvidence: [...m.execution.verification_policy.requiredKinds] };
            const replan = replanVerificationForChangedSurface(m, pseudo, directFiles, collectRepoContext(missionRoot));
            if (replan.changed)
                appendLedger(m, 'verification.replanned', { payload: { owner: 'parent-direct', changed_files: m.vcs.changed_files.slice(0, 30), added_kinds: replan.addedKinds, scope_expanded: replan.scopeExpanded, risk_escalated: replan.riskEscalated, reason: replan.reason } });
            m.execution.blockers = m.execution.blockers.filter(b => !b.startsWith('direct-diff-cleanliness:'));
        }
        else if (o.kind === 'review') {
            const freshInput = m.execution.evidence.items.filter(e => e.kind === 'review-input' && !e.invalidated_at);
            if (!freshInput.length)
                return 'BLOCKED: no fresh review input observed';
            const reviewVerification = m.execution.obligations.find(x => x.kind === 'verification' && x.status === 'open');
            addEvidence(m, { kind: 'review-evidence', summary, scope: [...new Set(freshInput.flatMap(e => e.scope ?? []))].slice(0, 50), source: 'parent:direct-review', obligation_ids: [o.id, ...(reviewVerification ? [reviewVerification.id] : [])], pass: true, outcome: 'passed' });
        } if (o.kind === 'analysis' && m.identity.intent.taskKind === 'diagnosis')
            addEvidence(m, { kind: 'diagnostic-evidence', summary, scope: [...(m.identity.intent.likelyTargets ?? [])].slice(0, 50), source: 'parent:direct-diagnosis', obligation_ids: [o.id], pass: true, outcome: 'passed' }); o.status = 'closed'; o.closedAt = Date.now(); const progressEvent = o.kind === 'review' ? 'review.direct-progress' : o.kind === 'analysis' ? 'analysis.direct-progress' : 'implementation.direct-progress'; appendLedger(m, progressEvent, { payload: { summary: summary.slice(0, 500), obligation: o.id, changed_files: o.kind === 'implementation' ? directFiles.slice(-30) : [] } }); if (m.methodology.parent_loaded_methodologies.length)
            bindParentMethodologyNeeds(m, m.methodology.parent_loaded_methodologies, o.id); const verify = m.execution.obligations.find(x => x.kind === 'verification' && x.status === 'open'); if (verify && verificationSatisfied(m, verify.id, missionRoot).ok) {
            verify.status = 'closed';
            verify.closedAt = Date.now();
        } reconcileMethodologyExits(m, missionRoot); syncMissionGates(m, missionRoot); const completion = evaluateCompletion(m, missionRoot); if (completion.complete)
            store.complete(String(c?.sessionID ?? m.identity.session_id)); const remaining = m.execution.obligations.filter(x => x.status === 'open').slice(0, 12).map(x => ({ id: x.id, kind: x.kind })), methodologyNeeds = [...new Set(m.methodology.methodology_needs.map(x => x.name))].slice(0, 12); return JSON.stringify({ status: 'RECORDED', completion_ready: completion.complete, mission_status: completion.complete ? 'completed' : m.identity.status, next: completion.complete ? 'STOP' : completion.next ?? null, verification_required: completion.next === 'VERIFY' || remaining.some(x => x.kind === 'verification'), remaining_obligations: remaining, methodology_needs: methodologyNeeds, changed_files: o.kind === 'implementation' ? directFiles.slice(-30) : [] }); } });
    const startTool = tool({ description: 'Start one bounded Hi worker task, or resume the exact existing task when task_id is supplied. When creating a NEW task, omit task_id; task_id is only for an exact canonical t_... id previously returned by Hi. For multiple scope paths, pass comma-separated project-relative paths; semicolon-separated paths are accepted for compatibility. task_id resume never creates a replacement task.', args: { task_id: tool.schema.string().optional(), objective: tool.schema.string().optional(), role: tool.schema.string().optional(), category: tool.schema.string().optional(), model: tool.schema.string().optional(), model_variant: tool.schema.string().optional(), scope: tool.schema.string().optional(), constraints: tool.schema.string().optional(), dependencies: tool.schema.string().optional(), required_evidence: tool.schema.string().optional(), obligation_ids: tool.schema.string().optional(), context_artifact_ids: tool.schema.string().optional(), fork_from_session: tool.schema.string().optional(), isolation_required: tool.schema.boolean().optional(), isolation_reason: tool.schema.string().optional(), mcp_servers: tool.schema.string().optional(), browser_backend: tool.schema.string().optional(), browser_allowed_origins: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; try {
            const missionRoot = m.identity.intent.scope === 'local' ? (workingDirectory ?? projectRoot) : projectRoot, rawArgs = a?.input && typeof a.input === 'object' && !Array.isArray(a.input) ? { ...a, ...a.input } : a;
            const completion = evaluateCompletion(m, missionRoot);
            if (completion.complete) {
                appendLedger(m, 'task.start-skipped', { payload: { reason: 'mission-already-complete' } });
                return JSON.stringify({ status: 'SKIPPED', reason: 'mission-already-complete', completion_ready: true });
            }
            if (rawArgs.task_id) {
                const requestedTaskID = String(rawArgs.task_id), canonicalTaskID = /^t_[a-z0-9]+_[a-z0-9]+$/i.test(requestedTaskID);
                if (canonicalTaskID)
                    return JSON.stringify(await tasks.resume(m, requestedTaskID));
                if (!rawArgs.objective && !rawArgs.role)
                    throw new Error(`Non-canonical Hi task_id '${requestedTaskID}' cannot identify an existing task. Use the exact t_... id returned by hi_task_start/hi_task_list.`);
                appendLedger(m, 'task.start-id-normalized', { payload: { supplied_task_id: requestedTaskID, policy: 'noncanonical-create-label-ignored' } });
                delete rawArgs.task_id;
            }
            const requestedRole = String(rawArgs.role ?? '').trim(), predecessors = m.execution.obligations.filter(o => o.status === 'open' && (o.kind === 'analysis' || o.kind === 'implementation'));
            if (requestedRole === 'visual-qa' && predecessors.length) {
                const control = projectControlDecision(m, missionRoot);
                appendLedger(m, 'verification.worker-deferred', { payload: { role: requestedRole, predecessors: predecessors.map(o => o.id), reason: 'canonical-predecessor-obligation-open' } });
                return JSON.stringify({ status: 'BLOCKED', reason: 'canonical-predecessor-obligation-open', predecessor_obligations: predecessors.map(o => ({ id: o.id, kind: o.kind })), control });
            }
            const input = { ...rawArgs, forkFromSession: rawArgs.fork_from_session ? String(rawArgs.fork_from_session) : undefined, modelVariant: rawArgs.model_variant ? String(rawArgs.model_variant) : undefined, isolationRequired: rawArgs.isolation_required === true, isolationReason: rawArgs.isolation_reason ? String(rawArgs.isolation_reason) : undefined, mcpServers: rawArgs.mcp_servers ? String(rawArgs.mcp_servers).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8) : undefined, browserBackend: rawArgs.browser_backend ? (String(rawArgs.browser_backend) === 'playwright' || String(rawArgs.browser_backend) === 'hi' ? 'bounded-playwright' : String(rawArgs.browser_backend)) : undefined, browserAllowedOrigins: rawArgs.browser_allowed_origins ? String(rawArgs.browser_allowed_origins).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8) : undefined, scope: optionalScopeList(rawArgs.scope), constraints: rawArgs.constraints ? [String(rawArgs.constraints)] : undefined, dependencies: optionalIdList(rawArgs.dependencies), requiredEvidence: rawArgs.required_evidence ? String(rawArgs.required_evidence).split(',').map((x) => x.trim()).filter(Boolean) : undefined, obligationIds: rawArgs.obligation_ids ? String(rawArgs.obligation_ids).split(',').map((x) => x.trim()).filter(Boolean) : undefined, contextArtifactIds: rawArgs.context_artifact_ids ? String(rawArgs.context_artifact_ids).split(',').map((x) => x.trim()).filter(Boolean) : undefined };
            if (m.execution.adaptive_execution?.path === 'DIRECT' && !m.execution.verification_policy.requireReview && ['qa-reviewer', 'security-reviewer'].includes(String(input.role ?? '')))
                return JSON.stringify({ status: 'SKIPPED', reason: 'minimum-sufficient-direct-path: independent reviewer is not required' });
            const started = await tasks.start(m, input);
            return JSON.stringify({ ...started, control: projectControlDecision(m, missionRoot) });
        }
        catch (e) {
            if (e instanceof TaskPreconditionError) {
                appendLedger(m, 'worker.start.precondition', { payload: { decision: e.result.decision, items: e.result.items.slice(0, 12) } });
                const capability_blocker = firstCapabilityBlocker(m);
                return JSON.stringify({ status: capability_blocker ? 'USER_ACTION_REQUIRED' : e.result.decision, preconditions: e.result.items, ...(capability_blocker ? { capability_blocker } : {}) });
            }
            appendLedger(m, 'worker.start.failed', { payload: { error: String(e) } });
            return `Task start failed: ${String(e)}`;
        } } });
    const peekTool = tool({ description: 'Inspect one Hi task/worker without polling loops.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(tasks.peek(m, a.id)) : 'No active Hi mission'; } });
    const listTool = tool({ description: 'List bounded Hi task and worker state.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(tasks.list(m)) : 'No active Hi mission'; } });
    const awaitTool = tool({ description: 'Wait for one bounded Hi task state change or terminal result without model/shell polling. Default 30s, max 60s. If timed_out is true, return control and do not busy-loop.', args: { id: tool.schema.string(), timeout_ms: tool.schema.number().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const timeout = Math.max(0, Math.min(60_000, Number(a.timeout_ms ?? 30_000))); const x = await tasks.awaitTask(m, String(a.id), timeout); return JSON.stringify({ status: x.status, terminal: x.terminal, changed: x.changed, timed_out: x.timed_out, result: x?.task?.result, control: projectControlDecision(m, projectRoot) }); } });
    const cancelTool = tool({ description: 'Cancel one Hi task/worker.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? String(await tasks.cancel(m, a.id)) : 'false'; } });
    const browserContext = (taskID, c) => { const sid = String(c?.sessionID ?? ''); for (const m of store.all()) {
        const owner = resolveBrowserExecutionOwner(m, { sessionID: sid, taskID });
        if (owner)
            return { m, w: owner.worker, t: owner.task, cx: { task_id: taskID, execution_owner_ref: `${m.identity.mission_id}:${owner.worker.id}:${owner.worker.session_id}:${owner.worker.generation_at_spawn}`, executor_version: 'hi-playwright-browser@1', allowed_origins: [...(owner.task.execution_profile?.browser_allowed_origins ?? [])] } };
    } throw new Error('Browser execution is allowed only for the active visual-qa worker/task with a selected browser/visual methodology'); };
    const browserObservationResult = (x, observation) => { const stateHash = createHash('sha256').update(JSON.stringify(observation)).digest('hex'), evidence = addEvidence(x.m, { kind: 'browser-evidence', summary: `Browser ${String(observation?.action ?? 'observation')} ${String(observation?.result ?? 'UNKNOWN')} at ${String(observation?.url ?? 'unknown')}`.slice(0, 1000), scope: [...x.t.scope], source: `browser:${String(observation?.observation_id ?? 'unknown')}`, trusted_source_class: 'browser-observation', source_session_id: x.w.session_id, source_state_hash: stateHash, task_id: x.t.id, obligation_ids: [...x.t.obligation_ids], producer_attempt: evidenceProducerAttemptForWorker(x.m, x.w), outcome: observation?.result === 'FAILED' ? 'failed' : 'pending', pass: observation?.result === 'FAILED' ? false : undefined, reason: observation?.result === 'FAILED' ? 'browser-observation-failed' : 'browser-observation-only' }); appendLedger(x.m, 'browser.observation-recorded', { task_id: x.t.id, worker_id: x.w.id, payload: { observation_id: observation?.observation_id, evidence_ref: evidence.id, action: observation?.action, result: observation?.result } }); return JSON.stringify({ observation, evidence_ref: evidence.id }); };
    const browserPreviewOpenTool = tool({ description: 'Serve one visual-task-scoped local file through a Hi-owned ephemeral loopback preview and open it with the bounded browser. This never installs dependencies, writes project helper files, or exposes a non-loopback listener.', args: { task_id: tool.schema.string(), path: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor || !previewManager)
                return 'BLOCKED: local browser preview unavailable';
            const sid = String(c?.sessionID ?? ''), taskID = String(a.task_id);
            let owner, mission;
            for (const candidate of store.all()) {
                const resolved = resolveBrowserExecutionOwner(candidate, { sessionID: sid, taskID });
                if (resolved) {
                    owner = resolved;
                    mission = candidate;
                    break;
                }
            }
            if (!owner || !mission)
                throw new Error('Preview is allowed only for the active visual-qa worker/task');
            const preview = await previewManager.start(taskID, String(a.path), owner.task.scope);
            owner.task.execution_profile ??= {};
            owner.task.execution_profile.browser_allowed_origins = [preview.origin];
            appendLedger(mission, 'browser.preview-started', { task_id: taskID, worker_id: owner.worker.id, payload: { origin: preview.origin, target: preview.target, reused: preview.reused, loopback_only: true, project_mutation: false } });
            const x = browserContext(taskID, c);
            return browserObservationResult(x, await browserExecutor.open(x.cx, preview.url));
        }
        catch (e) {
            return `Browser preview open blocked: ${String(e)}`;
        } } });
    const browserOpenTool = tool({ description: 'Open a local HTTP(S) target through the bounded Hi browser executor.', args: { task_id: tool.schema.string(), url: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.open(x.cx, String(a.url)));
        }
        catch (e) {
            return `Browser open blocked: ${String(e)}`;
        } } });
    const browserNavigateTool = tool({ description: 'Navigate the active bounded Hi browser session to another local HTTP(S) URL.', args: { task_id: tool.schema.string(), url: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.navigate(x.cx, String(a.url)));
        }
        catch (e) {
            return `Browser navigate blocked: ${String(e)}`;
        } } });
    const browserClickTool = tool({ description: 'Click one element reference from the latest bounded browser observation.', args: { task_id: tool.schema.string(), target: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.click(x.cx, { value: String(a.target) }));
        }
        catch (e) {
            return `Browser click blocked: ${String(e)}`;
        } } });
    const browserTypeTool = tool({ description: 'Type bounded text into one element reference from the latest browser observation.', args: { task_id: tool.schema.string(), target: tool.schema.string(), value: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.type(x.cx, { value: String(a.target) }, String(a.value)));
        }
        catch (e) {
            return `Browser type blocked: ${String(e)}`;
        } } });
    const browserKeyTool = tool({ description: 'Press one bounded keyboard key in the active visual browser session. Supported keys: arrows, Enter, Space, Escape, Tab, Backspace, Delete, Home, End, PageUp/PageDown, or one alphanumeric key.', args: { task_id: tool.schema.string(), key: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.key(x.cx, { key: String(a.key) }));
        }
        catch (e) {
            return `Browser key blocked: ${String(e)}`;
        } } });
    const browserInspectTool = tool({ description: 'Inspect the current page as a bounded DOM/text observation.', args: { task_id: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.inspect(x.cx));
        }
        catch (e) {
            return `Browser inspect blocked: ${String(e)}`;
        } } });
    const browserScreenshotTool = tool({ description: 'Capture the current page into the canonical Hi artifact owner and return a BrowserObservation reference.', args: { task_id: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.screenshot(x.cx));
        }
        catch (e) {
            return `Browser screenshot blocked: ${String(e)}`;
        } } });
    const browserWaitTool = tool({ description: 'Wait a bounded number of milliseconds in the active browser session.', args: { task_id: tool.schema.string(), milliseconds: tool.schema.number() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.wait(x.cx, { milliseconds: Number(a.milliseconds) }));
        }
        catch (e) {
            return `Browser wait blocked: ${String(e)}`;
        } } });
    const browserCloseTool = tool({ description: 'Close the active bounded Hi browser session.', args: { task_id: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.close(x.cx));
        }
        catch (e) {
            return `Browser close blocked: ${String(e)}`;
        } } });
    const processSpawnTool = tool({ description: 'Spawn one owned long-running process for an existing Hi worker/task through the native OpenCode PTY lifecycle. Native permission ask remains a real OpenCode permission request.', args: { worker_id: tool.schema.string(), command: tool.schema.string(), args_json: tool.schema.string().optional(), cwd: tool.schema.string().optional(), timeout_ms: tool.schema.number().optional(), title: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; if (!m.identity.intent.requiredCapabilities.includes('interactive-process'))
            return 'BLOCKED: persistent/interactive process lifecycle was not selected; use the native shell for bounded commands'; const processCapability = hostCapabilityByID(capabilities.contracts ?? [], 'process-lifecycle'); if (processCapability?.status !== 'SUPPORTED') {
            const detail = 'native process lifecycle is unavailable on the active OpenCode host', marker = markCapabilityUnavailable(m, { capability: 'process-lifecycle', reason: detail, workerId: String(a.worker_id) });
            return JSON.stringify({ status: 'USER_ACTION_REQUIRED', reason: 'capability-unavailable', capability: 'process-lifecycle', blocker: marker, detail });
        } ; let args; if (a.args_json) {
            try {
                const parsed = JSON.parse(String(a.args_json));
                if (!Array.isArray(parsed) || !parsed.every(x => typeof x === 'string'))
                    throw new Error('args_json must be a JSON string array');
                args = parsed;
            }
            catch (error) {
                return `BLOCKED: invalid args_json: ${String(error)}`;
            }
        } try {
            return JSON.stringify(await processRuntime.spawn(m, { worker_id: String(a.worker_id), command: String(a.command), args, cwd: String(a.cwd ?? c?.directory ?? projectRoot), timeout_ms: a.timeout_ms === undefined ? undefined : Number(a.timeout_ms), title: a.title ? String(a.title) : undefined, ask: async (request) => c.ask({ permission: request.permission, patterns: request.patterns, always: request.always, metadata: request.metadata }) }));
        }
        catch (error) {
            return `Process spawn blocked: ${String(error)}`;
        } } });
    const processReadTool = tool({ description: 'Read one bounded cursor window from an owned Hi process. Output observation is hash-bound Evidence input, never implicit verification PASS.', args: { id: tool.schema.string(), cursor: tool.schema.number().optional(), max_chars: tool.schema.number().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; try {
            return JSON.stringify(await processRuntime.read(m, String(a.id), a.cursor === undefined ? undefined : Number(a.cursor), a.max_chars === undefined ? undefined : Number(a.max_chars)));
        }
        catch (error) {
            return `Process read failed: ${String(error)}`;
        } } });
    const processWriteTool = tool({ description: 'Write bounded stdin to one owned running Hi process.', args: { id: tool.schema.string(), input: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; try {
            await processRuntime.write(m, String(a.id), String(a.input));
            return 'OK';
        }
        catch (error) {
            return `Process write failed: ${String(error)}`;
        } } });
    const processWaitTool = tool({ description: 'Await the native exit promise for one owned Hi process. This is event-driven and must not be used as a polling loop.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; try {
            return JSON.stringify(await processRuntime.wait(m, String(a.id)));
        }
        catch (error) {
            return `Process wait failed: ${String(error)}`;
        } } });
    const processKillTool = tool({ description: 'Terminate one owned running Hi process after native PID identity revalidation.', args: { id: tool.schema.string(), signal: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const signal = String(a.signal ?? 'SIGTERM'); if (!['SIGTERM', 'SIGINT'].includes(signal))
            return 'BLOCKED: signal must be SIGTERM or SIGINT'; try {
            return JSON.stringify(await processRuntime.kill(m, String(a.id), signal));
        }
        catch (error) {
            return `Process kill failed: ${String(error)}`;
        } } });
    const processCleanupTool = tool({ description: 'Cleanup one owned terminal Hi process. Cleanup cannot terminate a running process.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; try {
            await processRuntime.cleanup(m, String(a.id));
            return 'OK';
        }
        catch (error) {
            return `Process cleanup failed: ${String(error)}`;
        } } });
    const processListTool = tool({ description: 'List bounded durable Hi process contracts for the current mission.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(processRuntime.list(m)) : 'No active Hi mission'; } });
    const toolSurface = { hi_doctor: doctorTool, hi_status: statusTool, hi_role_models: roleModelsTool, hi_metrics: metricsTool, hi_ledger: ledgerTool, hi_readiness: readinessTool, hi_intent_assess: intentAssessTool, hi_context_artifact_add: artifactAddTool, hi_context_artifacts: artifactsTool, hi_temporary_mutation_register: mutationTool, hi_temporary_mutation_revert: nativeRollbackTool, hi_direct_progress: directProgressTool, hi_task_start: startTool, hi_task_await: awaitTool, hi_task_peek: peekTool, hi_task_list: listTool, hi_task_cancel: cancelTool, hi_process_spawn: processSpawnTool, hi_process_read: processReadTool, hi_process_write: processWriteTool, hi_process_wait: processWaitTool, hi_process_kill: processKillTool, hi_process_cleanup: processCleanupTool, hi_process_list: processListTool, hi_browser_preview_open: browserPreviewOpenTool, hi_browser_open: browserOpenTool, hi_browser_navigate: browserNavigateTool, hi_browser_click: browserClickTool, hi_browser_type: browserTypeTool, hi_browser_key: browserKeyTool, hi_browser_inspect: browserInspectTool, hi_browser_screenshot: browserScreenshotTool, hi_browser_wait: browserWaitTool, hi_browser_close: browserCloseTool };
    assertHiToolNamespace(Object.keys(toolSurface));
    const reconfigure = () => { };
    return { toolSurface, reconfigure };
}
