# Phase 1 Build Status

## Decision context

Per session 2026-04-29: building patient-side medical bill audit MCP, bolted onto Woogoro infrastructure rather than standalone. Subdomain reserved at `mcp.woogoro.com` (placeholder DNS in Cloudflare). Confidence on the bet: 40-50%. Hosting target confirmed as Fly.io for Phase 1.5 hosted transport.

## Status

Phase 1 functional core: COMPLETE. All five tools working end-to-end. Smoke test passing.

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

1. **Self-install test.** Lane installs the MCP locally in Claude Desktop or Cursor and runs a real bill through it. Validates the install instructions and the parse_bill end-to-end against the live Woogoro API.
2. **Validation outreach.** 5-10 LinkedIn messages this week. Drafts can be ready in minutes if you say go.
3. **Phase 1.5 hosted setup.** Fly.io account, deploy config, DNS update from placeholder to Fly's CNAME, SSL. ~1-2 hours.
4. **Landing page.** Consumer-facing page on Woogoro explaining the MCP, install instructions, "see what's inside" example. Could go at woogoro.com/medical-bills/claude or similar.
5. **Listing on Smithery / Glama / mcp.so.** Submit after self-install verification.
6. **Pro tier integration.** Decide what (if any) MCP features sit behind Woogoro Pro vs free.
