import { createHash } from 'node:crypto';
function stable(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stable).join(',')}]`;
    const obj = value;
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`;
}
function hash(payload) { return createHash('sha256').update(stable(payload)).digest('hex'); }
export function payloadHash(payload) { return hash(payload); }
