# Security Policy

## Reporting a Vulnerability

Please report security issues privately via GitHub Security Advisories:
https://github.com/xiaokang6/dsh-admin/security/advisories/new

## Security Notes

- The plugin intentionally has **no application-layer authentication**: the site entry is
  protected by the deployment's own Basic Auth / reverse-proxy layer (OpenResty / Cloudflare).
  Do not expose the dsh web port (3080/3081) directly to the public internet.
- `POST /plugin/dshadmin/restart` requires `{"confirm":true}` in the body to prevent
  accidental triggers. The restart action runs the local `dsh-plugin-op restart` convention
  (systemd stop → clear orphans on :3080 → clean start → health check).
- Version checks only read the npm registry and the local package.json; no telemetry,
  no external calls other than `registry.npmjs.org`.
