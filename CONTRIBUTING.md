# Contributing

1. Use Node.js 20+ and pnpm 10.
2. Run pnpm install.
3. Keep credentials and raw provider payloads out of tests, fixtures, logs, and browser state.
4. Run pnpm run check before submitting a change.
5. If Codex is available, also run the opt-in live test documented in README.md.

Client changes must preserve DSH's lazy-CJS module registration and keep React external. Host changes must keep the API read-only, loopback-only, and allowlist-normalized.
