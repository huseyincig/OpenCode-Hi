export const RESERVED_NATIVE_TOOL_NAMES = new Set([
    'read', 'write', 'edit', 'patch', 'apply_patch', 'multiedit', 'bash', 'shell', 'skill', 'task', 'todo', 'glob', 'grep', 'webfetch', 'websearch'
]);
export function auditHhcToolNamespace(names) {
    const unique = [...new Set(names.map(String))];
    const collisions = unique.filter(x => RESERVED_NATIVE_TOOL_NAMES.has(x));
    const nonNamespaced = unique.filter(x => !x.startsWith('hhc_'));
    return { ok: collisions.length === 0 && nonNamespaced.length === 0, collisions, nonNamespaced };
}
export function assertHhcToolNamespace(names) { const a = auditHhcToolNamespace(names); if (!a.ok)
    throw new Error(`HHC tool namespace violation: collisions=${a.collisions.join(',') || 'none'}; nonNamespaced=${a.nonNamespaced.join(',') || 'none'}`); }
