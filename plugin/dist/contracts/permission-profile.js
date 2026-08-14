import { assertCanonicalId, assertNonEmptyString, assertRecord, assertStrictKeys, ContractValidationError } from './common.js';
const ACTIONS = new Set(['allow', 'ask', 'deny']);
function list(value, field) {
    if (!Array.isArray(value) || !value.length)
        throw new ContractValidationError(field, 'must be a non-empty array');
    const out = value.map((x, i) => assertNonEmptyString(x, `${field}[${i}]`));
    if (new Set(out).size !== out.length)
        throw new ContractValidationError(field, 'duplicate entry');
    return out;
}
export function validatePermissionProfile(value, field = 'permissionProfile') {
    const record = assertRecord(value, field);
    assertStrictKeys(record, ['id', 'rules', 'safetyClass', 'mayBeWidenedByLowerLayer', 'hostMappingRequirements'], ['id', 'rules', 'safetyClass', 'mayBeWidenedByLowerLayer', 'hostMappingRequirements'], field);
    const id = assertCanonicalId(record.id, `${field}.id`);
    const safetyClass = assertCanonicalId(record.safetyClass, `${field}.safetyClass`);
    if (record.mayBeWidenedByLowerLayer !== false)
        throw new ContractValidationError(`${field}.mayBeWidenedByLowerLayer`, 'must be false');
    if (!Array.isArray(record.rules) || !record.rules.length)
        throw new ContractValidationError(`${field}.rules`, 'must be a non-empty array');
    const seen = new Set();
    const rules = record.rules.map((raw, index) => {
        const item = assertRecord(raw, `${field}.rules[${index}]`);
        assertStrictKeys(item, ['capability', 'action', 'pattern'], ['capability', 'action'], `${field}.rules[${index}]`);
        const capability = assertCanonicalId(item.capability, `${field}.rules[${index}].capability`);
        if (typeof item.action !== 'string' || !ACTIONS.has(item.action))
            throw new ContractValidationError(`${field}.rules[${index}].action`, 'unsupported permission action');
        const pattern = item.pattern === undefined ? undefined : assertNonEmptyString(item.pattern, `${field}.rules[${index}].pattern`);
        const key = `${capability}:${pattern ?? ''}`;
        if (seen.has(key))
            throw new ContractValidationError(`${field}.rules`, `duplicate capability/pattern ${key}`);
        seen.add(key);
        return { capability, action: item.action, ...(pattern ? { pattern } : {}) };
    });
    return { id, rules, safetyClass, mayBeWidenedByLowerLayer: false, hostMappingRequirements: list(record.hostMappingRequirements, `${field}.hostMappingRequirements`).map((x, i) => assertCanonicalId(x, `${field}.hostMappingRequirements[${i}]`)) };
}
export function validatePermissionProfileCatalog(values) {
    const profiles = values.map((x, i) => validatePermissionProfile(x, `permissionProfiles[${i}]`));
    const ids = new Set(profiles.map(x => x.id));
    if (ids.size !== profiles.length)
        throw new ContractValidationError('permissionProfiles', 'duplicate profile id');
    return profiles;
}
export function validateRolePermissionBindings(roles, profiles) {
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    for (const profile of profiles) {
        if (profile.rules.some(rule => rule.capability === 'skill'))
            throw new ContractValidationError(`${profile.id}.rules`, 'skill permission belongs to MethodologyContract projection');
    }
    for (const role of roles) {
        const profile = byId.get(role.permissionProfileRef);
        if (!profile)
            throw new ContractValidationError(`${role.id}.permissionProfileRef`, `references unknown permission profile ${role.permissionProfileRef}`);
        if (role.readOnly) {
            const edit = profile.rules.find(rule => rule.capability === 'edit' && rule.pattern === undefined);
            if (!edit || edit.action !== 'deny')
                throw new ContractValidationError(`${role.id}.permissionProfileRef`, 'read-only role permission profile must explicitly deny edit');
        }
    }
}
