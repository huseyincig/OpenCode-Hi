import type { OpenCodeClient } from './types.js';
import { type OpenCodeLifecycleEndpoint } from './client-adapter.js';
import type { ChildSessionPort } from '../runtime/host/port.js';
export declare function createOpenCodeChildSessionPort(client: OpenCodeClient, lifecycle?: OpenCodeLifecycleEndpoint): ChildSessionPort;
