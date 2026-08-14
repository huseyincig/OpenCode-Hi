import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { configuredSkillPaths, discoverSkills, indexSkillResources, parseSkillFrontmatter, skillDiscoveryRoots } from './registry.js';
function hash(content) { return createHash('sha256').update(content).digest('hex'); }
function real(path) { try {
    return realpathSync(path);
}
catch {
    return resolve(path);
} }
function dirFingerprint(path) { try {
    const stat = statSync(path);
    if (!stat.isDirectory())
        return { path, exists: false, mtime_ms: 0, entries_sha256: '' };
    const entries = readdirSync(path, { withFileTypes: true }).map(entry => `${entry.isDirectory() ? 'd' : entry.isFile() ? 'f' : entry.isSymbolicLink() ? 'l' : 'o'}:${entry.name}`).sort().join('\n');
    return { path, exists: true, mtime_ms: stat.mtimeMs, entries_sha256: hash(entries) };
}
catch {
    return { path, exists: false, mtime_ms: 0, entries_sha256: '' };
} }
function fileFingerprint(path) { try {
    const stat = statSync(path);
    if (!stat.isFile())
        return undefined;
    const content = readFileSync(path, 'utf8');
    return { path, mtime_ms: stat.mtimeMs, size: stat.size, sha256: hash(content) };
}
catch {
    return undefined;
} }
function sameDir(a, b) { return a.path === b.path && a.exists === b.exists && a.mtime_ms === b.mtime_ms && a.entries_sha256 === b.entries_sha256; }
function sameFile(a, b) { return Boolean(b && a.path === b.path && a.mtime_ms === b.mtime_ms && a.size === b.size && a.sha256 === b.sha256); }
function cloneResource(r) { return { ...r }; }
function cloneRecord(r) { return { ...r, frontmatter: { ...r.frontmatter }, resource_map: r.resource_map.map(cloneResource) }; }
function rootChildDirectories(paths) { const out = new Set(); for (const root of paths) {
    if (!existsSync(root))
        continue;
    try {
        for (const entry of readdirSync(root, { withFileTypes: true }))
            if (entry.isDirectory())
                out.add(real(join(root, entry.name)));
    }
    catch { }
} return [...out]; }
function resourceDirectories(skill) {
    const base = real(dirname(skill.path)), out = new Set([base]);
    for (const kind of ['references', 'scripts', 'assets', 'examples']) {
        const root = join(base, kind);
        if (!existsSync(root))
            continue;
        const walk = (dir) => { out.add(real(dir)); try {
            for (const entry of readdirSync(dir, { withFileTypes: true }))
                if (entry.isDirectory())
                    walk(join(dir, entry.name));
        }
        catch { } };
        walk(root);
    }
    return [...out].sort();
}
export class SkillCatalogIndex {
    projectRoot;
    hiRoot;
    #cache;
    #fullScans = 0;
    #fingerprintChecks = 0;
    constructor(projectRoot, hiRoot) {
        this.projectRoot = projectRoot;
        this.hiRoot = hiRoot;
    }
    #key(hostConfig) { return JSON.stringify(configuredSkillPaths(hostConfig)); }
    #needsRefresh(hostConfig) {
        if (!this.#cache || this.#cache.key !== this.#key(hostConfig))
            return true;
        this.#fingerprintChecks++;
        for (const expected of this.#cache.dirs)
            if (!sameDir(expected, dirFingerprint(expected.path)))
                return true;
        for (const expected of this.#cache.files)
            if (!sameFile(expected, fileFingerprint(expected.path)))
                return true;
        return false;
    }
    refresh(hostConfig) {
        const paths = configuredSkillPaths(hostConfig), key = JSON.stringify(paths), roots = skillDiscoveryRoots(this.projectRoot, this.hiRoot, paths), items = discoverSkills(this.projectRoot, this.hiRoot, paths);
        const records = items.map(skill => { const content = (() => { try {
            return readFileSync(skill.path, 'utf8');
        }
        catch {
            return '';
        } })(), fp = fileFingerprint(skill.path); return { skill_id: skill.name, provider: skill.provider, skill_path: skill.path, realpath: real(skill.path), mtime_ms: fp?.mtime_ms ?? 0, content_sha256: fp?.sha256 ?? hash(content), frontmatter: parseSkillFrontmatter(content), resource_map: indexSkillResources(skill), valid: skill.valid, enabled: skill.enabled, orchestrationRisk: skill.orchestrationRisk }; });
        const dirPaths = new Set(roots.map(root => root.path));
        for (const dir of rootChildDirectories(roots.map(root => root.path)))
            dirPaths.add(dir);
        for (const skill of items)
            for (const dir of resourceDirectories(skill))
                dirPaths.add(dir);
        const dirs = [...dirPaths].sort().map(dirFingerprint), files = records.map(record => fileFingerprint(record.skill_path)).filter((x) => Boolean(x));
        this.#cache = { key, items, records, dirs, files };
        this.#fullScans++;
        return records.map(cloneRecord);
    }
    records(hostConfig) { if (this.#needsRefresh(hostConfig))
        this.refresh(hostConfig); return (this.#cache?.records ?? []).map(cloneRecord); }
    candidates(hostConfig) { if (this.#needsRefresh(hostConfig))
        this.refresh(hostConfig); return (this.#cache?.items ?? []).map(item => ({ ...item })); }
    diagnostics() { return { full_scans: this.#fullScans, fingerprint_checks: this.#fingerprintChecks, cached_records: this.#cache?.records.length ?? 0 }; }
    invalidate() { this.#cache = undefined; }
    invalidateChanged(files) {
        const changed = files.some(file => { const normalized = file.replace(/\\/g, '/').replace(/^\.\//, ''); return /(^|\/)(?:\.opencode|\.claude|\.agents)\/skills\//.test(normalized) || /(^|\/)skills\/[^/]+\/(?:SKILL\.md|references\/|scripts\/|assets\/|examples\/)/.test(normalized) || /(^|\/)\.opencode\/hi\/(?:policy|provenance)\/methodologies\//.test(normalized); });
        if (changed)
            this.invalidate();
        return changed;
    }
}
