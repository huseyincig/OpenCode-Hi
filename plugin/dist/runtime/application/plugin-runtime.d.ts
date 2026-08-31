import { ProjectAuthorityStore } from '../safety/project-authority.js';
import { type PluginRuntimeState } from './hi-tool-surface.js';
import { RuntimeEventController } from './runtime-event-controller.js';
import type { HostPort, ChildSessionPort } from '../host/port.js';
import type { ProcessExecutor } from '../process/executor.js';
import type { WorkspaceExecutor } from '../workspace/executor.js';
import type { NativeProjectContext } from '../intent/repo-context.js';
export interface RuntimeInstanceLease {
    release(): void;
}
export interface OwnedCapabilityObserver {
    observe: (id: 'process-lifecycle' | 'workspace-isolation-binding') => Promise<{
        available: boolean;
        detail?: string;
    }>;
    setBrowserAvailable: (available: boolean) => void;
}
export interface HiRuntimeBootstrapInput {
    packageRoot: string;
    packagedSkillsDir: string;
    projectRoot: string;
    workingDirectory: string;
    nativeContext: NativeProjectContext;
    host: HostPort;
    childSession: ChildSessionPort;
    processExecutor: ProcessExecutor;
    workspaceExecutor: WorkspaceExecutor;
    ownedCapabilities: OwnedCapabilityObserver;
    instanceLease: RuntimeInstanceLease;
}
/** Host-generation-neutral application composition. Concrete OpenCode lifecycle/API shapes are supplied by edge adapters. */
export declare function createHiRuntime(input: HiRuntimeBootstrapInput): Promise<{
    state: PluginRuntimeState;
    host: HostPort;
    services: {
        store: import("../mission/mission-store.js").MissionStore;
        background: import("../background/registry.js").BackgroundRegistry;
        humanDecisionTransport: import("../human-decision/transport.js").ChatHumanDecisionTransport;
        persistence: import("../state/persistence.js").RuntimePersistence;
        scheduler: import("../scheduler/concurrency.js").ConcurrencyPolicySource;
        eventSink: import("../events/event-sink.js").RuntimeSignalSink;
        tasks: import("../task/task-runtime.js").TaskRuntime;
        processExecutor: ProcessExecutor;
        processRuntime: import("../process/runtime.js").ProcessRuntime;
        workspaceExecutor: WorkspaceExecutor;
        workspaceRuntime: import("../workspace/runtime.js").WorkspaceRuntime;
        browserExecutor: import("../browser/executor.js").BrowserExecutor;
        setBrowserAvailable: (value: boolean) => void;
        ensureBrowserAvailable: () => Promise<{
            available: boolean;
            attempted: boolean;
            reason: string | undefined;
            implementationId: string;
            status: import("../../contracts/operational-tool.js").OperationalToolResolutionStatus;
            scope: import("../../contracts/operational-tool.js").OperationalToolResolutionScope;
            receiptPath: string;
        } | {
            available: boolean;
            attempted: boolean | undefined;
            reason: string;
            implementationId: string;
            receiptPath: string | undefined;
            status?: undefined;
            scope?: undefined;
        } | {
            available: boolean;
            attempted: boolean;
            reason?: undefined;
            implementationId?: undefined;
            status?: undefined;
            scope?: undefined;
            receiptPath?: undefined;
        } | {
            available: boolean;
            attempted: boolean | undefined;
            reason: string | undefined;
            implementationId?: undefined;
            status?: undefined;
            scope?: undefined;
            receiptPath?: undefined;
        }>;
        getBrowserBootstrapStatus: () => {
            available: boolean;
            attempted?: boolean;
            cachePath?: string;
            version?: string;
            executablePath?: string;
            reason?: string;
        } | undefined;
        getBrowserToolReceipt: () => import("../../contracts/operational-tool.js").OperationalToolProvisioningReceipt | undefined;
        getEcosystemView: (selectedMcpServers?: readonly string[]) => import("../ecosystem/runtime.js").EcosystemIntegrationView;
        operationalTools: import("../tools/provisioning.js").OperationalToolProvisioner;
        previewManager: import("../browser/local-preview.js").LocalPreviewManager;
        scopedStores: import("./runtime-scoped-stores.js").RuntimeScopedStores;
    };
    projectRoot: string;
    workingDirectory: string;
    packagedSkillsDir: string;
    projectAuthority: ProjectAuthorityStore;
    toolSurface: Record<string, unknown>;
    eventController: RuntimeEventController;
    instanceLease: RuntimeInstanceLease;
}>;
