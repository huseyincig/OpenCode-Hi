export type PermissionAction = 'allow' | 'ask' | 'deny';
export interface PermissionRule {
    capability: string;
    action: PermissionAction;
    pattern?: string;
}
export interface PermissionProfileContract {
    id: string;
    rules: PermissionRule[];
    safetyClass: string;
    mayBeWidenedByLowerLayer: false;
    hostMappingRequirements: string[];
}
export declare function validatePermissionProfile(value: unknown, field?: string): PermissionProfileContract;
export declare function validatePermissionProfileCatalog(values: unknown[]): PermissionProfileContract[];
export interface PermissionBoundRole {
    id: string;
    readOnly: boolean;
    permissionProfileRef: string;
}
export declare function validateRolePermissionBindings(roles: PermissionBoundRole[], profiles: PermissionProfileContract[]): void;
