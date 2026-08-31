import type { Category, MissionState } from '../mission/types.js';
import type { AvailableModel } from '../routing/model-resolver.js';
import type { ProjectIntelligenceRuntime } from '../project-intelligence/runtime.js';
import type { EcosystemIntegrationView } from '../ecosystem/runtime.js';
import type { BehavioralEvaluationPlatformView } from '../evaluation/platform.js';
import { modelIntelligenceView } from '../model-intelligence/runtime.js';
import { collaborationView } from '../collaboration/runtime.js';
import { autonomousMissionUxView } from '../ux/autonomous-mission.js';
import { observabilityEconomicsView } from '../observability/runtime.js';
export interface SuperProductIntegrationView {
    mission_id: string;
    project_intelligence: {
        composition_owner: 'ProjectIntelligenceRuntime';
        methodology_owner: 'ProjectMethodologyLearningStore';
        task_outcome_owner: 'ProjectTaskOutcomeMemoryStore';
        authority: 'advisory-derived-only';
    };
    model_intelligence: ReturnType<typeof modelIntelligenceView>;
    collaboration: ReturnType<typeof collaborationView>;
    mission_ux: ReturnType<typeof autonomousMissionUxView>;
    observability_economics: ReturnType<typeof observabilityEconomicsView>;
    ecosystem: EcosystemIntegrationView;
    behavioral_evaluation: {
        mode: 'explicit-receipt-driven';
        attached: boolean;
        claim_boundary?: BehavioralEvaluationPlatformView['claim_boundary'];
        verdict?: string;
        authority: 'evaluation-only';
    };
    ownership: {
        mission: 'MissionStore';
        evidence: 'EvidenceRuntime/VerificationEnvelope';
        authority: 'AuthorityContract';
        routing: 'RoutingPolicy';
        native: 'OpenCode';
        usage: 'Worker.usage_observations';
        context: 'ContextArtifactStore';
        project_intelligence: 'narrow-data-class-owners';
    };
    persistence_owner: 'none-derived-integration-view';
    claim_boundary: 'campaign-c-derived-composition-only';
}
/**
 * Cross-layer Campaign-C composition for operator/product integration checks.
 *
 * Every child view is rebuilt from its canonical owner inputs. This function
 * owns no durable state and deliberately does not feed any derived child back
 * into Mission, Evidence, Authority, Routing, native host, usage or Context
 * ownership. Behavioral Evaluation is attached only from an explicit receipt-
 * driven evaluation episode; normal runtime state never fabricates one.
 */
export declare function superProductIntegrationView(input: {
    mission: MissionState;
    projectMissions?: readonly MissionState[];
    liveInventory: readonly AvailableModel[];
    projectIntelligence: ProjectIntelligenceRuntime;
    ecosystem: EcosystemIntegrationView;
    evaluation?: BehavioralEvaluationPlatformView;
    role?: string;
    category?: Category;
    projectRoot?: string;
}): SuperProductIntegrationView;
