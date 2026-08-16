# dsh-admin

A DeepSeek Harness Web GUI admin plugin: **manual restart** + **automatic version check** for the Harness itself. The UI is embedded directly into the Web GUI (header button + settings page), following the same pattern as [dsh-usage-stats](https://github.com/Ychris12138/dsh-usage-stats).

## Features

- **Manual restart** — a button in the session header (top-right, beside session log): one click schedules a clean restart of the dsh web service (double-confirm, then `systemd-run + dsh-plugin-op restart` — the local convention script that stops systemd, clears orphan instances on :3080, starts clean, and health-verifies).
- **Auto version check** — compares the installed `@deepseek-ai/dsh` against the npm `latest` tag (semver-aware: stable > rc). Checked on load, then every 6 hours on the host; the panel shows current/latest/last-checked and a status dot (green = up to date, yellow = update available, red = check failed).
- **Embedded UI** — no standalone page:
  - Top-right header button `🟢 0.1.0-rc.6` (session header utilities slot, beside session log — never overlaps anything) → click to open a floating panel: version status, check-now button, service info, restart button.
  - Settings → **DSH Admin** full page (same content, larger layout).

## Routes (host half)

| Route | Description |
|---|---|
| `GET /plugin/dshadmin/status` | JSON: current/latest version, `isNewer`, service info (pid, systemd, restart command) |
| `GET /plugin/dshadmin/health` | `{ok:true}` |
| `POST /plugin/dshadmin/check` | Force re-check npm latest |
| `POST /plugin/dshadmin/restart` | Schedule restart (body must be `{"confirm":true}`) |

Restart priority: ① `systemd-run` + `dsh-plugin-op restart` (isolated cgroup — `dsh.service` is `KillMode=control-group`, a direct spawn would be killed by its own `systemctl stop dsh`; the transient unit runs the whole script: stop → clear :3080 orphans → clean start → health check) → ② plain `dsh-plugin-op restart` → ③ `systemctl --no-block restart dsh` → ④ socket-pid kill + relaunch.

## Install

The package is a [profile bundle](https://github.com/deepseek-ai/deepseek-harness) (its manifest declares `dsh.bundle.patch`).

```bash
# Option A — install via the plugin manager
dsh plugin --profile web add xiaokang6/dsh-admin

# Option B — manual copy (never run npm install in the profile dir)
git clone https://github.com/xiaokang6/dsh-admin /tmp/dsh-admin
cp -r /tmp/dsh-admin ~/.dsh/profiles/web/node_modules/dsh-admin
```

Then make sure `~/.dsh/profiles/web/cordis.patch.yml` contains:

```yaml
- insert:
    - id: dsh-admin
      name: 'dsh-admin'
```

Restart `dsh web` (or use your local restart command) and hard-refresh the browser. Host changes require a service restart; client changes are picked up by client-modules HMR on page refresh.

## Requirements

- DeepSeek Harness (`@deepseek-ai/dsh`) installed via npm (global install; the restart chain uses `dsh-plugin-op` when present)
- Linux + systemd (restart path; the check/UI parts work anywhere)

## License

MIT
