import { type EvidenceOutcome } from './worker-result.js';
export declare const MISSION_EVIDENCE_KINDS: readonly ["targeted-tests", "typecheck", "lint", "build", "changed-surface-sanity", "review-evidence", "decision-evidence", "diagnostic-evidence", "measurement-evidence", "browser-evidence", "visual-evidence", "accessibility-evidence", "source-provenance-evidence", "review-input", "lsp-diagnostics"];
export type MissionEvidenceKind = typeof MISSION_EVIDENCE_KINDS[number];
export interface EvidenceItem {
    id: string;
    kind: MissionEvidenceKind;
    summary: string;
    scope: string[];
    source?: string;
    source_session_id?: string;
    source_state_hash?: string;
    task_id?: string;
    obligation_ids?: string[];
    observed_at: number;
    invalidated_at?: number;
    pass?: boolean;
    outcome?: EvidenceOutcome;
    reason?: string;
}
export declare function isEvidenceItemContract(v: unknown): v is EvidenceItem;
