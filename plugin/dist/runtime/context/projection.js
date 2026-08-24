import { createHash } from 'node:crypto';
const P = { low: 2, normal: 6, high: 12 };
const F = { FRESH: 4, UNKNOWN: 2, POTENTIALLY_STALE: .5 };
const R = { PROTECTED: 8, COMPRESSIBLE: 2, PURGEABLE: 0 };
function text(g) { return g.items.filter(Boolean).join('\n'); }
function cost(g) { return text(g).length; }
// Projection dedupe is a byte-economy decision, so it must identify the bytes
// actually sent to the Worker. source/content hashes remain provenance metadata
// and may legitimately cover a wider source than the rendered projection.
function digest(g) { return createHash('sha256').update(text(g)).digest('hex'); }
function mandatory(g) { return g.required === true || g.protection === 'PROTECTED'; }
function score(g) { return P[g.priority] + F[g.freshness] + R[g.protection]; }
function canonicalGroups(groups) {
    const normalized = groups.map(raw => ({ ...raw, items: raw.items.map(String).filter(Boolean) })).filter(g => Boolean(g.id) && g.items.length > 0);
    const mandatoryDigests = new Set(normalized.filter(mandatory).map(digest)), seenOptional = new Set(), out = [], duplicates = [];
    for (const g of normalized) {
        const key = digest(g), must = mandatory(g);
        if (!must && (mandatoryDigests.has(key) || seenOptional.has(key))) {
            duplicates.push(g.id);
            continue;
        }
        out.push(g);
        if (!must)
            seenOptional.add(key);
    }
    return { groups: out, duplicates };
}
export function projectContextGroups(groups, budgetChars) {
    if (!Number.isFinite(budgetChars) || budgetChars < 0)
        throw new Error('context projection budget must be finite and non-negative');
    const canonical = canonicalGroups(groups), selected = [], omitted = [], missing_required = [];
    let used = 0;
    const required = canonical.groups.filter(mandatory), optional = canonical.groups.map((g, index) => ({ g, index })).filter(x => !mandatory(x.g)).sort((a, b) => score(b.g) - score(a.g) || a.index - b.index).map(x => x.g);
    for (const g of required) {
        const c = cost(g);
        if (used + c > budgetChars) {
            missing_required.push(g.id);
            continue;
        }
        selected.push(g);
        used += c;
    }
    if (missing_required.length)
        return { selected, omitted: [...optional.map(g => g.id), ...missing_required], used_chars: used, budget_chars: budgetChars, complete: false, missing_required, duplicate_groups: canonical.duplicates };
    for (const g of optional) {
        const c = cost(g);
        if (used + c <= budgetChars) {
            selected.push(g);
            used += c;
        }
        else
            omitted.push(g.id);
    }
    return { selected, omitted, used_chars: used, budget_chars: budgetChars, complete: true, missing_required, duplicate_groups: canonical.duplicates };
}
export function renderProjectedContext(decision) { return decision.selected.flatMap(g => g.items); }
