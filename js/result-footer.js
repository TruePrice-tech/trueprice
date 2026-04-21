/*
 * Woogoro — Shared Result Footer (v2)
 * -------------------------------------
 * One consistent post-result footer every vertical's result page renders
 * after its analysis. Replaces the older js/trudy-footer.js (which is
 * still present during migration). Keeps things minimal: a thumbs
 * feedback row above a 4-button action row with mini-Trudy icons.
 *
 * Public API:
 *   window.tpRenderResultFooter({
 *     vertical:      "hvac",          // slug, required
 *     verticalLabel: "HVAC",          // human label, required
 *     onStartOver:   "hvacStartOver", // global fn name, required
 *     onSavePdf:     "hvacSavePdf"    // optional global fn name; falls back to window.print()
 *   }) -> HTML string
 *
 * Usage:
 *   <script src="/js/result-footer.js" defer></script>
 *   // ...after rendering your result HTML, inject the footer:
 *   document.getElementById("resultRoot").insertAdjacentHTML(
 *     "beforeend",
 *     window.tpRenderResultFooter({
 *       vertical: "hvac",
 *       verticalLabel: "HVAC",
 *       onStartOver: "hvacStartOver"
 *     })
 *   );
 *
 * Self-contained: ES5 + DOM only, no build step, no external deps.
 */
