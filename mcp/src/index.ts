#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { config } from "./config.js";
import { toolDefinitions, runTool } from "./tools/index.js";

async function runStdio() {
  const server = new Server(
    { name: config.serverName, version: config.serverVersion },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await runTool(name, args ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${config.serverName} v${config.serverVersion} running on stdio`);
}

async function main() {
  const transport = (process.env.MCP_TRANSPORT || "stdio").toLowerCase();
  if (transport === "http") {
    const { startHttpServer } = await import("./http-server.js");
    const port = parseInt(process.env.PORT || "8080", 10);
    await startHttpServer(port);
  } else {
    await runStdio();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
