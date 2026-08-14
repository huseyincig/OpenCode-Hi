import { configuredSkillPaths, discoverSkills } from './registry.js';
export class SkillCatalogIndex {
    projectRoot;
    hiRoot;
    #cache;
    constructor(projectRoot, hiRoot) {
        this.projectRoot = projectRoot;
        this.hiRoot = hiRoot;
    }
    candidates(hostConfig) {
        const paths = configuredSkillPaths(hostConfig), key = JSON.stringify(paths);
        if (!this.#cache || this.#cache.key !== key)
            this.#cache = { key, items: discoverSkills(this.projectRoot, this.hiRoot, paths) };
        return this.#cache.items.map(item => ({ ...item }));
    }
    invalidate() { this.#cache = undefined; }
    invalidateChanged(files) {
        const changed = files.some(file => { const normalized = file.replace(/\\/g, '/').replace(/^\.\//, ''); return /(^|\/)(?:\.opencode|\.claude|\.agents)\/skills\//.test(normalized) || /(^|\/)skills\/[^/]+\/SKILL\.md$/.test(normalized); });
        if (changed)
            this.invalidate();
        return changed;
    }
}
