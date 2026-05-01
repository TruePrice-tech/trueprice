# Phase 1 Build Status

## Decision context

Per session 2026-04-29: building patient-side medical bill audit MCP, bolted onto Woogoro infrastructure rather than standalone. Subdomain reserved at `mcp.woogoro.com` (placeholder DNS in Cloudflare). Confidence on the bet: 40-50%.

Hosting target switched 2026-04-30 from Fly.io ($5/mo minimum) to **Cloudflare Workers ($0/mo at our scale)** per Lane's free-first preference. Fly.io implementation was reverted — see commit `c79292ccef`.

## Status

Phase 1 functional core: COMPLETE. All five tools working end-to-end. Smoke test passing. Self-install verified 2026-04-30 (Lane installed locally, ran a real bill end-to-end against live Woogoro API).

Phase 1.5 hosted-transport code: COMPLETE. Cloudflare Worker entry at [src/worker.ts](./src/worker.ts), config at [wrangler.toml](./wrangler.toml). Pricing-data loader refactored to use bundled JSON import (works in both Node-stdio and Workers-runtime contexts). Wrangler dry-run succeeds: 792 KiB raw / 148 KiB gzipped — well under Workers' 1 MiB free-tier script limit.

Deploy + custom-domain claim: pending Lane's hands.

## Tools shipped

| Tool | Status | Implementation |
|---|---|---|
| `parse_bill` | Done | Bridges to `/api/medical-bill-estimate`. Returns structured analysis + LLM-friendly summary. |
| `check_errors` | Done | Extracts errors/disputes from a parsed bill (or fresh parse). |
| `lookup_average_price` | Done | In-memory lookup against bundled CPT pricing data (146 most common codes). State + facility adjustments. |
| `draft_dispute` | Done | Templated letters across 9 error types: unbundling, balance billing, upcoding, duplicate charges, No Surprises Act, facility fee, out-of-network, preventive care violation, general. Cites relevant statutes (42 USC 300gg-111, NCCI rules, ACA preventive care). |
| `negotiation_script` | Done | Three scenarios: cannot_pay (charity care + 501(r) leverage), partial_payment (cash settlement negotiation), full_payment_for_discount (prompt-pay discount). Includes pushback responses. |

## Architecture

The MCP server is a thin wrapper. It does NOT re-implement the medical bill parser. It calls `https://woogoro.com/api/medical-bill-estimate` for parsing, and uses bundled `data/medical-cpt-pricing.json` for offline pricing lookups. Letter and script generation are templated locally.

**Data flow:**
- `parse_bill` and `check_errors` (with image/text input) → Woogoro API (Claude Haiku analyzes)
- `lookup_average_price` → bundled JSON (no network)
- `draft_dispute` and `negotiation_script` → templates (no network)

**Why this split:** keeps the LLM-vision parsing centralized at Woogoro (so the analyzer stays one source of truth), while making the structured / templated tools work offline for zero-latency responses.

## Build / test

```bash
cd mcp
npm install
npm run build      # syncs pricing data, compiles TS, copies data into dist/
npm run smoke      # runs offline tool smoke tests (lookup, draft, script)
node dist/index.js # starts the MCP server on stdio

# Workers (hosted) build verification:
npx wrangler deploy --dry-run --outdir=.wrangler-dryrun
```

## Phase 1.5 Workers deploy steps

Auth posture: open endpoint, no per-client auth. `WOOGORO_MCP_KEY` is held server-side as a Wrangler secret; clients never see it. Cloudflare DDoS + Woogoro API's 60/hr/IP rate limit are the only floors. Pull the deploy if abuse spikes.

One-time, when ready to ship:

```bash
cd mcp
npx wrangler login                                       # browser flow
npx wrangler secret put WOOGORO_MCP_KEY                  # paste the key from Vercel env
npm run worker:deploy                                    # = wrangler deploy

# Verify the *.workers.dev URL first (wrangler prints it):
curl https://woogoro-mcp.<account>.workers.dev/healthz
```

Custom domain (`mcp.woogoro.com`):

```
1. wrangler.toml already declares the route. After first deploy, Cloudflare
   will auto-create the custom domain on the Workers dashboard.
2. If it doesn't auto-claim: dashboard -> Workers & Pages -> woogoro-mcp ->
   Settings -> Triggers -> Custom Domains -> Add 'mcp.woogoro.com'.
3. Cloudflare auto-provisions SSL and overrides the existing placeholder
   CNAME on woogoro.com. No manual DNS edit needed.
4. Verify: `curl https://mcp.woogoro.com/healthz` -> {ok:true,...}.
```

Test the hosted MCP from a client:

```bash
curl -X POST https://mcp.woogoro.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Claude Desktop / Cursor config for hosted:

```json
{
  "mcpServers": {
    "woogoro": {
      "url": "https://mcp.woogoro.com/mcp"
    }
  }
}
```

Logs / debugging:

```bash
npm run worker:logs    # = wrangler tail (live log stream)
```

## Decisions still pending Lane's input

1. **Pricing model:** free MCP server + Woogoro Pro paywall on web for premium analysis features, vs paid MCP tier. Memory recommendation was free (gateway drug). Confirm.
2. **Listing strategy:** when to list on Smithery / Glama / mcp.so. Recommend after hosted deploy is up.
3. **Validation gate:** still owed. 5-10 outreach messages to recently-billed consumers asking "would you use this through Claude/ChatGPT?" The product is now testable.

## Open issues

- No integration test that hits the live Woogoro API. Smoke test only covers offline tools.
- No telemetry. We don't know who's using the MCP, how often, which tools are called.
- No rate limiting at the MCP layer. Woogoro API has 60 req/hour/IP; might want our own.
- CORS not relevant for stdio; matters when we add hosted SSE later.
- The pricing JSON sync is build-time. If CMS updates rates and Lane updates the master JSON, the MCP needs a rebuild and republish.

## Next session candidates

In rough priority order:

1. **Self-install test.** DONE 2026-04-30. Install instructions verified end-to-end against live Woogoro API.
2. **Phase 1.5 deploy.** Code complete. Lane runs `wrangler login` + `wrangler secret put WOOGORO_MCP_KEY` + `npm run worker:deploy`, then claims `mcp.woogoro.com` custom domain. ~10-15 min total.
3. **Validation outreach.** 5-10 LinkedIn messages. Drafts can be ready in minutes.
4. **Landing page.** Consumer-facing page on Woogoro explaining the MCP, install instructions, "see what's inside" example. Could go at woogoro.com/medical-bills/claude or similar.
5. **Listing on Smithery / Glama / mcp.so.** Submit after hosted deploy is verified.
6. **Pro tier integration.** Decide what (if any) MCP features sit behind Woogoro Pro vs free.
