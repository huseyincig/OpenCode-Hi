import type { MissionTask } from '../mission/types.js';
export declare function parallelSafety(existing: MissionTask[], candidate: {
    scope: string[];
    dependencies: string[];
    role?: string;
}): {
    safe: boolean;
    reasons: string[];
};
