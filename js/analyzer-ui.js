import {
  getSmartQuoteData,
  buildFinalData,
  setLastParsedData,
  setLatestAnalysis,
  findCityPricing,
  getNearestSizeLabel,
  getMaterialBenchmarkPerSqFt,
  formatCurrency,
  formatNumber,
  titleCase,
  getConfidenceLabel,
  lastParsedData
} from "./analyzer-core.js";

import {
  extractPriceCandidates,
  detectTotalLinePrice,
  detectMaterial,
  detectWarranty,
  detectContractor,
  detectRoofSize,
  detectLocation,
  detectScopeSignals,
  detectPremiumSignals,
  calculateParserConfidence,
  buildAIExplanation
} from "./analyzer-parser.js";

console.log("ANALYZER UI V7 LOADED");

export function setUploadStatus(message, type = "info") {
  const el = document.getElementById("uploadStatus");
  if (!el) return;

  el.className = `upload-status ${type}`;
  el.innerText = message;
}

function autoFillForm(parsed) {
  const quotePriceEl = document.getElementById("quotePrice");
  const roofSizeEl = document.getElementById("roofSize");
  const materialTypeEl = document.getElementById("materialType");
  const warrantyYearsEl = document.getElementById("warrantyYears");
  const cityNameEl = document.getElementById("cityName");
  const stateCodeEl = document.getElementById("stateCode");
  const tearOffEl = document.getElementById("tearOffIncluded");

  if (quotePriceEl) {
    quotePriceEl.value = parsed.price || "";
  }

  if (roofSizeEl) {
    roofSizeEl.value = Number(parsed.roofSize) > 0 ? parsed.roofSize : "";
  }

  if (materialTypeEl && parsed.material) {
    const normalizedMaterial = String(parsed.material).toLowerCase();
    let materialValue = parsed.material;

    if (normalizedMaterial.includes("architectural")) {
      materialValue = "architectural";
    } else if (normalizedMaterial.includes("asphalt")) {
      materialValue = "asphalt";
    } else if (normalizedMaterial.includes("metal")) {
      materialValue = "metal";
    } else if (normalizedMaterial.includes("tile")) {
      materialValue = "tile";
    }

    materialTypeEl.value = materialValue;
  }

  if (warrantyYearsEl) {
    warrantyYearsEl.value = Number(parsed.warrantyYears) > 0 ? parsed.warrantyYears : "";
  }

  if (cityNameEl) {
    cityNameEl.value = parsed.city || "";
  }

  if (stateCodeEl) {
    stateCodeEl.value = parsed.stateCode || "";
  }

  if (tearOffEl && parsed.signals?.tearOff?.status) {
    if (parsed.signals.tearOff.status === "included") {
      tearOffEl.value = "yes";
    } else if (parsed.signals.tearOff.status === "excluded") {
      tearOffEl.value = "no";
    } else {
      tearOffEl.value = "unknown";
    }
  }
}

