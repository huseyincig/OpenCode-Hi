import type { HiConfig } from '../../config/schema.js';
import type { AvailableModel } from '../routing/model-resolver.js';
import type { RuntimeSignalSink } from '../events/event-sink.js';
import type { NativeProjectContext } from '../intent/repo-context.js';
import type { ChildSessionPort, HostAssistantResult } from '../host/port.js';
import type { HostCapabilityContract } from '../../contracts/host-capability.js';
import type { ProcessExecutor } from '../process/executor.js';
import type { WorkspaceExecutor } from '../workspace/executor.js';
import type { BrowserExecutor, BrowserExecutionContext } from '../browser/executor.js';
import { OperationalToolProvisioner } from '../tools/provisioning.js';
import type { OperationalToolProvisioningReceipt } from '../../contracts/operational-tool.js';
import { MissionStore } from '../mission/mission-store.js';
import { BackgroundRegistry } from '../background/registry.js';
import { RuntimePersistence } from '../state/persistence.js';
import { TaskRuntime } from '../task/task-runtime.js';
import { ProcessRuntime } from '../process/runtime.js';
import { WorkspaceRuntime } from '../workspace/runtime.js';
import { ChatHumanDecisionTransport } from '../human-decision/transport.js';
import { LocalPreviewManager } from '../browser/local-preview.js';
export interface RuntimeServicePorts {
    nativeContext: NativeProjectContext;
    childSession: ChildSessionPort;
    readAssistantResult?: (sessionID: string, limit?: number) => Promise<HostAssistantResult>;
    hostCapabilities: readonly HostCapabilityContract[];
    process: ProcessExecutor;
    workspace: WorkspaceExecutor;
    createBrowser: (persist: (bytes: Uint8Array, context: BrowserExecutionContext) => string) => BrowserExecutor;
    bootstrapBrowser?: () => Promise<{
        available: boolean;
        attempted?: boolean;
        cachePath?: string;
        version?: string;
        executablePath?: string;
        reason?: string;
    }>;
    browserTool?: {
        implementationId: string;
        version?: string;
        cachePath: string;
        discover: () => string | undefined;
    };
    onBrowserAvailability?: (available: boolean) => void;
}
export declare function createRuntimeServices(input: {
    ports: RuntimeServicePorts;
    projectRoot: string;
    packageRoot: string;
    getConfig: () => HiConfig;
    getModels: () => AvailableModel[];
    getHostConfig: () => Record<string, unknown>;
}): {
    store: MissionStore;
    background: BackgroundRegistry;
    humanDecisionTransport: ChatHumanDecisionTransport;
    persistence: RuntimePersistence;
    scheduler: import("../scheduler/concurrency.js").ConcurrencyPolicySource;
    eventSink: RuntimeSignalSink;
    tasks: TaskRuntime;
    processExecutor: ProcessExecutor;
    processRuntime: ProcessRuntime;
    workspaceExecutor: WorkspaceExecutor;
    workspaceRuntime: WorkspaceRuntime;
    browserExecutor: BrowserExecutor;
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
    getBrowserToolReceipt: () => OperationalToolProvisioningReceipt | undefined;
    getEcosystemView: (selectedMcpServers?: readonly string[]) => import("../ecosystem/runtime.js").EcosystemIntegrationView;
    operationalTools: OperationalToolProvisioner;
    previewManager: LocalPreviewManager;
    scopedStores: import("./runtime-scoped-stores.js").RuntimeScopedStores;
};
