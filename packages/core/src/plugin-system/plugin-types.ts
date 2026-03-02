import { Command } from 'commander';

export interface PluginContext {
    command?: string;
    flags?: Record<string, any>;
    snapshotId?: number;
    logger?: {
        info(msg: string): void;
        warn(msg: string): void;
        error(msg: string): void;
        debug(msg: string): void;
    };
    [key: string]: any;
}

export interface CrawlithPlugin {
    name: string;
    version?: string;
    description?: string;

    register?: (cli: Command) => void;

    hooks?: {
        onInit?: (ctx: PluginContext) => void | Promise<void>;
        onCrawlStart?: (ctx: PluginContext) => void | Promise<void>;
        shouldEnqueueUrl?: (ctx: PluginContext, url: string, depth: number) => boolean;
        onPageParsed?: (ctx: PluginContext, page: any) => void | Promise<void>;
        onGraphBuilt?: (ctx: PluginContext, graph: any) => void | Promise<void>;
        onMetrics?: (ctx: PluginContext, metrics: any) => void | Promise<void>;
        onReport?: (ctx: PluginContext, report: any) => void | Promise<void>;
    };
}
