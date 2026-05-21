# 05-unhappy readout — GD estimate unhappy path (Step 5)

URL: https://woogoro.com/garage-door-estimate.html
Captured: 2026-04-29 ~21:30

## Test — Refresh mid-wizard

**Setup:**
1. Click "Get Garage Door Estimate" on landing
2. On wizard step 1, click "Single Car Door" (advances to step 2)
3. Wait for step 2 to render, screenshot mid-state
4. Reload page, screenshot, verify reset

## What I see

- **05-mid-wizard.png** — wizard at Step 2 of 3, "What material for the door?", 6 material options (Basic Steel, Insulated Steel, Wood, Aluminum, Fiberglass, Composite/Faux Wood) + a "Back" button. Step indicator shows step 2 highlighted.
- **05-after-refresh.png** — clean initial state restored. H1 "How much will your garage door cost?", address input visible, "Get Garage Door Estimate" CTA present. Wizard state cleared, no orphaned step.
- Harness state: `isInitial: true, isWizard: false, h1: "How much will your garage door cost?"`. **PASS.**

## Verdict

Refresh mid-wizard correctly resets to clean initial state. No persisted partial-input state, no stuck step. **Step 5 of HUMAN_AUDIT_PROMPT for GD estimate:** PASS.

## Untested unhappy paths (deferred)

- Browser back-button after estimate page (does it return to wizard step or landing?).
- Click "Back" wizard button repeatedly past step 1 — does it gracefully bounce to landing?
- Fill malformed address ("xxxx") — does pricing engine fall back gracefully?
- ZIP not in metro list — does it fall back to regional pricing?

These are MOD/LOW. Logged for cross-vertical UX pass.

## Wizard structure observed

3-step wizard:
- Step 1: Service type (Single Car / Double Car / Custom-Carriage / Opener Only / Spring Replacement)
- Step 2: Material (Basic Steel / Insulated Steel / Wood / Aluminum / Fiberglass / Composite)
- Step 3: Opener? (Yes adds $350-$500 / No)

The wizard is intentionally compact — 3 questions to estimate. Trade-off vs accuracy noted as GD-EST-3 (LOW, deferred).
