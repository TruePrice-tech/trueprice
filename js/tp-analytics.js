// TruePrice lightweight analytics tracker
// Sends page view to /api/analytics on each page load
(function() {
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;
  try {
    var data = {
      path: window.location.pathname,
      referrer: document.referrer || "",
      title: document.title || ""
    };
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/analytics", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));
  } catch(e) {}
})();
