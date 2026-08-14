import type { PluginRuntimeState } from './hi-tool-surface.js';
import type { createHostPort } from '../../opencode/host-port.js';
import type { createRuntimeServices } from './runtime-services.js';
import type { ProjectAuthorityStore } from '../safety/project-authority.js';
export declare class RuntimeEventController {
    private readonly deps;
    constructor(deps: {
        state: PluginRuntimeState;
        host: ReturnType<typeof createHostPort>;
        services: ReturnType<typeof createRuntimeServices>;
        projectAuthority: ProjectAuthorityStore;
        pendingNativePermissions: Map<string, string[]>;
        projectRoot: string;
    });
    handle({ event }: any): Promise<void>;
}
