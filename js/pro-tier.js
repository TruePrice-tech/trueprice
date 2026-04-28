/*
 * Woogoro — Pro Tier client helper
 * --------------------------------
 * Self-contained module that:
 *   - Manages an anonymous Pro token in localStorage (32-hex)
 *   - Polls /api/pro-status on load and after checkout returns
 *   - Sets body.is-premium when isPro
 *   - Wraps window.showShareScreen so the printable report includes Pro sections
 *     for Pro users and a single Pro upsell card for free users
 *   - Injects an inline Pro CTA into the analyzer result (after the free verdict)
 *
 * Public surface:
 *   window.WoogoroPro = {
 *     getToken(),                            // string (creates if missing)
 *     getStatus(force),                      // Promise<{ isPro, expiresAt, daysRemaining }>
 *     refreshStatus(),                       // Promise<status> (skips cache)
 *     startCheckout({ successUrl?, cancelUrl? }),  // redirects to Stripe
 *     renderProSections(analysis, vertical), // HTML string
 *     renderProUpsell(),                     // HTML string
 *   };
 *   window.tpUnlockPremium = function();    // called by pro-success.html
 *
 * Self-contained: ES5+ DOM only, no external deps. Loads in <script defer>.
 */
(function () {
  if (window.WoogoroPro) return;

  var STORAGE_KEY = "tp_pro_token";
  var STATUS_CACHE_MS = 60 * 1000;
  var TOKEN_RE = /^[a-f0-9]{32}$/i;

  var cachedStatus = null;
  var cachedStatusAt = 0;

  // ---- token management ------------------------------------------------

  function generateToken() {
    var bytes = new Uint8Array(16);
    var c = window.crypto || window.msCrypto;
    c.getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      if (h.length < 2) h = "0" + h;
      out += h;
    }
    return out;
  }

  function getToken() {
    var t = null;
    try { t = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
    if (t && TOKEN_RE.test(t)) return t;
    t = generateToken();
    try { localStorage.setItem(STORAGE_KEY, t); } catch (e) { /* private mode */ }
    return t;
  }

  // ---- status check ----------------------------------------------------

  function getStatus(force) {
    var now = Date.now();
    if (!force && cachedStatus && (now - cachedStatusAt) < STATUS_CACHE_MS) {
      return Promise.resolve(cachedStatus);
    }
    var token = getToken();
    return fetch("/api/pro-status?token=" + encodeURIComponent(token), { credentials: "omit" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        cachedStatus = j;
        cachedStatusAt = Date.now();
        applyStatusToBody(j);
        return j;
      })
      .catch(function () {
        var fallback = { isPro: false, expiresAt: null, daysRemaining: null, error: "network" };
        cachedStatus = fallback;
        cachedStatusAt = Date.now();
        applyStatusToBody(fallback);
        return fallback;
      });
  }

  function refreshStatus() { return getStatus(true); }

  function applyStatusToBody(status) {
    if (!document.body) return;
    if (status && status.isPro) {
      document.body.classList.add("is-premium");
    } else {
      document.body.classList.remove("is-premium");
    }
  }

  // ---- checkout --------------------------------------------------------

  function startCheckout(opts) {
    opts = opts || {};
    var token = getToken();
    var body = { token: token };
    if (opts.successUrl) body.successUrl = opts.successUrl;
    if (opts.cancelUrl) body.cancelUrl = opts.cancelUrl;

    return fetch("/api/pro-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.error || "checkout_failed");
          return j;
        });
      })
      .then(function (j) {
        if (!j.url) throw new Error("no_checkout_url");
        window.location.href = j.url;
      });
  }

  // Called by pro-success.html after Stripe redirects back. Polls a few
  // times because the webhook may not have fired by the time the user lands.
  function tpUnlockPremium() {
    var attempts = 0;
    var maxAttempts = 8; // 8 attempts over ~30s
    function tick() {
      return refreshStatus().then(function (s) {
        if (s.isPro) return s;
        attempts++;
        if (attempts >= maxAttempts) return s;
        return new Promise(function (resolve) { setTimeout(resolve, 4000); }).then(tick);
      });
    }
    return tick();
  }

  // ---- helpers for Pro sections ---------------------------------------

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtCurrency(n) {
    if (n == null || isNaN(n)) return "—";
    return "$" + Math.round(Number(n)).toLocaleString();
  }

  function detectVertical() {
    var path = (location.pathname || "").toLowerCase();
    var match = path.match(/\/([a-z_-]+)-quote-analyzer\.html/);
    if (match) return match[1].replace(/-/g, "_");
    if (/medical-bill-analyzer/.test(path)) return "medical";
    if (/legal-fee-analyzer/.test(path)) return "legal";
    if (/auto-repair/.test(path)) return "auto_repair";
    if (/moving/.test(path)) return "moving";
    return "generic";
  }

  function readAnalysis() {
    return window.__latestAnalysis
      || (typeof window.latestAnalysis !== "undefined" ? window.latestAnalysis : null)
      || null;
  }

  // ---- the 7 Pro sections ---------------------------------------------
  // Each renderer takes the analysis data + vertical and returns an HTML
  // string for one Pro section (or "" if not applicable).

  function renderRedFlagsSection(a, vertical) {
    var flags = (a && (a.redFlags || a.flags)) || [];
    if (!Array.isArray(flags) || flags.length === 0) {
      return [
        '<div class="report-section tp-pdf-premium">',
        '<div class="report-section-title">Per-Quote Red Flags <span class="tp-pro-tag">PRO</span></div>',
        '<div class="tp-pro-body">',
        '<p>No major red flags detected in this quote. Things to still verify before signing:</p>',
        '<ul class="tp-pro-list">',
        '<li>Final price matches what was discussed verbally</li>',
        '<li>Contractor name and license number are present</li>',
        '<li>Start and end dates are specified, not just "soon"</li>',
        '<li>Payment schedule does not require more than 25-30% upfront</li>',
        '<li>Cancellation terms are stated and reasonable</li>',
        '</ul>',
        '</div></div>'
      ].join("");
    }
    var items = flags.map(function (f) {
      var label = (f && (f.label || f.title || f.name)) || String(f);
      var detail = (f && (f.detail || f.description || f.evidence)) || "";
      var severity = (f && f.severity) || "warn";
      var sevClass = severity === "high" || severity === "critical" ? "tp-pro-flag-high"
        : severity === "low" ? "tp-pro-flag-low" : "tp-pro-flag-warn";
      return '<li class="tp-pro-flag ' + sevClass + '"><strong>' + escapeHtml(label) + '</strong>'
        + (detail ? '<div class="tp-pro-flag-detail">' + escapeHtml(detail) + '</div>' : '')
        + '</li>';
    }).join("");
    return [
      '<div class="report-section tp-pdf-premium">',
      '<div class="report-section-title">Per-Quote Red Flags <span class="tp-pro-tag">PRO</span></div>',
      '<div class="tp-pro-body">',
      '<p>' + flags.length + ' flag' + (flags.length > 1 ? 's' : '') + ' identified in this specific quote:</p>',
      '<ul class="tp-pro-list">' + items + '</ul>',
      '</div></div>'
    ].join("");
  }

  function renderQuestionsSection(a, vertical) {
    var missing = collectMissingScope(a);
    var qs = generateQuestions(missing, vertical, a);
    if (!qs.length) {
      qs = [
        "What is included in the price quoted, line by line?",
        "What is your payment schedule and is more than 25% required upfront?",
        "What is your warranty on labor specifically (not just materials)?",
        "Who is on site for the work — your employees or subcontractors?",
        "What happens if the work takes longer than estimated?"
      ];
    }
    var items = qs.slice(0, 10).map(function (q) {
      return '<li>' + escapeHtml(q) + '</li>';
    }).join("");
    return [
      '<div class="report-section tp-pdf-premium">',
      '<div class="report-section-title">Questions to Ask the Contractor <span class="tp-pro-tag">PRO</span></div>',
      '<div class="tp-pro-body">',
      '<p>Tailored to scope items missing or ambiguous in your quote. Bring this to your next call.</p>',
      '<ol class="tp-pro-list">' + items + '</ol>',
      '</div></div>'
    ].join("");
  }

  function renderNegotiationSection(a, vertical) {
    var quotePrice = Number(a && (a.quotePrice || a.totalPrice || a.amount)) || 0;
    var mid = Number(a && (a.mid || a.median || a.expected)) || 0;
    var low = Number(a && (a.low || a.lowEstimate)) || 0;
    var high = Number(a && (a.high || a.highEstimate)) || 0;

    var script;
    if (quotePrice && mid && quotePrice > mid * 1.10) {
      var delta = quotePrice - mid;
      script =
        '"I appreciate the time you took putting this together. I have been comparing pricing for similar work in this area, ' +
        'and the typical range I am seeing is ' + fmtCurrency(low) + ' to ' + fmtCurrency(high) + ', with a midpoint around ' + fmtCurrency(mid) + '. ' +
        'Your quote is about ' + fmtCurrency(delta) + ' above that midpoint. ' +
        'I would like to move forward with you, but I need to understand what is driving the difference. ' +
        'Can you walk me through what is included in your price that might not be in the typical scope, ' +
        'and is there room to bring this closer to ' + fmtCurrency(mid) + '?"';
    } else if (quotePrice && mid && quotePrice < mid * 0.90) {
      script =
        '"This price is meaningfully below what I have seen elsewhere. Before signing I want to confirm: ' +
        'is anything excluded from the line items? Are permits, disposal, and any required prep work all in this price? ' +
        'And what is your warranty on labor (not just materials)? I want to make sure I am comparing apples to apples."';
    } else {
      script =
        '"Your quote is in line with the local market range. Before signing I want to lock in a few things: ' +
        'can we add a clause that any additional work requires written approval before charges? ' +
        'And can we agree on a payment schedule of 25 percent at start, 50 percent at midpoint, and 25 percent on completion?"';
    }

    return [
      '<div class="report-section tp-pdf-premium">',
      '<div class="report-section-title">Negotiation Script <span class="tp-pro-tag">PRO</span></div>',
      '<div class="tp-pro-body">',
      '<p>Suggested wording to use in your next conversation. Adjust to your voice.</p>',
      '<blockquote class="tp-pro-script">' + escapeHtml(script) + '</blockquote>',
      '</div></div>'
    ].join("");
  }

  function renderBenchmarkSection(a, vertical) {
    var city = (a && a.city) || "";
    var state = (a && (a.stateCode || a.state)) || "";
    var location = (city && state) ? (city + ", " + state) : (city || "your area");
    var quote = Number(a && (a.quotePrice || a.totalPrice || a.amount)) || 0;
    var mid = Number(a && (a.mid || a.median || a.expected)) || 0;
    var low = Number(a && (a.low || a.lowEstimate)) || 0;
    var high = Number(a && (a.high || a.highEstimate)) || 0;
    var sampleSize = (a && (a.sampleSize || a.calibrationN)) || null;

    var deltaPct = (quote && mid) ? Math.round(((quote - mid) / mid) * 100) : null;
    var deltaText = deltaPct == null ? ""
      : deltaPct > 0 ? "<strong>" + deltaPct + "% above</strong> the local midpoint"
      : deltaPct < 0 ? "<strong>" + Math.abs(deltaPct) + "% below</strong> the local midpoint"
      : "<strong>at</strong> the local midpoint";

    var rows = '';
    rows += '<tr><td>Your quote</td><td><strong>' + fmtCurrency(quote) + '</strong></td></tr>';
    rows += '<tr><td>Local midpoint</td><td>' + fmtCurrency(mid) + '</td></tr>';
    rows += '<tr><td>Local low</td><td>' + fmtCurrency(low) + '</td></tr>';
    rows += '<tr><td>Local high</td><td>' + fmtCurrency(high) + '</td></tr>';
    if (sampleSize) {
      rows += '<tr><td>Real quotes used</td><td>' + sampleSize + '</td></tr>';
    }

    return [
      '<div class="report-section tp-pdf-premium">',
      '<div class="report-section-title">Hyper-Local Benchmark <span class="tp-pro-tag">PRO</span></div>',
      '<div class="tp-pro-body">',
      '<p>Your quote vs ' + escapeHtml(location) + ' pricing data. ' + deltaText + '.</p>',
      '<table class="tp-pro-table"><tbody>' + rows + '</tbody></table>',
      '</div></div>'
    ].join("");
  }

  function renderWarrantySection(a, vertical) {
    var warrantyYears = Number(a && (a.warrantyYears || a.warranty)) || 0;
    var industryStandard = warrantyStandardForVertical(vertical);

    var assessment;
    if (!warrantyYears) {
      assessment = '<p><strong>Your quote does not specify a warranty.</strong> ' +
        'For ' + verticalLabel(vertical) + ', the typical industry standard is ' + industryStandard + '. ' +
        'Ask the contractor to put their warranty in writing, including: (a) labor vs materials separately, ' +
        '(b) what voids the warranty, (c) whether it is transferable if you sell the home, ' +
        '(d) whether the warranty is backed by the contractor or by the manufacturer.</p>';
    } else {
      var stdNum = parseInt(industryStandard, 10) || 0;
      if (stdNum && warrantyYears < stdNum) {
        assessment = '<p>Your warranty is <strong>' + warrantyYears + ' year' + (warrantyYears > 1 ? 's' : '') + '</strong>, below the typical ' + industryStandard + ' for ' + verticalLabel(vertical) + '. ' +
          'Ask if a longer warranty is available, and what the difference covers.</p>';
      } else {
        assessment = '<p>Your warranty is <strong>' + warrantyYears + ' year' + (warrantyYears > 1 ? 's' : '') + '</strong>, in line with or above the typical ' + industryStandard + ' for ' + verticalLabel(vertical) + '. ' +
          'Verify what the warranty covers in writing.</p>';
      }
    }

    return [
      '<div class="report-section tp-pdf-premium">',
      '<div class="report-section-title">Warranty Interpretation <span class="tp-pro-tag">PRO</span></div>',
      '<div class="tp-pro-body">',
      assessment,
      '<p style="font-size:13px; color:#64748b;">Always confirm: labor and materials covered separately, what voids it, transferability, who backs it.</p>',
      '</div></div>'
    ].join("");
  }

  function renderBrandSection(a, vertical) {
    var content = brandContentForVertical(vertical, a);
    if (!content) return "";
    return [
      '<div class="report-section tp-pdf-premium">',
      '<div class="report-section-title">Brand & Tier Deep Dive <span class="tp-pro-tag">PRO</span></div>',
      '<div class="tp-pro-body">',
      content,
      '</div></div>'
    ].join("");
  }

  function renderRebatesSection(a, vertical) {
    var content = rebateContentForVertical(vertical, a);
    if (!content) return "";
    return [
      '<div class="report-section tp-pdf-premium">',
      '<div class="report-section-title">Rebates & Incentives Worksheet <span class="tp-pro-tag">PRO</span></div>',
      '<div class="tp-pro-body">',
      content,
      '</div></div>'
    ].join("");
  }

  // ---- vertical-specific helpers --------------------------------------

  function verticalLabel(vertical) {
    var map = {
      roofing: "roofing", hvac: "HVAC", plumbing: "plumbing", electrical: "electrical",
      windows: "windows", siding: "siding", insulation: "insulation", painting: "painting",
      fencing: "fencing", concrete: "concrete", landscaping: "landscaping", garage_door: "garage doors",
      solar: "solar", foundation: "foundation work", kitchen: "kitchen remodels", gutters: "gutters",
      auto_repair: "auto repair", moving: "moving", medical: "medical billing", legal: "legal fees",
    };
    return map[vertical] || "this work";
  }

  function warrantyStandardForVertical(vertical) {
    var map = {
      roofing: "10–25 years on materials, 5–10 years on labor (or full lifetime from premium installers)",
      hvac: "10 years parts, 1–2 years labor",
      plumbing: "1–5 years labor",
      electrical: "1–2 years labor, manufacturer warranty on parts",
      windows: "20 years materials, 5–10 years labor",
      siding: "20–50 years materials, 1–10 years labor",
      insulation: "lifetime materials, 1–2 years labor",
      painting: "2–7 years labor (exterior), 1–3 years interior",
      fencing: "1–5 years labor, manufacturer warranty on materials",
      concrete: "1–5 years labor",
      landscaping: "90 days to 1 year on plant material, 1 year on hardscape labor",
      garage_door: "1–3 years labor, 5–10 years on door, lifetime on springs (premium tier)",
      solar: "25 years on panels, 10–25 years on inverter, 10 years labor",
      foundation: "lifetime transferable on the structural fix is the gold standard",
      kitchen: "1 year on labor, manufacturer warranties on appliances and cabinets",
      gutters: "20–50 years on the gutter material, 1–5 years labor",
      auto_repair: "12 months / 12,000 miles on parts and labor",
      moving: "industry-standard $0.60/lb baseline, full-value protection optional",
      medical: "not applicable",
      legal: "not applicable",
    };
    return map[vertical] || "1–2 years labor, manufacturer warranty on parts";
  }

  function brandContentForVertical(vertical, a) {
    if (vertical === "solar") {
      return ''
        + '<p><strong>Tier 1 panels (REC, Q Cells, SunPower, Hanwha):</strong> the major brands with strong financial backing and full 25-year warranties. Pay 5–10% more for a tier 1 panel; the warranty is what you are buying.</p>'
        + '<p><strong>Microinverters vs string inverters:</strong> microinverters (Enphase) cost more upfront but isolate failures to one panel. String inverters (SolarEdge, SMA) are cheaper but a failure can take down the whole array.</p>'
        + '<p><strong>Battery storage (Tesla Powerwall, Enphase IQ, FranklinWH):</strong> 10-year warranty is standard. Budget $10–15K added to system cost. Federal ITC applies to battery if installed with solar.</p>';
    }
    if (vertical === "roofing") {
      return ''
        + '<p><strong>Asphalt shingle tiers:</strong> 3-tab (cheapest, 20-year), architectural (most common, 30-year), premium designer (40+ year). The price difference between architectural and premium is often less than $1,500 on an average roof for a meaningful step up.</p>'
        + '<p><strong>Brands worth paying for:</strong> GAF Timberline HDZ, CertainTeed Landmark, Owens Corning Duration, Malarkey Vista. All have manufacturer-certified contractor programs that unlock extended warranties.</p>'
        + '<p><strong>Underlayment:</strong> synthetic underlayment is the modern standard; felt is cheaper and shorter-lived. If your quote shows felt and the price is not significantly lower, push back.</p>';
    }
    if (vertical === "hvac") {
      return ''
        + '<p><strong>Tier overview:</strong> Entry (Goodman, Payne) — solid, 10-year parts. Mid (Carrier, Trane, Lennox, American Standard) — best parts availability, longest dealer networks. Premium (Mitsubishi, Daikin) — best efficiency, especially for heat pumps in cold climates.</p>'
        + '<p><strong>SEER2 / HSPF2:</strong> minimum efficiency was raised in 2023. SEER2 14.3+ is the new floor in the South, 13.4+ in the North. Pay attention if your quote shows pre-2023 SEER ratings — that may indicate older inventory.</p>'
        + '<p><strong>Sizing:</strong> oversized systems short-cycle and waste energy. A Manual J load calculation should be on file if the contractor is doing it right.</p>';
    }
    if (vertical === "auto_repair") {
      return ''
        + '<p><strong>Parts tiers:</strong> Aftermarket (cheapest, varies), OEM (same part, plain box), Dealer/Genuine (same part, 30–60% markup), Remanufactured (factory rebuilt, often as-good-as-new with 1-year warranty).</p>'
        + '<p><strong>When to insist on OEM:</strong> safety-critical (brakes, airbags, suspension), emissions-related (catalytic converter, sensors), or where the aftermarket has reliability issues (some sensors, ignition coils).</p>'
        + '<p><strong>Shop type pricing:</strong> dealership labor rate is roughly 1.4x independent shop. Independent specialists (e.g., Subaru-only shop) often match dealer expertise at independent prices.</p>';
    }
    return ""; // No brand content for this vertical yet
  }

  function rebateContentForVertical(vertical, a) {
    var state = (a && (a.stateCode || a.state)) || "";
    if (vertical === "solar") {
      return ''
        + '<p><strong>Federal Investment Tax Credit (ITC):</strong> 30% of system cost, claimed on your federal taxes. Available through 2032, then steps down. Applies to panels, inverter, racking, labor, and battery if installed with solar.</p>'
        + '<p><strong>State incentives:</strong> ' + (state ? 'Look up "' + escapeHtml(state) + ' solar incentives" on dsireusa.org for your state-specific rebates and tax credits.' : 'Check dsireusa.org for state-specific rebates and tax credits.') + '</p>'
        + '<p><strong>Utility rebates:</strong> some utilities pay a flat rebate per kW installed. Ask your installer or call your utility directly. Rebate availability changes year to year and can run out of budget.</p>'
        + '<p><strong>SREC markets:</strong> if you are in MD, NJ, MA, DC, OH, PA, or DE, you may earn Solar Renewable Energy Credits that pay you per MWh produced. Worth thousands over the system lifetime.</p>';
    }
    if (vertical === "hvac") {
      return ''
        + '<p><strong>Federal heat pump tax credit (25C):</strong> 30% of installed cost up to $2,000 for qualifying heat pumps. ENERGY STAR-rated, installed in your primary residence, claimed on Form 5695.</p>'
        + '<p><strong>HEEHRA / HOMES rebates (IRA-funded):</strong> up to $8,000 rebate for heat pump install for low-to-moderate income households. Rolling out state-by-state through 2026; check your state energy office.</p>'
        + '<p><strong>Utility rebates:</strong> many utilities offer $500–2,000 instant rebates for heat pump installs. Ask your installer to itemize the rebate so you do not pay taxes on it as part of the install cost.</p>';
    }
    if (vertical === "windows") {
      return ''
        + '<p><strong>Federal energy efficient home improvement credit (25C):</strong> 30% up to $600 per year for ENERGY STAR-certified windows. Save your invoice and the ENERGY STAR certification.</p>'
        + '<p><strong>State / utility rebates:</strong> often $20–50 per window for ENERGY STAR. Stack with the federal credit.</p>';
    }
    if (vertical === "insulation") {
      return ''
        + '<p><strong>Federal energy efficient home improvement credit (25C):</strong> 30% up to $1,200 per year on insulation/air sealing.</p>'
        + '<p><strong>HOMES rebates (IRA-funded):</strong> up to $8,000 if your insulation upgrade reduces home energy use by 35%+. Ask the contractor for a pre/post home energy assessment.</p>';
    }
    return ""; // No rebate content for this vertical yet
  }

  // ---- question generator --------------------------------------------

  function collectMissingScope(a) {
    var sigs = (a && (a.signals || a.scope || {})) || {};
    var missing = [];
    Object.keys(sigs).forEach(function (k) {
      var s = sigs[k];
      if (s && (s.status === "missing" || s.status === "uncertain" || s === "missing" || s === false)) {
        missing.push(k);
      }
    });
    if (Array.isArray(a && a.missingScope)) {
      a.missingScope.forEach(function (m) {
        if (missing.indexOf(m) === -1) missing.push(m);
      });
    }
    return missing;
  }

  function generateQuestions(missing, vertical, a) {
    var qs = [];
    var labelMap = scopeLabelMap();
    missing.slice(0, 6).forEach(function (key) {
      var label = labelMap[key] || key.replace(/_/g, " ");
      qs.push("Is " + label + " included in this price, or is it billed separately?");
    });
    qs.push("What is your full payment schedule, and is more than 25% required upfront?");
    qs.push("What is your warranty on labor specifically, separate from manufacturer warranties on materials?");
    qs.push("Who actually does the work — your employees, or subcontractors?");
    qs.push("What happens to the price if the scope changes mid-job?");
    qs.push("Can you provide a written change-order policy that requires my approval before any added charges?");
    return qs;
  }

  function scopeLabelMap() {
    return {
      tearOff: "tear-off and disposal",
      underlayment: "underlayment",
      flashing: "flashing",
      iceShield: "ice and water shield",
      dripEdge: "drip edge",
      ventilation: "ventilation",
      ridgeVent: "ridge vent",
      starterStrip: "starter strip",
      ridgeCap: "ridge cap",
      decking: "decking replacement",
      disposal: "disposal",
      permit: "permit fees",
      ductwork: "ductwork",
      refrigerantLines: "refrigerant lines",
      pad: "outdoor unit pad",
      thermostat: "thermostat",
      labor: "labor",
      parts: "parts",
      diagnostic: "diagnostic fee",
      shop_supplies: "shop supplies",
      hazmat: "hazmat / disposal fees",
      tax: "sales tax",
    };
  }

  // ---- assemble all 7 sections ---------------------------------------

  function renderProSections(analysis, vertical) {
    if (!analysis) return "";
    vertical = vertical || detectVertical();
    var parts = [];
    parts.push(renderRedFlagsSection(analysis, vertical));
    parts.push(renderQuestionsSection(analysis, vertical));
    parts.push(renderNegotiationSection(analysis, vertical));
    parts.push(renderBenchmarkSection(analysis, vertical));
    parts.push(renderWarrantySection(analysis, vertical));
    parts.push(renderBrandSection(analysis, vertical));
    parts.push(renderRebatesSection(analysis, vertical));
    return parts.filter(function (s) { return !!s; }).join("");
  }

  // ---- upsell card -----------------------------------------------------

  function renderProUpsell() {
    return [
      '<div class="tp-pro-upsell tp-pdf-noprint">',
      '<div class="tp-pro-upsell-header">',
      '<div class="tp-pro-upsell-tag">PRO REPORT</div>',
      '<div class="tp-pro-upsell-price">$19 one-time</div>',
      '</div>',
      '<div class="tp-pro-upsell-body">',
      '<p class="tp-pro-upsell-headline">Go deeper on this specific quote.</p>',
      '<ul class="tp-pro-upsell-list">',
      '<li>Personalized red-flag analysis with evidence from your quote</li>',
      '<li>5-10 contractor questions tailored to your missing scope items</li>',
      '<li>Negotiation script with exact wording</li>',
      '<li>Hyper-local benchmark vs your zip code</li>',
      '<li>Brand and tier deep dive for your configuration</li>',
      '<li>Warranty fine-print interpretation</li>',
      '<li>Federal, state, and utility rebate worksheet</li>',
      '</ul>',
      '<p class="tp-pro-upsell-fineprint">One-time payment. 30 days of Pro across all 20 verticals. 30-day money-back guarantee, no questions asked. The free analysis is yours either way.</p>',
      '<div class="tp-pro-upsell-actions">',
      '<button type="button" class="tp-pro-upsell-cta" onclick="WoogoroPro.startCheckout().catch(function(e){alert(\'Checkout error: \' + e.message);});">Unlock Pro for $19</button>',
      '<a class="tp-pro-upsell-link" href="/pro-example.html" target="_blank" rel="noopener">See an example Pro report</a>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");
  }

  // ---- DOM injection ---------------------------------------------------

  function injectIntoReport() {
    var reportBody = document.querySelector(".report-body");
    if (!reportBody) return;
    if (reportBody.querySelector(".tp-pro-injected")) return;

    var analysis = readAnalysis();
    if (!analysis) return;

    var vertical = detectVertical();
    var wrap = document.createElement("div");
    wrap.className = "tp-pro-injected";

    if (cachedStatus && cachedStatus.isPro) {
      wrap.innerHTML = renderProSections(analysis, vertical);
    } else {
      wrap.innerHTML = renderProUpsell();
    }

    reportBody.appendChild(wrap);
  }

  function injectIntoInlineResult() {
    // For free users only: add a single Pro CTA to the inline analyzer
    // result, after the existing result content. Pro users get nothing here
    // because their Pro sections appear in the printable report.
    if (cachedStatus && cachedStatus.isPro) return;
    var output = document.getElementById("analysisOutput");
    if (!output) return;
    if (output.querySelector(".tp-pro-inline-cta")) return;
    if (!output.children || output.children.length === 0) return;

    var div = document.createElement("div");
    div.className = "tp-pro-inline-cta tp-pdf-noprint";
    div.innerHTML = renderProUpsell();
    output.appendChild(div);
  }

  // Wrap the existing showShareScreen so the Pro sections / upsell appear
  // in the printable report. Polls because showShareScreen is defined late.
  function wrapShareScreen() {
    if (typeof window.showShareScreen !== "function") {
      setTimeout(wrapShareScreen, 200);
      return;
    }
    if (window.showShareScreen.__woogoroProWrapped) return;
    var original = window.showShareScreen;
    window.showShareScreen = function () {
      var result = original.apply(this, arguments);
      // Defer to next tick so the report DOM is in place before we inject.
      setTimeout(injectIntoReport, 0);
      return result;
    };
    window.showShareScreen.__woogoroProWrapped = true;
  }

  // Watch the inline result for population, then inject the upsell once.
  function observeInlineResult() {
    var output = document.getElementById("analysisOutput");
    if (!output) return;
    var done = false;
    var observer = new MutationObserver(function () {
      if (done) return;
      if (output.children && output.children.length > 0) {
        done = true;
        // Defer slightly so other render hooks run first.
        setTimeout(injectIntoInlineResult, 250);
      }
    });
    observer.observe(output, { childList: true, subtree: false });
  }

  // ---- styles (injected once) -----------------------------------------

  function ensureStyles() {
    if (document.getElementById("tp-pro-styles")) return;
    var s = document.createElement("style");
    s.id = "tp-pro-styles";
    s.textContent = ''
      + '.tp-pro-tag { display:inline-block; margin-left:8px; padding:2px 8px; background:#1d4ed8; color:#fff; border-radius:999px; font-size:11px; letter-spacing:0.04em; vertical-align:middle; }'
      + '.tp-pro-body { font-size:14px; line-height:1.6; color:#0f172a; }'
      + '.tp-pro-body p { margin:8px 0 12px; }'
      + '.tp-pro-list { margin:8px 0 12px; padding-left:24px; }'
      + '.tp-pro-list li { margin:6px 0; }'
      + '.tp-pro-flag { list-style:none; padding:10px 12px; margin:8px 0; border-radius:8px; border-left:4px solid #cbd5e1; background:#f8fafc; }'
      + '.tp-pro-flag-high { border-left-color:#dc2626; background:#fef2f2; }'
      + '.tp-pro-flag-warn { border-left-color:#f59e0b; background:#fffbeb; }'
      + '.tp-pro-flag-low { border-left-color:#94a3b8; background:#f8fafc; }'
      + '.tp-pro-flag-detail { font-size:13px; color:#475569; margin-top:4px; }'
      + '.tp-pro-script { margin:8px 0; padding:14px 16px; background:#f0f9ff; border-left:4px solid #1d4ed8; border-radius:6px; font-style:italic; color:#0f172a; line-height:1.7; white-space:pre-wrap; }'
      + '.tp-pro-table { width:100%; border-collapse:collapse; margin:8px 0; font-size:14px; }'
      + '.tp-pro-table td { padding:8px 4px; border-bottom:1px solid #e2e8f0; }'
      + '.tp-pro-table td:first-child { color:#475569; }'
      + '.tp-pro-table td:last-child { text-align:right; font-variant-numeric:tabular-nums; }'

      // Free users never see .tp-pdf-premium content. Pro users do.
      // body.is-premium is set by getStatus when isPro is true.
      + '.tp-pdf-premium { display:none; }'
      + 'body.is-premium .tp-pdf-premium { display:block; }'

      // Upsell card
      + '.tp-pro-upsell { margin:24px 0; padding:0; border:2px solid #1d4ed8; border-radius:14px; background:#fff; overflow:hidden; }'
      + '.tp-pro-upsell-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:#1d4ed8; color:#fff; }'
      + '.tp-pro-upsell-tag { font-size:13px; font-weight:700; letter-spacing:0.08em; }'
      + '.tp-pro-upsell-price { font-size:15px; font-weight:600; }'
      + '.tp-pro-upsell-body { padding:18px 20px; }'
      + '.tp-pro-upsell-headline { font-size:16px; font-weight:600; color:#0f172a; margin:0 0 12px; }'
      + '.tp-pro-upsell-list { margin:0 0 14px; padding-left:22px; font-size:14px; color:#0f172a; line-height:1.6; }'
      + '.tp-pro-upsell-list li { margin:4px 0; }'
      + '.tp-pro-upsell-fineprint { font-size:12px; color:#64748b; margin:8px 0 16px; line-height:1.5; }'
      + '.tp-pro-upsell-actions { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }'
      + '.tp-pro-upsell-cta { background:#1d4ed8; color:#fff; border:none; padding:12px 22px; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; font-family:inherit; }'
      + '.tp-pro-upsell-cta:hover { background:#1e40af; }'
      + '.tp-pro-upsell-link { color:#1d4ed8; text-decoration:underline; font-size:14px; }'
      + 'body.is-premium .tp-pro-upsell, body.is-premium .tp-pro-inline-cta { display:none; }'

      // Pro badge for printable report when user IS Pro (subtle confirmation)
      + 'body.is-premium .tp-pro-tag { background:#16a34a; }';
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- init ------------------------------------------------------------

  function init() {
    ensureStyles();
    getStatus(); // fire-and-forget: sets body.is-premium when ready
    wrapShareScreen();
    observeInlineResult();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ---- export ----------------------------------------------------------

  window.WoogoroPro = {
    getToken: getToken,
    getStatus: getStatus,
    refreshStatus: refreshStatus,
    startCheckout: startCheckout,
    renderProSections: renderProSections,
    renderProUpsell: renderProUpsell,
  };
  window.tpUnlockPremium = tpUnlockPremium;
})();
