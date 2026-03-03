# Health Score Engine Plugin

The Health Score Engine plugin provides a penalty-based scoring system for evaluating the overall SEO health of a website. It identifies critical issues such as orphan pages, broken links, redirect chains, and duplicate content.

## Features
- **ScoreProvider Integration**: Contributes to the aggregate site score by evaluating per-page SEO health.
- **Penalty-based Global Score**: calculates a 0-100 health score based on the frequency of various crawl issues.
- **Issue Collection**: Aggregates SEO warnings and critical errors across the entire crawl.

## CLI Flags
- `--health`: Enable health score analysis (default).
- `--fail-on-critical`: Exit with code 1 if the health score falls below 50.
- `--score-breakdown`: Print a detailed breakdown of the penalties affecting the health score.

## Output Details
When enabled, this plugin adds a `health` section to the crawl results, including:
- `score`: The overall health score.
- `status`: A label (e.g., Excellent, Good, Critical) based on the score and presence of critical issues.
- `weightedPenalties`: A breakdown of points deducted for each category of issue.
- `issues`: Raw counts for each type of SEO issue discovered.
