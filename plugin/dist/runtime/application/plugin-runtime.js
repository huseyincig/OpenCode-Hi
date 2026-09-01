import { DEFAULT_HI_CONFIG } from '../../config/defaults.js';
import { ProjectAuthorityStore } from '../safety/project-authority.js';
import { createRuntimeServices } from './runtime-services.js';
import { createHiToolSurface } from './hi-tool-surface.js';
import { RuntimeEventController } from './runtime-event-controller.js';
import { PlaywrightBrowserAdapter } from '../../opencode/playwright-browser-adapter.js';
import { PlaywrightBrowserBootstrap } from '../browser/bootstrap.js';
import { discoverPlaywrightChromium } from '../browser/discovery.js';
/** Host-generation-neutral application composition. Concrete OpenCode lifecycle/API shapes are supplied by edge adapters. */
export async function createHiRuntime(input) {
    const { packageRoot, packagedSkillsDir, projectRoot, workingDirectory, nativeContext, host, childSession, processExecutor, workspaceExecutor, ownedCapabilities, instanceLease, projectMemoryProvider } = input;
    const state = { config: DEFAULT_HI_CONFIG, hostConfig: {} };
    const projectAuthority = new ProjectAuthorityStore(projectRoot);
    const browserBootstrap = new PlaywrightBrowserBootstrap({ package_root: packageRoot, project_root: projectRoot });
    const services = createRuntimeServices({ ports: { nativeContext, childSession, readAssistantResult: host.readAssistantResult, hostCapabilities: host.capabilities.contracts, process: processExecutor, workspace: workspaceExecutor, createBrowser: persist => new PlaywrightBrowserAdapter({ persist_screenshot: persist, browser_cache_paths: [browserBootstrap.cachePath] }), bootstrapBrowser: () => browserBootstrap.ensure(), browserTool: { implementationId: 'playwright-chromium', version: browserBootstrap.version, cachePath: browserBootstrap.cachePath, discover: () => discoverPlaywrightChromium(undefined, [browserBootstrap.cachePath]) }, onBrowserAvailability: ownedCapabilities.setBrowserAvailable }, projectRoot, packageRoot, getConfig: () => state.config, getModels: host.getModels, getHostConfig: () => state.hostConfig, projectMemoryProvider });
    await services.workspaceRuntime.reconcileRestored(services.store.all());
    await services.processRuntime.reconcileRestored(services.store.all());
    const browserHealth = { available: false, reason: 'not-probed-during-initialization; browser execution is health-checked lazily on task/doctor demand' };
    services.tasks.rehydrateQueued(services.store.all());
    setTimeout(() => { void Promise.all([ownedCapabilities.observe('process-lifecycle'), ownedCapabilities.observe('workspace-isolation-binding')]).catch(() => { }); }, 0);
    services.persistence.save(services.store.all());
    const pendingNativePermissions = new Map();
    const eventController = new RuntimeEventController({ state, host, services, projectAuthority, pendingNativePermissions, projectRoot });
    const { toolSurface } = createHiToolSurface({ state, store: services.store, tasks: services.tasks, processRuntime: services.processRuntime, workspaceRuntime: services.workspaceRuntime, browserExecutor: services.browserExecutor, previewManager: services.previewManager, projectRoot, workingDirectory, capabilities: host.capabilities, native: host.nativeSession, getModels: host.getModels, refreshModels: host.refreshRuntimeInventory, refreshOwnedHostCapability: ownedCapabilities.observe, scopedStores: services.scopedStores, getBrowserBootstrapStatus: services.getBrowserBootstrapStatus, getBrowserToolReceipt: services.getBrowserToolReceipt, getEcosystemView: services.getEcosystemView });
    void host.log('info', 'OpenCode-Hi runtime initialized', { directory: workingDirectory, models: host.getModels().length, restored: services.store.all().length, uncleanShutdown: services.persistence.lastLoadReport.uncleanShutdown === true, capabilities: host.capabilities, browser: browserHealth });
    return { state, host, services, projectRoot, workingDirectory, packagedSkillsDir, projectAuthority, toolSurface, eventController, instanceLease };
}
