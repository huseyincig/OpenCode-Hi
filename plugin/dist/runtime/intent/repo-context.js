import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
export function resolveNativeProjectRoot(fallback, nativeContext = {}) {
    const directory = typeof nativeContext.directory === 'string' && nativeContext.directory ? resolve(nativeContext.directory) : undefined;
    const worktree = typeof nativeContext.worktree === 'string' && nativeContext.worktree ? resolve(nativeContext.worktree) : undefined;
    // OpenCode 1.18.x reports the filesystem root as a non-git worktree sentinel.
    // Never let that sentinel collapse unrelated projects into one HHC state/config root.
    if (worktree) {
        const isFilesystemRoot = dirname(worktree) === worktree;
        if (isFilesystemRoot && directory && directory !== worktree)
            return directory;
        return worktree;
    }
    return directory ?? resolve(fallback);
}
function has(root, name) { try {
    return existsSync(join(root, name));
}
catch {
    return false;
} }
function packageScripts(root) { try {
    const p = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    return p?.scripts && typeof p.scripts === 'object' ? p.scripts : {};
}
catch {
    return {};
} }
function usableScript(value) { const s = String(value ?? '').trim(); if (!s)
    return false; if (/no test specified|not implemented|todo:?\s*(?:add|write).*test/i.test(s))
    return false; return true; }
function nodeVerificationKinds(s) { const out = []; const keys = Object.keys(s); if ((keys.includes('test') && usableScript(s.test)) || keys.some(k => /^test[:.-]/.test(k) && usableScript(s[k])))
    out.push('test'); for (const key of ['typecheck', 'check', 'lint', 'build'])
    if (key in s && usableScript(s[key]))
        out.push(key); return out; }
export function collectRepoContext(root, nativeContext = {}) {
    const nativeRoot = resolveNativeProjectRoot(root, nativeContext);
    const ecosystems = [];
    const markers = [];
    const likelyVerification = [];
    if (has(nativeRoot, 'package.json')) {
        ecosystems.push('node');
        markers.push('package.json');
        const s = packageScripts(nativeRoot);
        likelyVerification.push(...nodeVerificationKinds(s));
    }
    if (has(nativeRoot, 'pyproject.toml') || has(nativeRoot, 'requirements.txt')) {
        ecosystems.push('python');
        markers.push(has(nativeRoot, 'pyproject.toml') ? 'pyproject.toml' : 'requirements.txt');
        likelyVerification.push('pytest');
    }
    if (has(nativeRoot, 'Cargo.toml')) {
        ecosystems.push('rust');
        markers.push('Cargo.toml');
        likelyVerification.push('cargo test');
    }
    if (has(nativeRoot, 'go.mod')) {
        ecosystems.push('go');
        markers.push('go.mod');
        likelyVerification.push('go test');
    }
    if (has(nativeRoot, 'composer.json')) {
        ecosystems.push('php');
        markers.push('composer.json');
    }
    for (const name of ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'opencode.json', 'opencode.jsonc'])
        if (has(nativeRoot, name))
            markers.push(name);
    try {
        const top = readdirSync(nativeRoot, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);
        for (const name of ['src', 'app', 'packages', 'apps', 'lib', 'test', 'tests'])
            if (top.includes(name))
                markers.push(`${name}/`);
    }
    catch { }
    const p = nativeContext.project ?? {}, vcs = String(p?.vcs ?? p?.versionControl ?? p?.scm ?? '').toLowerCase() || undefined, git = Boolean(vcs?.includes('git') || has(nativeRoot, '.git'));
    return { root: nativeRoot, name: String(p?.name ?? p?.id ?? basename(nativeRoot)), ecosystems: [...new Set(ecosystems)], markers: [...new Set(markers)].slice(0, 16), likelyVerification: [...new Set(likelyVerification)].slice(0, 8), git, native: { directory: nativeContext.directory, worktree: nativeContext.worktree, projectID: p?.id ? String(p.id) : undefined, vcs } };
}
