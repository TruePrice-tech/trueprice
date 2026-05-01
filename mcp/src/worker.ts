import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { config } from "./config.js";
import { toolDefinitions, runTool } from "./tools/index.js";

interface Env {
  WOOGORO_API_BASE?: string;
  WOOGORO_MCP_KEY?: string;
}

function buildServer(): Server {
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

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.WOOGORO_API_BASE) {
      (config as { woogoroApiBase: string }).woogoroApiBase = env.WOOGORO_API_BASE;
    }
    if (env.WOOGORO_MCP_KEY) {
      (config as { woogoroMcpKey: string }).woogoroMcpKey = env.WOOGORO_MCP_KEY;
    }

    const url = new URL(request.url);

    if (url.pathname === "/healthz" || url.pathname === "/") {
      return Response.json({
        ok: true,
        server: config.serverName,
        version: config.serverVersion,
        endpoint: "/mcp",
      });
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") {
      return Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed" },
          id: null,
        },
        { status: 405 }
      );
    }

    const server = buildServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      return await transport.handleRequest(request);
    } catch (err) {
      console.error("MCP request error:", err);
      return Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        },
        { status: 500 }
      );
    }
  },
};
