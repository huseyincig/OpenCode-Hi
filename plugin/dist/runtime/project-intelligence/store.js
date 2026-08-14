import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isProjectIntelligenceContract, projectIntelligenceFiles } from '../../contracts/project-intelligence.js';
import { hiProjectRoot, projectIntelligencePath } from '../storage/ownership.js';
import { retrieveProjectIntelligence } from './retrieval.js';
function clone(item) { return { ...item, source_refs: item.source_refs.map(x => ({ ...x })), consumer_domains: [...item.consumer_domains] }; }
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
                if (isProjectIntelligenceContract(raw) && entry.name === `${raw.id}.json`)
                    this.#patterns.set(raw.id, clone(raw));
            }
            catch { }
        }
    }
    #persist(item) { if (!this.projectRoot)
        return; const path = projectIntelligencePath(this.projectRoot, item.id); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(item, null, 2) + '\n', 'utf8'); }
    upsert(item) { if (!isProjectIntelligenceContract(item))
        throw new Error('Invalid ProjectIntelligenceContract'); const copy = clone(item); this.#patterns.set(item.id, copy); this.#persist(copy); }
    get(id) { const item = this.#patterns.get(id); return item ? clone(item) : undefined; }
    retrieve(query, files, consumer = 'task-context', limit = 6) { return retrieveProjectIntelligence([...this.#patterns.values()], { query, files, consumer, limit }); }
    relevantToFiles(files, consumer = 'task-context', limit = 6) {
        const wanted = new Set(files);
        return [...this.#patterns.values()].filter(item => item.lifecycle === 'ACTIVE' && item.freshness === 'FRESH' && item.consumer_domains.includes(consumer) && projectIntelligenceFiles(item).some(file => wanted.has(file))).sort((a, b) => b.confidence - a.confidence || b.updated_at - a.updated_at).slice(0, limit).map(clone);
    }
    invalidateChanged(changedFiles, currentHashes = {}) {
        const changed = new Set(changedFiles), invalidated = [];
        for (const item of this.#patterns.values()) {
            const touched = item.source_refs.some(source => { const file = source.ref.slice(5); return changed.has(file) || (currentHashes[file] !== undefined && source.hash !== currentHashes[file]); });
            if (touched && item.freshness === 'FRESH') {
                item.freshness = 'POTENTIALLY_STALE';
                item.updated_at = Date.now();
                this.#persist(item);
                invalidated.push(item.id);
            }
        }
        return invalidated;
    }
    all() { return [...this.#patterns.values()].map(clone); }
}
