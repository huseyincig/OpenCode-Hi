import type { PluginRuntimeState } from './hi-tool-surface.js';
import type { HostEvent, HostPort } from '../host/port.js';
import type { createRuntimeServices } from './runtime-services.js';
import type { ProjectAuthorityStore } from '../safety/project-authority.js';
import type { MissionState } from '../mission/types.js';
interface PendingNativePermission {
    patterns: string[];
    command?: string;
}
export declare class RuntimeEventController {
    private readonly deps;
    constructor(deps: {
        state: PluginRuntimeState;
        host: HostPort;
        services: ReturnType<typeof createRuntimeServices>;
        projectAuthority: ProjectAuthorityStore;
        pendingNativePermissions: Map<string, PendingNativePermission>;
        projectRoot: string;
    });
    clearNativePermissionsForSession(sessionID: string): number;
    clearNativePermissionsForMission(m: MissionState): number;
    clearAllNativePermissions(): void;
    handle(ev: HostEvent): Promise<void>;
}
export {};
