# Codex Usage Plugin Implementation Plan

## Objective

Deliver an installable DeepSeek Harness bundle that adds an OpenAI Codex plan-usage meter to the right edge of the sidebar Settings trigger, updates safely, and exposes detailed limits without exposing credentials or identity data.

## Design decisions

1. **Use the official Codex app-server.** The stable account/rateLimits/read API handles file/keyring credentials and OAuth refresh. The private wham endpoint is intentionally not used.
2. **Use a Host bridge.** Browser code cannot and should not access Codex credentials. The Host owns one app-server process and a read-only DSH Web route restricted to loopback connections, local Host values, and same-origin browser signals.
3. **Normalize by allowlist.** Only documented quota fields cross into the browser. Raw payloads and identity fields are discarded.
4. **Honor DSH composition.** The bundle ships bundle metadata, a Cordis patch, a Host schema, client metadata, and the required lazy-CJS artifact.
5. **Match the requested placement.** Since the sidebar Settings content is a single slot, the plugin shadows it at priority -10 and recreates the built-in gear/label before adding the meter. It does not replace the Settings shell or dialog.
6. **Control request volume twice.** The client debounces hover, gates attempts, and coalesces in-flight calls; the Host applies separate poll/hover freshness windows, throttles failures, and keeps its provider fence until both RPCs settle.

## Delivery phases

- [x] Inspect official DSH plugin, bundle, client-module, slot, and packaging contracts.
- [x] Inspect official Codex app-server rate-limit and account protocols.
- [x] Scaffold package metadata, TypeScript, tsdown lazy-CJS output, and bundle patch.
- [x] Implement managed JSON-RPC lifecycle and loopback route.
- [x] Implement strict quota normalization and last-good caching.
- [x] Implement DSH-styled trigger, ring, OpenAI mark, and detailed hover panel.
- [x] Add configurable five-minute polling and protected hover refresh.
- [x] Add unit and live integration tests.
- [x] Add installation, security, configuration, and development documentation.
- [x] Validate package installation and composed rows against an isolated temporary DSH profile.
- [x] Complete an independent senior-maintainer security and lifecycle review.
- [ ] Visually inspect the plugin in a running Web UI after profile installation.
- [x] Initialize Git, review the final tree, and create the baseline commit.
