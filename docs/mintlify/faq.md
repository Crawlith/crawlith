# FAQ

## Does Crawlith respect robots.txt?

Yes. By default, Crawlith follows robots.txt rules when crawling.

## Can it crawl large sites?

Yes. Use flags like `--limit`, `--depth`, and `--concurrency` to control crawl size and speed.

## Does it crawl external domains?

Crawlith is typically used for internal site crawling. External links may be discovered, but crawl scope is usually set to the target site.

## Is internet access required?

Yes, for live websites. Crawlith needs network access to request pages.

## Can I schedule it?

Yes. You can run Crawlith on a schedule using cron, CI jobs, or task schedulers.
