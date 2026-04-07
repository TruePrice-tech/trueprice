/*
 * TruePrice — Shared Trudy result footer
 * --------------------------------------
 * Standardized footer that every vertical's result page renders at the
 * end of the analysis. Provides:
 *
 *   1. Trudy header bookend ("That's everything Trudy found")
 *   2. 4 primary action buttons in a clean grid:
 *      - Save PDF (window.print())
 *      - Share (navigator.share or copy deep link)
 *      - Start Over (calls vertical-provided reset function)
 *      - Send Feedback (opens the feedback modal)
 *   3. "Try another estimate" pill row across other verticals
 *      (current vertical removed so we don't suggest the same tool)
 *   4. Inline "Was this helpful?" widget
 *
 * Usage:
 *   <script src="/js/trudy-footer.js" defer></script>
 *
 *   var html = window.tpRenderResultFooter({
 *     vertical: "moving",                       // current vertical key
 *     trudyImage: "/images/trudy-moving.png",   // mascot image
 *     accentColor: "#d97706",                   // vertical brand color
 *     onStartOver: "function name to call",     // string of fn name on window
 *     shareUrl: "https://truepricehq.com/...",  // optional share URL
 *     shareTitle: "My TruePrice analysis"
 *   });
 *
 * Returns an HTML string ready to inject into innerHTML. Hooks up button
 * handlers via event delegation after insertion.
 */
