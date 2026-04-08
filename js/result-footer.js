/*
 * TruePrice — Shared Result Footer (v2)
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
      + '.tp-action-primary { background:#1d4ed8; color:#fff; border:2px solid #1d4ed8; }'
      + '.tp-action-primary:hover { background:#1e40af; }'
      + '.tp-action-secondary { background:#f1f5f9; color:#334155; border:2px solid #e2e8f0; }'
      + '.tp-action-secondary:hover { background:#e2e8f0; }'
      + '.tp-action-tertiary { background:#fff; color:#64748b; border:2px solid #e2e8f0; }'
      + '.tp-action-tertiary:hover { border-color:#94a3b8; color:#334155; }'
      + '.tp-action-ghost { background:transparent; color:#94a3b8; border:2px solid transparent; }'
      + '.tp-action-ghost:hover { background:#f8fafc; color:#64748b; }'
      + '.tp-action-icon { width:32px; height:32px; border-radius:50%; object-fit:cover; }'
      + '@media (max-width:600px) { .tp-action-row { grid-template-columns:1fr 1fr; } }'
      + '@media (max-width:400px) { .tp-action-row { grid-template-columns:1fr; } }'
      + '@media print { .tp-result-footer { display:none !important; } }';
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
      var subj = "Feedback on " + (verticalLabel || "TruePrice") + " result";
      window.location.href = "mailto:hello@truepricehq.com?subject=" + encodeURIComponent(subj);
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
      + '    <a class="tp-action tp-action-tertiary" href="/">'
      + '      <img src="/images/trudy-peeking.png" alt="" class="tp-action-icon" />'
      + '      <span class="tp-action-label">Home</span>'
      + '    </a>'
      + '    <button type="button" class="tp-action tp-action-ghost" onclick="' + feedbackHandler + '">'
      + '      <img src="/images/trudy-curious.png" alt="" class="tp-action-icon" />'
      + '      <span class="tp-action-label">Send feedback</span>'
      + '    </button>'
      + '  </div>'
      + '</div>';

    // Wire thumbs handler after the DOM has the footer
    setTimeout(function () { wireThumbs(vertical); }, 0);

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

  // Tiny CSS.escape polyfill for selector safety
  function cssEscape(s) {
    s = String(s || "");
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(s);
    return s.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }
})();
