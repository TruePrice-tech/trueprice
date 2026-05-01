import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { config } from "./config.js";
import { toolDefinitions, runTool } from "./tools/index.js";

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

export async function startHttpServer(port: number): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, server: config.serverName, version: config.serverVersion });
  });

  app.post("/mcp", async (req, res) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const methodNotAllowed = (_req: express.Request, res: express.Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.error(
        `${config.serverName} v${config.serverVersion} listening on http://0.0.0.0:${port}`
      );
      resolve();
    });
  });
}
