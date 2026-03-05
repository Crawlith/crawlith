# clean

The `clean` command manages your local [database](/concepts/database) storage by allowing you to remove old snapshots or entire projects.

## Usage

```bash
crawlith clean [domain] [options]
```

## Description

If a `domain` is provided, the command will focus on that specific project. If no domain is provided, it will present a summary of total storage usage.

## Options

| Flag | Description |
| :--- | :--- |
| `--snapshot <id>` | Remove a specific snapshot ID. |
| `--all` | Purge all snapshots for the specified domain. |
| `--force` | Skip the confirmation prompt (dangerous). |

## Examples

Remove all data for `example.com`:
```bash
crawlith clean example.com --all
```

Remove a single snapshot:
```bash
crawlith clean example.com --snapshot 12
```
