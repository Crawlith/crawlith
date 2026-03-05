# export

The `export` command extracts raw crawl data from your local database into standard formats for use in third-party analysis or data visualization tools.

## Usage

```bash
crawlith export <domain> [options]
```

## Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--format <type>` | Output format: `json` or `csv`. | `json` |
| `--output <path>` | The filename or directory where the export should be saved. | `./crawlith-export.json` |
| `--snapshot <id>` | Export a specific snapshot ID instead of the latest one. | latest |

## Use Cases

- **Graph Analysis**: Export to CSV (`nodes.csv`, `edges.csv`) for use in Gephi.
- **Reporting**: Export to JSON for ingestion into custom BI dashboards.
- **Backups**: Create a standalone JSON dump of a critical crawl snapshot.
