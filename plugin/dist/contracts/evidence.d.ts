import { type EvidenceOutcome } from './evidence-kinds.js';
export declare const MISSION_EVIDENCE_KINDS: readonly ["targeted-tests", "typecheck", "lint", "build", "changed-surface-sanity", "review-evidence", "decision-evidence", "diagnostic-evidence", "measurement-evidence", "browser-evidence", "visual-evidence", "accessibility-evidence", "source-provenance-evidence", "review-input", "lsp-diagnostics", "source-read-observation"];
export type MissionEvidenceKind = typeof MISSION_EVIDENCE_KINDS[number];
export interface EvidenceProducerAttempt {
    worker_id: string;
    execution_unit_id: string;
    attempt_id: string;
    run_id: string;
    ordinal: number;
    generation: number;
}
export declare const EVIDENCE_SOURCE_CLASSES: readonly ["host-tool-observation", "host-diff-observation", "browser-observation", "reviewer-observation", "user-admitted-observation", "runtime-observation"];
export type EvidenceSourceClass = typeof EVIDENCE_SOURCE_CLASSES[number];
export interface EvidenceItem {
    id: string;
    kind: MissionEvidenceKind;
    summary: string;
    scope: string[];
    source?: string;
    trusted_source_class?: EvidenceSourceClass;
    source_session_id?: string;
    source_state_hash?: string;
    scope_state_hash?: string;
    task_id?: string;
    obligation_ids?: string[];
    evidence_refs?: string[];
    browser_url?: string;
    browser_origin?: string;
    producer_attempt?: EvidenceProducerAttempt;
    observed_at: number;
    invalidated_at?: number;
    pass?: boolean;
    outcome?: EvidenceOutcome;
    reason?: string;
}
export declare function isEvidenceItemContract(v: unknown): v is EvidenceItem;
