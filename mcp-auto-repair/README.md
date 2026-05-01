# Woogoro Auto Repair MCP

MCP server for auto repair quote audit and dispute help. Bridges Claude Desktop / Cursor / any MCP-compatible AI assistant to Woogoro's auto repair analysis engine.

## What it does

Lets users ask their AI assistant to analyze auto repair quotes from dealers, independents, or chain shops. Detects inflated labor hours vs Mitchell/AllData book time, suspicious upsells, parts type mismatches (OEM billed vs aftermarket installed), Magnuson-Moss Warranty Act issues (manufacturer voiding warranty over aftermarket parts), recall/TSB work that should be free, and shop transparency gaps. Generates dispute letters and phone-negotiation scripts.

## Tools

| Tool | Description |
|---|---|
| `parse_quote` | Parse auto repair quote/invoice. Returns line items, urgency ranking, parts type, possible upsells, red flags. |
| `check_errors` | Audit a quote for inflated labor hours, scope gaps, parts type unclear, warranty issues. |
| `lookup_average_price` | Hourly labor rate ranges by shop type (dealer/independent/chain), state-adjusted. |
| `draft_dispute` | Templated dispute letters across 8 issue types. Includes Magnuson-Moss warranty protection. |
| `negotiation_script` | Phone scripts for 5 negotiation scenarios with pushback responses. |

## Hosted

```json
{
  "mcpServers": {
    "woogoro-auto-repair": {
      "url": "https://auto-repair-mcp.woogoro.com/mcp"
    }
  }
}
```

## License

MIT — see [LICENSE](./LICENSE).

## Disclaimer

This is an informational tool. The user is responsible for final decisions about repair authorization, dispute escalation, and warranty claims. This tool does not provide legal advice. Auto repair consumer protections vary significantly by state. For complex disputes (especially involving safety, warranty denial, or substantial dollar amounts), consult a local consumer attorney or your state's attorney general consumer protection division.
