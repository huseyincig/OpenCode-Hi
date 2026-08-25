export type RoleClass = 'primary' | 'child';
export type RepositoryWriteAuthority = 'none' | 'scoped' | 'general';
export type RoleObligationAuthority = 'implementation' | 'analysis' | 'review' | 'verification' | 'research' | 'documentation' | 'test-authoring';
export interface RoleDelegationContract {
    mayDelegate: boolean;
    allowedRoleRefs: string[];
}
export interface RoleContract {
    id: string;
    purpose: string;
    roleClass: RoleClass;
    useWhen: string[];
    doNotUseWhen: string[];
    readOnly: boolean;
    reviewer: boolean;
    repositoryWriteAuthority: RepositoryWriteAuthority;
    obligationAuthority: RoleObligationAuthority[];
    delegation: RoleDelegationContract;
    permissionProfileRef: string;
}
export declare function validateRoleContract(value: unknown, field?: string): RoleContract;
export declare function validateRoleCatalog(roles: unknown[]): RoleContract[];
