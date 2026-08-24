type Owner = object;
export interface RuntimeInstanceLeaseOptions {
    lockPath?: string;
    now?: () => number;
}
export interface InstanceLease {
    key: string;
    token: string;
    release: () => void;
}
export declare function acquireHiRuntimeInstance(projectKey: string, owner: Owner, options?: RuntimeInstanceLeaseOptions): InstanceLease;
export {};
