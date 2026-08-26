import { resolveHiConfigWithReport } from '../config/resolver.js';
import { hasProjectSettings } from '../config/project-settings.js';
import { PACKAGED_HI_AGENTS } from '../generated/agent-config.js';
import { projectHiOpenCodeComposition } from './composition-adapter.js';
import { createChatMessageHook } from '../hooks/chat-message.js';
import { createMessagesTransformHook } from '../hooks/messages-transform.js';
import { createSystemTransformHook } from '../hooks/system-transform.js';
import { createToolBeforeHook } from '../hooks/tool-before.js';
import { createToolAfterHook } from '../hooks/tool-after.js';
import { createTextCompleteHook } from '../hooks/text-complete.js';
import { appendLedger } from '../runtime/ledger/ledger.js';
import { normalizeOpenCodeEvent } from './event-adapter.js';
import { ExperimentalOpenCodeAdapter } from './experimental-adapter.js';
import { syncHumanDecisionTransport } from '../runtime/human-decision/transport.js';
export function createOpenCodeHooks(input) {
    const { state, host, services, projectRoot, workingDirectory, packagedSkillsDir, projectAuthority, toolSurface, eventController, instanceLease } = input;
    const { store, background, humanDecisionTransport, persistence, tasks, processRuntime, browserExecutor, previewManager, eventSink } = services;
    const experimental = new ExperimentalOpenCodeAdapter(store, background);
    return {
        name: 'opencode-hi',
        tool: toolSurface,
        config: async (opencodeConfig) => {
            state.hostConfig = opencodeConfig;
            const resolved = resolveHiConfigWithReport(opencodeConfig.hi, projectRoot);
            state.config = resolved.config;
            state.configResolution = resolved.report;
            const composition = projectHiOpenCodeComposition({ config: opencodeConfig, packagedAgents: PACKAGED_HI_AGENTS, packagedSkillsDir, projectRoot, projectAuthority });
            if (!composition.applied)
                throw new Error(`OpenCode-Hi host composition adapter unavailable for ${composition.mode}: ${composition.diagnostics.join(', ')}. V1 config projection is intentionally not applied to V2/mixed config shapes.`);
            const projection = composition.v1;
            if (projection.agentProjection.collisions.length)
                throw new Error(`OpenCode-Hi agent binding collision: ${projection.agentProjection.collisions.join(', ')}. Canonical Hi role names may be narrowed by host policy, but execution-semantic widening/overrides require a distinct agent namespace.`);
            opencodeConfig.hi = state.config;
        },
        'chat.message': async (input, output) => { try {
            const messageSession = String(input?.sessionID ?? input?.sessionId ?? '');
            if (messageSession && background.list().some((w) => w.session_id === messageSession)) {
                await host.log('debug', 'Hi child chat message ignored by parent intent hook', { session_id: messageSession });
                return;
            }
            if (!host.getModels().length)
                void host.refreshRuntimeInventory('chat-message');
            await createChatMessageHook(store, async (sid, text) => { const m = store.get(sid); if (!m)
                return; const workersPaused = await tasks.pauseForSemanticAssessment(m); appendLedger(m, 'semantic.execution-quarantined', { payload: { revision: m.identity.semantic_assessment.revision, workers: workersPaused, preview: text.slice(0, 180) } }); }, humanDecisionTransport)(input, output);
            tasks.wakeQueued();
        }
        finally {
            for (const m of store.all())
                syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport);
            persistence.save(store.all());
        } },
        'experimental.chat.messages.transform': createMessagesTransformHook(store, background),
        'experimental.chat.system.transform': createSystemTransformHook(store, background, projectRoot, workingDirectory, () => ({ pending: !hasProjectSettings(projectRoot), modelCount: host.getModels().length })),
        'experimental.text.complete': async (input, output) => { try {
            await createTextCompleteHook(store, background, projectRoot)(input, output);
        }
        finally {
            persistence.save(store.all());
        } },
        'experimental.session.compacting': async (input, output) => { try {
            await experimental.compacting()(input, output);
        }
        finally {
            persistence.save(store.all());
        } },
        'tool.execute.before': async (input, output) => { try {
            await createToolBeforeHook(store, background, projectRoot, workingDirectory)(input, output);
        }
        finally {
            for (const m of store.all())
                syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport);
            persistence.save(store.all());
        } },
        'tool.execute.after': async (input, output) => { try {
            await createToolAfterHook(store, background, eventSink, projectRoot, workingDirectory)(input, output);
        }
        finally {
            for (const m of store.all()) {
                if (['stopped', 'completed'].includes(m.identity.status))
                    eventController.clearNativePermissionsForMission(m);
                syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport);
            }
            persistence.save(store.all());
        } },
        dispose: async () => { try {
            for (const m of store.all())
                if (['active', 'waiting-user'].includes(m.identity.status)) {
                    await processRuntime.stopMission(m);
                    appendLedger(m, 'runtime.plugin-disposed', { payload: { mission_status: m.identity.status, durable_mission_preserved: true, semantic_stop: false } });
                }
            humanDecisionTransport.dispose();
            eventController.clearAllNativePermissions();
            const browserDisposable = browserExecutor;
            if (browserDisposable.dispose)
                await browserDisposable.dispose();
            await previewManager.dispose();
            persistence.markCleanShutdown(store.all());
        }
        finally {
            instanceLease.release();
        } },
        event: async (input) => { try {
            await eventController.handle(normalizeOpenCodeEvent(input?.event ?? input));
        }
        finally {
            for (const m of store.all())
                syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport);
        } },
    };
}
