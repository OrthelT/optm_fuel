# Changelog

Notable changes to `optm_fuel`. To pick up new versions, replace the contents of
your Apps Script project's `fuel-tracker.gs` (and `moon-tracker.gs` when changed)
with the latest from this repo, then re-save in the Apps Script editor. No
spreadsheet rebuild is required unless a release explicitly says so.

## 2026-05-18

### Reliability

- **Discord rate-limit handling rewritten.** `sendToDiscord` now caps any single
  sleep at 90 seconds and aborts the run cleanly when an upstream `Retry-After`
  asks for more. Previously, long Cloudflare 1015 backoffs (often minutes) would
  hit Google Apps Script's `Utilities.sleep` maximum and crash the entire
  execution with an opaque "Specified sleep period exceeds maximum" error.
- **Correct `retry_after` parsing.** Discord's webhook 429 responses include a
  canonical `retry_after` field in their JSON body (in seconds, float). The
  previous implementation read the HTTP `Retry-After` header and multiplied by
  1000, which double-scaled typical 3-second backoffs into nearly an hour.
  Discord JSON body is now the preferred source; the HTTP header is used only
  as a fallback for Cloudflare 1015 responses (which are RFC-seconds).
- **Multi-message batching in chunked dispatch.** `sendToDiscordChunked` now
  combines consecutive embeds into batches of up to 10 embeds OR 5800 total
  characters per HTTP POST — whichever limit comes first — so a chunked fuel
  report typically sends 1–3 requests instead of 5–10. Fewer requests means less
  contribution to Cloudflare's shared-IP rate bucket on GAS, materially
  reducing 1015 throttle frequency.
- **Failures now surface in the trigger dashboard.** Any non-2xx response that
  isn't retryable now throws, so failed runs show as `Error` in Apps Script
  Executions instead of silently logging and returning success. (Some prior
  versions swallowed certain webhook errors.)

### Diagnostics

- **400-response embed inventory.** When Discord rejects a payload, the log now
  includes a per-embed breakdown (`title=N desc=N fields=N`) so you can
  immediately see which embed exceeded which limit. The previous error message
  truncated Discord's response body and gave no hint about which embed was the
  problem.

### New features

- **POS reporting now Settings-configurable.** Starbase (POS) fuel reporting
  in scheduled runs is now gated by Settings cell **G11** ("Enable POS Reports").
  Set it to `Yes` to include POS data; any other value (default `No`) skips it.
  This means users whose authenticated character lacks the Director role or the
  `esi-corporations.read_starbases.v1` scope no longer see permission warnings
  cluttering their logs. The manual "Update POS Fuel Status" menu item is
  unaffected by the setting — it always tries to fetch, useful as a permission
  tester.
- **Cloudflare Worker proxy.** A new `proxy-worker/` subdirectory contains a
  small Cloudflare Worker that can be deployed by users hitting persistent
  1015 errors. Routes webhook traffic through a non-GAS IP, eliminating the
  shared-IP throttle entirely. Setup guide in `proxy-worker/SETUP.md`. Deploying
  the proxy is optional — users not seeing 1015 problems can ignore it.

### Cleanup

- Removed dead chunking branch in `reportFuelStatusToDiscord` (`embeds.length > 10`
  case). With at most ~8 embeds ever produced and the per-message limit being 10,
  the branch was unreachable. The dedicated `reportFuelStatusToDiscordChunked`
  function still handles large reports.

### Migration notes for existing users

- **No required action.** All universal changes are in `fuel-tracker.gs` only.
  Copy the latest file contents into your Apps Script editor, save, and your
  next trigger run picks them up.
- **POS users** (anyone whose corp uses starbases and wants them included in
  reports): after updating the script, add a value to Settings cell G11 — type
  `Yes` to keep POS reporting enabled. New setups created via "Create Fuel and
  Moon Sheets" get G11 pre-filled with `No` automatically.
- **If you've been hitting 1015 errors:** see `proxy-worker/SETUP.md` for the
  optional Cloudflare Worker. Universal fixes above reduce 1015 frequency but
  do not eliminate it; the Worker does.
