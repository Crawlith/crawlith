# sites

The `sites` command lists all projects and crawl snapshots currently stored in your local [Crawlith database](/concepts/database).

## Usage

```bash
crawlith sites [options]
```

## Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--format <type>` | Output format: `pretty` or `json`. | `pretty` |

## Output Details

For each tracked domain, the command displays:
- Total number of snapshots.
- Date of the last crawl.
- Number of pages discovered in the latest run.
- The latest [Health Score](/concepts/health-score).
