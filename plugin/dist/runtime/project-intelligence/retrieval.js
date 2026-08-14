import { dirname, basename } from 'node:path';
import { projectIntelligenceFiles } from '../../contracts/project-intelligence.js';
const RRF_K = 60;
function clone(item) { return { ...item, source_refs: item.source_refs.map(x => ({ ...x })), consumer_domains: [...item.consumer_domains] }; }
function norm(s) { return s.toLowerCase().replace(/\\/g, '/').replace(/^\.\//, ''); }
function terms(s) { return [...new Set(norm(s).split(/[^a-z0-9_.\/-]+/).filter(x => x.length >= 2))]; }
function lexicalScore(item, query) {
    const wanted = terms(query);
    if (!wanted.length)
        return 0;
    const statement = norm(item.statement), refs = item.source_refs.map(x => norm(x.ref.slice(5))).join(' ');
    let score = 0;
    for (const term of wanted) {
        if (statement.includes(term))
            score += 2;
        if (refs.includes(term))
            score += 1;
    }
    return score / wanted.length;
}
function commonDirDepth(a, b) { const aa = norm(dirname(a)).split('/').filter(Boolean), bb = norm(dirname(b)).split('/').filter(Boolean); let n = 0; while (n < aa.length && n < bb.length && aa[n] === bb[n])
    n++; return n; }
function pathScore(item, files) {
    if (!files.length)
        return 0;
    let best = 0;
    for (const source of projectIntelligenceFiles(item))
        for (const target of files) {
            const s = norm(source), t = norm(target);
            if (s === t)
                best = Math.max(best, 4);
            else if (dirname(s) === dirname(t))
                best = Math.max(best, 3);
            else {
                const depth = commonDirDepth(s, t);
                if (depth > 0)
                    best = Math.max(best, Math.min(2, depth));
                if (basename(s) === basename(t))
                    best = Math.max(best, 2.5);
            }
        }
    return best;
}
function ranked(items, score) { return items.map(item => ({ id: item.id, score: score(item) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map((x, i) => ({ ...x, rank: i + 1 })); }
function sharedRefCount(a, b) { const refs = new Set(a.source_refs.map(x => x.ref)); return b.source_refs.reduce((n, x) => n + (refs.has(x.ref) ? 1 : 0), 0); }
export function retrieveProjectIntelligence(items, input) {
    const eligible = items.filter(item => item.lifecycle === 'ACTIVE' && item.freshness === 'FRESH' && item.consumer_domains.includes(input.consumer));
    const lexical = ranked(eligible, item => lexicalScore(item, input.query)), path = ranked(eligible, item => pathScore(item, input.files));
    const seedIDs = new Set([...lexical.slice(0, 8), ...path.slice(0, 8)].map(x => x.id)), byID = new Map(eligible.map(x => [x.id, x]));
    const graph = ranked(eligible, item => { let n = 0; for (const id of seedIDs) {
        if (id === item.id)
            continue;
        const seed = byID.get(id);
        if (seed)
            n += sharedRefCount(item, seed);
    } return n; });
    const maps = { lexical: new Map(lexical.map(x => [x.id, x])), path: new Map(path.map(x => [x.id, x])), graph: new Map(graph.map(x => [x.id, x])) };
    const candidateIDs = new Set([...lexical, ...path.filter(x => x.score >= 4), ...graph].map(x => x.id)), hits = [];
    for (const id of candidateIDs) {
        const item = byID.get(id);
        if (!item)
            continue;
        const l = maps.lexical.get(id), p = maps.path.get(id), g = maps.graph.get(id);
        let rrf = 0;
        if (l)
            rrf += 1 / (RRF_K + l.rank);
        if (p)
            rrf += 1 / (RRF_K + p.rank);
        if (g)
            rrf += 1 / (RRF_K + g.rank);
        const confidenceWeight = .5 + .5 * item.confidence;
        hits.push({ item: clone(item), score: rrf * confidenceWeight, signals: { lexical: l?.score ?? 0, path: p?.score ?? 0, graph: g?.score ?? 0, confidence: item.confidence } });
    }
    return hits.sort((a, b) => b.score - a.score || b.signals.path - a.signals.path || b.signals.lexical - a.signals.lexical || b.item.updated_at - a.item.updated_at || a.item.id.localeCompare(b.item.id)).slice(0, Math.max(1, input.limit ?? 6));
}
