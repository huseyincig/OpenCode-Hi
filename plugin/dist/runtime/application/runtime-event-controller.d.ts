import type { PluginRuntimeState } from './hi-tool-surface.js';
import type { HostEvent, HostPort } from '../host/port.js';
import type { createRuntimeServices } from './runtime-services.js';
import type { ProjectAuthorityStore } from '../safety/project-authority.js';
export declare class RuntimeEventController {
    private readonly deps;
    constructor(deps: {
        state: PluginRuntimeState;
        host: HostPort;
        services: ReturnType<typeof createRuntimeServices>;
        projectAuthority: ProjectAuthorityStore;
        pendingNativePermissions: Map<string, string[]>;
        projectRoot: string;
    });
    handle(ev: HostEvent): Promise<void>;
}
