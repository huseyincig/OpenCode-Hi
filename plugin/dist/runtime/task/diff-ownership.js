import { normalizeBoundedProjectPath } from '../../contracts/common.js';
function norm(path) { return normalizeBoundedProjectPath(path) ?? ''; }
function hasExt(path) { return /\.[a-z0-9]+$/i.test(path.split('/').pop() ?? ''); }
function within(file, target) { const f = norm(file), t = norm(target); if (!f || !t)
    return false; if (f === t)
    return true; return !hasExt(t) && f.startsWith(`${t}/`); }
function stem(path) { return norm(path).replace(/\.(?:test|spec)\.[^.\/]+$/i, '').replace(/\.[^.\/]+$/, ''); }
function autoRelated(file, scope) {
    const f = norm(file), base = f.split('/').pop() ?? f;
    if (scope.some(s => stem(s) === stem(f)))
        return true;
    if (/^(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(base) && scope.some(s => /package\.json$/i.test(norm(s))))
        return true;
    return false;
}
export function assessRequiredTargetCoverage(requiredInput, changedInput) {
    const required = [...new Set(requiredInput.map(norm).filter(Boolean))], changed = [...new Set(changedInput.map(norm).filter(Boolean))];
    const covered = required.filter(target => changed.some(file => within(file, target)));
    return { required, covered, missing: required.filter(target => !covered.includes(target)) };
}
export function assessChangedFileOwnership(scopeInput, changedInput, scopeExpansions = [], authority = 'worker-proposal') {
    const changed = [...new Set(changedInput.map(norm).filter(Boolean))], scope = [...new Set(scopeInput.map(norm).filter(Boolean))];
    if (!scope.length)
        return { outside: [], accepted: [], collateral: [] };
    const outside = changed.filter(file => !scope.some(s => within(file, s)));
    const declared = new Map(scopeExpansions.map(x => [norm(x.file), x])), accepted = [], collateral = [];
    for (const file of outside) {
        const claim = declared.get(file), controlPlaneAuthorized = authority === 'control-plane' && claim?.necessary === true;
        if (autoRelated(file, scope) || controlPlaneAuthorized)
            accepted.push(file);
        else
            collateral.push(file);
    }
    return { outside, accepted, collateral };
}
export function assessDiffOwnership(task, result) { return assessChangedFileOwnership(task.scope ?? [], result.changed_files, result.scope_expansions ?? [], 'worker-proposal'); }
