import { buildComparativeBenchmarkCertificationSeries } from '../../contracts/comparative-benchmark-certification.js';
import { runDeterministicBenchmarks, runRecoveryGovernorAblation, runSchedulerEconomicsBenchmarks } from '../telemetry/benchmarks.js';
/**
 * Productized Behavioral Evaluation composition.
 *
 * Exact episode receipts remain immutable caller-owned inputs; certification
 * reduces them to receipt/outcome/environment hashes and explicit verdict
 * metadata. Optional judge scores affect uncertainty diagnostics only. The
 * platform neither stores production Mission/Evidence/usage state nor acquires
 * routing, completion or external-action authority.
 */
export function behavioralEvaluationPlatform(input) {
    const certification = buildComparativeBenchmarkCertificationSeries(input);
    return {
        certification,
        deterministic_policy_evidence: { runtime: runDeterministicBenchmarks(), scheduler: runSchedulerEconomicsBenchmarks(), recovery: runRecoveryGovernorAblation() },
        boundaries: { episode_receipt_owner: 'ComparativeBenchmarkReceipt', certification_owner: 'ComparativeBenchmarkCertificationSeries', deterministic_truth: 'deterministic-checks-and-exact-receipts', judge_role: 'advisory-uncertainty-only', production_evidence_owner: 'EvidenceRuntime/VerificationEnvelope', production_usage_owner: 'Worker.usage_observations', routing_authority: false, completion_authority: false, authority_override: false, model_preference_persistence: false },
        persistence_owner: 'none-derived-evaluation-view', claim_boundary: 'evaluation-certification-composition-only',
    };
}
