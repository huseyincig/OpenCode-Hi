import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { projectIntelligencePath } from '../storage/ownership.js';
export class ProjectIntelligenceStore {
    projectRoot;
    #patterns = new Map();
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
    }
    #persist(pattern) { if (!this.projectRoot)
        return; const path = projectIntelligencePath(this.projectRoot, pattern.id); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(pattern, null, 2) + '\n', 'utf8'); }
    upsert(pattern) { const copy = { ...pattern, sourceFiles: [...pattern.sourceFiles], sourceHashes: { ...pattern.sourceHashes } }; this.#patterns.set(pattern.id, copy); this.#persist(copy); }
    get(id) { const p = this.#patterns.get(id); return p ? { ...p, sourceFiles: [...p.sourceFiles], sourceHashes: { ...p.sourceHashes } } : undefined; }
    query(term, limit = 8) { const q = term.toLowerCase(); return [...this.#patterns.values()].filter(p => p.lifecycle === 'ACTIVE' && p.statement.toLowerCase().includes(q)).sort((a, b) => Number(b.freshness === 'FRESH') - Number(a.freshness === 'FRESH') || b.confidence - a.confidence).slice(0, limit).map(p => ({ ...p, sourceFiles: [...p.sourceFiles], sourceHashes: { ...p.sourceHashes } })); }
    invalidateChanged(changedFiles, currentHashes = {}) { const changed = new Set(changedFiles), invalidated = []; for (const p of this.#patterns.values()) {
        const touched = p.sourceFiles.some(f => changed.has(f) || currentHashes[f] !== undefined && p.sourceHashes[f] !== currentHashes[f]);
        if (touched && p.freshness === 'FRESH') {
            p.freshness = 'POTENTIALLY_STALE';
            p.updatedAt = Date.now();
            this.#persist(p);
            invalidated.push(p.id);
        }
    } return invalidated; }
    all() { return [...this.#patterns.values()].map(p => ({ ...p, sourceFiles: [...p.sourceFiles], sourceHashes: { ...p.sourceHashes } })); }
}
