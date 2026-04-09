(function(){
  if (window.tpCaptureCommunity) return;
  window.tpCaptureCommunity = function(payload) {
    if (!payload || !payload.service || !payload.price) return;
    try { if (localStorage.getItem("tp_benchmark_optout") === "1") return; } catch(e){}
    var key = "tp_contributed_" + payload.service + "_" + Math.round(payload.price);
    try {
      if (localStorage.getItem(key) !== "true") {
        fetch("/api/community-quote", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            price: payload.price,
            material: payload.material || "",
            city: payload.city || "",
            stateCode: payload.stateCode || "",
            roofSize: payload.roofSize || 0,
            serviceType: payload.service,
            scopeConfirmed: payload.scopeConfirmed || 0,
            scopeTotal: payload.scopeTotal || 0,
            verdict: payload.verdict || "",
            source: "auto"
          })
        }).then(function(r){ if (r && r.ok) try { localStorage.setItem(key, "true"); } catch(e){} }).catch(function(){});
      }
    } catch(e){}
    try {
      if (document.querySelector(".tp-benchmark-footnote")) return;
      var anchor = payload.anchorEl ||
                   document.querySelector("[data-verdict]") ||
                   document.querySelector(".verdict-card") ||
                   document.querySelector(".pe-verdict") ||
                   document.querySelector(".cmp-verdict") ||
                   document.querySelector("h1") ||
                   document.body;
      if (!anchor) return;
      var note = document.createElement("div");
      note.className = "tp-benchmark-footnote";
      note.style.cssText = "padding:8px 14px; margin:8px auto 16px; font-size:12px; color:#94a3b8; text-align:center; max-width:720px;";
      var cityLabel = payload.city ? String(payload.city).replace(/[<>&]/g, "") : "your area";
      note.innerHTML = "&#10003; Added to our anonymized local benchmark for " + cityLabel + ". No personal info shared. " +
                       "<a href=\"#\" onclick=\"event.preventDefault();if(confirm('Exclude future analyses from anonymized benchmarks?')){localStorage.setItem('tp_benchmark_optout','1');this.parentNode.innerHTML='&#10003; You have opted out.';}\" style=\"color:#94a3b8; text-decoration:underline; margin-left:6px;\">opt out</a>";
      anchor.parentNode ? anchor.parentNode.insertBefore(note, anchor.nextSibling) : anchor.appendChild(note);
    } catch(e){}
  };
})();
