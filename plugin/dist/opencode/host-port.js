import { normalizeModelCapabilityProfile } from '../contracts/model.js';
import { detectOpenCodeCapabilities } from './capabilities.js';
import { NativeOpenCodeAdapter } from './native-adapter.js';
import { lastAssistantModel, lastAssistantText, listMessages, listProviders, sendSyntheticContinuation } from './client-adapter.js';
function providerModels(raw) {
    const edge = raw;
    const root = edge?.all ?? edge?.providers ?? edge ?? [];
    const providers = Array.isArray(root) ? root : Object.values(root ?? {});
    const connectedRaw = Array.isArray(edge?.connected) ? edge.connected : undefined;
    const connected = connectedRaw ? new Set(connectedRaw.map((x) => typeof x === 'string' ? x : String(x?.id ?? x?.providerID ?? x?.name ?? '')).filter(Boolean)) : undefined;
    const out = [];
    for (const p of providers) {
        const pid = p?.id ?? p?.providerID ?? p?.name;
        const provider = pid ? String(pid) : undefined;
        if (connected && provider && !connected.has(provider))
            continue;
        const models = p?.models ?? p?.model ?? [];
        const list = Array.isArray(models) ? models : Object.values(models ?? {});
        for (const model of list) {
            const id = model?.id ?? model?.modelID ?? model?.name;
            if (!id)
                continue;
            const rawID = String(id);
            const canonical = provider && !rawID.startsWith(`${provider}/`) ? `${provider}/${rawID}` : rawID;
            const variantsRaw = model?.variants ?? model?.variant;
            const variants = Array.isArray(variantsRaw) ? variantsRaw.map(String) : (variantsRaw && typeof variantsRaw === 'object' ? Object.keys(variantsRaw) : []);
            out.push(normalizeModelCapabilityProfile({ id: canonical, provider, cost: Number(model?.cost?.input ?? model?.cost ?? 0) || 0, quality: Number(model?.quality ?? 0) || 0, writeCapable: model?.write !== false, tags: Array.isArray(model?.tags) ? model.tags.map(String) : [], variants }, 'runtime-inventory', `provider:${provider ?? 'unknown'}/${canonical}`));
        }
    }
    return out;
}
export function createHostPort(ctx) {
    const capabilities = detectOpenCodeCapabilities(ctx.client);
    const native = new NativeOpenCodeAdapter(ctx.client);
    let models = [];
    let inventoryRefresh;
    const log = async (level, message, extra) => { try {
        await ctx.client?.app?.log?.({ body: { service: 'hi', level, message, extra } });
    }
    catch { } };
    const refreshRuntimeInventory = async (reason) => {
        if (inventoryRefresh)
            return inventoryRefresh;
        inventoryRefresh = (async () => { try {
            const raw = await listProviders(ctx.client);
            models = providerModels(raw);
            await log('info', 'Hi runtime inventory refreshed', { reason, models: models.length });
            return models.length;
        }
        catch (error) {
            await log('warn', 'Hi runtime inventory refresh failed', { reason, error: String(error) });
            return models.length;
        }
        finally {
            inventoryRefresh = undefined;
        } })();
        return inventoryRefresh;
    };
    const readAssistantResult = async (sessionID, limit = 12) => { const messages = await listMessages(ctx.client, sessionID, limit); return { text: lastAssistantText(messages), model: lastAssistantModel(messages) }; };
    const continueSession = (sessionID, text, metadata) => sendSyntheticContinuation(ctx.client, sessionID, text, metadata);
    return { capabilities, nativeSession: { diff: (sessionID) => native.diff(sessionID), revert: (sessionID, messageID) => native.revert(sessionID, messageID) }, log, refreshRuntimeInventory, getModels: () => models, readAssistantResult, continueSession };
}
