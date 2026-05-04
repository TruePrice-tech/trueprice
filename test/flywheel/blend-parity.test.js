// Guards against drift between the API-side blendEstimate / blendMid (in
// api/_flywheel-read.js) and the frontend FlywheelBlend.blendMid (in
// js/flywheel-blend.js). Both rely on calBlendWeight; if the API curve changes
// without the frontend mirror updating, the verdict math diverges silently.
//
// Run: node test/flywheel/blend-parity.test.js

import { calBlendWeight, blendMid, blendEstimate } from "../../api/_flywheel-read.js";
import fs from "fs";
import path from "path";
import vm from "vm";

const failures = [];

function expect(name, cond, detail) {
  if (cond) return;
  failures.push(`FAIL ${name}: ${detail || "assertion failed"}`);
}

// 1. calBlendWeight thresholds match the curve documented in the memo.
{
  expect("calBlendWeight 0", calBlendWeight(0).calWeight === 0, "0 quotes => 0 weight");
  expect("calBlendWeight 1", calBlendWeight(1).calWeight === 0, "1 quote => 0 weight");
  expect("calBlendWeight 2", calBlendWeight(2).calWeight === 0, "2 quotes => 0 weight");
  expect("calBlendWeight 3", Math.abs(calBlendWeight(3).calWeight - 0.25) < 1e-9, "3 quotes => 0.25");
  expect("calBlendWeight 9", Math.abs(calBlendWeight(9).calWeight - 0.25) < 1e-9, "9 quotes => 0.25");
  expect("calBlendWeight 10", Math.abs(calBlendWeight(10).calWeight - 0.50) < 1e-9, "10 quotes => 0.50");
  expect("calBlendWeight 24", Math.abs(calBlendWeight(24).calWeight - 0.50) < 1e-9, "24 quotes => 0.50");
  expect("calBlendWeight 25", Math.abs(calBlendWeight(25).calWeight - 0.70) < 1e-9, "25 quotes => 0.70");
  expect("calBlendWeight 100", Math.abs(calBlendWeight(100).calWeight - 0.70) < 1e-9, "100 quotes => 0.70");
}

// 2. blendMid (API side) returns model-only when below threshold.
{
  const out = blendMid(10000, { avgPrice: 8000, quotes: 2 });
  expect("blendMid <3 model_only", !out.applied && out.mid === 10000, JSON.stringify(out));
}

// 3. blendMid math at 10 quotes (50/50): mid should be modelMid*0.5 + calAvg*0.5.
{
  const out = blendMid(10000, { avgPrice: 8000, quotes: 10 });
  expect("blendMid 50/50 applied", out.applied && out.mid === 9000, JSON.stringify(out));
  expect("blendMid 50/50 confidence", out.confidence === "medium", out.confidence);
}

// 4. Frontend FlywheelBlend (loaded via VM) returns the same blended mid.
{
  const src = fs.readFileSync(path.join(process.cwd(), "js", "flywheel-blend.js"), "utf-8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const FB = sandbox.window.FlywheelBlend;
  expect("frontend FlywheelBlend exists", !!FB, "global not exported");

  const cases = [
    { modelMid: 9950, cal: { avgPrice: 7800, quotes: 12 } },
    { modelMid: 12000, cal: { avgPrice: 9000, quotes: 30 } },
    { modelMid: 5000, cal: { avgPrice: 5500, quotes: 5 } },
    { modelMid: 8000, cal: { avgPrice: 6000, quotes: 2 } }, // below threshold
    { modelMid: 800, cal: { avgPrice: 950, quotes: 3 } }
  ];
  for (const c of cases) {
    const apiOut = blendMid(c.modelMid, c.cal);
    const feOut = FB.blendMid(c.modelMid, c.cal);
    expect(
      `parity mid q=${c.cal.quotes}`,
      Math.abs(apiOut.mid - feOut.mid) < 1e-6,
      `api=${apiOut.mid} fe=${feOut.mid}`
    );
    expect(
      `parity confidence q=${c.cal.quotes}`,
      apiOut.confidence === feOut.confidence,
      `api=${apiOut.confidence} fe=${feOut.confidence}`
    );
    expect(
      `parity applied q=${c.cal.quotes}`,
      apiOut.applied === feOut.applied,
      `api=${apiOut.applied} fe=${feOut.applied}`
    );
  }
}

// 5. Lone Star Concrete fixture from the queued memo.
//    Plano TX patio, 800 sqft, $7,800 quote.
//    Frontend benchmark (pre-blend) was $9,950 -> 0.78 ratio -> "Below Average".
//    With a hypothetical 12-quote cal:* avg of $7,800 (50/50 blend), benchmark
//    swings to $8,875 -> 0.879 -> "Below Average" still.  With 25+ quotes,
//    benchmark = $9,950*0.30 + $7,800*0.70 = $8,445 -> 0.923 -> "Fair Price". ✓
{
  // 12 quotes, 50/50 blend
  const out12 = blendMid(9950, { avgPrice: 7800, quotes: 12 });
  expect("lone-star 12q blended mid", Math.abs(out12.mid - 8875) < 1, `got ${out12.mid}`);
  expect("lone-star 12q ratio < fair-floor", 7800 / out12.mid < 0.90, `ratio=${(7800/out12.mid).toFixed(3)}`);

  // 25+ quotes, 70/30 blend - flips to Fair Price (verdict band 0.90-1.12)
  const out25 = blendMid(9950, { avgPrice: 7800, quotes: 25 });
  expect("lone-star 25q blended mid", Math.abs(out25.mid - 8445) < 1, `got ${out25.mid}`);
  const ratio25 = 7800 / out25.mid;
  expect("lone-star 25q verdict swings to Fair Price", ratio25 >= 0.90 && ratio25 <= 1.12, `ratio=${ratio25.toFixed(3)}`);
}

// 6. blendEstimate range path uses the same weight curve.
{
  const range = { low: 8000, high: 12000 };
  const out = blendEstimate(range, { avgPrice: 8000, quotes: 10 });
  // model mid = 10000, cal mid = 8000, blend = 9000 at 50/50
  // spread = 2000, divergence = 0.20 (<0.30 so no widening)
  expect("blendEstimate range mid", (out.adjustedRange.low + out.adjustedRange.high) / 2 === 9000, JSON.stringify(out.adjustedRange));
  expect("blendEstimate confidence", out.confidence === "medium", out.confidence);
}

if (failures.length === 0) {
  console.log("[flywheel/blend-parity] all checks passed");
  process.exit(0);
} else {
  console.error("[flywheel/blend-parity] " + failures.length + " failure(s):");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
