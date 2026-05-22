#!/usr/bin/env node
/**
 * Phase 1 generator for tier-b-faq-gaps-<vertical>.json artifacts.
 *
 * Each vertical's gap-list follows the HVAC pattern (5-6 city-aware FAQs,
 * mapped to existing context.json slots, with Phase 2 state-data needs
 * called out). This generator combines:
 *   - current FAQ extraction from templates/<vertical>-city-page-template.html
 *   - inventory of data/<vertical>-city-context.json slot coverage + distinctness
 *   - per-vertical FAQ design (judgment encoded as a config block below)
 *
 * Output: 15 JSON files at output/audits/tier-b-faq-gaps-<vertical>.json
 * (HVAC already shipped manually 2026-05-22; this skips it.)
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

// ----- helpers -----
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

function extractFAQs(html) {
  const faqs = [];
  const re = /<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-answer">\s*<p>([\s\S]*?)<\/p>\s*<\/div>\s*<\/details>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    faqs.push({
      q: m[1].replace(/\s+/g, " ").trim(),
      a: m[2].replace(/\s+/g, " ").trim(),
    });
  }
  return faqs;
}

function slotInventory(ctxFile) {
  if (!fs.existsSync(ctxFile)) return { entries: 0, slots: [] };
  const d = readJson(ctxFile);
  const keys = Object.keys(d);
  if (!keys.length) return { entries: 0, slots: [] };
  const slotNames = Object.keys(d[keys[0]]);
  const slots = slotNames.map((s) => {
    const vals = keys.map((k) => d[k][s] || "");
    const nonempty = vals.filter(Boolean).length;
    const distinct = new Set(vals).size;
    const sampleLen = vals.find(Boolean) ? vals.find(Boolean).length : 0;
    return {
      name: s,
      coverage: `${nonempty}/${keys.length}`,
      distinct: `${distinct}/${nonempty}`,
      pctUnique: nonempty > 0 ? Math.round((distinct / nonempty) * 100) : 0,
      sampleCharLen: sampleLen,
    };
  });
  return { entries: keys.length, slots };
}

// ----- per-vertical FAQ design config -----
// Each entry encodes the judgment about which 5-6 FAQs to propose, which
// slots they bind to, and what Phase 2 data (if any) is needed.
const VERTICALS = [
  {
    v: "roof",
    tmpl: "templates/city-page-template.html",
    ctxFile: "data/city-context.json",
    ctxNote: "roof uses shared city-context.json — uniquely rich (climateZone/hailRisk/hurricaneZone/snowLoad/avgHomeAge/permitNote/weatherNote/materialTip/hoaPrevalence). No vertical-specific costDriverNote/redFlagNote here.",
    proposed: [
      { id: "cost-in-city", q: "How much does a new roof cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","weatherNote-first-clause"], priorState: "kept-from-current" },
      { id: "why-cost-differs", q: "Why is roofing more expensive | cheaper in {{CITY}}?", slots: ["serviceMultipliers.roofing","avgHomeAge","weatherNote"], priorState: "expanded-from-current" },
      { id: "material-for-climate", q: "What roofing material is best for {{CITY}}?", slots: ["materialTip","climateZone","hailRisk"], priorState: "new" },
      { id: "storm-risk", q: "How does storm + hail risk affect {{CITY}} roofing?", slots: ["hailRisk","hurricaneZone","snowLoad","weatherNote"], priorState: "new" },
      { id: "permit-inspection", q: "What permits and inspections does {{CITY}} require for a roof?", slots: ["permitNote"], priorState: "new", note: "city-context.permitNote is already roofing-worded for all 739 cities — zero new data needed." },
      { id: "quote-include", q: "What should a roofing quote in {{CITY}} include?", slots: ["weatherNote","climateZone"], priorState: "kept-from-current-but-localized" },
    ],
    phaseTwoDataNeeded: { file: null, scope: "NONE — city-context.json is already roof-tailored", deferrable: "n/a" },
  },
  {
    v: "plumbing",
    tmpl: "templates/plumbing-city-page-template.html",
    ctxFile: "data/plumbing-city-context.json",
    ctxNote: "plumbing has waterNote+freezeRisk instead of climateNote+seasonNote (better signal for plumbing).",
    proposed: [
      { id: "cost-in-city", q: "How much does a plumber cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is plumbing more expensive | cheaper in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.plumbing"], priorState: "new" },
      { id: "water-quality", q: "What should I know about {{CITY}} water quality before plumbing work?", slots: ["waterNote"], priorState: "new", note: "waterNote is plumbing-specific and 100% unused — strong city signal (hard water, well vs municipal, mineral content)." },
      { id: "freeze-prevention", q: "What freeze prevention does {{CITY}} require for plumbing?", slots: ["freezeRisk"], priorState: "new", note: "freezeRisk is plumbing-specific. For warm-climate cities the answer becomes 'minimal' which is still city-distinct vs. cold-climate cities." },
      { id: "red-flags", q: "What red flags should I watch for hiring a plumber in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "permit-licensing", q: "Do I need a permit for plumbing work in {{CITY}}, {{STATE}}?", slots: ["STATE_PLUMBING_PERMIT","STATE_LICENSING_BODY"], priorState: "new", deferrable: true },
    ],
    phaseTwoDataNeeded: { file: "data/plumbing-state-data.json", scope: "50 state entries (plumbing permit intro, licensing body name, sales tax on labor)", deferrable: "yes — drop to 5 FAQs if state data isn't built" },
  },
  {
    v: "electrical",
    tmpl: "templates/electrical-city-page-template.html",
    ctxFile: "data/electrical-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does electrical work cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is electrical more expensive | cheaper in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.electrical"], priorState: "new" },
      { id: "infrastructure", q: "What {{CITY}} infrastructure issues drive electrical demand?", slots: ["climateNote","localInsight"], priorState: "new", note: "climateNote for electrical talks about cooling load + EV adoption + summer peak — strong city signal." },
      { id: "best-time", q: "When is the best time for electrical work in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring an electrician in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "permit-nec", q: "What NEC code year and permits apply in {{CITY}}, {{STATE}}?", slots: ["STATE_NEC_ADOPTION","STATE_PERMIT_INTRO"], priorState: "new", deferrable: true },
    ],
    phaseTwoDataNeeded: { file: "data/electrical-state-data.json", scope: "50 state entries (NEC code year, state licensing body, permit/inspection workflow)", deferrable: "yes — overlaps with HVAC mechanical permit research; consolidate state contractor board file" },
  },
  {
    v: "solar",
    tmpl: "templates/solar-city-page-template.html",
    ctxFile: "data/solar-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much do solar panels cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is solar more expensive | cheaper in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.solar"], priorState: "new" },
      { id: "system-size", q: "What solar system size fits a typical {{CITY}} home?", slots: ["climateNote","materialTip"], priorState: "new", note: "climateNote for solar talks about sun-hours/year + roof orientation — strong production signal." },
      { id: "net-metering", q: "How does net metering work in {{STATE}}?", slots: ["STATE_NET_METERING","STATE_UTILITY_LIST"], priorState: "new", deferrable: true, note: "Highest-leverage state-data fill for solar — net-metering rules dramatically alter payback math and are 100% state-distinct." },
      { id: "incentives", q: "What solar incentives + rebates are available in {{CITY}}, {{STATE}}?", slots: ["STATE_SOLAR_INCENTIVES","localInsight"], priorState: "new", deferrable: true },
      { id: "red-flags", q: "What red flags should I watch for hiring a solar installer in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
    ],
    phaseTwoDataNeeded: { file: "data/solar-state-data.json", scope: "50 state entries (net metering policy summary, SREC market, state-level rebate programs, top utilities + interconnection delays)", deferrable: "partial — ship 4 city-aware + 2 generic-ish if state data isn't built. Solar has the highest Phase 2 leverage of any vertical." },
  },
  {
    v: "kitchen",
    tmpl: "templates/kitchen-city-page-template.html",
    ctxFile: "data/kitchen-remodel-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does a kitchen remodel cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why are kitchen remodels more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.kitchen"], priorState: "new" },
      { id: "material-style", q: "What cabinet + countertop styles fit {{CITY}} homes?", slots: ["materialTip","climateNote"], priorState: "new" },
      { id: "best-time", q: "When is the best time to remodel a kitchen in {{CITY}}?", slots: ["seasonNote","localInsight"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a kitchen contractor in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "permit-irc", q: "What kitchen permits + inspections does {{CITY}}, {{STATE}} require?", slots: ["STATE_IRC_ADOPTION","STATE_PERMIT_INTRO"], priorState: "new", deferrable: true },
    ],
    phaseTwoDataNeeded: { file: "shared-state-permit-data.json (consolidated across building-trades)", scope: "50 state entries — IRC adoption year, sales tax on contractor labor, common kitchen-remodel permit triggers (plumbing/electrical/structural)", deferrable: "yes — overlaps with siding/painting/window permit needs; build once, reuse" },
  },
  {
    v: "window",
    tmpl: "templates/window-city-page-template.html",
    ctxFile: "data/window-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much do replacement windows cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why are windows more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.window"], priorState: "new" },
      { id: "type-for-climate", q: "What window type fits {{CITY}}'s climate?", slots: ["climateNote","materialTip"], priorState: "new", note: "Climate-driven U-factor + SHGC targets — strong signal because Energy Star zones map to climate zones." },
      { id: "best-time", q: "When is the best time to replace windows in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a window installer in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "rebates", q: "What window rebates + tax credits apply in {{CITY}}, {{STATE}}?", slots: ["STATE_WINDOW_REBATES","FEDERAL_25C_INFO"], priorState: "new", deferrable: true },
    ],
    phaseTwoDataNeeded: { file: "data/window-state-data.json (or shared utility-rebate-data.json)", scope: "50 state entries — utility window rebate summary, 25C federal credit reminder, state Energy Star adoption", deferrable: "yes; overlap with insulation + HVAC utility rebate research" },
  },
  {
    v: "siding",
    tmpl: "templates/siding-city-page-template.html",
    ctxFile: "data/siding-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does siding cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is siding more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.siding"], priorState: "new" },
      { id: "material-for-climate", q: "What siding material works best for {{CITY}}?", slots: ["materialTip","climateNote"], priorState: "new", note: "Climate-driven: termite zones favor fiber cement; salt-air coastal favors fiber cement or vinyl; freeze-thaw markets favor engineered wood." },
      { id: "best-time", q: "When is the best time to install siding in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a siding contractor in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "permit-hoa", q: "Do I need permits or HOA approval for siding in {{CITY}}?", slots: ["STATE_PERMIT_INTRO","hoaPrevalence"], priorState: "new", deferrable: true, note: "hoaPrevalence already in city-context.json but not currently used. Adding state permit info enables a strong FAQ." },
    ],
    phaseTwoDataNeeded: { file: "shared-state-permit-data.json (see kitchen)", scope: "50 state entries — building permit threshold for siding (square footage)", deferrable: "yes; consolidate with kitchen/painting" },
  },
  {
    v: "painting",
    tmpl: "templates/painting-city-page-template.html",
    ctxFile: "data/painting-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does exterior painting cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is painting more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.painting"], priorState: "new" },
      { id: "paint-for-climate", q: "What paint type holds up best in {{CITY}}'s climate?", slots: ["climateNote","materialTip"], priorState: "new", note: "UV index + humidity + freeze-thaw drive paint chemistry choice. Climate-distinct." },
      { id: "best-season", q: "When is the best season to paint a {{CITY}} home?", slots: ["seasonNote"], priorState: "new", note: "Painting has the tightest temperature/humidity window of any trade — seasonNote is highest-impact here." },
      { id: "red-flags", q: "What red flags should I watch for hiring a painter in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "lead-paint", q: "Does my {{CITY}} home need EPA RRP lead-paint precautions?", slots: ["STATE_RRP_NOTE","avgHomeAge"], priorState: "new", deferrable: true, note: "EPA RRP rule applies to pre-1978 homes. With avgHomeAge from city-context.json, we can give a city-distinct yes/no/probably." },
    ],
    phaseTwoDataNeeded: { file: "data/painting-state-data.json", scope: "50 state entries — state RRP enforcement, state contractor licensing for painting (some states require, most don't)", deferrable: "yes — RRP FAQ is the lowest-value of the 6; ship 5 if needed" },
  },
  {
    v: "garage-door",
    tmpl: "templates/garage-door-city-page-template.html",
    ctxFile: "data/garage-door-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does a new garage door cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why are garage doors more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.garage-door"], priorState: "new" },
      { id: "wind-storm", q: "What wind rating does a garage door need in {{CITY}}?", slots: ["climateNote","materialTip"], priorState: "new", note: "Hurricane/tornado zones require wind-rated doors; non-storm zones don't. Strong city-distinct signal." },
      { id: "best-time", q: "When is the best time to install a garage door in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a garage-door installer in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "hoa-permit", q: "Do {{CITY}} HOAs typically restrict garage-door style?", slots: ["hoaPrevalence","localInsight"], priorState: "new", note: "hoaPrevalence already in city-context.json. Can ship this FAQ without any Phase 2 fill." },
    ],
    phaseTwoDataNeeded: { file: null, scope: "NONE — all 6 FAQs map to existing slots", deferrable: "n/a" },
  },
  {
    v: "fence",
    tmpl: "templates/fencing-city-page-template.html",
    ctxFile: "data/fence-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does a fence cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is fencing more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.fencing"], priorState: "new" },
      { id: "material-for-climate", q: "What fence material lasts best in {{CITY}}?", slots: ["materialTip","climateNote"], priorState: "new" },
      { id: "best-time", q: "When is the best time to install a fence in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a fence contractor in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "permit-setback", q: "What fence height + setback rules apply in {{CITY}}, {{STATE}}?", slots: ["STATE_FENCE_RULES","hoaPrevalence"], priorState: "new", deferrable: true, note: "Fence height/setback varies dramatically by state + city — likely the highest variation FAQ in Tier B." },
    ],
    phaseTwoDataNeeded: { file: "data/fence-state-data.json", scope: "50 state entries — typical max height for front vs. rear fence, setback requirements, permit thresholds. State-level is sufficient because most municipal codes follow the state pattern with small overrides.", deferrable: "yes — but high-value, this is a question buyers actually search" },
  },
  {
    v: "concrete",
    tmpl: "templates/concrete-city-page-template.html",
    ctxFile: "data/concrete-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does a concrete driveway cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is concrete more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.concrete"], priorState: "new" },
      { id: "mix-for-climate", q: "What concrete mix handles {{CITY}}'s freeze-thaw cycle?", slots: ["climateNote","materialTip"], priorState: "new", note: "Air-entrained concrete is needed in freeze-thaw zones; not needed in mild climates. Strong climate-distinct signal." },
      { id: "best-season", q: "When can concrete be poured in {{CITY}}?", slots: ["seasonNote"], priorState: "new", note: "Concrete has hard temp constraints (40-90°F ideal). seasonNote will give honest per-city answers." },
      { id: "red-flags", q: "What red flags should I watch for hiring a concrete contractor in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "permit", q: "Do I need a permit for concrete work in {{CITY}}, {{STATE}}?", slots: ["STATE_CONCRETE_PERMIT"], priorState: "new", deferrable: true, note: "Driveway permits vary by municipality but state code sets the baseline (typically required for area > some sqft or any street curb cut)." },
    ],
    phaseTwoDataNeeded: { file: "shared-state-permit-data.json", scope: "Same as kitchen/siding/painting — share one file across building-trades verticals", deferrable: "yes" },
  },
  {
    v: "landscaping",
    tmpl: "templates/landscaping-city-page-template.html",
    ctxFile: "data/landscaping-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does landscaping cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is landscaping more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.landscaping"], priorState: "new" },
      { id: "plants-for-zone", q: "What plants thrive in {{CITY}}'s climate?", slots: ["climateNote","materialTip"], priorState: "new", note: "USDA zone + drought/water restriction status — strong city-distinct signal." },
      { id: "best-season", q: "When is the best time for landscaping work in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a landscaper in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "permit-hoa", q: "What permits + HOA rules affect landscaping in {{CITY}}?", slots: ["hoaPrevalence","STATE_LANDSCAPING_PERMIT"], priorState: "kept-from-current-expanded", deferrable: true },
    ],
    phaseTwoDataNeeded: { file: "shared-state-permit-data.json", scope: "Same shared file; landscaping permit baseline (retaining walls > 4ft, grading, drainage)", deferrable: "yes" },
  },
  {
    v: "foundation",
    tmpl: "templates/foundation-city-page-template.html",
    ctxFile: "data/foundation-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does foundation repair cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is foundation repair more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.foundation"], priorState: "new" },
      { id: "soil-climate-issues", q: "What foundation issues are most common in {{CITY}}?", slots: ["climateNote","materialTip"], priorState: "new", note: "Foundation issues are 100% city-soil-driven: TX clay = heave, FL sand = subsidence, North = frost heave. Distinct signal." },
      { id: "best-time", q: "When is the best time for foundation repair in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a foundation contractor in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "engineering-permit", q: "Does {{CITY}}, {{STATE}} require an engineer's report for foundation work?", slots: ["STATE_FOUNDATION_ENGINEER_REQ","STATE_PERMIT_INTRO"], priorState: "new", deferrable: true, note: "Engineer-stamp requirement varies by state — TX/FL/CA require for major repairs, others don't. High-value FAQ." },
    ],
    phaseTwoDataNeeded: { file: "data/foundation-state-data.json", scope: "50 state entries — engineer-stamp requirement, structural permit threshold, common warranty terms", deferrable: "yes — high-value for buyer trust" },
  },
  {
    v: "insulation",
    tmpl: "templates/insulation-city-page-template.html",
    ctxFile: "data/insulation-city-context.json",
    proposed: [
      { id: "cost-in-city", q: "How much does attic insulation cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why is insulation more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.insulation"], priorState: "new" },
      { id: "r-value-target", q: "What R-value does {{CITY}}'s climate need?", slots: ["climateNote","materialTip"], priorState: "new", note: "DOE climate zone maps directly to R-value recommendations — 100% deterministic per city." },
      { id: "best-time", q: "When is the best time to add insulation in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring an insulation contractor in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
      { id: "rebates-tax-credit", q: "What insulation rebates + 25C credit applies in {{CITY}}, {{STATE}}?", slots: ["STATE_UTILITY_REBATES","FEDERAL_25C_INFO"], priorState: "new", deferrable: true, note: "Utility rebates vary heavily by state + utility — shares research scope with HVAC + window." },
    ],
    phaseTwoDataNeeded: { file: "data/utility-rebate-data.json (shared across HVAC/window/insulation)", scope: "50 state entries — top utility rebate program summary per state, IRA 25C reminder, state weatherization assistance program", deferrable: "yes; build once, used by 3 verticals" },
  },
  {
    v: "gutter",
    tmpl: "templates/gutters-city-page-template.html",
    ctxFile: "data/gutter-city-context.json",
    knownBug: "Existing FAQ #3 'How long does a wood gutter last?' is the fence FAQ pasted in — wood gutters are not a real residential product. Fix as part of Phase 3 template rewrite.",
    proposed: [
      { id: "cost-in-city", q: "How much do gutters cost in {{CITY}}?", slots: ["AVG_LOW","AVG_HIGH","costDriverNote-sentence-1"], priorState: "expanded-from-current" },
      { id: "why-cost-differs", q: "Why are gutters more | less expensive in {{CITY}}?", slots: ["costDriverNote","serviceMultipliers.gutter"], priorState: "new" },
      { id: "material-for-climate", q: "What gutter material works best for {{CITY}}'s rainfall + freeze?", slots: ["materialTip","climateNote"], priorState: "new", note: "Replaces the buggy 'wood gutter' FAQ with a real climate-driven question." },
      { id: "best-time", q: "When is the best time to install gutters in {{CITY}}?", slots: ["seasonNote"], priorState: "new" },
      { id: "red-flags", q: "What red flags should I watch for hiring a gutter installer in {{CITY}}?", slots: ["redFlagNote"], priorState: "new" },
    ],
    phaseTwoDataNeeded: { file: null, scope: "NONE — gutters rarely require permits; 5 FAQs sufficient and all city-aware", deferrable: "n/a" },
  },
];

function build(item) {
  const html = fs.readFileSync(path.join(ROOT, item.tmpl), "utf8");
  const currentFAQs = extractFAQs(html);
  const inv = slotInventory(path.join(ROOT, item.ctxFile));

  const unusedRich = inv.slots
    .filter((s) => ["costDriverNote", "redFlagNote"].includes(s.name))
    .map((s) => ({
      field: `${item.ctxFile}#${s.name}`,
      coverage: s.coverage,
      pctUnique: s.pctUnique,
      avgCharLen: s.sampleCharLen,
      currentUseSite: "NONE — populated but never rendered anywhere",
    }));

  return {
    vertical: item.v,
    auditedAt: "2026-05-22",
    auditor: "phase-1-data-gap",
    summary: {
      currentFAQCount: currentFAQs.length,
      proposedFAQCount: item.proposed.length,
      cityDistinctSlotsCurrent: currentFAQs.filter((f) => /\{\{CITY\}\}|\{\{STATE\}\}|\{\{AVG_/.test(f.q + f.a)).length,
      cityDistinctSlotsProposed: item.proposed.length,
      dataGapsNeedingFill: item.proposed.filter((p) => p.deferrable).length,
      contextFileEntries: inv.entries,
      contextFileSlots: inv.slots.map((s) => `${s.name} (${s.coverage}, ${s.pctUnique}% unique)`),
    },
    ctxNote: item.ctxNote || null,
    knownBug: item.knownBug || null,
    currentFAQs,
    proposedFAQs: item.proposed.map((p) => ({
      id: p.id,
      qTemplate: p.q,
      slots: p.slots,
      priorState: p.priorState,
      deferrable: p.deferrable || false,
      note: p.note || null,
    })),
    unusedRichSlotsCurrentlyDormant: unusedRich,
    phaseTwoDataNeeded: item.phaseTwoDataNeeded,
    phaseThreeApproach: {
      templateChange: `Replace ${currentFAQs.length} hardcoded <details class="faq-item"> blocks in ${item.tmpl} with {{${item.v.toUpperCase().replace(/-/g, "_")}_FAQ_BLOCK}} placeholder.`,
      builderChange: `Add build${item.v.replace(/-/g, "")}FAQ(city, state, ctx, stateData) to the vertical's build-pages script, mirroring the local-context pattern.`,
      outputContract: `Returns ${item.proposed.filter(p=>!p.deferrable).length}-${item.proposed.length} <details class="faq-item"> blocks; pure static HTML.`,
    },
  };
}

function main() {
  const outDir = path.join(ROOT, "output", "audits");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const item of VERTICALS) {
    const artifact = build(item);
    const out = path.join(outDir, `tier-b-faq-gaps-${item.v}.json`);
    fs.writeFileSync(out, JSON.stringify(artifact, null, 2));
    written.push({
      v: item.v,
      faqs: artifact.summary.proposedFAQCount,
      gaps: artifact.summary.dataGapsNeedingFill,
      unused: artifact.unusedRichSlotsCurrentlyDormant.length,
      bug: !!artifact.knownBug,
    });
  }
  console.log("VERTICAL".padEnd(14) + " | PROP-FAQ | PHASE2-GAPS | UNUSED-RICH | BUG");
  console.log("-".repeat(65));
  for (const w of written) {
    console.log(
      w.v.padEnd(14) + " | " +
      String(w.faqs).padStart(8) + " | " +
      String(w.gaps).padStart(11) + " | " +
      String(w.unused).padStart(11) + " | " +
      (w.bug ? "yes" : "")
    );
  }
}

main();
