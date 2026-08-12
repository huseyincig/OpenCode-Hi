import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveSkillPermission } from './permissions.js';
const ROLE_CAPABILITY_SKILLS = {
    coder: {
        debugging: ['hi-debugging-root-cause'],
        'tdd-required': ['hi-test-driven-development'],
        'implementation-planning': ['hi-implementation-planning'],
        verification: ['hi-test-strategy'],
        'docs-change': ['hi-changelog-and-documentation'],
        refactor: ['hi-safe-refactoring'],
        'database-migration': ['hi-database-migration'],
        'dependency-change': ['hi-dependency-change'],
        'api-contract': ['hi-api-contract-review'],
        'api-interface-design': ['hi-api-interface-design'],
        'ci-recovery': ['hi-ci-build-recovery'],
        'performance-analysis': ['hi-performance-analysis'],
        'release-guardrails': ['hi-release-guardrails'],
        'source-verification': ['hi-source-driven-development'],
        'review-feedback': ['hi-review-feedback'],
        'workspace-isolation': ['hi-workspace-isolation'],
        'skill-authoring': ['hi-skill-authoring'],
        'critical-validation': ['hi-adversarial-validation'],
    },
    architect: {
        'design-exploration': ['hi-design-discovery'],
        'implementation-planning': ['hi-architecture-decisions', 'hi-implementation-planning'],
        'repository-analysis': ['hi-iterative-retrieval', 'hi-repository-analysis'],
        'api-contract': ['hi-api-interface-design'],
        'api-interface-design': ['hi-api-interface-design'],
        'source-verification': ['hi-source-driven-development'],
        'critical-validation': ['hi-adversarial-validation'],
    },
    'repository-explorer': {
        'repository-analysis': ['hi-iterative-retrieval', 'hi-repository-analysis'],
        'source-verification': ['hi-source-driven-development'],
    },
    'qa-reviewer': {
        review: ['hi-code-review'],
        verification: ['hi-test-strategy'],
        'review-feedback': ['hi-review-feedback'],
        'critical-validation': ['hi-adversarial-validation'],
        'regression-review': ['hi-regression-review'],
    },
    'security-reviewer': {
        'security-review': ['hi-security-review'],
        review: ['hi-code-review'],
        'review-feedback': ['hi-review-feedback'],
        'critical-validation': ['hi-adversarial-validation'],
        'dependency-change': ['hi-dependency-change'],
    },
    'visual-qa': {
        'visual-qa': ['hi-visual-qa'],
        accessibility: ['hi-accessibility-review'],
        'browser-testing': ['hi-browser-testing'],
        'design-exploration': ['hi-design-discovery'],
    },
};
const GENERIC = {
    debugging: ['hi-debugging-root-cause'],
    'tdd-required': ['hi-test-driven-development'],
    'design-exploration': ['hi-design-discovery'],
    'implementation-planning': ['hi-implementation-planning'],
    verification: ['hi-test-strategy'],
    review: ['hi-code-review'],
    'security-review': ['hi-security-review'],
    'source-verification': ['hi-source-driven-development'],
    'review-feedback': ['hi-review-feedback'],
    'api-interface-design': ['hi-api-interface-design'],
    'workspace-isolation': ['hi-workspace-isolation'],
    'skill-authoring': ['hi-skill-authoring'],
    'critical-validation': ['hi-adversarial-validation'],
};
function validSkillFrontmatter(text, name) { const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/); if (!m)
    return false; const fm = m[1], n = fm.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim(), d = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim(); return n === name && Boolean(d); }
