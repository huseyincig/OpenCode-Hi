import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
function canonical(path) {
    const absolute = resolve(path);
    try {
        return realpathSync(absolute);
    }
    catch {
        return absolute;
    }
}
function text(value, max) {
    if (typeof value !== 'string')
        return undefined;
    const out = value.replace(/\s+/g, ' ').trim();
    return out && out.length <= max ? out : undefined;
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function validRecord(value) {
    return Boolean(text(value.id, 256) && text(value.project_root, 4096) && text(value.content, 4000) && finite(value.observed_at) &&
        (value.expires_at === undefined || finite(value.expires_at)) &&
        (value.source_uri === undefined || Boolean(text(value.source_uri, 2048))) &&
        (value.tags === undefined || (Array.isArray(value.tags) && value.tags.length <= 32 && value.tags.every(item => Boolean(text(item, 128))))) &&
        (value.confidence === undefined || (finite(value.confidence) && value.confidence >= 0 && value.confidence <= 1)));
}
/** Provider-backed broad project memory. This runtime owns projection only; it persists nothing. */
export class ProjectMemoryRuntime {
    provider;
    projectRoot;
    constructor(projectRoot, provider) {
        this.provider = provider;
        this.projectRoot = canonical(projectRoot);
    }
    async recall(options) {
        const dropped = { invalid: 0, cross_project: 0, stale: 0, expired: 0, over_budget: 0 };
        const base = { items: [], dropped, advisory: true, evidence_authority: false, routing_authority: false, completion_authority: false, action_authority: false, persistence_owner: 'provider-or-none', claim_boundary: 'bounded-provider-memory-projection' };
        if (!this.provider)
            return { status: 'DISABLED', ...base };
        const query = text(options.query, 2000), maxAge = options.max_age_ms, maxItems = Math.min(16, Math.max(1, Math.trunc(options.max_items ?? 6))), maxChars = Math.min(8000, Math.max(256, Math.trunc(options.max_chars ?? 2400))), now = options.now ?? Date.now();
        if (!query || !finite(maxAge) || maxAge < 0 || !finite(now))
            return { status: 'DEGRADED', provider_id: this.provider.id, ...base };
        let records;
        try {
            records = await this.provider.recall({ project_root: this.projectRoot, query, max_items: maxItems, max_chars: maxChars, max_age_ms: maxAge, now });
        }
        catch {
            return { status: 'DEGRADED', provider_id: this.provider.id, ...base };
        }
        if (!Array.isArray(records))
            return { status: 'DEGRADED', provider_id: this.provider.id, ...base };
        let used = 0;
        for (const record of records) {
            if (!record || typeof record !== 'object' || !validRecord(record)) {
                dropped.invalid++;
                continue;
            }
            if (canonical(record.project_root) !== this.projectRoot) {
                dropped.cross_project++;
                continue;
            }
            if (record.observed_at > now) {
                dropped.invalid++;
                continue;
            }
            if (now - record.observed_at > maxAge) {
                dropped.stale++;
                continue;
            }
            if (record.expires_at !== undefined && record.expires_at <= now) {
                dropped.expired++;
                continue;
            }
            if (base.items.length >= maxItems) {
                dropped.over_budget++;
                continue;
            }
            const content = text(record.content, 4000), cost = content.length + (record.source_uri?.length ?? 0) + record.id.length;
            if (used + cost > maxChars) {
                dropped.over_budget++;
                continue;
            }
            used += cost;
            base.items.push({ provider_id: this.provider.id, id: record.id, content, observed_at: record.observed_at, age_ms: now - record.observed_at, ...(record.source_uri ? { source_uri: record.source_uri } : {}), tags: (record.tags ?? []).map((item) => item.trim()), ...(record.confidence === undefined ? {} : { confidence: record.confidence }) });
        }
        return { status: 'READY', provider_id: this.provider.id, ...base };
    }
}
