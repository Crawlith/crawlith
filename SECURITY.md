# Security and Safe Crawling Policy

Crawlith is designed with safety and respect for host systems as a primary goal. The following rules are enforced to ensure responsible crawling:

## Safe Crawling Rules

- **Same Origin Enforcement**: The crawler discovers external links but strictly refuses to crawl any URL that does not share the same origin as the starting URL.
- **Respect for Robots.txt**: Crawlith automatically fetches and obeys `robots.txt` directives from the host server.
- **Concurrency Control**: Crawling is limited to a default of **5 concurrent requests** to prevent overwhelming small servers.
- **Page & Depth Limits**:
  - **Max Depth**: Enforced limit on how deep the crawler follows links from the root.
  - **Page Limit**: Strict upper bound on the total number of pages crawled in a session.
- **Redirect Management**:
  - **Follow Once**: Crawlith follows at most **one** redirect hop. If a second redirect is encountered, it is recorded as a redirect status but not followed further.
  - **Loop Detection**: Built-in protection against circular redirect loops.
- **Skip Non-HTML Assets**: To save bandwidth and resources, Crawlith identifies and skips non-HTML extensions (e.g., `.pdf`, `.zip`, `.jpg`) before making a request.
- **URL Normalization**: Extensive normalization is performed to prevent duplicate crawling and "URL trap" variations:
  - Lowercasing hostnames.
  - Removing default ports (80/443).
  - Removing hash fragments.
  - Collapsing duplicate slashes.
  - Normalizing trailing slashes for consistency.
  - Optional stripping of all query parameters or specific tracking tokens (UTM, etc).
- **Status Recording**: Every interaction records the HTTP status code, ensuring full visibility into the health of the link graph.
- **Visited URL Tracking**: A strict "visit once" set prevents redundant requests or infinite loops.

## Reporting Vulnerabilities

If you discover a security vulnerability within Crawlith, please report it via GitHub Issues or contact the maintainers directly.
