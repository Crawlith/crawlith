# probe

The `probe` command inspects a domain's transport layer, SSL/TLS security, and HTTP infrastructure configuration.

## Usage

```bash
crawlith probe <url> [options]
```

## Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--timeout <ms>` | Maximum time to wait for the probe handshake. | `10000` |
| `--format <type>` | Output format: `pretty` or `json`. | `pretty` |

## What it Audits

- **TLS Version**: Check for modern (TLS 1.2+) vs deprecated protocols.
- **Certificate**: Expiry dates, issuer validation, and signature algorithms.
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **DNS**: Resolution performance and IP version support.
