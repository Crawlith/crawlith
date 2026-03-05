# Troubleshooting

## Invalid URL

If Crawlith says the URL is invalid, make sure it includes `http://` or `https://`.

Example: `https://example.com`

## Network timeout

If crawl requests time out, retry later or reduce crawl size.

Try lower depth and limit values for a smaller run.

## Empty crawl result

If no pages are returned, verify the URL is reachable and not blocked.

Also check whether the site has strict bot controls.

## Permission issues

If Crawlith cannot write output files, choose a folder you can write to.

Example: `--output ./reports`

> Note: In restricted environments, run the command with the correct user permissions.
