// Woogoro lightweight analytics tracker
// Sends page views, custom events, and session duration to /api/analytics
(function() {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;

  var sessionStart = Date.now();
  var sessionId = sessionStorage.getItem("tp_sid");
  if (!sessionId) {
    sessionId = "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem("tp_sid", sessionId);
  }

  // Track page count this session
  var pageCount = parseInt(sessionStorage.getItem("tp_pages") || "0") + 1;
  sessionStorage.setItem("tp_pages", String(pageCount));

  function send(data) {
    try {
      data.sid = sessionId;
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/analytics", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(data));
    } catch(e) {}
  }

  // Page view
  send({
    type: "pageview",
    path: window.location.pathname,
    referrer: document.referrer || "",
    title: document.title || "",
    pageNum: pageCount
  });

  // Expose global event tracker
  window.tpTrack = function(event, meta) {
    send({
      type: "event",
      event: String(event).substring(0, 50),
      meta: meta || {},
      path: window.location.pathname
    });
  };

  // Session duration: send on page unload
  function sendDuration() {
    var duration = Math.round((Date.now() - sessionStart) / 1000);
    if (duration < 1 || duration > 3600) return; // ignore < 1s or > 1hr
    try {
      var data = JSON.stringify({
        type: "event",
        event: "page_duration",
        meta: { seconds: duration, pages: pageCount },
        path: window.location.pathname,
        sid: sessionId
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics", data);
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/analytics", false); // sync on unload
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(data);
      }
    } catch(e) {}
  }

  window.addEventListener("pagehide", sendDuration);
  window.addEventListener("beforeunload", sendDuration);

  // Pricing-event banner: lazy-load on every page so site-wide and per-vertical
  // disruption events surface without per-page wiring.
  try {
    var bannerScript = document.createElement("script");
    bannerScript.src = "/js/pricing-event-banner.min.js";
    bannerScript.async = true;
    (document.head || document.documentElement).appendChild(bannerScript);
  } catch(e) {}

  // Real-user error capture. Forwards JS exceptions and unhandled promise
  // rejections to /api/analytics so site breaks surface immediately rather
  // than waiting for a deep-dive. Heavy client-side filtering keeps noise
  // out: cross-origin opaque errors, browser-extension scripts, and per-
  // session repeat errors are all dropped before the network call.
  var errorSeenThisSession = {};
  var errorBudget = 8;  // max errors per page load
  function isOurOrigin(src) {
    if (!src) return false;
    if (src.indexOf("chrome-extension://") === 0) return false;
    if (src.indexOf("moz-extension://") === 0) return false;
    if (src.indexOf("safari-extension://") === 0) return false;
    if (src.indexOf("about:") === 0) return false;
    try {
      var u = new URL(src, window.location.href);
      if (u.host && u.host !== window.location.host) return false;
    } catch (e) { return false; }
    return true;
  }
  function reportError(payload) {
    if (errorBudget <= 0) return;
    // Dedupe within session by message + first stack line
    var key = (payload.message || "") + "|" + (payload.source || "") + ":" + (payload.lineno || "");
    if (errorSeenThisSession[key]) return;
    errorSeenThisSession[key] = true;
    errorBudget--;
    send({
      type: "js_error",
      path: window.location.pathname,
      title: (document.title || "").substring(0, 120),
      message: String(payload.message || "").substring(0, 240),
      source: String(payload.source || "").substring(0, 200),
      lineno: payload.lineno || 0,
      colno: payload.colno || 0,
      stack: String(payload.stack || "").substring(0, 1000),
      ua: navigator.userAgent.substring(0, 200),
      pageNum: pageCount
    });
  }
  window.addEventListener("error", function (ev) {
    // ev.message is "Script error." for cross-origin scripts — useless, drop it
    if (!ev || !ev.message || ev.message === "Script error.") return;
    if (ev.filename && !isOurOrigin(ev.filename)) return;
    reportError({
      message: ev.message,
      source: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      stack: ev.error && ev.error.stack ? ev.error.stack : ""
    });
  });
  window.addEventListener("unhandledrejection", function (ev) {
    var r = ev && ev.reason;
    var msg = r && r.message ? r.message : String(r);
    var stack = r && r.stack ? r.stack : "";
    reportError({ message: "[promise] " + msg, source: window.location.pathname, stack: stack });
  });
})();
