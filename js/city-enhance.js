// City page enhancement: adds interactive calculator, dual CTA, material comparison
// Loads on all city cost pages to enhance static content
(function() {
  "use strict";

  // Only run on city cost pages
  var h1 = document.querySelector("h1");
  if (!h1 || !h1.textContent.match(/cost in/i)) return;

  // Extract city, state, and pricing data from the page
  var cityMatch = h1.textContent.match(/in (.+?)(?:,\s*(\w{2}))?$/);
  if (!cityMatch) return;
  var cityState = cityMatch[0].replace("in ", "");

  // Find the price table to extract material pricing
  var priceTable = document.querySelector(".price-table");
  if (!priceTable) return;

  var rows = priceTable.querySelectorAll("tbody tr");
  var prices = {};
  var materials = {};
  var headers = priceTable.querySelectorAll("thead th");
  var matNames = [];
  for (var i = 1; i < headers.length; i++) {
    matNames.push(headers[i].textContent.trim().toLowerCase());
  }

  rows.forEach(function(row) {
    var cells = row.querySelectorAll("td");
    var sizeText = cells[0] ? cells[0].textContent.trim() : "";
    var sizeMatch = sizeText.match(/(\d+)/);
    if (!sizeMatch) return;
    var size = parseInt(sizeMatch[1]);

    for (var j = 1; j < cells.length && j <= matNames.length; j++) {
      var price = parseInt(cells[j].textContent.replace(/[$,]/g, ""));
      if (!isNaN(price)) {
        var mat = matNames[j - 1];
        if (!materials[mat]) materials[mat] = {};
        materials[mat][size] = price;
      }
    }
  });

  // Need at least one material with pricing
  if (Object.keys(materials).length === 0) return;

  // Material display info
  var matInfo = {
    asphalt: { label: "Asphalt 3-Tab", life: "15-20 years", warranty: "25 years", pros: "Cheapest option, easy to install and repair", cons: "Shortest lifespan, less wind resistance" },
    architectural: { label: "Architectural Shingle", life: "25-30 years", warranty: "30-50 years", pros: "Best value, dimensional look, good wind rating", cons: "Still asphalt, moderate lifespan" },
    metal: { label: "Standing Seam Metal", life: "40-70 years", warranty: "30-50 years", pros: "Longest life, energy efficient, fire resistant", cons: "Higher upfront cost, specialized install" },
    tile: { label: "Clay/Concrete Tile", life: "50-100 years", warranty: "50 years", pros: "Extremely durable, classic look, fire resistant", cons: "Very heavy (may need structural reinforcement), expensive" },
    cedar: { label: "Cedar Shake", life: "30-40 years", warranty: "30 years", pros: "Natural beauty, good insulation", cons: "High maintenance, fire risk without treatment" },
    flat: { label: "Flat/TPO/EPDM", life: "15-25 years", warranty: "15-20 years", pros: "Good for low-slope roofs, energy efficient", cons: "Drainage issues, shorter lifespan" },
    slate: { label: "Natural Slate", life: "75-200 years", warranty: "50-100 years", pros: "Lasts a lifetime, prestigious look", cons: "Extremely expensive, very heavy, few installers" },
    concrete: { label: "Concrete Tile", life: "40-50 years", warranty: "30-50 years", pros: "Durable, fire resistant, many styles", cons: "Heavy, moderate cost, can crack" }
  };

  function fmt(n) { return "$" + Math.round(n).toLocaleString(); }

  function interpolatePrice(mat, sqft) {
    var m = materials[mat];
    if (!m) return null;
    var sizes = Object.keys(m).map(Number).sort(function(a,b){return a-b;});
    if (sqft <= sizes[0]) return m[sizes[0]] * sqft / sizes[0];
    if (sqft >= sizes[sizes.length-1]) return m[sizes[sizes.length-1]] * sqft / sizes[sizes.length-1];
    for (var i = 0; i < sizes.length - 1; i++) {
      if (sqft >= sizes[i] && sqft <= sizes[i+1]) {
        var ratio = (sqft - sizes[i]) / (sizes[i+1] - sizes[i]);
        return m[sizes[i]] + ratio * (m[sizes[i+1]] - m[sizes[i]]);
      }
    }
    return null;
  }

  // 1. Inject dual CTA above the first section
  var ctaBox = document.querySelector(".cta-box");
  if (ctaBox) {
    var cityParam = encodeURIComponent(cityState.split(",")[0] || cityState);
    var stateParam = (cityState.match(/,\s*(\w{2})/) || ["",""])[1];
    var dualHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">';
    dualHtml += '<div style="text-align:center;padding:24px;background:#fff;border:1px solid var(--border);border-radius:14px;">';
    dualHtml += '<div style="font-size:24px;margin-bottom:8px;">&#128196;</div>';
    dualHtml += '<h3 style="margin:0 0 8px;font-size:18px;">I have a quote</h3>';
    dualHtml += '<p style="font-size:14px;color:var(--text-secondary);margin:0 0 12px;">Upload it for instant price check against ' + cityState + ' market data.</p>';
    dualHtml += '<a class="btn" href="/analyze-my-quote.html?city=' + cityParam + '&state=' + stateParam + '">Check My Quote</a>';
    dualHtml += '</div>';
    dualHtml += '<div style="text-align:center;padding:24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;">';
    dualHtml += '<div style="font-size:24px;margin-bottom:8px;">&#128270;</div>';
    dualHtml += '<h3 style="margin:0 0 8px;font-size:18px;">Just shopping?</h3>';
    dualHtml += '<p style="font-size:14px;color:var(--text-secondary);margin:0 0 12px;">Use the calculator below to see fair prices for your project in ' + cityState + '.</p>';
    dualHtml += '<a class="btn" href="#tpCalc" style="background:#16a34a;">See Fair Prices</a>';
    dualHtml += '</div></div>';
    // Add responsive style
    var style = document.createElement("style");
    style.textContent = "@media(max-width:600px){div[style*='grid-template-columns:1fr 1fr']{grid-template-columns:1fr !important;}}";
    document.head.appendChild(style);
    ctaBox.outerHTML = dualHtml + '<p style="text-align:center;font-size:14px;margin-bottom:24px;"><a href="/compare-quotes.html" style="color:var(--brand);">Compare quotes side by side</a> &bull; <a href="/find-contractors.html?state=' + stateParam + '" style="color:var(--brand);">Find contractors in ' + stateParam + '</a></p>';
  }

  // 2. Inject interactive calculator after the price table
  var calcSection = document.createElement("section");
  calcSection.className = "section";
  calcSection.id = "tpCalc";

  var matOptions = "";
  for (var mat in materials) {
    var info = matInfo[mat] || { label: mat };
    var sel = mat === "architectural" ? " selected" : "";
    matOptions += '<option value="' + mat + '"' + sel + '>' + info.label + '</option>';
  }

  calcSection.innerHTML = '<h2>Instant Roof Cost Calculator</h2>' +
    '<p>Enter your roof size and pick a material to see your estimated cost.</p>' +
    '<div style="display:flex;flex-wrap:wrap;gap:16px;margin:16px 0;">' +
    '<div style="flex:1;min-width:200px;">' +
    '<label style="font-size:13px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Roof Size (sq ft)</label>' +
    '<input type="range" id="tpCalcSize" min="800" max="4000" value="2000" step="100" style="width:100%;" />' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);"><span>800</span><span id="tpCalcSizeLabel">2,000 sq ft</span><span>4,000</span></div>' +
    '</div>' +
    '<div style="flex:1;min-width:200px;">' +
    '<label style="font-size:13px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Material</label>' +
    '<select id="tpCalcMat" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;">' + matOptions + '</select>' +
    '</div></div>' +
    '<div id="tpCalcResult" style="text-align:center;padding:24px;background:var(--bg-subtle,#f8fafc);border-radius:12px;border:1px solid var(--border,#e2e8f0);">' +
    '<div style="font-size:14px;color:var(--text-muted);">Estimated Cost</div>' +
    '<div style="font-size:36px;font-weight:800;color:var(--brand,#1d4ed8);" id="tpCalcPrice">--</div>' +
    '<div style="font-size:13px;color:var(--text-secondary);" id="tpCalcRange"></div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;" id="tpCalcSqFt"></div>' +
    '</div>';

  if (priceTable && priceTable.parentNode) {
    priceTable.parentNode.parentNode.insertBefore(calcSection, priceTable.parentNode.nextSibling);
  }

  function updateCalc() {
    var size = parseInt(document.getElementById("tpCalcSize").value);
    var mat = document.getElementById("tpCalcMat").value;
    document.getElementById("tpCalcSizeLabel").textContent = size.toLocaleString() + " sq ft";
    var est = interpolatePrice(mat, size);
    if (est !== null) {
      est = Math.round(est);
      document.getElementById("tpCalcPrice").textContent = fmt(est);
      document.getElementById("tpCalcRange").textContent = "Range: " + fmt(Math.round(est * 0.85)) + " - " + fmt(Math.round(est * 1.15));
      document.getElementById("tpCalcSqFt").textContent = "$" + (est / size).toFixed(2) + " per sq ft";
    }
  }

  document.getElementById("tpCalcSize").addEventListener("input", updateCalc);
  document.getElementById("tpCalcMat").addEventListener("change", updateCalc);
  updateCalc();

  // 3. Inject material comparison cards after the calculator
  var matSection = document.createElement("section");
  matSection.className = "section";
  var cardsHtml = '<h2>Roofing Materials Compared</h2><p>All materials available with pricing for a 2,000 sq ft roof.</p>';
  cardsHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:16px;">';
  for (var mk in materials) {
    var mi = matInfo[mk] || { label: mk, life: "varies", warranty: "varies", pros: "", cons: "" };
    var p2k = materials[mk][2000] || materials[mk][Object.keys(materials[mk])[0]] || 0;
    cardsHtml += '<div style="padding:16px;background:#fff;border:1px solid var(--border);border-radius:12px;">';
    cardsHtml += '<div style="font-size:15px;font-weight:700;margin-bottom:4px;">' + mi.label + '</div>';
    cardsHtml += '<div style="font-size:22px;font-weight:800;color:var(--brand,#1d4ed8);margin-bottom:8px;">' + fmt(p2k) + '</div>';
    cardsHtml += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Lifespan: ' + mi.life + ' &bull; Warranty: ' + mi.warranty + '</div>';
    cardsHtml += '<div style="font-size:12px;color:#16a34a;margin-bottom:2px;">+ ' + mi.pros + '</div>';
    cardsHtml += '<div style="font-size:12px;color:#dc2626;">- ' + mi.cons + '</div>';
    cardsHtml += '</div>';
  }
  cardsHtml += '</div>';
  matSection.innerHTML = cardsHtml;
  calcSection.parentNode.insertBefore(matSection, calcSection.nextSibling);

  // 4. Inject widget if not already present
  if (!document.querySelector('script[src*="tp-widget"]')) {
    var widgetSection = document.createElement("section");
    widgetSection.className = "section";
    widgetSection.innerHTML = '<h2>Live Pricing Widget</h2><p>Interactive pricing for this area. <a href="/widget.html" style="color:var(--brand);">Embed on your site</a></p>';
    var widgetScript = document.createElement("script");
    widgetScript.src = "https://woogoro.com/widget/tp-widget.js";
    widgetScript.setAttribute("data-service", "roofing");
    widgetScript.setAttribute("data-auto", "true");
    widgetScript.async = true;
    widgetSection.appendChild(widgetScript);
    matSection.parentNode.insertBefore(widgetSection, matSection.nextSibling);
  }
})();
