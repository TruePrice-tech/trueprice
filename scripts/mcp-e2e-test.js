// End-to-end test of all 4 hosted Woogoro MCPs.
// Hits each endpoint with: (1) tools/list, (2) parse_* with a realistic
// fixture, (3) lookup_average_price for one item from the parsed result.
// Saves the full JSON-RPC response from each step to output/mcp-e2e-2026-05-02/
// so a human can read each one and assess "does this make sense?"
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "output", "mcp-e2e-2026-05-02");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const MCPS = [
  {
    slug: "medical",
    endpoint: "https://mcp.woogoro.com/mcp",
    healthz: "https://mcp.woogoro.com/healthz",
    parseTool: "parse_bill",
    parseArgs: {
      bill_text: [
        "Mercy Hospital - Charlotte NC",
        "Date of service: 2026-04-15",
        "Patient: John Doe (self-pay)",
        "",
        "99284 ED visit, level 4               $2,850.00",
        "71046 Chest x-ray, 2 views              $325.00",
        "36415 Venipuncture                       $45.00",
        "80048 Basic metabolic panel             $185.00",
        "J3010 Fentanyl 0.1mg                     $80.00",
        "J3010 Fentanyl 0.1mg                     $80.00",
        "99284 ED visit, level 4               $2,850.00",
        "Facility fee                            $500.00",
        "",
        "Total charges: $6,915.00",
        "Insurance allowed: $1,420.00",
        "Patient responsibility: $1,420.00",
      ].join("\n"),
    },
    lookupArgs: { cpt_code: "99284", state_code: "NC" },
  },
  {
    slug: "roofing",
    endpoint: "https://roofing-mcp.woogoro.com/mcp",
    healthz: "https://roofing-mcp.woogoro.com/healthz",
    parseTool: "parse_quote",
    parseArgs: {
      quote_text: [
        "ACME Roofing LLC - Charlotte NC",
        "Project: Tear-off and replace existing 22 squares",
        "Materials: GAF Timberline HDZ architectural shingles",
        "Underlayment: synthetic",
        "Drip edge: included",
        "Ice and water shield: 6 ft eaves",
        "Ridge vent: 40 LF",
        "(no decking line item)",
        "Disposal: included",
        "Permit: included",
        "",
        "Total: $14,500",
        "10-year workmanship warranty",
        "50% deposit due at signing",
      ].join("\n"),
      city: "Charlotte",
      state: "NC",
    },
    lookupArgs: { material: "architectural", state_code: "NC" },
  },
  {
    slug: "hvac",
    endpoint: "https://hvac-mcp.woogoro.com/mcp",
    healthz: "https://hvac-mcp.woogoro.com/healthz",
    parseTool: "parse_quote",
    parseArgs: {
      quote_text: [
        "ABC Heating & Air - Charlotte NC",
        "2.5 ton Carrier 16 SEER2 heat pump system",
        "Indoor: FV4CNF002 / Outdoor: 25HCC624A003",
        "AHRI: 211345678 (matched system)",
        "R-410A refrigerant (legacy stock)",
        "Furnace: 80% AFUE 80,000 BTU",
        "Installation labor: 1 day",
        "Permit: included",
        "",
        "Total: $9,200",
        "1 year workmanship warranty",
      ].join("\n"),
      city: "Charlotte",
      state: "NC",
    },
    lookupArgs: { system_type: "heat_pump", efficiency_tier: "16_seer", state_code: "NC" },
  },
  {
    slug: "auto-repair",
    endpoint: "https://auto-repair-mcp.woogoro.com/mcp",
    healthz: "https://auto-repair-mcp.woogoro.com/healthz",
    parseTool: "parse_quote",
    parseArgs: {
      quote_text: [
        "QuickFix Auto Service - Charlotte NC",
        "Vehicle: 2018 Honda Civic, 87,000 miles",
        "",
        "Front brake pads (Bosch QuietCast)    $180",
        "Front rotors (Brembo)                  $320",
        "Rear brake pads                        $150",
        "Rear rotors                            $290",
        "Labor: 4 hours @ $135/hr               $540",
        "Shop supplies                           $35",
        "Tax (parts only, 7%)                   $66.85",
        "",
        "Total: $1,581.85",
        "12 month / 12,000 mile warranty (parts only, no labor warranty)",
      ].join("\n"),
      city: "Charlotte",
      state: "NC",
    },
    lookupArgs: { shop_type: "independent", state_code: "NC" },
  },
];

