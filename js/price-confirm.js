// Option C: Price confirmation component.
// Shows extracted price for user to confirm or edit.
// If no price found, shows manual entry.
//
// Usage: renderPriceConfirmation(appRoot, price, cssPrefix, onConfirm)
//   appRoot:    DOM element to render into
//   price:      extracted price (0 or null = no price found)
//   cssPrefix:  vertical CSS class prefix (e.g. "plumb", "hvac", "roof")
//   onConfirm:  callback(confirmedPrice) called when user confirms or enters

function renderPriceConfirmation(appRoot, price, cssPrefix, onConfirm, ocrText, currentVertical, confidence) {
  // Auto-detect confidence from last parser result if not passed
  var _conf = confidence || (typeof window !== "undefined" && window.__TP_LAST_CONFIDENCE) || "";
  // Skip confirmation and go straight to analysis when confidence is high
  if (price && price > 0 && _conf === "high") {
    onConfirm(price);
    return;
  }

  var prefix = cssPrefix || "tp";
  var heroClass = prefix + "-hero";
  var cardClass = prefix + "-card";
  var btnPrimary = prefix + "-btn " + prefix + "-btn-primary";
  var btnSecondary = prefix + "-btn " + prefix + "-btn-secondary";

  // Vertical detection: warn if quote doesn't match current page.
  // Auto-detects OCR text from window.__TP_LAST_OCR_TEXT and current vertical from URL.
  var _ocrText = ocrText || (typeof window !== "undefined" && window.__TP_LAST_OCR_TEXT) || "";
  var _curVert = currentVertical || "";
  if (!_curVert && typeof window !== "undefined") {
    var _pm = window.location.pathname.match(/\/([a-z-]+)-quote-analyzer/);
    if (_pm) _curVert = _pm[1];
    else if (window.location.pathname.indexOf("auto-repair") >= 0) _curVert = "auto";
    else if (window.location.pathname.indexOf("moving") >= 0) _curVert = "moving";
  }
  // Normalize singular/plural so "window" page matches "windows" detector
  var _vertAliases = { "window": "windows", "gutter": "gutters" };
  if (_vertAliases[_curVert]) _curVert = _vertAliases[_curVert];
  var verticalWarning = "";
  var _deflectTarget = null;
  var _hardReject = null; // set when mismatch is so obvious we refuse to proceed
  // Suppress deflection warning after user has explicitly dismissed it once this session.
  // Set by the "Continue here anyway" handler below — we then re-render in manual-entry
  // mode so the user types the price for the *current* vertical instead of inheriting
  // the OCR-extracted total from the wrong-vertical quote.
  var _suppressVertWarn = (typeof window !== "undefined") && window.__TP_SUPPRESS_VERTICAL_WARN;
  // HARD REJECT: skip the suppress-warn check. Even after a soft dismissal,
  // a clearly-wrong-vertical document should never produce a confident verdict.
  if (_ocrText && _curVert && typeof detectVerticalFromText === "function") {
    var detectedHR = detectVerticalFromText(_ocrText);
    var allScoresHR = (detectedHR && detectedHR.all) || [];
    var nonCurTopHR = null, curEntryHR = null;
    for (var _ihr = 0; _ihr < allScoresHR.length; _ihr++) {
      if (!nonCurTopHR && allScoresHR[_ihr].vertical !== _curVert) nonCurTopHR = allScoresHR[_ihr];
      if (!curEntryHR && allScoresHR[_ihr].vertical === _curVert) curEntryHR = allScoresHR[_ihr];
    }
    var curScoreHR = curEntryHR ? curEntryHR.score : 0;
    // HARD REJECT criteria (must hit ALL):
    //   - other vertical has >= 3 keyword hits (confident enough)
    //   - other vertical scores >= 3x current vertical
    //   - current vertical has < 2 hits (basically nothing matches the page's domain)
    // This catches obvious cases (roofing quote uploaded to plumbing scored 4
    // for roofing in real testing 2026-04-29) while sparing legit multi-trade
    // quotes (kitchen remodel with plumbing line items has 2+ plumbing hits).
    if (nonCurTopHR && nonCurTopHR.score >= 3 && curScoreHR < 2 && nonCurTopHR.score >= curScoreHR * 3) {
      _hardReject = nonCurTopHR;
    }
  }
  if (!_suppressVertWarn && !_hardReject && _ocrText && _curVert && typeof detectVerticalFromText === "function") {
    var detected = detectVerticalFromText(_ocrText);
    var allScores = (detected && detected.all) || [];
    var nonCurTop = null, curEntry = null;
    for (var _i = 0; _i < allScores.length; _i++) {
      if (!nonCurTop && allScores[_i].vertical !== _curVert) nonCurTop = allScores[_i];
      if (!curEntry && allScores[_i].vertical === _curVert) curEntry = allScores[_i];
    }
    var curScore = curEntry ? curEntry.score : 0;
    // Deflect when ANY of:
    //   (a) winner is a different vertical with >=3 hits  (original rule)
    //   (b) current vertical is weak (<3) but another vertical hits >=3
    //   (c) another vertical scores >=2x current's score (and >=3 absolute)
    if (nonCurTop && nonCurTop.score >= 3) {
      var winnerNotCurrent = (detected.vertical && detected.vertical !== _curVert);
      var currentWeak = (curScore < 3);
      var otherDominates = (nonCurTop.score >= curScore * 2);
      if (winnerNotCurrent || currentWeak || otherDominates) {
        _deflectTarget = nonCurTop;
      }
    }
    if (_deflectTarget) {
      verticalWarning = '\
        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px 18px;margin-bottom:16px;text-align:left;">\
          <p style="margin:0 0 8px;font-weight:600;color:#92400e;">This looks like a ' + _deflectTarget.label + ' quote</p>\
          <p style="margin:0 0 10px;font-size:14px;color:#78350f;">Want to analyze it with our ' + _deflectTarget.label + ' tool instead?</p>\
          <a href="' + _deflectTarget.url + '" style="display:inline-block;background:#f59e0b;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Go to ' + _deflectTarget.label + ' Analyzer</a>\
          <span style="margin-left:12px;font-size:13px;color:#92400e;cursor:pointer;text-decoration:underline;" id="tpIgnoreVertical">Continue here anyway</span>\
        </div>';
    }
  }

  // HARD REJECT screen: shown when the document is clearly the wrong vertical.
  // No price displayed, no "Continue here anyway" escape hatch, no manual entry.
  // Only paths forward: go to the correct analyzer, or upload a different file.
  // Trust requirement (Lane 2026-04-29): never produce a confident analysis from
  // a quote that is plainly for a different service.
  if (_hardReject) {
    // Title-case multi-word verticals (garage-door -> Garage Door) and use
    // proper article (a/an) for vowel-onset nouns. Per-vertical noun phrase
    // overrides "X quote" to match the actual product (medical = bill,
    // legal = attorney quote). Fixes copy findings #9, #13, #14 from human
    // audit 2026-04-29.
    var _hrTitleCase = function (s) {
      return String(s || "").replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    };
    var _hrNouns = {
      medical: "Medical bill",
      legal: "Attorney quote",
      auto: "Auto repair quote",
      auto_repair: "Auto repair quote",
      "garage-door": "Garage door quote",
      garage_door: "Garage door quote",
      hvac: "HVAC quote"
    };
    // Acronyms read as letters with vowel-sound onset need "an" even though
    // first letter is consonant: "an HVAC quote", "an FBI investigation".
    var _hrArticleFor = function (s) {
      if (/^(HVAC|FBI|FAQ|HOA|MRI|HD|XR)\b/.test(s)) return "an";
      return /^[aeiou]/i.test(s) ? "an" : "a";
    };
    // Lowercase but preserve all-caps acronym tokens.
    var _hrSmartLower = function (s) {
      return String(s || "").split(/\s+/).map(function (w) {
        return /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase();
      }).join(" ");
    };
    var _hrNoun = _hrNouns[_curVert] || (_hrTitleCase(_curVert) + " quote");
    var _hrNounLc = _hrSmartLower(_hrNoun);
    var _hrArticle = _hrArticleFor(_hrNoun);
    var _hrDetectedNoun = _hrNouns[_hardReject.vertical] || (_hrTitleCase(_hardReject.label) + " quote");
    var _hrDetectedArticle = _hrArticleFor(_hrDetectedNoun);
    appRoot.innerHTML = '\
      <div class="' + heroClass + '" style="padding:24px 16px;"><h1 style="font-size:22px;color:#991b1b;">This is not ' + _hrArticle + ' ' + _hrNoun + '</h1></div>\
      <div class="' + cardClass + '" style="text-align:center;max-width:540px;margin:0 auto;padding:32px 24px;border:2px solid #fecaca;background:#fef2f2;border-radius:14px;">\
        <img src="/images/Iris/Iris%20concerned.png" alt="Iris is concerned" width="120" height="120" style="margin-bottom:12px;" />\
        <p style="font-size:17px;font-weight:600;color:#991b1b;margin:0 0 10px;">The document you uploaded looks like ' + _hrDetectedArticle + ' <strong>' + _hrSmartLower(_hrDetectedNoun) + '</strong>.</p>\
        <p style="font-size:14px;color:#7f1d1d;margin:0 0 20px;line-height:1.5;">We could try to analyze it as ' + _hrArticle + ' ' + _hrNounLc + ' anyway, but the result would be unreliable. We would rather refuse than give you a confident answer based on the wrong inputs.</p>\
        <a href="' + _hardReject.url + '" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;margin:0 6px 10px;">Analyze as ' + _hardReject.label + ' instead</a>\
        <a href="javascript:void(0)" id="tpHardRejectStartOver" style="display:inline-block;background:#fff;color:#991b1b;padding:11px 22px;border:2px solid #fecaca;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;margin:0 6px 10px;">Upload a different file</a>\
        <p style="font-size:12px;color:#9ca3af;margin:14px 0 0;">Detection confidence: ' + _hardReject.score + ' ' + _hardReject.label + ' keywords vs ' + (curEntryHR ? curEntryHR.score : 0) + ' ' + _hrTitleCase(_curVert) + ' keywords</p>\
      </div>';
    var startOver = document.getElementById("tpHardRejectStartOver");
    if (startOver) startOver.addEventListener("click", function() { window.location.reload(); });
    return;
  }

  if (price && price > 0) {
    appRoot.innerHTML = '\
      <div class="' + heroClass + '" style="padding:24px 16px;"><h1 style="font-size:22px;">We found your quote total</h1></div>\
      <div class="' + cardClass + '" style="text-align:center;max-width:520px;margin:0 auto;padding:32px 24px;">\
        ' + verticalWarning + '\
        <img src="/images/Iris/Iris%20happy.png" alt="Iris the Woogoro shire keeper" width="120" height="120" style="margin-bottom:12px;" />\
        <div style="font-size:36px;font-weight:800;color:#166534;margin-bottom:8px;">$' + Math.round(price).toLocaleString() + '</div>\
        <p style="color:#475569;margin-bottom:20px;">Is this your quote total?</p>\
        <button class="' + btnPrimary + '" id="tpConfirmPriceBtn" style="font-size:16px;padding:14px 32px;margin-bottom:16px;">Yes, analyze this price</button>\
        <div style="padding-top:16px;border-top:1px solid #e2e8f0;">\
          <p style="color:#64748b;font-size:14px;margin-bottom:8px;">Not right? Enter the correct amount:</p>\
          <div style="display:flex;gap:10px;justify-content:center;align-items:center;margin-bottom:12px;">\
            <span style="font-size:20px;font-weight:700;">$</span>\
            <input type="number" id="tpEditPrice" placeholder="e.g. 4500" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:18px;width:180px;" />\
          </div>\
          <button class="' + btnSecondary + '" id="tpEditPriceBtn" style="font-size:14px;">Analyze corrected price</button>\
        </div>\
        <div style="margin-top:16px;"><a href="javascript:void(0)" id="tpStartOver" style="font-size:13px;color:#94a3b8;text-decoration:none;">Start over with a different file</a></div>\
      </div>';
    document.getElementById("tpConfirmPriceBtn").addEventListener("click", function() {
      onConfirm(price);
    });
    document.getElementById("tpEditPriceBtn").addEventListener("click", function() {
      var edited = parseFloat(document.getElementById("tpEditPrice").value);
      if (!edited || edited < 50) { alert("Please enter a valid price."); return; }
      onConfirm(edited);
    });
    document.getElementById("tpStartOver").addEventListener("click", function() {
      window.location.reload();
    });
    _wireIgnoreVerticalDeflection(appRoot, cssPrefix, onConfirm, _ocrText, _curVert, _conf, _deflectTarget);
  } else {
    appRoot.innerHTML = '\
      <div class="' + heroClass + '" style="padding:24px 16px;"><h1 style="font-size:22px;">Enter your quote total</h1></div>\
      <div class="' + cardClass + '" style="text-align:center;max-width:520px;margin:0 auto;padding:32px 24px;">\
        ' + verticalWarning + '\
        <img src="/images/Iris/Iris%20happy.png" alt="Iris the Woogoro shire keeper" width="120" height="120" style="margin-bottom:12px;" />\
        <p style="color:#475569;margin-bottom:16px;">We couldn\'t read a price from your image. Enter your quote total:</p>\
        <div style="display:flex;gap:10px;justify-content:center;align-items:center;margin-bottom:16px;">\
          <span style="font-size:22px;font-weight:700;">$</span>\
          <input type="number" id="tpManualPrice" placeholder="e.g. 4500" style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:20px;width:200px;" autofocus />\
        </div>\
        <button class="' + btnPrimary + '" id="tpManualPriceBtn" style="font-size:16px;padding:12px 28px;">Analyze this price</button>\
        <div style="margin-top:16px;"><a href="javascript:void(0)" id="tpStartOverManual" style="font-size:13px;color:#94a3b8;text-decoration:none;">Start over with a different file</a></div>\
      </div>';
    document.getElementById("tpManualPriceBtn").addEventListener("click", function() {
      var manual = parseFloat(document.getElementById("tpManualPrice").value);
      if (!manual || manual < 50) { alert("Please enter a valid price."); return; }
      onConfirm(manual);
    });
    document.getElementById("tpStartOverManual").addEventListener("click", function() {
      window.location.reload();
    });
    _wireIgnoreVerticalDeflection(appRoot, cssPrefix, onConfirm, _ocrText, _curVert, _conf, _deflectTarget);
  }
}

