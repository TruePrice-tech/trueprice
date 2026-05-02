# MCP price-vs-baseline gap fix — next-session prompt

Queued 2026-05-02. Discovered via end-to-end test in
[output/mcp-e2e-2026-05-02/](../output/mcp-e2e-2026-05-02/).

Drop the block below into a fresh Claude Code session at the trueprice repo
root. Self-contained — assumes no memory of the discovery session.

---

```
Fix price-vs-baseline audit gap on 3 Woogoro MCP servers (roofing, HVAC, auto-repair).

CONTEXT (everything you need — fresh session, no memory):

Woogoro runs 4 hosted MCPs at *.woogoro.com/mcp on Cloudflare Workers
($0/mo). Each exposes parse_quote/parse_bill + check_errors +
lookup_average_price + draft_dispute + negotiation_script. Source lives in
mcp/, mcp-roofing/, mcp-hvac/, mcp-auto-repair/ in the trueprice repo.

GAP discovered via end-to-end test on 2026-05-02 (results in
output/mcp-e2e-2026-05-02/): roofing/HVAC/auto-repair return calibration
data + pricing context but check_errors never emits a redFlag when the
quote price materially exceeds the local baseline. Medical is fine — it
flags via Medicare ratios per line item.

Concrete repro from the e2e test:
- Roofing: parsed.price $14,500, calibration.avgPrice $8,440 (72% over).
  No finding.
- HVAC: parsed.totalPrice $9,200, pricingContext.expectedRange.high
  $8,302, calibration.avgPrice $7,330. No flag.
- Auto: parsed.totalPrice $1,581.85, calibration.avgPrice $795. No flag.

WHAT TO BUILD:

In each of mcp-roofing/, mcp-hvac/, mcp-auto-repair/, find the audit logic
that builds the redFlags / findings array (search src/tools/check_errors.ts
and the upstream API endpoint each MCP wraps — parse-quote /
hvac-estimate / auto-repair-estimate in api/). Add a price-vs-baseline
finding with this rule:

  if calibration.confidence in {"high", "medium"} AND quotes >= 5:
    delta = (quote_price - calibration.avgPrice) / calibration.avgPrice
    if delta > 0.25: flag SEVERITY medium, "Quote is X% above local avg"
    if delta > 0.50: flag SEVERITY high, "Quote is X% above local avg"
  else if pricingContext.expectedRange.high exists:
    if quote_price > expectedRange.high * 1.10: flag medium
    if quote_price > expectedRange.high * 1.25: flag high

Skip if confidence is "low_data" or "model_only" (already flagged in the
e2e test as unreliable). Don't flag UNDER-pricing, that's not the
consumer's problem.

VERIFY:
- Re-run scripts/mcp-e2e-test.js. The 3 fixtures above should now produce
  the new finding. Medical's behavior should be unchanged.
- For each MCP changed: cd mcp-<vertical> && npm run build && npm test if
  tests exist, then npm run worker:deploy to push to Cloudflare.
- Curl healthz on each redeployed endpoint to confirm 200.

DO NOT:
- Touch the medical MCP (mcp/) — already flags via Medicare ratios.
- Add new tools or change tool signatures.
- Edit api/parse-quote.js without checking what other endpoints depend on
  it (it serves the web analyzer too).

Commit per MCP with message format: "mcp-<vertical>: flag price >25% above
local baseline as medium finding (>50% as high)". Push to main; auto-deploy
via existing GH Actions. Update memory file
project_mcp_server_status.md with the new flag behavior and the date
shipped.
```