(function () {
  if (window.tpRenderResultFooter) return;

  // Vertical metadata for the cross-link pill row.
  // Color hints match each vertical's brand accent so users can scan visually.
  var VERTICALS = [
    { key: "moving",     label: "Moving",         href: "/moving-quote-analyzer.html",   color: "#d97706" },
    { key: "auto",       label: "Auto Repair",    href: "/auto-repair.html",             color: "#1d4ed8" },
    { key: "roofing",    label: "Roofing",        href: "/roofing-quote-analyzer.html",  color: "#1d4ed8" },
    { key: "hvac",       label: "HVAC",           href: "/hvac-quote-analyzer.html",     color: "#1d4ed8" },
    { key: "plumbing",   label: "Plumbing",       href: "/plumbing-quote-analyzer.html", color: "#1d4ed8" },
    { key: "electrical", label: "Electrical",     href: "/electrical-quote-analyzer.html", color: "#1d4ed8" },
    { key: "solar",      label: "Solar",          href: "/solar-quote-analyzer.html",    color: "#1d4ed8" },
    { key: "siding",     label: "Siding",         href: "/siding-quote-analyzer.html",   color: "#1d4ed8" },
    { key: "fencing",    label: "Fencing",        href: "/fencing-quote-analyzer.html",  color: "#1d4ed8" },
    { key: "concrete",   label: "Concrete",       href: "/concrete-quote-analyzer.html", color: "#1d4ed8" },
    { key: "foundation", label: "Foundation",     href: "/foundation-quote-analyzer.html", color: "#1d4ed8" },
    { key: "kitchen",    label: "Kitchen",        href: "/kitchen-quote-analyzer.html",  color: "#1d4ed8" },
    { key: "painting",   label: "Painting",       href: "/painting-quote-analyzer.html", color: "#1d4ed8" },
    { key: "landscaping",label: "Landscaping",    href: "/landscaping-quote-analyzer.html", color: "#1d4ed8" },
    { key: "garage-door",label: "Garage Doors",   href: "/garage-door-quote-analyzer.html", color: "#1d4ed8" },
    { key: "insulation", label: "Insulation",     href: "/insulation-quote-analyzer.html", color: "#1d4ed8" },
    { key: "gutters",    label: "Gutters",        href: "/gutters-quote-analyzer.html",  color: "#1d4ed8" },
    { key: "windows",    label: "Windows",        href: "/window-quote-analyzer.html",   color: "#1d4ed8" },
    { key: "medical",    label: "Medical Bills",  href: "/medical-bill-analyzer.html",   color: "#0d9488" },
    { key: "legal",      label: "Legal Fees",     href: "/legal-fee-analyzer.html",      color: "#7c3aed" }
  ];

  // CSS injected once per page
  function ensureStyles() {
    if (document.getElementById("tp-trudy-footer-styles")) return;
    var s = document.createElement("style");
    s.id = "tp-trudy-footer-styles";
    s.textContent = ''
      + '.tp-trudy-footer { margin-top:32px; }'
      + '.tp-trudy-footer-header { display:flex; align-items:center; gap:14px; padding:18px 22px; background:linear-gradient(135deg,#1e293b,#334155); border-radius:14px 14px 0 0; color:#fff; }'
      + '.tp-trudy-footer-header img { width:48px; height:48px; flex-shrink:0; background:#fff; border-radius:50%; padding:4px; }'
      + '.tp-trudy-footer-header .copy { min-width:0; }'
      + '.tp-trudy-footer-header .eyebrow { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; opacity:0.75; font-weight:700; }'
      + '.tp-trudy-footer-header .title { font-size:16px; font-weight:800; margin-top:2px; }'
      + '.tp-trudy-footer-card { background:#fff; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 14px 14px; padding:22px; margin-bottom:14px; }'
      + '.tp-actions-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; margin-bottom:18px; }'
      + '@media(max-width:600px){ .tp-actions-grid { grid-template-columns:1fr 1fr; } }'
      + '.tp-action-btn { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600; color:#1e293b; transition:all 0.15s; text-decoration:none; }'
      + '.tp-action-btn:hover { background:#eff6ff; border-color:#93c5fd; }'
      + '.tp-action-btn .icon { font-size:22px; }'
      + '.tp-action-btn .label { line-height:1.2; text-align:center; }'
      + '.tp-other-verticals { padding-top:18px; border-top:1px solid #f1f5f9; }'
      + '.tp-other-verticals h4 { margin:0 0 10px; font-size:13px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.04em; }'
      + '.tp-vertical-pills { display:flex; flex-wrap:wrap; gap:6px; }'
      + '.tp-vertical-pill { display:inline-block; padding:6px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:999px; font-size:12px; color:#475569; text-decoration:none; transition:all 0.15s; }'
      + '.tp-vertical-pill:hover { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }'
      + '.tp-feedback-row { display:flex; align-items:center; gap:14px; padding:14px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; flex-wrap:wrap; margin-top:14px; }'
      + '.tp-feedback-row .label { font-size:13px; color:#475569; font-weight:600; }'
      + '.tp-feedback-row .btns { display:flex; gap:8px; flex-wrap:wrap; }'
      + '.tp-feedback-row button { padding:7px 14px; border:1px solid #e2e8f0; background:#fff; color:#475569; border-radius:8px; font-size:12px; cursor:pointer; font-family:inherit; }'
      + '.tp-feedback-row button:hover { border-color:#93c5fd; color:#1d4ed8; }'
      + '.tp-feedback-row .more { margin-left:auto; font-size:12px; color:#64748b; cursor:pointer; text-decoration:underline; background:none; border:none; padding:0; }'
      + '@media(max-width:600px){ .tp-feedback-row { padding:12px 14px; } .tp-feedback-row .more { margin-left:0; width:100%; text-align:left; margin-top:4px; } }'
      + '@media print { .tp-trudy-footer { display:none !important; } }';
    document.head.appendChild(s);
  }

  function escAttr(s) {
    return String(s || "").replace(/"/g, "&quot;");
  }

  window.tpRenderResultFooter = function (opts) {
    opts = opts || {};
    ensureStyles();
    var vertical = opts.vertical || "";
    var trudyImg = opts.trudyImage || "/images/trudy-investigator.png";
    var onStartOverFn = opts.onStartOver || ""; // string fn name on window
    var shareUrl = opts.shareUrl || (typeof location !== "undefined" ? location.href : "");
    var shareTitle = opts.shareTitle || "My TruePrice analysis";
    var headline = opts.headline || "That's everything Trudy found.";
    var subline = opts.subline || "Want to do more?";

    // Cross-link verticals: every vertical EXCEPT the current one,
    // sorted to put complementary verticals first
    var others = VERTICALS.filter(function (v) { return v.key !== vertical; });

    var html = ''
      + '<div class="tp-trudy-footer no-print">'
      // Header bookend
      + '<div class="tp-trudy-footer-header">'
      + '<img src="' + escAttr(trudyImg) + '" alt="Trudy" />'
      + '<div class="copy">'
      + '<div class="eyebrow">TruePrice Report Complete</div>'
      + '<div class="title">' + escAttr(headline) + ' ' + escAttr(subline) + '</div>'
      + '</div>'
      + '</div>'
      // Action card
      + '<div class="tp-trudy-footer-card">'
      + '<div class="tp-actions-grid">'
      + '<button type="button" class="tp-action-btn" id="tpFooterPrint" data-action="print">'
      + '<span class="icon">&#128424;</span><span class="label">Save PDF</span>'
      + '</button>'
      + '<button type="button" class="tp-action-btn" id="tpFooterShare" data-action="share" data-url="' + escAttr(shareUrl) + '" data-title="' + escAttr(shareTitle) + '">'
      + '<span class="icon">&#128279;</span><span class="label">Share</span>'
      + '</button>'
      + '<button type="button" class="tp-action-btn" id="tpFooterStartOver" data-action="startover" data-fn="' + escAttr(onStartOverFn) + '">'
      + '<span class="icon">&#128260;</span><span class="label">Start Over</span>'
      + '</button>'
      + '<button type="button" class="tp-action-btn" id="tpFooterFeedback" data-action="feedback">'
      + '<span class="icon">&#9993;&#65039;</span><span class="label">Send Feedback</span>'
      + '</button>'
      + '</div>'
      // Try another estimate
      + '<div class="tp-other-verticals">'
      + '<h4>Try another estimate</h4>'
      + '<div class="tp-vertical-pills">';
    others.forEach(function (v) {
      html += '<a class="tp-vertical-pill" href="' + escAttr(v.href) + '" style="color:' + escAttr(v.color) + ';">' + escAttr(v.label) + '</a>';
    });
    html += '</div></div>'
      // Inline feedback row
      + '<div class="tp-feedback-row">'
      + '<div class="label">Was this analysis helpful?</div>'
      + '<div class="btns">'
      + '<button type="button" data-fb-rating="helpful">Yes, helpful</button>'
      + '<button type="button" data-fb-rating="high">My quote was higher</button>'
      + '<button type="button" data-fb-rating="low">My quote was lower</button>'
      + '</div>'
      + '<button type="button" class="more" data-action="feedback">Tell us more &rarr;</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Wire handlers via event delegation after the next paint
    setTimeout(function () { wireFooterHandlers(); }, 0);

    return html;
  };

  function wireFooterHandlers() {
    var footer = document.querySelector(".tp-trudy-footer");
    if (!footer || footer.__tpWired) return;
    footer.__tpWired = true;

    footer.addEventListener("click", function (ev) {
      var btn = ev.target.closest && ev.target.closest("[data-action], [data-fb-rating]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      var rating = btn.getAttribute("data-fb-rating");

      if (action === "print") {
        window.print();
        return;
      }

      if (action === "share") {
        var url = btn.getAttribute("data-url") || location.href;
        var title = btn.getAttribute("data-title") || document.title;
        if (navigator.share) {
          navigator.share({ title: title, text: title, url: url }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            btn.querySelector(".label").textContent = "Copied!";
            setTimeout(function () {
              var l = btn.querySelector(".label");
              if (l) l.textContent = "Share";
            }, 1500);
          });
        } else {
          prompt("Copy this link:", url);
        }
        return;
      }

      if (action === "startover") {
        var fnName = btn.getAttribute("data-fn");
        if (fnName && typeof window[fnName] === "function") {
          window[fnName]();
        } else {
          // Fallback: reload the page so the user lands fresh
          location.reload();
        }
        return;
      }

      if (action === "feedback") {
        if (typeof window.tpOpenFeedback === "function") {
          window.tpOpenFeedback();
        } else {
          // Fallback: mailto
          location.href = "mailto:hello@truepricehq.com?subject=TruePrice Feedback";
        }
        return;
      }

      if (rating) {
        // Send a structured rating to /api/analytics
        try {
          fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "feedback",
              data: { rating: rating, comment: "", path: location.pathname }
            })
          }).catch(function () {});
        } catch (e) {}
        // Visual confirmation
        var btns = btn.parentElement.querySelectorAll("button");
        btns.forEach(function (b) { b.disabled = true; b.style.opacity = "0.5"; });
        btn.style.background = "#dcfce7";
        btn.style.borderColor = "#86efac";
        btn.style.color = "#166534";
        btn.style.opacity = "1";
        btn.textContent = "Thanks!";
      }
    });
  }
})();
