// Discord webhook proxy for Google Apps Script.
//
// Why this exists: GAS shares outbound IPs across all users. When that pool
// gets hot, Cloudflare's edge throttles it with HTTP 429 + "error code: 1015"
// before the request ever reaches Discord. This Worker runs on Cloudflare's
// network from a different IP space, so GAS → Worker → Discord avoids the
// shared-IP throttle.
//
// Contract: POST to /fuel or /moon with ?key=<PROXY_KEY>. Body is forwarded
// verbatim. Discord's status, body, and rate-limit headers pass through.
//
// Required secrets (set with `wrangler secret put <NAME>`):
//   PROXY_KEY         - shared secret; caller must include ?key=<value>
//   FUEL_WEBHOOK_URL  - full Discord webhook URL for fuel reports
//   MOON_WEBHOOK_URL  - full Discord webhook URL for moon reports

const ROUTES = {
  fuel: "FUEL_WEBHOOK_URL",
  moon: "MOON_WEBHOOK_URL",
};

// Headers worth forwarding so callers can honor Discord's rate-limit signals.
const PASSTHROUGH_HEADERS = [
  "Retry-After",
  "X-RateLimit-Limit",
  "X-RateLimit-Remaining",
  "X-RateLimit-Reset",
  "X-RateLimit-Reset-After",
  "X-RateLimit-Bucket",
  "X-RateLimit-Global",
  "X-RateLimit-Scope",
];

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);

    if (!env.PROXY_KEY || url.searchParams.get("key") !== env.PROXY_KEY) {
      return new Response("Forbidden", { status: 403 });
    }

    const route = url.pathname.replace(/^\/+|\/+$/g, "");
    const envKey = ROUTES[route];
    if (!envKey) {
      return new Response(`Unknown route: ${route}`, { status: 404 });
    }
    const target = env[envKey];
    if (!target) {
      return new Response(`Route ${route} is not configured`, { status: 500 });
    }

    const body = await request.text();

    let discordResp;
    try {
      discordResp = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "optm-fuel-proxy/1.0 (+https://github.com/OrthelT/optm_fuel)",
        },
        body,
      });
    } catch (err) {
      return new Response("Upstream fetch failed: " + err.message, { status: 502 });
    }

    const respBody = await discordResp.text();
    const headers = new Headers();
    const ct = discordResp.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    for (const h of PASSTHROUGH_HEADERS) {
      const v = discordResp.headers.get(h);
      if (v) headers.set(h, v);
    }

    console.log(`POST /${route} → discord ${discordResp.status} (${respBody.length} bytes)`);
    return new Response(respBody, { status: discordResp.status, headers });
  },
};
