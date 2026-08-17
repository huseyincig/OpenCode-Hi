import { isHiInjectedOpenCodeAgent } from '../../opencode/agent-binding.js';
import { discoverProjectMethodologyPolicies } from './project-policy.js';
function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined; }
export function applyAdmittedProjectMethodologyPermissions(hostConfig, projectRoot, options = {}) {
    const agents = record(hostConfig.agent);
    if (!agents)
        return [];
    const applied = [];
    for (const policy of discoverProjectMethodologyPolicies(projectRoot)) {
        for (const role of policy.compatible_roles) {
            const agent = record(agents[role]);
            if (!agent)
                continue;
            const permission = record(agent.permission) ?? {};
            if (!agent.permission)
                agent.permission = permission;
            const skill = record(permission.skill) ?? {};
            if (!permission.skill)
                permission.skill = skill;
            const exact = skill[policy.name];
            if (exact === 'deny' || exact === 'ask' || exact === 'allow') {
                applied.push({ name: policy.name, role, decision: exact });
                continue;
            }
            const wildcard = skill['*'];
            // A pre-existing host/user deny remains authoritative. For an agent inserted by Hi,
            // the generated '*' deny is Hi's own default-deny baseline, so project methodology
            // admission may narrow that one exact name to ASK without overriding user policy.
            if (wildcard === 'deny' && !options.hiInjectedAgents?.has(role) && !isHiInjectedOpenCodeAgent(agent)) {
                applied.push({ name: policy.name, role, decision: 'deny' });
                continue;
            }
            if (wildcard === 'ask') {
                applied.push({ name: policy.name, role, decision: 'ask' });
                continue;
            }
            // Repository-local methodology provenance proves integrity, not trust. Even if a broad
            // host wildcard is ALLOW/unspecified, project-authored methodology is narrowed to ASK.
            skill[policy.name] = 'ask';
            applied.push({ name: policy.name, role, decision: 'ask' });
        }
    }
    return applied;
}