(function () {
  if (window.tpRenderResultFooter) return;

  // ---- styles (injected once) -------------------------------------------
  function ensureStyles() {
    if (document.getElementById("tp-result-footer-styles")) return;
    var s = document.createElement("style");
    s.id = "tp-result-footer-styles";
    s.textContent = ''
      + '.tp-result-footer { max-width:720px; margin:32px auto; padding:24px; border-top:1px solid #e2e8f0; }'
      + '.tp-feedback-row { display:flex; align-items:center; justify-content:center; gap:12px; font-size:15px; flex-wrap:wrap; }'
      + '.tp-feedback-label { color:#475569; font-weight:600; }'
      + '.tp-thumb { width:44px; height:44px; background:none; border:1px solid #e2e8f0; border-radius:50%; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.15s; padding:0; font-family:inherit; }'
      + '.tp-thumb:hover { transform:translateY(-2px); }'
      + '.tp-thumb-up:hover { background:#f0fdf4; border-color:#22c55e; }'
      + '.tp-thumb-down:hover { background:#fef2f2; border-color:#ef4444; }'
      + '.tp-thumb-icon { font-size:20px; line-height:1; }'
      + '.tp-feedback-thanks { font-size:13px; color:#16a34a; margin-left:12px; font-weight:600; }'
      + '.tp-footer-divider { border:0; border-top:1px solid #e2e8f0; margin:24px 0; }'
      + '.tp-action-row { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; }'
      + '.tp-action { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; border-radius:12px; gap:8px; cursor:pointer; text-decoration:none; font-size:14px; font-weight:600; transition:all 0.15s; font-family:inherit; text-align:center; }'
      + '.tp-action-primary { background:#fff; color:#334155; border:2px solid #e2e8f0; }'
      + '.tp-action-primary:hover { border-color:#94a3b8; color:#0f172a; }'
      + '.tp-action-secondary { background:#fff; color:#334155; border:2px solid #e2e8f0; }'
      + '.tp-action-secondary:hover { border-color:#94a3b8; color:#0f172a; }'
      + '.tp-action-tertiary { background:#fff; color:#334155; border:2px solid #e2e8f0; }'
      + '.tp-action-tertiary:hover { border-color:#94a3b8; color:#0f172a; }'
      + '.tp-action-ghost { background:#fff; color:#334155; border:2px solid #e2e8f0; }'
      + '.tp-action-ghost:hover { border-color:#94a3b8; color:#0f172a; }'
      + '.tp-footer-brand { text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; }'
      + '.tp-footer-brand a { text-decoration:none; display:inline-flex; align-items:center; gap:6px; color:#64748b; font-size:13px; }'
      + '.tp-action-icon { width:32px; height:32px; border-radius:50%; object-fit:cover; }'
      + '@media (max-width:600px) { .tp-action-row { grid-template-columns:1fr 1fr; } }'
      + '@media (max-width:400px) { .tp-action-row { grid-template-columns:1fr; } }'
      + '@media print { .tp-result-footer { display:none !important; } }'
      + '.tp-qc { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:20px; margin:20px 0; }'
      + '.tp-qc-title { font-size:15px; font-weight:700; color:#166534; margin:0 0 4px; }'
      + '.tp-qc-sub { font-size:13px; color:#475569; margin:0 0 14px; }'
      + '.tp-qc-fields { display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; }'
      + '.tp-qc-field { display:flex; flex-direction:column; gap:2px; flex:1; min-width:120px; }'
      + '.tp-qc-field label { font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }'
      + '.tp-qc-input { padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; font-family:inherit; width:100%; box-sizing:border-box; }'
      + '.tp-qc-input:focus { outline:none; border-color:#22c55e; box-shadow:0 0 0 2px rgba(34,197,94,0.15); }'
      + '.tp-qc-loc { display:flex; gap:8px; }'
      + '.tp-qc-loc .tp-qc-field:last-child { flex:0 0 70px; min-width:70px; }'
      + '.tp-qc-btn { padding:8px 18px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; transition:background 0.15s; }'
      + '.tp-qc-btn:hover { background:#15803d; }'
      + '.tp-qc-btn:disabled { background:#86efac; cursor:not-allowed; }'
      + '.tp-qc-privacy { font-size:11px; color:#6b7280; margin:8px 0 0; }'
      + '.tp-qc-err { font-size:13px; color:#dc2626; margin:6px 0 0; }'
      + '.tp-qc-thanks { font-size:14px; color:#166534; line-height:1.5; }'
      + '.tp-qc-thanks strong { font-weight:700; }'
      + '.tp-em { background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:20px; margin:16px 0 20px; }'
      + '.tp-em-title { font-size:15px; font-weight:700; color:#1e3a5f; margin:0 0 4px; }'
      + '.tp-em-sub { font-size:13px; color:#475569; margin:0 0 14px; }'
      + '.tp-em-row { display:flex; gap:8px; flex-wrap:wrap; align-items:stretch; }'
      + '.tp-em-input { flex:1; min-width:180px; padding:9px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; font-family:inherit; box-sizing:border-box; }'
      + '.tp-em-input:focus { outline:none; border-color:#1e3a5f; box-shadow:0 0 0 2px rgba(30,58,95,0.15); }'
      + '.tp-em-btn { padding:9px 18px; background:#1e3a5f; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; transition:background 0.15s; }'
      + '.tp-em-btn:hover { background:#152b47; }'
      + '.tp-em-btn:disabled { background:#94a3b8; cursor:not-allowed; }'
      + '.tp-em-privacy { font-size:11px; color:#6b7280; margin:10px 0 0; }'
      + '.tp-em-privacy a { color:#475569; text-decoration:underline; }'
      + '.tp-em-err { font-size:13px; color:#dc2626; margin:6px 0 0; }'
      + '.tp-em-thanks { font-size:14px; color:#1e3a5f; line-height:1.5; }'
      + '.tp-em-thanks strong { font-weight:700; }';
    document.head.appendChild(s);
  }

  // ---- helpers ----------------------------------------------------------
  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Fallback feedback opener: only define if nothing else has.
  if (typeof window.tpOpenFeedback !== "function") {
    window.tpOpenFeedback = function (verticalLabel) {
      var subj = "Feedback on " + (verticalLabel || "Woogoro") + " result";
      window.location.href = "mailto:hello@woogoro.com?subject=" + encodeURIComponent(subj);
    };
  }

  // ---- main render ------------------------------------------------------
  window.tpRenderResultFooter = function (opts) {
    opts = opts || {};
    ensureStyles();

    var vertical      = opts.vertical || "";
    var verticalLabel = opts.verticalLabel || vertical || "Tool";
    var onStartOver   = opts.onStartOver || "";
    var onSavePdf     = opts.onSavePdf || "";

    var startOverHandler = onStartOver
      ? "if(typeof window['" + escHtml(onStartOver) + "']==='function'){window['" + escHtml(onStartOver) + "']()}else{location.reload()}"
      : "location.reload()";

    var savePdfHandler = onSavePdf
      ? "if(typeof window['" + escHtml(onSavePdf) + "']==='function'){window['" + escHtml(onSavePdf) + "']()}else{window.print()}"
      : "window.print()";

    var feedbackHandler = "window.tpOpenFeedback('" + escHtml(verticalLabel).replace(/'/g, "\\'") + "')";

    var label = escHtml(verticalLabel);
    var slug  = escHtml(vertical);

    // Feature flag: email capture is built end-to-end (endpoints, privacy
    // policy, unsubscribe) but hidden until send infra is ready (virtual
    // mailbox + DKIM/SPF/DMARC + send provider). Flip on by setting
    // `window.WOOGORO_EMAIL_CAPTURE = true` on the host page before
    // result-footer.js runs, or by changing the default here to true.
    var emailCaptureEnabled = (window.WOOGORO_EMAIL_CAPTURE === true);

    var emailCaptureHtml = emailCaptureEnabled
      ? (''
        + '  <div class="tp-em" data-em-vertical="' + slug + '">'
        + '    <div class="tp-em-title">Get notified if ' + label.toLowerCase() + ' prices change in <span class="tp-em-location-label">your area</span></div>'
        + '    <p class="tp-em-sub">A few emails a year, only when pricing moves enough to matter. Opt-in only, one-click unsubscribe.</p>'
        + '    <div class="tp-em-form">'
        + '      <div class="tp-em-row">'
        + '        <input type="email" class="tp-em-input" placeholder="your@email.com" autocomplete="email" maxlength="254" />'
        + '        <button type="button" class="tp-em-btn">Notify me</button>'
        + '      </div>'
        + '      <p class="tp-em-privacy">We never sell, share, or rent your email. See our <a href="/privacy.html#5.1-price-alert-email-notifications-opt-in" target="_blank" rel="noopener">privacy policy</a>.</p>'
        + '      <div class="tp-em-err" hidden></div>'
        + '    </div>'
        + '  </div>')
      : '';

    var html = ''
      + '<div class="tp-result-footer" data-vertical="' + slug + '">'
      + '  <div class="tp-feedback-row">'
      + '    <span class="tp-feedback-label">Was this helpful?</span>'
      + '    <button class="tp-thumb tp-thumb-up" data-vote="up" aria-label="Yes, helpful">'
      + '      <span class="tp-thumb-icon">&#128077;</span>'
      + '    </button>'
      + '    <button class="tp-thumb tp-thumb-down" data-vote="down" aria-label="No, not helpful">'
      + '      <span class="tp-thumb-icon">&#128078;</span>'
      + '    </button>'
      + '    <div class="tp-feedback-thanks" hidden>Thanks! Your feedback helps us get better.</div>'
      + '  </div>'
      + '  <div class="tp-qc" data-qc-vertical="' + slug + '">'
      + '    <div class="tp-qc-title">Got a real quote? Share it anonymously</div>'
      + '    <p class="tp-qc-sub">Help neighbors in <strong class="tp-qc-location-label">your area</strong> get fair prices</p>'
      + '    <div class="tp-qc-form">'
      + '      <div class="tp-qc-fields">'
      + '        <div class="tp-qc-field"><label>What did you pay?</label><input type="number" class="tp-qc-input tp-qc-price" placeholder="$ amount" min="1" step="1" /></div>'
      + '        <div class="tp-qc-field"><label>Contractor (optional)</label><input type="text" class="tp-qc-input tp-qc-contractor" placeholder="Company name" maxlength="100" /></div>'
      + '      </div>'
      + '      <div class="tp-qc-loc" style="display:none;">'
      + '        <div class="tp-qc-field"><label>City</label><input type="text" class="tp-qc-input tp-qc-city" placeholder="City" maxlength="60" /></div>'
      + '        <div class="tp-qc-field"><label>State</label><input type="text" class="tp-qc-input tp-qc-state" placeholder="ST" maxlength="2" /></div>'
      + '      </div>'
      + '      <div style="margin-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
      + '        <button type="button" class="tp-qc-btn">Share anonymously</button>'
      + '        <span class="tp-qc-privacy">Never shared with contractors.</span>'
      + '      </div>'
      + '      <div class="tp-qc-err" hidden></div>'
      + '    </div>'
      + '  </div>'
      + emailCaptureHtml
      + '  <hr class="tp-footer-divider" />'
      + '  <div class="tp-action-row">'
      + '    <button type="button" class="tp-action tp-action-primary" onclick="' + startOverHandler + '">'
      + '      <img src="/images/trudy-thinking.png" alt="" class="tp-action-icon" />'
      + '      <span class="tp-action-label">Back to ' + label + '</span>'
      + '    </button>'
      + '    <button type="button" class="tp-action tp-action-secondary" onclick="' + savePdfHandler + '">'
      + '      <img src="/images/trudy-clipboard.png" alt="" class="tp-action-icon" />'
      + '      <span class="tp-action-label">Save as PDF</span>'
      + '    </button>'
      + '    <button type="button" class="tp-action tp-action-tertiary tp-share-btn" data-share-vertical="' + slug + '">'
      + '      <img src="/images/trudy-peeking.png" alt="" class="tp-action-icon" />'
      + '      <span class="tp-action-label">Share link</span>'
      + '    </button>'
      + '    <a class="tp-action tp-action-ghost" href="/">'
      + '      <img src="/images/trudy-peeking.png" alt="" class="tp-action-icon" />'
      + '      <span class="tp-action-label">Home</span>'
      + '    </a>'
      + '  </div>'
      + '  <div class="tp-footer-brand">'
      + '    <a href="/"><img src="/images/trudy-peeking.png" alt="" width="28" />Powered by <strong style="color:#1e3a5f;">Woogoro</strong></a>'
      + '  </div>'
      + '</div>';

    // Wire thumbs handler, quote capture, email capture (if enabled), and share after the DOM has the footer
    setTimeout(function () {
      wireThumbs(vertical);
      wireQuoteCapture(vertical);
      if (emailCaptureEnabled) wireEmailCapture(vertical);
      wireShareBtn(vertical, verticalLabel);
    }, 0);

    return html;
  };

  // ---- thumbs handler ---------------------------------------------------
  function wireThumbs(vertical) {
    var footers = document.querySelectorAll('.tp-result-footer[data-vertical="' + cssEscape(vertical) + '"]');
    for (var i = 0; i < footers.length; i++) {
      var footer = footers[i];
      if (footer.__tpThumbsWired) continue;
      footer.__tpThumbsWired = true;

      (function (root) {
        var thumbs = root.querySelectorAll(".tp-thumb");
        for (var j = 0; j < thumbs.length; j++) {
          thumbs[j].addEventListener("click", function (ev) {
            var btn = ev.currentTarget;
            var vote = btn.getAttribute("data-vote");
            recordVote(vertical, vote);

            // Hide both thumbs and label, show thanks
            var row = root.querySelector(".tp-feedback-row");
            if (row) {
              var hideEls = row.querySelectorAll(".tp-thumb, .tp-feedback-label");
              for (var k = 0; k < hideEls.length; k++) hideEls[k].style.display = "none";
              var thanks = row.querySelector(".tp-feedback-thanks");
              if (thanks) thanks.hidden = false;
            }
          });
        }
      })(footer);
    }
  }

  function recordVote(vertical, vote) {
    var ts = Date.now();
    // localStorage
    try {
      localStorage.setItem("tp:feedback:" + vertical + ":" + ts, vote);
    } catch (e) {}
    // Best-effort POST
    try {
      if (typeof fetch === "function") {
        fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vertical: vertical, vote: vote, timestamp: ts })
        }).catch(function () {});
      }
    } catch (e) {}
    // Analytics hook
    try {
      if (typeof window.tpTrack === "function") {
        window.tpTrack("feedback_thumbs", { vertical: vertical, vote: vote });
      }
    } catch (e) {}
  }

  // ---- quote capture handler ---------------------------------------------
  function wireQuoteCapture(vertical) {
    var cards = document.querySelectorAll('.tp-qc[data-qc-vertical="' + cssEscape(vertical) + '"]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.__tpQcWired) continue;
      card.__tpQcWired = true;
      (function (root, vert) {
        // Auto-detect city/state + model estimate from whichever global the
        // host page exposes. Estimate pages set __tpResultContext; analyzer
        // pages set __latestAnalysis.
        var city = "", st = "", modelEstimate = 0;
        var cEl = document.getElementById("addrCity");
        var sEl = document.getElementById("addrState");
        if (cEl && cEl.value) city = cEl.value.trim();
        if (sEl && sEl.value) st = sEl.value.trim().toUpperCase();
        if (window.__latestAnalysis) {
          city = city || window.__latestAnalysis.city || "";
          st = st || (window.__latestAnalysis.stateCode || "").toUpperCase();
          modelEstimate = Number(window.__latestAnalysis.totalPrice) || modelEstimate;
        }
        if (window.__tpResultContext) {
          city = city || window.__tpResultContext.city || "";
          st = st || (window.__tpResultContext.stateCode || "").toUpperCase();
          var ctxResult = window.__tpResultContext.result || {};
          modelEstimate = Number(ctxResult.totalPrice || ctxResult.midPrice || ctxResult.estimate) || modelEstimate;
        }

        // Update location label
        var label = root.querySelector(".tp-qc-location-label");
        if (city && st && label) {
          label.textContent = city + ", " + st;
        }

        // Show city/state fields if not auto-detected
        var locRow = root.querySelector(".tp-qc-loc");
        if (!city && locRow) locRow.style.display = "flex";

        // Submit handler
        var btn = root.querySelector(".tp-qc-btn");
        var errEl = root.querySelector(".tp-qc-err");
        if (!btn) return;

        btn.addEventListener("click", function () {
          var priceInput = root.querySelector(".tp-qc-price");
          var contractorInput = root.querySelector(".tp-qc-contractor");
          var cityInput = root.querySelector(".tp-qc-city");
          var stateInput = root.querySelector(".tp-qc-state");

          var price = parseFloat((priceInput && priceInput.value) || "0");
          var contractor = (contractorInput && contractorInput.value) || "";
          var subCity = city || (cityInput && cityInput.value ? cityInput.value.trim() : "");
          var subState = st || (stateInput && stateInput.value ? stateInput.value.trim().toUpperCase() : "");

          // Validation
          if (!price || price <= 0) {
            if (errEl) { errEl.textContent = "Please enter the amount you paid."; errEl.hidden = false; }
            return;
          }
          if (price > 500000) {
            if (errEl) { errEl.textContent = "That price seems too high. Please double-check."; errEl.hidden = false; }
            return;
          }
          if (errEl) errEl.hidden = true;

          btn.disabled = true;
          btn.textContent = "Submitting...";

          var payload = {
            price: price,
            contractor: contractor,
            city: subCity,
            stateCode: subState,
            service: vert,
            source: "user_submitted_actual",
            modelEstimate: modelEstimate || 0
          };

          fetch("/api/calibration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) {
              if (errEl) { errEl.textContent = data.error; errEl.hidden = false; }
              btn.disabled = false;
              btn.textContent = "Share anonymously";
              return;
            }

            // Build thanks message. Prefer model delta (instant feedback,
            // always available on estimate pages) over aggregate delta
            // (only useful once 2+ quotes in the area).
            var formattedPrice = "$" + price.toLocaleString();
            var thanksHtml = "<strong>Thanks!</strong> ";
            var didPrimary = false;

            if (modelEstimate > 0) {
              var mDiff = Math.round(((price - modelEstimate) / modelEstimate) * 100);
              var mAbs = Math.abs(mDiff);
              var fmtModel = "$" + Math.round(modelEstimate).toLocaleString();
              if (mAbs <= 5) {
                thanksHtml += "Your " + formattedPrice + " is right in line with our estimate of " + fmtModel + ".";
              } else {
                thanksHtml += "Your " + formattedPrice + " is " + mAbs + "% " + (mDiff > 0 ? "above" : "below") + " our estimate of " + fmtModel + ".";
              }
              didPrimary = true;
            }

            if (data.aggregate && data.aggregate.avgPrice && data.aggregate.quotes > 1) {
              var avg = data.aggregate.avgPrice;
              var pctDiff = Math.round(((price - avg) / avg) * 100);
              var absPct = Math.abs(pctDiff);
              var area = (subCity && subState) ? (subCity + ", " + subState) : "your area";
              thanksHtml += (didPrimary ? " " : "");
              if (absPct <= 3) {
                thanksHtml += "It's in line with the " + data.aggregate.quotes + "-quote average for " + area + ".";
              } else {
                thanksHtml += "It's " + absPct + "% " + (pctDiff > 0 ? "above" : "below") + " the " + data.aggregate.quotes + "-quote average for " + area + ".";
              }
              didPrimary = true;
            }

            if (!didPrimary) {
              thanksHtml += "Your " + formattedPrice + " helps establish pricing data";
              if (subCity && subState) thanksHtml += " for " + subCity + ", " + subState;
              thanksHtml += ".";
            }

            thanksHtml += "<br>This helps calibrate estimates for everyone in your area.";

            // Replace form with thanks
            var formEl = root.querySelector(".tp-qc-form");
            if (formEl) formEl.style.display = "none";
            var sub = root.querySelector(".tp-qc-sub");
            if (sub) sub.style.display = "none";
            var title = root.querySelector(".tp-qc-title");
            if (title) title.style.display = "none";

            var thanksDiv = document.createElement("div");
            thanksDiv.className = "tp-qc-thanks";
            thanksDiv.innerHTML = thanksHtml;
            root.appendChild(thanksDiv);
          })
          .catch(function () {
            if (errEl) { errEl.textContent = "Something went wrong. Please try again."; errEl.hidden = false; }
            btn.disabled = false;
            btn.textContent = "Share anonymously";
          });
        });
      })(card, vertical);
    }
  }

  // ---- email capture handler --------------------------------------------
  function wireEmailCapture(vertical) {
    var cards = document.querySelectorAll('.tp-em[data-em-vertical="' + cssEscape(vertical) + '"]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.__tpEmWired) continue;
      card.__tpEmWired = true;
      (function (root, vert) {
        var city = "", st = "";
        var cEl = document.getElementById("addrCity");
        var sEl = document.getElementById("addrState");
        if (cEl && cEl.value) city = cEl.value.trim();
        if (sEl && sEl.value) st = sEl.value.trim().toUpperCase();
        if (window.__latestAnalysis) {
          city = city || window.__latestAnalysis.city || "";
          st = st || (window.__latestAnalysis.stateCode || "").toUpperCase();
        }
        if (window.__tpResultContext) {
          city = city || window.__tpResultContext.city || "";
          st = st || (window.__tpResultContext.stateCode || "").toUpperCase();
        }

        var label = root.querySelector(".tp-em-location-label");
        if (city && st && label) label.textContent = city + ", " + st;

        var btn = root.querySelector(".tp-em-btn");
        var input = root.querySelector(".tp-em-input");
        var errEl = root.querySelector(".tp-em-err");
        if (!btn || !input) return;

        function submit() {
          var email = (input.value || "").trim();
          var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRe.test(email)) {
            if (errEl) { errEl.textContent = "Please enter a valid email address."; errEl.hidden = false; }
            return;
          }
          if (errEl) errEl.hidden = true;

          btn.disabled = true;
          btn.textContent = "Saving...";

          fetch("/api/email-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email,
              city: city,
              stateCode: st,
              service: vert,
              source: "result_page"
            })
          })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
          .then(function (resp) {
            if (!resp.ok || !resp.data || resp.data.error) {
              if (errEl) {
                errEl.textContent = (resp.data && resp.data.error) || "Something went wrong. Please try again.";
                errEl.hidden = false;
              }
              btn.disabled = false;
              btn.textContent = "Notify me";
              return;
            }
            var formEl = root.querySelector(".tp-em-form");
            var sub = root.querySelector(".tp-em-sub");
            var title = root.querySelector(".tp-em-title");
            if (formEl) formEl.style.display = "none";
            if (sub) sub.style.display = "none";
            if (title) title.style.display = "none";

            var thanks = document.createElement("div");
            thanks.className = "tp-em-thanks";
            var area = (city && st) ? (city + ", " + st) : "your area";
            thanks.innerHTML = "<strong>You're on the list.</strong> We'll email you only when " + escHtml(vert) + " prices move meaningfully in " + escHtml(area) + ". Every email has one-click unsubscribe.";
            root.appendChild(thanks);
          })
          .catch(function () {
            if (errEl) { errEl.textContent = "Network error. Please try again."; errEl.hidden = false; }
            btn.disabled = false;
            btn.textContent = "Notify me";
          });
        }

        btn.addEventListener("click", submit);
        input.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.keyCode === 13) {
            ev.preventDefault();
            submit();
          }
        });
      })(card, vertical);
    }
  }

  // ---- share link handler -------------------------------------------------
  function wireShareBtn(vertical, verticalLabel) {
    var btns = document.querySelectorAll('.tp-share-btn[data-share-vertical="' + cssEscape(vertical) + '"]');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (btn.__tpShareWired) continue;
      btn.__tpShareWired = true;
      (function (el, vert, vLabel) {
        el.addEventListener("click", function () {
          var labelEl = el.querySelector(".tp-action-label");
          if (!labelEl) return;

          // Gather result data from available sources
          var result = null;
          var city = "", st = "";

          if (window.__latestAnalysis) {
            result = window.__latestAnalysis;
            city = result.city || "";
            st = result.stateCode || "";
          }
          if (window.__tpResultContext) {
            city = city || window.__tpResultContext.city || "";
            st = st || window.__tpResultContext.stateCode || "";
            if (window.__tpResultContext.result) result = window.__tpResultContext.result;
          }

          if (!result) {
            labelEl.textContent = "No data to share";
            setTimeout(function () { labelEl.textContent = "Share link"; }, 2000);
            return;
          }

          labelEl.textContent = "Saving...";
          el.disabled = true;

          var payload = {
            vertical: vert,
            verticalLabel: vLabel,
            result: result,
            city: city,
            stateCode: st
          };

          fetch("/api/share-estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) {
              labelEl.textContent = data.error;
              el.disabled = false;
              setTimeout(function () { labelEl.textContent = "Share link"; }, 3000);
              return;
            }

            var shareUrl = window.location.origin + data.url;

            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(shareUrl).then(function () {
                labelEl.textContent = "Link copied!";
              }).catch(function () {
                labelEl.textContent = "Link ready";
                prompt("Copy this link:", shareUrl);
              });
            } else {
              labelEl.textContent = "Link ready";
              prompt("Copy this link:", shareUrl);
            }

            el.disabled = false;
            setTimeout(function () { labelEl.textContent = "Share link"; }, 4000);
          })
          .catch(function () {
            labelEl.textContent = "Failed";
            el.disabled = false;
            setTimeout(function () { labelEl.textContent = "Share link"; }, 3000);
          });
        });
      })(btn, vertical, verticalLabel);
    }
  }

  // Tiny CSS.escape polyfill for selector safety
  function cssEscape(s) {
    s = String(s || "");
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(s);
    return s.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }
})();
