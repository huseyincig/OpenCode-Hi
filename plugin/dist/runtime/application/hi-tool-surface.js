import { runDoctor, formatDoctor } from '../../doctor/checks.js';
import { compactLedgerReport } from '../ledger/report.js';
import { aggregateMissionMetrics } from '../ledger/metrics.js';
import { observabilityEconomicsView } from '../observability/runtime.js';
import { superProductIntegrationView } from '../integration/super-product.js';
import { formatUserMissionStatus } from '../ledger/status.js';
import { evaluatePreconditions, TaskPreconditionError } from '../readiness/preconditions.js';
import { clearCapabilityUnavailable, firstCapabilityBlocker, markCapabilityUnavailable } from '../readiness/capability-failure.js';
import { parseSemanticIntentAssessment } from '../intent/semantic-assessment.js';
import { assertCapabilityRequestTrace, assertVerificationRequestTrace, renderRequestUnitChallenge } from '../intent/request-units.js';
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
import { assessDiagnosticHypothesis, DIAGNOSTIC_HYPOTHESIS_OUTCOMES } from '../diagnosis/hypothesis.js';
import { replanVerificationForChangedSurface, verificationEnvelopeFor, verificationSatisfied } from '../verification/policy.js';
import { collectRepoContext } from '../intent/repo-context.js';
import { bindParentMethodologyNeeds } from '../methodology/activation.js';
import { reconcileMethodologyExits } from '../methodology/exit.js';
import { reconcileSatisfiedTaskArtifacts } from '../task/task-ownership.js';
import { evaluateCompletion } from '../completion/evaluator.js';
import { projectControlDecision } from '../completion/control-projection.js';
import { primaryRoleCanDirectImplementation } from '../roles/catalog.js';
import { inspectCurrentGitChangedFiles, inspectGitIgnoredFiles } from '../safety/staging-safety.js';
import { nativeTool as tool } from '../../opencode/plugin-tool.js';
import { assertHiToolNamespace } from '../../opencode/tool-namespace.js';
import { MODEL_ROUTED_CHILD_ROLES, isModelRoutedChildRole } from '../../config/schema.js';
import { normalizeBoundedProjectPath } from '../../contracts/common.js';
import { isResourceOnlyProcessSupportTask } from '../worker/worker-runtime.js';
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
import { HI_BROWSER_EXECUTION_TOOL_IDS } from '../browser/executor.js';
import { normalizeBrowserAllowedOrigins } from '../browser/backend-policy.js';
import { applyProjectSettings, hasProjectSettings } from '../../config/project-settings.js';
import { resolveHiConfigWithReport } from '../../config/resolver.js';
import { resolveBrowserExecutionOwner } from '../browser/ownership.js';
function nativeDiffFiles(raw, projectRoot) { const items = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []; return [...new Set(items.map((x) => typeof x?.file === 'string' ? x.file : typeof x?.path === 'string' ? x.path : '').filter((x) => Boolean(x)).map((x) => normalizeProjectPath(x, projectRoot)).filter(Boolean))]; }
function userFacingChildRole(value) { const role = String(value ?? '').trim().toLowerCase(); return role === 'review' ? 'qa-reviewer' : role; }
function base64Bytes(bytes) { let binary = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000))); return btoa(binary); }
export function createHiToolSurface(input) {
    const { state, store, tasks, processRuntime, workspaceRuntime, browserExecutor, previewManager, projectRoot, workingDirectory, capabilities, native, getModels, refreshModels, refreshOwnedHostCapability, scopedStores, getBrowserBootstrapStatus, getBrowserToolReceipt, getEcosystemView } = input;
    const doctorTool = tool({ description: 'Run OpenCode-Hi runtime/configuration health checks', args: {}, execute: async () => { if (refreshOwnedHostCapability)
            await Promise.allSettled([refreshOwnedHostCapability('process-lifecycle'), refreshOwnedHostCapability('workspace-isolation-binding')]); const browserHealth = browserExecutor ? await browserExecutor.health() : { available: false }, runtimeHostResources = new Set(browserHealth.available ? ['host-capability:browser-execution'] : []); return formatDoctor(runDoctor(state.config, store, projectRoot, { models: getModels(), resolution: state.configResolution, capabilities, hostConfig: state.hostConfig, openCodeVersion: state.openCodeVersion, runtimeHostResources, browserBootstrap: getBrowserBootstrapStatus?.(), browserToolReceipt: getBrowserToolReceipt?.() })); } });
    const statusTool = tool({ description: 'Show compact user-facing Hi mission status. This intentionally excludes diagnostic logs and ledger payloads.', args: {}, execute: async (_args, c) => { const m = store.get(c?.sessionID); return m ? formatUserMissionStatus(m) : 'Hi: no active mission'; } });
    const reloadConfig = () => { const resolved = resolveHiConfigWithReport(state.hostConfig.hi, projectRoot); state.config = resolved.config; state.configResolution = resolved.report; return state.config; };
    const modelRows = (available) => available.map(model => ({ id: model.id, provider: model.provider ?? null, vision: model.visionCapable === true, variants: model.variants ?? [] }));
    const roleModelChange = (rawArgs, action, available, rows) => {
        const role = userFacingChildRole(rawArgs?.role);
        if (!isModelRoutedChildRole(role))
            return { status: 'BLOCKED', reason: 'unsupported-child-role', allowed_roles: MODEL_ROUTED_CHILD_ROLES };
        if (action === 'clear') {
            applyProjectSettings(projectRoot, { roleModels: { [role]: null } });
            reloadConfig();
            return { status: 'APPLIED', role, role_models: state.config.routing.roleModels, restart_required: false, note: 'Role returned to automatic runtime selection; no inferred preference is persisted.' };
        }
        const requested = [...new Set(String(rawArgs?.models ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
        if (!requested.length)
            return { status: 'BLOCKED', reason: 'model-list-empty' };
        const rejected = requested.map(id => ({ id, ...runtimeModelCandidateStatus(id, available, state.config, state.hostConfig, role) })).filter(x => !x.ok);
        if (rejected.length)
            return { status: 'BLOCKED', reason: rejected.some(x => String(x.reason).includes('vision')) ? 'role-requires-vision-capable-model' : 'model-unavailable-or-policy-rejected', role, rejected, available_models: rows };
        applyProjectSettings(projectRoot, { roleModels: { [role]: requested } });
        reloadConfig();
        return { status: 'APPLIED', role, models: requested, role_models: state.config.routing.roleModels, restart_required: false, note: 'New worker dispatches use this mapping immediately.' };
    };
    const roleModelsTool = tool({ description: 'Compatibility surface for older Hi child-role model callers. New configuration flows use hi_settings. action=list shows only the effective connected OpenCode inventory; set/clear delegate to the same canonical role-model mutation policy as hi_settings. Primary manager/working-manager models remain OpenCode-owned.', args: { action: tool.schema.string(), role: tool.schema.string().optional(), models: tool.schema.string().optional() }, execute: async (a) => {
            const rawArgs = a?.input && typeof a.input === 'object' && !Array.isArray(a.input) ? { ...a, ...a.input } : a, action = String(rawArgs?.action ?? 'list').trim().toLowerCase();
            if (refreshModels)
                await refreshModels('hi-role-models');
            const available = getModels(), configured = state.config.routing.roleModels ?? {}, rows = modelRows(available);
            const roles = Object.fromEntries(MODEL_ROUTED_CHILD_ROLES.map(role => [role, configured[role]?.[0] ?? null]));
            if (action === 'list')
                return JSON.stringify({ status: 'OK', models: rows, roles, role_models: Object.fromEntries(MODEL_ROUTED_CHILD_ROLES.map(role => [role, configured[role] ?? []])), note: 'Compatibility view only. New configuration flows use hi_settings. Only effective connected OpenCode models are listed; primary Manager/Working Manager model selection stays in OpenCode.' });
            if (action !== 'set' && action !== 'clear')
                return JSON.stringify({ status: 'BLOCKED', reason: 'unsupported-action', allowed_actions: ['list', 'set', 'clear'] });
            return JSON.stringify(roleModelChange(rawArgs, action, available, rows));
        } });
    const settingsTool = tool({ description: 'Show or change OpenCode-Hi project settings through one transactional control plane. Actions: show/setup; apply with settings_json for any request changing multiple settings, including ordered allowed_models global child-model pool; set-role-model (set alias) and clear-role-model (clear alias) for one role; set-mode; set-limits; reset-models; reset. Work mode controls Adaptive/Single/Multi topology; child model choices are validated only against the effective connected OpenCode runtime inventory. Primary Manager/Working Manager model ownership remains OpenCode-owned.', args: { action: tool.schema.string(), role: tool.schema.string().optional(), models: tool.schema.string().optional(), allowed_models: tool.schema.string().optional(), work_mode: tool.schema.string().optional(), max_agents: tool.schema.number().optional(), parallelism: tool.schema.number().optional(), settings_json: tool.schema.string().optional() }, execute: async (a) => {
            const rawArgs = a?.input && typeof a.input === 'object' && !Array.isArray(a.input) ? { ...a, ...a.input } : a, action = String(rawArgs?.action ?? 'show').trim().toLowerCase();
            if (refreshModels)
                await refreshModels('hi-settings');
            const available = getModels(), configured = state.config.routing.roleModels ?? {}, rows = modelRows(available), reload = reloadConfig;
            const show = () => JSON.stringify({ status: 'OK', primary_behavior: state.config.primaryMode, work_mode: state.config.execution.topology === 'single-agent' ? 'single' : state.config.execution.topology === 'multi-agent' ? 'multi' : 'adaptive', execution: { max_agents: state.config.execution.maxAgents, parallelism: state.config.execution.parallelism }, models: { available: rows, allowed: [...state.config.routing.allowedModels], roles: Object.fromEntries(MODEL_ROUTED_CHILD_ROLES.map(role => [role, configured[role] ?? []])) }, health: { unavailable_assignments: MODEL_ROUTED_CHILD_ROLES.flatMap(role => (configured[role] ?? []).filter(id => !runtimeModelCandidateStatus(id, available, state.config, state.hostConfig, role).ok).map(id => ({ role, id }))) }, onboarding: { pending: !hasProjectSettings(projectRoot), default_work_mode: 'adaptive', default_models: 'automatic' }, restart_required: false, note: 'models.available is OpenCode server-effective connected inventory; models.allowed is the optional Hi child-model pool. Empty allowed means no Hi pool constraint; empty role lists mean Automatic.' });
            if (action === 'show' || action === 'setup')
                return show();
            if (action === 'apply') {
                let patch;
                try {
                    patch = JSON.parse(String(rawArgs?.settings_json ?? ''));
                }
                catch (error) {
                    return JSON.stringify({ status: 'BLOCKED', reason: 'invalid-settings-json', detail: String(error) });
                }
                if (!patch || typeof patch !== 'object' || Array.isArray(patch))
                    return JSON.stringify({ status: 'BLOCKED', reason: 'invalid-settings-patch' });
                if (patch.allowed_models !== undefined && patch.allowed_models !== null && !Array.isArray(patch.allowed_models))
                    return JSON.stringify({ status: 'BLOCKED', reason: 'invalid-allowed-model-pool' });
                const allowedModels = patch.allowed_models === null ? null : patch.allowed_models === undefined ? undefined : [...new Set(patch.allowed_models.map(String).map((x) => x.trim()).filter(Boolean))];
                if (Array.isArray(allowedModels) && !allowedModels.length)
                    return JSON.stringify({ status: 'BLOCKED', reason: 'model-list-empty' });
                if (Array.isArray(allowedModels)) {
                    const rejected = allowedModels.filter((id) => !available.some(m => m.id === id));
                    if (rejected.length)
                        return JSON.stringify({ status: 'BLOCKED', reason: 'model-unavailable', rejected, available_models: rows });
                }
                if (patch.roles !== undefined && (!patch.roles || typeof patch.roles !== 'object' || Array.isArray(patch.roles)))
                    return JSON.stringify({ status: 'BLOCKED', reason: 'invalid-role-model-patch' });
                const rolePatch = {};
                for (const [requestedRole, value] of Object.entries(patch.roles ?? {})) {
                    const candidate = userFacingChildRole(requestedRole);
                    if (!isModelRoutedChildRole(candidate))
                        return JSON.stringify({ status: 'BLOCKED', reason: 'unsupported-child-role', role: requestedRole, allowed_roles: MODEL_ROUTED_CHILD_ROLES });
                    if (Object.prototype.hasOwnProperty.call(rolePatch, candidate))
                        return JSON.stringify({ status: 'BLOCKED', reason: 'duplicate-child-role-alias', role: candidate });
                    if (value === null) {
                        rolePatch[candidate] = null;
                        continue;
                    }
                    if (!Array.isArray(value) || !value.length)
                        return JSON.stringify({ status: 'BLOCKED', reason: 'model-list-empty', role: candidate });
                    const ids = [...new Set(value.map(String).map(x => x.trim()).filter(Boolean))];
                    if (Array.isArray(allowedModels) && ids.some(id => !allowedModels.includes(id)))
                        return JSON.stringify({ status: 'BLOCKED', reason: 'role-model-outside-allowed-model-pool', role: candidate });
                    const rejected = ids.map(id => ({ id, ...runtimeModelCandidateStatus(id, available, state.config, state.hostConfig, candidate) })).filter(x => !x.ok);
                    if (rejected.length)
                        return JSON.stringify({ status: 'BLOCKED', reason: rejected.some(x => String(x.reason).includes('vision')) ? 'role-requires-vision-capable-model' : 'model-unavailable-or-policy-rejected', role: candidate, rejected, available_models: rows });
                    rolePatch[candidate] = ids;
                }
                try {
                    const workMode = patch.work_mode === undefined ? undefined : String(patch.work_mode).trim().toLowerCase();
                    applyProjectSettings(projectRoot, { workMode: workMode, allowedModels: allowedModels, maxAgents: patch.max_agents === undefined ? undefined : Number(patch.max_agents), parallelism: patch.parallelism === undefined ? undefined : Number(patch.parallelism), roleModels: rolePatch, resetRoleModels: patch.reset_models === true });
                    reload();
                    return JSON.stringify({ status: 'APPLIED', work_mode: state.config.execution.topology === 'single-agent' ? 'single' : state.config.execution.topology === 'multi-agent' ? 'multi' : 'adaptive', execution: state.config.execution, allowed_models: state.config.routing.allowedModels, role_models: state.config.routing.roleModels, restart_required: false });
                }
                catch (error) {
                    return JSON.stringify({ status: 'BLOCKED', reason: 'invalid-settings-patch', detail: String(error) });
                }
            }
            if (action === 'set-model-pool') {
                const requested = [...new Set(String(rawArgs?.allowed_models ?? rawArgs?.models ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
                if (!requested.length)
                    return JSON.stringify({ status: 'BLOCKED', reason: 'model-list-empty' });
                const rejected = requested.filter(id => !available.some(m => m.id === id));
                if (rejected.length)
                    return JSON.stringify({ status: 'BLOCKED', reason: 'model-unavailable', rejected, available_models: rows });
                applyProjectSettings(projectRoot, { allowedModels: requested });
                reload();
                return JSON.stringify({ status: 'APPLIED', allowed_models: state.config.routing.allowedModels, restart_required: false });
            }
            if (action === 'clear-model-pool') {
                applyProjectSettings(projectRoot, { allowedModels: null });
                reload();
                return JSON.stringify({ status: 'APPLIED', allowed_models: [], restart_required: false });
            }
            if (action === 'set-mode') {
                const workMode = String(rawArgs?.work_mode ?? '').trim().toLowerCase();
                if (!['adaptive', 'single', 'multi'].includes(workMode))
                    return JSON.stringify({ status: 'BLOCKED', reason: 'unsupported-work-mode', allowed: ['adaptive', 'single', 'multi'] });
                applyProjectSettings(projectRoot, { workMode: workMode });
                reload();
                return JSON.stringify({ status: 'APPLIED', work_mode: workMode, execution: state.config.execution, restart_required: false });
            }
            if (action === 'set-limits') {
                try {
                    applyProjectSettings(projectRoot, { maxAgents: rawArgs?.max_agents === undefined ? undefined : Number(rawArgs.max_agents), parallelism: rawArgs?.parallelism === undefined ? undefined : Number(rawArgs.parallelism) });
                    reload();
                    return JSON.stringify({ status: 'APPLIED', execution: state.config.execution, restart_required: false });
                }
                catch (error) {
                    return JSON.stringify({ status: 'BLOCKED', reason: 'invalid-execution-limits', detail: String(error) });
                }
            }
            if (action === 'reset-models') {
                applyProjectSettings(projectRoot, { allowedModels: null, resetRoleModels: true });
                reload();
                return JSON.stringify({ status: 'APPLIED', allowed_models: [], role_models: state.config.routing.roleModels, restart_required: false, note: 'Global model pool and all child-role mappings returned to Automatic.' });
            }
            if (action === 'reset') {
                applyProjectSettings(projectRoot, { workMode: 'adaptive', allowedModels: null, resetRoleModels: true });
                reload();
                return JSON.stringify({ status: 'APPLIED', work_mode: 'adaptive', allowed_models: [], role_models: state.config.routing.roleModels, execution: state.config.execution, restart_required: false });
            }
            if (action === 'clear-role-model' || action === 'clear')
                return JSON.stringify(roleModelChange(rawArgs, 'clear', available, rows));
            if (action === 'set-role-model' || action === 'set')
                return JSON.stringify(roleModelChange(rawArgs, 'set', available, rows));
            return JSON.stringify({ status: 'BLOCKED', reason: 'unsupported-action', allowed_actions: ['show', 'setup', 'apply', 'set-model-pool', 'clear-model-pool', 'set-mode', 'set-role-model', 'clear-role-model', 'reset-models', 'set-limits', 'reset'] });
        } });
    const metricsTool = tool({ description: 'Show bounded Hi observability/economics derived from canonical Mission ledger and Worker usage observations. Active sessions receive a mission-scoped operator projection; outside a mission the aggregate compatibility view is returned. Partial telemetry remains partial and neither view has routing/completion authority.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return JSON.stringify(m ? observabilityEconomicsView(m) : aggregateMissionMetrics(store.all())); } });
    const superProductTool = tool({ description: 'Show one bounded read-only Campaign-C integration projection derived from canonical Hi/OpenCode owners. This surface owns no Mission, Evidence, Authority, routing, native, usage, context, evaluation or persistent state.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const ecosystem = getEcosystemView ? getEcosystemView([]) : undefined; if (!ecosystem)
            return JSON.stringify({ status: 'BLOCKED', reason: 'ecosystem-projection-unavailable' }); return JSON.stringify(superProductIntegrationView({ mission: m, projectMissions: store.all(), liveInventory: getModels(), projectIntelligence: scopedStores.projectIntelligence, ecosystem, projectRoot })); } });
    const ledgerTool = tool({ description: 'Show a bounded Hi execution ledger/report on demand.', args: { limit: tool.schema.number().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(compactLedgerReport(m, a?.limit ?? 40)) : 'No active Hi mission'; } });
    const readinessTool = tool({ description: 'Show machine-readable Hi mission readiness/preconditions and gates.', args: {}, execute: async (_a, c) => { const m = store.get(c?.sessionID); return m ? JSON.stringify(evaluatePreconditions(m, projectRoot)) : 'No active Hi mission'; } });
    const intentAssessTool = tool({ description: 'Submit the host-primary semantic interpretation of the current user message to the host-agnostic Hi Core intent contract. Natural-language semantics belong here, not in language-specific runtime regexes.', args: { revision: tool.schema.number(), assessment_json: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; if (m.identity.semantic_assessment.status !== 'pending')
            return JSON.stringify({ status: 'ALREADY_ASSESSED', revision: m.identity.semantic_assessment.revision }); if (Number(a.revision) !== m.identity.semantic_assessment.revision)
            return JSON.stringify({ status: 'STALE_ASSESSMENT', expected_revision: m.identity.semantic_assessment.revision }); try {
            const assessment = parseSemanticIntentAssessment(String(a.assessment_json)), phase = m.identity.semantic_assessment.phase, pendingText = m.identity.semantic_assessment.pending_text;
            assertVerificationRequestTrace(pendingText, assessment);
            assertCapabilityRequestTrace(pendingText, assessment);
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
            const message = String(error), traceRelated = /verification_cases|source_units|nonvisual_request_units|capability_request_units|visual-check|request trace|request unit/i.test(message), request_unit_challenge = traceRelated ? renderRequestUnitChallenge(m.identity.semantic_assessment.pending_text) : undefined;
            appendLedger(m, 'semantic.assessment-rejected', { payload: { revision: m.identity.semantic_assessment.revision, error: message, ...(request_unit_challenge ? { request_unit_challenge } : {}) } });
            return JSON.stringify({ status: 'INVALID_ASSESSMENT', error: message, ...(request_unit_challenge ? { request_unit_challenge } : {}) });
        } } });
    const artifactAddTool = tool({ description: 'Attach one bounded context artifact reference to the current Hi mission. Optional long content is retained by the Context owner and referenced by hash/handle.', args: { kind: tool.schema.string(), title: tool.schema.string().optional(), uri: tool.schema.string().optional(), summary: tool.schema.string().optional(), sha256: tool.schema.string().optional(), content: tool.schema.string().optional(), source_files: tool.schema.string().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const kind = String(a.kind).slice(0, 80); if (/-evidence$/i.test(kind))
            return JSON.stringify({ status: 'BLOCKED', reason: 'context-artifact-cannot-create-canonical-evidence', kind, retry_same_call: false, instruction: 'Canonical verification/review evidence must come from the owning worker/result or a trusted host observation; hi_context_artifact_add is context-only.' }); const summary = a.summary ? String(a.summary).slice(0, 2000) : a.title ? String(a.title).slice(0, 300) : kind, sourceFiles = a.source_files ? String(a.source_files).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 32) : [], content = typeof a.content === 'string' && a.content.length ? redactProviderContext(String(a.content)).providerText : undefined, stored = content ? scopedStores.contextArtifacts.add(kind, summary, content, sourceFiles, { producer: 'hi-context-artifact-add', privacyClass: 'redacted' }) : undefined, raw = String(a.uri ?? summary ?? kind), item = { id: stored?.artifact_id ?? `ca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, kind, title: a.title ? String(a.title).slice(0, 300) : undefined, uri: stored ? `hi-artifact:${stored.artifact_id}` : a.uri ? String(a.uri).slice(0, 1200) : undefined, summary, sha256: stored?.content_hash ?? (a.sha256 ? String(a.sha256) : createHash('sha256').update(raw).digest('hex')), added_at: Date.now() }; const existingHandle = m.context.context_artifacts.find(x => x.id === item.id); if (!existingHandle) {
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
    const directProgressTool = tool({ description: 'Record one bounded parent/Working-Manager direct obligation. obligation_id must be the exact ID only (for example o-analysis), never ID+summary. Call separately for each completed obligation. scope_expansions, when needed, is a JSON array of {file,necessary,reason}. The result reports exact remaining obligations/methodology needs. Implementation requires owned mutation; direct review requires fresh review input. Does not bypass verification/review gates. Diagnosis analysis additionally requires a falsifiable hypothesis, falsifier, diagnostic_outcome, and canonical diagnostic_evidence_refs; prose alone cannot prove root cause.', args: { summary: tool.schema.string(), obligation_id: tool.schema.string().optional(), scope_expansions: tool.schema.string().optional(), hypothesis: tool.schema.string().optional(), falsifier: tool.schema.string().optional(), diagnostic_outcome: tool.schema.string().optional(), diagnostic_evidence_refs: tool.schema.string().optional() }, execute: async (a, c) => {
            const m = store.get(c?.sessionID);
            if (!m)
                return 'No active Hi mission';
            const missionRoot = m.identity.intent.scope === 'local' ? (workingDirectory ?? projectRoot) : projectRoot;
            if (m.identity.status === 'completed')
                return JSON.stringify({ status: 'ALREADY_COMPLETED', completion_ready: true, mission_status: 'completed', next: 'STOP', verification_required: false, remaining_obligations: [], methodology_needs: [] });
            const rawArgs = a?.input && typeof a.input === 'object' && !Array.isArray(a.input) ? { ...a, ...a.input } : a, requested = rawArgs?.obligation_id ? String(rawArgs.obligation_id) : undefined, requestedOpen = requested ? m.execution.obligations.find(x => x.id === requested && x.status === 'open') : undefined, candidates = m.execution.obligations.filter(x => ['analysis', 'implementation', 'review'].includes(x.kind) && x.status === 'open'), exact = requested ? candidates.find(x => x.id === requested) : undefined, requestedVerificationKinds = requestedOpen?.kind === 'verification' ? [...(requestedOpen.requiredEvidence ?? m.execution.verification_policy.requiredKinds)].map(x => String(x).toLowerCase().trim()) : [], directReviewAlias = requestedOpen?.kind === 'verification' && !m.execution.verification_policy.requireReview && requestedVerificationKinds.length === 1 && requestedVerificationKinds[0] === 'review-evidence' && m.execution.evidence.items.some(e => e.kind === 'review-input' && !e.invalidated_at) ? candidates.find(x => x.kind === 'review') : undefined, semanticSingle = requested && !requested.startsWith('o-') && candidates.length === 1 ? candidates[0] : undefined, o = exact ?? directReviewAlias ?? semanticSingle ?? (!requested && candidates.length === 1 ? candidates[0] : undefined), summary = String(rawArgs?.summary ?? '').trim().slice(0, 1000), candidateIDs = candidates.map(x => x.id);
            if (!summary)
                return 'BLOCKED: direct progress requires a non-empty bounded summary';
            if (requestedOpen?.kind === 'verification' && !directReviewAlias) {
                const envelope = verificationEnvelopeFor(m, requestedOpen.id, missionRoot), verification = verificationSatisfied(m, requestedOpen.id, missionRoot), missing = verification.missing, progressSignature = store.signature(m), priorSame = m.execution.ledger.filter(event => event.type === 'verification.direct-progress-rejected' && event.payload?.obligation === requestedOpen.id && event.payload?.progress_signature === progressSignature).length;
                if (priorSame >= 2)
                    return JSON.stringify({ status: 'STAGNATION_FENCED', reason: 'repeated-verification-direct-progress-no-gain', obligation_id: requestedOpen.id, retry_same_call: false, progress_signature: progressSignature, control: projectControlDecision(m, missionRoot) });
                appendLedger(m, 'verification.direct-progress-rejected', { payload: { obligation: requestedOpen.id, missing, reason: 'verification-is-evidence-owned', progress_signature: progressSignature, repeat_count: priorSame + 1 } });
                store.updateProgress(m, priorSame > 0);
                if (priorSame >= 1)
                    return JSON.stringify({ status: 'STAGNATION_FENCED', reason: 'repeated-verification-direct-progress-no-gain', obligation_id: requestedOpen.id, retry_same_call: false, progress_signature: progressSignature, required_kinds: [...requestedOpen.requiredEvidence ?? m.execution.verification_policy.requiredKinds], missing_kinds: missing, checks: envelope.checks, control: projectControlDecision(m, missionRoot) });
                return JSON.stringify({ status: 'EVIDENCE_REQUIRED', reason: 'verification-is-evidence-owned', obligation_id: requestedOpen.id, retry_same_call: false, required_kinds: [...requestedOpen.requiredEvidence ?? m.execution.verification_policy.requiredKinds], missing_kinds: missing, checks: envelope.checks });
            }
            if (requested && !requestedOpen && requested.startsWith('o-'))
                return JSON.stringify({ status: 'BLOCKED', reason: 'unknown-obligation-id', requested, candidate_ids: candidateIDs });
            if (requestedOpen && !exact && !directReviewAlias)
                return JSON.stringify({ status: 'BLOCKED', reason: `direct-progress-does-not-own-${requestedOpen.kind}`, requested, candidate_ids: candidateIDs });
            if (!o)
                return candidates.length > 1 ? JSON.stringify({ status: 'BLOCKED', reason: 'obligation-id-required', candidate_ids: candidateIDs }) : 'No open direct-progress obligation';
            if (o.kind === 'review' && m.execution.verification_policy.requireReview)
                return 'BLOCKED: independent reviewer required; direct parent progress cannot close this review obligation';
            const rejectImplementationNoGain = (reason, detail = {}) => { const progressSignature = store.signature(m), priorSame = m.execution.ledger.filter(event => event.type === 'implementation.direct-progress-rejected' && event.payload?.obligation === o.id && event.payload?.reason === reason && event.payload?.progress_signature === progressSignature).length; if (priorSame >= 2)
                return JSON.stringify({ status: 'STAGNATION_FENCED', reason: 'repeated-implementation-direct-progress-no-gain', blocked_reason: reason, obligation_id: o.id, retry_same_call: false, progress_signature: progressSignature, control: projectControlDecision(m, missionRoot) }); appendLedger(m, 'implementation.direct-progress-rejected', { payload: { obligation: o.id, reason, progress_signature: progressSignature, repeat_count: priorSame + 1, ...detail } }); store.updateProgress(m, priorSame > 0); if (priorSame >= 1)
                return JSON.stringify({ status: 'STAGNATION_FENCED', reason: 'repeated-implementation-direct-progress-no-gain', blocked_reason: reason, obligation_id: o.id, retry_same_call: false, progress_signature: progressSignature, control: projectControlDecision(m, missionRoot) }); return JSON.stringify({ status: 'BLOCKED', reason, obligation_id: o.id, retry_same_call: false, progress_signature: progressSignature, ...detail }); };
            let directFiles = [...m.vcs.changed_files], currentSource = 'historical-write-events';
            if (o.kind === 'implementation') {
                if (!primaryRoleCanDirectImplementation(m.execution.primary_mode))
                    return `BLOCKED: primary role ${m.execution.primary_mode} lacks canonical repository write authority for direct implementation progress`;
                if (!m.execution.evidence.last_mutation_at)
                    return rejectImplementationNoGain('no-observed-mutation', { recovery: { action: 'hi_task_start', role: 'coder', obligation_id: o.id, retry_same_call: false }, instruction: `Direct implementation progress only records an observed parent-owned mutation. Do not repeat this call. Start exactly one task-owned implementation attempt for ${o.id} (role=coder, obligation_ids=${o.id}); it must inspect current state and either perform the bounded missing mutation or return canonical DONE when the requested state is already satisfied.` });
                if (!m.vcs.changed_files.length) {
                    const recovered = inspectCurrentGitChangedFiles(missionRoot);
                    if (recovered === undefined)
                        return rejectImplementationNoGain('mutation-surface-unknown', { instruction: 'Use file-aware native tools or wait for native file/diff evidence before recording direct progress' });
                    if (recovered.length) {
                        directFiles = [...new Set(recovered)];
                        m.vcs.changed_files = [...new Set([...m.vcs.changed_files, ...directFiles])];
                        currentSource = 'git-status-recovery';
                        appendLedger(m, 'implementation.changed-surface-recovered', { payload: { source: 'current-git-status', files: directFiles.slice(0, 30) } });
                    }
                    else
                        return rejectImplementationNoGain('no-current-git-surface', { instruction: 'Reconcile the mutation before recording direct progress' });
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
                        const normalized = directFiles.map(file => file.replace(/\\/g, '/').replace(/^\.\//, '')), ignored = inspectGitIgnoredFiles(missionRoot, normalized);
                        if (ignored === undefined) {
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
                        else {
                            const changed = new Set(current), ignoredSet = new Set(ignored);
                            directFiles = directFiles.filter(file => { const normalized = file.replace(/\\/g, '/').replace(/^\.\//, ''); return changed.has(normalized) || (ignoredSet.has(normalized) && existsSync(resolve(missionRoot, normalized))); });
                            currentSource = ignoredSet.size ? 'git-status-plus-ignored-working-files' : 'git-status-fallback';
                        }
                    }
                }
                if (!directFiles.length)
                    return rejectImplementationNoGain('no-current-owned-diff', { source: currentSource, historical: m.vcs.changed_files.slice(0, 30) });
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
            }
            if (o.kind === 'analysis' && m.identity.intent.ambiguity !== 'none' && m.execution.obligations.some(x => x.kind === 'implementation' && x.status === 'open')) {
                appendLedger(m, 'analysis.direct-progress-rejected', { payload: { obligation: o.id, ambiguity: m.identity.intent.ambiguity, reason: 'repository-exploration-clearance-required' } });
                return JSON.stringify({ status: 'EVIDENCE_REQUIRED', reason: 'repository-exploration-clearance-required', obligation_id: o.id, ambiguity: m.identity.intent.ambiguity, retry_same_call: false, instruction: 'Start a read-only repository-explorer and settle current bounded source provenance before direct analysis can close.' });
            }
            if (o.kind === 'analysis' && m.identity.intent.taskKind === 'diagnosis') {
                const outcome = String(rawArgs?.diagnostic_outcome ?? '').toUpperCase(), hypothesis = String(rawArgs?.hypothesis ?? ''), falsifier = String(rawArgs?.falsifier ?? ''), refs = String(rawArgs?.diagnostic_evidence_refs ?? '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);
                if (!DIAGNOSTIC_HYPOTHESIS_OUTCOMES.includes(outcome) || !hypothesis.trim() || !falsifier.trim())
                    return JSON.stringify({ status: 'EVIDENCE_REQUIRED', reason: 'diagnosis-hypothesis-contract-required', required: { hypothesis: 'falsifiable root-cause statement', falsifier: 'observation that would refute the hypothesis', diagnostic_outcome: [...DIAGNOSTIC_HYPOTHESIS_OUTCOMES], diagnostic_evidence_refs: 'comma-separated canonical Evidence IDs' } });
                const assessed = assessDiagnosticHypothesis(m, { hypothesis, falsifier, outcome: outcome, evidence_refs: refs });
                appendLedger(m, 'diagnosis.hypothesis-assessed', { payload: { hypothesis_id: assessed.id, outcome: assessed.outcome, hypothesis: assessed.hypothesis, falsifier: assessed.falsifier, evidence_refs: assessed.evidence_refs, admissible_evidence_refs: assessed.admissible_evidence_refs, rejected_evidence_refs: assessed.rejected_evidence_refs } });
                if (!assessed.supported)
                    return JSON.stringify({ status: 'EVIDENCE_REQUIRED', reason: assessed.outcome === 'SUPPORTED' ? 'diagnosis-evidence-not-admissible' : 'diagnosis-hypothesis-not-supported', hypothesis_id: assessed.id, outcome: assessed.outcome, admissible_evidence_refs: assessed.admissible_evidence_refs, rejected_evidence_refs: assessed.rejected_evidence_refs, remaining_obligations: [{ id: o.id, kind: o.kind }] });
            }
            o.status = 'closed';
            o.closedAt = Date.now();
            const progressEvent = o.kind === 'review' ? 'review.direct-progress' : o.kind === 'analysis' ? 'analysis.direct-progress' : 'implementation.direct-progress';
            appendLedger(m, progressEvent, { payload: { summary: summary.slice(0, 500), obligation: o.id, changed_files: o.kind === 'implementation' ? directFiles.slice(-30) : [] } });
            if (m.methodology.parent_loaded_methodologies.length)
                bindParentMethodologyNeeds(m, m.methodology.parent_loaded_methodologies, o.id);
            const verify = m.execution.obligations.find(x => x.kind === 'verification' && x.status === 'open');
            if (verify && verificationSatisfied(m, verify.id, missionRoot).ok) {
                verify.status = 'closed';
                verify.closedAt = Date.now();
            }
            reconcileSatisfiedTaskArtifacts(m, 'parent-direct-obligation-closed');
            reconcileMethodologyExits(m, missionRoot);
            tasks.wakeQueued();
            syncMissionGates(m, missionRoot);
            const completion = evaluateCompletion(m, missionRoot);
            if (completion.complete)
                store.complete(String(c?.sessionID ?? m.identity.session_id));
            const remaining = m.execution.obligations.filter(x => x.status === 'open').slice(0, 12).map(x => ({ id: x.id, kind: x.kind })), methodologyNeeds = [...new Set(m.methodology.methodology_needs.map(x => x.name))].slice(0, 12);
            return JSON.stringify({ status: 'RECORDED', completion_ready: completion.complete, mission_status: completion.complete ? 'completed' : m.identity.status, next: completion.complete ? 'STOP' : completion.next ?? null, verification_required: completion.next === 'VERIFY' || remaining.some(x => x.kind === 'verification'), remaining_obligations: remaining, methodology_needs: methodologyNeeds, changed_files: o.kind === 'implementation' ? directFiles.slice(-30) : [] });
        } });
    const startTool = tool({ description: 'Start one bounded Hi worker task, or resume the exact existing task when task_id is supplied. Set process_lifecycle=true only when that exact task must own a long-running server/watcher/service. A NEW lifecycle-support task with no obligation_ids/required_evidence MUST provide an explicit bounded objective naming only the process-resource/readiness job; it never inherits the Mission objective, and omitted scope stays empty. command/args/env/title are NOT hi_task_start fields: the admitted child calls hi_process_spawn itself. Pass nonempty obligation_ids/required_evidence only when that same task is intentionally authorized to own mission work/evidence. For bounded Playwright visual work, browser_allowed_origins/browser_required_origins are exact URL origins, not host wildcards: include the exact port when the service uses a non-default port, and do not guess a host-only origin when the runtime service port is not known yet. When creating a NEW task, omit task_id; task_id is only for an exact canonical t_... id previously returned by Hi. For multiple scope paths, pass comma-separated project-relative paths; semicolon-separated paths are accepted for compatibility. For write-capable NEW tasks, pass exact bounded project-relative scope unless the Mission already has canonical mutation_targets; context-only likely_targets never grant write authority. For repository-explorer discovery when the exact repository target is still unknown, OMIT scope; never use symbolic root labels such as workspace, project, or root. Hi binds a new explorer scope only to current project-contained filesystem identities or exact canonical Mission targets. task_id resume never creates a replacement task.', args: { task_id: tool.schema.string().optional(), objective: tool.schema.string().optional(), role: tool.schema.string().optional(), category: tool.schema.string().optional(), model: tool.schema.string().optional(), model_variant: tool.schema.string().optional(), scope: tool.schema.string().optional(), constraints: tool.schema.string().optional(), dependencies: tool.schema.string().optional(), required_evidence: tool.schema.string().optional(), obligation_ids: tool.schema.string().optional(), context_artifact_ids: tool.schema.string().optional(), fork_from_session: tool.schema.string().optional(), isolation_required: tool.schema.boolean().optional(), isolation_reason: tool.schema.string().optional(), mcp_servers: tool.schema.string().optional(), browser_backend: tool.schema.string().optional(), browser_allowed_origins: tool.schema.string().optional(), browser_required_origins: tool.schema.string().optional(), process_lifecycle: tool.schema.boolean().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
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
            const input = { ...rawArgs, forkFromSession: rawArgs.fork_from_session ? String(rawArgs.fork_from_session) : undefined, modelVariant: rawArgs.model_variant ? String(rawArgs.model_variant) : undefined, isolationRequired: rawArgs.isolation_required === true, isolationReason: rawArgs.isolation_reason ? String(rawArgs.isolation_reason) : undefined, mcpServers: rawArgs.mcp_servers ? String(rawArgs.mcp_servers).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8) : undefined, browserBackend: rawArgs.browser_backend ? (String(rawArgs.browser_backend) === 'playwright' || String(rawArgs.browser_backend) === 'hi' ? 'bounded-playwright' : String(rawArgs.browser_backend)) : undefined, browserAllowedOrigins: rawArgs.browser_allowed_origins ? String(rawArgs.browser_allowed_origins).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8) : undefined, browserRequiredOrigins: rawArgs.browser_required_origins ? String(rawArgs.browser_required_origins).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8) : undefined, processLifecycle: rawArgs.process_lifecycle === true, scope: optionalScopeList(rawArgs.scope), constraints: rawArgs.constraints ? [String(rawArgs.constraints)] : undefined, dependencies: optionalIdList(rawArgs.dependencies), requiredEvidence: rawArgs.required_evidence ? String(rawArgs.required_evidence).split(',').map((x) => x.trim()).filter(Boolean) : undefined, obligationIds: rawArgs.obligation_ids ? String(rawArgs.obligation_ids).split(',').map((x) => x.trim()).filter(Boolean) : undefined, contextArtifactIds: rawArgs.context_artifact_ids ? String(rawArgs.context_artifact_ids).split(',').map((x) => x.trim()).filter(Boolean) : undefined };
            if (input.processLifecycle && refreshOwnedHostCapability) {
                let health;
                try {
                    health = await refreshOwnedHostCapability('process-lifecycle');
                }
                catch (error) {
                    health = { available: false, detail: String(error) };
                }
                if (!health.available) {
                    const detail = health.detail ?? 'native process lifecycle is unavailable on the active OpenCode host', staticScope = requestedRole === 'visual-qa' && (input.scope ?? []).some((path) => /\.html?$/i.test(path)), retainedLive = m.execution.processes.some(process => process.status === 'RUNNING'), resourceOnly = !(input.requiredEvidence ?? []).length && !(input.obligationIds ?? []).length;
                    if (staticScope && !retainedLive) {
                        appendLedger(m, 'capability.preflight-fallback', { payload: { capability: 'process-lifecycle', requested_role: requestedRole, detail, fallback: 'hi-owned-static-preview', task_created: false } });
                        return JSON.stringify({ status: 'BLOCKED', reason: 'process-lifecycle-unavailable-static-preview-available', capability: 'process-lifecycle', retry_same_start: false, task_created: false, detail, static_preview_available: true, instruction: 'Process lifecycle is unavailable and there is no retained live service owner. This visual scope contains a local static HTML target. If the live origin is a user/canonical requirement, preserve it and report the capability blocker; otherwise replan the same visual verification without process_lifecycle and without browser_allowed_origins/browser_required_origins so the visual-qa worker uses hi_browser_preview_open. Do not retry the same process-backed task.' });
                    }
                    if (resourceOnly) {
                        appendLedger(m, 'capability.optional-unavailable', { payload: { capability: 'process-lifecycle', detail, scope: 'task-preflight-resource', mission_blocking: false, task_created: false } });
                        return JSON.stringify({ status: 'BLOCKED', reason: 'process-support-capability-unavailable', capability: 'process-lifecycle', scope: 'task-preflight-resource', mission_blocking: false, retry_same_start: false, task_created: false, detail, instruction: 'This auxiliary process resource is unavailable on the active host. Do not create a child merely to rediscover the same capability failure; continue through any available internal verification/execution path.' });
                    }
                    const marker = markCapabilityUnavailable(m, { capability: 'process-lifecycle', reason: detail });
                    return JSON.stringify({ status: 'USER_ACTION_REQUIRED', reason: 'capability-unavailable', capability: 'process-lifecycle', blocker: marker, retry_same_start: false, task_created: false, detail });
                }
                clearCapabilityUnavailable(m, 'process-lifecycle');
            }
            const control = projectControlDecision(m, missionRoot), technicalVerificationKinds = new Set(['targeted-tests', 'typecheck', 'lint', 'build', 'changed-surface-sanity']), requestedTechnical = (input.requiredEvidence ?? []).filter((kind) => technicalVerificationKinds.has(kind)), testAuthoring = m.identity.intent.requiredCapabilities.includes('test-authoring');
            if (!input.processLifecycle && control.action === 'VERIFY' && control.verification_route_status === 'none' && requestedTechnical.length && !testAuthoring) {
                appendLedger(m, 'verification.worker-admission-blocked', { payload: { reason: 'no-admissible-repo-native-verifier', requested_evidence: requestedTechnical, requested_role: String(input.role ?? ''), routes: control.verification_routes } });
                return JSON.stringify({ status: 'BLOCKED', reason: 'no-admissible-repo-native-verifier', required_evidence: requestedTechnical, retry_same_start: false, control, instruction: 'No deterministic repo-native verifier is available for the requested technical evidence. Do not invent a test file, verifier command, or generic verifier child. Report the verifier gap; test-source creation requires an explicit test-authoring obligation.' });
            }
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
    const awaitTool = tool({ description: 'Wait for one bounded Hi task state change or terminal result without model/shell polling. Default 30s, max 60s. One timeout is never a stuck/terminal claim. Repeated exact busy/retry timeouts with no assistant/tool progress are tracked; only after the bounded no-progress stall contract is satisfied will this tool expose hi_task_cancel as an admitted recovery action. Do not repeat the same await when retry_same_await=false.', args: { id: tool.schema.string(), timeout_ms: tool.schema.number().optional() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'No active Hi mission'; const timeout = Math.max(0, Math.min(60_000, Number(a.timeout_ms ?? 30_000))), taskID = String(a.id); if (typeof tasks.modelCancelAdmission === 'function') {
            const before = await tasks.modelCancelAdmission(m, taskID);
            if (before?.allowed && before.reason === 'bounded-busy-no-progress-stall')
                return JSON.stringify({ status: 'running', terminal: false, changed: false, timed_out: false, live_status: before.live_status, retry_same_await: false, recovery: { action: 'hi_task_cancel', reason: before.reason, task_id: before.task_id ?? taskID, worker_id: before.worker_id, retry_same_await: false }, control: projectControlDecision(m, projectRoot) });
            if (!before?.allowed && before?.reason === 'cancel-recovery-abort-unavailable')
                return JSON.stringify({ status: 'BLOCKED', reason: before.reason, task_id: before.task_id ?? taskID, worker_id: before.worker_id, live_status: before.live_status, retry_same_await: false, retry_same_cancel: false, next: 'reconcile-liveness', instruction: 'The exact prior cancellation could not be confirmed by the host. Do not repeat await/cancel or start replacement work for the same obligations until this exact live task/session produces fresh progress or settles.', control: projectControlDecision(m, projectRoot) });
        } const x = await tasks.awaitTask(m, taskID, timeout); if (x.timed_out && x.worker?.id)
            appendLedger(m, 'worker.await-timeout', { task_id: x.task?.id, worker_id: x.worker.id, payload: { session_id: x.worker.session_id, attempt: x.worker.attempt, timeout_ms: timeout, live_status: x.live_status, progress_observed: x.progress_observed === true } }); let recovery = undefined; if (x.timed_out && !x.progress_observed && x.worker?.id && (x.live_status === 'busy' || x.live_status === 'retry') && typeof tasks.modelCancelAdmission === 'function') {
            const admission = await tasks.modelCancelAdmission(m, taskID);
            if (admission?.allowed && admission.reason === 'bounded-busy-no-progress-stall')
                recovery = { action: 'hi_task_cancel', reason: admission.reason, task_id: admission.task_id ?? x.task?.id, worker_id: admission.worker_id ?? x.worker.id, retry_same_await: false };
        } return JSON.stringify({ status: x.status, terminal: x.terminal, changed: x.changed, timed_out: x.timed_out, live_status: x.live_status, progress_observed: x.progress_observed === true, retry_same_await: recovery ? false : undefined, recovery, result: x?.task?.result, control: projectControlDecision(m, projectRoot) }); } });
    const cancelTool = tool({ description: 'Cancel one retained task/worker only when canonical cancellation admission allows it. Healthy busy/retry work remains fail-closed; the sole active-child exception is a bounded busy/retry no-progress stall proven by repeated await timeouts after the no-progress window. Idle-but-unreconciled or unknown execution remains protected.', args: { id: tool.schema.string() }, execute: async (a, c) => { const m = store.get(c?.sessionID); if (!m)
            return 'false'; const taskID = String(a.id), admission = await tasks.modelCancelAdmission(m, taskID); if (!admission.allowed)
            return JSON.stringify({ status: 'BLOCKED', reason: admission.reason, task_id: admission.task_id, worker_id: admission.worker_id, live_status: admission.live_status, retry_same_cancel: false, next: admission.reason === 'healthy-worker-active' ? 'hi_task_await' : admission.reason === 'child-result-reconcile-required' ? 'hi_task_peek' : 'reconcile-liveness' }); const cancelled = await tasks.cancel(m, taskID); if (cancelled)
            return 'true'; const after = typeof tasks.modelCancelAdmission === 'function' ? await tasks.modelCancelAdmission(m, taskID) : undefined; return JSON.stringify({ status: 'BLOCKED', reason: after?.reason ?? 'cancel-execution-unconfirmed', task_id: after?.task_id ?? admission.task_id ?? taskID, worker_id: after?.worker_id ?? admission.worker_id, live_status: after?.live_status ?? admission.live_status, retry_same_cancel: false, retry_same_await: false, next: 'reconcile-liveness', instruction: 'Cancellation was admitted but the host did not confirm retirement of the exact live task/session. Do not repeat cancel/await or start replacement work for the same obligations until exact ownership settles or fresh progress changes the state.' }); } });
    const browserContext = (taskID, c) => { const sid = String(c?.sessionID ?? ''); for (const m of store.all()) {
        const owner = resolveBrowserExecutionOwner(m, { sessionID: sid, taskID });
        if (owner)
            return { m, w: owner.worker, t: owner.task, cx: { task_id: taskID, execution_owner_ref: `${m.identity.mission_id}:${owner.worker.id}:${owner.worker.session_id}:${owner.worker.generation_at_spawn}`, executor_version: 'hi-playwright-browser@1', allowed_origins: [...(owner.task.execution_profile?.browser_allowed_origins ?? [])] } };
    } throw new Error('Browser execution is allowed only for the active visual-qa worker/task with a selected browser/visual methodology'); };
    const browserObservationResult = (x, observation) => { const stateHash = createHash('sha256').update(JSON.stringify(observation)).digest('hex'), evidence = addEvidence(x.m, { kind: 'browser-evidence', summary: `Browser ${String(observation?.action ?? 'observation')} ${String(observation?.result ?? 'UNKNOWN')} at ${String(observation?.url ?? 'unknown')}`.slice(0, 1000), scope: [...x.t.scope], source: `browser:${String(observation?.observation_id ?? 'unknown')}`, trusted_source_class: 'browser-observation', browser_url: typeof observation?.url === 'string' ? observation.url : undefined, browser_origin: typeof observation?.url === 'string' ? (() => { try {
            return new URL(observation.url).origin;
        }
        catch {
            return undefined;
        } })() : undefined, source_session_id: x.w.session_id, source_state_hash: stateHash, task_id: x.t.id, obligation_ids: [...x.t.obligation_ids], producer_attempt: evidenceProducerAttemptForWorker(x.m, x.w), outcome: observation?.result === 'FAILED' ? 'failed' : 'pending', pass: observation?.result === 'FAILED' ? false : undefined, reason: observation?.result === 'FAILED' ? 'browser-observation-failed' : 'browser-observation-only' }); appendLedger(x.m, 'browser.observation-recorded', { task_id: x.t.id, worker_id: x.w.id, payload: { observation_id: observation?.observation_id, evidence_ref: evidence.id, action: observation?.action, result: observation?.result } }); return JSON.stringify({ observation, evidence_ref: evidence.id }); };
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
            const requiredOrigins = owner.task.execution_profile?.browser_required_origins ?? [];
            if (requiredOrigins.length)
                throw new Error(`Static preview cannot substitute for required live browser origin(s): ${requiredOrigins.join(', ')}`);
            const preview = await previewManager.start(taskID, String(a.path), owner.task.scope);
            owner.task.execution_profile ??= {};
            owner.task.execution_profile.browser_allowed_origins = [...new Set([...(owner.task.execution_profile.browser_allowed_origins ?? []), preview.origin])];
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
    const browserViewportTool = tool({ description: 'Set one exact bounded viewport for responsive visual verification. The resulting BrowserObservation records the active width and height so later visual evidence can cite the exact rendered viewport.', args: { task_id: tool.schema.string(), width: tool.schema.number(), height: tool.schema.number() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c);
            return browserObservationResult(x, await browserExecutor.viewport(x.cx, { width: Number(a.width), height: Number(a.height) }));
        }
        catch (e) {
            return `Browser viewport blocked: ${String(e)}`;
        } } });
    const browserScreenshotTool = tool({ description: 'Capture the current page into the canonical Hi artifact owner and return a BrowserObservation plus a native image attachment for visual inspection. screenshot_artifact_ref is opaque Hi provenance, not a filesystem path; do not read/glob/search it.', args: { task_id: tool.schema.string() }, execute: async (a, c) => { try {
            if (!browserExecutor)
                return 'BLOCKED: browser executor unavailable';
            const x = browserContext(String(a.task_id), c), observation = await browserExecutor.screenshot(x.cx), output = browserObservationResult(x, observation), ref = typeof observation?.screenshot_artifact_ref === 'string' && observation.screenshot_artifact_ref.startsWith('hi-artifact:') ? observation.screenshot_artifact_ref.slice('hi-artifact:'.length) : undefined, binary = ref ? scopedStores.contextArtifacts.getBinary(ref) : undefined;
            if (!binary)
                return output;
            return { title: 'Hi browser screenshot', output, metadata: { screenshot_artifact_ref: observation.screenshot_artifact_ref }, attachments: [{ type: 'file', mime: binary.mime, url: `data:${binary.mime};base64,${base64Bytes(binary.bytes)}`, filename: binary.filename }] };
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
    const processToolContext = (c) => {
        const sid = String(c?.sessionID ?? '');
        const direct = store.get(sid);
        if (direct)
            return { m: direct, parent: true };
        const resolver = typeof tasks?.resolveChildCallback === 'function' ? tasks.resolveChildCallback.bind(tasks) : undefined, child = resolver?.(sid);
        if (!child)
            return undefined;
        const m = store.get(child.parent_session_id);
        if (!m || child.parent_mission_id !== m.identity.mission_id || child.generation_at_spawn !== m.continuation.generation)
            return undefined;
        const task = m.execution.tasks.find(t => t.id === child.task_id);
        if (!task || task.execution_profile?.process_lifecycle !== true || !task.execution_profile.tools.includes('hi_process_spawn'))
            throw new Error(`Hi process ownership: child '${child.id}' has no admitted process-lifecycle task surface.`);
        return { m, child, task };
    };
    const parentProcessExecutionBlocked = (toolID) => JSON.stringify({ status: 'BLOCKED', reason: 'process-execution-child-owner-required', required_owner: 'exact-process-lifecycle-task-worker', next_tool: 'hi_task_start', resume_existing_with: 'hi_task_start(task_id=<exact t_...>)', await_existing_with: 'hi_task_await(id=<exact t_...>)', retry_same_call: false, instruction: `${toolID} remains child-owned while its process-lifecycle task/worker is active. Parent sessions cannot proxy process execution for an active owner: spawn/write/wait remain child-only. After that exact owner is terminal, only retained same-mission list/read/kill/cleanup custody is available.` });
    const assertChildProcessContext = (cx, toolID) => { if (cx?.parent)
        throw new Error(parentProcessExecutionBlocked(toolID)); if (!cx?.child)
        throw new Error(`Hi process ownership: '${toolID}' requires an admitted process-lifecycle child session.`); };
    const assertChildProcessOwner = (cx, id) => { assertChildProcessContext(cx, 'hi_process_*'); const owned = cx.m.execution.processes.find((item) => item.process_id === id); if (!owned || owned.worker_id !== cx.child.id || owned.task_id !== cx.child.task_id)
        throw new Error(`Hi process ownership: child '${cx.child.id}' cannot access process '${id}' outside its own task.`); };
    const terminalProcessOwner = (m, item) => {
        if (!item || item.mission_id !== m.identity.mission_id || item.cleanup_state === 'CLEANED')
            return undefined;
        const task = m.execution.tasks.find((candidate) => candidate.id === item.task_id), worker = m.execution.workers.find((candidate) => candidate.id === item.worker_id);
        if (!task || !worker || task.execution_profile?.process_lifecycle !== true || worker.task_id !== task.id || task.worker_id !== worker.id || worker.parent_mission_id !== m.identity.mission_id)
            return undefined;
        const taskTerminal = ['completed', 'failed', 'cancelled'].includes(task.status), workerTerminal = ['completed', 'failed', 'cancelled'].includes(worker.status);
        return taskTerminal && workerTerminal ? { task, worker, item } : undefined;
    };
    const parentRetainedProcessAdmission = (cx, id, action, toolID) => {
        if (!cx?.parent)
            throw new Error(`Hi parent process custody: '${action}' is parent-only retained-resource admission.`);
        const item = cx.m.execution.processes.find((candidate) => candidate.process_id === id);
        if (!item)
            throw new Error(`Hi process not found in mission: ${id}`);
        const task = cx.m.execution.tasks.find((candidate) => candidate.id === item.task_id), worker = cx.m.execution.workers.find((candidate) => candidate.id === item.worker_id);
        if (!task || !worker || task.execution_profile?.process_lifecycle !== true || worker.task_id !== task.id || task.worker_id !== worker.id || worker.parent_mission_id !== cx.m.identity.mission_id)
            throw new Error(`Hi retained process owner identity is incomplete for '${id}'.`);
        const owner = terminalProcessOwner(cx.m, item);
        if (!owner)
            return { blocked: parentProcessExecutionBlocked(toolID) };
        appendLedger(cx.m, 'process.parent-custody', { task_id: owner.task.id, worker_id: owner.worker.id, payload: { action, process_id: id, status: item.status, cleanup_state: item.cleanup_state, policy: 'terminal-process-lifecycle-owner-exact-contract' } });
        return { owner };
    };
    const processCommandAdmission = (raw) => { const command = String(raw ?? '').trim(); if (!command)
        return { ok: false, command, reason: 'empty-command' }; if (resolve(command) === command && existsSync(command))
        return { ok: true, command }; if (!/\s/.test(command) && !/[;&|<>`$()]/.test(command))
        return { ok: true, command }; return { ok: false, command, reason: 'shell-like-command-string' }; };
    const processCommandBlocked = (command) => JSON.stringify({ status: 'BLOCKED', reason: 'process-command-argv-required', command, retry_same_spawn: false, contract: { command: 'single executable only', args_json: 'JSON string array of argv values' }, example: { command: 'python3', args_json: '["app.py"]' }, shell_example: { command: 'bash', args_json: '["-c","<shell command>"]' }, instruction: 'hi_process_spawn is an executable+argv API, not a shell command-string API. Put only argv[0] in command and every argument in args_json; Hi will not silently split or shell-parse command.' });
    const processSpawnTool = tool({ description: 'Spawn one process owned by the current admitted process-lifecycle child through the native OpenCode PTY lifecycle. Parent sessions cannot proxy this execution: use hi_task_start/hi_task_await to control the exact task and let that child invoke hi_process_spawn. command is argv[0] only; put every argument in args_json (example: command="python3", args_json="[\"app.py\"]"). For explicit shell semantics use command="bash" with args_json="[\"-c\",\"...\"]"; Hi never silently splits a shell-like command string. timeout_ms is an optional HARD wall-clock termination deadline, not a readiness/wait budget: omit timeout_ms for a server/watcher/service that must remain alive while verification uses it. Never increase a finite timeout and replay the same healthy persistent command as a substitute for persistence. For a persistent local HTTP(S) service that will be browser-verified, pass service_origins with the exact loopback origin(s), including the exact port. If this task already has an exact bounded browser plan, every declared service origin must match that plan exactly or spawn is rejected before native execution; Hi never widens browser authority from process output. Hi also reconciles local origins mechanically from bounded process output. Native permission ask remains a real OpenCode permission request.', args: { worker_id: tool.schema.string().optional(), command: tool.schema.string(), args_json: tool.schema.string().optional(), cwd: tool.schema.string().optional(), timeout_ms: tool.schema.number().optional(), title: tool.schema.string().optional(), service_origins: tool.schema.string().optional() }, execute: async (a, c) => { let cx; try {
            cx = processToolContext(c);
        }
        catch (error) {
            return `Process spawn blocked: ${String(error)}`;
        } ; if (!cx)
            return 'No active Hi mission'; if (cx.parent)
            return parentProcessExecutionBlocked('hi_process_spawn'); const requestedWorkerID = typeof a.worker_id === 'string' ? String(a.worker_id).trim() : ''; const workerID = cx.child.id; if (requestedWorkerID && requestedWorkerID !== workerID)
            return `Process spawn blocked: Hi process ownership: child '${workerID}' cannot spawn for worker '${requestedWorkerID}'.`; const admitted = processCommandAdmission(a.command); if (!admitted.ok)
            return processCommandBlocked(admitted.command); const m = cx.m; let args; if (a.args_json) {
            try {
                const parsed = JSON.parse(String(a.args_json));
                if (!Array.isArray(parsed) || !parsed.every(x => typeof x === 'string'))
                    throw new Error('args_json must be a JSON string array');
                args = parsed;
            }
            catch (error) {
                return `BLOCKED: invalid args_json: ${String(error)}`;
            }
        } const declaredServiceOrigins = a.service_origins ? normalizeBrowserAllowedOrigins(String(a.service_origins).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8)) : undefined, browserPlanOrigins = (cx.task.execution_profile?.browser_required_origins?.length ? cx.task.execution_profile.browser_required_origins : cx.task.execution_profile?.browser_allowed_origins) ?? []; if (declaredServiceOrigins?.length && cx.task.execution_profile?.browser_backend === 'bounded-playwright' && browserPlanOrigins.length) {
            const incompatible = declaredServiceOrigins.filter((origin) => !browserPlanOrigins.includes(origin));
            if (incompatible.length) {
                appendLedger(m, 'process.service-origin-plan-rejected', { task_id: cx.task.id, worker_id: workerID, payload: { declared_service_origins: declaredServiceOrigins, required_browser_origins: browserPlanOrigins, incompatible_service_origins: incompatible, policy: 'exact-browser-origin-authority-before-process-spawn' } });
                return JSON.stringify({ status: 'BLOCKED', reason: 'process-service-origin-outside-browser-plan', retry_same_spawn: false, declared_service_origins: declaredServiceOrigins, required_browser_origins: browserPlanOrigins, incompatible_service_origins: incompatible, instruction: 'This visual task has immutable exact browser-origin authority. A browser-verified service must bind and declare one of the exact planned origins, including the exact port. Do not choose another port and do not widen the browser plan from process output; return control so the parent can replan the task if the planned origin cannot be served.' });
            }
        } let observed; if (refreshOwnedHostCapability)
            try {
                observed = await refreshOwnedHostCapability('process-lifecycle');
            }
            catch (error) {
                observed = { available: false, detail: String(error) };
            } const processCapability = hostCapabilityByID(capabilities.contracts ?? [], 'process-lifecycle'); if (observed?.available === false || processCapability?.status !== 'SUPPORTED') {
            const detail = observed?.detail ?? 'native process lifecycle is unavailable on the active OpenCode host';
            if (isResourceOnlyProcessSupportTask(cx.task)) {
                appendLedger(m, 'capability.optional-unavailable', { task_id: cx.task.id, worker_id: workerID, payload: { capability: 'process-lifecycle', detail, scope: 'task-local-resource', mission_blocking: false } });
                return JSON.stringify({ status: 'BLOCKED', reason: 'process-support-capability-unavailable', capability: 'process-lifecycle', scope: 'task-local-resource', mission_blocking: false, retry_same_spawn: false, detail, instruction: 'This auxiliary process resource is unavailable on the active host. Return BLOCKED for this resource-only task without requesting user action; the parent must continue through any available internal verification/execution path.' });
            }
            const marker = markCapabilityUnavailable(m, { capability: 'process-lifecycle', reason: detail, taskId: cx.task.id, workerId: workerID });
            return JSON.stringify({ status: 'USER_ACTION_REQUIRED', reason: 'capability-unavailable', capability: 'process-lifecycle', blocker: marker, detail });
        } clearCapabilityUnavailable(m, 'process-lifecycle'); try {
            return JSON.stringify(await processRuntime.spawn(m, { worker_id: workerID, command: admitted.command, args, cwd: String(a.cwd ?? c?.directory ?? projectRoot), timeout_ms: a.timeout_ms === undefined ? undefined : Number(a.timeout_ms), title: a.title ? String(a.title) : undefined, service_origins: declaredServiceOrigins, ask: async (request) => c.ask({ permission: request.permission, patterns: request.patterns, always: request.always, metadata: request.metadata }) }));
        }
        catch (error) {
            if (refreshOwnedHostCapability) {
                let after;
                try {
                    after = await refreshOwnedHostCapability('process-lifecycle');
                }
                catch (probeError) {
                    after = { available: false, detail: String(probeError) };
                }
                if (!after.available) {
                    const detail = after.detail ?? String(error);
                    if (isResourceOnlyProcessSupportTask(cx.task)) {
                        appendLedger(m, 'capability.optional-unavailable', { task_id: cx.task.id, worker_id: workerID, payload: { capability: 'process-lifecycle', detail, scope: 'task-local-resource', mission_blocking: false, phase: 'post-spawn-reobserve' } });
                        return JSON.stringify({ status: 'BLOCKED', reason: 'process-support-capability-unavailable', capability: 'process-lifecycle', scope: 'task-local-resource', mission_blocking: false, retry_same_spawn: false, detail, instruction: 'This auxiliary process resource is unavailable on the active host. Return BLOCKED for this resource-only task without requesting user action; the parent must continue through any available internal verification/execution path.' });
                    }
                    const marker = markCapabilityUnavailable(m, { capability: 'process-lifecycle', reason: detail, taskId: cx.task.id, workerId: workerID });
                    return JSON.stringify({ status: 'USER_ACTION_REQUIRED', reason: 'capability-unavailable', capability: 'process-lifecycle', blocker: marker, detail });
                }
            }
            return `Process spawn blocked: ${String(error)}`;
        } } });
    const processReadTool = tool({ description: 'Read one bounded cursor window from the current child-owned process, or from an exact same-mission retained ProcessContract after its process-lifecycle task/worker is terminal. Parent custody never changes original task/worker ownership. Output observation is hash-bound Evidence input, never implicit verification PASS.', args: { id: tool.schema.string(), cursor: tool.schema.number().optional(), max_chars: tool.schema.number().optional() }, execute: async (a, c) => { try {
            const cx = processToolContext(c);
            if (!cx)
                return 'No active Hi mission';
            const id = String(a.id);
            if (cx.parent) {
                const admission = parentRetainedProcessAdmission(cx, id, 'read', 'hi_process_read');
                if (admission.blocked)
                    return admission.blocked;
            }
            else
                assertChildProcessOwner(cx, id);
            return JSON.stringify(await processRuntime.read(cx.m, id, a.cursor === undefined ? undefined : Number(a.cursor), a.max_chars === undefined ? undefined : Number(a.max_chars)));
        }
        catch (error) {
            return `Process read failed: ${String(error)}`;
        } } });
    const processWriteTool = tool({ description: 'Write bounded stdin to a running process owned by the current admitted process-lifecycle child. Parent proxy execution is blocked.', args: { id: tool.schema.string(), input: tool.schema.string() }, execute: async (a, c) => { try {
            const cx = processToolContext(c);
            if (!cx)
                return 'No active Hi mission';
            if (cx.parent)
                return parentProcessExecutionBlocked('hi_process_write');
            assertChildProcessOwner(cx, String(a.id));
            await processRuntime.write(cx.m, String(a.id), String(a.input));
            return 'OK';
        }
        catch (error) {
            return `Process write failed: ${String(error)}`;
        } } });
    const processWaitTool = tool({ description: 'Await natural/timeout terminal exit for one process owned by the current admitted process-lifecycle child. Do NOT call this on a server/watcher/service that is intentionally supposed to remain RUNNING while you verify against it; for persistent service mode use hi_process_read or the service itself, then hi_process_kill and hi_process_cleanup when verification is finished. Parent proxy execution is blocked. This is event-driven and must not be used as a polling loop.', args: { id: tool.schema.string() }, execute: async (a, c) => { try {
            const cx = processToolContext(c);
            if (!cx)
                return 'No active Hi mission';
            if (cx.parent)
                return parentProcessExecutionBlocked('hi_process_wait');
            assertChildProcessOwner(cx, String(a.id));
            const current = await processRuntime.observe(cx.m, String(a.id));
            if (current.status !== 'RUNNING')
                return JSON.stringify(current);
            if (current.timeout_at === undefined)
                return JSON.stringify({ status: 'BLOCKED', reason: 'persistent-process-still-running', process_id: String(a.id), deadline_policy: 'none', retry_wait: false, next_tools: ['hi_process_read', 'hi_process_kill', 'hi_process_cleanup'], instruction: 'This process has no hard deadline and is therefore in persistent-service mode. Keep it running while exercising/health-checking the service; do not wait for exit. When verification is complete, kill the exact owned process and then cleanup it.' });
            return JSON.stringify(await processRuntime.wait(cx.m, String(a.id)));
        }
        catch (error) {
            return `Process wait failed: ${String(error)}`;
        } } });
    const processKillTool = tool({ description: 'Terminate one running process after native PID/command/cwd identity revalidation. Active execution remains child-only; after the exact process-lifecycle task/worker is terminal, the parent may terminate only that retained same-mission ProcessContract as mission custodian.', args: { id: tool.schema.string(), signal: tool.schema.string().optional() }, execute: async (a, c) => { try {
            const cx = processToolContext(c);
            if (!cx)
                return 'No active Hi mission';
            const signal = String(a.signal ?? 'SIGTERM');
            if (!['SIGTERM', 'SIGINT'].includes(signal))
                return 'BLOCKED: signal must be SIGTERM or SIGINT';
            const id = String(a.id);
            if (cx.parent) {
                const admission = parentRetainedProcessAdmission(cx, id, 'kill', 'hi_process_kill');
                if (admission.blocked)
                    return admission.blocked;
            }
            else
                assertChildProcessOwner(cx, id);
            return JSON.stringify(await processRuntime.kill(cx.m, id, signal));
        }
        catch (error) {
            return `Process kill failed: ${String(error)}`;
        } } });
    const processCleanupTool = tool({ description: 'Cleanup one terminal process. Active execution remains child-only; after the exact process-lifecycle task/worker is terminal, the parent may cleanup only that retained same-mission ProcessContract. Cleanup never terminates a running process and original task/worker ownership is preserved.', args: { id: tool.schema.string() }, execute: async (a, c) => { try {
            const cx = processToolContext(c);
            if (!cx)
                return 'No active Hi mission';
            const id = String(a.id);
            if (cx.parent) {
                const admission = parentRetainedProcessAdmission(cx, id, 'cleanup', 'hi_process_cleanup');
                if (admission.blocked)
                    return admission.blocked;
                if (admission.owner.item.status === 'RUNNING')
                    return 'BLOCKED: retained running process must be killed before cleanup';
            }
            else
                assertChildProcessOwner(cx, id);
            await processRuntime.cleanup(cx.m, id);
            return 'OK';
        }
        catch (error) {
            return `Process cleanup failed: ${String(error)}`;
        } } });
    const processListTool = tool({ description: 'List bounded durable ProcessContracts for the active child owner, or only exact retained same-mission processes whose process-lifecycle task/worker is terminal when called by the parent. Active child resources never transfer parent custody.', args: {}, execute: async (_a, c) => { try {
            const cx = processToolContext(c);
            if (!cx)
                return 'No active Hi mission';
            const rows = processRuntime.list(cx.m);
            if (cx.parent)
                return JSON.stringify(rows.filter((item) => Boolean(terminalProcessOwner(cx.m, item))));
            return JSON.stringify(rows.filter((item) => item.worker_id === cx.child.id && item.task_id === cx.child.task_id));
        }
        catch (error) {
            return `Process list failed: ${String(error)}`;
        } } });
    const toolSurface = { hi_doctor: doctorTool, hi_status: statusTool, hi_settings: settingsTool, hi_role_models: roleModelsTool, hi_metrics: metricsTool, hi_super_product: superProductTool, hi_ledger: ledgerTool, hi_readiness: readinessTool, hi_intent_assess: intentAssessTool, hi_context_artifact_add: artifactAddTool, hi_context_artifacts: artifactsTool, hi_temporary_mutation_register: mutationTool, hi_temporary_mutation_revert: nativeRollbackTool, hi_direct_progress: directProgressTool, hi_task_start: startTool, hi_task_await: awaitTool, hi_task_peek: peekTool, hi_task_list: listTool, hi_task_cancel: cancelTool, hi_process_spawn: processSpawnTool, hi_process_read: processReadTool, hi_process_write: processWriteTool, hi_process_wait: processWaitTool, hi_process_kill: processKillTool, hi_process_cleanup: processCleanupTool, hi_process_list: processListTool, hi_browser_preview_open: browserPreviewOpenTool, hi_browser_open: browserOpenTool, hi_browser_navigate: browserNavigateTool, hi_browser_click: browserClickTool, hi_browser_type: browserTypeTool, hi_browser_key: browserKeyTool, hi_browser_inspect: browserInspectTool, hi_browser_viewport: browserViewportTool, hi_browser_screenshot: browserScreenshotTool, hi_browser_wait: browserWaitTool, hi_browser_close: browserCloseTool };
    const browserOperationInFlight = new Map();
    for (const toolID of HI_BROWSER_EXECUTION_TOOL_IDS) {
        const definition = toolSurface[toolID], original = definition?.execute;
        if (typeof original !== 'function')
            continue;
        definition.execute = async (a, c) => {
            const sid = String(c?.sessionID ?? ''), taskID = String(a?.task_id ?? '');
            let mission, owner;
            for (const candidate of store.all()) {
                const resolved = resolveBrowserExecutionOwner(candidate, { sessionID: sid, taskID });
                if (resolved) {
                    mission = candidate;
                    owner = resolved;
                    break;
                }
            }
            if (!mission || !owner)
                return original(a, c);
            const key = `${mission.identity.mission_id}:${owner.task.id}:${owner.worker.id}:${owner.worker.session_id}:${owner.worker.generation_at_spawn}:${owner.worker.attempt ?? 0}`, active = browserOperationInFlight.get(key);
            if (active) {
                if (!active.reported) {
                    active.reported = true;
                    appendLedger(mission, 'browser.operation-overlap-rejected', { task_id: owner.task.id, worker_id: owner.worker.id, payload: { active_operation: active.tool, requested_operation: toolID, policy: 'single-in-flight-browser-operation-per-exact-owner' } });
                }
                return JSON.stringify({ status: 'BLOCKED', reason: 'browser-operation-in-flight', active_operation: active.tool, requested_operation: toolID, retry_same_call: false });
            }
            const token = Symbol(toolID);
            browserOperationInFlight.set(key, { token, tool: toolID, reported: false });
            try {
                return await original(a, c);
            }
            finally {
                if (browserOperationInFlight.get(key)?.token === token)
                    browserOperationInFlight.delete(key);
            }
        };
    }
    assertHiToolNamespace(Object.keys(toolSurface));
    return { toolSurface };
}
