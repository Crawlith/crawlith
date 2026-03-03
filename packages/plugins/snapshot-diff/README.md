# Snapshot Diff Plugin

The `snapshot-diff` plugin adds snapshot-aware graph comparison and incremental baseline loading to the `crawl` command.

## What this plugin does

- Adds `--compare <oldSnapshotId> <newSnapshotId>` to compare **two saved Crawlith snapshots**.
- Adds `--incremental` to preload the latest completed snapshot graph for the same domain before a new crawl.
- Produces either:
  - a human-readable terminal summary (`pretty` default), or
  - a raw JSON diff payload when `--format json` is used.

## CLI options

- `--compare <oldSnapshotId> <newSnapshotId>`  
  Internal flag that compares two persisted snapshot IDs and exits before crawling.
- `--incremental`  
  Resolves the latest completed snapshot for the target domain and stores it in plugin metadata for incremental graph diffing.

## Usage examples

### Compare two snapshots

```bash
crawlith crawl https://example.com --compare 101 102
```

### Compare two snapshots in JSON format

```bash
crawlith crawl https://example.com --compare 101 102 --format json
```

### Run a normal incremental crawl

```bash
crawlith crawl https://example.com --incremental
```

## Output details

### Pretty mode output

The plugin prints:

- Compared snapshot IDs.
- Added URL count.
- Removed URL count.
- Status change count.
- Metric delta table (positive/negative/zero colorized values).

### JSON mode output

The plugin emits the full diff object from Crawlith core (the same payload returned by `compareGraphs`).

## Notes

- `--compare` requires exactly two **numeric** snapshot IDs.
- The plugin does not read graph JSON files from disk.
