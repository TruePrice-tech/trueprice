(function () {
  "use strict";

  var STORAGE_SHOWN = "tp_exit_shown";
  var STORAGE_SUBSCRIBED = "tp_subscribed";
  var MOBILE_DELAY = 30000;

  function shouldSuppress() {
    var path = window.location.pathname + window.location.search;
    if (path.indexOf("analyzer") !== -1 || path.indexOf("analyze-quote") !== -1) return true;
    if (localStorage.getItem(STORAGE_SHOWN)) return true;
    if (localStorage.getItem(STORAGE_SUBSCRIBED)) return true;
    return false;
  }

  function isMobile() {
    return window.innerWidth <= 768 || "ontouchstart" in window;
  }

  function createModal() {
    var overlay = document.createElement("div");
    overlay.id = "tp-exit-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);" +
      "display:flex;align-items:center;justify-content:center;" +
      "opacity:0;transition:opacity 200ms ease;padding:16px;";

    overlay.innerHTML =
      '<div style="' +
        "position:relative;background:#fff;max-width:420px;width:100%;" +
        "border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.18);" +
        "font-family:inherit;text-align:center;" +
      '">' +
        '<button id="tp-exit-close" style="' +
          "position:absolute;top:12px;right:14px;background:none;border:none;" +
          "font-size:22px;cursor:pointer;color:#64748b;line-height:1;" +
        '">&times;</button>' +
        '<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Before you go...</h2>' +
        '<p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.5;">' +
          "Get free pricing guides for 700+ cities. No spam, unsubscribe anytime." +
        "</p>" +
        '<form id="tp-exit-form" style="display:flex;flex-direction:column;gap:10px;">' +
          '<input id="tp-exit-email" type="email" required placeholder="you@email.com" style="' +
            "width:100%;padding:12px 14px;font-size:15px;border:1.5px solid #e2e8f0;" +
            "border-radius:10px;outline:none;box-sizing:border-box;color:#0f172a;" +
          '"/>' +
          '<button type="submit" style="' +
            "width:100%;padding:12px;font-size:15px;font-weight:600;color:#fff;" +
            "background:#1d4ed8;border:none;border-radius:10px;cursor:pointer;" +
          '">Get Free Guides</button>' +
        "</form>" +
        '<div id="tp-exit-success" style="display:none;padding:8px 0 0;">' +
          '<p style="margin:0;font-size:16px;font-weight:600;color:#1d4ed8;">Thanks! We\'ll keep you posted.</p>' +
        "</div>" +
        '<a id="tp-exit-dismiss" href="#" style="' +
          "display:inline-block;margin-top:14px;font-size:13px;color:#64748b;" +
          "text-decoration:none;cursor:pointer;" +
        '">No thanks</a>' +
      "</div>";

    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(function () {
      overlay.style.opacity = "1";
    });

    // Close handlers
    function close() {
      overlay.style.opacity = "0";
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 220);
    }

    document.getElementById("tp-exit-close").addEventListener("click", close);
    document.getElementById("tp-exit-dismiss").addEventListener("click", function (e) {
      e.preventDefault();
      close();
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    // Form submit
    document.getElementById("tp-exit-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("tp-exit-email").value.trim();
      if (!email) return;

      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email_signup", email: email, source: "exit_intent" }),
      }).catch(function () {});

      localStorage.setItem(STORAGE_SUBSCRIBED, "1");
      document.getElementById("tp-exit-form").style.display = "none";
      document.getElementById("tp-exit-dismiss").style.display = "none";
      document.getElementById("tp-exit-success").style.display = "block";

      setTimeout(close, 2500);
    });

    localStorage.setItem(STORAGE_SHOWN, "1");
  }

  function init() {
    if (shouldSuppress()) return;

    if (isMobile()) {
      // Mobile: show after 30s if no CTA interaction
      var ctaClicked = false;
      document.addEventListener(
        "click",
        function (e) {
          var el = e.target.closest("a, button, [data-cta]");
          if (el) ctaClicked = true;
        },
        true
      );
      setTimeout(function () {
        if (!ctaClicked && !shouldSuppress()) createModal();
      }, MOBILE_DELAY);
    } else {
      // Desktop: mouse leaves viewport from the top
      var fired = false;
      document.addEventListener("mouseout", function (e) {
        if (fired) return;
        if (e.clientY <= 0 && e.relatedTarget == null) {
          fired = true;
          createModal();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
