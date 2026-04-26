// /api/_receipt-woogoro-tiers.js
//
// Receipt Woogoro tier assignment.
//
// A "Receipt Woogoro" is the redemption unit (vs collectible vertical
// Woogoros). 4 tiers: bronze, silver, gold, platinum. Tier scales with
// receipt $ size, capped by trust score. Each tier has its own Woo Cash
// payout so big receipts (where the alt-data is most valuable) earn
// proportionally more.
//
// Tunable from the constants below. Keep this file the single source
// of truth: backend uses assignReceiptTier(), frontend reads the same
// table via /api/receipt-tiers (when we ship that read endpoint).
//
// Trust gate rationale: verifier auto-passes at trust>=70. Receipts
// just barely passing (70-79) are reliable enough to grant *something*
// but we don't want a sketchy $30K receipt to mint platinum on day one.
// Cap to silver until trust climbs.

// Edges are inclusive on the LOW end. Bronze covers [5, 750), silver
// [750, 3000), etc. minDollars=null on bronze means "any verified
// receipt above the verifier's $5 floor".
export const TIER_TABLE = [
  {
    tier: "bronze",
    displayName: "Bronze",
    minDollars: 0,
    maxDollars: 750,
    wooAmount: 500,
    artFile: "bronze1.png",
  },
  {
    tier: "silver",
    displayName: "Silver",
    minDollars: 750,
    maxDollars: 3000,
    wooAmount: 1000,
    artFile: "silver1.png",
  },
  {
    tier: "gold",
    displayName: "Gold",
    minDollars: 3000,
    maxDollars: 15000,
    wooAmount: 2500,
    artFile: "gold1.png",
  },
  {
    tier: "platinum",
    displayName: "Platinum",
    minDollars: 15000,
    maxDollars: Infinity,
    wooAmount: 5000,
    artFile: "platinum1.png",
  },
];

// Trust gate caps the tier on borderline-pass receipts. Verifier
// auto-passes at trust>=70; we only want full-tier-by-dollars when
// trust clears the high-confidence band.
const TRUST_TIER_CAPS = [
  { minTrust: 80, maxTier: "platinum" },
  { minTrust: 70, maxTier: "silver" },
  // anything below 70 shouldn't reach this function (verifier rejects)
];

const TIER_RANK = { bronze: 1, silver: 2, gold: 3, platinum: 4 };

function tierByDollars(dollars) {
  const d = Number(dollars);
  if (!Number.isFinite(d) || d < 0) return TIER_TABLE[0];
  for (const t of TIER_TABLE) {
    if (d >= t.minDollars && d < t.maxDollars) return t;
  }
  return TIER_TABLE[TIER_TABLE.length - 1];
}

function applyTrustCap(dollarTier, trustScore) {
  const t = Number(trustScore);
  if (!Number.isFinite(t)) return dollarTier;
  // Find the highest cap whose minTrust threshold is met.
  let cap = "bronze";
  for (const row of TRUST_TIER_CAPS) {
    if (t >= row.minTrust) { cap = row.maxTier; break; }
  }
  if (TIER_RANK[dollarTier.tier] <= TIER_RANK[cap]) return dollarTier;
  // Downgrade to the cap.
  return TIER_TABLE.find((x) => x.tier === cap) || dollarTier;
}

// Pure function. Inputs come straight from verifier output.
//   { declaredAmount, trustScore } -> tier row (cloned so callers can't mutate)
export function assignReceiptTier({ declaredAmount, trustScore }) {
  const dollarTier = tierByDollars(declaredAmount);
  const final = applyTrustCap(dollarTier, trustScore);
  return {
    tier: final.tier,
    displayName: final.displayName,
    wooAmount: final.wooAmount,
    artFile: final.artFile,
    cappedByTrust: final.tier !== dollarTier.tier,
    dollarTierIfUncapped: dollarTier.tier,
  };
}

// For UI: read-only snapshot of the table. Excludes Infinity for JSON.
export function tierTableForClient() {
  return TIER_TABLE.map((t) => ({
    tier: t.tier,
    displayName: t.displayName,
    minDollars: t.minDollars,
    maxDollars: Number.isFinite(t.maxDollars) ? t.maxDollars : null,
    wooAmount: t.wooAmount,
    artFile: t.artFile,
  }));
}
