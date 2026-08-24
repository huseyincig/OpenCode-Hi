import { createHash } from 'node:crypto';
export const BROWSER_OBSERVATION_ACTIONS = ['open', 'navigate', 'click', 'type', 'key', 'inspect', 'viewport', 'screenshot', 'wait', 'close'];
export const BROWSER_OBSERVATION_RESULTS = ['OBSERVED', 'FAILED'];
const KEYS = new Set(['observation_id', 'task_id', 'executor_version', 'url', 'action', 'timestamp', 'viewport', 'document_identity', 'dom_summary', 'console_errors', 'network_errors', 'screenshot_artifact_ref', 'result']);
const ACTIONS = new Set(BROWSER_OBSERVATION_ACTIONS), RESULTS = new Set(BROWSER_OBSERVATION_RESULTS);
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function bounded(v, max) { return typeof v === 'string' && Boolean(v.trim()) && v.length <= max; }
function boundedStrings(v, maxItems, maxChars) { return Array.isArray(v) && v.length <= maxItems && v.every(x => bounded(x, maxChars)); }
function sha(v) { return typeof v === 'string' && /^[a-f0-9]{64}$/.test(v); }
function artifactRef(v) { return typeof v === 'string' && /^hi-artifact:a_[a-f0-9]{24}$/.test(v); }
function validUrl(v) { if (!bounded(v, 4096))
    return false; try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
}
catch {
    return false;
} }
function validViewport(v) { return record(v) && Object.keys(v).every(k => k === 'width' || k === 'height') && Number.isInteger(v.width) && Number(v.width) >= 240 && Number(v.width) <= 3840 && Number.isInteger(v.height) && Number(v.height) >= 240 && Number(v.height) <= 2160; }
export function browserObservationId(input) {
    const raw = [input.task_id, input.executor_version, input.url, input.action, String(input.timestamp), input.viewport ? `${input.viewport.width}x${input.viewport.height}` : '', input.document_identity ?? '', input.screenshot_artifact_ref ?? '', input.result].join('\0');
    return `bo_${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}
export function isBrowserObservationContract(v) {
    if (!record(v) || !Object.keys(v).every(k => KEYS.has(k)))
        return false;
    if (!bounded(v.observation_id, 27) || !/^bo_[a-f0-9]{24}$/.test(v.observation_id) || !bounded(v.task_id, 160) || !bounded(v.executor_version, 160) || !validUrl(v.url))
        return false;
    if (typeof v.action !== 'string' || !ACTIONS.has(v.action) || typeof v.result !== 'string' || !RESULTS.has(v.result))
        return false;
    if (typeof v.timestamp !== 'number' || !Number.isFinite(v.timestamp) || v.timestamp <= 0)
        return false;
    if (v.viewport !== undefined && !validViewport(v.viewport))
        return false;
    if (v.action === 'viewport' && v.result === 'OBSERVED' && !v.viewport)
        return false;
    if (v.document_identity !== undefined && !sha(v.document_identity))
        return false;
    if (v.dom_summary !== undefined && (!bounded(v.dom_summary, 4000) || v.dom_summary.length > 4000))
        return false;
    if (!boundedStrings(v.console_errors, 64, 1000) || !boundedStrings(v.network_errors, 64, 1000))
        return false;
    if (v.screenshot_artifact_ref !== undefined && !artifactRef(v.screenshot_artifact_ref))
        return false;
    if (v.action === 'screenshot' && v.result === 'OBSERVED' && !v.screenshot_artifact_ref)
        return false;
    if (v.result === 'OBSERVED' && !v.viewport && !v.document_identity && !v.dom_summary && !v.screenshot_artifact_ref && v.console_errors.length === 0 && v.network_errors.length === 0)
        return false;
    const expected = browserObservationId({ task_id: v.task_id, executor_version: v.executor_version, url: v.url, action: v.action, timestamp: v.timestamp, viewport: v.viewport, document_identity: v.document_identity, screenshot_artifact_ref: v.screenshot_artifact_ref, result: v.result });
    return v.observation_id === expected;
}
