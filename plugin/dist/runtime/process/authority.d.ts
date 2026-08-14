import type { ProcessSpawnRequest } from './executor.js';
export interface ProcessPermissionRequest {
    permission: 'bash' | 'external_directory';
    pattern: string;
    patterns: string[];
    always: string[];
    metadata: Record<string, unknown>;
}
export interface ProcessSpawnAuthorityResult {
    decision: 'ALLOW' | 'ASK' | 'DENY';
    reason: string;
    command_line: string;
    external_cwd: boolean;
    permission_request?: ProcessPermissionRequest;
}
export declare function processCommandLine(request: Pick<ProcessSpawnRequest, 'command' | 'args'>): string;
export declare function evaluateProcessSpawnAuthority(request: ProcessSpawnRequest, projectRoot: string, hostConfig: Record<string, unknown>): ProcessSpawnAuthorityResult;
