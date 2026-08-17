import { existsSync } from 'node:fs';
import { projectHiOpenCodeAgents } from './agent-binding.js';
import { applyAdmittedProjectMethodologyPermissions } from '../runtime/methodology/host-permissions.js';
import { applyProjectAuthorityPermissions } from '../runtime/safety/project-authority.js';
function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined; }
function projectBuiltinPrimaryNativeTaskExclusion(config, diagnostics) {
    const agents = record(config.agent) ?? {};
    for (const name of ['build', 'plan']) {
        const current = agents[name];
        if (current !== undefined && !record(current)) {
            diagnostics.push(`native-task-exclusion-skipped:${name}:agent-shape`);
            continue;
        }
        const agent = record(current) ?? {};
        const existingTools = agent.tools;
        if (existingTools !== undefined && !record(existingTools)) {
            diagnostics.push(`native-task-exclusion-skipped:${name}:tools-shape`);
            continue;
        }
        const tools = record(existingTools) ?? {};
        if (tools.task === true)
            diagnostics.push(`native-task-exclusion-narrowed:${name}:explicit-true`);
        tools.task = false;
        agent.tools = tools;
        agents[name] = agent;
    }
    config.agent = agents;
}
export function selectOpenCodeCompositionMode(capabilities) {
    if (capabilities.v2AgentTransform && capabilities.v2SkillRegistration && capabilities.v2PermissionTransform)
        return 'v2-domain-transform';
    if (capabilities.v1ConfigHook)
        return 'v1-config-hook';
    return 'unsupported';
}
export function probeOpenCodeComposition(config) {
    const v1Signals = ['plugin', 'agent', 'permission', 'default_agent', 'subagent_depth'].filter(k => k in config);
    if (record(config.skills))
        v1Signals.push('skills-object');
    const v2Signals = ['plugins', 'agents', 'permissions', 'providers'].filter(k => k in config);
    if (Array.isArray(config.skills))
        v2Signals.push('skills-array');
    const family = v1Signals.length && v2Signals.length ? 'mixed' : v1Signals.length ? 'v1-config-hook' : v2Signals.length ? 'v2-domain-config' : 'unknown';
    return { family, signals: [...v1Signals.map(x => `v1:${x}`), ...v2Signals.map(x => `v2:${x}`)], v1ConfigProjection: family === 'v1-config-hook' || family === 'unknown', v2DomainTransformPreferred: family === 'v2-domain-config' || family === 'mixed' };
}
/** Current SDK/V1 compatibility projection. Mutates only explicit Hi-owned/narrowing leaves. */
export function projectHiV1Composition(input) {
    const { config, packagedAgents, packagedSkillsDir, projectRoot, projectAuthority } = input, diagnostics = [];
    const agentProjection = projectHiOpenCodeAgents(config, packagedAgents);
    if (agentProjection.collisions.length) {
        diagnostics.push(...agentProjection.collisions.map(name => `agent-collision:${name}`));
        return { agentProjection, skillPathAdded: false, methodologyPermissions: 0, diagnostics };
    }
    projectBuiltinPrimaryNativeTaskExclusion(config, diagnostics);
    let skillPathAdded = false;
    if (existsSync(packagedSkillsDir)) {
        const skills = record(config.skills) ?? {}, paths = Array.isArray(skills.paths) ? skills.paths : [];
        if (!paths.includes(packagedSkillsDir)) {
            paths.push(packagedSkillsDir);
            skillPathAdded = true;
        }
        skills.paths = paths;
        config.skills = skills;
    }
    const methodology = applyAdmittedProjectMethodologyPermissions(config, projectRoot, { hiInjectedAgents: new Set(agentProjection.inserted) });
    applyProjectAuthorityPermissions(config, projectAuthority);
    return { agentProjection, skillPathAdded, methodologyPermissions: methodology.length, diagnostics };
}
/**
 * Adapter entrypoint used by the current config hook. V2-shaped config is never
 * backfilled with V1 keys; that host family requires the V2 domain transform/
 * registration adapter instead of pretending the old config mutation seam is portable.
 */
export function projectHiOpenCodeComposition(input) {
    const probe = probeOpenCodeComposition(input.config);
    if (probe.family === 'v2-domain-config')
        return { applied: false, mode: 'v2-domain-transform-required', probe, diagnostics: ['v2-domain-transform-required'] };
    if (probe.family === 'mixed')
        return { applied: false, mode: 'mixed-config-collision', probe, diagnostics: ['mixed-v1-v2-config-family'] };
    const v1 = projectHiV1Composition(input);
    return { applied: true, mode: 'v1-config-hook', probe, v1, diagnostics: v1.diagnostics };
}
