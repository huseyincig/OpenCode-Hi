import { assertCanonicalId, assertNonEmptyString, assertRecord, assertStrictKeys, ContractValidationError } from './common.js';
const ROLE_CLASSES = new Set(['primary', 'child']);
const WRITE_AUTH = new Set(['none', 'scoped', 'general']);
const OBLIGATION_AUTH = new Set(['implementation', 'analysis', 'review', 'verification']);
function stringList(value, field, allowEmpty = false) {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0))
        throw new ContractValidationError(field, allowEmpty ? 'must be an array' : 'must be a non-empty array');
    return value.map((item, index) => assertNonEmptyString(item, `${field}[${index}]`));
}
export function validateRoleContract(value, field = 'role') {
    const record = assertRecord(value, field);
    assertStrictKeys(record, ['id', 'purpose', 'roleClass', 'useWhen', 'doNotUseWhen', 'readOnly', 'reviewer', 'repositoryWriteAuthority', 'obligationAuthority', 'delegation', 'permissionProfileRef'], ['id', 'purpose', 'roleClass', 'useWhen', 'doNotUseWhen', 'readOnly', 'reviewer', 'repositoryWriteAuthority', 'obligationAuthority', 'delegation', 'permissionProfileRef'], field);
    const id = assertCanonicalId(record.id, `${field}.id`);
    const purpose = assertNonEmptyString(record.purpose, `${field}.purpose`);
    if (typeof record.roleClass !== 'string' || !ROLE_CLASSES.has(record.roleClass))
        throw new ContractValidationError(`${field}.roleClass`, 'unsupported role class');
    if (typeof record.readOnly !== 'boolean')
        throw new ContractValidationError(`${field}.readOnly`, 'must be boolean');
    if (typeof record.reviewer !== 'boolean')
        throw new ContractValidationError(`${field}.reviewer`, 'must be boolean');
    if (typeof record.repositoryWriteAuthority !== 'string' || !WRITE_AUTH.has(record.repositoryWriteAuthority))
        throw new ContractValidationError(`${field}.repositoryWriteAuthority`, 'unsupported write authority');
    if (record.readOnly && record.repositoryWriteAuthority !== 'none')
        throw new ContractValidationError(`${field}.repositoryWriteAuthority`, 'read-only role must have none');
    const obligations = stringList(record.obligationAuthority, `${field}.obligationAuthority`, true);
    for (const kind of obligations)
        if (!OBLIGATION_AUTH.has(kind))
            throw new ContractValidationError(`${field}.obligationAuthority`, `unsupported obligation ${kind}`);
    if (new Set(obligations).size !== obligations.length)
        throw new ContractValidationError(`${field}.obligationAuthority`, 'duplicate obligation');
    if (record.reviewer && !obligations.includes('review'))
        throw new ContractValidationError(`${field}.reviewer`, 'reviewer role must own review obligation');
    const delegation = assertRecord(record.delegation, `${field}.delegation`);
    assertStrictKeys(delegation, ['mayDelegate', 'allowedRoleRefs'], ['mayDelegate', 'allowedRoleRefs'], `${field}.delegation`);
    if (typeof delegation.mayDelegate !== 'boolean')
        throw new ContractValidationError(`${field}.delegation.mayDelegate`, 'must be boolean');
    const allowedRoleRefs = stringList(delegation.allowedRoleRefs, `${field}.delegation.allowedRoleRefs`, true).map((ref, index) => assertCanonicalId(ref, `${field}.delegation.allowedRoleRefs[${index}]`));
    if (!delegation.mayDelegate && allowedRoleRefs.length)
        throw new ContractValidationError(`${field}.delegation`, 'non-delegating role cannot list allowed roles');
    const permissionProfileRef = assertCanonicalId(record.permissionProfileRef, `${field}.permissionProfileRef`);
    return { id, purpose, roleClass: record.roleClass, useWhen: stringList(record.useWhen, `${field}.useWhen`), doNotUseWhen: stringList(record.doNotUseWhen, `${field}.doNotUseWhen`), readOnly: record.readOnly, reviewer: record.reviewer, repositoryWriteAuthority: record.repositoryWriteAuthority, obligationAuthority: obligations, delegation: { mayDelegate: delegation.mayDelegate, allowedRoleRefs }, permissionProfileRef };
}
export function validateRoleCatalog(roles) {
    const normalized = roles.map((role, index) => validateRoleContract(role, `roles[${index}]`));
    const ids = new Set(normalized.map(role => role.id));
    if (ids.size !== normalized.length)
        throw new ContractValidationError('roles', 'duplicate canonical role id');
    for (const role of normalized)
        for (const ref of role.delegation.allowedRoleRefs)
            if (!ids.has(ref))
                throw new ContractValidationError(`${role.id}.delegation`, `references unknown role ${ref}`);
    return normalized;
}
