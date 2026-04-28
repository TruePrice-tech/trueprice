// SEO contract assertion engine. Fetches the rendered HTML of a URL, parses
// out the metadata + schema + structural fingerprint with regex (no DOM
// library needed for this surface), then asserts against the matching
// template contract from lib/seo-contracts.js. Returns issues in the same
// shape as lib/eyes.js so lib/findings.js aggregates them seamlessly.

const { resolveTemplate } = require("./seo-contracts");

function extractAll(html, re, group = 1) {
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push((m[group] || "").trim());
  return out;
}

function extractFirst(html, re, group = 1) {
  const m = html.match(re);
  return m ? (m[group] || "").trim() : null;
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function parsePage(html) {
  const title = decodeEntities(extractFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = decodeEntities(
    extractFirst(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
  );
  const canonical = extractFirst(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const robots = (extractFirst(html, /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i) || "").toLowerCase();
  const h1Count = (html.match(/<h1[\s>][^>]*>/gi) || []).length;
  const skipLink = /class=["'][^"']*\bskip-link\b/i.test(html) || /href=["']#main["']/i.test(html);

  const ogTags = {};
  const ogRe = /<meta[^>]+property=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["']/gi;
  let mog;
  while ((mog = ogRe.exec(html)) !== null) ogTags[mog[1]] = mog[2];

  const twitterTags = {};
  const twRe = /<meta[^>]+name=["'](twitter:[^"']+)["'][^>]*content=["']([^"']*)["']/gi;
  let mtw;
  while ((mtw = twRe.exec(html)) !== null) twitterTags[mtw[1]] = mtw[2];

  const jsonLdBlocks = [];
  const jsonLdParseErrors = [];
  const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let mj;
  while ((mj = jsonLdRe.exec(html)) !== null) {
    const raw = (mj[1] || "").trim();
    if (!raw) continue;
    try {
      jsonLdBlocks.push(JSON.parse(raw));
    } catch (e) {
      jsonLdParseErrors.push(e.message);
    }
  }

  // internal links: <a href="..."> where href stays on woogoro.com (or is relative)
  // and isn't a fragment-only or mailto/tel link.
  const internalLinks = new Set();
  const aRe = /<a[^>]+href=["']([^"']+)["']/gi;
  let ma;
  while ((ma = aRe.exec(html)) !== null) {
    const h = ma[1];
    if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:") || h.startsWith("javascript:")) continue;
    if (/^https?:\/\//i.test(h)) {
      if (!/woogoro\.com/i.test(h)) continue; // external
    }
    internalLinks.add(h);
  }

  return {
    title,
    description,
    canonical,
    robots,
    h1Count,
    skipLink,
    ogTags,
    twitterTags,
    jsonLdBlocks,
    jsonLdParseErrors,
    internalLinkCount: internalLinks.size,
  };
}

function jsonLdHasType(blocks, typesRegex) {
  // typesRegex is a string like "Article|FAQPage|WebPage" -- match if any
  // block (or @graph element) has a @type that matches.
  const re = new RegExp(`^(${typesRegex})$`, "i");
  function visit(obj) {
    if (!obj) return false;
    if (Array.isArray(obj)) return obj.some(visit);
    if (typeof obj !== "object") return false;
    const t = obj["@type"];
    if (t && (Array.isArray(t) ? t.some((x) => re.test(x)) : re.test(t))) return true;
    if (obj["@graph"]) return visit(obj["@graph"]);
    return false;
  }
  return blocks.some(visit);
}

function checkPage(urlPath, parsed, contract) {
  const issues = [];
  const ctx = `seo:${urlPath}`;
  const push = (severity, summary, detail) => issues.push({ severity, screenshot: ctx, summary, detail });

  // Universal placeholder/empty checks
  if (!parsed.title || parsed.title.length === 0) push("high", "title is empty", "Page rendered with no <title>.");
  else if (/\{\{|\bundefined\b|\bNaN\b|\bnull\b|TODO/i.test(parsed.title))
    push("high", "title contains placeholder/undefined", `title="${parsed.title}"`);
  if (!parsed.description) push("medium", "description meta tag missing or empty", "Google rewrites missing/empty descriptions, hurting CTR.");
  else if (/\{\{|\bundefined\b|\bNaN\b|\bnull\b|TODO/i.test(parsed.description))
    push("high", "description contains placeholder/undefined", `description="${parsed.description}"`);

  if (parsed.jsonLdParseErrors.length) {
    push("high", `${parsed.jsonLdParseErrors.length} JSON-LD block(s) failed to parse`, parsed.jsonLdParseErrors.join(" | "));
  }

  // Title length band
  if (contract.titleLength && parsed.title) {
    const len = parsed.title.length;
    if (len < contract.titleLength.min) push("medium", `title shorter than ${contract.titleLength.min} chars`, `len=${len}: "${parsed.title}"`);
    else if (len > contract.titleLength.max) push("medium", `title longer than ${contract.titleLength.max} chars (Google truncates ~60)`, `len=${len}: "${parsed.title}"`);
  }
  // Description length band
  if (contract.descriptionLength && parsed.description) {
    const len = parsed.description.length;
    if (len < contract.descriptionLength.min) push("medium", `description shorter than ${contract.descriptionLength.min} chars`, `len=${len}`);
    else if (len > contract.descriptionLength.max) push("medium", `description longer than ${contract.descriptionLength.max} chars`, `len=${len}`);
  }
  // H1 count
  if (contract.h1Count) {
    if (parsed.h1Count < contract.h1Count.min) push("high", "no <h1> on page", `h1Count=${parsed.h1Count}`);
    else if (parsed.h1Count > contract.h1Count.max) push("medium", `multiple h1s on page (${parsed.h1Count})`, "Pick exactly one for SEO clarity.");
  }
  // Canonical self
  if (contract.canonicalSelf) {
    if (!parsed.canonical) push("high", "canonical link tag missing", "");
    else {
      try {
        const u = new URL(parsed.canonical);
        if (u.pathname !== urlPath) push("high", "canonical does not point to self", `expected ${urlPath}, got ${u.pathname}`);
      } catch (e) {
        push("high", "canonical href is not a valid URL", parsed.canonical);
      }
    }
  }
  // JSON-LD type check
  if (contract.jsonLdRequired) {
    for (const typeAlt of contract.jsonLdRequired) {
      if (!jsonLdHasType(parsed.jsonLdBlocks, typeAlt)) {
        push("high", `JSON-LD missing required type (${typeAlt})`, `Found ${parsed.jsonLdBlocks.length} block(s); none had @type matching ${typeAlt}.`);
      }
    }
  }
  // OG tags
  if (contract.ogRequired) {
    const missing = contract.ogRequired.filter((tag) => !parsed.ogTags[tag] || !parsed.ogTags[tag].trim());
    if (missing.length) push("medium", `missing OG tag(s): ${missing.join(", ")}`, "Affects link previews on social + AI search snippets.");
  }
  if (contract.twitterRequired) {
    const missing = contract.twitterRequired.filter((tag) => !parsed.twitterTags[tag] || !parsed.twitterTags[tag].trim());
    if (missing.length) push("low", `missing Twitter tag(s): ${missing.join(", ")}`, "");
  }
  // Internal links floor
  if (contract.internalLinkFloor != null && parsed.internalLinkCount < contract.internalLinkFloor) {
    push("medium", `internal-link count below floor (${parsed.internalLinkCount} < ${contract.internalLinkFloor})`, "Hub/metro pages need internal-link density to rank.");
  }
  // Skip link
  if (contract.requireSkipLink && !parsed.skipLink) {
    push("medium", "skip-to-main-content link missing", "A11y + Lighthouse checkpoint; also a recently-regressed flagship template item.");
  }
  // Indexability
  if (contract.indexable === true && /\bnoindex\b/.test(parsed.robots)) {
    push("high", "page is noindex but template requires indexable", `robots="${parsed.robots}"`);
  }
  if (contract.indexable === false && !/\bnoindex\b/.test(parsed.robots)) {
    push("high", "tool page MUST be noindex but isn't", `robots="${parsed.robots || "(not set)"}"`);
  }

  return issues;
}

async function checkUrl(base, urlPath, { fetchTimeoutMs = 15000 } = {}) {
  const url = `${base}${urlPath}`;
  const tpl = resolveTemplate(urlPath);
  if (!tpl) {
    return {
      walkPath: `seo (${urlPath})`,
      url,
      template: null,
      error: "no template matched",
      issues: [],
    };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), fetchTimeoutMs);
  let html;
  let status;
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Woogoro-SEO-Gate/1.0 (+contact:hello@woogoro.com)" },
    });
    status = resp.status;
    html = await resp.text();
  } catch (e) {
    clearTimeout(timer);
    return { walkPath: `seo (${urlPath})`, url, template: tpl.key, error: `fetch failed: ${e.message}`, issues: [] };
  }
  clearTimeout(timer);
  if (status >= 400) {
    return { walkPath: `seo (${urlPath})`, url, template: tpl.key, error: `HTTP ${status}`, issues: [] };
  }
  const parsed = parsePage(html);
  const issues = checkPage(urlPath, parsed, tpl);
  return { walkPath: `seo (${urlPath})`, url, template: tpl.key, issues, parsed };
}

module.exports = { parsePage, checkPage, checkUrl };
