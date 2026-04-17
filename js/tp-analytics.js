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
})();
