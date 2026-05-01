export const config = {
  woogoroApiBase: process.env.WOOGORO_API_BASE || "https://woogoro.com",
  parseQuoteEndpoint: "/api/parse-quote",
  woogoroMcpKey: process.env.WOOGORO_MCP_KEY || "",
  vertical: "roofing",
  requestTimeoutMs: 60_000,
  maxImageSizeBytes: 10 * 1024 * 1024,
  serverName: "woogoro-roofing-mcp",
  serverVersion: "0.0.1",
};
