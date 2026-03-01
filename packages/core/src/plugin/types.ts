import type { Graph } from '../graph/graph.js';

export interface ParsedPage {
  url: string;
  html?: string;
  status?: number;
}

export interface PluginContext {
  command?: string;
  flags?: Record<string, boolean>;
  terminate?: boolean;
  metadata?: Record<string, unknown>;
  logger?: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

export interface CrawlContext extends PluginContext {
  snapshotId?: number;
  graph?: Graph;
}

export interface MetricsContext extends PluginContext {
  snapshotId: number;
}

export interface SchemaBuilder {
  addTable(name: string, ddl: string): void;
}

export type SiteGraph = Graph;

export interface PluginCliOption {
  flags: string;           // Commander flag syntax, e.g. '--cluster-threshold <number>'
  description: string;
  defaultValue?: string | boolean | number;
}

export interface CrawlPlugin {
  name: string;
  cli?: {
    flag?: string;
    description?: string;
    defaultFor?: string[];
    optionalFor?: string[];
    options?: PluginCliOption[];
  };
  onInit?(ctx: PluginContext): Promise<void>;
  shouldEnqueueUrl?(url: string, depth: number, ctx: CrawlContext): boolean | void;
  onBeforeCrawl?(ctx: CrawlContext): Promise<void>;
  onPageParsed?(page: ParsedPage, ctx: CrawlContext): Promise<void>;
  onGraphBuilt?(graph: SiteGraph, ctx: CrawlContext): Promise<void>;
  onMetricsPhase?(graph: SiteGraph, ctx: MetricsContext): Promise<void>;
  onAfterCrawl?(ctx: CrawlContext): Promise<void>;
  onAnalyzeDone?(result: any, ctx: PluginContext): Promise<void>;
  extendSchema?(schema: SchemaBuilder): void;
}
