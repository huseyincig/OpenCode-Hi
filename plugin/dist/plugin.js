import { DEFAULT_HI_CONFIG } from './config/defaults.js';
import { resolveNativeProjectRoot } from './runtime/intent/repo-context.js';
import { ProjectAuthorityStore } from './runtime/safety/project-authority.js';
import { acquireHiRuntimeInstance } from './opencode/instance-guard.js';
import { runtimeInstanceLockPath } from './runtime/storage/locations.js';
import { createHostPort } from './opencode/host-port.js';
import { createRuntimeServices } from './runtime/application/runtime-services.js';
import { createHiToolSurface } from './runtime/application/hi-tool-surface.js';
import { RuntimeEventController } from './runtime/application/runtime-event-controller.js';
import { createOpenCodeHooks } from './opencode/open-code-hooks.js';
import { createOpenCodeChildSessionPort } from './opencode/child-session-port.js';
import { createOwnedCapabilityObserver } from './opencode/capabilities.js';
import { OpenCodePtyAdapter } from './opencode/open-code-pty-adapter.js';
import { OpenCodeWorkspaceAdapter } from './opencode/open-code-workspace-adapter.js';
import { PlaywrightBrowserAdapter } from './opencode/playwright-browser-adapter.js';
import { PlaywrightBrowserBootstrap } from './runtime/browser/bootstrap.js';
import { discoverPlaywrightChromium } from './runtime/browser/discovery.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const HiPlugin = async (ctx) => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const packagedSkillsDir = resolve(packageRoot, 'skills');
    const projectRoot = resolveNativeProjectRoot(process.cwd(), { project: ctx.project, directory: ctx.directory, worktree: ctx.worktree });
    const instanceLease = acquireHiRuntimeInstance(String(projectRoot), ctx.client, { lockPath: runtimeInstanceLockPath(projectRoot) });
    try {
        const state = { config: DEFAULT_HI_CONFIG, hostConfig: {} };
        const host = createHostPort(ctx);
        const projectAuthority = new ProjectAuthorityStore(projectRoot);
        const childSession = createOpenCodeChildSessionPort(ctx.client, { serverUrl: ctx.serverUrl?.toString?.(), directory: ctx.directory });
        const processExecutor = new OpenCodePtyAdapter(ctx.client, ctx.serverUrl, ctx.directory, projectRoot, () => state.hostConfig);
        const workspaceExecutor = new OpenCodeWorkspaceAdapter(ctx.client, ctx.serverUrl, ctx.directory);
        const browserBootstrap = new PlaywrightBrowserBootstrap({ package_root: packageRoot, project_root: projectRoot });
        const ownedCapabilities = createOwnedCapabilityObserver(ctx.client, host.capabilities.contracts, processExecutor, workspaceExecutor);
        const services = createRuntimeServices({ ports: { nativeContext: { project: ctx.project, directory: ctx.directory, worktree: ctx.worktree }, childSession, readAssistantResult: host.readAssistantResult, hostCapabilities: host.capabilities.contracts, process: processExecutor, workspace: workspaceExecutor, createBrowser: persist => new PlaywrightBrowserAdapter({ persist_screenshot: persist, browser_cache_paths: [browserBootstrap.cachePath] }), bootstrapBrowser: () => browserBootstrap.ensure(), browserTool: { implementationId: 'playwright-chromium', version: browserBootstrap.version, cachePath: browserBootstrap.cachePath, discover: () => discoverPlaywrightChromium(undefined, [browserBootstrap.cachePath]) }, onBrowserAvailability: ownedCapabilities.setBrowserAvailable }, projectRoot, packageRoot, getConfig: () => state.config, getModels: host.getModels, getHostConfig: () => state.hostConfig });
        await services.workspaceRuntime.reconcileRestored(services.store.all());
        await services.processRuntime.reconcileRestored(services.store.all());
        const browserHealth = await services.browserExecutor.health();
        services.setBrowserAvailable(browserHealth.available);
        ownedCapabilities.setBrowserAvailable(browserHealth.available);
        services.tasks.rehydrateQueued(services.store.all());
        setTimeout(() => { void Promise.all([ownedCapabilities.observe('process-lifecycle'), ownedCapabilities.observe('workspace-isolation-binding')]).catch(() => { }); }, 0);
        services.persistence.save(services.store.all());
        const pendingNativePermissions = new Map();
        const eventController = new RuntimeEventController({ state, host, services, projectAuthority, pendingNativePermissions, projectRoot });
        const { toolSurface } = createHiToolSurface({ state, store: services.store, tasks: services.tasks, processRuntime: services.processRuntime, workspaceRuntime: services.workspaceRuntime, browserExecutor: services.browserExecutor, previewManager: services.previewManager, projectRoot, workingDirectory: ctx.directory, capabilities: host.capabilities, native: host.nativeSession, getModels: host.getModels, refreshModels: host.refreshRuntimeInventory, refreshOwnedHostCapability: ownedCapabilities.observe, scopedStores: services.scopedStores, getBrowserBootstrapStatus: services.getBrowserBootstrapStatus, getBrowserToolReceipt: services.getBrowserToolReceipt });
        void host.log('info', 'OpenCode-Hi plugin initialized', { directory: ctx.directory, models: host.getModels().length, restored: services.store.all().length, uncleanShutdown: services.persistence.lastLoadReport.uncleanShutdown === true, capabilities: host.capabilities, browser: browserHealth });
        return createOpenCodeHooks({ state, host, services, projectRoot, workingDirectory: ctx.directory, packagedSkillsDir, projectAuthority, toolSurface, eventController, instanceLease });
    }
    catch (error) {
        instanceLease.release();
        throw error;
    }
};
export default HiPlugin;
