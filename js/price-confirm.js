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
  if (_ocrText && _curVert && typeof detectVerticalFromText === "function") {
    var detected = detectVerticalFromText(_ocrText);
    if (detected.vertical && detected.vertical !== _curVert && detected.score >= 3) {
      verticalWarning = '\
        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px 18px;margin-bottom:16px;text-align:left;">\
          <p style="margin:0 0 8px;font-weight:600;color:#92400e;">This looks like a ' + detected.label + ' quote</p>\
          <p style="margin:0 0 10px;font-size:14px;color:#78350f;">Want to analyze it with our ' + detected.label + ' tool instead?</p>\
          <a href="' + detected.url + '" style="display:inline-block;background:#f59e0b;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Go to ' + detected.label + ' Analyzer</a>\
          <span style="margin-left:12px;font-size:13px;color:#92400e;cursor:pointer;" id="tpIgnoreVertical">Continue here anyway</span>\
        </div>';
    }
  }

  if (price && price > 0) {
    appRoot.innerHTML = '\
      <div class="' + heroClass + '" style="padding:24px 16px;"><h1 style="font-size:22px;">We found your quote total</h1></div>\
      <div class="' + cardClass + '" style="text-align:center;max-width:520px;margin:0 auto;padding:32px 24px;">\
        ' + verticalWarning + '\
        <img src="/images/trudy.png" alt="Trudy" width="80" style="margin-bottom:12px;" />\
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
      </div>';
    document.getElementById("tpConfirmPriceBtn").addEventListener("click", function() {
      onConfirm(price);
    });
    document.getElementById("tpEditPriceBtn").addEventListener("click", function() {
      var edited = parseFloat(document.getElementById("tpEditPrice").value);
      if (!edited || edited < 50) { alert("Please enter a valid price."); return; }
      onConfirm(edited);
    });
  } else {
    appRoot.innerHTML = '\
      <div class="' + heroClass + '" style="padding:24px 16px;"><h1 style="font-size:22px;">Enter your quote total</h1></div>\
      <div class="' + cardClass + '" style="text-align:center;max-width:520px;margin:0 auto;padding:32px 24px;">\
        ' + verticalWarning + '\
        <img src="/images/trudy.png" alt="Trudy" width="80" style="margin-bottom:12px;" />\
        <p style="color:#475569;margin-bottom:16px;">We couldn\'t read a price from your image. Enter your quote total:</p>\
        <div style="display:flex;gap:10px;justify-content:center;align-items:center;margin-bottom:16px;">\
          <span style="font-size:22px;font-weight:700;">$</span>\
          <input type="number" id="tpManualPrice" placeholder="e.g. 4500" style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:20px;width:200px;" autofocus />\
        </div>\
        <button class="' + btnPrimary + '" id="tpManualPriceBtn" style="font-size:16px;padding:12px 28px;">Analyze this price</button>\
      </div>';
    document.getElementById("tpManualPriceBtn").addEventListener("click", function() {
      var manual = parseFloat(document.getElementById("tpManualPrice").value);
      if (!manual || manual < 50) { alert("Please enter a valid price."); return; }
      onConfirm(manual);
    });
  }
}
