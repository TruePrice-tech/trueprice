export const config = {
  woogoroApiBase: process.env.WOOGORO_API_BASE || "https://woogoro.com",
  medicalBillEndpoint: "/api/medical-bill-estimate",
  requestTimeoutMs: 60_000,
  maxImageSizeBytes: 10 * 1024 * 1024,
  serverName: "woogoro-mcp",
  serverVersion: "0.0.1",
};
