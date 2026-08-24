import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { browserObservationId } from '../contracts/browser-observation.js';
import { discoverPlaywrightChromium } from '../runtime/browser/discovery.js';
export { discoverPlaywrightChromium } from '../runtime/browser/discovery.js';
const MAX_SUMMARY = 4000, MAX_ERRORS = 64, BROWSER_CLOSE_TIMEOUT_MS = 2000;
function bounded(v, max = MAX_SUMMARY) { return v.length <= max ? v : v.slice(0, max); }
async function boundedBrowserClose(browser, timeoutMs = BROWSER_CLOSE_TIMEOUT_MS) {
    let timer;
    try {
        await Promise.race([Promise.resolve().then(() => browser.close()), new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`Playwright browser.close timed out after ${timeoutMs}ms`)), timeoutMs); })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
function localHost(hostname) { return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'; }
function safeLocalUrl(value) { let u; try {
    u = new URL(value);
}
catch {
    throw new Error('Browser URL must be absolute http(s)');
} if (!['http:', 'https:'].includes(u.protocol))
    throw new Error('Browser URL must use http(s)'); if (u.username || u.password)
    throw new Error('Browser credentials in URL are forbidden'); if (!localHost(u.hostname))
    throw new Error(`Browser target is outside supported local scope: ${u.origin}`); return u.toString(); }
function plannedUrl(c, value) { const url = safeLocalUrl(value), origin = new URL(url).origin, allowed = new Set(c.allowed_origins ?? []); if (!allowed.size)
    throw new Error('Browser task has no allowed-origin plan'); if (!allowed.has(origin))
    throw new Error(`Browser target origin is outside the task plan: ${origin}`); return url; }
function targetRef(value) { const m = /^@e(\d{1,6})$/.exec(value); if (!m)
    throw new Error('Browser target must be an observed @eN reference'); return Number(m[1]); }
function sha(text) { return createHash('sha256').update(text).digest('hex'); }
export class PlaywrightBrowserAdapter {
    executablePath;
    explicitExecutable;
    browserCachePaths;
    headless;
    timeoutMs;
    persistScreenshot;
    loadPlaywright;
    executableExists;
    sessions = new Map();
    constructor(options = {}) { this.executableExists = options.executable_exists ?? existsSync; this.explicitExecutable = Boolean(options.executable_path); this.browserCachePaths = [...new Set(options.browser_cache_paths ?? [])]; this.executablePath = options.executable_path ?? discoverPlaywrightChromium(this.executableExists, this.browserCachePaths); this.headless = options.headless ?? true; this.timeoutMs = Math.min(Math.max(options.timeout_ms ?? 15000, 1000), 30000); this.persistScreenshot = options.persist_screenshot; this.loadPlaywright = options.load_playwright ?? (() => import('playwright-core')); }
    refreshExecutable() { if (this.executablePath && this.executableExists(this.executablePath))
        return this.executablePath; if (this.explicitExecutable)
        return undefined; this.executablePath = discoverPlaywrightChromium(this.executableExists, this.browserCachePaths); return this.executablePath; }
    async ensure(c) { const current = this.sessions.get(c.task_id); if (current && current.executionOwnerRef === c.execution_owner_ref)
        return current; if (current) {
        try {
            await boundedBrowserClose(current.browser);
        }
        catch { }
        this.sessions.delete(c.task_id);
    } if (!c.execution_owner_ref.trim())
        throw new Error('Browser execution owner identity is required'); const executablePath = this.refreshExecutable(); if (!executablePath)
        throw new Error('Playwright Chromium executable is unavailable'); const { chromium } = await this.loadPlaywright(), browser = await chromium.launch({ executablePath, headless: this.headless, args: ['--no-sandbox'] }), context = await browser.newContext({ acceptDownloads: false, ignoreHTTPSErrors: false }); if (typeof context.route !== 'function')
        throw new Error('Playwright request routing is required for browser origin confinement'); await context.route('**/*', async (route) => { try {
        plannedUrl(c, String(route.request().url()));
        await route.continue();
    }
    catch {
        await route.abort('blockedbyclient');
    } }); const page = await context.newPage(), s = { browser, page, refs: new Map(), consoleErrors: [], networkErrors: [], executionOwnerRef: c.execution_owner_ref }; page.setDefaultTimeout(this.timeoutMs); page.on('console', (msg) => { if (msg.type() === 'error')
        s.consoleErrors.push(bounded(String(msg.text()), 1000)); if (s.consoleErrors.length > MAX_ERRORS)
        s.consoleErrors.splice(0, s.consoleErrors.length - MAX_ERRORS); }); page.on('requestfailed', (req) => { s.networkErrors.push(bounded(`${req.method()} ${req.url()} ${req.failure()?.errorText ?? 'failed'}`, 1000)); if (s.networkErrors.length > MAX_ERRORS)
        s.networkErrors.splice(0, s.networkErrors.length - MAX_ERRORS); }); page.on('download', (download) => void download.cancel().catch(() => { })); this.sessions.set(c.task_id, s); return s; }
    observation(c, s, action, url, result, dom, screenshotRef, error) { const timestamp = Date.now(), doc = dom ? sha(dom) : undefined, console_errors = s?.consoleErrors.slice(-MAX_ERRORS) ?? [], network_errors = [...(s?.networkErrors.slice(-MAX_ERRORS) ?? []), ...(error ? [bounded(error, 1000)] : [])].slice(-MAX_ERRORS), viewport = s?.page?.viewportSize?.() ?? undefined, o = { observation_id: '', task_id: c.task_id, executor_version: c.executor_version, url, action, timestamp, ...(viewport ? { viewport: { width: Number(viewport.width), height: Number(viewport.height) } } : {}), ...(doc ? { document_identity: doc } : {}), ...(dom ? { dom_summary: bounded(dom) } : {}), console_errors, network_errors, ...(screenshotRef ? { screenshot_artifact_ref: screenshotRef } : {}), result }; o.observation_id = browserObservationId(o); return o; }
    async snapshot(c, action) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); try {
        s.url = plannedUrl(c, String(s.page.url()));
        const data = await s.page.locator('body').evaluate((body) => { const all = [...body.querySelectorAll('a,button,input,textarea,select,[role="button"],[tabindex]')].slice(0, 200); return { body: (body.innerText || '').slice(0, 12000), items: all.map((el, i) => ({ i: i + 1, tag: String(el.tagName || '').toLowerCase(), text: String(el.innerText || el.value || el.getAttribute?.('aria-label') || '').slice(0, 180) })) }; });
        s.refs = new Map(data.items.map((x) => [Number(x.i), `a,button,input,textarea,select,[role="button"],[tabindex] >> nth=${Number(x.i) - 1}`]));
        const rendered = [bounded(String(data.body), 3000), ...data.items.slice(0, 80).map((x) => `@e${x.i} <${x.tag}> ${x.text}`)].join('\n');
        return this.observation(c, s, action, s.url, 'OBSERVED', rendered);
    }
    catch (error) {
        return this.observation(c, s, action, s.url, 'FAILED', undefined, undefined, String(error));
    } }
    async health() { try {
        const executablePath = this.refreshExecutable();
        if (!executablePath)
            return { available: false, reason: 'Playwright Chromium executable unavailable' };
        const pw = await this.loadPlaywright();
        return { available: Boolean(pw?.chromium), version: `playwright-core:${executablePath}` };
    }
    catch (error) {
        return { available: false, reason: String(error) };
    } }
    async open(c, url) { const u = plannedUrl(c, url); let s; try {
        s = await this.ensure(c);
        await s.page.goto(u, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs });
        s.url = u;
        return this.snapshot(c, 'open');
    }
    catch (error) {
        return this.observation(c, s, 'open', u, 'FAILED', undefined, undefined, String(error));
    } }
    async navigate(c, url) { const u = plannedUrl(c, url); let s = this.sessions.get(c.task_id); try {
        s = await this.ensure(c);
        await s.page.goto(u, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs });
        s.url = u;
        return this.snapshot(c, 'navigate');
    }
    catch (error) {
        return this.observation(c, s, 'navigate', u, 'FAILED', undefined, undefined, String(error));
    } }
    async click(c, target) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); const n = targetRef(target.value), locator = s.refs.get(n); if (!locator)
        throw new Error('Browser target was not present in the latest bounded observation'); try {
        await s.page.locator(locator).click({ timeout: this.timeoutMs });
        return this.snapshot(c, 'click');
    }
    catch (error) {
        return this.observation(c, s, 'click', s.url, 'FAILED', undefined, undefined, String(error));
    } }
    async type(c, target, value) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); if (!value || value.length > 2000)
        throw new Error('Browser type value is required and bounded'); const n = targetRef(target.value), locator = s.refs.get(n); if (!locator)
        throw new Error('Browser target was not present in the latest bounded observation'); try {
        await s.page.locator(locator).fill(value, { timeout: this.timeoutMs });
        return this.snapshot(c, 'type');
    }
    catch (error) {
        return this.observation(c, s, 'type', s.url, 'FAILED', undefined, undefined, String(error));
    } }
    async key(c, request) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); const key = String(request.key ?? '').trim(); if (!/^(?:ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Enter|Space|Escape|Tab|Backspace|Delete|Home|End|PageUp|PageDown|[A-Za-z0-9])$/.test(key))
        throw new Error('Browser key must be one bounded navigation/action key or one alphanumeric key'); try {
        await s.page.keyboard.press(key);
        return this.snapshot(c, 'key');
    }
    catch (error) {
        return this.observation(c, s, 'key', s.url, 'FAILED', undefined, undefined, String(error));
    } }
    async inspect(c, request = {}) { if (request.selector)
        throw new Error('Playwright browser adapter does not expose arbitrary selector inspection'); return this.snapshot(c, 'inspect'); }
    async viewport(c, request) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); if (!Number.isInteger(request.width) || request.width < 240 || request.width > 3840 || !Number.isInteger(request.height) || request.height < 240 || request.height > 2160)
        throw new Error('Browser viewport must be integer width 240..3840 and height 240..2160'); try {
        await s.page.setViewportSize({ width: request.width, height: request.height });
        return this.snapshot(c, 'viewport');
    }
    catch (error) {
        return this.observation(c, s, 'viewport', s.url, 'FAILED', undefined, undefined, String(error));
    } }
    async screenshot(c) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); try {
        const bytes = await s.page.screenshot({ type: 'png', fullPage: false });
        if (!this.persistScreenshot)
            return this.observation(c, s, 'screenshot', s.url, 'FAILED', undefined, undefined, 'screenshot persistence owner unavailable');
        const ref = this.persistScreenshot(bytes, c);
        return this.observation(c, s, 'screenshot', s.url, 'OBSERVED', undefined, ref);
    }
    catch (error) {
        return this.observation(c, s, 'screenshot', s.url, 'FAILED', undefined, undefined, String(error));
    } }
    async wait(c, request) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); if (!Number.isInteger(request.milliseconds) || request.milliseconds < 0 || request.milliseconds > 30000)
        throw new Error('Browser wait must be 0..30000ms'); await s.page.waitForTimeout(request.milliseconds); return this.snapshot(c, 'wait'); }
    async close(c) { const s = this.sessions.get(c.task_id); if (!s?.url || s.executionOwnerRef !== c.execution_owner_ref)
        throw new Error('Browser session is not owned by the current execution identity'); const url = s.url; try {
        await boundedBrowserClose(s.browser);
        if (this.sessions.get(c.task_id) === s)
            this.sessions.delete(c.task_id);
        return this.observation(c, s, 'close', url, 'OBSERVED', 'browser session closed');
    }
    catch (error) {
        return this.observation(c, s, 'close', url, 'FAILED', undefined, undefined, String(error));
    } }
    async cleanup(c) { const s = this.sessions.get(c.task_id); if (!s)
        return { cleaned: false, reason: 'not-found' }; if (s.executionOwnerRef !== c.execution_owner_ref)
        return { cleaned: false, reason: 'owner-mismatch' }; try {
        await boundedBrowserClose(s.browser);
        if (this.sessions.get(c.task_id) === s)
            this.sessions.delete(c.task_id);
        return { cleaned: true, reason: 'cleaned' };
    }
    catch (error) {
        return { cleaned: false, reason: 'close-failed', error: String(error) };
    } }
    async dispose() { for (const [id, s] of this.sessions) {
        try {
            await boundedBrowserClose(s.browser);
        }
        catch { }
        this.sessions.delete(id);
    } }
}
