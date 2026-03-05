# Troubleshooting

Common issues and how to fix them when using the Crawlith CLI.

## Invalid URL

If you see an "Invalid URL" error, ensure your URL includes the protocol (`http://` or `https://`).

*   **Wrong**: `example.com`
*   **Correct**: `https://example.com`

## Network Timeout

If requests are timing out, your server may be slow or you may be sending too many parallel requests.

*   **Fix**: Reduce concurrency with `--concurrency 1`.
```bash
crawlith crawl https://example.com --concurrency 1
```

*   **Fix**: Increase the request timeout with `--timeout 30000` (value in milliseconds).
```bash
crawlith crawl https://example.com --timeout 30000
```

## Empty Crawl Result

If Crawlith finishes but says 0 pages were discovered:

*   **Check `robots.txt`**: Ensure the bot isn't being blocked. You can verify by running with `--ignore-robots`.
```bash
crawlith crawl https://example.com --ignore-robots
```

*   **Check Authentication**: If your site requires a login or has a firewall (like Cloudflare), Crawlith may be getting blocked.
*   **Check Homepage Links**: Ensure your homepage has crawlable `<a>` tags. JS-based navigation is not currently supported.

## SQLite Database Error

If you see a "Database Locked" error, another instance of Crawlith may be running or the UI dashboard is performing a heavy query.

*   **Fix**: Ensure only one `crawlith crawl` command is running for the same domain at a time.
*   **Fix**: Restart the command after a few seconds to let the lock release.

## Permission Denied

If Crawlith cannot write to your home directory:

*   **Fix**: Ensure your user account has write permissions for `~/.crawlith`.
*   **Fix**: Run `chmod 700 ~/.crawlith` to fix directory permissions.

## High Memory Usage

If Crawlith is consuming too much RAM during a crawl:

*   **Fix**: Decrease the page limit with `--limit 1000`.
```bash
crawlith crawl https://example.com --limit 1000
```

*   **Fix**: Disable heavy analysis features like `--clustering` or `--compute-pagerank`.
