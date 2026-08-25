export const OPERATIONAL_TOOL_RECEIPT_SCHEMA = 1;
function record(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function text(v) { return typeof v === 'string' && v.trim().length > 0; }
export function isOperationalToolDefinition(v) {
    return record(v) && text(v.capability) && text(v.implementation_id) && v.dependency_class === 'operational-tool' && ['project-local', 'ephemeral', 'none'].includes(String(v.provision_scope)) && text(v.smoke) && (v.version === undefined || text(v.version));
}
export function assertOperationalToolDefinition(v) {
    if (!isOperationalToolDefinition(v))
        throw new Error('Invalid OperationalToolDefinition');
}
