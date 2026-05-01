export const config = {
  woogoroApiBase: process.env.WOOGORO_API_BASE || "https://woogoro.com",
  hvacEndpoint: "/api/hvac-estimate",
  woogoroMcpKey: process.env.WOOGORO_MCP_KEY || "",
  vertical: "hvac",
  requestTimeoutMs: 60_000,
  maxImageSizeBytes: 10 * 1024 * 1024,
  serverName: "woogoro-hvac-mcp",
  serverVersion: "0.0.1",
};
