#!/usr/bin/env node
/**
 * Extract per-vertical fixture ground-truth from test/<vertical>/fixture-ground-truth.test.js
 * into a canonical JSON manifest the Theia head-to-head test consumes.
 *
 * Each test.js exposes a `const FIXTURES = [...]` with shape:
 *   { id, file, expect: { price, systemSizeRegex, panelBrandRegex, ... } }
 *
 * This script `vm.runInContext`s each test.js in a stub harness sandbox,
 * captures FIXTURES, serializes regexes to their source string, and writes
 * one JSON file per vertical to scripts/fixture-gt/<vertical>.json.
 *
 * Output JSON shape (regexes → source strings; string fields preserved):
 *   [
 *     {
 *       "id": "f1-sunset-low",
 *       "file": "test-quotes/solar-images/comparison-solar-01-low.png",
 *       "expect": {
 *         "price": 14940,
 *         "systemSizeRegex": "8(\\.0\\d)?\\s*kw",
 *         "panelBrandRegex": "hanwha|q[\\s.]*peak|q\\s*cells",
 *         ...
 *         "stateCode": "NV",
 *         "isLease": false
 *       }
 *     }, ...
 *   ]
 *
 * Usage:
 *   node scripts/extract_fixture_gt.js solar
 *   node scripts/extract_fixture_gt.js --all
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "scripts", "fixture-gt");
const TEST_DIR = path.join(ROOT, "test");

function listVerticals() {
  return fs.readdirSync(TEST_DIR).filter(name => {
    const tj = path.join(TEST_DIR, name, "fixture-ground-truth.test.js");
    return fs.existsSync(tj);
  });
}

function isRegexLike(val) {
  // Cross-realm safe: vm.runInContext creates a different RegExp constructor,
  // so `instanceof RegExp` returns false. Use Object.prototype.toString +
  // duck-typing on `source`/`flags`.
  if (val == null || typeof val !== "object") return false;
  if (Object.prototype.toString.call(val) === "[object RegExp]") return true;
  return typeof val.source === "string" && typeof val.flags === "string";
}

function serializeExpect(expect) {
  const out = {};
  for (const [key, val] of Object.entries(expect)) {
    if (isRegexLike(val)) {
      out[key] = val.source;
      out[key + "_flags"] = val.flags;
    } else {
      out[key] = val;
    }
  }
  return out;
}

function extractFixtures(vertical) {
  const tjPath = path.join(TEST_DIR, vertical, "fixture-ground-truth.test.js");
  if (!fs.existsSync(tjPath)) {
    return null;
  }
  const code = fs.readFileSync(tjPath, "utf8");

  // Stub harness modules so `require("../lib/harness-browser")` etc. don't
  // explode. We only want FIXTURES.
  const stubModule = new Proxy({}, { get: () => () => Promise.resolve() });
  const sandbox = {
    require: (mod) => {
      if (mod === "fs") return fs;
      if (mod === "path") return path;
      return stubModule;
    },
    module: { exports: {} },
    process: { env: {}, argv: ["node", tjPath], exit: () => {}, cwd: () => ROOT },
    __dirname: path.dirname(tjPath),
    __filename: tjPath,
    console,
    setTimeout, setInterval, clearTimeout, clearInterval,
    Promise, Buffer, URL,
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Wrap the file: capture FIXTURES if defined at module scope. We can't
  // assume the test.js declares FIXTURES with `const` (which isn't reachable
  // outside the script's lexical scope in vm) — but the convention in this
  // repo IS `const FIXTURES = [...]`. Workaround: append a line that copies
  // FIXTURES to globalThis. If the file calls main() at the bottom that
  // launches puppeteer, we need to NOT run that. So we replace the standard
  // entry-point pattern.
  let patched = code
    // Defang puppeteer / browser launches
    .replace(/^\s*main\(\)/m, "// main() defanged")
    .replace(/^\s*\(async\s*\(\)\s*=>\s*\{[\s\S]*?\}\)\(\)\s*;?\s*$/m, "// async-iife defanged");

  // Append capture line at end
  patched += "\n;globalThis.__FIXTURES = (typeof FIXTURES !== 'undefined') ? FIXTURES : null;\n";

  try {
    vm.runInContext(patched, sandbox, {
      filename: tjPath,
      timeout: 5000,
    });
  } catch (e) {
    console.error(`[${vertical}] runInContext error:`, e.message);
    return null;
  }

  const fixtures = sandbox.__FIXTURES;
  if (!Array.isArray(fixtures)) {
    console.error(`[${vertical}] FIXTURES not captured (got ${typeof fixtures})`);
    return null;
  }

  return fixtures.map(f => ({
    id: f.id,
    file: f.file,
    expect: f.expect ? serializeExpect(f.expect) : {},
  }));
}

function main() {
  const args = process.argv.slice(2);
  let targets;
  if (args.includes("--all")) {
    targets = listVerticals();
  } else if (args.length === 0) {
    console.error("Usage: node scripts/extract_fixture_gt.js <vertical> | --all");
    process.exit(1);
  } else {
    targets = args.filter(a => !a.startsWith("--"));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const vertical of targets) {
    const fixtures = extractFixtures(vertical);
    if (!fixtures) {
      console.log(`${vertical}: SKIPPED (extraction failed)`);
      continue;
    }
    const outPath = path.join(OUT_DIR, `${vertical}.json`);
    fs.writeFileSync(outPath, JSON.stringify(fixtures, null, 2));
    console.log(`${vertical}: ${fixtures.length} fixtures -> ${outPath}`);
  }
}

main();
