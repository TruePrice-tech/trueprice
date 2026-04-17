/*
 * Woogoro Feedback Modal
 * ------------------------------------------------------------
 * Drop-in script that hijacks all `mailto:hello@woogoro.com`
 * links and replaces them with an inline modal. Posts user feedback
 * to /api/analytics (type=feedback) which stores it in Redis and
 * forwards to hello@woogoro.com via Resend.
 *
 * Usage on any page:
 *   <script src="/js/feedback-modal.js" defer></script>
 *
 * Auto-attaches on DOMContentLoaded. Idempotent (safe to load twice).
 */
(function(){
  if (window.__tpFeedbackModalLoaded) return;
  window.__tpFeedbackModalLoaded = true;

  var TARGET_HREF_PATTERN = /^mailto:hello@woogoro\.com/i;
  var MAX_COMMENT = 500;

  function buildModal(){
    if (document.getElementById("tpFeedbackModal")) return;
    var html = ''
      + '<div id="tpFeedbackModal" class="tp-fb-overlay" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
      + '  <div class="tp-fb-card" style="background:#fff;max-width:480px;width:100%;border-radius:16px;padding:24px;box-shadow:0 25px 60px rgba(15,23,42,0.35);">'
      + '    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
      + '      <h3 style="margin:0;font-size:18px;color:#1e293b;font-weight:800;">Send Woogoro feedback</h3>'
      + '      <button type="button" id="tpFbClose" aria-label="Close" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1;padding:4px 8px;">&times;</button>'
      + '    </div>'
      + '    <p style="margin:0 0 14px;font-size:13px;color:#64748b;">Bug, suggestion, or anything we can fix? Goes straight to the team.</p>'
      + '    <textarea id="tpFbText" maxlength="' + MAX_COMMENT + '" rows="5" placeholder="What would you like to tell us?" style="width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>'
      + '    <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:4px;">'
      + '      <span><span id="tpFbCount">0</span> / ' + MAX_COMMENT + ' characters</span>'
      + '    </div>'
      + '    <input id="tpFbEmail" type="email" placeholder="Your email (optional, only if you want a reply)" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;font-family:inherit;box-sizing:border-box;margin-top:10px;" />'
      + '    <div id="tpFbStatus" style="font-size:12px;color:#64748b;margin-top:10px;min-height:16px;"></div>'
      + '    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">'
      + '      <button type="button" id="tpFbCancel" style="padding:10px 18px;border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>'
      + '      <button type="button" id="tpFbSend" style="padding:10px 22px;border:none;background:#1d4ed8;color:#fff;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Send feedback</button>'
      + '    </div>'
      + '  </div>'
      + '</div>';
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);

    var modal = document.getElementById("tpFeedbackModal");
    var text = document.getElementById("tpFbText");
    var count = document.getElementById("tpFbCount");
    var status = document.getElementById("tpFbStatus");
    var sendBtn = document.getElementById("tpFbSend");

    function close(){ modal.style.display = "none"; status.textContent = ""; status.style.color = "#64748b"; }
    document.getElementById("tpFbClose").addEventListener("click", close);
    document.getElementById("tpFbCancel").addEventListener("click", close);
    modal.addEventListener("click", function(ev){ if(ev.target === modal) close(); });
    document.addEventListener("keydown", function(ev){ if(ev.key === "Escape" && modal.style.display === "flex") close(); });

    text.addEventListener("input", function(){
      count.textContent = text.value.length;
    });

    sendBtn.addEventListener("click", function(){
      var comment = (text.value || "").trim();
      if (!comment) {
        status.style.color = "#dc2626";
        status.textContent = "Please write something before sending.";
        return;
      }
      var email = (document.getElementById("tpFbEmail").value || "").trim();
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending...";
      status.style.color = "#64748b";
      status.textContent = "";

      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feedback",
          data: {
            rating: "comment",
            comment: comment,
            email: email,
            path: window.location.pathname
          }
        })
      })
      .then(function(r){ return r.ok ? r.json() : Promise.reject(r); })
      .then(function(){
        status.style.color = "#16a34a";
        status.textContent = "Thanks! Feedback sent.";
        text.value = "";
        document.getElementById("tpFbEmail").value = "";
        count.textContent = "0";
        setTimeout(close, 1400);
      })
      .catch(function(){
        status.style.color = "#dc2626";
        status.textContent = "Could not send. Please try again or email hello@woogoro.com directly.";
      })
      .finally(function(){
        sendBtn.disabled = false;
        sendBtn.textContent = "Send feedback";
      });
    });
  }

  function openModal(){
    buildModal();
    var modal = document.getElementById("tpFeedbackModal");
    modal.style.display = "flex";
    setTimeout(function(){
      var t = document.getElementById("tpFbText");
      if (t) t.focus();
    }, 50);
  }
  // Expose globally so tpFb-style widgets can call it directly
  window.tpOpenFeedback = openModal;

  // Hijack all mailto:hello@woogoro.com links via event delegation
  document.addEventListener("click", function(ev){
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (TARGET_HREF_PATTERN.test(href)) {
      ev.preventDefault();
      openModal();
    }
  });
})();
