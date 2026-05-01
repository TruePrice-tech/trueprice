# Woogoro HVAC Quote MCP

MCP server for HVAC quote audit and dispute help. Bridges Claude Desktop / Cursor / any MCP-compatible AI assistant to Woogoro's HVAC analysis engine.

## What it does

Lets users ask their AI assistant to analyze HVAC quotes (full system install, replacement, repair, or service). Detects oversizing (Manual J vs proposed tonnage), R-410A compliance issues for 2026+ installs (EPA AIM Act), low-efficiency equipment below federal minimum, missing scope items, warranty gaps, and common upsells. Generates dispute letters and phone-negotiation scripts.

## Tools

| Tool | Description |
|---|---|
| `parse_quote` | Parse an HVAC quote from text or images. Returns structured analysis + red flags. |
| `check_errors` | Audit a quote for scope gaps, regulatory issues, warranty gaps, possible upsells. |
| `lookup_average_price` | Installed price ranges by system type, efficiency tier, and state. |
| `draft_dispute` | Templated dispute letters across 9 issue types (Manual J, refrigerant, efficiency, etc.). |
| `negotiation_script` | Phone scripts for 5 negotiation scenarios with pushback responses. |

## Hosted

```json
{
  "mcpServers": {
    "woogoro-hvac": {
      "url": "https://hvac-mcp.woogoro.com/mcp"
    }
  }
}
```

No install. No API key for end users.

## License

MIT — see [LICENSE](./LICENSE).

## Disclaimer

This is an informational tool. The user is responsible for final decisions about contractor selection, contract signing, and dispute escalation. This tool does not provide legal advice.
