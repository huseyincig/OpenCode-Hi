export type NewTaskScopeAdmissionReason = 'unchanged' | 'repository-discovery-unbound-normalized' | 'repository-scope-unbound' | 'repository-scope-invalid';
export interface NewTaskScopeAdmission {
    accepted: boolean;
    scope: string[];
    reason: NewTaskScopeAdmissionReason;
    unbound: string[];
    canonical_targets: string[];
}
/**
 * A model-supplied read scope becomes canonical repository authority only when it
 * resolves to a current project-contained filesystem identity. An exact Mission
 * target is also authoritative because Mission admission already bound it to an
 * explicit user target or a current project identity (future user-named files are
 * therefore retained without requiring current existence).
 */
export declare function projectContainedExistingScope(projectRoot: string, candidate: string): boolean;
/**
 * Reconcile scope only for NEW repository-explorer tasks. Exact task resume must
 * never call this function to rewrite an existing canonical Task contract.
 *
 * Empty repository-explorer scope is an existing Hi contract for unknown-target
 * bounded discovery: exact current-attempt read receipts later promote the actual
 * inspected source scope. When every supplied scope token is unbound model prose
 * and the Mission has no canonical target yet, normalize to that discovery mode
 * instead of granting a fake path authority. Mixed or otherwise unbound scopes
 * fail closed rather than silently dropping entries.
 */
export declare function admitNewTaskScope(input: {
    projectRoot: string;
    role: string;
    ambiguity: string;
    missionTargets?: readonly string[];
    requestedScope: readonly string[];
}): NewTaskScopeAdmission;
