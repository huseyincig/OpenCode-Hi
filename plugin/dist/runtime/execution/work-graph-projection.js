import { executionAttemptIdentity } from '../../contracts/orchestration-core.js';
import { hasFreshPassedEvidence } from '../evidence/freshness.js';
function clone(value) { return structuredClone(value); }
function projectNode(task, missionId) {
    return {
        id: task.id,
        missionId: task.mission_id || missionId,
        objective: task.objective,
        status: task.status,
        scope: [...task.scope],
        constraints: [...task.constraints],
        dependencies: [...task.dependencies],
        requiredEvidence: [...task.requiredEvidence],
        obligationIds: [...task.obligation_ids],
        contextReferences: clone(task.context_artifacts),
        externalActionRequirements: [...(task.external_action_requirements ?? [])],
        gateIds: [...task.gate_ids],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
    };
}
function projectResources(task, worker) {
    if (!worker && !task.execution_profile)
        return undefined;
    const profile = task.execution_profile;
    return {
        role: worker?.role ?? profile?.role ?? task.role,
        category: worker?.category ?? profile?.category ?? task.category,
        ...(worker?.requested_model ? { requestedModel: worker.requested_model } : {}),
        ...(worker?.requested_model_variant ? { requestedModelVariant: worker.requested_model_variant } : {}),
        ...((worker?.model ?? profile?.model) ? { selectedModel: worker?.model ?? profile?.model } : {}),
        ...((worker?.model_variant ?? profile?.model_variant) ? { selectedModelVariant: worker?.model_variant ?? profile?.model_variant } : {}),
        ...(worker?.projected_model ? { projectedModel: worker.projected_model } : {}),
        ...(worker?.projected_model_variant ? { projectedModelVariant: worker.projected_model_variant } : {}),
        ...(worker?.effective_model ? { effectiveModel: worker.effective_model } : {}),
        ...(worker?.effective_model_variant ? { effectiveModelVariant: worker.effective_model_variant } : {}),
        ...(worker?.effective_model_verified === undefined ? {} : { effectiveModelVerified: worker.effective_model_verified }),
        ...(worker?.effective_model_variant_verified === undefined ? {} : { effectiveModelVariantVerified: worker.effective_model_variant_verified }),
        ...(worker?.effective_model_source ? { effectiveModelSource: worker.effective_model_source } : {}),
        fallbacks: [...(worker?.fallbacks ?? profile?.fallback_models ?? [])],
        recoveryCandidates: [...(worker?.recovery_candidates ?? [])],
        modelSelectionReason: [...(worker?.model_selection_reason ?? [])],
    };
}
function projectAttempt(unitID, worker, missionGeneration) {
    if (!worker)
        return undefined;
    const identity = executionAttemptIdentity({ executionUnitId: unitID, workerId: worker.id, ordinal: worker.attempt ?? 0, generation: worker.generation_at_spawn ?? missionGeneration });
    return {
        ...identity,
        workerId: worker.id,
        status: worker.status,
        ...(worker.started_at === undefined ? {} : { startedAt: worker.started_at }),
        updatedAt: worker.updated_at ?? worker.started_at ?? 0,
        ...(worker.completed_at === undefined ? {} : { completedAt: worker.completed_at }),
        ...(worker.session_id ? { sessionId: worker.session_id } : {}),
        ...(worker.forked_from_session_id ? { forkedFromSessionId: worker.forked_from_session_id } : {}),
        recoveryAttempt: worker.runtime_recovery_attempt ?? 0,
        ...(worker.last_runtime_failure_kind ? { lastFailureKind: worker.last_runtime_failure_kind } : {}),
        fallbackHistory: clone(worker.fallback_history ?? []),
    };
}
function projectUnit(task, worker, missionId, missionGeneration) {
    const id = `eu:${task.id}`, resourceSelection = projectResources(task, worker), attempt = projectAttempt(id, worker, missionGeneration);
    return {
        id,
        missionId: task.mission_id || missionId,
        workNodeId: task.id,
        objective: task.objective,
        role: task.role,
        category: task.category,
        dependencies: [...task.dependencies],
        scope: [...task.scope],
        constraints: [...task.constraints],
        requiredEvidence: [...task.requiredEvidence],
        obligationIds: [...task.obligation_ids],
        contextReferences: clone(task.context_artifacts),
        ...(resourceSelection ? { resourceSelection } : {}),
        ...(attempt ? { attempt } : {}),
        ...(worker?.fingerprint ? { workerFingerprint: worker.fingerprint } : {}),
        writeSet: [...(worker?.write_set ?? [])],
        ...(worker?.native_state_hash ? { nativeStateHash: worker.native_state_hash } : {}),
        ...(task.result ? { result: clone(task.result) } : {}),
    };
}
/**
 * Side-effect-free compatibility projection from the current durable runtime.
 * This does not replace Mission/Task/Worker ownership; it proves the new core
 * boundary can represent current orchestration state before migration begins.
 */
export function projectMissionToWorkGraph(mission, observedAt = Date.now()) {
    const workerByTask = new Map(mission.execution.workers.map(worker => [worker.task_id, worker]));
    const nodes = mission.execution.tasks.map(task => projectNode(task, mission.identity.mission_id));
    const edges = mission.execution.tasks.flatMap(task => task.dependencies.map(dependency => ({ from: dependency, to: task.id, kind: 'requires' })));
    const executionUnits = mission.execution.tasks.map(task => projectUnit(task, workerByTask.get(task.id), mission.identity.mission_id, mission.continuation.generation));
    return {
        missionId: mission.identity.mission_id,
        objective: mission.identity.objective,
        missionStatus: mission.identity.status,
        requiredCapabilities: [...mission.identity.intent.requiredCapabilities],
        risk: mission.identity.risk,
        executionMode: mission.execution.execution_mode,
        topology: { mode: mission.execution.topology?.mode ?? (mission.execution.execution_mode === 'single' ? 'single-agent' : 'multi-agent'), parallelism: mission.execution.topology?.parallelism ?? 1, reason: [...(mission.execution.topology?.reason ?? ['legacy-runtime-default'])] },
        nodes,
        edges,
        executionUnits,
        evidence: { fresh: hasFreshPassedEvidence(mission.execution.evidence.items), ...(mission.execution.evidence.last_mutation_at === undefined ? {} : { lastMutationAt: mission.execution.evidence.last_mutation_at }), items: clone(mission.execution.evidence.items) },
        authority: { pendingPermissions: mission.authority.pending_permissions, pendingPermissionIds: [...(mission.authority.pending_permission_ids ?? [])], ...(mission.authority.authority ? { state: clone(mission.authority.authority) } : {}) },
        blockers: [...mission.execution.blockers],
        progress: { missionId: mission.identity.mission_id, generation: mission.continuation.generation, iteration: mission.continuation.iteration, signature: mission.continuation.last_progress_signature, stagnationCount: mission.continuation.stagnation_count, continuationBudget: mission.continuation.continuation_budget, continuationActive: mission.continuation.continuation_active, ...(mission.continuation.continuation_reason ? { reason: mission.continuation.continuation_reason } : {}), observedAt, ...(mission.continuation.last_progress_delta ? { delta: clone(mission.continuation.last_progress_delta) } : {}) },
    };
}
