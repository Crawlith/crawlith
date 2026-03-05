# Database Storage

**Database Storage** in Crawlith is the foundation for tracking site history, snapshot comparison, and resilient crawling.

## How it works

Unlike traditional crawlers that store results as flat files, Crawlith uses a high-performance **SQLite** database located on your machine at `~/.crawlith/crawlith.db`.

1.  **Append-Only Snapshotting**: Every time you crawl a site, Crawlith adds a new **Snapshot ID** to the database instead of overwriting your previous data.
2.  **Persistent Sites**: Your tracked websites are stored as **Projects**, allowing you to list all crawl history for a single domain.
3.  **Relational Scaling**: By using an on-disk database, Crawlith can handle massive sites with tens of thousands of links without consuming all your system's RAM.

## Features

*   **WAL Mode**: Crawlith uses "Write-Ahead Logging" to ensure that the database remains fast even when the crawler is writing data and you are browsing the UI simultaneously.
*   **Encapsulation**: Each plugin in the Crawlith ecosystem gets its own private "storage bucket" within the database, preventing data from different modules from colliding.
*   **Security**: The database file is protected with system-level permissions (0o600) to ensure only your user account can read the data.

## Why it matters

*   **Diffing**: Compare any two snapshots in history to see exactly how your site changed between crawls.
*   **Resiliency**: If a crawl is interrupted, the database already contains all pages successfully reached up to that point.
*   **Trend Analysis**: Track your [Health Score](/concepts/health-score) over time as you make improvements.

## Management

Use the CLI to manage your local storage:
*   **`crawlith sites`**: List all websites and snapshot counts.
```bash
crawlith sites
```

*   **`crawlith clean <domain>`**: Delete specific snapshots or entire projects.
```bash
crawlith clean <domain>
```
