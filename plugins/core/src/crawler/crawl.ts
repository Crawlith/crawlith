import { Crawler, CrawlOptions } from './crawler.js';

export { CrawlOptions };

export async function crawl(startUrl: string, options: CrawlOptions): Promise<number> {
  const crawler = new Crawler(startUrl, options);
  return crawler.run();
}
