import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveSkillPermission } from './permissions.js';
const ROLE_CAPABILITY_SKILLS = {
    coder: {
        debugging: ['hhc-debugging-root-cause'],
        'tdd-required': ['hhc-test-driven-development'],
        'implementation-planning': ['hhc-implementation-planning'],
        verification: ['hhc-test-strategy'],
        'docs-change': ['hhc-changelog-and-documentation'],
        refactor: ['hhc-safe-refactoring'],
        'database-migration': ['hhc-database-migration'],
        'dependency-change': ['hhc-dependency-change'],
        'api-contract': ['hhc-api-contract-review'],
        'api-interface-design': ['hhc-api-interface-design'],
        'ci-recovery': ['hhc-ci-build-recovery'],
        'performance-analysis': ['hhc-performance-analysis'],
        'release-guardrails': ['hhc-release-guardrails'],
        'source-verification': ['hhc-source-driven-development'],
        'review-feedback': ['hhc-review-feedback'],
        'workspace-isolation': ['hhc-workspace-isolation'],
        'skill-authoring': ['hhc-skill-authoring'],
        'critical-validation': ['hhc-adversarial-validation'],
    },
    architect: {
        'design-exploration': ['hhc-design-discovery'],
        'implementation-planning': ['hhc-architecture-decisions', 'hhc-implementation-planning'],
        'repository-analysis': ['hhc-iterative-retrieval', 'hhc-repository-analysis'],
        'api-contract': ['hhc-api-interface-design'],
        'api-interface-design': ['hhc-api-interface-design'],
        'source-verification': ['hhc-source-driven-development'],
        'critical-validation': ['hhc-adversarial-validation'],
    },
    'repository-explorer': {
        'repository-analysis': ['hhc-iterative-retrieval', 'hhc-repository-analysis'],
        'source-verification': ['hhc-source-driven-development'],
    },
    'qa-reviewer': {
        review: ['hhc-code-review'],
        verification: ['hhc-test-strategy'],
        'review-feedback': ['hhc-review-feedback'],
        'critical-validation': ['hhc-adversarial-validation'],
        'regression-review': ['hhc-regression-review'],
    },
    'security-reviewer': {
        'security-review': ['hhc-security-review'],
        review: ['hhc-code-review'],
        'review-feedback': ['hhc-review-feedback'],
        'critical-validation': ['hhc-adversarial-validation'],
        'dependency-change': ['hhc-dependency-change'],
    },
    'visual-qa': {
        'visual-qa': ['hhc-visual-qa'],
        accessibility: ['hhc-accessibility-review'],
        'browser-testing': ['hhc-browser-testing'],
        'design-exploration': ['hhc-design-discovery'],
    },
};
const GENERIC = {
    debugging: ['hhc-debugging-root-cause'],
    'tdd-required': ['hhc-test-driven-development'],
    'design-exploration': ['hhc-design-discovery'],
    'implementation-planning': ['hhc-implementation-planning'],
    verification: ['hhc-test-strategy'],
    review: ['hhc-code-review'],
    'security-review': ['hhc-security-review'],
    'source-verification': ['hhc-source-driven-development'],
    'review-feedback': ['hhc-review-feedback'],
    'api-interface-design': ['hhc-api-interface-design'],
    'workspace-isolation': ['hhc-workspace-isolation'],
    'skill-authoring': ['hhc-skill-authoring'],
    'critical-validation': ['hhc-adversarial-validation'],
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
export function discoverSkills(projectRoot, hhcRoot, extraPaths = []) { const home = process.env.HOME ?? process.env.USERPROFILE ?? '', opencodeConfigDir = process.env.OPENCODE_CONFIG_DIR ? resolve(process.env.OPENCODE_CONFIG_DIR) : join(home, '.config', 'opencode'), roots = [[join(projectRoot, '.opencode', 'skills'), 'project'], [join(projectRoot, '.claude', 'skills'), 'project'], [join(projectRoot, '.agents', 'skills'), 'project'], ...(hhcRoot ? [[join(hhcRoot, 'skills'), 'hhc']] : []), [join(opencodeConfigDir, 'skills'), 'personal'], [join(home, '.claude', 'skills'), 'personal'], [join(home, '.agents', 'skills'), 'personal'], ...extraPaths.map(x => [x, 'personal'])]; const out = []; for (const [root, provider] of roots)
    out.push(...inspectDir(root, provider)); return out; }
function desiredFor(role, capabilities) { const map = ROLE_CAPABILITY_SKILLS[role] ?? GENERIC; return [...new Set(capabilities.flatMap(c => map[c] ?? GENERIC[c] ?? []))]; }
export function resolveSkillPlan(capabilities, candidates, permissionMap, skillToolEnabled = true, role = 'coder') {
    const requested = desiredFor(role, capabilities).slice(0, 3), selected = [], missing = [], outcomes = [];
    for (const name of requested) {
        const permission = resolveSkillPermission(name, permissionMap), all = candidates.filter(c => c.name === name), ordered = [...all.filter(c => c.provider === 'hhc'), ...all.filter(c => c.provider === 'project'), ...all.filter(c => c.provider === 'personal')], candidate = ordered.find(c => c.valid && c.enabled);
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
