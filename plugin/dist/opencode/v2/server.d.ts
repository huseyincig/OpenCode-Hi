import type { V2Context } from './types.js';
export declare const HiV2Server: {
    id: string;
    setup: (ctx: V2Context) => Promise<() => Promise<void>>;
};
export default HiV2Server;
