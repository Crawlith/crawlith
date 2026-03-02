import { OpenCodeClient } from '../utils/types.js';

/**
 * Creates non-blocking session event hooks for OpenCode lifecycle events.
 */
export function createSessionHooks(client: OpenCodeClient) {
  return {
    'session.created': async (event: Record<string, unknown>) => {
      queueMicrotask(() => {
        client.app.log('crawlith.opencode.session.created', {
          sessionId: event.sessionId,
          timestamp: Date.now()
        });
      });
    },
    'session.completed': async (event: Record<string, unknown>) => {
      queueMicrotask(() => {
        client.app.log('crawlith.opencode.session.completed', {
          sessionId: event.sessionId,
          timestamp: Date.now()
        });
      });
    }
  };
}
