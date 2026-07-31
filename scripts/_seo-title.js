// scripts/_seo-title.js
//
// One rule for what goes inside <title>. Google cuts SERP titles at roughly
// 60 characters, so on pages with a long place name the brand suffix is
// ballast that costs us the end of the actual keyword phrase. Drop the
// ballast rather than the keywords.
//
// og:title, twitter:title and og:image:alt are NOT SERP surfaces and have no
// length cut, so they keep the full branded string. Only <title> passes
// through here.
//
// Established 2026-07-31 ([SEO-TITLE-2]) after an audit found 1,415 pages
// whose titles were being truncated mid-place-name in Google and Bing. Rules
// run in order and only ever REMOVE a fixed token, never rewrite a phrase, so
// no page loses a term it was targeting:
//
//   1. drop the trailing " | Woogoro"
//   2. if it is still over, drop a trailing " (YYYY)" -- but only from a bare
//      "<Thing> Cost in <Place> (YYYY)" title. That gate keeps the rule off
//      hand-written editorial titles where the year is part of the sentence.
//      Same convention scripts/_seo-trim-titles.js already used for the legal
//      and medical city pages.
//
// Both rules respect the 30-char floor in the CI contract
// (scripts/eyes-on-walk/lib/seo-contracts.js).

const SERP_LIMIT = 60;
const CONTRACT_FLOOR = 30;

// No colon, dash or pipe: prose titles carry one, templated ones do not.
const RX_PLAIN_PLACE_TITLE = /^[^:—–|]+ Costs? in [^:—–|]+ \(\d{4}\)$/;

/**
 * @param {string} fullTitle - the branded title, unescaped.
 * @param {number} [limit]   - SERP character budget.
 * @returns {string} the string to put inside <title>.
 */
function serpTitle(fullTitle, limit = SERP_LIMIT) {
  let t = String(fullTitle).trim();
  if (t.length <= limit) return t;

  const noBrand = t.replace(/\s*\|\s*Woogoro\s*$/, "");
  if (noBrand !== t && noBrand.length >= CONTRACT_FLOOR) t = noBrand;
  if (t.length <= limit) return t;

  if (RX_PLAIN_PLACE_TITLE.test(t)) {
    const noYear = t.replace(/\s*\(\d{4}\)/, "");
    if (noYear.length >= CONTRACT_FLOOR) t = noYear;
  }
  return t;
}

module.exports = { serpTitle, SERP_LIMIT, CONTRACT_FLOOR };
