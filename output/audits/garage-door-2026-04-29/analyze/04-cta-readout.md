# 04-cta readout — Reject screen CTAs (Step 4 of HUMAN_AUDIT_PROMPT)

URL: https://woogoro.com/garage-door-quote-analyzer.html (origin)
Captured: 2026-04-29 ~20:45
Test scope: click each "Analyze as <vertical> instead" CTA + the "Upload a different file" CTA, verify routing and landing page H1.

## Results from harness (04-cta-results.json)

| Case | Reject seen | CTA found | CTA text | Landed URL | Landed H1 | URL match | H1 match |
|---|---|---|---|---|---|---|---|
| roof | yes | yes | "Analyze as Roofing instead" | /roofing-quote-analyzer.html?path=quote | "Is your roofing quote fair?" | ✓ | ✓ |
| hvac | yes | yes | "Analyze as HVAC instead" | /hvac-quote-analyzer.html?path=quote | "Is your HVAC quote fair?" | ✓ | ✓ |
| auto | yes | yes | "Analyze as Auto Repair instead" | /auto-repair.html?path=quote | "Auto Repair Pricing" | ✓ | ✓ |
| upload-different | yes | yes | "Upload a different file" | /garage-door-quote-analyzer.html | "Is your garage door quote fair?" | n/a | ✓ (returned to initial) |

## Visual reads (each landed page)

### CTA 1 — Roof → /roofing-quote-analyzer.html?path=quote (04-cta-roof-landed.png)
Roofing analyzer page renders cleanly: Iris-in-hard-hat mascot, H1 "Is your roofing quote fair?", "Upload Your Roofing Quote" upload zone, address fields below, cross-vertical strip, full SEO content (Roofing what-to-look-for spec table, Red flags, Hidden costs, FAQ, Footer). User can immediately re-upload the roofing quote on the right analyzer. **CTA routing correct.**

### CTA 2 — HVAC → /hvac-quote-analyzer.html?path=quote (04-cta-hvac-landed.png)
HVAC analyzer page renders cleanly: HVAC-Woogoro mascot (orange-haired variant), H1 "Is your HVAC quote fair?", "Analyze a Quote" CTA, cross-vertical strip, full HVAC SEO content (System type and tonnage, refrigerant type, SEER ratings, Manual J load calc, etc.), Red flags, FAQ, Footer. User can immediately re-upload. **CTA routing correct.**

### CTA 3 — Auto → /auto-repair.html?path=quote (04-cta-auto-landed.png)
Auto repair page is NOT a single-purpose analyzer like roofing/hvac — it's a hub with 3 tabs ("I Need an Estimate", "I Have a Quote", "Compare 2-3 Quotes"). With path=quote query, the "I Have a Quote" tab is presumably active and the "Upload Your Quote" drag/drop area renders below. Auto-Repair-Woogoro mascot (red bear with wrench) at top. H1 "Auto Repair Pricing".
- **GD-CTA-NOTE-1 (CROSS-VERTICAL, LOW):** Auto repair landing differs from other vertical analyzers (different page structure, different H1, different mascot rendering). User experience IS functional — they can drop their quote into the upload zone immediately. But the visual transition from GD reject ("Analyze as Auto Repair instead") to the auto-repair hub is jarring vs. the seamless transition to roofing/hvac analyzer pages. Logged for the auto-repair audit, not a GD blocker.

### CTA 4 — Upload a different file (04-cta-upload-different.png)
Page reset to GD analyzer initial state. Same mascot, same H1 "Is your garage door quote fair?", same "Analyze a quote" CTA, file input present. Identical to 01-initial.png. **Reset works correctly.**

## Verdict

All 4 CTAs on the GD reject screen route correctly:
- Vertical analyzers' URLs match `/X-quote-analyzer.html?path=quote` pattern, or the auto-repair hub for auto.
- Landed page H1s confirm correct destination.
- "Upload a different file" cleanly resets to initial GD state.

No new blockers. One LOW cross-vertical note (GD-CTA-NOTE-1) about auto-repair landing inconsistency, deferred to auto-repair audit.

Step 4 of HUMAN_AUDIT_PROMPT for GD analyze: **PASS**.
