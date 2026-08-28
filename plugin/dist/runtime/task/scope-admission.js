import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { normalizeBoundedProjectPath } from '../../contracts/common.js';
function uniqueBounded(items) {
    const values = [], invalid = [];
    for (const raw of items) {
        const bounded = normalizeBoundedProjectPath(raw);
        if (!bounded) {
            invalid.push(raw);
            continue;
        }
        if (!values.includes(bounded))
            values.push(bounded);
    }
    return { values, invalid };
}
/**
 * A model-supplied read scope becomes canonical repository authority only when it
 * resolves to a current project-contained filesystem identity. An exact Mission
 * target is also authoritative because Mission admission already bound it to an
 * explicit user target or a current project identity (future user-named files are
 * therefore retained without requiring current existence).
 */
export function projectContainedExistingScope(projectRoot, candidate) {
    try {
        const project = realpathSync(projectRoot), actual = realpathSync(resolve(projectRoot, candidate)), rel = relative(project, actual);
        return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
    }
    catch {
        return false;
    }
}
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
export function admitNewTaskScope(input) {
    if (input.role !== 'repository-explorer')
        return { accepted: true, scope: [...input.requestedScope], reason: 'unchanged', unbound: [], canonical_targets: [] };
    const requested = uniqueBounded(input.requestedScope), targets = uniqueBounded((input.missionTargets ?? []).filter(target => !/^https?:\/\//i.test(target))).values;
    if (requested.invalid.length)
        return { accepted: false, scope: requested.values, reason: 'repository-scope-invalid', unbound: [...requested.invalid], canonical_targets: targets };
    if (!requested.values.length)
        return { accepted: true, scope: [], reason: 'unchanged', unbound: [], canonical_targets: targets };
    const canonical = new Set(targets), unbound = requested.values.filter(candidate => !canonical.has(candidate) && !projectContainedExistingScope(input.projectRoot, candidate));
    if (!unbound.length)
        return { accepted: true, scope: requested.values, reason: 'unchanged', unbound: [], canonical_targets: targets };
    const unknownDiscovery = input.ambiguity !== 'none' && targets.length === 0 && unbound.length === requested.values.length;
    if (unknownDiscovery)
        return { accepted: true, scope: [], reason: 'repository-discovery-unbound-normalized', unbound, canonical_targets: targets };
    return { accepted: false, scope: requested.values, reason: 'repository-scope-unbound', unbound, canonical_targets: targets };
}
