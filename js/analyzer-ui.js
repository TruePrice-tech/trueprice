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

  if (quotePriceEl && parsed.price) {
    quotePriceEl.value = parsed.price;
  }

  if (roofSizeEl && parsed.roofSize) {
    roofSizeEl.value = parsed.roofSize;
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

  if (warrantyYearsEl && parsed.warrantyYears) {
    warrantyYearsEl.value = parsed.warrantyYears;
  }

  if (cityNameEl && parsed.city) {
    cityNameEl.value = parsed.city;
  }

  if (stateCodeEl && parsed.stateCode) {
    stateCodeEl.value = parsed.stateCode;
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

export async function analyzeParsedText(text, extractionMethod) {
  const priceCandidates = extractPriceCandidates(text);

  let bestPrice = "";
  const forcedTotal = detectTotalLinePrice(text);

  if (forcedTotal) {
    bestPrice = forcedTotal;
  } else if (priceCandidates.length) {
    bestPrice = priceCandidates
      .sort((a, b) => b.score - a.score || b.value - a.value)[0].value;
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
    roofSizeSource: roofSize.source,
    signals,
    premiumSignals,
    rawText: text,
    extractionMethod
  };

  parsed.confidenceScore = calculateParserConfidence(parsed);
  parsed.confidenceLabel = getConfidenceLabel(parsed.confidenceScore);

  let smartQuoteData = null;

  try {
    smartQuoteData = await getSmartQuoteData(text);
  } catch (err) {
    console.warn("SmartQuote failed, using parser only", err);
  }

  const finalData = buildFinalData(smartQuoteData, parsed);

  parsed.price =
    finalData.total_price != null ? String(finalData.total_price) : parsed.price;

  parsed.roofSize =
    finalData.roof_size_sqft != null ? String(finalData.roof_size_sqft) : parsed.roofSize;

  parsed.material =
    finalData.material || parsed.material;

  parsed.materialLabel =
    finalData.material ? titleCase(finalData.material) : parsed.materialLabel;

  parsed.warrantyYears =
    finalData.warranty_years != null ? String(finalData.warranty_years) : parsed.warrantyYears;

  parsed.contractor =
    finalData.contractor_name || parsed.contractor;

  parsed.city =
    finalData.city || parsed.city;

  parsed.stateCode =
    finalData.state || parsed.stateCode;

  if (finalData.confidence != null) {
    parsed.confidenceScore = Math.round(finalData.confidence * 100);
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
  analyzeQuote();
}

function renderParsedResults(parsed) {
  const container = document.getElementById("analysisPanels");
  if (!container) return;

  const signals = parsed.signals || {};
  const includedCount = Object.values(signals).filter(
    (item) => item.status === "included"
  ).length;

  container.innerHTML = `
    <div class="panel">
      <h4>Parsed quote details</h4>
      <ul class="mini-list">
        <li>Price: ${parsed.price ? formatCurrency(parsed.price) : "Not detected"}</li>
        <li>Top price candidates: ${
          parsed.priceCandidates && parsed.priceCandidates.length
            ? parsed.priceCandidates
                .slice(0, 5)
                .map((item) => `${formatCurrency(item.value)} (${item.score})`)
                .join(", ")
            : "None"
        }</li>
        <li>Material: ${parsed.materialLabel || "Not detected"}</li>
        <li>Roof size: ${parsed.roofSize ? `${formatNumber(parsed.roofSize)} sq ft` : "Not detected"}</li>
        <li>Warranty: ${parsed.warrantyYears ? `${parsed.warrantyYears} years` : "Not detected"}</li>
      </ul>
    </div>

    <div class="panel">
      <h4>Parser quality</h4>
      <ul class="mini-list">
        <li>Confidence: ${parsed.confidenceLabel || "Low"}</li>
        <li>Price candidates found: ${parsed.priceCandidates ? parsed.priceCandidates.length : 0}</li>
        <li>Scope items found: ${includedCount}</li>
        <li>Extraction method: ${
          parsed.extractionMethod
            ? parsed.extractionMethod.replaceAll("_", " ")
            : "unknown"
        }</li>
      </ul>
    </div>
  `;
}

export function analyzeQuote() {
  const roofSize = Number(document.getElementById("roofSize")?.value);
  const quotePrice = Number(document.getElementById("quotePrice")?.value);
  const city = document.getElementById("cityName")?.value.trim() || "";
  const stateCode = document.getElementById("stateCode")?.value.toUpperCase().trim() || "";
  const material = document.getElementById("materialType")?.value || "";
  const complexity = document.getElementById("complexityFactor")?.value || "";
  const tearOff = document.getElementById("tearOffIncluded")?.value || "unknown";
  const warrantyYears = Number(document.getElementById("warrantyYears")?.value);

  const resultContainer = document.getElementById("analysisOutput");
  const aiOutput = document.getElementById("aiAnalysisOutput");

  if (!resultContainer || !aiOutput) return;

  if (!roofSize || !quotePrice) {
    resultContainer.innerHTML = "Please enter valid positive numbers for roof size and quote price.";
    return;
  }

  let localDataUsed = false;
  let sizeLabelUsed = "";
  let low;
  let mid;
  let high;

  const cityPricing = findCityPricing(city, stateCode);

  if (cityPricing) {
    const sizeLabel = getNearestSizeLabel(cityPricing, roofSize);
    sizeLabelUsed = sizeLabel;

    const data = cityPricing.sizes[sizeLabel];
    const materialKey = material || "architectural";
    const perSqFt = data[materialKey] || getMaterialBenchmarkPerSqFt(materialKey);

    mid = perSqFt * roofSize;
    localDataUsed = true;
  } else {
    const perSqFt = getMaterialBenchmarkPerSqFt(material || "architectural");
    mid = perSqFt * roofSize;
  }

  let tearOffMultiplier = 1;
  if (tearOff === "yes") {
    tearOffMultiplier = 1.05;
  } else if (tearOff === "no") {
    tearOffMultiplier = 0.97;
  }

  mid = mid * tearOffMultiplier;

  low = mid * 0.9;
  high = mid * 1.12;

  const diff = quotePrice - mid;
  const diffPct = (diff / mid) * 100;

  let verdict;
  if (diffPct < -18) verdict = "Unusually Low";
  else if (diffPct < -8) verdict = "Excellent Value";
  else if (diffPct <= 10) verdict = "Fair Price";
  else if (diffPct <= 20) verdict = "Slightly High";
  else if (diffPct <= 35) verdict = "Overpriced";
  else verdict = "Potential Red Flag";

  const pricePerSqFt = quotePrice / roofSize;
  const pricePerSquare = pricePerSqFt * 100;

  resultContainer.innerHTML = `
    <h3>${verdict}</h3>

    <div class="analysis-grid">
      <div>Price per square foot</div>
      <div>$${pricePerSqFt.toFixed(2)} / sq ft</div>

      <div>Price per roofing square</div>
      <div>$${Math.round(pricePerSquare)} / square</div>

      <div>Modeled market range</div>
      <div>${formatCurrency(low)} to ${formatCurrency(high)}</div>

      <div>Modeled midpoint</div>
      <div>${formatCurrency(mid)}</div>

      <div>Entered quote</div>
      <div>${formatCurrency(quotePrice)}</div>

      <div>Difference from midpoint</div>
      <div>${formatCurrency(diff)} (${diffPct.toFixed(1)}%)</div>
    </div>
  `;

  const explanation = buildAIExplanation({
    verdict,
    quotePrice,
    low,
    mid,
    high,
    material,
    roofSize,
    complexityLabel: complexity,
    city,
    stateCode,
    localDataUsed,
    sizeLabelUsed,
    tearOffLabel: tearOff,
    warrantyYears,
    parsedSignals: lastParsedData.signals,
    premiumSignals: lastParsedData.premiumSignals,
    analysisConfidenceLabel: lastParsedData.confidenceLabel
  });

  aiOutput.innerHTML = explanation;

  setLatestAnalysis({
    verdict,
    quotePrice,
    low,
    mid,
    high
  });
}

export function resetAnalyzer() {
  const analysisOutput = document.getElementById("analysisOutput");
  const aiOutput = document.getElementById("aiAnalysisOutput");

  if (analysisOutput) {
    analysisOutput.innerHTML = "";
  }

  if (aiOutput) {
    aiOutput.innerHTML = "Enter valid quote details to receive an expert explanation.";
  }

  setLatestAnalysis(null);
}