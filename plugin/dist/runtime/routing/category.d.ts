import type { Category, NormalizedMissionIntent } from '../mission/types.js';
export declare function resolveCategory(intent: NormalizedMissionIntent): Category;
export declare function continuationBudget(category: Category): number;
export declare function roleForIntent(intent: NormalizedMissionIntent): string;
