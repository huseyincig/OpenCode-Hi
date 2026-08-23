import type { ConstraintAtom, ConstraintAtomDraft } from '../../contracts/constraint-atom.js';
export declare function constraintAtomMatchesPath(atom: ConstraintAtom, path: string): boolean;
export declare function activeConstraintAtoms(atoms: readonly ConstraintAtom[] | undefined): ConstraintAtom[];
export declare function deniedMutationAtoms(atoms: readonly ConstraintAtom[] | undefined, path: string): ConstraintAtom[];
export declare function constraintAtomProjection(atom: ConstraintAtom): string;
export interface ConstraintAtomApplication {
    atoms: ConstraintAtom[];
    added: ConstraintAtom[];
    superseded: ConstraintAtom[];
    conflicts: Array<{
        previous: ConstraintAtom;
        incoming: ConstraintAtom;
    }>;
    missing_supersedes: Array<{
        incoming: ConstraintAtom;
        missing: string[];
    }>;
}
export declare function applyConstraintAtomDrafts(current: readonly ConstraintAtom[] | undefined, drafts: readonly ConstraintAtomDraft[] | undefined, revision: number, sourceText: string, now?: number): ConstraintAtomApplication;
