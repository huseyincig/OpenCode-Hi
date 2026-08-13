import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveSkillPermission } from './permissions.js';
import { builtinMethodologyCatalog, methodologyLimits } from '../methodology/catalog.js';
function requestedMethodologies(methodologyNeeds) { return [...new Set(methodologyNeeds)]; }
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
export function discoverSkills(projectRoot, hiRoot, extraPaths = []) { const home = process.env.HOME ?? process.env.USERPROFILE ?? '', opencodeConfigDir = process.env.OPENCODE_CONFIG_DIR ? resolve(process.env.OPENCODE_CONFIG_DIR) : join(home, '.config', 'opencode'), roots = [[join(projectRoot, '.opencode', 'skills'), 'project'], [join(projectRoot, '.claude', 'skills'), 'project'], [join(projectRoot, '.agents', 'skills'), 'project'], ...(hiRoot ? [[join(hiRoot, 'skills'), 'hi']] : []), [join(opencodeConfigDir, 'skills'), 'personal'], [join(home, '.claude', 'skills'), 'personal'], [join(home, '.agents', 'skills'), 'personal'], ...extraPaths.map(x => [x, 'personal'])]; const out = [], seenRoots = new Set(); for (const [root, provider] of roots) {
    const key = canonical(root);
    if (seenRoots.has(key))
        continue;
    seenRoots.add(key);
    out.push(...inspectDir(root, provider));
} return out; }
export function resolveSkillPlan(methodologyNeeds, candidates, permissionMap, skillToolEnabled = true, role = 'coder', catalog = builtinMethodologyCatalog()) {
    const requested = requestedMethodologies(methodologyNeeds), selected = [], missing = [], outcomeByName = new Map();
    const eligible = [];
    for (const [index, name] of requested.entries()) {
        const policy = catalog.find(item => item.name === name);
        if (!policy) {
            outcomeByName.set(name, { name, outcome: 'unknown-policy' });
            missing.push(name);
            continue;
        }
        if (!policy.compatibleRoles.includes(role)) {
            outcomeByName.set(name, { name, outcome: 'incompatible' });
            missing.push(name);
            continue;
        }
        const expectedProvider = policy.provider;
        const all = candidates.filter(candidate => candidate.name === name);
        const foreign = all.filter(candidate => candidate.provider !== expectedProvider);
        if (foreign.length) {
            outcomeByName.set(name, { name, outcome: 'invalid' });
            missing.push(name);
            continue;
        }
        const candidate = all.find(item => item.provider === expectedProvider && item.valid && item.enabled);
        const permission = resolveSkillPermission(name, permissionMap);
        let outcome;
        if (!all.length)
            outcome = 'missing';
        else if (!skillToolEnabled)
            outcome = 'disabled';
        else if (!all.some(item => item.valid))
            outcome = 'invalid';
        else if (permission === 'deny')
            outcome = 'deny';
        else if (candidate)
            outcome = permission === 'ask' ? 'ask' : 'allow';
        else
            outcome = 'missing';
        if (candidate && skillToolEnabled && permission !== 'deny' && (outcome === 'allow' || outcome === 'ask'))
            eligible.push({ name, candidate, permission, policy, index });
        else
            missing.push(name);
        outcomeByName.set(name, { name, outcome, provider: candidate?.provider, path: candidate?.path });
    }
    const priorityRank = { high: 3, normal: 2, low: 1 }, costRank = { low: 0, medium: 1, high: 2 };
    const ranked = [...eligible].sort((a, b) => priorityRank[b.policy.priority] - priorityRank[a.policy.priority] || Number(b.policy.preferredRoles.includes(role)) - Number(a.policy.preferredRoles.includes(role)) || b.policy.weight - a.policy.weight || (costRank[a.policy.contextCost] + costRank[a.policy.executionCost] + costRank[a.policy.compositionCost]) - (costRank[b.policy.contextCost] + costRank[b.policy.executionCost] + costRank[b.policy.compositionCost]) || a.index - b.index);
    const chosen = [];
    const conflicts = (a, b) => a.conflicts.includes(b.name) || b.conflicts.includes(a.name);
    const coexists = (a, b) => a.usefulCoexistence.includes(b.name) || b.usefulCoexistence.includes(a.name);
    for (const item of ranked) {
        let pick = false, outcome = item.permission === 'ask' ? 'ask' : 'allow';
        if (chosen.length < methodologyLimits.typicalMax)
            pick = true;
        else if (chosen.length >= methodologyLimits.hardMax)
            outcome = 'budget-exceeded';
        else if (chosen.some(other => conflicts(item.policy, other.policy)))
            outcome = 'composition-deferred';
        else if (chosen[0] && coexists(item.policy, chosen[0].policy))
            pick = true;
        else
            outcome = 'composition-deferred';
        if (pick) {
            chosen.push(item);
            selected.push({ ...item.candidate, permission: item.permission });
        }
        else
            outcomeByName.set(item.name, { name: item.name, outcome, provider: item.candidate.provider, path: item.candidate.path });
    }
    const outcomes = requested.map(name => outcomeByName.get(name) ?? { name, outcome: 'missing' });
    const asks = selected.filter(item => item.permission === 'ask').map(item => item.name), deferred = outcomes.filter(item => item.outcome === 'composition-deferred').map(item => item.name);
    const reason = [
        selected.length ? `skills=${selected.map(item => `${item.provider}:${item.name}`).join(',')}` : 'skills=0',
        ...(asks.length ? [`skill-permission-ask=${asks.join(',')}`] : []),
        ...(deferred.length ? [`methodology-composition-deferred=${deferred.join(',')}`] : []),
        ...(!skillToolEnabled ? ['skill-tool-disabled; native-fallback'] : []),
        ...(missing.length ? [`missing-or-denied-methodology-fallback=${missing.join(',')}`] : []),
    ];
    return { selected, requested, missing, outcomes, reason };
}
export function selectMethodologies(methodologyNeeds, candidates, role = 'coder', catalog = builtinMethodologyCatalog()) {
    return resolveSkillPlan(methodologyNeeds, candidates, undefined, true, role, catalog).selected;
}
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
