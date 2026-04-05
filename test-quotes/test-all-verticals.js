/**
 * Test all verticals by sending quotes through the live APIs.
 * Flags any output language that may not survive legal scrutiny.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx node test-quotes/test-all-verticals.js
 *
 * Options:
 *   --vertical=auto     (run only one vertical)
 *   --local             (hit localhost:3000 instead of prod)
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = process.argv.includes("--local")
  ? "http://localhost:3000"
  : "https://truepricehq.com";

const API_KEY = process.env.ANTHROPIC_API_KEY;

// Legal risk phrases to flag in API responses
const LEGAL_RED_FLAGS = [
  // Medical - never say these
  { pattern: /this bill (is|looks) correct/i, risk: "HIGH", reason: "Asserts bill correctness (medical advice)" },
  { pattern: /you (should|must|need to) (pay|not pay)/i, risk: "HIGH", reason: "Directs payment action (financial advice)" },
  { pattern: /this (is|constitutes) (medical|insurance) fraud/i, risk: "HIGH", reason: "Accuses provider of fraud" },
  { pattern: /you (have|had) a (diagnosis|condition)/i, risk: "HIGH", reason: "Makes medical assessment" },
  { pattern: /malpractice/i, risk: "MEDIUM", reason: "Implies malpractice (legal conclusion)" },
  { pattern: /illegal(ly)? (charged|billed|billing)/i, risk: "HIGH", reason: "Asserts illegality" },

  // Legal - never say these
  { pattern: /this (fee|rate) is (unfair|unethical|excessive)/i, risk: "HIGH", reason: "Makes ethics judgment about attorney" },
  { pattern: /you should (fire|terminate|sue) your (attorney|lawyer)/i, risk: "HIGH", reason: "Gives legal advice" },
  { pattern: /violat(es?|ing) (bar|ethics|professional) (rules|standards)/i, risk: "HIGH", reason: "Accuses attorney of ethics violation" },
  { pattern: /this (attorney|lawyer) is (incompetent|unqualified)/i, risk: "HIGH", reason: "Defames attorney" },
  { pattern: /report (this|the) (attorney|lawyer) to the bar/i, risk: "MEDIUM", reason: "Advises bar complaint (legal advice)" },

  // Auto repair
  { pattern: /this (shop|mechanic) is (scamming|defrauding|ripping)/i, risk: "HIGH", reason: "Accuses business of fraud" },
  { pattern: /you (should|must) (not|refuse to) pay/i, risk: "MEDIUM", reason: "Directs payment refusal" },

  // Home services
  { pattern: /this contractor is (scamming|defrauding)/i, risk: "HIGH", reason: "Accuses business of fraud" },

  // General - softer flags
  { pattern: /we (recommend|advise|suggest) (you|that)/i, risk: "MEDIUM", reason: "Sounds like professional advice" },
  { pattern: /you (are being|were) (overcharged|scammed|ripped off)/i, risk: "MEDIUM", reason: "Declarative overcharge claim" },
  { pattern: /this (is|was) (definitely|clearly|obviously) (wrong|incorrect|an error)/i, risk: "MEDIUM", reason: "Declarative error assertion" },
  { pattern: /guaranteed|guarantee/i, risk: "LOW", reason: "Uses guarantee language" },
];

const TESTS = [
  {
    name: "HVAC Quote",
    vertical: "home",
    api: "/api/parse-quote",
    file: "quote6-hvac.txt"
  },
  {
    name: "Plumbing Quote",
    vertical: "home",
    api: "/api/parse-quote",
    file: "quote7-plumbing.txt"
  },
  {
    name: "Auto - Brake Job",
    vertical: "auto",
    api: "/api/auto-repair-estimate",
    file: "quote8-auto-brakes.txt"
  },
  {
    name: "Auto - Transmission",
    vertical: "auto",
    api: "/api/auto-repair-estimate",
    file: "quote9-auto-transmission.txt"
  },
  {
    name: "Medical - ER Bill",
    vertical: "medical",
    api: "/api/medical-bill-estimate",
    file: "quote10-medical-er.txt"
  },
  {
    name: "Medical - MRI",
    vertical: "medical",
    api: "/api/medical-bill-estimate",
    file: "quote11-medical-mri.txt"
  },
  {
    name: "Legal - Retainer Agreement",
    vertical: "legal",
    api: "/api/legal-fee-estimate",
    file: "quote12-legal-retainer.txt"
  },
  {
    name: "Legal - Invoice",
    vertical: "legal",
    api: "/api/legal-fee-estimate",
    file: "quote13-legal-invoice.txt"
  }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkLegalFlags(responseText, vertical) {
  var flags = [];
  var text = typeof responseText === "string" ? responseText : JSON.stringify(responseText);

  LEGAL_RED_FLAGS.forEach(function(rule) {
    var match = text.match(rule.pattern);
    if (match) {
      flags.push({
        risk: rule.risk,
        reason: rule.reason,
        matched: match[0],
        vertical: vertical
      });
    }
  });

  return flags;
}

async function runTest(test) {
  var filePath = path.join(__dirname, test.file);
  if (!fs.existsSync(filePath)) {
    console.log("  SKIP: " + test.file + " not found");
    return null;
  }

  var text = fs.readFileSync(filePath, "utf8");
  var url = BASE_URL + test.api;

  console.log("\n  Sending to " + test.api + "...");

  try {
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    });

    if (!res.ok) {
      var errText = await res.text();
      console.log("  API ERROR: " + res.status + " " + errText.slice(0, 200));
      return { error: res.status, body: errText };
    }

    var data = await res.json();
    console.log("  API OK: " + (data.success ? "success" : "failed"));

    // Check for legal red flags
    var flags = checkLegalFlags(data, test.vertical);

    if (flags.length > 0) {
      console.log("  *** LEGAL FLAGS FOUND ***");
      flags.forEach(function(f) {
        console.log("    [" + f.risk + "] " + f.reason + ": \"" + f.matched + "\"");
      });
    } else {
      console.log("  Legal check: CLEAN");
    }

    // Print key fields
    if (data.data) {
      var d = data.data;
      if (d.totalPrice || d.price) console.log("  Total: $" + (d.totalPrice || d.price));
      if (d.totalBilled) console.log("  Total Billed: $" + d.totalBilled);
      if (d.patientResponsibility) console.log("  Patient Owes: $" + d.patientResponsibility);
      if (d.hourlyRate) console.log("  Hourly Rate: $" + d.hourlyRate);
      if (d.feeStructure) console.log("  Fee Structure: " + d.feeStructure);
      if (d.redFlags && d.redFlags.length > 0) {
        console.log("  Red Flags: " + d.redFlags.length);
        d.redFlags.forEach(function(f, i) {
          var flagText = typeof f === "string" ? f : f.title || f.description || JSON.stringify(f);
          console.log("    " + (i + 1) + ". " + flagText.slice(0, 100));
          // Check each red flag for legal issues
          var rfFlags = checkLegalFlags(flagText, test.vertical);
          rfFlags.forEach(function(rf) {
            console.log("       *** [" + rf.risk + "] " + rf.reason + ": \"" + rf.matched + "\"");
          });
        });
      }
      if (d.summary) {
        console.log("  Summary: " + d.summary.slice(0, 150));
        var sumFlags = checkLegalFlags(d.summary, test.vertical);
        sumFlags.forEach(function(sf) {
          console.log("    *** [" + sf.risk + "] " + sf.reason + ": \"" + sf.matched + "\"");
        });
      }
    }

    return { data: data, flags: flags };

  } catch (e) {
    console.log("  FETCH ERROR: " + e.message);
    return { error: e.message };
  }
}

async function main() {
  var targetVertical = null;
  process.argv.forEach(function(arg) {
    if (arg.startsWith("--vertical=")) targetVertical = arg.split("=")[1];
  });

  var tests = targetVertical
    ? TESTS.filter(function(t) { return t.vertical === targetVertical; })
    : TESTS;

  console.log("=== TruePrice Vertical Test Suite ===");
  console.log("API Base: " + BASE_URL);
  console.log("Tests: " + tests.length);
  console.log("");

  var totalFlags = 0;
  var results = [];

  for (var i = 0; i < tests.length; i++) {
    var test = tests[i];
    console.log("\n" + "─".repeat(50));
    console.log("TEST " + (i + 1) + "/" + tests.length + ": " + test.name + " [" + test.vertical + "]");

    var result = await runTest(test);
    if (result && result.flags) {
      totalFlags += result.flags.length;
      results.push({ name: test.name, flags: result.flags });
    }

    // Rate limit between API calls
    if (i < tests.length - 1) await sleep(3000);
  }

  console.log("\n" + "═".repeat(50));
  console.log("=== RESULTS ===");
  console.log("Tests run: " + tests.length);
  console.log("Legal flags: " + totalFlags);

  if (totalFlags > 0) {
    console.log("\n*** FLAGGED ITEMS ***");
    results.forEach(function(r) {
      if (r.flags.length > 0) {
        console.log("\n" + r.name + ":");
        r.flags.forEach(function(f) {
          console.log("  [" + f.risk + "] " + f.reason + ": \"" + f.matched + "\"");
        });
      }
    });
  } else {
    console.log("\nAll tests CLEAN. No legal risk language detected.");
  }
}

main().catch(function(e) {
  console.error("Fatal:", e);
  process.exit(1);
});
