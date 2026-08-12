declare module '@opencode-ai/plugin' {
  export type Plugin = (ctx: any) => Promise<Record<string, unknown>> | Record<string, unknown>
}
declare module '@opencode-ai/plugin/tool' {
  export const tool: any
}
