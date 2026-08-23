export declare const CONSTRAINT_SUBJECT_KINDS: readonly ["path", "capability", "methodology", "decision", "generic"];
export type ConstraintSubjectKind = typeof CONSTRAINT_SUBJECT_KINDS[number];
export declare const CONSTRAINT_PREDICATES: readonly ["mutate", "read", "use", "require", "preserve", "verify"];
export type ConstraintPredicate = typeof CONSTRAINT_PREDICATES[number];
export declare const CONSTRAINT_POLARITIES: readonly ["ALLOW", "DENY", "REQUIRE"];
export type ConstraintPolarity = typeof CONSTRAINT_POLARITIES[number];
export type ConstraintAtomStatus = 'ACTIVE' | 'SUPERSEDED' | 'CONFLICTING';
export interface ConstraintAtomDraft {
    subject_kind: ConstraintSubjectKind;
    subject: string;
    predicate: ConstraintPredicate;
    polarity: ConstraintPolarity;
    scope: 'mission' | 'task';
    supersedes: string[];
}
export interface ConstraintAtom extends ConstraintAtomDraft {
    id: string;
    authority: 'USER';
    introduced_revision: number;
    status: ConstraintAtomStatus;
    source_text: string;
    created_at: number;
    superseded_by?: string;
}
export declare function isConstraintAtomDraft(v: unknown): v is ConstraintAtomDraft;
export declare function isConstraintAtom(v: unknown): v is ConstraintAtom;
export declare function constraintAtomID(draft: ConstraintAtomDraft, revision: number): string;
