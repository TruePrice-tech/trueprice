# MCP Directory Submission Kit — Roofing

Paste-ready content for listing the Woogoro Roofing Quote MCP on the major directories.

---

## Core content (reused across all 3 directories)

**Name:** Woogoro Roofing Quote Analyzer

**Tagline (≤80 chars):** Audit roofing contractor quotes, draft disputes, and negotiate via AI

**Short description (≤160 chars):**
Paste any roofing quote into Claude/Cursor/ChatGPT — get scope-gap detection, state-adjusted price benchmarks, dispute letters, and negotiation scripts. Free.

**Long description:**

Woogoro Roofing MCP brings consumer roofing quote analysis directly into Claude Desktop, Cursor, and any MCP-compatible AI assistant. Paste a roofing contractor quote (full replacement or repair), and the assistant will:

- **Detect scope gaps** — missing tear-off, underlayment, ice shield, flashing, ridge vent, decking change-order risk
- **Compare prices to state-adjusted benchmarks** ($/square, by material tier and pitch complexity) using Woogoro's flywheel of real quotes
- **Flag warranty inadequacy** — manufacturer vs workmanship coverage, transferability, length below industry standard
- **Identify material mismatches** — bid material vs proposed install
- **Draft dispute letters** across 8 scope/warranty/pricing issue types
- **Generate phone negotiation scripts** for multi-quote leverage, price match, warranty extension, decking-cap requests

Backed by Woogoro's `/api/parse-quote` endpoint (Claude Haiku-powered) and bundled state pricing data.

Free hosted endpoint. No API key required for end users.

**Tools (5):**
- `parse_quote` — Parse a roofing quote from text or images. Returns structured analysis + audit findings
- `check_errors` — Audit a parsed quote for scope gaps, price concerns, warranty issues
- `lookup_average_price` — Per-square ($/100 sqft) price lookup, state + pitch + complexity adjusted, 5 material tiers
- `draft_dispute` — Templated dispute letters across 8 issue types
- `negotiation_script` — Phone scripts for 5 negotiation scenarios with pushback responses

**Hosted endpoint:** `https://roofing-mcp.woogoro.com/mcp`

**Health check:** `https://roofing-mcp.woogoro.com/healthz`

**GitHub:** https://github.com/TruePrice-tech/trueprice (server lives in `mcp-roofing/`)

**Author:** Geoff Lane / Woogoro

**License:** MIT

**Categories/tags:** home-services, roofing, construction, consumer-protection, dispute-help, finance, claude, cursor, claude-desktop

**Install instructions for end users (hosted — recommended):**
```json
{
  "mcpServers": {
    "woogoro-roofing": {
      "url": "https://roofing-mcp.woogoro.com/mcp"
    }
  }
}
```
Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac). Restart Claude Desktop.

**Install instructions (stdio / local):**
```bash
git clone https://github.com/TruePrice-tech/trueprice.git
cd trueprice/mcp-roofing
npm install
npm run build
```
Then config:
```json
{
  "mcpServers": {
    "woogoro-roofing": {
      "command": "node",
      "args": ["/absolute/path/to/trueprice/mcp-roofing/dist/index.js"]
    }
  }
}
```

**Example prompt:**
> "Use the woogoro-roofing MCP to analyze this roof replacement quote: [paste quote]"

---

## 1. mcp.so

**URL:** https://mcp.so/submit

- Name → Woogoro Roofing Quote Analyzer
- Repo URL → https://github.com/TruePrice-tech/trueprice
- Tagline → from above
- Description → use Long description
- Categories → Home Services, Finance, Productivity
- Tags → from above
- Hosted URL → https://roofing-mcp.woogoro.com/mcp
- Logo → use `images/Iris/Iris-laurel-seal-512.png`

---

## 2. Smithery

**URL:** https://smithery.ai/server/new

- GitHub URL → https://github.com/TruePrice-tech/trueprice
- Smithery may auto-detect; we ship a `smithery.yaml` in `mcp-roofing/` to be explicit.

---

## 3. Glama

**URL:** https://glama.ai/mcp/servers/add

- GitHub repo URL → https://github.com/TruePrice-tech/trueprice
- Auto-detect from README. Manual fields: name, description, install instructions, tools list — use Core content above.

**Notes:** Glama runs an automated checker. Make sure `https://roofing-mcp.woogoro.com/healthz` returns 200 at submission time.

---

## Pre-submission checklist

- [x] [README.md](README.md) reflects hosted-first install
- [x] LICENSE file in repo (MIT)
- [x] Logo asset ready (`images/Iris/Iris-laurel-seal-512.png`)
- [x] `https://roofing-mcp.woogoro.com/healthz` returns 200
- [ ] Example prompt tested in at least Claude Desktop
