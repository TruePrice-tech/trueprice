# Phase 1 Build Status (started 2026-04-29 evening)

## Decision context

Per session 2026-04-29: building patient-side medical bill audit MCP, bolted onto Woogoro infrastructure rather than standalone. Subdomain reserved at `mcp.woogoro.com` (placeholder DNS in Cloudflare). Confidence on the bet: 40-50%.

## What's shipped tonight (2026-04-29 evening)

Foundation scaffold and one tool working end-to-end:

- `mcp/package.json` — TypeScript MCP server, depends on `@modelcontextprotocol/sdk` and `zod`
- `mcp/tsconfig.json` — TypeScript config (ES2022, strict)
- `mcp/src/config.ts` — Endpoint URLs, timeouts, server metadata
- `mcp/src/bridge/woogoro-api.ts` — Bridge to existing `/api/medical-bill-estimate` endpoint, full type definitions matching the existing API contract
- `mcp/src/index.ts` — MCP server entry point, stdio transport, tool registration
- `mcp/src/tools/index.ts` — Tool registry and dispatcher
- `mcp/src/tools/parse_bill.ts` — **WORKING** — wraps the existing analyzer
- `mcp/src/tools/check_errors.ts` — **WORKING** — extracts errors/disputes from a parsed bill (or fresh parse)
- `mcp/src/tools/lookup_average_price.ts` — Stub, Phase 2 (decision pending: data delivery via API endpoint vs bundled JSON)
- `mcp/src/tools/draft_dispute.ts` — Stub, Phase 2 (decision pending: templated vs LLM-generated)
- `mcp/src/tools/negotiation_script.ts` — Stub, Phase 2

## Architecture: thin bridge, not duplicate

The MCP server is intentionally a thin wrapper. It does NOT re-implement the medical bill parser. It calls `https://woogoro.com/api/medical-bill-estimate` and forwards the result to the LLM with structured + summary representations.

Why thin:
1. Woogoro already has a sophisticated parser with Medicare rate enrichment, NCCI unbundling detection, No Surprises Act compliance checks, GPCI multipliers, facility comparison logic. Re-implementing it loses fidelity.
2. Bug fixes and improvements to the analyzer ship to both web users and MCP users simultaneously.
3. The flywheel data capture (`tp:pricing_data` Redis list) keeps working through the MCP path because the existing API does it.

What the MCP server adds:
- MCP protocol compliance (tool definitions, schema validation, stdio transport)
- LLM-friendly output formatting (the `summary_for_llm` field in `parse_bill` output)
- Multi-tool orchestration (`check_errors` can take an already-parsed bill from `parse_bill` to skip re-parsing)
- Future tools that don't exist on the web side (`draft_dispute`, `negotiation_script`)

## Decisions deferred to Lane

These were not made tonight, in order of priority:

1. **Hosting target.** Fly.io vs Railway vs Vercel for the MCP server. Vercel doesn't fit well because MCP needs persistent stdio or SSE, not request-response. Recommend Fly.io. Decision needed before deploy.
2. **Distribution: stdio-only vs hosted.** Phase 1 ships stdio (user installs locally, points Claude Desktop at it). Hosted SSE/HTTP version requires Phase 1.5 infrastructure work. Decision: ship stdio first, add hosted later.
3. **Pricing tiers.** Free vs paid for the MCP server. Memory recommendation was free (gateway drug for Woogoro Pro web product). Confirm.
4. **Listing strategy.** Smithery + Glama + mcp.so timing. Don't list until Phase 1 complete and at least 2-3 of the stubs are real.
5. **Lookup data delivery.** `lookup_average_price` needs CPT pricing data. Two options: (a) expose `data/medical-cpt-pricing.json` via a new public endpoint at `/api/medical-cpt-lookup` so the MCP can fetch on demand; (b) bundle the JSON into the MCP server itself. Option (a) keeps single source of truth, (b) is faster to ship.
6. **Dispute letter approach.** Templated (predictable, low risk) vs LLM-generated (more personalized, higher risk of hallucination). Recommend templated for Phase 2.

## What needs validation before further build

The 40-50% confidence on this bet still rests on real buyer demand. The validation gate hasn't been cleared. Next session step: 5-10 outreach messages to recently-billed consumers asking "would you use a tool that helps you fight medical bills via Claude?"

## Build/test instructions

```bash
cd mcp
npm install
npm run build
node dist/index.js
```

That should print:
```
woogoro-mcp v0.0.1 running on stdio
```

To test the parse_bill tool against the live Woogoro API, point Claude Desktop at the built `dist/index.js` per README install steps, then ask it to analyze a medical bill. The MCP server forwards to https://woogoro.com/api/medical-bill-estimate which is already running and parsing bills for the website's users.

## Open issues

- No test suite yet. Phase 1 needs at least one integration test that hits the Woogoro API and validates the response shape.
- No rate limiting at the MCP layer. The Woogoro API has rate limiting (60 requests/hour per IP), but a hosted MCP server might want its own layer when multiple users share the same IP.
- No telemetry. We don't know who's using the MCP, how often, or which tools. Phase 2 may want this.
- CORS not relevant for stdio transport but matters when we add hosted SSE/HTTP transport later.

## Commit policy

Per memory `feedback_auto_commit.md`, will commit and push the foundation. Lane can review on the morning of 2026-04-30.
