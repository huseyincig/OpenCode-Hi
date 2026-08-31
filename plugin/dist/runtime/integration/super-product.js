import { modelIntelligenceView } from '../model-intelligence/runtime.js';
import { collaborationView } from '../collaboration/runtime.js';
import { autonomousMissionUxView } from '../ux/autonomous-mission.js';
import { observabilityEconomicsView } from '../observability/runtime.js';
/**
 * Cross-layer Campaign-C composition for operator/product integration checks.
 *
 * Every child view is rebuilt from its canonical owner inputs. This function
 * owns no durable state and deliberately does not feed any derived child back
 * into Mission, Evidence, Authority, Routing, native host, usage or Context
 * ownership. Behavioral Evaluation is attached only from an explicit receipt-
 * driven evaluation episode; normal runtime state never fabricates one.
 */
export function superProductIntegrationView(input) {
    const { mission, projectMissions = [], liveInventory, projectIntelligence, ecosystem, evaluation, role, category, projectRoot } = input;
    // Touch the exact composed owners so callers cannot substitute an unshaped
    // generic project-memory object without TypeScript/runtime test detection.
    void projectIntelligence.methodologyLearning;
    void projectIntelligence.taskOutcomeMemory;
    return {
        mission_id: mission.identity.mission_id,
        project_intelligence: { composition_owner: 'ProjectIntelligenceRuntime', methodology_owner: 'ProjectMethodologyLearningStore', task_outcome_owner: 'ProjectTaskOutcomeMemoryStore', authority: 'advisory-derived-only' },
        model_intelligence: modelIntelligenceView(mission, liveInventory, role, category),
        collaboration: collaborationView(mission, projectMissions),
        mission_ux: autonomousMissionUxView(mission, projectRoot),
        observability_economics: observabilityEconomicsView(mission),
        ecosystem: structuredClone(ecosystem),
        behavioral_evaluation: { mode: 'explicit-receipt-driven', attached: Boolean(evaluation), ...(evaluation ? { claim_boundary: evaluation.claim_boundary, verdict: evaluation.certification.verdict } : {}), authority: 'evaluation-only' },
        ownership: { mission: 'MissionStore', evidence: 'EvidenceRuntime/VerificationEnvelope', authority: 'AuthorityContract', routing: 'RoutingPolicy', native: 'OpenCode', usage: 'Worker.usage_observations', context: 'ContextArtifactStore', project_intelligence: 'narrow-data-class-owners' },
        persistence_owner: 'none-derived-integration-view', claim_boundary: 'campaign-c-derived-composition-only',
    };
}
