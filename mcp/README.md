# Woogoro MCP Server

[![smithery badge](https://smithery.ai/badge/glane0303/woogoro)](https://smithery.ai/servers/glane0303/woogoro)

MCP server for medical bill audit and dispute help. Bridges Claude / ChatGPT / Cursor / any MCP-compatible AI assistant to Woogoro's medical bill analysis engine.

## What it does

Lets users ask their AI assistant to analyze medical bills, identify potential errors (duplicate charges, upcoding, unbundling, balance billing, No Surprises Act violations), and get specific dispute actions, without leaving the assistant interface.

## Tools

| Tool | Description |
|---|---|
| `parse_bill` | Parse a medical bill from text or images. Returns structured analysis. |
| `check_errors` | Identify billing errors and dispute opportunities. |
| `lookup_average_price` | Look up Medicare/commercial price for a CPT code. |
| `draft_dispute` | Draft a dispute letter for a specific error type. |
| `negotiation_script` | Generate a phone negotiation script for billing department calls. |

## Install

### Prerequisites

- Node.js 18 or higher
- An MCP-compatible AI client (Claude Desktop, Cursor, Cline, Continue, etc.)

### From source

```bash
cd mcp
npm install
npm run build
```

### Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. The Woogoro tools should appear in the tool picker.

### Add to Cursor

Edit `~/.cursor/mcp.json`:

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

## Usage

In any MCP-compatible AI assistant:

> "I got a $7,400 bill from the ER. Can you analyze it?"
> 
> *User pastes bill text or attaches image*
> 
> *Assistant calls `parse_bill` and walks user through findings*

## Architecture

The MCP server is a thin wrapper around Woogoro's existing `/api/medical-bill-estimate` endpoint:

```
AI Assistant -> MCP Server (this repo) -> Woogoro API -> Claude analysis -> structured response
```

Tools live in `src/tools/`. The bridge to the Woogoro backend is in `src/bridge/woogoro-api.ts`.

## Development

```bash
npm run dev    # Watch mode
npm run build  # One-time build
npm start      # Run the built server
```

To test locally against a non-production Woogoro:

```bash
WOOGORO_API_BASE=http://localhost:3000 node dist/index.js
```

## Hosted

Once deployed, the hosted MCP runs on Cloudflare Workers at `https://mcp.woogoro.com/mcp` (Streamable HTTP transport). Point any MCP client at that URL — no install needed:

```json
{
  "mcpServers": {
    "woogoro": {
      "url": "https://mcp.woogoro.com/mcp"
    }
  }
}
```

Deploy steps live in [PHASE1.md](./PHASE1.md).

## Status

Phase 1 (functional core) complete. Phase 1.5 hosted-transport code complete (Cloudflare Worker entry at [src/worker.ts](./src/worker.ts), wrangler config at [wrangler.toml](./wrangler.toml)); deploy + custom-domain step still owed. See [PHASE1.md](./PHASE1.md).

## Disclaimer

This is an informational tool. The user is responsible for final decisions about disputing bills, contacting providers, or making payment arrangements. This tool does not provide legal, medical, or financial advice.
