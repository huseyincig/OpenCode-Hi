import { resolveHiConfigWithReport } from '../config/resolver.js';
import { PACKAGED_HI_AGENTS } from '../generated/agent-config.js';
import { projectHiOpenCodeComposition } from './composition-adapter.js';
import { createChatMessageHook } from '../hooks/chat-message.js';
import { createMessagesTransformHook } from '../hooks/messages-transform.js';
import { createSystemTransformHook } from '../hooks/system-transform.js';
import { createToolBeforeHook } from '../hooks/tool-before.js';
import { createToolAfterHook } from '../hooks/tool-after.js';
import { appendLedger } from '../runtime/ledger/ledger.js';
import { normalizeOpenCodeEvent } from './event-adapter.js';
import { ExperimentalOpenCodeAdapter } from './experimental-adapter.js';
import { syncHumanDecisionTransport } from '../runtime/human-decision/transport.js';
export function createOpenCodeHooks(input) {
    const { state, host, services, projectRoot, packagedSkillsDir, projectAuthority, toolSurface, reconfigureToolSurface, eventController, instanceLease } = input;
    const { store, background, humanDecisionTransport, persistence, tasks, teams, processRuntime, browserRuntime, eventSink } = services;
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
            services.scopedStores.skillCatalog.refresh(opencodeConfig);
            reconfigureToolSurface();
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
                return; const teamsPaused = teams.adoptSemanticGeneration(m), workersPaused = await tasks.pauseForSemanticAssessment(m); appendLedger(m, 'semantic.execution-quarantined', { payload: { revision: m.identity.semantic_assessment.revision, workers: workersPaused, teams: teamsPaused, preview: text.slice(0, 180) } }); }, humanDecisionTransport)(input, output);
        }
        finally {
            for (const m of store.all())
                syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport);
            persistence.save(store.all());
        } },
        'experimental.chat.messages.transform': createMessagesTransformHook(store, background),
        'experimental.chat.system.transform': createSystemTransformHook(store, background, projectRoot),
        'experimental.session.compacting': async (input, output) => { try {
            await experimental.compacting()(input, output);
        }
        finally {
            persistence.save(store.all());
        } },
        'tool.execute.before': async (input, output) => { try {
            await createToolBeforeHook(store, background, projectRoot)(input, output);
        }
        finally {
            for (const m of store.all())
                syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport);
            persistence.save(store.all());
        } },
        'tool.execute.after': async (input, output) => { try {
            await createToolAfterHook(store, background, eventSink, projectRoot)(input, output);
        }
        finally {
            for (const m of store.all())
                syncHumanDecisionTransport(m.authority.human_decision, humanDecisionTransport);
            persistence.save(store.all());
        } },
        dispose: async () => { try {
            for (const m of store.all())
                if (m.identity.status === 'active') {
                    store.stop(m.identity.session_id, 'plugin-dispose');
                    await processRuntime.stopMission(m);
                    await teams.shutdownMission(m);
                    await tasks.cancelAll(m);
                }
            await browserRuntime.dispose();
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
