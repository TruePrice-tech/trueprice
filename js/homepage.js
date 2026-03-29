// Quote counter animation
(function() {
  var el = document.getElementById("quoteCounter");
  if (!el) return;
  fetch("/api/analytics?counter=1")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var target = d.count || 847;
      var start = 0;
      var duration = 1500;
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        var current = Math.round(start + (target - start) * progress);
        el.textContent = current.toLocaleString() + "+";
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    })
    .catch(function() {
      el.textContent = "800+";
    });
})();

// Email signup handler
(function() {
  var form = document.getElementById("emailSignup");
  if (!form) return;
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    var email = document.getElementById("signupEmail").value.trim();
    var status = document.getElementById("signupStatus");
    var btn = form.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Sending...";
    status.textContent = "";
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email_signup", email: email })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) {
        status.style.color = "#166534";
        status.textContent = "Thanks! You\u2019re on the list.";
        form.reset();
      } else {
        status.style.color = "#b91c1c";
        status.textContent = d.error || "Something went wrong. Try again.";
      }
      btn.disabled = false;
      btn.textContent = "Subscribe";
    })
    .catch(function() {
      status.style.color = "#b91c1c";
      status.textContent = "Something went wrong. Try again.";
      btn.disabled = false;
      btn.textContent = "Subscribe";
    });
  });
})();
