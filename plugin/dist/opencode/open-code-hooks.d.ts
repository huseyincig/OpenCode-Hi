import type { PluginRuntimeState } from '../runtime/application/hi-tool-surface.js';
import type { HostPort } from '../runtime/host/port.js';
import type { createRuntimeServices } from '../runtime/application/runtime-services.js';
import type { ProjectAuthorityStore } from '../runtime/safety/project-authority.js';
import type { RuntimeEventController } from '../runtime/application/runtime-event-controller.js';
export declare function createOpenCodeHooks(input: {
    state: PluginRuntimeState;
    host: HostPort;
    services: ReturnType<typeof createRuntimeServices>;
    projectRoot: string;
    packagedSkillsDir: string;
    projectAuthority: ProjectAuthorityStore;
    toolSurface: Record<string, unknown>;
    reconfigureToolSurface: () => void;
    eventController: RuntimeEventController;
    instanceLease: {
        release: () => void;
    };
}): {
    name: string;
    tool: Record<string, unknown>;
    config: (opencodeConfig: Record<string, unknown>) => Promise<void>;
    'chat.message': (input: any, output: any) => Promise<void>;
    'experimental.chat.messages.transform': (input: any, output: any) => Promise<void>;
    'experimental.chat.system.transform': (input: any, output: any) => Promise<void>;
    'experimental.session.compacting': (input: any, output: any) => Promise<void>;
    'tool.execute.before': (input: any, output: any) => Promise<void>;
    'tool.execute.after': (input: any, output: any) => Promise<void>;
    dispose: () => Promise<void>;
    event: (input: any) => Promise<void>;
};
