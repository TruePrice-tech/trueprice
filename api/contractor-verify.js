import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Email-based verification: send a 6-digit code, contractor enters it to prove ownership.
// No third-party APIs, no cost. Codes expire after 15 minutes.

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, email, code } = req.body;

  if (action === "send_code") {
    // Generate and store a verification code for this email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid business email required" });
    }

    const emailLower = email.toLowerCase().trim();
    const rateKey = `verify_rate:${emailLower}`;
    const rateCount = await redis.get(rateKey) || 0;
    if (rateCount >= 5) {
      return res.status(429).json({ error: "Too many verification attempts. Try again in an hour." });
    }

    const verifyCode = generateCode();
    const codeKey = `verify_code:${emailLower}`;

    // Store code with 15-minute expiry
    await redis.set(codeKey, verifyCode, { ex: 900 });
    await redis.set(rateKey, Number(rateCount) + 1, { ex: 3600 });

    // Send verification email via Resend (or log if no API key)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "TruePrice <noreply@truepricehq.com>",
            to: [emailLower],
            subject: "TruePrice Verification Code: " + verifyCode,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
              <h2 style="color:#1e293b;">Your TruePrice Verification Code</h2>
              <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#1d4ed8;background:#f0f9ff;padding:20px;text-align:center;border-radius:12px;margin:20px 0;">${verifyCode}</div>
              <p style="color:#475569;">Enter this code on the TruePrice contractor signup page to verify your business email.</p>
              <p style="color:#94a3b8;font-size:13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
            </div>`
          })
        });
      } catch(e) {
        console.error("[contractor-verify] Email send failed:", e.message);
      }
    } else {
      // No email service configured -- log code for development
      console.log(`[contractor-verify] Code for ${emailLower}: ${verifyCode} (no RESEND_API_KEY set)`);
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to " + emailLower + ". Check your inbox."
    });
  }

  if (action === "verify_code") {
    // Verify the code the contractor entered
    if (!email || !code) {
      return res.status(400).json({ error: "Email and code required" });
    }

    const emailLower = email.toLowerCase().trim();
    const codeKey = `verify_code:${emailLower}`;
    const storedCode = await redis.get(codeKey);

    if (!storedCode) {
      return res.status(400).json({ verified: false, error: "Code expired or not found. Request a new one." });
    }

    if (String(storedCode) !== String(code).trim()) {
      return res.status(400).json({ verified: false, error: "Incorrect code. Please try again." });
    }

    // Code matches -- mark email as verified
    await redis.del(codeKey);
    const verifiedKey = `verify_confirmed:${emailLower}`;
    await redis.set(verifiedKey, "true", { ex: 86400 }); // Valid for 24 hours

    return res.status(200).json({
      verified: true,
      message: "Email verified successfully."
    });
  }

  return res.status(400).json({ error: "Unknown action. Expected: send_code or verify_code" });
}
