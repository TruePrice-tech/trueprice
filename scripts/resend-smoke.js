// Resend smoke test. One-off send to verify woogoro.com domain is wired.
// Run: node --env-file=.env.local scripts/resend-smoke.js
//
// Verifies in this order:
//   1. RESEND_API_KEY present
//   2. Resend accepts the request (200 OK + message id)
//   3. Email lands in inbox with DKIM=pass / SPF=pass / DMARC=pass
//      (you check this manually in Yahoo by viewing email source/headers)

const TO = "glane0303@yahoo.com";
const FROM = "Woogoro <noreply@woogoro.com>";

async function main() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY not set. Make sure .env.local has it and you ran with --env-file=.env.local");
    process.exit(1);
  }

  const stamp = new Date().toISOString();
  const body = {
    from: FROM,
    to: [TO],
    subject: `Resend smoke test ${stamp}`,
    html: `<div style="font-family:sans-serif;max-width:520px;padding:20px;">
      <h2 style="color:#1d4ed8;margin:0 0 12px;">Resend smoke test</h2>
      <p>If you can read this in your inbox, Resend is wired up.</p>
      <p style="color:#475569;font-size:13px;">Sent at ${stamp}</p>
      <p style="color:#94a3b8;font-size:12px;">Check the headers in Yahoo (View Original / Show Original) for DKIM=pass, SPF=pass, DMARC=pass.</p>
    </div>`
  };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await r.text();
  console.log("status:", r.status);
  console.log("body:", text);

  if (!r.ok) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error("send failed:", e);
  process.exit(3);
});
