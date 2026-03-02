import { ZodTypeAny } from 'zod';

/**
 * OpenCode client logging contract used by the plugin.
 */
export interface OpenCodeClient {
  app: {
    /**
     * Writes a structured log line to OpenCode's application logger.
     */
    log(message: string, metadata?: Record<string, unknown>): void;
  };
}

/**
 * Minimal OpenCode runtime context passed to plugin entrypoints.
 */
export interface OpenCodePluginContext {
  project: unknown;
  client: OpenCodeClient;
  $: unknown;
  directory: string;
  worktree: string;
}

/**
 * Generic OpenCode tool declaration shape.
 */
export interface OpenCodeToolDefinition<TSchema extends ZodTypeAny> {
  description: string;
  args: TSchema;
  run: (args: unknown) => Promise<unknown>;
}
