# FAQ

## Does Crawlith respect `robots.txt`?
Yes. By default, Crawlith follows all `robots.txt` rules and respects `crawl-delay` directives to ensure it doesn't overload your server. Use the `--ignore-robots` flag only if you have explicit permission.

## Can it crawl massive sites?
Yes. Crawlith uses an on-disk [SQLite database](/concepts/database) to store crawl state, which keeps memory usage low even for sites with tens of thousands of URLs. For large runs, we recommend using the `--limit`, `--depth`, and `--concurrency` flags to manage performance.

## Does it support JavaScript rendering (SPAs)?
Currently, Crawlith is a high-speed static crawler. It parses the HTML returned by your server but does not execute client-side JavaScript. Support for Playwright-based rendering is planned for future releases.

## How is the Health Score calculated?
The [Health Score](/concepts/health-score) is a weighted metric (0-100) that penalizes critical issues like broken links or redirect loops while rewarding structural soundess and SEO fundamentals.

## Where is my crawl data stored?
All crawl history and project metadata are stored in a local SQLite database at `~/.crawlith/crawlith.db`. This file is protected with user-only permissions (0o600).

## Can I use Crawlith in a CI/CD pipeline?
Absolutely. Crawlith is designed for automation. Use the `--format json` flag for machine-readable results and `--fail-on-critical` to exit with an error code if the site health drops below a certain threshold.

## Does Crawlith crawl external links?
Crawlith discovers external links and tracks them to report on your outbound link ratio, but it will **not** crawl the content of pages on different domains unless they are explicitly whitelisted.
