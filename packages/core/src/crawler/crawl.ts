import { Crawler, type CrawlOptions } from './crawler.js';
import { EngineContext } from '../events.js';

export type { CrawlOptions };

export async function crawl(startUrl: string, options: CrawlOptions, context?: EngineContext): Promise<number> {
  const crawler = new Crawler(startUrl, options, context);
  return crawler.run();
}
