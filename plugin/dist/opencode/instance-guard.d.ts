export interface InstanceLease {
    key: string;
    token: string;
    release: () => void;
}
export declare function acquireHiRuntimeInstance(projectKey: string): InstanceLease;
