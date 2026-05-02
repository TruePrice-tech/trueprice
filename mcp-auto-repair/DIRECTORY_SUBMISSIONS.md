# MCP Directory Submission Kit — Auto Repair

Paste-ready content for listing the Woogoro Auto Repair MCP on the major directories.

---

## Core content (reused across all 3 directories)

**Name:** Woogoro Auto Repair Quote Analyzer

**Tagline (≤80 chars):** Audit auto repair quotes, catch upsells, draft warranty disputes via AI

**Short description (≤160 chars):**
Paste any auto repair quote into Claude/Cursor/ChatGPT — book-time labor checks, upsell detection, Magnuson-Moss warranty disputes, recall/TSB checks. Free.

**Long description:**

Woogoro Auto Repair MCP brings consumer auto repair quote analysis directly into Claude Desktop, Cursor, and any MCP-compatible AI assistant. Paste an auto repair quote or invoice (dealer, independent, or chain shop), and the assistant will:

- **Compare labor hours to Mitchell/AllData book time** — the most common shop overbilling pattern
- **Flag suspicious upsells** — fuel-system flushes, "engine treatments", overpriced cabin filters, manufacturer-not-required services
- **Catch parts type mismatches** — OEM billed vs aftermarket installed
- **Apply Magnuson-Moss Warranty Act protections** (15 USC §§ 2301-2312) — manufacturers cannot void your warranty over aftermarket parts unless they prove the part caused the failure
- **Identify recall and TSB work** that should be free — NHTSA recalls and many manufacturer service bulletins are no-charge to the consumer
- **Flag shop transparency gaps** — written-estimate requirements, parts-return rights, and other state consumer protections
- **Draft dispute letters** across 8 issue types (warranty, labor inflation, parts mismatch, recall billing)
- **Generate phone negotiation scripts** for written-estimate requests, refusing upsells, recall enforcement

Backed by Woogoro's `/api/auto-repair-estimate` endpoint (Claude Haiku-powered) and bundled labor rate ranges.

Free hosted endpoint. No API key required for end users.

**Tools (5):**
- `parse_quote` — Parse an auto repair quote/invoice. Returns line items, urgency ranking, parts type, possible upsells, red flags
- `check_errors` — Audit a parsed quote for inflated labor hours, scope gaps, parts type unclear, warranty issues
- `lookup_average_price` — Hourly labor rate ranges by shop type (dealer/independent/chain), state-adjusted
- `draft_dispute` — Templated dispute letters across 8 issue types. Includes Magnuson-Moss warranty templates
- `negotiation_script` — Phone scripts for 5 negotiation scenarios with pushback responses

**Hosted endpoint:** `https://auto-repair-mcp.woogoro.com/mcp`

**Health check:** `https://auto-repair-mcp.woogoro.com/healthz`

**GitHub:** https://github.com/TruePrice-tech/trueprice (server lives in `mcp-auto-repair/`)

**Author:** Geoff Lane / Woogoro

**License:** MIT

**Categories/tags:** automotive, consumer-protection, magnuson-moss, dispute-help, finance, claude, cursor, claude-desktop, warranty

**Install instructions for end users (hosted — recommended):**
```json
{
  "mcpServers": {
    "woogoro-auto-repair": {
      "url": "https://auto-repair-mcp.woogoro.com/mcp"
    }
  }
}
```
Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac). Restart Claude Desktop.

**Install instructions (stdio / local):**
```bash
git clone https://github.com/TruePrice-tech/trueprice.git
cd trueprice/mcp-auto-repair
npm install
npm run build
```
Then config:
```json
{
  "mcpServers": {
    "woogoro-auto-repair": {
      "command": "node",
      "args": ["/absolute/path/to/trueprice/mcp-auto-repair/dist/index.js"]
    }
  }
}
```

**Example prompt:**
> "Use the woogoro-auto-repair MCP to analyze this dealer service quote: [paste quote]"

---

## 1. mcp.so

**URL:** https://mcp.so/submit

- Name → Woogoro Auto Repair Quote Analyzer
- Repo URL → https://github.com/TruePrice-tech/trueprice
- Tagline → from above
- Description → use Long description
- Categories → Automotive, Finance, Productivity
- Tags → from above
- Hosted URL → https://auto-repair-mcp.woogoro.com/mcp
- Logo → use `images/Iris/Iris-laurel-seal-512.png`

---

## 2. Smithery

**URL:** https://smithery.ai/server/new

- GitHub URL → https://github.com/TruePrice-tech/trueprice
- We ship a `smithery.yaml` in `mcp-auto-repair/` to be explicit about the hosted URL.

---

## 3. Glama

**URL:** https://glama.ai/mcp/servers/add

- GitHub repo URL → https://github.com/TruePrice-tech/trueprice
- Auto-detects from README. Manual fields: name, description, install instructions, tools list — use Core content above.

**Notes:** Glama auto-checks the hosted endpoint. Make sure `https://auto-repair-mcp.woogoro.com/healthz` returns 200 at submission time.

---

## Pre-submission checklist

- [x] [README.md](README.md) reflects hosted-first install
- [x] LICENSE file in repo (MIT)
- [x] Logo asset ready (`images/Iris/Iris-laurel-seal-512.png`)
- [x] `https://auto-repair-mcp.woogoro.com/healthz` returns 200
- [ ] Example prompt tested in at least Claude Desktop
