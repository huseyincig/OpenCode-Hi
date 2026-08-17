import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { projectPolicyPath } from '../storage/ownership.js';
const CLASS_PATTERNS = {
    'git-push': ['git push *'],
    'release-create': ['gh release create *'],
    'package-publish': ['npm publish*', 'pnpm publish*', 'bun publish*', 'yarn npm publish*'],
    'deploy': ['docker push *', 'kubectl apply *', 'kubectl delete *', 'terraform apply *', 'vercel deploy*', 'netlify deploy*'],
};
function empty() { return { schema: 1, grants: {} }; }
export class ProjectAuthorityStore {
    path;
    #state;
    constructor(root) { this.path = projectPolicyPath(root, 'authority'); this.#state = this.#load(); }
    #load() { try {
        if (!existsSync(this.path))
            return empty();
        const raw = JSON.parse(readFileSync(this.path, 'utf8'));
        if (raw?.schema !== 1 || !raw?.grants || typeof raw.grants !== 'object')
            return empty();
        return raw;
    }
    catch {
        return empty();
    } }
    has(cls) { return Boolean(this.#state.grants[cls]); }
    grant(cls) { this.#state.grants[cls] = { approved_at: Date.now(), source: 'native-always' }; mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(this.path, JSON.stringify(this.#state, null, 2) + '\n', 'utf8'); }
    grants() { return Object.keys(this.#state.grants).filter(x => this.has(x)); }
}
function norm(s) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }
export function authorityClassForPatterns(patterns) { const p = patterns.map(norm); if (p.some(x => /^git push(?:\s|\*)/.test(x)))
    return 'git-push'; if (p.some(x => /^gh release create(?:\s|\*)/.test(x)))
    return 'release-create'; if (p.some(x => /^(npm|pnpm|bun) publish(?:\s|\*)?/.test(x) || /^yarn npm publish(?:\s|\*)?/.test(x)))
    return 'package-publish'; if (p.some(x => /^(docker push|kubectl apply|kubectl delete|terraform apply|vercel deploy|netlify deploy)(?:\s|\*)?/.test(x)))
    return 'deploy'; return undefined; }
function wildcard(pattern, value) { const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'); return new RegExp(`^${esc}$`, 'i').test(value); }
function decisionInfo(bash, pattern) { if (typeof bash === 'string')
    return bash === 'allow' || bash === 'ask' || bash === 'deny' ? { decision: bash, source: 'broad' } : undefined; if (!bash || typeof bash !== 'object')
    return undefined; let result; for (const [k, v] of Object.entries(bash))
    if ((k === '*' || wildcard(k, pattern.replace(/\*$/, '')) || wildcard(k, pattern)) && (v === 'allow' || v === 'ask' || v === 'deny'))
        result = { decision: v, source: k === '*' ? 'broad' : 'specific' }; return result; }
/** Merge Hi's authority prompt/persistent grants without ever weakening a user/native explicit deny. */
export function applyProjectAuthorityPermissions(config, store) {
    const permission = (config.permission && typeof config.permission === 'object' && !Array.isArray(config.permission) ? config.permission : {});
    const existing = permission.bash;
    if (existing === 'deny') {
        config.permission = permission;
        return;
    }
    const bash = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : { ...(typeof existing === 'string' ? { '*': existing } : {}) };
    // Local reversible bookkeeping follows an existing host/user decision. When none exists,
    // OpenCode V1 is permissive by default, so adding an explicit ALLOW is semantically neutral.
    for (const pattern of ['git status*', 'git diff *', 'git add *', 'git commit *', 'git merge *', 'git tag *'])
        if (decisionInfo(existing, pattern) === undefined)
            bash[pattern] = 'allow';
    // External effects are Hi authority hinges. A broad/default ALLOW may be narrowed to ASK,
    // or restored to ALLOW after exact persistent native approval. Specific user/plugin rules
    // and broad ASK/DENY remain authoritative and are never widened.
    for (const cls of Object.keys(CLASS_PATTERNS))
        for (const pattern of CLASS_PATTERNS[cls]) {
            const info = decisionInfo(existing, pattern);
            if (info?.source === 'specific' || info?.decision === 'ask' || info?.decision === 'deny')
                continue;
            bash[pattern] = store.has(cls) ? 'allow' : 'ask';
        }
    // Persistent normal-push approval never widens to destructive history rewrites.
    for (const pattern of ['git push --force*', 'git push -f *']) {
        const info = decisionInfo(existing, pattern);
        if (info?.source === 'specific' || info?.decision === 'ask' || info?.decision === 'deny')
            continue;
        bash[pattern] = 'ask';
    }
    permission.bash = bash;
    config.permission = permission;
}
