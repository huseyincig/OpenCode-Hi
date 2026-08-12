export interface InstanceLease {
    key: string;
    token: string;
    release: () => void;
}
export declare function acquireHhcRuntimeInstance(projectKey: string): InstanceLease;
