export type SkillPermission = 'allow' | 'ask' | 'deny';
export declare function resolveSkillPermissionMap(config: Record<string, unknown>, agentId?: string): Record<string, SkillPermission> | undefined;
export declare function resolveSkillToolEnabled(config: Record<string, unknown>, agentId?: string): boolean;
export declare function resolveSkillPermission(name: string, map?: Record<string, SkillPermission>): SkillPermission;