function inspectDir(path, provider) { if (!existsSync(path))
    return []; const out = []; for (const name of readdirSync(path)) {
    const file = join(path, name, 'SKILL.md');
    if (!existsSync(file))
        continue;
    let valid = false;
    try {
        valid = validSkillFrontmatter(readFileSync(file, 'utf8'), name);
    }
    catch { }
    out.push({ name, provider, path: file, valid, enabled: true, orchestrationRisk: false });
} return out; }
function canonical(path) { try {
    return realpathSync(path);
}
catch {
    return resolve(path);
} }
export function configuredSkillPaths(hostConfig) { const skills = (hostConfig.skills && typeof hostConfig.skills === 'object') ? hostConfig.skills : {}; const paths = Array.isArray(skills.paths) ? skills.paths : []; return [...new Set(paths.filter((x) => typeof x === 'string' && x.trim().length > 0).map(x => canonical(x.trim())))]; }
export function discoverSkills(projectRoot, hiRoot, extraPaths = []) { const home = process.env.HOME ?? process.env.USERPROFILE ?? '', opencodeConfigDir = process.env.OPENCODE_CONFIG_DIR ? resolve(process.env.OPENCODE_CONFIG_DIR) : join(home, '.config', 'opencode'), roots = [[join(projectRoot, '.opencode', 'skills'), 'project'], [join(projectRoot, '.claude', 'skills'), 'project'], [join(projectRoot, '.agents', 'skills'), 'project'], ...(hiRoot ? [[join(hiRoot, 'skills'), 'hi']] : []), [join(opencodeConfigDir, 'skills'), 'personal'], [join(home, '.claude', 'skills'), 'personal'], [join(home, '.agents', 'skills'), 'personal'], ...extraPaths.map(x => [x, 'personal'])]; const out = []; for (const [root, provider] of roots)
    out.push(...inspectDir(root, provider)); return out; }
function desiredFor(role, capabilities) { const map = ROLE_CAPABILITY_SKILLS[role] ?? GENERIC; return [...new Set(capabilities.flatMap(c => map[c] ?? GENERIC[c] ?? []))]; }
export function resolveSkillPlan(capabilities, candidates, permissionMap, skillToolEnabled = true, role = 'coder') {
    const requested = desiredFor(role, capabilities).slice(0, 3), selected = [], missing = [], outcomes = [];
    for (const name of requested) {
        const permission = resolveSkillPermission(name, permissionMap), all = candidates.filter(c => c.name === name), ordered = [...all.filter(c => c.provider === 'hi'), ...all.filter(c => c.provider === 'project'), ...all.filter(c => c.provider === 'personal')], candidate = ordered.find(c => c.valid && c.enabled);
        let outcome;
        if (!all.length)
            outcome = 'missing';
        else if (!skillToolEnabled)
            outcome = 'disabled';
        else if (!all.some(x => x.valid))
            outcome = 'invalid';
        else if (permission === 'deny')
            outcome = 'deny';
        else if (candidate)
            outcome = permission === 'ask' ? 'ask' : 'allow';
        else
            outcome = 'missing';
        outcomes.push({ name, outcome, provider: candidate?.provider, path: candidate?.path });
        if (candidate && skillToolEnabled && permission !== 'deny')
            selected.push({ ...candidate, permission });
        else
            missing.push(name);
    }
    const asks = selected.filter(s => s.permission === 'ask').map(s => s.name), reason = [selected.length ? `skills=${selected.map(s => `${s.provider}:${s.name}`).join(',')}` : 'skills=0', ...(asks.length ? [`skill-permission-ask=${asks.join(',')}`] : []), ...(!skillToolEnabled ? ['skill-tool-disabled; native-fallback'] : []), ...(missing.length ? [`missing-or-denied-skill-fallback=${missing.join(',')}`] : [])];
    return { selected, requested, missing, outcomes, reason };
}
export function selectSkills(capabilities, candidates) { return resolveSkillPlan(capabilities, candidates).selected; }
export function indexSkillResources(skill) {
    if (!skill.valid)
        return [];
    const base = canonical(resolve(skill.path, '..')), out = [];
    for (const kind of ['references', 'scripts', 'assets', 'examples']) {
        const root = join(base, kind);
        if (!existsSync(root))
            continue;
        const walk = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const raw = join(dir, entry.name);
            let actual;
            try {
                actual = realpathSync(raw);
            }
            catch {
                continue;
            }
            if (actual !== base && !actual.startsWith(`${base}/`) && !actual.startsWith(`${base}\\`))
                continue;
            if (entry.isDirectory())
                walk(raw);
            else if (entry.isFile()) {
                const relativePath = actual.slice(canonical(root).length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
                out.push({ name: skill.name, kind, relativePath, absolutePath: actual });
            }
        } };
        walk(root);
    }
    return out.sort((a, b) => `${a.kind}/${a.relativePath}`.localeCompare(`${b.kind}/${b.relativePath}`));
}
export function readSkillResource(skill, kind, relativePath) {
    if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\'))
        throw new Error('Unsafe skill resource path');
    const hit = indexSkillResources(skill).find(r => r.kind === kind && r.relativePath === relativePath.replace(/\\/g, '/'));
    if (!hit)
        throw new Error(`Skill resource not found: ${skill.name}/${kind}/${relativePath}`);
    return readFileSync(hit.absolutePath, 'utf8');
}