// "Continue here anyway" handler. The OCR-extracted price for a wrong-vertical
// quote is unreliable (e.g. $18,692 whole roof+gutter contract showing up as a
// "gutter total"). On dismiss, drop the auto-extracted price and force the user
// to type the portion that applies to the current vertical.
function _wireIgnoreVerticalDeflection(appRoot, cssPrefix, onConfirm, ocrText, curVert, confidence, deflectTarget) {
  if (!deflectTarget) return;
  var ignoreEl = document.getElementById("tpIgnoreVertical");
  if (!ignoreEl) return;
  ignoreEl.addEventListener("click", function() {
    if (typeof window !== "undefined") window.__TP_SUPPRESS_VERTICAL_WARN = true;
    // Re-render in manual-entry mode (price=0) so the user must type a number
    // before analysis runs.
    renderPriceConfirmation(appRoot, 0, cssPrefix, onConfirm, ocrText, curVert, confidence);
    var prefix = cssPrefix || "tp";
    var card = appRoot.querySelector("." + prefix + "-card");
    if (card) {
      var note = document.createElement("div");
      note.style.cssText = "background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:10px 14px;margin:0 auto 14px;max-width:460px;text-align:left;font-size:13px;color:#78350f;";
      note.innerHTML = "Heads up: this quote looked like a " + deflectTarget.label + " job. Enter just the portion that matches this analyzer below.";
      // Insert before the manual-entry input row
      card.insertBefore(note, card.firstChild);
    }
  });
}
