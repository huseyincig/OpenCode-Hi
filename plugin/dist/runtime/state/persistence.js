import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { runtimeStatePath } from '../storage/locations.js';
import { isEvidenceItemContract } from '../../contracts/evidence.js';
import { isTaskContract } from '../../contracts/task.js';
import { isWorkerContract } from '../../contracts/worker.js';
import { HI_METHODOLOGY_PRODUCERS, HI_METHODOLOGY_SIGNAL_CATALOG, HI_METHODOLOGY_TRIGGER_SOURCES } from '../../generated/methodology-policy.js';
import { SEMANTIC_CAPABILITIES, SEMANTIC_VERIFICATION_KINDS } from '../intent/semantic-assessment.js';
export const RUNTIME_STATE_SCHEMA = 7;
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function stringArray(value) { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function recordArray(value) { return Array.isArray(value) && value.every(isRecord); }
const OBLIGATION_KINDS = new Set(['analysis', 'implementation', 'verification', 'review', 'authority']);
const OBLIGATION_STATUSES = new Set(['open', 'closed', 'blocked']);
const GATE_KINDS = new Set(['verification', 'user-authority', 'reviewer', 'prerequisite-task', 'precondition', 'rollback']);
const GATE_STATUSES = new Set(['open', 'ready', 'blocked', 'closed']);
function validObligation(value) {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.status !== 'string' || !OBLIGATION_STATUSES.has(value.status) || typeof value.kind !== 'string' || !OBLIGATION_KINDS.has(value.kind) || typeof value.summary !== 'string')
        return false;
    if (value.requiredEvidence !== undefined && (!stringArray(value.requiredEvidence) || !value.requiredEvidence.every(kind => SEMANTIC_VERIFICATION_KINDS.includes(kind))))
        return false;
    if (value.blocker !== undefined && typeof value.blocker !== 'string')
        return false;
    if (value.closedAt !== undefined && typeof value.closedAt !== 'number')
        return false;
    return true;
}
function validGate(value) {
    return isRecord(value) && typeof value.id === 'string' && typeof value.kind === 'string' && GATE_KINDS.has(value.kind) && typeof value.summary === 'string' && typeof value.status === 'string' && GATE_STATUSES.has(value.status) && (value.reason === undefined || typeof value.reason === 'string') && typeof value.updated_at === 'number';
}
function validContextArtifact(value) {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.kind !== 'string' || typeof value.added_at !== 'number')
        return false;
    for (const field of ['uri', 'title', 'summary', 'sha256'])
        if (value[field] !== undefined && typeof value[field] !== 'string')
            return false;
    return true;
}
function validTemporaryMutation(value) {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.kind !== 'string' || typeof value.description !== 'string' || typeof value.rollback_command !== 'string' || typeof value.rollback_hash !== 'string' || !['active', 'rolled-back', 'failed'].includes(String(value.status)) || typeof value.created_at !== 'number')
        return false;
    if (value.rollback_mode !== undefined && !['command', 'native-revert'].includes(String(value.rollback_mode)))
        return false;
    for (const field of ['session_id', 'message_id', 'detail'])
        if (value[field] !== undefined && typeof value[field] !== 'string')
            return false;
    return value.resolved_at === undefined || typeof value.resolved_at === 'number';
}
function validMethodologyNeed(value) {
    if (!isRecord(value) || typeof value.name !== 'string' || !/^hi-[a-z0-9-]+$/.test(value.name))
        return false;
    if (typeof value.signal !== 'string' || !Object.prototype.hasOwnProperty.call(HI_METHODOLOGY_SIGNAL_CATALOG, value.signal))
        return false;
    const signal = HI_METHODOLOGY_SIGNAL_CATALOG[value.signal];
    if (typeof value.trigger_source !== 'string' || value.trigger_source !== signal.trigger_source || !HI_METHODOLOGY_TRIGGER_SOURCES.includes(value.trigger_source))
        return false;
    if (typeof value.producer !== 'string' || !signal.producers.includes(value.producer) || !HI_METHODOLOGY_PRODUCERS.includes(value.producer))
        return false;
    if (value.task_id !== undefined && typeof value.task_id !== 'string')
        return false;
    if (value.obligation_id !== undefined && typeof value.obligation_id !== 'string')
        return false;
    return typeof value.reason === 'string' && typeof value.created_at === 'number';
}
function validVerificationPolicy(value) {
    if (!isRecord(value) || !stringArray(value.requiredKinds) || typeof value.requireFresh !== 'boolean' || typeof value.requireReview !== 'boolean' || typeof value.allowWorkerReportedEvidence !== 'boolean')
        return false;
    const allowed = new Set(SEMANTIC_VERIFICATION_KINDS);
    return value.requiredKinds.every(kind => allowed.has(kind));
}
function validSemanticAssessment(value) {
    if (!isRecord(value))
        return false;
    return ['pending', 'assessed'].includes(String(value.status)) && ['initial', 'followup'].includes(String(value.phase)) && typeof value.revision === 'number' && value.revision >= 1 && value.source === 'host-primary' && typeof value.pending_text === 'string' && (value.assessed_at === undefined || typeof value.assessed_at === 'number');
}
function validIntent(value) {
    if (!isRecord(value))
        return false;
    return typeof value.objective === 'string'
        && ['unclassified', 'implementation', 'bug-fix', 'review', 'performance', 'release-readiness'].includes(String(value.taskKind))
        && ['local', 'multi-file', 'repo-wide', 'external', 'multi-stream'].includes(String(value.scope))
        && ['low', 'medium', 'high', 'authority-boundary'].includes(String(value.risk))
        && ['none', 'resolvable', 'contract-critical'].includes(String(value.ambiguity))
        && ['independent', 'sequential', 'external-gated', 'unknown', 'independent-multi'].includes(String(value.dependencyClass))
        && stringArray(value.requiredCapabilities) && value.requiredCapabilities.every(x => SEMANTIC_CAPABILITIES.includes(x))
        && Array.isArray(value.requestedExternalActions) && value.requestedExternalActions.every(x => ['git-push', 'release-create', 'package-publish', 'deploy'].includes(String(x)))
        && stringArray(value.likelyVerification) && value.likelyVerification.every(x => SEMANTIC_VERIFICATION_KINDS.includes(x))
        && stringArray(value.avoid)
        && (value.likelyTargets === undefined || stringArray(value.likelyTargets));
}
function validMission(value) {
    if (!isRecord(value) || typeof value.mission_id !== 'string' || typeof value.session_id !== 'string' || typeof value.objective !== 'string')
        return false;
    if (!validIntent(value.intent) || !validSemanticAssessment(value.semantic_assessment) || !validVerificationPolicy(value.verification_policy))
        return false;
    if (value.semantic_assessment.status === 'assessed' && value.intent.taskKind === 'unclassified')
        return false;
    if (value.semantic_assessment.status === 'pending' && value.semantic_assessment.phase === 'initial' && ((value.obligations?.length ?? 0) > 0 || (value.tasks?.length ?? 0) > 0 || (value.workers?.length ?? 0) > 0 || (value.methodology_needs?.length ?? 0) > 0))
        return false;
    if ((!Array.isArray(value.obligations) || !value.obligations.every(validObligation)) || !Array.isArray(value.tasks) || !value.tasks.every(isTaskContract) || !Array.isArray(value.workers) || !value.workers.every(isWorkerContract) || !recordArray(value.ledger))
        return false;
    if ((!Array.isArray(value.context_artifacts) || !value.context_artifacts.every(validContextArtifact)) || (!Array.isArray(value.gates) || !value.gates.every(validGate)) || (!Array.isArray(value.temporary_mutations) || !value.temporary_mutations.every(validTemporaryMutation)) || !Array.isArray(value.methodology_needs) || !value.methodology_needs.every(validMethodologyNeed))
        return false;
    if (!stringArray(value.changed_files) || !stringArray(value.blockers) || !stringArray(value.constraints) || !stringArray(value.parent_loaded_methodologies))
        return false;
    if (!isRecord(value.evidence) || typeof value.evidence.fresh !== 'boolean' || !Array.isArray(value.evidence.items) || !value.evidence.items.every(isEvidenceItemContract) || (value.evidence.last_mutation_at !== undefined && typeof value.evidence.last_mutation_at !== 'number'))
        return false;
    if (typeof value.generation !== 'number' || typeof value.iteration !== 'number' || typeof value.continuation_budget !== 'number' || typeof value.continuation_active !== 'boolean')
        return false;
    if (typeof value.pending_permissions !== 'number' || !stringArray(value.pending_permission_ids) || typeof value.user_interrupted !== 'boolean' || typeof value.resume_count !== 'number' || typeof value.created_at !== 'number' || typeof value.updated_at !== 'number')
        return false;
    return true;
}
function bootID() { return `boot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }
export class RuntimePersistence {
    path;
    bootId = bootID();
    startedAt = Date.now();
    previousBootId;
    lastLoadReport = { targetSchema: RUNTIME_STATE_SCHEMA, loaded: 0 };
    constructor(projectRoot) { this.path = runtimeStatePath(projectRoot); }
    load() {
        if (!existsSync(this.path)) {
            this.lastLoadReport = { targetSchema: RUNTIME_STATE_SCHEMA, loaded: 0 };
            return [];
        }
        try {
            const parsed = JSON.parse(readFileSync(this.path, 'utf8'));
            if (!isRecord(parsed))
                throw new Error('runtime state is not an object');
            const schema = Number(parsed.schema);
            if (schema !== RUNTIME_STATE_SCHEMA)
                throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`);
            if (!Array.isArray(parsed.missions))
                throw new Error('missions is not an array');
            const missions = [];
            for (let index = 0; index < parsed.missions.length; index++) {
                const mission = parsed.missions[index];
                if (!validMission(mission))
                    throw new Error(`invalid mission state at index ${index}`);
                missions.push(mission);
            }
            const runtime = parsed.runtime;
            if (!isRecord(runtime) || typeof runtime.boot_id !== 'string' || typeof runtime.clean_shutdown !== 'boolean')
                throw new Error('runtime envelope invalid');
            this.previousBootId = runtime.boot_id;
            this.lastLoadReport = { sourceSchema: schema, targetSchema: RUNTIME_STATE_SCHEMA, loaded: missions.length, previousBootId: runtime.boot_id, uncleanShutdown: runtime.clean_shutdown === false };
            return missions;
        }
        catch (error) {
            this.lastLoadReport = { targetSchema: RUNTIME_STATE_SCHEMA, loaded: 0, error: String(error) };
            return [];
        }
    }
    save(missions, cleanShutdown = false) {
        mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
        const now = Date.now();
        const payload = { schema: RUNTIME_STATE_SCHEMA, updated_at: now, runtime: { boot_id: this.bootId, started_at: this.startedAt, clean_shutdown: cleanShutdown, last_saved_at: now, previous_boot_id: this.previousBootId }, missions };
        const tmp = `${this.path}.tmp`;
        writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
        renameSync(tmp, this.path);
    }
    markRunning(missions) { this.save(missions, false); }
    markCleanShutdown(missions) { this.save(missions, true); }
}
