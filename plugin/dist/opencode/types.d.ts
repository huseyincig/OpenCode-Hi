import type { Plugin } from '@opencode-ai/plugin';
export type OpenCodePluginContext = Parameters<Plugin>[0];
export type OpenCodeClient = OpenCodePluginContext['client'];
export type OpenCodeProject = OpenCodePluginContext['project'];
