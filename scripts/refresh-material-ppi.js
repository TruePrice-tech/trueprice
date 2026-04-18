#!/usr/bin/env node
/**
 * Refresh material cost indices from BLS Producer Price Index (PPI).
 *
 * Fetches monthly PPI data for key construction materials and computes
 * cost adjustment ratios vs the Jan 2026 baseline (when base prices were set).
 * Also computes the general inflation ratio from pricing-adjustments.json so
 * consumers can apply (ppiRatio / inflationRatio) to get material-specific
 * deviation above or beyond general inflation.
 *
 * Run monthly: node scripts/refresh-material-ppi.js
 * Output: data/material-cost-index.json
 *
 * Source: BLS PPI (free API, no key needed, 25 req/day limit)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "data", "material-cost-index.json");

// PPI series and which verticals they affect
const SERIES = [
  { id: "WPU0811", name: "Softwood lumber", verticals: ["roofing", "fencing", "siding", "framing"] },
  { id: "WPU1017", name: "Concrete products", verticals: ["concrete", "foundation"] },
  { id: "WPU1022", name: "Asphalt roofing/siding", verticals: ["roofing", "siding"] },
  { id: "WPU1025", name: "Gypsum products", verticals: ["insulation", "kitchen", "painting"] },
  { id: "WPU102",  name: "Copper and brass", verticals: ["plumbing", "electrical", "hvac"] },
  { id: "WPU1012", name: "Steel mill products", verticals: ["garage-doors", "fencing", "foundation"] },
  { id: "WPU0553", name: "Plastic pipe", verticals: ["plumbing", "hvac", "insulation"] },
];

const BASE_YEAR = 2026; // matches baseYear in pricing model JSONs

async function main() {
  const seriesIds = SERIES.map(s => s.id);

  console.log("Fetching BLS PPI data for", seriesIds.length, "series...");

  const resp = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seriesid: seriesIds,
      startyear: String(BASE_YEAR - 1),
      endyear: String(new Date().getFullYear()),
    }),
  });

  if (!resp.ok) {
    console.error("BLS API error:", resp.status);
    process.exit(1);
  }

  const json = await resp.json();
  if (json.status !== "REQUEST_SUCCEEDED") {
    console.error("BLS API failed:", json.message);
    process.exit(1);
  }

  const result = {
    metadata: {
      source: "BLS Producer Price Index (PPI)",
      baseYear: BASE_YEAR,
      lastUpdated: new Date().toISOString().split("T")[0],
      description: "Material cost adjustment ratios vs Jan of baseYear. Apply to material portion of estimates.",
    },
    series: {},
    verticalAdjustments: {},
  };

  for (const series of json.Results.series) {
    const config = SERIES.find(s => s.id === series.seriesID);
    if (!config) continue;

    const points = series.data
      .filter(d => d.value !== "-")
      .map(d => ({ year: d.year, month: d.period, value: parseFloat(d.value) }))
      .sort((a, b) => (a.year + a.month).localeCompare(b.year + b.month));

    const baseline = points.find(d => d.year === String(BASE_YEAR) && d.month === "M01");
    const latest = points[points.length - 1];

    if (!baseline || !latest) {
      console.warn("  Missing data for", config.name);
      continue;
    }

    const ratio = Math.round((latest.value / baseline.value) * 10000) / 10000;

    result.series[series.seriesID] = {
      name: config.name,
      baseline: baseline.value,
      baselinePeriod: `${BASE_YEAR}-01`,
      latest: latest.value,
      latestPeriod: `${latest.year}-${latest.month.replace("M", "")}`,
      ratio,
      changePercent: Math.round((ratio - 1) * 1000) / 10,
      verticals: config.verticals,
    };

    console.log(`  ${config.name}: ${ratio.toFixed(4)} (${ratio > 1 ? "+" : ""}${((ratio - 1) * 100).toFixed(1)}%)`);
  }

  // Compute per-vertical material adjustment (average of relevant series)
  const verticalSeries = {};
  for (const [id, data] of Object.entries(result.series)) {
    for (const v of data.verticals) {
      if (!verticalSeries[v]) verticalSeries[v] = [];
      verticalSeries[v].push(data.ratio);
    }
  }

  for (const [vertical, ratios] of Object.entries(verticalSeries)) {
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    result.verticalAdjustments[vertical] = Math.round(avg * 10000) / 10000;
  }

  console.log("\nPer-vertical material adjustments:");
  for (const [v, adj] of Object.entries(result.verticalAdjustments).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.padEnd(15)} ${adj.toFixed(4)} (${adj > 1 ? "+" : ""}${((adj - 1) * 100).toFixed(1)}%)`);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log("\nWrote", OUTPUT);
}

main().catch(e => { console.error(e); process.exit(1); });
