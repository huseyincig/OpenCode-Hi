import type { PluginRuntimeState } from '../runtime/application/hi-tool-surface.js';
export declare function createOpenCodeHooks(input: {
    state: PluginRuntimeState;
    host: any;
    services: any;
    projectRoot: string;
    packagedSkillsDir: string;
    projectAuthority: any;
    toolSurface: Record<string, unknown>;
    reconfigureToolSurface: () => void;
    eventController: any;
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
    event: (input: any) => any;
};
