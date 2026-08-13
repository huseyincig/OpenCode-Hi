import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hiProjectRoot, projectIntelligencePath } from '../storage/ownership.js';
function validPattern(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return false;
    const v = raw;
    return typeof v.id === 'string' && typeof v.statement === 'string' && Array.isArray(v.sourceFiles) && v.sourceFiles.every(x => typeof x === 'string') && Boolean(v.sourceHashes) && typeof v.sourceHashes === 'object' && !Array.isArray(v.sourceHashes) && Object.values(v.sourceHashes).every(x => typeof x === 'string') && typeof v.confidence === 'number' && ['FRESH', 'POTENTIALLY_STALE'].includes(String(v.freshness)) && ['ACTIVE', 'SUPERSEDED', 'ARCHIVED'].includes(String(v.lifecycle)) && typeof v.updatedAt === 'number';
}
export class ProjectIntelligenceStore {
    projectRoot;
    #patterns = new Map();
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.#load();
    }
    #load() {
        if (!this.projectRoot)
            return;
        const dir = join(hiProjectRoot(this.projectRoot), 'project-intelligence', 'patterns');
        if (!existsSync(dir))
            return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.json'))
                continue;
            try {
                const raw = JSON.parse(readFileSync(join(dir, entry.name), 'utf8'));
                if (validPattern(raw) && entry.name === `${raw.id}.json`)
                    this.#patterns.set(raw.id, { ...raw, sourceFiles: [...raw.sourceFiles], sourceHashes: { ...raw.sourceHashes } });
            }
            catch { }
        }
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
