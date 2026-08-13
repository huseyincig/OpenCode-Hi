import type { ExecutionMode, MissionState, NormalizedMissionIntent } from '../mission/types.js';
export type TopologyMode = 'adaptive' | 'single-agent' | 'multi-agent';
export interface TopologyPolicyConfig {
    mode: TopologyMode;
    maxAgents: number;
    parallelism: number;
}
export interface TopologyDecision {
    mode: 'single-agent' | 'multi-agent';
    executionMode: ExecutionMode;
    agentCount: number;
    parallelism: number;
    reason: string[];
}
export declare const DEFAULT_TOPOLOGY_POLICY: TopologyPolicyConfig;
export declare function decideTopology(intent: NormalizedMissionIntent, config?: TopologyPolicyConfig, m?: MissionState): TopologyDecision;
