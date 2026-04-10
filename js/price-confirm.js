// Option C: Price confirmation component.
// Shows extracted price for user to confirm or edit.
// If no price found, shows manual entry.
//
// Usage: renderPriceConfirmation(appRoot, price, cssPrefix, onConfirm)
//   appRoot:    DOM element to render into
//   price:      extracted price (0 or null = no price found)
//   cssPrefix:  vertical CSS class prefix (e.g. "plumb", "hvac", "roof")
//   onConfirm:  callback(confirmedPrice) called when user confirms or enters

function renderPriceConfirmation(appRoot, price, cssPrefix, onConfirm) {
  var prefix = cssPrefix || "tp";
  var heroClass = prefix + "-hero";
  var cardClass = prefix + "-card";
  var btnPrimary = prefix + "-btn " + prefix + "-btn-primary";
  var btnSecondary = prefix + "-btn " + prefix + "-btn-secondary";

  if (price && price > 0) {
    appRoot.innerHTML = '\
      <div class="' + heroClass + '" style="padding:24px 16px;"><h1 style="font-size:22px;">We found your quote total</h1></div>\
      <div class="' + cardClass + '" style="text-align:center;max-width:520px;margin:0 auto;padding:32px 24px;">\
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
