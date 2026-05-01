# Woogoro Roofing Quote MCP

MCP server for roofing contractor quote audit and dispute help. Bridges Claude Desktop / Cursor / any MCP-compatible AI assistant to Woogoro's roofing analysis engine.

## What it does

Lets users ask their AI assistant to analyze roofing contractor quotes (full replacement or repair). Identifies scope gaps (missing tear-off, underlayment, flashing, ice shield, ridge vent, decking change-order risk), price concerns vs state-adjusted benchmarks, warranty inadequacy, and material mismatches. Generates dispute letters and phone-negotiation scripts for common scenarios (multi-quote leverage, price match, warranty extension, decking caps).

## Tools

| Tool | Description |
|---|---|
| `parse_quote` | Parse a roofing quote from text or images. Returns structured analysis + audit findings. |
| `check_errors` | Audit a quote for scope gaps, price concerns, warranty issues. |
| `lookup_average_price` | Per-square ($/100 sqft) price lookup, state + pitch + complexity adjusted. 5 material tiers. |
| `draft_dispute` | Templated dispute letters across 8 issue types. |
| `negotiation_script` | Phone scripts for 5 negotiation scenarios with pushback responses. |

## Hosted

The hosted version runs at `https://roofing-mcp.woogoro.com/mcp`. Add to your MCP client config:

```json
{
  "mcpServers": {
    "woogoro-roofing": {
      "url": "https://roofing-mcp.woogoro.com/mcp"
    }
  }
}
```

No install required. No API key needed for end users.

## Local install (stdio)

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

## Architecture

The MCP is a thin wrapper around Woogoro's `/api/parse-quote` endpoint (Claude Haiku-powered) and bundled state-adjusted pricing data. Audit logic, lookup, dispute letter, and negotiation script generation happen locally in the Worker (no network round-trip).

## License

MIT — see [LICENSE](./LICENSE).

## Disclaimer

This is an informational tool. The user is responsible for final decisions about contractor selection, contract signing, and dispute escalation. This tool does not provide legal advice. For complex disputes (especially after work has begun, has been paid, or where damage has occurred), consult a local construction attorney.
