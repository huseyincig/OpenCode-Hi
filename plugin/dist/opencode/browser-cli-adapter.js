import { createHash } from 'node:crypto';
import { browserObservationId } from '../contracts/browser-observation.js';
const MAX_OUTPUT = 4000;
function bounded(value, max = MAX_OUTPUT) { return value.length <= max ? value : value.slice(0, max); }
function validTarget(value) { return /^@e\d{1,6}$/.test(value); }
function safeUrl(value, allowed) {
    let u;
    try {
        u = new URL(value);
    }
    catch {
        throw new Error('Browser URL must be absolute http(s)');
    }
    if (!['http:', 'https:'].includes(u.protocol))
        throw new Error('Browser URL must use http(s)');
    if (!allowed.has(u.origin))
        throw new Error(`Browser target origin is outside configured scope: ${u.origin}`);
    u.username = '';
    u.password = '';
    return u.toString();
}
function documentIdentity(text) { return createHash('sha256').update(text).digest('hex'); }
export class BrowserCliAdapter {
    runner;
    cwd;
    executable;
    sessionId;
    allowedOrigins;
    timeoutMs;
    currentUrl;
    constructor(options) {
        if (!options.session_id.trim() || options.session_id.length > 160)
            throw new Error('Browser session_id is required and bounded');
        if (!options.allowed_origins.length)
            throw new Error('Browser allowed_origins cannot be empty');
        this.runner = options.runner;
        this.cwd = options.cwd;
        this.executable = options.executable ?? 'agent-browser';
        this.sessionId = options.session_id;
        this.timeoutMs = options.timeout_ms ?? 30000;
        this.allowedOrigins = new Set(options.allowed_origins.map(x => new URL(x).origin));
    }
    async command(context, action, args, url, successSummary) {
        const timestamp = Date.now();
        const r = await this.runner.run([this.executable, ...args], { cwd: this.cwd, timeout_ms: this.timeoutMs, env: { AGENT_BROWSER_SESSION: this.sessionId } });
        const raw = bounded((r.stdout || r.stderr || '').trim());
        const ok = r.exit_code === 0;
        const result = ok ? 'OBSERVED' : 'FAILED';
        const obs = {
            observation_id: '', task_id: context.task_id, executor_version: context.executor_version, url, action, timestamp,
            ...(ok ? { document_identity: documentIdentity(raw || successSummary || action), dom_summary: bounded(raw || successSummary || action) } : {}),
            console_errors: [], network_errors: ok ? [] : [bounded(r.stderr || r.stdout || `browser command exited ${r.exit_code}`, 1000)],
            ...(action === 'screenshot' && ok && context.screenshot_artifact_ref ? { screenshot_artifact_ref: context.screenshot_artifact_ref } : {}),
            result
        };
        if (action === 'screenshot' && ok && !context.screenshot_artifact_ref) {
            obs.result = 'FAILED';
            obs.document_identity = undefined;
            obs.dom_summary = undefined;
            obs.network_errors = ['screenshot output requires canonical artifact binding before observation can succeed'];
        }
        obs.observation_id = browserObservationId(obs);
        return obs;
    }
    async health() {
        const r = await this.runner.run([this.executable, '--version'], { cwd: this.cwd, timeout_ms: 5000, env: { AGENT_BROWSER_SESSION: this.sessionId } });
        const text = bounded((r.stdout || r.stderr || '').trim(), 160);
        return r.exit_code === 0 ? { available: true, version: text || 'observed' } : { available: false, reason: text || `exit ${r.exit_code}` };
    }
    async open(c, url) { const u = safeUrl(url, this.allowedOrigins); const o = await this.command(c, 'open', ['open', u], u); if (o.result === 'OBSERVED')
        this.currentUrl = u; return o; }
    async navigate(c, url) { const u = safeUrl(url, this.allowedOrigins); const o = await this.command(c, 'navigate', ['navigate', u], u); if (o.result === 'OBSERVED')
        this.currentUrl = u; return o; }
    async click(c, target) { if (!this.currentUrl)
        throw new Error('Browser session has no active URL'); if (!validTarget(target.value))
        throw new Error('Browser click target must be an observed @eN reference'); return this.command(c, 'click', ['click', target.value], this.currentUrl); }
    async type(c, target, value) { if (!this.currentUrl)
        throw new Error('Browser session has no active URL'); if (!validTarget(target.value))
        throw new Error('Browser type target must be an observed @eN reference'); if (!value || value.length > 2000)
        throw new Error('Browser type value is required and bounded'); return this.command(c, 'type', ['type', target.value, value], this.currentUrl); }
    async inspect(c, request = {}) { if (!this.currentUrl)
        throw new Error('Browser session has no active URL'); if (request.selector)
        throw new Error('Browser CLI adapter does not claim selector-scoped inspect support'); return this.command(c, 'inspect', ['snapshot'], this.currentUrl); }
    async screenshot(c) { if (!this.currentUrl)
        throw new Error('Browser session has no active URL'); return this.command(c, 'screenshot', ['screenshot'], this.currentUrl); }
    async wait(c, request) { if (!this.currentUrl)
        throw new Error('Browser session has no active URL'); if (!Number.isInteger(request.milliseconds) || request.milliseconds < 0 || request.milliseconds > 30000)
        throw new Error('Browser wait must be 0..30000ms'); return this.command(c, 'wait', ['wait', String(request.milliseconds)], this.currentUrl, `waited ${request.milliseconds}ms`); }
    async close(c) { if (!this.currentUrl)
        throw new Error('Browser session has no active URL'); const url = this.currentUrl; const o = await this.command(c, 'close', ['close'], url, 'browser session closed'); if (o.result === 'OBSERVED')
        this.currentUrl = undefined; return o; }
}
