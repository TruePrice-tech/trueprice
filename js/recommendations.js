(function () {
  var recList = document.getElementById("recList");
  var recLoading = document.getElementById("recLoading");
  var filterCity = document.getElementById("filterCity");
  var filterTrade = document.getElementById("filterTrade");
  var filterBtn = document.getElementById("filterBtn");
  var recForm = document.getElementById("recForm");
  var recFormStatus = document.getElementById("recFormStatus");
  var recSubmitBtn = document.getElementById("recSubmitBtn");

  var TRADE_LABELS = {
    "roofing": "Roofing", "hvac": "HVAC", "plumbing": "Plumbing",
    "electrical": "Electrical", "solar": "Solar", "windows": "Windows",
    "siding": "Siding", "insulation": "Insulation", "painting": "Painting",
    "fencing": "Fencing", "concrete": "Concrete", "landscaping": "Landscaping",
    "garage-doors": "Garage Doors", "foundation": "Foundation",
    "kitchen-remodel": "Kitchen Remodel", "gutters": "Gutters",
    "auto-repair": "Auto Repair", "moving": "Moving", "medical": "Medical",
    "legal": "Legal", "other": "Other"
  };

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(hours / 24);
    if (days < 30) return days + "d ago";
    var months = Math.floor(days / 30);
    if (months < 12) return months + "mo ago";
    return Math.floor(months / 12) + "y ago";
  }

  function renderRecs(recs) {
    recLoading.style.display = "none";
    if (!recs || recs.length === 0) {
      recList.innerHTML =
        '<div class="rec-empty">' +
        '<h3>No recommendations yet</h3>' +
        '<p>Be the first to recommend a contractor in your area.</p>' +
        "</div>";
      return;
    }
    var html = "";
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      var tradeLabel = TRADE_LABELS[r.trade] || r.trade;
      html +=
        '<div class="rec-card">' +
        '<div class="rec-card-header">' +
        '<span class="rec-card-name">' + escapeHtml(r.contractorName) + "</span>" +
        '<span class="rec-card-trade">' + escapeHtml(tradeLabel) + "</span>" +
        "</div>" +
        '<div class="rec-card-location">' + escapeHtml(r.city) + ", " + escapeHtml(r.state) + "</div>" +
        '<div class="rec-card-comment">' + escapeHtml(r.comment) + "</div>" +
        '<div class="rec-card-footer">' +
        "<span>Recommended by " + escapeHtml(r.submitterName || "Anonymous") + "</span>" +
        "<span>" + timeAgo(r.ts) + "</span>" +
        "</div>" +
        "</div>";
    }
    recList.innerHTML = html;
  }

  function loadRecs() {
    recLoading.style.display = "block";
    recList.innerHTML = "";
    var params = [];
    var city = filterCity.value.trim();
    var trade = filterTrade.value;
    if (city) params.push("city=" + encodeURIComponent(city));
    if (trade) params.push("trade=" + encodeURIComponent(trade));
    var url = "/api/recommendations" + (params.length ? "?" + params.join("&") : "");
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          renderRecs(d.recommendations);
        } else {
          recLoading.style.display = "none";
          recList.innerHTML = '<div class="rec-empty"><p>Something went wrong. Try again.</p></div>';
        }
      })
      .catch(function () {
        recLoading.style.display = "none";
        recList.innerHTML = '<div class="rec-empty"><p>Could not load recommendations.</p></div>';
      });
  }

  // Filter handlers
  filterBtn.addEventListener("click", loadRecs);
  filterCity.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); loadRecs(); }
  });
  filterTrade.addEventListener("change", loadRecs);

  // Submit form
  recForm.addEventListener("submit", function (e) {
    e.preventDefault();
    recFormStatus.textContent = "";
    recFormStatus.className = "rec-form-status";
    recSubmitBtn.disabled = true;
    recSubmitBtn.textContent = "Submitting...";

    var payload = {
      contractorName: document.getElementById("contractorName").value.trim(),
      trade: document.getElementById("recTrade").value,
      city: document.getElementById("recCity").value.trim(),
      state: document.getElementById("recState").value.trim().toUpperCase(),
      comment: document.getElementById("recComment").value.trim(),
      submitterName: document.getElementById("recName").value.trim()
    };

    fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          recFormStatus.textContent = "Thanks for the recommendation!";
          recFormStatus.className = "rec-form-status success";
          recForm.reset();
          loadRecs();
        } else {
          recFormStatus.textContent = d.error || "Something went wrong.";
          recFormStatus.className = "rec-form-status error";
        }
      })
      .catch(function () {
        recFormStatus.textContent = "Network error. Try again.";
        recFormStatus.className = "rec-form-status error";
      })
      .finally(function () {
        recSubmitBtn.disabled = false;
        recSubmitBtn.textContent = "Submit recommendation";
      });
  });

  // Initial load
  loadRecs();
})();
