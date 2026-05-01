# MCP Directory Submission Kit

Paste-ready content for listing the Woogoro Medical Bill MCP on the major directories. Submit in this order — mcp.so first (largest reach), then Smithery (best discovery in Cursor), then Glama (good for Claude Desktop discovery).

---

## Core content (reused across all 3)

**Name:** Woogoro Medical Bill Analyzer

**Tagline (≤80 chars):** Audit medical bills, draft disputes, and negotiate balances via AI

**Short description (≤160 chars):**
Paste any medical bill into Claude/Cursor/ChatGPT — get fair-price benchmarks, error detection, dispute letters, and negotiation scripts. Free, no API key.

**Long description:**

Woogoro MCP brings consumer medical bill analysis directly into Claude Desktop, Cursor, and any MCP-compatible AI assistant. Paste a bill (or attach an image), and the assistant will:

- **Compare line items to Medicare and commercial rates** for 146 of the most common CPT/HCPCS codes
- **Flag billing errors** — upcoding, unbundling (NCCI rule violations), duplicate charges, balance billing, No Surprises Act violations, facility-fee stacking
- **Draft dispute letters** across 9 error categories, citing relevant statutes (42 USC 300gg-111, NCCI bundling rules, ACA preventive care)
- **Generate phone negotiation scripts** for charity care applications, cash settlements, and prompt-pay discounts — with pushback responses

Backed by Woogoro's medical bill analysis API (Claude Haiku-powered) and a flywheel of 50+ real ER, hospital, and EOB samples.

Free hosted endpoint. No API key required for end users.

**Tools (5):**
- `parse_bill` — Analyze a bill from text or images, returns structured analysis with red flags and dispute actions
- `check_errors` — Extract billing errors from a parsed bill
- `lookup_average_price` — Medicare and commercial price lookup for any CPT/HCPCS code (state + facility adjusted)
- `draft_dispute` — Generate a formal dispute letter for a specific error type
- `negotiation_script` — Phone script for billing department calls (cannot pay / partial / prompt-pay scenarios)

**Hosted endpoint:** `https://mcp.woogoro.com/mcp`

**GitHub:** https://github.com/TruePrice-tech/trueprice (server lives in `mcp/`)

**Author:** Geoff Lane / Woogoro

**License:** TBD — check repo (add MIT before submitting if missing)

**Categories/tags:** healthcare, medical-billing, consumer-protection, dispute-help, finance, claude, cursor, claude-desktop, no-surprises-act

**Install instructions for end users (hosted — recommended):**
```json
{
  "mcpServers": {
    "woogoro": {
      "url": "https://mcp.woogoro.com/mcp"
    }
  }
}
```
Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac). Restart Claude Desktop.

**Install instructions (stdio / local):**
```bash
git clone https://github.com/TruePrice-tech/trueprice.git
cd trueprice/mcp
npm install
npm run build
```
Then config:
```json
{
  "mcpServers": {
    "woogoro": {
      "command": "node",
      "args": ["/absolute/path/to/trueprice/mcp/dist/index.js"]
    }
  }
}
```

**Example prompt:**
> "Use the woogoro MCP to analyze this ER bill: [paste bill]"

---

## 1. mcp.so

**URL:** https://mcp.so/submit

**What they ask for:**
- Name → Woogoro Medical Bill Analyzer
- Repo URL → https://github.com/TruePrice-tech/trueprice
- Tagline → from above
- Description → use Long description
- Categories → Healthcare, Finance, Productivity
- Tags → from above
- Hosted URL → https://mcp.woogoro.com/mcp
- Logo → use Iris-laurel-seal-512.png from images/Iris/

**Notes:** mcp.so re-pulls README from the repo periodically. Keep [mcp/README.md](README.md) clean and up-to-date.

---

## 2. Smithery

**URL:** https://smithery.ai/server/new

**What they ask for:**
- GitHub URL → https://github.com/TruePrice-tech/trueprice
- They'll ask for a `smithery.yaml` in the repo or auto-detect. Recommend adding one (see below).

**Optional — add `mcp/smithery.yaml`:**
```yaml
startCommand:
  type: http
  url: https://mcp.woogoro.com/mcp
displayName: Woogoro Medical Bill Analyzer
description: Audit medical bills, draft disputes, and negotiate balances via AI
homepage: https://woogoro.com/medical-bills
license: MIT
```

**Notes:** Smithery can also serve a stdio install via their proxy if you don't have a hosted URL. We have hosted, so prefer that.

---

## 3. Glama

**URL:** https://glama.ai/mcp/servers/add

**What they ask for:**
- GitHub repo URL → https://github.com/TruePrice-tech/trueprice
- They auto-detect from README. Make sure the README has clean install instructions.
- Manual submission also offers fields: name, description, install instructions, tools list. Use Core content above.

**Notes:** Glama runs an automated checker against MCP servers. Make sure the hosted endpoint is healthy when you submit (curl `https://mcp.woogoro.com/healthz` → should return 200).

---

## Pre-submission checklist

- [ ] [mcp/README.md](README.md) reflects hosted-first install (already done)
- [ ] LICENSE file in repo (add MIT if missing — most directories prefer this)
- [ ] Logo asset ready (160x160 PNG and 512x512 PNG; can use existing Iris-laurel-seal-512.png)
- [ ] `https://mcp.woogoro.com/healthz` returns 200 (already done)
- [ ] Example prompt tested in at least Claude Desktop (do this once context cache clears on your machine)

## Post-submission

- Each directory takes anywhere from instant to ~7 days to list (manual review for some)
- Watch for traffic in Cloudflare Workers analytics dashboard — Workers & Pages → woogoro-mcp → Metrics
- Listings sometimes auto-generate badges/install buttons for your README — paste the relevant ones into the README once issued
