import { resolveExecutionMode } from '../routing/execution-mode.js';
export const DEFAULT_TOPOLOGY_POLICY = { mode: 'adaptive', maxAgents: 4, parallelism: 2, allowMultiRoleAgent: true };
export function decideTopology(intent, config = DEFAULT_TOPOLOGY_POLICY, m) {
    if (config.mode === 'single-agent')
        return { mode: 'single-agent', executionMode: 'single', agentCount: 1, parallelism: 1, roleReuse: true, reason: ['explicit user/project single-agent override'] };
    const native = resolveExecutionMode(intent, m);
    if (config.mode === 'multi-agent')
        return { mode: 'multi-agent', executionMode: native.mode === 'single' ? 'team' : native.mode, agentCount: Math.max(2, Math.min(config.maxAgents, 2)), parallelism: Math.max(1, Math.min(config.parallelism, 2)), roleReuse: false, reason: ['explicit user/project multi-agent override'] };
    const benefit = intent.scope === 'multi-stream' || (intent.taskKind === 'review' && intent.requiredCapabilities.filter(x => ['security-review', 'visual-qa', 'review'].includes(x)).length >= 2);
    if (!benefit)
        return { mode: 'single-agent', executionMode: 'single', agentCount: 1, parallelism: 1, roleReuse: config.allowMultiRoleAgent, reason: ['adaptive policy found no material fan-out benefit', ...native.reason] };
    const count = Math.max(2, Math.min(config.maxAgents, intent.scope === 'multi-stream' ? 3 : 2));
    return { mode: 'multi-agent', executionMode: native.mode === 'single' ? 'parallel' : native.mode, agentCount: count, parallelism: Math.min(count, Math.max(1, config.parallelism)), roleReuse: false, reason: ['independent work/review streams justify bounded fan-out', ...native.reason] };
}
