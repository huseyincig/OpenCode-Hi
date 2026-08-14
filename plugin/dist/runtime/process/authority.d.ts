import type { ProcessSpawnRequest } from './executor.js';
export interface ProcessSpawnAuthorityResult {
    decision: 'ALLOW' | 'ASK' | 'DENY';
    reason: string;
    command_line: string;
    external_cwd: boolean;
}
export declare function processCommandLine(request: Pick<ProcessSpawnRequest, 'command' | 'args'>): string;
export declare function evaluateProcessSpawnAuthority(request: ProcessSpawnRequest, projectRoot: string, hostConfig: Record<string, unknown>): ProcessSpawnAuthorityResult;
