import type { HiMethodologySignalName } from '../../generated/methodology-policy.js';
import type { NormalizedMissionIntent, Risk } from '../mission/types.js';
import type { RepoContext } from './repo-context.js';
import { type ConstraintAtomDraft } from '../../contracts/constraint-atom.js';
import { type VerificationCase } from '../../contracts/verification-case.js';
export type SemanticMessageKind = 'mission' | 'amendment' | 'constraint' | 'verification' | 'stop' | 'resume' | 'non-material';
export declare const SEMANTIC_CAPABILITIES: readonly ["implementation", "repository-analysis", "review", "verification", "independent-review", "security-review", "visual-qa", "design-exploration", "multi-stream-delegation", "source-verification", "external-research", "documentation", "test-authoring", "qa-review", "dependency-change", "interactive-process", "mcp"];
export type SemanticCapability = typeof SEMANTIC_CAPABILITIES[number];
export declare const SEMANTIC_EXTERNAL_ACTIONS: readonly ["git-push", "release-create", "package-publish", "deploy"];
export type SemanticExternalAction = typeof SEMANTIC_EXTERNAL_ACTIONS[number];
export declare const SEMANTIC_VERIFICATION_KINDS: readonly ["targeted-tests", "typecheck", "lint", "build", "changed-surface-sanity", "visual-check", "review-evidence"];
export type SemanticVerificationKind = typeof SEMANTIC_VERIFICATION_KINDS[number];
export declare function diagnosisWriteCapabilities(taskKind: string, capabilities: readonly string[]): string[];
export declare function assertSemanticTaskCapabilityConsistency(taskKind: string, capabilities: readonly string[]): void;
export interface SemanticIntentAssessment {
    material: boolean;
    message_kind: SemanticMessageKind;
    task_kind: 'implementation' | 'bug-fix' | 'diagnosis' | 'review' | 'performance' | 'release-readiness';
    scope: 'local' | 'multi-file' | 'repo-wide' | 'external' | 'multi-stream';
    risk: Risk;
    ambiguity: 'none' | 'resolvable' | 'contract-critical';
    dependency_class: 'independent' | 'sequential' | 'external-gated' | 'unknown' | 'independent-multi';
    required_capabilities: SemanticCapability[];
    requested_external_actions: SemanticExternalAction[];
    likely_verification: SemanticVerificationKind[];
    user_verification: SemanticVerificationKind[];
    verification_ceiling: boolean;
    verification_cases: VerificationCase[];
    likely_targets: string[];
    likely_targets_explicit_empty?: boolean;
    intent_signals: HiMethodologySignalName[];
    suppressed_intent_signals: HiMethodologySignalName[];
    constraint_atoms: ConstraintAtomDraft[];
}
export declare function technicalTargets(text: string): string[];
export declare function technicalVerificationKinds(text: string): SemanticVerificationKind[];
export interface AdaptiveVerificationResolution {
    assessment: SemanticIntentAssessment;
    explicitUserVerification: SemanticVerificationKind[];
    ceilingApplied: boolean;
    policy: 'explicit-user-verifier' | 'minimum-sufficient-review' | 'local-capability-surface' | 'assessment';
}
/**
 * Reconcile model-proposed verification with mechanically observable user intent.
 * The host primary may recommend checks, but a bounded low/medium-risk read-only review
 * does not inherit code-test/build ceremony unless the user named an executable verifier.
 */
export declare function resolveAdaptiveVerificationAssessment(assessment: SemanticIntentAssessment, userText: string, repo?: RepoContext): AdaptiveVerificationResolution;
export declare function semanticTargets(value: unknown, max?: number): string[];
export declare function materialSemanticTargets(assessment: Pick<SemanticIntentAssessment, 'likely_targets' | 'likely_verification' | 'intent_signals'>): string[];
/**
 * A path may be technically relevant without being an implementation target.
 * Keep explicit preservation / mutation-denial directives out of requiredTargets
 * while retaining the path in likelyTargets for context, safety and verification.
 */
export declare function preservationOnlyTargets(userText: string): string[];
export declare function userRequiredMaterialTargets(userText: string, assessment: Pick<SemanticIntentAssessment, 'likely_targets' | 'likely_verification' | 'intent_signals'>): string[];
export declare function provisionalIntent(text: string, repo?: RepoContext): NormalizedMissionIntent;
export declare function parseSemanticIntentAssessment(raw: unknown): SemanticIntentAssessment;
export declare function assessedIntent(current: NormalizedMissionIntent, assessment: SemanticIntentAssessment): NormalizedMissionIntent;
