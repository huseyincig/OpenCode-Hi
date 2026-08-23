import { decideAdaptiveExecution } from '../execution/adaptive-policy.js';
import { decideTopology } from '../execution/topology-policy.js';
import { minimumTeamFor } from '../routing/minimum-team.js';
import { continuationBudget, resolveCategory } from '../routing/category.js';
import { counterfactualDecisionStability } from './counterfactual-stability.js';
function providerSurfacePhase(path) {
    if (path === 'DIRECT')
        return 'DIRECT_CONTROL';
    if (path === 'EVIDENCE')
        return 'EVIDENCE_CONTROL';
    if (path === 'PLANNED')
        return 'GRAPH_CONTROL';
    return 'ESCALATED_CONTROL';
}
function capabilityIntent(intent, topology) {
    const caps = [...new Set(intent.requiredCapabilities)];
    const writeTask = !['diagnosis', 'review', 'release-readiness'].includes(intent.taskKind);
    const workspaceIsolationCandidate = writeTask && intent.scope === 'multi-stream' && topology.mode === 'multi-agent';
    return {
        required: caps,
        repository: writeTask || intent.taskKind === 'review' || intent.taskKind === 'performance' || caps.includes('repository-analysis'),
        sourceWeb: caps.includes('source-verification'),
        browser: caps.includes('visual-qa'),
        process: false,
        workspaceIsolationCandidate,
    };
}
/**
 * Host-neutral Phase 2 decision composition.
 *
 * This function deliberately performs no repository scan, host call, model call,
 * capability probe, mutation, or durable-state write. It composes bounded Phase 1
 * policies into one inspectable decision target; concrete model/tool/backend
 * availability remains a downstream adapter/runtime concern.
 */
export function decideSemanticExecution(input) {
    const { intent, verification, topology: topologyPolicy, mission } = input;
    const adaptive = decideAdaptiveExecution(intent, mission);
    const topology = decideTopology(intent, topologyPolicy, mission);
    const team = minimumTeamFor(intent, verification, input.primaryMode ?? 'auto');
    const modelClass = resolveCategory(intent);
    const capabilities = capabilityIntent(intent, topology);
    const isolation = capabilities.workspaceIsolationCandidate
        ? { intent: 'CANDIDATE', reason: ['multi-stream write topology may benefit from exact-task native workspace isolation; task scope/ownership must decide before provisioning'] }
        : { intent: 'NONE', reason: ['mission-level policy has no exact-task isolation requirement'] };
    const freshReviewerRequired = verification.requireReview === true;
    return {
        version: 1,
        executionPath: adaptive.path,
        executionReasons: [...adaptive.reasons],
        topology,
        primary: team.primary,
        teamDirect: team.direct,
        childRoles: [...team.roles],
        modelClass,
        continuationBudget: continuationBudget(modelClass),
        assurance: { freshReviewerRequired },
        isolation,
        capabilities,
        providerSurfacePhase: providerSurfacePhase(adaptive.path),
        stability: counterfactualDecisionStability({ intent, verification, primaryMode: input.primaryMode ?? 'auto', topology: topologyPolicy }),
        reasons: [
            `execution:${adaptive.path.toLowerCase()}`,
            `topology:${topology.mode}:${topology.executionMode}`,
            team.direct ? 'team:direct' : `team:children:${team.roles.length}`,
            `model-class:${modelClass}`,
            freshReviewerRequired ? 'assurance:fresh-review' : 'assurance:deterministic-evidence',
            capabilities.workspaceIsolationCandidate ? 'isolation:candidate' : 'isolation:none',
        ],
    };
}
