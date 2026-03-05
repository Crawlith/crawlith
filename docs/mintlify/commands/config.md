# config

The `config` command allows you to manage secure settings, such as API keys for third-party integrations like Google PageSpeed Insights.

## Usage

```bash
crawlith config <plugin> set <value>
```

## Description

Crawlith uses an encrypted storage utility to keep your sensitive keys safe on disk. Keys are machine-bound using your hostname and username, meaning they cannot be copied to another system.

## Supported Plugins

### PageSpeed
Set your Google PageSpeed Insights API key:
```bash
crawlith config pagespeed set YOUR_API_KEY
```

## Security Note

All configuration values are stored in `~/.crawlith/config.json` with `0o600` permissions (read/write for your user only).
