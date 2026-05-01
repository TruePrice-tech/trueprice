export const config = {
  woogoroApiBase: process.env.WOOGORO_API_BASE || "https://woogoro.com",
  autoRepairEndpoint: "/api/auto-repair-estimate",
  woogoroMcpKey: process.env.WOOGORO_MCP_KEY || "",
  vertical: "auto-repair",
  requestTimeoutMs: 60_000,
  maxImageSizeBytes: 10 * 1024 * 1024,
  serverName: "woogoro-auto-repair-mcp",
  serverVersion: "0.0.1",
};
