import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { durableArtifactPath, hiProjectRoot } from '../storage/ownership.js';
import { artifactContentHash, isArtifactContract, newArtifactId } from '../../contracts/artifact.js';
export class ContextArtifactStore {
    projectRoot;
    #items = new Map();
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.#load();
    }
    #load() {
        if (!this.projectRoot)
            return;
        const root = join(hiProjectRoot(this.projectRoot), 'artifacts');
        if (!existsSync(root))
            return;
        for (const kind of readdirSync(root, { withFileTypes: true })) {
            if (!kind.isDirectory())
                continue;
            const dir = join(root, kind.name);
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                if (!entry.isFile() || !entry.name.endsWith('.json'))
                    continue;
                try {
                    const raw = JSON.parse(readFileSync(join(dir, entry.name), 'utf8'));
                    if (isArtifactContract(raw) && entry.name === `${raw.artifact_id}.json`)
                        this.#items.set(raw.artifact_id, structuredClone(raw));
                }
                catch { }
            }
        }
    }
    #persist(item) {
        if (!this.projectRoot)
            return;
        const path = durableArtifactPath(this.projectRoot, item.kind, item.artifact_id);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, JSON.stringify(item, null, 2) + '\n', 'utf8');
    }
    add(kind, summary, content, sourceFiles = [], options = {}) {
        const item = {
            artifact_id: newArtifactId(), kind, content_ref: 'inline-body', content, content_hash: artifactContentHash(content), summary,
            producer: options.producer ?? 'context-artifact-store', provenance: { source_files: [...new Set(sourceFiles)].slice(0, 32) }, created_at: Date.now(),
            retention_class: this.projectRoot ? 'project' : 'session', privacy_class: options.privacyClass ?? 'project-private', consumer_refs: [...new Set(options.consumerRefs ?? [])].slice(0, 32), freshness: 'FRESH'
        };
        this.#items.set(item.artifact_id, item);
        this.#persist(item);
        return structuredClone(item);
    }
    get(id) { const a = this.#items.get(id); return a ? structuredClone(a) : undefined; }
    invalidateChanged(files) {
        const changed = new Set(files);
        let n = 0;
        for (const a of this.#items.values())
            if (a.freshness === 'FRESH' && a.provenance.source_files.some(f => changed.has(f))) {
                a.freshness = 'POTENTIALLY_STALE';
                this.#persist(a);
                n++;
            }
        return n;
    }
}