export async function analyzeParsedText(text, extractionMethod, images = []) {
  const priceCandidates = extractPriceCandidates(text);

  let bestPrice = null;
  const forcedTotal = detectTotalLinePrice(text);

  if (forcedTotal) {
    bestPrice = forcedTotal;
  } else if (priceCandidates.length) {
    const sorted = [...priceCandidates].sort((a, b) => b.value - a.value);
    const largest = sorted[0];
    const second = sorted[1];

    if (!second) {
      bestPrice = largest.value;
    } else if (largest.value > second.value * 1.4) {
      bestPrice = largest.value;
    } else {
      bestPrice = priceCandidates
        .sort((a, b) => b.score - a.score || b.value - a.value)[0].value;
    }
  }

  const material = detectMaterial(text);
  const warranty = detectWarranty(text);
  const contractor = detectContractor(text);
  const roofSize = detectRoofSize(text);
  const location = detectLocation(text);
  const signals = detectScopeSignals(text);
  const premiumSignals = detectPremiumSignals(text, signals, roofSize.value, material.value);

  const parsed = {
    price: bestPrice,
    priceCandidates,
    material: material.value,
    materialLabel: material.label,
    warranty: warranty.label,
    warrantyYears: warranty.years,
    contractor,
    city: location.city,
    stateCode: location.stateCode,
    roofSize: roofSize.value,
    signals,
    premiumSignals,
    rawText: text,
    extractionMethod
  };

  parsed.confidenceScore = calculateParserConfidence(parsed);
  parsed.confidenceLabel = getConfidenceLabel(parsed.confidenceScore);

  let smartQuoteData = null;

  try {
    smartQuoteData = await getSmartQuoteData({ text, images });
    console.log("SmartQuote result:", JSON.stringify(smartQuoteData, null, 2));
  } catch (err) {
    console.warn("SmartQuote failed", err);
  }

  const finalData = buildFinalData(smartQuoteData, parsed);

  if (bestPrice && bestPrice < 100000) {
  console.log("Parser best price:", bestPrice);
}
  console.log("Final merged data:", JSON.stringify(finalData, null, 2));

  parsed.price = finalData.total_price ?? parsed.price;
  parsed.roofSize = finalData.roof_size_sqft ?? parsed.roofSize;
  parsed.material = finalData.material ?? parsed.material;
  parsed.materialLabel =
    finalData.material ? titleCase(finalData.material) : parsed.materialLabel;
  parsed.warrantyYears = finalData.warranty_years ?? parsed.warrantyYears;
  parsed.contractor = finalData.contractor_name ?? parsed.contractor;
  parsed.city = finalData.city ?? parsed.city;
  parsed.stateCode = finalData.state ?? parsed.stateCode;

  if (finalData.confidence != null) {
    parsed.confidenceScore = Math.round(Number(finalData.confidence) * 100);
    parsed.confidenceLabel = getConfidenceLabel(parsed.confidenceScore);
  }

  if (typeof finalData.tear_off_included === "boolean") {
    parsed.signals = {
      ...parsed.signals,
      tearOff: {
        ...(parsed.signals?.tearOff || {}),
        status: finalData.tear_off_included ? "included" : "excluded",
        label: "Tear off"
      }
    };
  }

  parsed.smartQuoteData = smartQuoteData;

  setLastParsedData(parsed);

  renderParsedResults(parsed);
  autoFillForm(parsed);
}

function renderParsedResults(parsed) {
  const container = document.getElementById("analysisPanels");
  if (!container) return;

  container.innerHTML = `
    <div class="panel">
      <h4>Parsed quote details</h4>
      <ul class="mini-list">
        <li>Price: ${parsed.price ? formatCurrency(parsed.price) : "Not detected"}</li>
        <li>Material: ${parsed.materialLabel || "Not detected"}</li>
        <li>Roof size: ${Number(parsed.roofSize) > 0 ? `${formatNumber(parsed.roofSize)} sq ft` : "Not detected"}</li>
        <li>Warranty: ${Number(parsed.warrantyYears) > 0 ? `${parsed.warrantyYears} years` : "Not detected"}</li>
      </ul>
    </div>

    <div class="panel">
      <h4>Parser quality</h4>
      <ul class="mini-list">
        <li>Confidence: ${parsed.confidenceLabel || "Low"}</li>
        <li>Price candidates found: ${parsed.priceCandidates?.length || 0}</li>
        <li>Extraction method: ${parsed.extractionMethod || "unknown"}</li>
      </ul>
    </div>
  `;
}

export function analyzeQuote() {
  const roofSize = Number(document.getElementById("roofSize")?.value);
  const quotePrice = Number(document.getElementById("quotePrice")?.value);

  const resultContainer = document.getElementById("analysisOutput");

  if (!roofSize || !quotePrice) {
    resultContainer.innerHTML = "Please enter valid positive numbers for roof size and quote price.";
    return;
  }

  const pricePerSqFt = quotePrice / roofSize;

  resultContainer.innerHTML = `
    <h3>Quote Analysis</h3>
    <div class="analysis-grid">
      <div>Price per square foot</div>
      <div>$${pricePerSqFt.toFixed(2)}</div>
    </div>
  `;
}

export function resetAnalyzer() {
  const analysisOutput = document.getElementById("analysisOutput");

  if (analysisOutput) {
    analysisOutput.innerHTML = "";
  }

  setLatestAnalysis(null);
}