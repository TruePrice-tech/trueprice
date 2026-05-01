# Phase 1 Build Status

## Decision context

Per session 2026-04-29: building patient-side medical bill audit MCP, bolted onto Woogoro infrastructure rather than standalone. Subdomain reserved at `mcp.woogoro.com` (placeholder DNS in Cloudflare). Confidence on the bet: 40-50%. Hosting target confirmed as Fly.io for Phase 1.5 hosted transport.

## Status

Phase 1 functional core: COMPLETE. All five tools working end-to-end. Smoke test passing.

Phase 1.5 hosted-transport code: COMPLETE locally (HTTP transport added behind `MCP_TRANSPORT=http`, Dockerfile + fly.toml landed). Deploy + DNS swap awaiting Lane's hands (see "Phase 1.5 deploy steps" below).

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

# Hosted (HTTP) mode locally:
MCP_TRANSPORT=http PORT=8080 node dist/index.js
curl http://localhost:8080/healthz
```

## Phase 1.5 deploy steps (Fly.io + DNS)

Auth posture: open endpoint, relies on Cloudflare in front and Woogoro API's existing 60/hr/IP rate limit. The MCP server holds `WOOGORO_MCP_KEY` server-side; clients never see it. Pull the deploy if abuse spikes.

One-time:

```bash
# 1. Install flyctl (PowerShell on Windows):
# iwr https://fly.io/install.ps1 -useb | iex

cd mcp
fly auth login                                      # browser flow
fly launch --no-deploy --copy-config --name woogoro-mcp --region iad
fly secrets set WOOGORO_MCP_KEY=<value-from-vercel-env>
fly deploy
fly status                                          # confirm machine is healthy
curl https://woogoro-mcp.fly.dev/healthz            # smoke test before DNS swap
```

DNS (Cloudflare):

```
1. In Cloudflare DNS for woogoro.com, find the existing `mcp` placeholder record.
2. Change it to: CNAME, name=mcp, target=woogoro-mcp.fly.dev, proxy=ON (orange cloud).
3. In Fly: `fly certs add mcp.woogoro.com` (auto-provisions Let's Encrypt; takes ~1-2 min).
4. Verify: `curl https://mcp.woogoro.com/healthz` (expect 200 + {ok:true,...}).
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

## Decisions still pending Lane's input

1. **Distribution:** stdio-only Phase 1 (current) vs add hosted SSE/HTTP at Phase 1.5. Recommend ship stdio first to validate. Hosted needs Fly.io setup.
2. **Pricing model:** free MCP server + Woogoro Pro paywall on web for premium analysis features, vs paid MCP tier. Memory recommendation was free (gateway drug). Confirm.
3. **Listing strategy:** when to list on Smithery / Glama / mcp.so. Recommend after Lane self-installs and verifies the install instructions are clear.
4. **Validation gate:** still owed. 5-10 outreach messages to recently-billed consumers asking "would you use this through Claude/ChatGPT?" The product is now testable; previously stub-heavy.

## Open issues

- No integration test that hits the live Woogoro API. Smoke test only covers offline tools.
- No telemetry. We don't know who's using the MCP, how often, which tools are called.
- No rate limiting at the MCP layer. Woogoro API has 60 req/hour/IP; might want our own.
- CORS not relevant for stdio; matters when we add hosted SSE later.
- The pricing JSON sync is build-time. If CMS updates rates and Lane updates the master JSON, the MCP needs a rebuild and republish.

## Next session candidates

In rough priority order:

1. **Self-install test.** DONE 2026-04-30. Lane installed locally and ran a real bill through it end-to-end. Install instructions verified.
2. **Validation outreach.** 5-10 LinkedIn messages this week. Drafts can be ready in minutes if you say go.
3. **Phase 1.5 hosted setup.** Code + Dockerfile + fly.toml landed 2026-04-30. Awaiting Lane to run the deploy steps documented above.
4. **Landing page.** Consumer-facing page on Woogoro explaining the MCP, install instructions, "see what's inside" example. Could go at woogoro.com/medical-bills/claude or similar.
5. **Listing on Smithery / Glama / mcp.so.** Submit now that self-install is verified.
6. **Pro tier integration.** Decide what (if any) MCP features sit behind Woogoro Pro vs free.