async function rpc(endpoint, method, params, requestId) {
  const body = {
    jsonrpc: "2.0",
    id: requestId,
    method,
    params,
  };
  const t0 = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - t0;
  const text = await res.text();
  let parsed = null;
  try {
    if (text.startsWith("event:") || text.includes("\ndata:")) {
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) parsed = JSON.parse(dataLine.slice(5).trim());
    } else {
      parsed = JSON.parse(text);
    }
  } catch (e) {
    parsed = { _parse_error: e.message, _raw: text.slice(0, 500) };
  }
  return { status: res.status, elapsed, parsed, raw: text };
}

async function healthCheck(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - t0;
    const body = await res.text();
    return { status: res.status, elapsed, body };
  } catch (e) {
    return { status: 0, elapsed: Date.now() - t0, body: `network error: ${e.message}` };
  }
}

function summarize(label, rpcResult) {
  const r = rpcResult.parsed;
  if (!r) return `${label}: no parsed body`;
  if (r.error) return `${label}: JSON-RPC error: ${JSON.stringify(r.error)}`;
  const result = r.result;
  if (!result) return `${label}: no result field`;
  if (result.tools) return `${label}: ${result.tools.length} tools: [${result.tools.map((t) => t.name).join(", ")}]`;
  if (result.content) {
    const txt = result.content[0]?.text || "";
    let inner;
    try { inner = JSON.parse(txt); } catch { inner = txt.slice(0, 200); }
    if (inner && typeof inner === "object") {
      if (inner.success === false) return `${label}: tool returned success:false: ${inner.error}`;
      const keys = Object.keys(inner).slice(0, 8);
      return `${label}: tool returned success:${inner.success ?? "?"}, keys: [${keys.join(", ")}]`;
    }
    return `${label}: ${String(inner).slice(0, 120)}`;
  }
  return `${label}: ${JSON.stringify(result).slice(0, 200)}`;
}

(async () => {
  const summary = [];
  summary.push(`# Woogoro MCP end-to-end test — ${new Date().toISOString()}`);
  summary.push("");

  for (const mcp of MCPS) {
    console.log(`\n=== ${mcp.slug} ===`);
    const dir = path.join(OUT, mcp.slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 1. healthz
    const hz = await healthCheck(mcp.healthz);
    fs.writeFileSync(path.join(dir, "01-healthz.json"), JSON.stringify(hz, null, 2));
    console.log(`  healthz: ${hz.status} in ${hz.elapsed}ms`);

    // 2. tools/list
    const tools = await rpc(mcp.endpoint, "tools/list", {}, 1);
    fs.writeFileSync(path.join(dir, "02-tools-list.json"), JSON.stringify(tools.parsed, null, 2));
    console.log(`  tools/list: ${tools.status} in ${tools.elapsed}ms — ${summarize("", tools)}`);

    // 3. tools/call <parseTool>
    const parseRpc = await rpc(mcp.endpoint, "tools/call", { name: mcp.parseTool, arguments: mcp.parseArgs }, 2);
    fs.writeFileSync(path.join(dir, `03-${mcp.parseTool}.json`), JSON.stringify(parseRpc.parsed, null, 2));
    console.log(`  ${mcp.parseTool}: ${parseRpc.status} in ${parseRpc.elapsed}ms — ${summarize("", parseRpc)}`);

    // 4. tools/call lookup_average_price
    const lookupRpc = await rpc(mcp.endpoint, "tools/call", { name: "lookup_average_price", arguments: mcp.lookupArgs }, 3);
    fs.writeFileSync(path.join(dir, "04-lookup-average-price.json"), JSON.stringify(lookupRpc.parsed, null, 2));
    console.log(`  lookup_average_price: ${lookupRpc.status} in ${lookupRpc.elapsed}ms — ${summarize("", lookupRpc)}`);

    summary.push(`## ${mcp.slug} — ${mcp.endpoint}`);
    summary.push(`- healthz: ${hz.status} (${hz.elapsed}ms)`);
    summary.push(`- tools/list: ${tools.status} (${tools.elapsed}ms) — ${summarize("", tools).trim()}`);
    summary.push(`- ${mcp.parseTool}: ${parseRpc.status} (${parseRpc.elapsed}ms) — ${summarize("", parseRpc).trim()}`);
    summary.push(`- lookup_average_price: ${lookupRpc.status} (${lookupRpc.elapsed}ms) — ${summarize("", lookupRpc).trim()}`);
    summary.push("");
  }

  fs.writeFileSync(path.join(OUT, "_summary.md"), summary.join("\n"));
  console.log(`\nfull JSON saved to ${OUT}`);
  console.log(`summary: ${path.join(OUT, "_summary.md")}`);
})().catch((e) => { console.error(e); process.exit(1); });
