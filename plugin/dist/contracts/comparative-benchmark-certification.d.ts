import { type BenchmarkEpisodeKind, type BenchmarkResultClassification, type ComparativeBenchmarkReceipt } from './comparative-benchmark.js';
export declare const COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA: 1;
export type BenchmarkCertificationVerdict = 'NO_REGRESSION' | 'STABLE_REGRESSION' | 'FLAKY' | 'BLOCKED_ENVIRONMENT' | 'BLOCKED_AUTHORITY' | 'INCONCLUSIVE';
export type BenchmarkFailureAttributionClass = 'SOURCE_CHANGED' | 'FIXTURE_CHANGED' | 'CONFIG_CHANGED' | 'HOST_CHANGED' | 'MODEL_CHANGED' | 'RUNTIME_CHANGED' | 'UNKNOWN_DRIFT';
export interface BenchmarkCertificationEnvironmentInput {
    source_inputs_sha256: string;
    platform?: string;
    node_version?: string;
}
export interface BenchmarkCertificationEnvironment {
    source_inputs_sha256: string;
    fixture_sha256: string;
    config_sha256: string;
    opencode_version: string;
    opencode_commit?: string;
    model_requested?: string;
    model_effective?: string;
    provider_effective?: string;
    platform?: string;
    node_version?: string;
}
export interface BenchmarkCertificationSampleInput {
    receipt: ComparativeBenchmarkReceipt;
    environment: BenchmarkCertificationEnvironmentInput;
}
export interface BenchmarkCertificationSample {
    receipt_sha256: string;
    episode_id: string;
    repetition: number;
    episode_kind: BenchmarkEpisodeKind;
    result: BenchmarkResultClassification;
    outcome_sha256: string;
    environment: BenchmarkCertificationEnvironment;
}
export interface BenchmarkEnvironmentDelta {
    keys_changed: string[];
    details: Record<string, {
        baseline?: string;
        current?: string;
    }>;
}
export interface BenchmarkStabilitySummary {
    required_samples: number;
    observed_samples: number;
    performed: boolean;
    stable: boolean;
    outcome_hashes: string[];
}
export interface BenchmarkFailureAttribution {
    top: BenchmarkFailureAttributionClass;
    also_observed: BenchmarkFailureAttributionClass[];
    reliable: boolean;
    reason: string;
    evidence: BenchmarkEnvironmentDelta;
}
export interface ComparativeBenchmarkCertificationSeries {
    schema: typeof COMPARATIVE_BENCHMARK_CERTIFICATION_SCHEMA;
    series_id: string;
    claim_boundary: string;
    baseline: BenchmarkCertificationSample;
    current: BenchmarkCertificationSample[];
    stability: BenchmarkStabilitySummary;
    environment_stable: boolean;
    environment_delta: BenchmarkEnvironmentDelta;
    attribution: BenchmarkFailureAttribution;
    verdict: BenchmarkCertificationVerdict;
}
export interface BuildComparativeBenchmarkCertificationSeriesInput {
    series_id: string;
    claim_boundary: string;
    baseline: BenchmarkCertificationSampleInput;
    current: BenchmarkCertificationSampleInput[];
}
export declare function buildComparativeBenchmarkCertificationSeries(input: BuildComparativeBenchmarkCertificationSeriesInput): ComparativeBenchmarkCertificationSeries;
export declare function isComparativeBenchmarkCertificationSeries(v: unknown): v is ComparativeBenchmarkCertificationSeries;
