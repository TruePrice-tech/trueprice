#!/usr/bin/env node
/**
 * Refresh state-level energy prices from EIA (Energy Information Administration).
 *
 * Fetches residential electricity and natural gas prices by state.
 * Used by solar (payback calculation), HVAC (heat pump vs gas economics),
 * and insulation (ROI calculation) verticals.
 *
 * Run monthly: node scripts/refresh-energy-prices.js
 * Output: data/state-energy-prices.json
 *
 * Source: EIA Open Data API (free, DEMO_KEY for basic access)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "data", "state-energy-prices.json");
const API_KEY = process.env.EIA_API_KEY || "DEMO_KEY";

async function fetchEIA(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`EIA API error: ${resp.status}`);
  return resp.json();
}

async function main() {
  console.log("Fetching EIA energy prices...\n");

  // Electricity: residential retail price by state (cents/kWh)
  const elecUrl = `https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=${API_KEY}&frequency=annual&data%5B0%5D=price&facets%5Bsectorid%5D%5B%5D=RES&start=2025&length=200`;
  const elecData = await fetchEIA(elecUrl);

  // Natural gas: residential price by state ($/thousand cubic feet)
  const gasUrl = `https://api.eia.gov/v2/natural-gas/pri/sum/data/?api_key=${API_KEY}&frequency=annual&data%5B0%5D=value&facets%5Bprocess%5D%5B%5D=PRS&start=2024&length=200`;
  const gasData = await fetchEIA(gasUrl);

  const result = {
    metadata: {
      source: "EIA Open Data API",
      lastUpdated: new Date().toISOString().split("T")[0],
      electricityUnit: "cents per kWh (residential)",
      gasUnit: "dollars per thousand cubic feet (residential)",
    },
    electricity: {},
    gas: {},
    nationalAvg: { electricity: null, gas: null },
  };

  // Process electricity data
  const stateAbbrevs = new Set();
  if (elecData.response?.data) {
    for (const d of elecData.response.data) {
      const st = d.stateid;
      if (!st || st.length !== 2 || st === "US" || !d.price) continue;
      stateAbbrevs.add(st);
      result.electricity[st] = parseFloat(d.price);
    }
    // National average
    const usEntry = elecData.response.data.find(d => d.stateid === "US");
    if (usEntry) result.nationalAvg.electricity = parseFloat(usEntry.price);
  }

  // Process natural gas data
  if (gasData.response?.data) {
    for (const d of gasData.response.data) {
      // Gas data uses duoarea like "SFL" (state FL) or "NUS" (national US)
      const area = d.duoarea || "";
      if (area.length === 3 && area.startsWith("S")) {
        const st = area.slice(1);
        if (d.value && parseFloat(d.value) > 0) {
          result.gas[st] = parseFloat(d.value);
        }
      } else if (area === "NUS" && d.value) {
        result.nationalAvg.gas = parseFloat(d.value);
      }
    }
  }

  // Compute solar payback multiplier (ratio to national avg electricity)
  result.solarPaybackMultiplier = {};
  const natElec = result.nationalAvg.electricity || 16.0;
  for (const [st, price] of Object.entries(result.electricity)) {
    result.solarPaybackMultiplier[st] = Math.round((price / natElec) * 1000) / 1000;
  }

  // Compute heat pump vs gas favorability
  // Higher electricity = worse for heat pumps, lower gas = worse for heat pumps
  result.heatPumpFavorability = {};
  const natGas = result.nationalAvg.gas || 15.0;
  for (const st of stateAbbrevs) {
    const elec = result.electricity[st];
    const gas = result.gas[st];
    if (elec && gas) {
      // Heat pump is favorable when electricity is cheap relative to gas
      // Ratio: (gas_cost / nat_gas) / (elec_cost / nat_elec)
      // > 1 = heat pump favorable, < 1 = gas furnace favorable
      const favor = Math.round(((gas / natGas) / (elec / natElec)) * 1000) / 1000;
      result.heatPumpFavorability[st] = favor;
    }
  }

  console.log("Electricity prices (top 10 most expensive):");
  const sortedElec = Object.entries(result.electricity).sort((a, b) => b[1] - a[1]);
  for (const [st, p] of sortedElec.slice(0, 10)) {
    console.log(`  ${st}: ${p} c/kWh (solar payback: ${result.solarPaybackMultiplier[st]}x)`);
  }

  console.log("\nElectricity prices (5 cheapest):");
  for (const [st, p] of sortedElec.slice(-5)) {
    console.log(`  ${st}: ${p} c/kWh (solar payback: ${result.solarPaybackMultiplier[st]}x)`);
  }

  console.log(`\nNational avg electricity: ${result.nationalAvg.electricity} c/kWh`);
  console.log(`National avg gas: ${result.nationalAvg.gas} $/Mcf`);
  console.log(`States with electricity data: ${Object.keys(result.electricity).length}`);
  console.log(`States with gas data: ${Object.keys(result.gas).length}`);

  if (Object.keys(result.heatPumpFavorability).length > 0) {
    console.log("\nHeat pump favorability (top 5 / bottom 5):");
    const sortedHP = Object.entries(result.heatPumpFavorability).sort((a, b) => b[1] - a[1]);
    for (const [st, f] of sortedHP.slice(0, 5)) console.log(`  ${st}: ${f}x (heat pump favorable)`);
    console.log("  ...");
    for (const [st, f] of sortedHP.slice(-5)) console.log(`  ${st}: ${f}x (gas furnace favorable)`);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log("\nWrote", OUTPUT);
}

main().catch(e => { console.error(e); process.exit(1); });
