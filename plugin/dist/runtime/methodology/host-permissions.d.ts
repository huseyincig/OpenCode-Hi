type Permission = 'allow' | 'ask' | 'deny';
export declare function applyAdmittedProjectMethodologyPermissions(hostConfig: Record<string, unknown>, projectRoot: string): Array<{
    name: string;
    role: string;
    decision: Permission;
}>;
export {};
