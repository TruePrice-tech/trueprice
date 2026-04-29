// js/wrong-vertical-guard.js
//
// Standalone wrong-vertical hard-reject helper for analyzers that don't
// use the shared price-confirm.js (medical, legal, roofing, etc.). Each
// such analyzer adds:
//
//   <script src="/js/vertical-detect.min.js"></script>
//   <script src="/js/wrong-vertical-guard.min.js" defer></script>
//
// Then in its analyze flow, AFTER OCR completes:
//
//   if (window.tpEnforceVerticalMatch("medical", ocrText, appRootEl)) {
//     return;  // hard-reject screen rendered, don't continue
//   }
//
// Threshold matches the shared price-confirm.js HARD REJECT path:
//   - other vertical >= 3 keyword hits
//   - other vertical scores >= 3x current
//   - current vertical < 2 hits
//
// Trust requirement (Lane 2026-04-29): never produce a confident verdict
// from a document plainly for a different service.

(function () {
  if (typeof window === "undefined") return;
  if (window.tpEnforceVerticalMatch) return;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function capitalize(s) {
    if (!s) return "";
    s = String(s);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Returns true if a hard-reject screen was rendered (caller should bail).
  // Returns false if input is fine to proceed.
  window.tpEnforceVerticalMatch = function (currentVertical, ocrText, appRootEl) {
    if (!ocrText || !currentVertical || typeof window.detectVerticalFromText !== "function") {
      return false;
    }
    var detected = window.detectVerticalFromText(ocrText);
    if (!detected || !detected.all) return false;

    // Normalize: vertical-detect uses some specific labels (e.g. "auto" not
    // "auto_repair", "windows" not "window"). Match either form.
    var aliases = {
      auto_repair: "auto", auto: "auto_repair",
      windows: "window", window: "windows",
      gutters: "gutter", gutter: "gutters",
      garage_door: "garage-door", "garage-door": "garage_door",
    };
    var nonCurTop = null, curEntry = null;
    for (var i = 0; i < detected.all.length; i++) {
      var entry = detected.all[i];
      var matchesCurrent = entry.vertical === currentVertical
        || entry.vertical === aliases[currentVertical];
      if (matchesCurrent) {
        if (!curEntry) curEntry = entry;
      } else {
        if (!nonCurTop) nonCurTop = entry;
      }
    }
    var curScore = curEntry ? curEntry.score : 0;

    // HARD REJECT criteria
    if (!nonCurTop || nonCurTop.score < 3) return false;
    if (curScore >= 2) return false;
    if (nonCurTop.score < curScore * 3) return false;

    // Render the rejection screen
    var rootEl = appRootEl || document.getElementById("appRoot") || document.body;
    if (!rootEl) return false;

    var verticalLabel = capitalize(currentVertical.replace(/_/g, " "));
    rootEl.innerHTML =
      '<div style="padding:24px 16px;text-align:center;">' +
      '<h1 style="font-size:22px;color:#991b1b;">This is not a ' + escapeHtml(verticalLabel) + ' quote</h1>' +
      '</div>' +
      '<div style="text-align:center;max-width:540px;margin:0 auto;padding:32px 24px;border:2px solid #fecaca;background:#fef2f2;border-radius:14px;">' +
      '<picture><source srcset="/images/Iris/Iris%20concerned.webp" type="image/webp"/><img src="/images/Iris/Iris%20concerned.png" alt="Iris is concerned" style="margin-bottom:12px;width:120px;height:120px;" width="120" height="120"/></picture>' +
      '<p style="font-size:17px;font-weight:600;color:#991b1b;margin:0 0 10px;">The document you uploaded looks like a <strong>' + escapeHtml(nonCurTop.label) + '</strong> quote.</p>' +
      '<p style="font-size:14px;color:#7f1d1d;margin:0 0 20px;line-height:1.5;">We could try to analyze it as a ' + escapeHtml(verticalLabel.toLowerCase()) + ' quote anyway, but the result would be unreliable. We would rather refuse than give you a confident answer based on the wrong inputs.</p>' +
      '<a href="' + escapeHtml(nonCurTop.url) + '" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;margin:0 6px 10px;">Analyze as ' + escapeHtml(nonCurTop.label) + ' instead</a>' +
      '<a href="javascript:void(0)" id="tpWvgStartOver" style="display:inline-block;background:#fff;color:#991b1b;padding:11px 22px;border:2px solid #fecaca;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;margin:0 6px 10px;">Upload a different file</a>' +
      '<p style="font-size:12px;color:#9ca3af;margin:14px 0 0;">Detection confidence: ' + nonCurTop.score + ' ' + escapeHtml(nonCurTop.label) + ' keywords vs ' + curScore + ' ' + escapeHtml(verticalLabel.toLowerCase()) + ' keywords</p>' +
      '</div>';

    var startOver = document.getElementById("tpWvgStartOver");
    if (startOver) startOver.addEventListener("click", function () { window.location.reload(); });

    return true;
  };
})();
