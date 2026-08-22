# dsh-codex-usage

A polished OpenAI Codex plan-usage indicator for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI.

The plugin preserves the standard Settings gear and label while adding a context-meter-style ring at the far right. The ring contains the OpenAI mark and opens a detailed quota panel on hover or keyboard focus.

## Features

- Native-looking usage ring using the same 28 px geometry and DSH design tokens as the conversation context meter.
- Full quota detail for every Codex limit bucket: rolling windows, percentage used, reset times, plan type, credits, spend control, and reset credits.
- Five-minute polling by default, configurable through the bundle row.
- Fresh-on-hover data with a 250 ms debounce, one in-flight request, a shared five-minute poll cache, a shorter forced-hover cache, and failure throttling.
- Last-good fallback so a temporary provider or network failure does not erase useful data.
- No browser credentials: OAuth and credential refresh remain inside the official Codex app-server process.
- Loopback-only API route and an allowlist normalizer that removes email, IDs, tokens, and unknown provider fields.
- Windows, macOS, and Linux command launching, including Windows npm PowerShell shims.

## Requirements

- Node.js 20 or newer
- pnpm 10
- DeepSeek Harness 0.1.1-rc.2 or compatible
- A recent OpenAI Codex CLI with the stable app-server API (tested with Codex CLI 0.149.0)
- Codex signed in with a ChatGPT plan (run codex login)

## Install from this checkout

Build the package:

~~~sh
pnpm install
pnpm run check
~~~

Add it to a DSH profile from this directory:

~~~sh
dsh plugin --profile web add .
dsh --profile web --dump-config
dsh web
~~~

Refresh the existing Web page after the DSH host restarts. The client bundle is loaded by DSH's client-module system; a separate Vite server is neither required nor useful.

Remove it with:

~~~sh
dsh plugin --profile web remove dsh-codex-usage
~~~

### Install a packed artifact

A tarball ships prebuilt Host and lazy-CJS client artifacts, avoiding install-time build approval:

~~~sh
pnpm pack
dsh plugin --profile web add ./dsh-codex-usage-0.1.4.tgz
~~~

For a Git-host install, pnpm 10 requires the profile to allow this package's prepare script. Pin a commit and follow the exact allowBuilds instruction printed by DSH/pnpm.

## Configuration

The bundle inserts this row:

~~~yaml
- id: codex-usage
  name: dsh-codex-usage
  config:
    refreshIntervalMs: 300000
    hoverRefreshMinAgeMs: 30000
    requestTimeoutMs: 15000
    codexCommand: codex
~~~

Override the whole row in the profile's cordis.patch.yml. Later layers replace a row's complete config value.

| Field | Default | Meaning |
| --- | ---: | --- |
| refreshIntervalMs | 300000 | Background poll interval; minimum 60 seconds. |
| hoverRefreshMinAgeMs | 30000 | Minimum age before another hover refresh; minimum 5 seconds. |
| requestTimeoutMs | 15000 | Timeout for each Codex JSON-RPC request. |
| codexCommand | codex | Codex executable name or absolute path. |

## How it works

1. The Host plugin injects DSH's webServer service and registers GET /api/plugins/codex-usage.
2. On the first read, it starts one managed codex app-server --listen stdio:// process.
3. It performs initialize / initialized, then calls stable methods account/rateLimits/read and account/read.
4. A strict normalizer returns quota-only data to the loopback browser route.
5. The browser registers an independent action in sidebar.footer.action, reserves space at the right edge of the Settings row, and leaves the built-in Settings button and its behavior untouched.
6. The browser polls on the configured cadence and requests a coalesced refresh after a 250 ms hover debounce.

The client artifact is not ordinary browser ESM. tsdown.config.ts emits DSH's required lazy-CJS registration. React and DSH UI packages remain external and resolve through DSH's client module table, preventing duplicate React runtimes.

## Security and privacy

- The plugin never reads ~/.codex/auth.json and never handles OAuth tokens directly.
- Codex owns credential storage, keyring support, token refresh, and account selection.
- The Web route accepts only GET from loopback clients and rejects cross-site Origin, Referer, and Fetch Metadata signals.
- Responses omit email, account/workspace IDs, user IDs, access tokens, refresh tokens, raw provider payloads, and unknown fields.
- Error states preserve only the normalized last-good snapshot.
- The provider route is not configurable, avoiding an arbitrary authenticated proxy.

## Development

~~~sh
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run pack:check
~~~

The default suite skips the live provider test. Run it when Codex is installed and signed in:

~~~powershell
$env:CODEX_LIVE = '1'
pnpm exec vitest run tests/codex-live.spec.ts
~~~

## References

- [DSH: Your first plugin](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/)
- [DSH: Package and install](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)
- [DSH: Adding a settings card](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-settings-card)
- [DSH: Client modules](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/client-modules)
- [Codex app-server documentation](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Codex rate-limit response](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountRateLimitsResponse.ts)
- [Codex snapshot type](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/RateLimitSnapshot.ts)

## License

MIT
