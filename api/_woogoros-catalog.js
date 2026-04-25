// /api/_woogoros-catalog.js
//
// Hardcoded merch catalog for Phase 4 redemption. Print-on-demand via
// Printful is NOT integrated yet -- orders land in wg:order_queue and an
// admin manually fulfills via the Printful dashboard. When PRINTFUL_API_KEY
// is set, the redemption endpoint will additionally POST to Printful;
// this file stays the source-of-truth for what we offer + Woo prices.
//
// Woo prices match the launch plan memo. Adjust here only.

export const CATALOG = [
  {
    slug: "sticker_pack",
    label: "Iris sticker pack",
    description: "Five vinyl die-cut stickers featuring Iris and your favorite Woogoros.",
    wooCost: 2500,
    image: "/images/branding/Woogoro%20Website.jpg",
    requiresShipping: true,
    available: true,
    estimatedShipDays: 7,
  },
  {
    slug: "hat",
    label: "Woogoro snapback hat",
    description: "Embroidered front patch, structured 6-panel snapback. Adjustable.",
    wooCost: 8000,
    image: "/images/branding/Woogoro%20Website.jpg",
    requiresShipping: true,
    available: true,
    estimatedShipDays: 10,
  },
  {
    slug: "tee",
    label: "Iris tee",
    description: "Soft cotton blend, front-print Iris with the Fair Scepter. Unisex sizing S-3XL.",
    wooCost: 12000,
    image: "/images/branding/Woogoro%20Website.jpg",
    requiresShipping: true,
    available: true,
    estimatedShipDays: 10,
    options: { size: ["S","M","L","XL","2XL","3XL"] },
  },
  {
    slug: "hoodie",
    label: "Woogoro hoodie",
    description: "Heavyweight pullover hoodie with embroidered Woogoro patch. S-2XL.",
    wooCost: 25000,
    image: "/images/branding/Woogoro%20Website.jpg",
    requiresShipping: true,
    available: true,
    estimatedShipDays: 14,
    options: { size: ["S","M","L","XL","2XL"] },
  },
  {
    slug: "plushie_limited",
    label: "Iris plushie (limited)",
    description: "8-inch plush Iris with felt rainbow hat. First-batch production, limited run.",
    wooCost: 50000,
    image: "/images/branding/Woogoro%20Website.jpg",
    requiresShipping: true,
    available: false,         // Toggle on when first-batch lands.
    availableNote: "Coming soon",
    estimatedShipDays: 30,
  },
];

export function getItem(slug) {
  return CATALOG.find((i) => i.slug === slug) || null;
}

export function publicCatalog() {
  // Slim down for client; never expose internal fulfillment notes.
  return CATALOG.map((i) => ({
    slug: i.slug,
    label: i.label,
    description: i.description,
    wooCost: i.wooCost,
    image: i.image,
    requiresShipping: i.requiresShipping,
    available: i.available,
    availableNote: i.availableNote || null,
    estimatedShipDays: i.estimatedShipDays,
    options: i.options || null,
  }));
}

// Loose US shipping address validation. Field presence + length sanity.
// We do NOT use a real address verification service yet.
export function validateShipping(addr) {
  if (!addr || typeof addr !== "object") return { ok: false, error: "Shipping address required." };
  const required = ["fullName", "line1", "city", "stateCode", "postalCode"];
  for (const k of required) {
    const v = addr[k];
    if (typeof v !== "string" || v.trim().length < 2) {
      return { ok: false, error: "Missing or invalid: " + k };
    }
  }
  if (!/^[A-Z]{2}$/i.test(addr.stateCode.trim())) {
    return { ok: false, error: "stateCode must be a 2-letter US state." };
  }
  if (!/^\d{5}(-\d{4})?$/.test(addr.postalCode.trim())) {
    return { ok: false, error: "postalCode must be a 5- or 9-digit US ZIP." };
  }
  if (addr.fullName.length > 80) return { ok: false, error: "fullName too long." };
  if (addr.line1.length > 100 || (addr.line2 && addr.line2.length > 100)) {
    return { ok: false, error: "Address line too long." };
  }
  if (addr.city.length > 60) return { ok: false, error: "city too long." };
  return { ok: true };
}

export function normalizeShipping(addr) {
  return {
    fullName: String(addr.fullName || "").trim(),
    line1:    String(addr.line1 || "").trim(),
    line2:    String(addr.line2 || "").trim() || null,
    city:     String(addr.city || "").trim(),
    stateCode: String(addr.stateCode || "").toUpperCase().trim(),
    postalCode: String(addr.postalCode || "").trim(),
    country:  "US",
  };
}
