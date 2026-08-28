import { BROWSER_OBSERVATION_ACTIONS } from './browser-observation.js';
const ACTIONS = new Set(BROWSER_OBSERVATION_ACTIONS);
export function verificationCaseValidationError(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return 'must be an object';
    const x = v, keys = Object.keys(x), unknown = keys.filter(k => !['id', 'subject', 'required_browser_actions'].includes(k));
    if (unknown.length)
        return `unsupported field(s): ${unknown.join(', ')}`;
    if (typeof x.id !== 'string' || !/^vc_[a-z0-9][a-z0-9-]{0,47}$/.test(x.id))
        return 'id must match /^vc_[a-z0-9][a-z0-9-]{0,47}$/ (use lowercase kebab-case after vc_)';
    if (typeof x.subject !== 'string' || !x.subject.trim())
        return 'subject must be a non-empty string';
    if (x.subject.length > 240)
        return 'subject must be at most 240 characters';
    if (!Array.isArray(x.required_browser_actions) || x.required_browser_actions.length === 0 || x.required_browser_actions.length > 10)
        return 'required_browser_actions must contain 1..10 actions';
    if (new Set(x.required_browser_actions).size !== x.required_browser_actions.length)
        return 'required_browser_actions must not contain duplicates';
    const invalid = x.required_browser_actions.find(a => typeof a !== 'string' || !ACTIONS.has(a));
    if (invalid !== undefined)
        return `required_browser_actions contains unsupported action: ${String(invalid)}`;
    return undefined;
}
export function isVerificationCase(v) { return verificationCaseValidationError(v) === undefined; }
