import type { NormalizedMissionIntent } from '../mission/types.js';
import type { RepoContext } from './repo-context.js';
export declare function normalizeIntent(text: string, repo?: RepoContext): NormalizedMissionIntent;
