function setUploadStatus(message, type = "info") {
  const el = document.getElementById("uploadStatus");
  if (!el) return;

  el.className = `status ${type}`;
  el.innerText = message;
}

function autoFillForm(parsed) {
  if (parsed.price) {
    document.getElementById("quotePrice").value = parsed.price;
  }

  if (parsed.roofSize) {
    document.getElementById("roofSize").value = parsed.roofSize;
  }

  if (parsed.material) {
    document.getElementById("material").value = parsed.material;
  }

  if (parsed.warrantyYears) {
    document.getElementById("warrantyYears").value = parsed.warrantyYears;
  }

  if (parsed.city) {
    document.getElementById("city").value = parsed.city;
  }

  if (parsed.stateCode) {
    document.getElementById("state").value = parsed.stateCode;
  }
}

function analyzeParsedText(text, extractionMethod) {

  const priceCandidates = extractPriceCandidates(text);

  const bestPrice = priceCandidates.length ? priceCandidates[0].value : "";

  const material = detectMaterial(text);
  const warranty = detectWarranty(text);
  const contractor = detectContractor(text);
  const roofSize = detectRoofSize(text);
  const location = detectLocation(text);
  const signals = detectScopeSignals(text);
  const premiumSignals = detectPremiumSignals(text);

  const parsed = {
    price: bestPrice,
    priceCandidates,
    material: material.value,
    materialLabel: material.label,
    warranty: warranty.raw,
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

  lastParsedData = parsed;

  renderParsedResults(parsed);
  autoFillForm(parsed);
}

function renderParsedResults(parsed) {

  const container = document.getElementById("parsedResults");

  const signals = parsed.signals || {};

  const scopeHtml = Object.entries(signals)
    .map(([key, item]) => {
      return `
        <div class="signal-row">
          <div>${escapeHtml(item.label)}</div>
          <div>${getSignalHtml(item.status)}</div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
  <div class="parsed-card">

    <h3>Parsed quote details</h3>

    <div class="parsed-grid">
      <div>Price</div>
      <div>${parsed.price ? formatCurrency(parsed.price) : "Not detected"}</div>

      <div>Material</div>
      <div>${parsed.materialLabel || "Not detected"}</div>

      <div>Roof size</div>
      <div>${parsed.roofSize ? formatNumber(parsed.roofSize) + " sq ft" : "Not detected"}</div>

      <div>Warranty</div>
      <div>${parsed.warrantyYears ? parsed.warrantyYears + " years" : "Not detected"}</div>

      <div>Parser confidence</div>
      <div>${parsed.confidenceLabel}</div>
    </div>

    <h4>Scope signals</h4>

    ${scopeHtml}

  </div>
  `;
}

function analyzeQuote() {

  const roofSize = Number(document.getElementById("roofSize").value);
  const quotePrice = Number(document.getElementById("quotePrice").value);
  const city = document.getElementById("cityName").value.trim();
  const stateCode = document.getElementById("stateCode").value.toUpperCase().trim();
  const material = document.getElementById("materialType").value;
  const complexity = document.getElementById("complexityFactor").value;
  const tearOff = document.getElementById("tearOffIncluded").value;
  const warrantyYears = Number(document.getElementById("warrantyYears").value);

  const resultContainer = document.getElementById("analysisOutput");

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

    const perSqFt = getMaterialBenchmarkPerSqFt(material);

    mid = perSqFt * roofSize;

  }

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

  document.getElementById("aiAnalysisOutput").innerHTML = explanation;

  latestAnalysis = {
    verdict,
    quotePrice,
    low,
    mid,
    high
  };
}

function resetAnalyzer() {

  document.getElementById("analysisOutput").innerHTML = "";
  document.getElementById("aiAnalysisOutput").innerHTML =
    "Enter valid quote details to receive an expert explanation.";

  latestAnalysis = null;
}