import { spawn } from "child_process";
import { resolve } from "path";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

async function main() {
  const serverPath = resolve(process.argv[2] || "dist/index.js");
  console.log(`Spawning MCP server: ${serverPath}`);

  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  let stderrBuf = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
  });

  let stdoutBuf = "";
  const pending = new Map<
    number,
    { resolve: (resp: JsonRpcResponse) => void; reject: (err: Error) => void }
  >();

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    let nl: number;
    while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        const handler = pending.get(msg.id);
        if (handler) {
          pending.delete(msg.id);
          handler.resolve(msg);
        }
      } catch (e) {
        console.warn("Could not parse line:", line);
      }
    }
  });

  let nextId = 0;
  function send(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = ++nextId;
    const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    const promise = new Promise<JsonRpcResponse>((resolveP, rejectP) => {
      pending.set(id, { resolve: resolveP, reject: rejectP });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          rejectP(new Error(`Timeout waiting for response to ${method}`));
        }
      }, 30_000);
    });
    child.stdin.write(JSON.stringify(req) + "\n");
    return promise;
  }

  let exitCode = 0;
  try {
    console.log("\n[1/3] initialize");
    const initRes = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "protocol-test", version: "0.0.1" },
    });
    if (initRes.error) throw new Error(`init error: ${JSON.stringify(initRes.error)}`);
    const result = initRes.result as { serverInfo?: { name: string; version: string } };
    console.log(
      `  server: ${result.serverInfo?.name} v${result.serverInfo?.version}`
    );

    child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    );

    console.log("\n[2/3] tools/list");
    const listRes = await send("tools/list");
    if (listRes.error) throw new Error(`list error: ${JSON.stringify(listRes.error)}`);
    const listResult = listRes.result as { tools: Array<{ name: string; description: string }> };
    console.log(`  ${listResult.tools.length} tools advertised:`);
    for (const t of listResult.tools) {
      console.log(`    - ${t.name}`);
    }

    const expected = ["parse_bill", "check_errors", "lookup_average_price", "draft_dispute", "negotiation_script"];
    for (const name of expected) {
      if (!listResult.tools.find((t) => t.name === name)) {
        throw new Error(`Expected tool '${name}' not advertised`);
      }
    }

    console.log("\n[3/3] tools/call lookup_average_price (offline tool)");
    const callRes = await send("tools/call", {
      name: "lookup_average_price",
      arguments: { cpt_code: "99213", state_code: "CA", facility_type: "physician_office" },
    });
    if (callRes.error) throw new Error(`call error: ${JSON.stringify(callRes.error)}`);
    const callResult = callRes.result as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    if (callResult.isError) {
      throw new Error(`Tool reported isError: ${JSON.stringify(callResult)}`);
    }
    const parsed = JSON.parse(callResult.content[0].text) as {
      success: boolean;
      adjusted_medicare_rate?: number;
      commercial_estimate?: number;
    };
    if (!parsed.success) {
      throw new Error(`Tool returned success=false: ${JSON.stringify(parsed)}`);
    }
    console.log(
      `  CPT 99213 in CA physician office: Medicare $${parsed.adjusted_medicare_rate}, commercial $${parsed.commercial_estimate}`
    );

    console.log("\nAll protocol tests passed.");
  } catch (err) {
    console.error("\nPROTOCOL TEST FAILED:", err instanceof Error ? err.message : err);
    if (stderrBuf) console.error("Server stderr:\n" + stderrBuf);
    exitCode = 1;
  } finally {
    child.kill();
    setTimeout(() => process.exit(exitCode), 200);
  }
}

main();
