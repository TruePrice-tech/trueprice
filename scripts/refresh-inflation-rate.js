#!/usr/bin/env node
/**
 * Refresh the inflation rate in pricing-adjustments.json using BLS CPI data.
 *
 * Series: CUUR0000SEHA (Maintenance and repair of owned homes)
 * Source: Bureau of Labor Statistics, free API (no key required, 25 req/day limit)
 *
 * Run: node scripts/refresh-inflation-rate.js
 *
 * What it does:
 *   1. Fetches the latest CPI data from BLS for home maintenance & repair
 *   2. Computes the annualized rate from the baseline year
 *   3. Updates pricing-adjustments.json with the real rate
 *   4. Reports the old vs new rate
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ADJUSTMENTS_FILE = path.join(ROOT, "data", "pricing-adjustments.json");
const BLS_SERIES = "CUUR0000SEHA";

async function main() {
  const adj = JSON.parse(fs.readFileSync(ADJUSTMENTS_FILE, "utf8"));
  const baseYear = adj.inflationBaseline.year;
  const oldRate = adj.inflationBaseline.annualRate;

  const currentYear = new Date().getFullYear();
  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${BLS_SERIES}?startyear=${baseYear}&endyear=${currentYear}`;

  console.log(`Fetching BLS CPI data (${BLS_SERIES})...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error("BLS API error:", res.status);
    process.exit(1);
  }

  const json = await res.json();
  if (json.status !== "REQUEST_SUCCEEDED") {
    console.error("BLS API failed:", json.message);
    process.exit(1);
  }

  const data = json.Results.series[0].data;

  // Find Jan of base year (or earliest available) and latest month
  const baseEntry = data.find(d => d.year === String(baseYear) && d.period === "M01" && d.value !== "-");
  const latestEntry = data.find(d => d.value !== "-"); // sorted newest first

  if (!baseEntry || !latestEntry) {
    console.error("Could not find base or latest CPI values");
    process.exit(1);
  }

  const baseCpi = parseFloat(baseEntry.value);
  const latestCpi = parseFloat(latestEntry.value);
  const latestMonth = parseInt(latestEntry.period.replace("M", ""));
  const latestYear = parseInt(latestEntry.year);

  // Months elapsed
  const monthsElapsed = (latestYear - baseYear) * 12 + latestMonth - 1; // Jan = month 0 of base year
  const yearsElapsed = monthsElapsed / 12;

  // Annualized rate
  const cumulativeInflation = latestCpi / baseCpi;
  const annualizedRate = Math.pow(cumulativeInflation, 1 / yearsElapsed) - 1;
  const roundedRate = Math.round(annualizedRate * 1000) / 1000;

  console.log(`\nBase CPI (Jan ${baseYear}): ${baseCpi}`);
  console.log(`Latest CPI (${latestEntry.periodName} ${latestEntry.year}): ${latestCpi}`);
  console.log(`Cumulative: ${((cumulativeInflation - 1) * 100).toFixed(2)}% over ${yearsElapsed.toFixed(1)} years`);
  console.log(`Annualized rate: ${(annualizedRate * 100).toFixed(2)}%`);
  console.log(`\nOld rate: ${(oldRate * 100).toFixed(1)}%`);
  console.log(`New rate: ${(roundedRate * 100).toFixed(1)}%`);
  console.log(`Change: ${((roundedRate - oldRate) * 100).toFixed(2)} pp`);

  // Update
  adj.inflationBaseline.annualRate = roundedRate;
  adj.inflationBaseline.description = `${(roundedRate * 100).toFixed(1)}% annual construction cost inflation from ${baseYear} baseline (BLS CPI CUUR0000SEHA, annualized Jan ${baseYear}-${latestEntry.periodName} ${latestEntry.year})`;
  adj.inflationBaseline.source = "BLS CPI Maintenance and Repair of Owned Homes (CUUR0000SEHA)";
  adj.inflationBaseline.lastUpdated = new Date().toISOString().split("T")[0];

  fs.writeFileSync(ADJUSTMENTS_FILE, JSON.stringify(adj, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${ADJUSTMENTS_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
