// Pricing event banner — fetches active disruption events from
// /api/pricing-events-active and renders a top-of-page strip on any
// vertical page when a relevant event is firing. Self-installs from
// tp-analytics.js so every page that has analytics gets the banner.
//
// Vertical is derived from the URL path. Pages with no detectable
// vertical (homepage, generic pages) request the global feed
// (vertical=any) so site-wide events still surface.
//
// Dismissal: per-event sessionStorage flag, so closing one event
// does not hide others, and it reappears in the next session.

(function () {
  if (window.__woogoroBannerLoaded) return;
  window.__woogoroBannerLoaded = true;

  var path = (window.location.pathname || "").toLowerCase();
  var vertical = detectVerticalFromPath(path);

  // Skip on admin/utility pages
  if (path.indexOf("/contractor-dashboard") === 0) return;
  if (path.indexOf("/analytics-dashboard") === 0) return;
  if (path.indexOf("/beta") === 0 && vertical === null) return;

  var qs = "?minSeverity=2&limit=2";
  if (vertical) qs += "&vertical=" + encodeURIComponent(vertical);

  fetch("/api/pricing-events-active" + qs, { credentials: "omit" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.ok || !data.events || !data.events.length) return;
      for (var i = 0; i < data.events.length; i++) {
        var evt = data.events[i];
        if (sessionStorage.getItem("tp_evt_dismissed_" + evt.id)) continue;
        renderBanner(evt);
        break;  // one banner at a time, highest severity already first
      }
    })
    .catch(function () { /* fail silent — never break the page */ });

  function detectVerticalFromPath(p) {
    var map = {
      hvac: /\bhvac\b/,
      plumbing: /\bplumbing\b|\bplumb\b/,
      roofing: /\broof(ing)?\b/,
      electrical: /\belectrical\b/,
      solar: /\bsolar\b/,
      windows: /\bwindow(s)?\b/,
      siding: /\bsiding\b/,
      painting: /\bpainting\b/,
      "garage-doors": /\bgarage[- ]?door/,
      fencing: /\bfenc(e|ing)\b/,
      concrete: /\bconcrete\b/,
      landscaping: /\blandscap/,
      foundation: /\bfoundation\b/,
      insulation: /\binsulation\b/,
      gutters: /\bgutter/,
      kitchen: /\bkitchen\b/,
      moving: /\bmoving\b/,
      "auto-repair": /\bauto[- ]?repair\b|\bvehicle\b/,
      medical: /\bmedical\b/,
      legal: /\blegal\b/,
    };
    for (var k in map) if (map[k].test(p)) return k;
    return null;
  }

  function renderBanner(evt) {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", function () { renderBanner(evt); });
      return;
    }
    var sev = Number(evt.severity) || 1;
    var bg  = sev >= 3 ? "#7f1d1d" : (sev === 2 ? "#9a3412" : "#1e3a8a");
    var label = sev >= 3 ? "Major disruption" : (sev === 2 ? "Heads up" : "Notice");

    var el = document.createElement("div");
    el.setAttribute("data-tp-banner", evt.id);
    el.style.cssText = "position:relative;z-index:9999;background:" + bg +
      ";color:#fff;font:14px/1.4 system-ui,sans-serif;padding:10px 44px 10px 16px;text-align:center;";

    var pill = "<span style=\"display:inline-block;background:rgba(255,255,255,0.18);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-right:8px;\">" + escape(label) + "</span>";
    var summary = escape(evt.summary || evt.title || "");
    var src = evt.source ? "<span style=\"opacity:0.75;font-size:12px;margin-left:8px;\">via " + escape(evt.source) + "</span>" : "";
    var more = evt.url ? "<a href=\"" + escape(evt.url) + "\" target=\"_blank\" rel=\"noopener\" style=\"color:#fff;text-decoration:underline;margin-left:8px;\">read</a>" : "";

    el.innerHTML = pill + summary + more + src +
      "<button type=\"button\" aria-label=\"Dismiss\" style=\"position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer;line-height:1;\">×</button>";

    var btn = el.querySelector("button");
    btn.addEventListener("click", function () {
      sessionStorage.setItem("tp_evt_dismissed_" + evt.id, "1");
      el.parentNode && el.parentNode.removeChild(el);
    });

    document.body.insertBefore(el, document.body.firstChild);
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
    });
  }
})();
