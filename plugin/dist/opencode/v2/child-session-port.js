function modelRef(model, variant) { if (!model)
    return undefined; const i = model.indexOf('/'); if (i <= 0 || i === model.length - 1)
    return undefined; return { providerID: model.slice(0, i), id: model.slice(i + 1), ...(variant ? { variant } : {}) }; }
export function createV2ChildSessionPort(ctx, facts) {
    return {
        capabilities: { create: typeof ctx.session.create === 'function', prompt: typeof ctx.session.prompt === 'function', abort: typeof ctx.session.interrupt === 'function', status: typeof ctx.session.get === 'function', diff: false, summarize: false, fork: false, structuredOutput: false },
        async create(request) { const location = request.workspace ? { directory: request.workspace.directory, workspaceID: request.workspace.workspaceID } : { directory: ctx.location.directory, ...(ctx.location.workspaceID ? { workspaceID: ctx.location.workspaceID } : {}) }; const child = await ctx.session.create({ title: request.title, agent: request.role, model: modelRef(request.model, request.variant), location, metadata: { hi_parent_session_id: request.parentSessionID, hi_role: request.role } }); const id = String(child?.id ?? ''); if (!id)
            throw new Error('OpenCode V2 session.create returned no child session id'); facts.status.set(id, 'idle'); return { child: { id, workspaceID: child?.location?.workspaceID ?? location.workspaceID, directory: child?.location?.directory ?? location.directory }, fork: { requested: Boolean(request.forkFromSession), nativeAvailable: false, used: false, ...(request.forkFromSession ? { reason: 'V2 Promise plugin context does not expose session fork' } : {}) } }; },
        async prompt(sessionID, text, role, model, variant, tools, messageID, format) { if (model && ctx.session.switchModel)
            await ctx.session.switchModel({ sessionID, model: modelRef(model, variant) }); if (role && ctx.session.switchAgent)
            await ctx.session.switchAgent({ sessionID, agent: role }); facts.status.set(sessionID, 'busy'); return ctx.session.prompt({ sessionID, ...(messageID ? { id: messageID } : {}), text, delivery: 'queue', resume: true, metadata: { hi_tools: tools ?? {}, hi_format: format?.type ?? 'text' } }); },
        async abort(sessionID) { try {
            await ctx.session.interrupt({ sessionID, continue: false });
            facts.status.set(sessionID, 'idle');
            return 'client';
        }
        catch {
            return 'unavailable';
        } },
        async status(sessionID) { const cached = facts.status.get(sessionID); try {
            const s = await ctx.session.get({ sessionID });
            if (s?.outcome || s?.time?.idle) {
                facts.status.set(sessionID, 'idle');
                return 'idle';
            }
            return cached ?? 'unknown';
        }
        catch {
            return cached ?? 'unknown';
        } },
        async diff() { throw new Error('UNSUPPORTED_CAPABILITY: OpenCode V2 Promise context does not expose native session diff'); }, async summarize() { throw new Error('UNSUPPORTED_CAPABILITY: OpenCode V2 Promise context does not expose native summarize'); }
    };
}
