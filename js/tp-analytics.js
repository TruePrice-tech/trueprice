// TruePrice lightweight analytics tracker
// Sends page views and custom events to /api/analytics
(function() {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;

  function send(data) {
    try {
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
    title: document.title || ""
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
})();
