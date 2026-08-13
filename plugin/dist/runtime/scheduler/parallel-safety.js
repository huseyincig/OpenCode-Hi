import { isHiReadOnlyChildRole } from '../roles/catalog.js';
function norm(x) { return x.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''); }
function sameSurface(a, b) { const x = norm(a), y = norm(b); if (!x || !y)
    return false; if (x === y)
    return true; return x.startsWith(`${y}/`) || y.startsWith(`${x}/`); }
function overlap(a, b) { const out = []; for (const x of a)
    for (const y of b)
        if (sameSurface(x, y)) {
            out.push(norm(x) === norm(y) ? norm(x) : `${norm(x)}~${norm(y)}`);
            break;
        } return [...new Set(out)]; }
export function parallelSafety(existing, candidate) { const reasons = []; const candidateRead = isHiReadOnlyChildRole(candidate.role ?? ''); for (const task of existing.filter(t => ['created', 'queued', 'running', 'waiting'].includes(t.status))) {
    const directDependency = candidate.dependencies.includes(task.id), same = overlap(task.scope, candidate.scope), taskRead = isHiReadOnlyChildRole(task.role);
    if (directDependency) {
        reasons.push(`dependency:${task.id}`);
        continue;
    }
    if (same.length && !(candidateRead && taskRead))
        reasons.push(`write-scope-overlap:${task.id}:${same.join(',')}`);
    if (!candidateRead && !taskRead && task.scope.some(x => /migration|schema|lockfile|package-lock|pnpm-lock|yarn.lock/i.test(x)) && candidate.scope.some(y => task.scope.some(x => sameSurface(x, y))))
        reasons.push(`shared-mutable-surface:${task.id}`);
} return { safe: reasons.length === 0, reasons }; }
