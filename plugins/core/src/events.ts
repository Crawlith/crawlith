export type CrawlEvent =
  | { type: 'crawl:start'; url: string }
  | { type: 'crawl:success'; url: string; status: number; durationMs: number; depth?: number }
  | { type: 'crawl:error'; url: string; error: string; depth?: number }
  | { type: 'crawl:limit-reached'; limit: number }
  | { type: 'queue:enqueue'; url: string; depth: number }
  | { type: 'metrics:start'; phase: string }
  | { type: 'metrics:complete'; durationMs: number }
  | { type: 'debug'; message: string; context?: unknown }
  | { type: 'info'; message: string; context?: unknown }
  | { type: 'warn'; message: string; context?: unknown }
  | { type: 'error'; message: string; error?: unknown; context?: unknown };

export interface EngineContext {
  emit: (event: CrawlEvent) => void;
}
