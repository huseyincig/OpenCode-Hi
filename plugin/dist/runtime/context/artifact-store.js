import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { durableArtifactPath, hiProjectRoot } from '../storage/ownership.js';
function valid(raw) { if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return false; const v = raw; return typeof v.id === 'string' && typeof v.kind === 'string' && typeof v.summary === 'string' && typeof v.content === 'string' && typeof v.sha256 === 'string' && typeof v.createdAt === 'number' && Array.isArray(v.sourceFiles) && v.sourceFiles.every(x => typeof x === 'string') && ['FRESH', 'POTENTIALLY_STALE'].includes(String(v.freshness)) && createHash('sha256').update(v.content).digest('hex') === v.sha256; }
export class ContextArtifactStore {
    projectRoot;
    #items = new Map();
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.#load();
    }
    #load() { if (!this.projectRoot)
        return; const root = join(hiProjectRoot(this.projectRoot), 'artifacts'); if (!existsSync(root))
        return; for (const kind of readdirSync(root, { withFileTypes: true })) {
        if (!kind.isDirectory())
            continue;
        const dir = join(root, kind.name);
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.json'))
                continue;
            try {
                const raw = JSON.parse(readFileSync(join(dir, entry.name), 'utf8'));
                if (valid(raw) && entry.name === `${raw.id}.json`)
                    this.#items.set(raw.id, { ...raw, sourceFiles: [...raw.sourceFiles] });
            }
            catch { }
        }
    } }
    #persist(item) { if (!this.projectRoot)
        return; const path = durableArtifactPath(this.projectRoot, item.kind, item.id); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(item, null, 2) + '\n', 'utf8'); }
    add(kind, summary, content, sourceFiles = []) { const sha256 = createHash('sha256').update(content).digest('hex'), boundFiles = [...new Set(sourceFiles)].slice(0, 32), identity = createHash('sha256').update([kind, sha256, ...boundFiles].join('\0')).digest('hex'), id = `a_${identity.slice(0, 20)}`, item = { id, kind, summary, content, sha256, createdAt: Date.now(), sourceFiles: boundFiles, freshness: 'FRESH' }; this.#items.set(id, item); this.#persist(item); return { ...item, sourceFiles: [...item.sourceFiles] }; }
    get(id) { const a = this.#items.get(id); return a ? { ...a, sourceFiles: [...a.sourceFiles] } : undefined; }
    invalidateChanged(files) { const changed = new Set(files); let n = 0; for (const a of this.#items.values())
        if (a.freshness === 'FRESH' && a.sourceFiles.some(f => changed.has(f))) {
            a.freshness = 'POTENTIALLY_STALE';
            this.#persist(a);
            n++;
        } return n; }
}
