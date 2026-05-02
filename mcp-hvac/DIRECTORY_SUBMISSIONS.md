# MCP Directory Submission Kit — HVAC

Paste-ready content for listing the Woogoro HVAC Quote MCP on the major directories.

---

## Core content (reused across all 3 directories)

**Name:** Woogoro HVAC Quote Analyzer

**Tagline (≤80 chars):** Audit HVAC quotes for sizing, refrigerant, efficiency, and upsells via AI

**Short description (≤160 chars):**
Paste any HVAC quote into Claude/Cursor/ChatGPT — Manual J sizing checks, R-410A compliance, SEER2 minimums, dispute letters, and negotiation scripts. Free.

**Long description:**

Woogoro HVAC MCP brings consumer HVAC quote analysis directly into Claude Desktop, Cursor, and any MCP-compatible AI assistant. Paste an HVAC contractor quote (full system install, replacement, repair, or service), and the assistant will:

- **Detect oversizing** — proposed tonnage vs Manual J load calculation, the most common HVAC contractor error
- **Flag R-410A compliance issues** for 2026+ installs (EPA AIM Act phasedown — new equipment must use A2L refrigerants like R-454B or R-32)
- **Check efficiency vs federal minimums** — SEER2/HSPF2 by region (North vs South split air-conditioner standards)
- **Identify scope gaps** — missing Manual D ductwork sizing, line-set replacement, refrigerant recovery, permit pull
- **Catch common upsells** — UV lights, "indoor air quality" packages, extended warranties priced above market
- **Draft dispute letters** across 9 issue types (Manual J, refrigerant, efficiency, permit, scope)
- **Generate phone negotiation scripts** for multi-quote leverage, price match, equipment-tier negotiation

Backed by Woogoro's `/api/hvac-estimate` endpoint (Claude Haiku-powered) and bundled installed-price ranges.

Free hosted endpoint. No API key required for end users.

**Tools (5):**
- `parse_quote` — Parse an HVAC quote from text or images. Returns structured analysis + red flags
- `check_errors` — Audit a parsed quote for scope gaps, regulatory issues, warranty gaps, possible upsells
- `lookup_average_price` — Installed price ranges by system type, efficiency tier, and state
- `draft_dispute` — Templated dispute letters across 9 issue types
- `negotiation_script` — Phone scripts for 5 negotiation scenarios with pushback responses

**Hosted endpoint:** `https://hvac-mcp.woogoro.com/mcp`

**Health check:** `https://hvac-mcp.woogoro.com/healthz`

**GitHub:** https://github.com/TruePrice-tech/trueprice (server lives in `mcp-hvac/`)

**Author:** Geoff Lane / Woogoro

**License:** MIT

**Categories/tags:** home-services, hvac, heating-cooling, consumer-protection, dispute-help, finance, claude, cursor, claude-desktop

**Install instructions for end users (hosted — recommended):**
```json
{
  "mcpServers": {
    "woogoro-hvac": {
      "url": "https://hvac-mcp.woogoro.com/mcp"
    }
  }
}
```
Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac). Restart Claude Desktop.

**Install instructions (stdio / local):**
```bash
git clone https://github.com/TruePrice-tech/trueprice.git
cd trueprice/mcp-hvac
npm install
npm run build
```
Then config:
```json
{
  "mcpServers": {
    "woogoro-hvac": {
      "command": "node",
      "args": ["/absolute/path/to/trueprice/mcp-hvac/dist/index.js"]
    }
  }
}
```

**Example prompt:**
> "Use the woogoro-hvac MCP to analyze this HVAC replacement quote: [paste quote]"

---

## 1. mcp.so

**URL:** https://mcp.so/submit

- Name → Woogoro HVAC Quote Analyzer
- Repo URL → https://github.com/TruePrice-tech/trueprice
- Tagline → from above
- Description → use Long description
- Categories → Home Services, Finance, Productivity
- Tags → from above
- Hosted URL → https://hvac-mcp.woogoro.com/mcp
- Logo → use `images/Iris/Iris-laurel-seal-512.png`

---

## 2. Smithery

**URL:** https://smithery.ai/server/new

- GitHub URL → https://github.com/TruePrice-tech/trueprice
- We ship a `smithery.yaml` in `mcp-hvac/` to be explicit about the hosted URL.

---

## 3. Glama

**URL:** https://glama.ai/mcp/servers/add

- GitHub repo URL → https://github.com/TruePrice-tech/trueprice
- Auto-detects from README. Manual fields: name, description, install instructions, tools list — use Core content above.

**Notes:** Glama auto-checks the hosted endpoint. Make sure `https://hvac-mcp.woogoro.com/healthz` returns 200 at submission time.

---

## Pre-submission checklist

- [x] [README.md](README.md) reflects hosted-first install
- [x] LICENSE file in repo (MIT)
- [x] Logo asset ready (`images/Iris/Iris-laurel-seal-512.png`)
- [x] `https://hvac-mcp.woogoro.com/healthz` returns 200
- [ ] Example prompt tested in at least Claude Desktop
