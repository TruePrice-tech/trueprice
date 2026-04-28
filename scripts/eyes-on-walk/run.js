// Eyes-on walk dispatcher. Two modes:
//   node scripts/eyes-on-walk/run.js <vertical>            # one vertical
//   node scripts/eyes-on-walk/run.js --rotation            # 2 verticals based on day-of-month rotation
//   node scripts/eyes-on-walk/run.js --triggered <files>   # tier-1: walk verticals affected by changed files
//
// Writes output to output/eyes-on-<vertical>-<YYYY-MM-DD>/ with FINDINGS.md
// + screenshots + per-page console logs. Sends an ntfy alert if any
// high-severity issue is flagged (env: NTFY_TOPIC).

const fs = require("fs");
const path = require("path");
const { writeFindings, summaryLine } = require("./lib/findings");

const ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_ROOT = path.join(ROOT, "output");

// Verticals available to walk. Each runner is a thin config built on lib/runner.js.
const RUNNERS = {
  fencing: () => require("./runners/fencing"),
  hvac: () => require("./runners/hvac"),
  solar: () => require("./runners/solar"),
  plumbing: () => require("./runners/plumbing"),
  electrical: () => require("./runners/electrical"),
  gutters: () => require("./runners/gutters"),
  landscaping: () => require("./runners/landscaping"),
  "garage-door": () => require("./runners/garage-door"),
  concrete: () => require("./runners/concrete"),
  moving: () => require("./runners/moving"),
  windows: () => require("./runners/windows"),
  insulation: () => require("./runners/insulation"),
  roofing: () => require("./runners/roofing"),
  "auto-repair": () => require("./runners/auto-repair"),
  medical: () => require("./runners/medical"),
  // The following 5 are registered but have empty estimatePermutations
  // until manual selector verification (no prior <vertical>-walk.js):
  kitchen: () => require("./runners/kitchen"),
  siding: () => require("./runners/siding"),
  painting: () => require("./runners/painting"),
  foundation: () => require("./runners/foundation"),
  legal: () => require("./runners/legal"),
  // Cross-vertical SEO contract pass -- not a vertical proper, but slots
  // into the same dispatcher / digest pipeline. Invoke with `node run.js seo`
  // or as part of the new seo-gate workflow.
  seo: () => require("./runners/seo"),
};

// Stable rotation order. Day-of-month modulo 10 picks the slot pair.
const ROTATION = [
  ["roofing", "hvac"],
  ["solar", "plumbing"],
  ["electrical", "gutters"],
  ["landscaping", "medical"],
  ["legal", "moving"],
  ["auto-repair", "garage-door"],
  ["windows", "kitchen"],
  ["siding", "painting"],
  ["foundation", "concrete"],
  ["insulation", "fencing"],
];

// Tier-1 trigger map: which file patterns trigger which verticals to walk
// pre-commit. Loaded from triggers.json so it's data, not code.
function loadTriggers() {
  const file = path.join(__dirname, "triggers.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function todayStamp() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function notifyNtfy(title, message) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  const url = `https://ntfy.sh/${topic}`;
  try {
    await fetch(url, {
      method: "POST",
      body: message,
      headers: { Title: title, Priority: "default", Tags: "eyes" },
    });
  } catch (e) {
    console.error("[ntfy] failed:", e.message);
  }
}

async function runOne(vertical) {
  const loader = RUNNERS[vertical];
  if (!loader) {
    console.error(`No runner for ${vertical} (yet). Available: ${Object.keys(RUNNERS).join(", ")}`);
    return { vertical, skipped: true };
  }
  const runner = loader();
  const stamp = todayStamp();
  const outDir = path.join(OUTPUT_ROOT, `eyes-on-${vertical}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== EYES-ON: ${vertical} -> ${outDir} ===`);

  let result;
  try {
    result = await runner.run({ outDir });
  } catch (e) {
    console.error(`[${vertical}] FATAL:`, e.message);
    fs.writeFileSync(path.join(outDir, "FATAL.log"), e.stack || e.message);
    return { vertical, fatal: e.message, outDir };
  }

  const summary = writeFindings({
    outDir,
    vertical,
    runDate: stamp,
    paths: result.paths,
    fixtureErrors: result.fixtureErrors,
    walkErrors: result.walkErrors,
  });
  console.log(`[${vertical}] ${summary.counts.high}h ${summary.counts.medium}m ${summary.counts.low}l -> ${summary.file}`);
  return { vertical, outDir, ...summary, walkErrors: result.walkErrors };
}

function pickRotationPair() {
  const day = new Date().getUTCDate(); // 1..31
  const slot = (day - 1) % ROTATION.length;
  return ROTATION[slot];
}

function pickTriggeredVerticals(changedFiles) {
  const triggers = loadTriggers();
  const set = new Set();
  for (const f of changedFiles) {
    for (const [glob, verticals] of Object.entries(triggers.map)) {
      if (matchGlob(f, glob)) for (const v of verticals) set.add(v);
    }
  }
  return [...set];
}

function matchGlob(file, glob) {
  // Tiny glob: supports leading prefix and trailing /** wildcard
  if (glob.endsWith("/**")) return file.startsWith(glob.slice(0, -3) + "/");
  if (glob.includes("*")) {
    const re = new RegExp("^" + glob.replace(/\./g, "\\.").replace(/\*/g, "[^/]*") + "$");
    return re.test(file);
  }
  return file === glob;
}

(async () => {
  const args = process.argv.slice(2);
  let verticals;
  if (args.includes("--rotation")) {
    verticals = pickRotationPair();
  } else if (args[0] === "--triggered") {
    const files = args.slice(1);
    verticals = pickTriggeredVerticals(files);
    if (!verticals.length) {
      console.log("No tier-1 trigger files changed; skipping eyes-on walk.");
      return;
    }
  } else if (args.length > 0) {
    verticals = args;
  } else {
    console.error("Usage: run.js <vertical> | --rotation | --triggered <files...>");
    process.exit(2);
  }

  const lines = [];
  let highTotal = 0;
  for (const v of verticals) {
    const r = await runOne(v);
    if (r.fatal) {
      lines.push(`${v}: FATAL ${r.fatal}`);
      highTotal++;
      continue;
    }
    if (r.skipped) {
      lines.push(`${v}: no runner yet`);
      continue;
    }
    lines.push(summaryLine(r));
    highTotal += r.counts?.high || 0;
  }
  console.log("\n--- SUMMARY ---");
  for (const l of lines) console.log(l);

  if (highTotal > 0) {
    await notifyNtfy(
      `Eyes-on walk found ${highTotal} HIGH issue${highTotal === 1 ? "" : "s"}`,
      lines.join("\n")
    );
  }
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
