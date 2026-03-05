# Content Clustering

**Content Clustering** is a structural analysis tool in Crawlith that identifies groups of pages with similar content layouts or structural signatures.

## How it works

Crawlith doesn't just look at text; it uses a technique called [SimHash](/concepts/simhash) to create a fingerprint for the structural HTML of each page.

1.  **Structure Mapping**: Every crawled URL is analyzed for its layout and block structure.
2.  **Fingerprinting**: Crawlith generates a unique hash based on these features.
3.  **Grouping**: Pages with identical or highly similar fingerprints are grouped into "clusters."

## Why it matters

Identifying structural clusters helps you spot:
*   **Duplicate Content Patterns**: Find entire sections of your site that may be near-duplicates.
*   **Boilerplate Issues**: Detect if large portions of your site share too much identical structure, which can dilute SEO value.
*   **Template Analysis**: Group pages based on their layout templates to audit performance across different page types.

## Usage

Enable clustering analysis with the `--clustering` flag:

```bash
crawlith crawl https://example.com --clustering
```

You can adjust the similarity threshold using `--cluster-threshold`:
```bash
crawlith crawl https://example.com --clustering --cluster-threshold 10
```
*(Lower numbers require more exact layout matches; higher numbers are more inclusive.)*
