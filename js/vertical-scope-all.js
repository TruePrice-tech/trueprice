// vertical-scope-all.js
// Regex-based structured field extraction for all 20 verticals.
// Each vertical has: scope catalog, brand list, job types, and shared
// extractors for warranty, labor rate, location, line items.

(function () {
  "use strict";

  // ══════════════════════════════════════════════════════════════
  // SHARED EXTRACTORS (used by all verticals)
  // ══════════════════════════════════════════════════════════════

  function extractWarranty(text) {
    // labor:      labor warranty in YEARS (rounded if months/days)
    // laborDays:  raw labor warranty in DAYS when expressed sub-year. Used to
    //             flag suspiciously short labor warranties (e.g. "30-day labor")
    //             that round to 0 years and otherwise vanish.
    var result = { parts: null, labor: null, laborDays: null, text: null };
    var t = String(text || "").replace(/\n/g, " ").replace(/\s+/g, " ");

    var partsMatch = t.match(/(\d+)[- ]*(?:yr|year)s?[- ]*(?:manufacturer|tank|parts?|equipment|compressor|heat exchanger|material|shingle|panel|product|finish|door)\s*(?:warranty|guarantee)/i) ||
                     t.match(/(\d+)[- ]*(?:yr|year)s?[- ]*(?:warranty|guarantee)\s*(?:on\s+)?(?:tank|parts?|manufacturer|equipment|material|shingle|product|door|finish)/i) ||
                     t.match(/(\d+)[- ]*(?:yr|year)s?\s+(?:tank|manufacturer|parts?|material|shingle|non.?prorated)\b/i) ||
                     t.match(/warranty.*?(\d+)\s*(?:yr|year)s?\s*(?:on\s+)?(?:door|parts?|material|product|finish)/i);
    if (partsMatch) result.parts = parseInt(partsMatch[1]);

    var laborMatch = t.match(/(\d+)[- ]*(?:yr|year)s?[- ]*(?:labor|workmanship|installation|craftsmanship)\s*(?:warranty|guarantee)/i) ||
                     t.match(/(\d+)[- ]*(?:yr|year)s?[- ]*(?:warranty|guarantee)\s*(?:on\s+)?(?:labor|workmanship|installation|opener)/i) ||
                     t.match(/(\d+)[- ]*(?:yr|year)s?\s+(?:labor|workmanship)\b/i) ||
                     t.match(/(?:labor|workmanship)\s*(?:warranty|guarantee)\s*:?\s*(\d+)/i) ||
                     t.match(/warranty.*?(\d+)\s*(?:yr|year)s?\s*(?:on\s+)?(?:labor|workmanship|installation|opener)/i);
    if (laborMatch) result.labor = parseInt(laborMatch[1]);

    var onMatch = t.match(/(\d+)[- ]*(?:yr|year)s?[- ]*(?:warranty|guarantee)\s+on\s+\w+/i);
    if (onMatch && !result.parts) result.parts = parseInt(onMatch[1]);

    if (!result.parts && !result.labor) {
      var genericMatch = t.match(/(\d+)\s*(?:yr|year)s?\s*(?:warranty|guarantee)/i);
      if (genericMatch) { result.parts = parseInt(genericMatch[1]); result.text = genericMatch[0]; }
    }

    if (/lifetime\s*(?:warranty|guarantee|transferable)/i.test(t)) {
      if (!result.parts) { result.parts = 99; result.text = "Lifetime warranty"; }
    }

    if (!result.labor) {
      var monthMatch = t.match(/(\d+)\s*(?:month|mo)\s*(?:labor|workmanship|installation)?\s*(?:warranty|guarantee)/i);
      if (monthMatch) {
        var months = parseInt(monthMatch[1]);
        result.labor = months >= 12 ? Math.round(months / 12) : 0;
        result.laborDays = months * 30;
      }
    }

    // Sub-year labor warranties expressed in days: "30-day labor",
    // "90 days on labor", "60-day workmanship guarantee", etc. Industry
    // norm is 1 year+; anything under 90 days is a red flag.
    if (!result.laborDays) {
      var dayMatch = t.match(/(\d+)\s*-?\s*day\s*(?:labor|workmanship|installation|on\s*labor|on\s*workmanship)/i) ||
                     t.match(/(?:labor|workmanship|installation)\s*(?:warranty|guarantee)?\s*:?\s*(\d+)\s*-?\s*days?/i);
      if (dayMatch) {
        var days = parseInt(dayMatch[1]);
        result.laborDays = days;
        if (!result.labor) result.labor = days >= 365 ? Math.round(days / 365) : 0;
      }
    }

    return result;
  }

  function extractLaborRate(text) {
    var t = String(text || "").replace(/\n/g, " ");
    var match = t.match(/\$\s*(\d+(?:\.\d{2})?)\s*\/\s*h(?:ou)?r/i) ||
                t.match(/\$\s*(\d+(?:\.\d{2})?)\s*per\s*hour/i);
    if (match) return parseFloat(match[1]);
    var atMatch = t.match(/(\d+(?:\.\d+)?)\s*hrs?\s*@\s*\$?\s*(\d+(?:\.\d{2})?)/i);
    if (atMatch) return parseFloat(atMatch[2]);
    var laborMatch = t.match(/labor.*?(\d+(?:\.\d+)?)\s*hrs?\s*@\s*\$?\s*(\d+)/i);
    if (laborMatch) return parseFloat(laborMatch[2]);
    return null;
  }

  function extractLaborHours(text) {
    var t = String(text || "").replace(/\n/g, " ");
    var match = t.match(/(\d+(?:\.\d+)?)\s*hrs?\s*(?:@|\bat\b)/i) ||
                t.match(/labor.*?(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)/i) ||
                t.match(/(\d+)\s*(?:techs?|crew|painters?|movers?|plumbers?|electricians?)\s*x\s*(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)/i);
    return match ? parseFloat(match[2] || match[1]) : null;
  }

  // Look for the labor TOTAL on the line (not the rate). Catches plain
  // "Labor: 2.5 hours $325" formats where the rate isn't given but the
  // total is. Used as a fallback when rate * hours can't be computed.
  function extractLaborTotal(text) {
    var t = String(text || "");
    var lines = t.split(/\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // Skip lines that already have a per-hour rate (those are parsed elsewhere)
      if (/\$\s*\d+\s*\/\s*h(?:ou)?r|\$\s*\d+\s*per\s*hour|hrs?\s*@/i.test(line)) continue;
      // "Labor[:]? ... $X" with X >= 100 (avoids matching unit-cost tokens)
      var m = line.match(/\blabor\b(?:[^$]{0,80})\$\s*(\d{2,5}(?:\.\d{2})?)\b/i);
      if (m) {
        var v = parseFloat(m[1]);
        if (v >= 100 && v <= 50000) return v;
      }
    }
    return null;
  }

  function extractLocation(text) {
    var t = String(text || "").replace(/\n/g, " ");
    var match = t.match(/([A-Z][a-zA-Z\s.]+),\s*([A-Z]{2})\s*(\d{5})?/);
    if (match && match[1].trim().length > 2 && !/total|subtotal|amount|price|estimate|plumbing|electric|roofing|heating|service|repair|master|drain/i.test(match[1])) {
      return { city: match[1].trim(), stateCode: match[2], zip: match[3] || null };
    }
    var noComma = t.match(/([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s+([A-Z]{2})\s+(\d{5})/);
    if (noComma && noComma[1].trim().length > 2 && !/total|subtotal|amount|plumbing|electric|roofing/i.test(noComma[1])) {
      return { city: noComma[1].trim(), stateCode: noComma[2], zip: noComma[3] };
    }
    return null;
  }

  function extractLineItems(text) {
    var lines = String(text || "").split("\n");
    var items = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var priceMatch = line.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      if (!priceMatch) continue;
      var amount = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (amount < 1 || amount > 200000) continue;
      if (/^\s*(?:total|subtotal|tax|grand total|balance|amount due)/i.test(line)) continue;
      var desc = line.replace(/\$\s*[\d,.]+/, "").replace(/\s+/g, " ").trim();
      if (desc.length < 3) continue;
      items.push({ description: desc, amount: amount });
    }
    return items;
  }

  // ══════════════════════════════════════════════════════════════
  // PER-VERTICAL SCOPE CATALOGS
  // ══════════════════════════════════════════════════════════════

  var VERTICALS = {

    plumbing: {
      scope: [
        { key: "permit", label: "Permit included", patterns: [/permit/i, /inspection fee/i, /code complian/i] },
        { key: "warranty_parts", label: "Parts warranty", patterns: [/warranty.*(?:part|tank|manufacturer)/i, /manufacturer.*warranty/i, /\d+[- ]*year.*warranty/i] },
        { key: "warranty_labor", label: "Labor warranty", patterns: [/labor.*warranty/i, /workmanship.*warranty/i, /warranty.*workmanship/i, /warranty.*labor/i] },
        { key: "disposal", label: "Old unit disposal", patterns: [/disposal/i, /haul.?(?:away|off)/i, /remove.*old/i, /dispose/i, /old.*(?:remov|haul)/i] },
        { key: "labor_rate", label: "Labor rate disclosed", patterns: [/\$\s*\d+\s*\/\s*h/i, /hrs?\s*@\s*\$/i, /per\s*hour/i] },
        { key: "code_compliance", label: "Code compliance", patterns: [/code req/i, /to code/i, /code complian/i, /up to code/i] },
        { key: "camera_inspection", label: "Camera inspection", patterns: [/camera inspect/i, /video inspect/i, /sewer camera/i] },
        { key: "expansion_tank", label: "Expansion tank", patterns: [/expansion tank/i, /thermal expansion/i] },
        { key: "shutoff_valve", label: "Shut-off valve", patterns: [/shut.?off/i, /ball valve/i, /isolation valve/i] },
        // CA seismic strapping is required by code (CPC §507.2) on all water
        // heater installs. Listed under scope so the comparison flags quotes
        // that omit it for CA addresses.
        { key: "earthquake_straps", label: "Earthquake straps (CA)", patterns: [/earthquake\s*strap/i, /seismic\s*strap/i, /seismic\s*brac/i, /strap\s*(?:water\s*heater|tank)/i] },
        { key: "cleanup", label: "Cleanup included", patterns: [/clean.?up/i, /backfill/i, /restoration/i, /sod patch/i, /site.*clean/i] },
        { key: "pressure_test", label: "Pressure test", patterns: [/pressure test/i, /leak test/i, /air test/i] },
      ],
      brands: [
        { pattern: /rheem/i, brand: "Rheem", tier: "mid" },
        { pattern: /bradford\s*white/i, brand: "Bradford White", tier: "premium" },
        { pattern: /a\.?\s*o\.?\s*smith/i, brand: "A.O. Smith", tier: "mid" },
        { pattern: /rinnai/i, brand: "Rinnai", tier: "premium" },
        { pattern: /navien/i, brand: "Navien", tier: "premium" },
        { pattern: /noritz/i, brand: "Noritz", tier: "premium" },
        { pattern: /bosch/i, brand: "Bosch", tier: "mid" },
        { pattern: /state\s*water/i, brand: "State Water Heaters", tier: "mid" },
        { pattern: /insinkerator/i, brand: "InSinkErator", tier: "mid" },
        { pattern: /roto.?rooter/i, brand: "Roto-Rooter", tier: "franchise" },
        { pattern: /mr\.?\s*rooter/i, brand: "Mr. Rooter", tier: "franchise" },
        { pattern: /moen/i, brand: "Moen", tier: "mid" },
        { pattern: /kohler/i, brand: "Kohler", tier: "premium" },
        { pattern: /delta/i, brand: "Delta", tier: "mid" },
        { pattern: /grohe/i, brand: "Grohe", tier: "premium" },
      ],
      jobTypes: [
        // Most specific first -- "tankless" must beat the generic "water_heater"
        // pattern so a Rinnai/Navien/Noritz quote isn't lumped in with tank
        // installs. extractFields() returns the first match.
        { pattern: /tankless/i, value: "tankless", label: "Tankless Water Heater" },
        { pattern: /heat\s*pump\s*water\s*heater|hpwh|hybrid\s*water\s*heater/i, value: "hpwh", label: "Heat Pump Water Heater" },
        { pattern: /trenchless/i, value: "sewer_trenchless", label: "Trenchless Sewer" },
        { pattern: /sewer\s*line/i, value: "sewer_line", label: "Sewer Line" },
        { pattern: /drain\s*clean/i, value: "drain_cleaning", label: "Drain Cleaning" },
        { pattern: /repipe|re-pipe/i, value: "repipe", label: "Repipe" },
        { pattern: /gas\s*line/i, value: "gas_line", label: "Gas Line" },
        { pattern: /leak\s*repair/i, value: "leak_repair", label: "Leak Repair" },
        { pattern: /water\s*heater.*(?:replac|install|swap)/i, value: "water_heater", label: "Tank Water Heater" },
      ],
    },

    roofing: {
      scope: [
        { key: "tear_off", label: "Tear-off existing", patterns: [/tear.?off/i, /remove existing/i, /strip existing/i, /old.*remov/i, /rip.?off/i] },
        { key: "underlayment", label: "Underlayment", patterns: [/underlayment/i, /felt paper/i, /synthetic underlayment/i, /tiger\s*paw/i, /deck armor/i, /felt\b/i, /30.?lb/i, /15.?lb/i] },
        { key: "ice_shield", label: "Ice & water shield", patterns: [/ice.*water/i, /ice barrier/i, /weatherwatch/i, /storm\s*guard/i, /leak barrier/i, /weatherlock/i] },
        { key: "drip_edge", label: "Drip edge", patterns: [/drip edge/i, /drip\s*edge/i, /eave.*metal/i, /rake.*edge/i] },
        { key: "flashing", label: "Flashing", patterns: [/flashing/i, /step flash/i, /counter flash/i, /wall flash/i, /chimney flash/i, /valley.*flash/i, /apron/i] },
        { key: "ridge_vent", label: "Ridge vent", patterns: [/ridge vent/i, /ventilation/i, /continuous.*vent/i, /attic vent/i, /soffit vent/i, /cobra\s*vent/i, /box vent/i] },
        { key: "ridge_cap", label: "Ridge cap", patterns: [/ridge cap/i, /hip.*cap/i, /timbertex/i, /hip and ridge/i, /seal.?a.?ridge/i, /z.?ridge/i] },
        { key: "starter", label: "Starter strip", patterns: [/starter shingle/i, /starter strip/i, /prostart/i, /starter/i, /weatherblocker/i] },
        { key: "pipe_boots", label: "Pipe boots/vents", patterns: [/pipe boot/i, /roof vent/i, /pipe jack/i, /pipe collar/i, /vent boot/i, /plumbing.*boot/i] },
        { key: "decking", label: "Deck repair", patterns: [/deck(?:ing)?.*repair/i, /deck.*inspect/i, /replace.*(?:plywood|osb)/i, /rotten.*wood/i, /damaged.*deck/i, /wood.*repair/i, /sheathing/i, /roof\s*deck/i] },
        { key: "disposal", label: "Debris disposal", patterns: [/dumpster/i, /debris/i, /haul.?(?:away|off)/i, /disposal/i, /dump fee/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection fee/i, /code.*inspect/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /magnetic sweep/i, /yard clean/i, /site.*clean/i, /nail.*sweep/i] },
        { key: "warranty", label: "Warranty terms", patterns: [/warranty/i, /guarantee/i, /golden pledge/i, /silver pledge/i, /preferred.*protect/i, /system plus/i, /workmanship/i] },
        { key: "property_protection", label: "Property protection", patterns: [/tarp/i, /yard protect/i, /landscap.*protect/i, /gutter.*protect/i, /magnetic.*sweep/i] },
      ],
      brands: [
        // GAF product lines (most popular US manufacturer)
        { pattern: /gaf.*timberline|timberline.*hdz/i, brand: "GAF Timberline HDZ", tier: "mid" },
        { pattern: /gaf.*grand\s*canyon/i, brand: "GAF Grand Canyon", tier: "premium" },
        { pattern: /gaf.*grand\s*sequoia/i, brand: "GAF Grand Sequoia", tier: "premium" },
        { pattern: /gaf.*camelot/i, brand: "GAF Camelot", tier: "premium" },
        { pattern: /\bgaf\b/i, brand: "GAF", tier: "mid" },
        // Owens Corning product lines
        { pattern: /oc.*duration|owens.*duration/i, brand: "OC Duration", tier: "mid" },
        { pattern: /oc.*berkshire|owens.*berkshire/i, brand: "OC Berkshire", tier: "premium" },
        { pattern: /oc.*woodcrest|owens.*woodcrest/i, brand: "OC Woodcrest", tier: "premium" },
        { pattern: /owens\s*corning/i, brand: "Owens Corning", tier: "mid" },
        // CertainTeed product lines
        { pattern: /certainteed.*landmark/i, brand: "CertainTeed Landmark", tier: "mid" },
        { pattern: /certainteed.*grand\s*manor/i, brand: "CertainTeed Grand Manor", tier: "premium" },
        { pattern: /certainteed.*presidential/i, brand: "CertainTeed Presidential", tier: "premium" },
        { pattern: /certainteed/i, brand: "CertainTeed", tier: "mid" },
        // Other manufacturers
        { pattern: /malarkey.*vista/i, brand: "Malarkey Vista", tier: "mid" },
        { pattern: /malarkey.*windsor/i, brand: "Malarkey Windsor", tier: "premium" },
        { pattern: /malarkey/i, brand: "Malarkey", tier: "mid" },
        { pattern: /iko.*cambridge/i, brand: "IKO Cambridge", tier: "budget" },
        { pattern: /iko.*dynasty/i, brand: "IKO Dynasty", tier: "mid" },
        { pattern: /\biko\b/i, brand: "IKO", tier: "budget" },
        { pattern: /tamko.*heritage/i, brand: "TAMKO Heritage", tier: "budget" },
        { pattern: /tamko/i, brand: "TAMKO", tier: "budget" },
        { pattern: /atlas.*pinnacle/i, brand: "Atlas Pinnacle", tier: "mid" },
        { pattern: /atlas.*storm\s*master/i, brand: "Atlas StormMaster", tier: "budget" },
        { pattern: /atlas/i, brand: "Atlas", tier: "budget" },
        // Metal brands
        { pattern: /drexel\s*metal/i, brand: "Drexel Metals", tier: "premium" },
        { pattern: /berridge/i, brand: "Berridge", tier: "premium" },
        { pattern: /mcelroy/i, brand: "McElroy Metal", tier: "premium" },
        { pattern: /mueller/i, brand: "Mueller", tier: "mid" },
      ],
      jobTypes: [
        { pattern: /(?:full|complete)?\s*(?:roof|re-roof)\s*replac/i, value: "full_replacement", label: "Full Replacement" },
        { pattern: /tear.?off.*replac/i, value: "full_replacement", label: "Tear-off & Replace" },
        { pattern: /roof\s*repair/i, value: "repair", label: "Roof Repair" },
        { pattern: /metal\s*roof/i, value: "metal", label: "Metal Roof" },
        { pattern: /flat\s*roof/i, value: "flat", label: "Flat Roof" },
        { pattern: /standing\s*seam/i, value: "standing_seam", label: "Standing Seam Metal" },
        { pattern: /overlay|over.*existing/i, value: "overlay", label: "Overlay / Re-cover" },
      ],
    },

    hvac: {
      scope: [
        { key: "permit", label: "Permit", patterns: [/permit/i, /mechanical permit/i, /inspection/i] },
        { key: "disposal", label: "Old unit disposal", patterns: [/disposal/i, /remove.*old/i, /dispose/i, /old.*remov/i, /haul.?(?:away|off)/i, /reclaim/i] },
        { key: "thermostat", label: "Thermostat", patterns: [/thermostat/i, /ecobee/i, /nest/i, /honeywell/i, /smart.*stat/i] },
        { key: "ductwork", label: "Ductwork", patterns: [/duct/i, /plenum/i, /transition/i, /return air/i, /supply air/i] },
        { key: "refrigerant", label: "Refrigerant", patterns: [/refrigerant/i, /r-?410a/i, /r-?22/i, /r-?32/i, /r-?454b/i, /freon/i, /charge/i] },
        { key: "electrical", label: "Electrical work", patterns: [/disconnect/i, /whip/i, /electrical/i, /wiring/i, /breaker/i] },
        { key: "concrete_pad", label: "Concrete pad", patterns: [/concrete pad/i, /equipment pad/i, /composite pad/i] },
        { key: "flue", label: "Flue/venting", patterns: [/flue/i, /b-vent/i, /venting/i, /exhaust/i, /intake/i] },
        { key: "filter", label: "Filter included", patterns: [/filter/i, /media filter/i, /merv/i] },
        { key: "load_calc", label: "Load calculation", patterns: [/load calc/i, /manual j/i, /sizing/i, /heat loss/i] },
        { key: "line_set", label: "Line set", patterns: [/line set/i, /lineset/i, /refrigerant line/i, /copper line/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /haul.?off/i, /site.*clean/i] },
      ],
      brands: [
        { pattern: /carrier/i, brand: "Carrier", tier: "premium" },
        { pattern: /trane/i, brand: "Trane", tier: "premium" },
        { pattern: /lennox/i, brand: "Lennox", tier: "premium" },
        { pattern: /rheem|ruud/i, brand: "Rheem/Ruud", tier: "mid" },
        { pattern: /goodman|amana/i, brand: "Goodman/Amana", tier: "budget" },
        { pattern: /daikin/i, brand: "Daikin", tier: "premium" },
        { pattern: /mitsubishi/i, brand: "Mitsubishi", tier: "premium" },
        { pattern: /york/i, brand: "York", tier: "mid" },
        { pattern: /american\s*standard/i, brand: "American Standard", tier: "mid" },
      ],
      jobTypes: [
        { pattern: /ac\s*(?:system|unit)?\s*replac/i, value: "ac_replace", label: "AC Replacement" },
        { pattern: /furnace\s*replac/i, value: "furnace_replace", label: "Furnace Replacement" },
        { pattern: /heat\s*pump/i, value: "heat_pump", label: "Heat Pump" },
        { pattern: /mini\s*split/i, value: "mini_split", label: "Mini Split" },
        { pattern: /boiler/i, value: "boiler", label: "Boiler" },
        { pattern: /duct\s*clean/i, value: "duct_cleaning", label: "Duct Cleaning" },
        { pattern: /tune.?up|maintenance/i, value: "tune_up", label: "Tune-Up" },
      ],
    },

    electrical: {
      scope: [
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection/i] },
        { key: "grounding", label: "Grounding", patterns: [/grounding/i, /ground rod/i, /bonding/i, /ground.*bar/i] },
        { key: "afci_gfci", label: "AFCI/GFCI", patterns: [/afci/i, /gfci/i, /arc fault/i, /ground fault/i] },
        { key: "panel", label: "Panel work", patterns: [/panel/i, /breaker box/i, /load center/i, /main.*break/i] },
        { key: "wiring", label: "New wiring", patterns: [/wiring/i, /wire run/i, /romex/i, /nm-b/i, /conduit/i, /circuit/i] },
        { key: "utility_coord", label: "Utility coordination", patterns: [/utility/i, /power company/i, /meter pull/i, /fpl|duke|dominion/i, /meter.*base/i] },
        { key: "code_upgrade", label: "Code upgrade", patterns: [/code upgrade/i, /code complian/i, /nec/i, /to code/i, /code.*req/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /haul.?off/i, /site.*clean/i, /patch.*drywall/i] },
        { key: "labeling", label: "Panel labeling", patterns: [/label/i, /directory/i, /circuit.*label/i] },
      ],
      brands: [
        { pattern: /square\s*d/i, brand: "Square D", tier: "premium" },
        { pattern: /siemens/i, brand: "Siemens", tier: "premium" },
        { pattern: /eaton/i, brand: "Eaton", tier: "mid" },
        { pattern: /ge\b/i, brand: "GE", tier: "mid" },
        { pattern: /leviton/i, brand: "Leviton", tier: "mid" },
        { pattern: /lutron/i, brand: "Lutron", tier: "premium" },
        { pattern: /generac/i, brand: "Generac", tier: "premium" },
        { pattern: /kohler.*generator/i, brand: "Kohler Generator", tier: "premium" },
        { pattern: /chargepoint/i, brand: "ChargePoint", tier: "premium" },
        { pattern: /juicebox/i, brand: "JuiceBox", tier: "mid" },
        { pattern: /grizzl.?e/i, brand: "Grizzl-E", tier: "budget" },
        { pattern: /tesla/i, brand: "Tesla", tier: "premium" },
        { pattern: /emporia/i, brand: "Emporia", tier: "mid" },
      ],
      jobTypes: [
        { pattern: /panel\s*(?:upgrade|replac)/i, value: "panel_upgrade", label: "Panel Upgrade" },
        { pattern: /ev\s*charger|level\s*2|charging\s*station/i, value: "ev_charger", label: "EV Charger" },
        { pattern: /rewire|whole\s*house\s*wire/i, value: "rewire", label: "Rewire" },
        { pattern: /outlet|receptacle/i, value: "outlets", label: "Outlet Work" },
        { pattern: /lighting|light\s*fixture/i, value: "lighting", label: "Lighting" },
        { pattern: /generator/i, value: "generator", label: "Generator" },
      ],
    },

    auto: {
      scope: [
        { key: "parts_warranty", label: "Parts warranty", patterns: [/(?:part|warranty).*(?:\d+\s*(?:month|yr|year|mile))/i, /\d+[- ]*(?:month|yr|year).*warranty/i] },
        { key: "labor_warranty", label: "Labor warranty", patterns: [/labor.*warranty/i, /workmanship/i, /warranty.*labor/i] },
        { key: "diagnostic", label: "Diagnostic fee", patterns: [/diagnostic/i, /inspection fee/i, /check.*fee/i, /diag.*fee/i] },
        { key: "fluid_change", label: "Fluid service", patterns: [/fluid/i, /flush/i, /oil change/i, /coolant/i, /brake fluid/i] },
        { key: "tax_shown", label: "Tax itemized", patterns: [/tax\s*[:$]/i, /sales\s*tax/i, /tax.*\$/i] },
        { key: "shop_supplies", label: "Shop supplies", patterns: [/shop supplies/i, /shop fee/i, /environmental/i, /hazardous/i, /disposal fee/i] },
        { key: "oem_parts", label: "OEM parts", patterns: [/oem/i, /original.*equipment/i, /genuine.*part/i, /dealer.*part/i] },
        { key: "aftermarket", label: "Aftermarket parts", patterns: [/aftermarket/i, /reman/i, /remanufact/i, /rebuilt/i] },
      ],
      brands: [
        { pattern: /honda/i, brand: "Honda", tier: "mid" },
        { pattern: /toyota/i, brand: "Toyota", tier: "mid" },
        { pattern: /ford/i, brand: "Ford", tier: "mid" },
        { pattern: /chevy|chevrolet/i, brand: "Chevrolet", tier: "mid" },
        { pattern: /bmw/i, brand: "BMW", tier: "premium" },
        { pattern: /mercedes|benz/i, brand: "Mercedes-Benz", tier: "premium" },
        { pattern: /jiffy\s*lube/i, brand: "Jiffy Lube", tier: "franchise" },
        { pattern: /midas/i, brand: "Midas", tier: "franchise" },
        { pattern: /firestone/i, brand: "Firestone", tier: "franchise" },
      ],
      jobTypes: [
        { pattern: /brake.*(?:pad|rotor|service|replac)/i, value: "brakes", label: "Brake Service" },
        { pattern: /transmission.*(?:rebuild|replac|repair|service)/i, value: "transmission", label: "Transmission" },
        { pattern: /engine.*(?:repair|replac|rebuild)/i, value: "engine", label: "Engine Work" },
        { pattern: /oil\s*change/i, value: "oil_change", label: "Oil Change" },
        { pattern: /tire.*(?:replac|rotation|balance)/i, value: "tires", label: "Tires" },
        { pattern: /a\/?c.*(?:repair|recharge|service)/i, value: "ac", label: "A/C Service" },
      ],
    },

    solar: {
      scope: [
        { key: "permit", label: "Permit", patterns: [/permit/i, /interconnection/i, /utility.*connect/i, /pto/i, /permission.*operate/i] },
        { key: "monitoring", label: "Monitoring", patterns: [/monitor/i, /enlighten/i, /portal/i, /production.*track/i, /consumption.*monitor/i] },
        { key: "critter_guard", label: "Critter guard", patterns: [/critter.*guard/i, /pigeon.*guard/i, /animal.*guard/i, /mesh.*guard/i, /pest.*guard/i, /skirt/i] },
        { key: "panel_upgrade", label: "Panel upgrade", patterns: [/panel.*upgrade/i, /main.*panel/i, /electrical.*upgrade/i, /200.?amp/i, /service.*upgrade/i, /meter.*socket/i] },
        { key: "tax_credit", label: "Tax credit noted", patterns: [/tax.*credit/i, /\bitc\b/i, /federal.*30/i, /25d/i, /30%.*credit/i] },
        { key: "battery", label: "Battery storage", patterns: [/battery/i, /powerwall/i, /encharge/i, /storage/i, /backup.*power/i, /iq.*battery/i] },
        { key: "racking", label: "Racking/mounting", patterns: [/racking/i, /mounting/i, /ironridge/i, /unirac/i, /quick.*mount/i, /roof.*attach/i, /ground.*mount/i, /tile.*hook/i] },
        { key: "roof_warranty", label: "Roof penetration warranty", patterns: [/roof.*warranty/i, /penetration.*warranty/i, /leak.*warranty/i, /workmanship.*roof/i] },
        { key: "production", label: "Production guarantee", patterns: [/production.*guarant/i, /kwh.*guarant/i, /annual.*production/i, /performance.*guarant/i, /pvwatts/i, /helioscope/i] },
        { key: "net_metering", label: "Net metering", patterns: [/net.*meter/i, /sell.*back/i, /grid.*tied/i, /nem/i, /feed.?in/i, /buyback/i] },
        { key: "warranty", label: "Warranty terms", patterns: [/warranty/i, /guarantee/i, /25.?year/i, /workmanship/i] },
        { key: "structural", label: "Structural assessment", patterns: [/structural/i, /engineering/i, /load.*bearing/i, /stamped.*plan/i, /roof.*assessment/i] },
        { key: "cleanup", label: "Cleanup/disposal", patterns: [/clean.?up/i, /haul.?off/i, /dispos/i, /site.*clean/i] },
      ],
      brands: [
        { pattern: /q\s*cells/i, brand: "Q Cells", tier: "mid" },
        { pattern: /rec\b/i, brand: "REC", tier: "premium" },
        { pattern: /rec.*alpha/i, brand: "REC Alpha", tier: "premium" },
        { pattern: /sunpower/i, brand: "SunPower", tier: "premium" },
        { pattern: /maxeon/i, brand: "Maxeon", tier: "premium" },
        { pattern: /panasonic/i, brand: "Panasonic", tier: "premium" },
        { pattern: /lg.*solar|lg.*neon/i, brand: "LG", tier: "premium" },
        { pattern: /canadian\s*solar/i, brand: "Canadian Solar", tier: "budget" },
        { pattern: /jinko/i, brand: "Jinko Solar", tier: "budget" },
        { pattern: /trina/i, brand: "Trina Solar", tier: "budget" },
        { pattern: /ja\s*solar/i, brand: "JA Solar", tier: "budget" },
        { pattern: /longi|lo.*mo/i, brand: "LONGi", tier: "budget" },
        { pattern: /silfab/i, brand: "Silfab", tier: "mid" },
        { pattern: /hanwha/i, brand: "Hanwha", tier: "budget" },
        { pattern: /risen/i, brand: "Risen", tier: "budget" },
        { pattern: /enphase/i, brand: "Enphase", tier: "premium" },
        { pattern: /solaredge|solar\s*edge/i, brand: "SolarEdge", tier: "mid" },
        { pattern: /fronius/i, brand: "Fronius", tier: "mid" },
        { pattern: /sma\b/i, brand: "SMA", tier: "mid" },
        { pattern: /sungrow/i, brand: "Sungrow", tier: "budget" },
        { pattern: /tesla/i, brand: "Tesla", tier: "premium" },
        { pattern: /powerwall/i, brand: "Tesla Powerwall", tier: "premium" },
        { pattern: /franklin.*wh|franklinwh/i, brand: "FranklinWH", tier: "premium" },
        { pattern: /generac/i, brand: "Generac", tier: "mid" },
        { pattern: /sonnen/i, brand: "Sonnen", tier: "premium" },
      ],
      jobTypes: [
        { pattern: /solar\s*(?:panel|system|install|array)/i, value: "solar_install", label: "Solar Installation" },
        { pattern: /battery/i, value: "battery", label: "Battery Storage" },
        { pattern: /ground\s*mount/i, value: "ground_mount", label: "Ground Mount System" },
        { pattern: /roof\s*mount/i, value: "roof_mount", label: "Roof Mount System" },
        { pattern: /ev.*charg|charger/i, value: "ev_charger", label: "EV Charger Add-on" },
      ],
    },

    moving: {
      scope: [
        { key: "packing", label: "Packing service", patterns: [/packing/i, /pack.*service/i, /full pack/i, /wrap/i] },
        { key: "materials", label: "Packing materials", patterns: [/packing material/i, /boxes/i, /tape.*wrap/i, /blanket/i, /wardrobe box/i, /moving pad/i] },
        { key: "insurance", label: "Insurance/valuation", patterns: [/valuation/i, /insurance/i, /coverage/i, /full replacement/i, /liability/i, /released value/i] },
        { key: "stair_fee", label: "Stair fee", patterns: [/stair/i, /elevator/i, /floor.*fee/i, /carry.*fee/i, /flight/i] },
        { key: "fuel", label: "Fuel charge", patterns: [/fuel/i, /gas.*charge/i, /mileage/i, /travel.*fee/i, /trip.*charge/i] },
        { key: "storage", label: "Storage available", patterns: [/storage/i, /warehouse/i] },
        { key: "disassembly", label: "Disassembly/reassembly", patterns: [/disassembl/i, /reassembl/i, /take apart/i, /put.*together/i] },
        { key: "heavy_items", label: "Heavy item fee", patterns: [/heavy item/i, /piano/i, /safe/i, /bulky/i, /oversize/i] },
        { key: "hourly_rate", label: "Hourly rate disclosed", patterns: [/\$\s*\d+\s*\/\s*h/i, /per\s*hour/i, /hourly.*rate/i, /\$\d+.*hr/i] },
        { key: "binding_estimate", label: "Binding estimate", patterns: [/binding/i, /not.?to.?exceed/i, /guaranteed.*price/i, /fixed.*price/i] },
        { key: "timeline", label: "Delivery timeline", patterns: [/deliver.*date/i, /arrival.*window/i, /pick.?up.*date/i, /timeline/i] },
      ],
      brands: [
        { pattern: /allied/i, brand: "Allied Van Lines", tier: "premium" },
        { pattern: /mayflower/i, brand: "Mayflower", tier: "premium" },
        { pattern: /united.*van/i, brand: "United Van Lines", tier: "premium" },
        { pattern: /north\s*american.*van/i, brand: "North American Van Lines", tier: "premium" },
        { pattern: /two\s*men/i, brand: "Two Men and a Truck", tier: "mid" },
        { pattern: /college.*hunks/i, brand: "College Hunks", tier: "mid" },
        { pattern: /pods/i, brand: "PODS", tier: "mid" },
        { pattern: /u.?pack/i, brand: "U-Pack", tier: "budget" },
        { pattern: /u.?haul/i, brand: "U-Haul", tier: "budget" },
        { pattern: /penske/i, brand: "Penske", tier: "budget" },
        { pattern: /budget.*truck/i, brand: "Budget Truck", tier: "budget" },
      ],
      jobTypes: [
        { pattern: /local\s*mov/i, value: "local", label: "Local Move" },
        { pattern: /long\s*distance|interstate/i, value: "long_distance", label: "Long Distance" },
        { pattern: /office|commercial/i, value: "commercial", label: "Commercial Move" },
        { pattern: /container|portable/i, value: "container", label: "Moving Container" },
        { pattern: /labor.*only|load.*unload/i, value: "labor_only", label: "Labor Only" },
      ],
    },

    painting: {
      scope: [
        { key: "power_wash", label: "Power wash", patterns: [/power wash/i, /pressure wash/i, /soft wash/i] },
        { key: "scraping", label: "Scrape/sand prep", patterns: [/scrap/i, /sand/i, /surface prep/i, /prep.*paint/i, /strip/i] },
        { key: "priming", label: "Primer", patterns: [/prim/i, /prime/i, /stain.?block/i] },
        { key: "caulking", label: "Caulk/wood repair", patterns: [/caulk/i, /wood repair/i, /wood rot/i, /putty/i, /filler/i, /patch/i] },
        { key: "trim", label: "Trim painting", patterns: [/\btrim\b/i, /baseboard/i, /crown/i, /molding/i, /door.*frame/i, /window.*frame/i] },
        { key: "ceiling", label: "Ceiling included", patterns: [/ceiling/i] },
        { key: "two_coats", label: "Two coats", patterns: [/2\s*coat/i, /two coat/i, /double coat/i] },
        { key: "furniture_move", label: "Furniture moved", patterns: [/furniture/i, /move.*furniture/i] },
        { key: "drop_cloth", label: "Drop cloths/protection", patterns: [/drop cloth/i, /protection/i, /masking/i, /\btape\b/i, /cover.*floor/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /daily clean/i, /site.*clean/i] },
        { key: "paint_brand", label: "Paint brand specified", patterns: [/sherwin/i, /benjamin/i, /behr/i, /ppg/i, /valspar/i, /duration/i, /regal/i, /marquee/i, /aura/i, /emerald/i, /farrow/i, /dunn.?edwards/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /\d+.?year.*warrant/i, /workmanship/i] },
        { key: "back_roll", label: "Back-rolling (exterior spray)", patterns: [/back.?roll/i, /back.?brush/i, /roll.*after.*spray/i] },
        { key: "lead_rrp", label: "Lead/RRP disclosure", patterns: [/lead/i, /rrp/i, /epa/i, /pre.?1978/i, /abatement/i] },
      ],
      brands: [
        { pattern: /sherwin.?williams/i, brand: "Sherwin-Williams", tier: "premium" },
        { pattern: /sw\s*duration/i, brand: "SW Duration", tier: "premium" },
        { pattern: /sw\s*emerald/i, brand: "SW Emerald", tier: "ultra" },
        { pattern: /sw\s*superpaint/i, brand: "SW SuperPaint", tier: "mid" },
        { pattern: /sw\s*promar/i, brand: "SW ProMar", tier: "budget" },
        { pattern: /benjamin\s*moore/i, brand: "Benjamin Moore", tier: "premium" },
        { pattern: /bm\s*aura/i, brand: "BM Aura", tier: "ultra" },
        { pattern: /bm\s*regal/i, brand: "BM Regal Select", tier: "premium" },
        { pattern: /bm\s*ben\b/i, brand: "BM Ben", tier: "mid" },
        { pattern: /behr\s*marquee/i, brand: "Behr Marquee", tier: "premium" },
        { pattern: /behr\s*premium/i, brand: "Behr Premium Plus", tier: "mid" },
        { pattern: /behr\s*pro/i, brand: "Behr Pro", tier: "budget" },
        { pattern: /\bbehr\b/i, brand: "Behr", tier: "mid" },
        { pattern: /ppg\s*diamond/i, brand: "PPG Diamond", tier: "mid" },
        { pattern: /ppg\s*manor/i, brand: "PPG Manor Hall", tier: "premium" },
        { pattern: /\bppg\b/i, brand: "PPG", tier: "mid" },
        { pattern: /valspar/i, brand: "Valspar", tier: "budget" },
        { pattern: /dunn.?edwards/i, brand: "Dunn-Edwards", tier: "mid" },
        { pattern: /farrow.*ball/i, brand: "Farrow & Ball", tier: "ultra" },
        { pattern: /fine\s*paints/i, brand: "Fine Paints of Europe", tier: "ultra" },
        { pattern: /\bc2\s*paint/i, brand: "C2 Paint", tier: "ultra" },
        { pattern: /glidden/i, brand: "Glidden", tier: "budget" },
      ],
      jobTypes: [
        { pattern: /interior.*paint/i, value: "interior", label: "Interior Painting" },
        { pattern: /exterior.*paint|exterior.*repaint/i, value: "exterior", label: "Exterior Painting" },
        { pattern: /cabinet/i, value: "cabinets", label: "Cabinet Painting" },
        { pattern: /deck.*stain|stain.*deck/i, value: "deck", label: "Deck Staining" },
        { pattern: /fence.*paint|fence.*stain/i, value: "fence", label: "Fence Painting/Staining" },
        { pattern: /popcorn.*remov|texture.*remov/i, value: "popcorn", label: "Popcorn Ceiling Removal" },
      ],
    },

    fencing: {
      scope: [
        { key: "old_removal", label: "Old fence removal", patterns: [/remov.*(?:old|existing|fence)/i, /tear.*(?:out|down)/i, /old.*(?:remov|haul|demo)/i, /haul.?off/i, /dispos/i] },
        { key: "concrete_posts", label: "Concrete posts", patterns: [/concrete/i, /post.*set/i, /post.*hole/i, /dig.*post/i, /auger/i, /footing/i] },
        { key: "gates", label: "Gates included", patterns: [/gate/i, /walk gate/i, /drive gate/i, /double gate/i] },
        { key: "utility_locate", label: "Utility locate (811)", patterns: [/utility locate/i, /811/i, /call before/i, /underground/i, /locate.*util/i] },
        { key: "survey", label: "Property survey", patterns: [/survey/i, /property line/i, /stake/i, /boundary/i, /plat/i] },
        { key: "stain_seal", label: "Stain/seal", patterns: [/stain/i, /seal/i, /treat/i, /preserv/i, /thompson/i, /water.?proof/i] },
        { key: "hardware", label: "Hardware/hinges", patterns: [/hardware/i, /hinge/i, /latch/i, /lock/i, /post cap/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection/i, /code.*complian/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /haul.?off/i, /debris/i, /site.*clean/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /workmanship/i, /\d+.?year/i] },
        { key: "post_depth", label: "Post depth specified", patterns: [/post.*depth/i, /\d+.*inch.*deep/i, /\d+.*feet.*deep/i, /frost.*line/i, /below.*grade/i] },
      ],
      brands: [
        // Vinyl/PVC brands
        { pattern: /bufftech/i, brand: "CertainTeed Bufftech", tier: "premium" },
        { pattern: /certainteed/i, brand: "CertainTeed", tier: "premium" },
        { pattern: /veranda/i, brand: "Veranda (Home Depot)", tier: "mid" },
        { pattern: /activeyards/i, brand: "ActiveYards", tier: "mid" },
        { pattern: /freedom.*fence/i, brand: "Freedom (Lowe's)", tier: "mid" },
        { pattern: /wambam/i, brand: "WamBam", tier: "budget" },
        // Aluminum/ornamental brands
        { pattern: /ameristar/i, brand: "Ameristar", tier: "premium" },
        { pattern: /jerith/i, brand: "Jerith", tier: "premium" },
        { pattern: /specrail/i, brand: "Specrail", tier: "mid" },
        { pattern: /ultra.*aluminum/i, brand: "Ultra Aluminum", tier: "mid" },
        // Composite brands
        { pattern: /trex.*fence|trex.*seclusion/i, brand: "Trex Seclusions", tier: "premium" },
        { pattern: /barrette/i, brand: "Barrette Outdoor Living", tier: "mid" },
        { pattern: /simtek/i, brand: "SimTek", tier: "mid" },
        // Wood treatment brands
        { pattern: /western red cedar/i, brand: "Western Red Cedar", tier: "premium" },
        { pattern: /pressure.?treat/i, brand: "Pressure-Treated Pine", tier: "budget" },
      ],
      jobTypes: [
        { pattern: /wood.*(?:fence|privacy)/i, value: "wood_privacy", label: "Wood Privacy Fence" },
        { pattern: /cedar/i, value: "cedar", label: "Cedar Fence" },
        { pattern: /chain\s*link/i, value: "chain_link", label: "Chain Link" },
        { pattern: /vinyl.*fence|pvc.*fence/i, value: "vinyl", label: "Vinyl Fence" },
        { pattern: /aluminum.*fence|ornamental/i, value: "aluminum", label: "Aluminum Fence" },
        { pattern: /iron.*fence|wrought/i, value: "iron", label: "Iron Fence" },
        { pattern: /composite.*fence/i, value: "composite", label: "Composite Fence" },
        { pattern: /pool.*fence/i, value: "pool", label: "Pool Fence" },
        { pattern: /split.*rail/i, value: "split_rail", label: "Split Rail" },
        { pattern: /picket/i, value: "picket", label: "Picket Fence" },
      ],
    },

    concrete: {
      scope: [
        { key: "demo", label: "Demo/removal", patterns: [/demo/i, /remov.*(?:existing|old|concrete)/i, /tear out/i, /old.*(?:remov|haul)/i, /haul.?off/i] },
        { key: "grading", label: "Grading/compaction", patterns: [/grad/i, /compact/i, /subbase/i, /gravel base/i, /base prep/i, /level/i] },
        { key: "rebar", label: "Rebar/reinforcement", patterns: [/rebar/i, /reinforc/i, /wire mesh/i, /fiber mesh/i] },
        { key: "forms", label: "Forms", patterns: [/form/i, /forming/i, /formwork/i] },
        { key: "sealer", label: "Sealer", patterns: [/seal/i, /sealer/i, /acrylic seal/i, /curing.*compound/i, /cur.*seal/i] },
        { key: "expansion_joints", label: "Expansion joints", patterns: [/expansion joint/i, /control joint/i, /cut joint/i, /saw cut/i] },
        { key: "stamped", label: "Stamped/decorative", patterns: [/stamp/i, /decorative/i, /pattern/i, /color/i, /stain/i, /broom finish/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /haul.?off/i, /site.*clean/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /workmanship/i] },
        { key: "air_entrained", label: "Air-entrained mix", patterns: [/air.?entrain/i, /freeze.?thaw/i, /winter.*mix/i] },
      ],
      brands: [
        { pattern: /quikrete/i, brand: "Quikrete", tier: "mid" },
        { pattern: /sakrete/i, brand: "Sakrete", tier: "mid" },
        { pattern: /bomanite/i, brand: "Bomanite", tier: "premium" },
      ],
      jobTypes: [
        { pattern: /driveway/i, value: "driveway", label: "Driveway" },
        { pattern: /patio/i, value: "patio", label: "Patio" },
        { pattern: /sidewalk/i, value: "sidewalk", label: "Sidewalk" },
        { pattern: /foundation/i, value: "foundation", label: "Foundation" },
        { pattern: /stamp/i, value: "stamped", label: "Stamped Concrete" },
        { pattern: /retaining.*wall/i, value: "retaining", label: "Retaining Wall" },
        { pattern: /curb/i, value: "curb", label: "Curb/Gutter" },
      ],
    },

    foundation: {
      scope: [
        { key: "piers", label: "Piers/pilings", patterns: [/pier/i, /piling/i, /push pier/i, /helical/i, /underpinning/i] },
        { key: "lift", label: "Hydraulic lift", patterns: [/hydraulic/i, /lift/i, /re.?level/i, /raise/i] },
        { key: "excavation", label: "Excavation", patterns: [/excavat/i, /dig/i, /trench/i] },
        { key: "cleanup", label: "Cleanup/grading", patterns: [/cleanup/i, /clean.?up/i, /haul.?off/i, /grade.*restor/i, /backfill/i, /site.*clean/i] },
        { key: "crack_repair", label: "Crack repair", patterns: [/crack.*repair/i, /epoxy.*inject/i, /carbon fiber/i, /polyurethane/i] },
        { key: "waterproof", label: "Waterproofing", patterns: [/waterproof/i, /membrane/i, /drainage/i, /french drain/i, /drain.*assess/i, /sump/i] },
        { key: "engineering", label: "Engineering report", patterns: [/engineer/i, /structural.*report/i, /inspection.*report/i] },
        { key: "transferable", label: "Transferable warranty", patterns: [/transferable/i, /transfer.*warranty/i] },
        { key: "permit", label: "Permit included", patterns: [/permit/i, /inspection.*coord/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /lifetime/i, /\d+.?year/i] },
      ],
      brands: [
        { pattern: /ram\s*jack/i, brand: "Ram Jack", tier: "premium" },
        { pattern: /olshan/i, brand: "Olshan", tier: "premium" },
        { pattern: /basement\s*systems/i, brand: "Basement Systems", tier: "premium" },
        { pattern: /foundation.*works/i, brand: "Foundation Works", tier: "mid" },
        { pattern: /terrafirma/i, brand: "TerraFirma", tier: "mid" },
        { pattern: /supportworks/i, brand: "Supportworks", tier: "premium" },
      ],
      jobTypes: [
        { pattern: /pier|piling|underpinning/i, value: "piering", label: "Pier Installation" },
        { pattern: /crack.*repair/i, value: "crack_repair", label: "Crack Repair" },
        { pattern: /waterproof/i, value: "waterproofing", label: "Waterproofing" },
        { pattern: /mudjack|slab.*jack|polyjack/i, value: "mudjacking", label: "Mudjacking/Polyjacking" },
        { pattern: /crawl.*space/i, value: "crawlspace", label: "Crawl Space Repair" },
        { pattern: /basement.*repair/i, value: "basement", label: "Basement Repair" },
      ],
    },

    gutters: {
      scope: [
        { key: "old_removal", label: "Old gutter removal", patterns: [/remov.*(?:old|existing|gutter)/i, /old.*(?:gutter|removal|haul)/i, /gutter.*remov/i, /haul.?off/i, /tear.?off/i, /demo/i] },
        { key: "downspouts", label: "Downspouts", patterns: [/downspout/i, /leader/i, /elbow/i] },
        { key: "guards", label: "Gutter guards", patterns: [/guard/i, /leaf guard/i, /screen/i, /helmet/i, /cover/i, /micro.?mesh/i, /leaffilter/i] },
        { key: "fascia", label: "Fascia inspection", patterns: [/fascia/i, /fascia.*inspect/i, /fascia.*repair/i, /soffit/i] },
        { key: "seamless", label: "Seamless", patterns: [/seamless/i, /on.?site.*fabrica/i, /formed on.?site/i, /continuous/i] },
        { key: "hangers", label: "Hidden hangers", patterns: [/hanger/i, /hidden hanger/i, /bracket/i, /every\s+\d+/i] },
        { key: "splash_blocks", label: "Splash blocks/extensions", patterns: [/splash/i, /extension/i, /diverter/i] },
        { key: "gauge", label: "Gauge specified", patterns: [/0\.0\d+.*gauge/i, /gauge.*0\.0\d+/i, /\d+\s*gauge/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /lifetime/i, /workmanship/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /haul.?off/i, /debris/i] },
      ],
      brands: [
        { pattern: /leaffilter/i, brand: "LeafFilter", tier: "premium" },
        { pattern: /leaf\s*guard/i, brand: "LeafGuard", tier: "premium" },
        { pattern: /gutter\s*helmet/i, brand: "Gutter Helmet", tier: "premium" },
        { pattern: /alcoa/i, brand: "Alcoa", tier: "mid" },
        { pattern: /rain\s*gutter/i, brand: "Rain Gutter", tier: "mid" },
        { pattern: /mastershield/i, brand: "MasterShield", tier: "premium" },
      ],
      jobTypes: [
        { pattern: /gutter.*(?:install|replac)/i, value: "install", label: "Gutter Installation" },
        { pattern: /gutter.*repair/i, value: "repair", label: "Gutter Repair" },
        { pattern: /gutter.*clean/i, value: "cleaning", label: "Gutter Cleaning" },
        { pattern: /gutter.*guard/i, value: "guards", label: "Gutter Guard Installation" },
      ],
    },

    insulation: {
      scope: [
        { key: "air_sealing", label: "Air sealing", patterns: [/air seal/i, /seal.*penetrat/i, /foam.*seal/i, /top plate/i, /can light/i] },
        { key: "baffles", label: "Baffles", patterns: [/baffle/i, /soffit vent/i, /rafter vent/i, /ventilation.*\d+/i] },
        { key: "vapor_barrier", label: "Vapor barrier", patterns: [/vapor barrier/i, /moisture barrier/i] },
        { key: "removal", label: "Old insulation removal", patterns: [/remov.*(?:old|existing).*insul/i, /insul.*remov/i] },
        { key: "rebate", label: "Rebate eligible", patterns: [/rebate/i, /incentive/i, /tax credit/i, /utility rebate/i, /eligible/i] },
        { key: "cleanup", label: "Cleanup/disposal", patterns: [/cleanup/i, /clean.?up/i, /disposal/i, /haul/i] },
        { key: "hatch", label: "Hatch insulation", patterns: [/hatch/i, /attic.*access/i, /attic.*door/i] },
        { key: "energy_audit", label: "Energy audit", patterns: [/energy.*audit/i, /energy.*assess/i, /blower.*door/i] },
      ],
      brands: [
        { pattern: /owens\s*corning/i, brand: "Owens Corning", tier: "premium" },
        { pattern: /johns\s*manville/i, brand: "Johns Manville", tier: "mid" },
        { pattern: /knauf/i, brand: "Knauf", tier: "mid" },
        { pattern: /certainteed/i, brand: "CertainTeed", tier: "premium" },
      ],
      jobTypes: [
        { pattern: /attic.*insul/i, value: "attic", label: "Attic Insulation" },
        { pattern: /wall.*insul/i, value: "wall", label: "Wall Insulation" },
        { pattern: /spray\s*foam/i, value: "spray_foam", label: "Spray Foam" },
        { pattern: /blown.?in/i, value: "blown_in", label: "Blown-In" },
      ],
    },

    kitchen: {
      scope: [
        { key: "demo", label: "Demo included", patterns: [/demo/i, /demolition/i, /tear.*out/i] },
        { key: "cabinets", label: "Cabinets", patterns: [/cabinet/i] },
        { key: "countertops", label: "Countertops", patterns: [/counter/i, /granite/i, /quartz/i, /marble/i, /butcher.*block/i, /quartzite/i] },
        { key: "backsplash", label: "Backsplash", patterns: [/backsplash/i, /tile.*splash/i] },
        { key: "flooring", label: "Flooring", patterns: [/floor/i, /lvp/i, /tile.*floor/i, /hardwood/i] },
        { key: "plumbing", label: "Plumbing work", patterns: [/plumbing/i, /sink.*install/i, /dishwasher/i, /garbage.*dispos/i, /faucet/i] },
        { key: "electrical", label: "Electrical work", patterns: [/electrical/i, /outlet/i, /lighting/i, /led/i, /under.*cabinet.*light/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i] },
        { key: "appliances", label: "Appliances", patterns: [/appliance/i, /refrigerat/i, /range\b/i, /oven/i, /microwave/i, /dishwasher/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /workmanship/i] },
      ],
      brands: [
        // Cabinets
        { pattern: /kraftmaid/i, brand: "KraftMaid", tier: "mid" },
        { pattern: /thomasville/i, brand: "Thomasville", tier: "mid" },
        { pattern: /hampton\s*bay/i, brand: "Hampton Bay", tier: "budget" },
        { pattern: /ikea/i, brand: "IKEA", tier: "budget" },
        // Countertops
        { pattern: /cambria/i, brand: "Cambria", tier: "premium" },
        { pattern: /caesarstone/i, brand: "Caesarstone", tier: "premium" },
        { pattern: /silestone/i, brand: "Silestone", tier: "mid" },
        // Appliances
        { pattern: /kitchenaid/i, brand: "KitchenAid", tier: "mid" },
        { pattern: /bosch/i, brand: "Bosch", tier: "premium" },
        { pattern: /sub.?zero/i, brand: "Sub-Zero", tier: "luxury" },
        { pattern: /wolf\b/i, brand: "Wolf", tier: "luxury" },
        { pattern: /viking/i, brand: "Viking", tier: "luxury" },
        { pattern: /thermador/i, brand: "Thermador", tier: "luxury" },
        { pattern: /samsung/i, brand: "Samsung", tier: "mid" },
        { pattern: /whirlpool/i, brand: "Whirlpool", tier: "budget" },
      ],
      jobTypes: [
        { pattern: /kitchen.*remodel/i, value: "full_remodel", label: "Full Kitchen Remodel" },
        { pattern: /cabinet.*(?:replac|refac)/i, value: "cabinets", label: "Cabinet Work" },
        { pattern: /counter.*(?:replac|install)/i, value: "countertops", label: "Countertop Installation" },
        { pattern: /backsplash/i, value: "backsplash", label: "Backsplash" },
        { pattern: /floor.*(?:replac|install)/i, value: "flooring", label: "Flooring" },
      ],
    },

    siding: {
      scope: [
        { key: "old_removal", label: "Old siding removal", patterns: [/remov.*(?:old|existing|siding)/i, /tear.*(?:off|out)/i, /old.*(?:remov|haul)/i, /haul.?off/i, /demo/i] },
        { key: "insulation", label: "Insulation board", patterns: [/insulation board/i, /fanfold/i, /foam board/i, /rigid insul/i] },
        { key: "soffit_fascia", label: "Soffit/fascia", patterns: [/soffit/i, /fascia/i] },
        { key: "trim_wrap", label: "Trim wrap", patterns: [/trim.*wrap/i, /window.*wrap/i, /aluminum.*wrap/i, /j.?channel/i, /capping/i] },
        { key: "housewrap", label: "House wrap", patterns: [/house\s*wrap/i, /tyvek/i, /weather.*barrier/i, /moisture.*barrier/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /haul.?off/i, /site.*clean/i, /debris/i] },
        { key: "flashing", label: "Flashing", patterns: [/flashing/i, /z.?flash/i, /kickout/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /lifetime/i, /workmanship/i] },
        { key: "caulking", label: "Caulking/sealing", patterns: [/caulk/i, /seal/i] },
      ],
      brands: [
        { pattern: /certainteed/i, brand: "CertainTeed", tier: "premium" },
        { pattern: /james\s*hardie/i, brand: "James Hardie", tier: "premium" },
        { pattern: /hardie.*plank/i, brand: "HardiePlank", tier: "premium" },
        { pattern: /lp\s*smartside/i, brand: "LP SmartSide", tier: "mid" },
        { pattern: /alside/i, brand: "Alside", tier: "mid" },
        { pattern: /ply\s*gem/i, brand: "Ply Gem", tier: "mid" },
        { pattern: /mastic/i, brand: "Mastic (Ply Gem)", tier: "mid" },
        { pattern: /norandex/i, brand: "Norandex", tier: "budget" },
        { pattern: /royal\s*building/i, brand: "Royal Building Products", tier: "mid" },
        { pattern: /kaycan/i, brand: "Kaycan", tier: "mid" },
      ],
      jobTypes: [
        { pattern: /vinyl\s*siding/i, value: "vinyl", label: "Vinyl Siding" },
        { pattern: /fiber\s*cement|hardie/i, value: "fiber_cement", label: "Fiber Cement" },
        { pattern: /wood\s*siding/i, value: "wood", label: "Wood Siding" },
        { pattern: /engineered.*wood|smartside/i, value: "engineered", label: "Engineered Wood" },
        { pattern: /stucco/i, value: "stucco", label: "Stucco" },
        { pattern: /stone.*veneer/i, value: "stone_veneer", label: "Stone Veneer" },
      ],
    },

    windows: {
      scope: [
        { key: "trim", label: "Trim/capping", patterns: [/\btrim\b/i, /\bcasing\b/i, /molding/i, /capping/i, /\bwrap\b/i, /j.?channel/i, /brick\s*mold/i] },
        { key: "caulk", label: "Caulk/insulation", patterns: [/caulk/i, /foam.*insul/i, /spray foam/i, /weather\s*strip/i, /sealant/i] },
        { key: "haul_away", label: "Old window removal", patterns: [/haul.?(?:away|off)/i, /remov.*old/i, /dispos/i, /old.*remov/i, /demo/i, /tear.?out/i] },
        { key: "low_e", label: "Low-E glass", patterns: [/low.?e/i, /low emissivity/i, /lo.?e/i] },
        { key: "argon", label: "Argon filled", patterns: [/argon/i, /gas.?fill/i, /krypton/i] },
        { key: "energy_star", label: "Energy Star", patterns: [/energy\s*star/i, /u.?factor/i, /shgc/i, /nfrc/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection fee/i, /code complian/i] },
        { key: "cleanup", label: "Cleanup", patterns: [/clean.?up/i, /site.*clean/i] },
        { key: "screens", label: "Screens included", patterns: [/\bscreen/i, /bug screen/i, /full\s*screen/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /limited lifetime/i, /year.*warrant/i, /\d+.?yr/i] },
        { key: "install_method", label: "Install method specified", patterns: [/pocket/i, /\binsert\b/i, /full.?frame/i, /retrofit/i, /tear.?out.*frame/i, /new.*construction/i] },
        { key: "glass_package", label: "Glass package specified", patterns: [/double.?pane/i, /triple.?pane/i, /dual.?pane/i, /insulated glass/i, /\bIGU\b/i] },
        { key: "flashing", label: "Flashing/waterproofing", patterns: [/flash/i, /pan.*flash/i, /water.*proofing/i, /drip cap/i] },
        { key: "grilles", label: "Grilles/grids", patterns: [/grill/i, /grid/i, /\bGBG\b/i, /\bSDL\b/i, /between.?glass/i, /muntin/i] },
      ],
      brands: [
        { pattern: /pella/i, brand: "Pella", tier: "premium" },
        { pattern: /andersen/i, brand: "Andersen", tier: "premium" },
        { pattern: /renewal\s*by/i, brand: "Renewal by Andersen", tier: "luxury" },
        { pattern: /marvin/i, brand: "Marvin", tier: "premium" },
        { pattern: /\bultimate\b/i, brand: "Marvin Ultimate", tier: "premium" },
        { pattern: /\belevate\b/i, brand: "Marvin Elevate", tier: "premium" },
        { pattern: /\bessential\b/i, brand: "Marvin Essential", tier: "mid" },
        { pattern: /milgard/i, brand: "Milgard", tier: "mid" },
        { pattern: /jeld.?wen/i, brand: "JELD-WEN", tier: "mid" },
        { pattern: /simonton/i, brand: "Simonton", tier: "budget" },
        { pattern: /window\s*world/i, brand: "Window World", tier: "budget" },
        { pattern: /champion/i, brand: "Champion", tier: "premium" },
        { pattern: /provia/i, brand: "ProVia", tier: "premium" },
        { pattern: /soft.?lite/i, brand: "Soft-Lite", tier: "premium" },
        { pattern: /alside/i, brand: "Alside", tier: "mid" },
      ],
      jobTypes: [
        { pattern: /window.*replac/i, value: "replacement", label: "Window Replacement" },
        { pattern: /new.*construct/i, value: "new_construction", label: "New Construction" },
        { pattern: /(?:single|double)\s*hung/i, value: "hung", label: "Hung Window" },
        { pattern: /casement/i, value: "casement", label: "Casement Window" },
        { pattern: /awning/i, value: "awning", label: "Awning Window" },
        { pattern: /bay.*window|bow.*window/i, value: "bay_bow", label: "Bay/Bow Window" },
        { pattern: /french.*door|patio.*door/i, value: "french_door", label: "French/Patio Door" },
        { pattern: /sliding.*(?:door|window)/i, value: "sliding", label: "Sliding Window/Door" },
      ],
    },

    "garage-door": {
      scope: [
        { key: "old_removal", label: "Old door removal", patterns: [/remov.*(?:old|existing|door)/i, /old.*(?:remov|haul|door)/i, /haul.?off/i, /demo/i, /dispos/i] },
        { key: "opener", label: "Opener included", patterns: [/opener/i, /liftmaster/i, /chamberlain/i, /genie/i] },
        { key: "tracks", label: "New tracks/hardware", patterns: [/track/i, /hardware/i, /roller/i, /hinge/i] },
        { key: "springs", label: "Springs", patterns: [/spring/i, /torsion/i, /cycle/i] },
        { key: "weather_seal", label: "Weather seal", patterns: [/weather.*sea/i, /bottom seal/i, /threshold/i] },
        { key: "insulated", label: "Insulated door", patterns: [/insulat/i, /r.?value/i, /polyurethane/i, /polystyrene/i] },
        { key: "wifi", label: "WiFi/smart", patterns: [/wi.?fi/i, /smart/i, /myq/i, /app.*control/i, /keypad/i, /remote/i] },
        { key: "safety", label: "Safety inspection", patterns: [/safety.*inspect/i, /tune.?up/i, /safety.*test/i, /photo.*eye/i, /auto.*reverse/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /lifetime/i, /\d+.?year/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection/i] },
      ],
      brands: [
        { pattern: /clopay/i, brand: "Clopay", tier: "premium" },
        { pattern: /amarr/i, brand: "Amarr", tier: "mid" },
        { pattern: /wayne\s*dalton/i, brand: "Wayne Dalton", tier: "mid" },
        { pattern: /liftmaster/i, brand: "LiftMaster", tier: "premium" },
        { pattern: /chamberlain/i, brand: "Chamberlain", tier: "mid" },
        { pattern: /genie/i, brand: "Genie", tier: "mid" },
        { pattern: /haas\s*door/i, brand: "Haas Door", tier: "premium" },
        { pattern: /c\.?h\.?i/i, brand: "C.H.I.", tier: "mid" },
        { pattern: /martin.*door/i, brand: "Martin Door", tier: "mid" },
        { pattern: /overhead\s*door/i, brand: "Overhead Door", tier: "premium" },
      ],
      jobTypes: [
        { pattern: /garage.*door.*(?:replac|install)/i, value: "replacement", label: "Door Replacement" },
        { pattern: /opener.*(?:replac|install)/i, value: "opener", label: "Opener Installation" },
        { pattern: /spring.*(?:replac|repair)/i, value: "spring", label: "Spring Repair" },
        { pattern: /panel.*(?:replac|repair)/i, value: "panel", label: "Panel Replacement" },
        { pattern: /tune.?up|maintenance/i, value: "tuneup", label: "Tune-Up/Maintenance" },
      ],
    },

    medical: {
      scope: [
        { key: "insurance_adj", label: "Insurance adjustment", patterns: [/adjust/i, /allowed amount/i, /negotiated rate/i] },
        { key: "copay", label: "Copay shown", patterns: [/copay/i, /co-pay/i] },
        { key: "deductible", label: "Deductible", patterns: [/deductible/i] },
        { key: "itemized", label: "Itemized charges", patterns: [/itemiz/i, /line item/i, /breakdown/i] },
      ],
      brands: [],
      jobTypes: [
        { pattern: /emergency|er\s*visit/i, value: "er", label: "Emergency Room" },
        { pattern: /surgery|surgical/i, value: "surgery", label: "Surgery" },
        { pattern: /lab|blood\s*work/i, value: "lab", label: "Lab Work" },
        { pattern: /imaging|ct\s*scan|mri|x-ray/i, value: "imaging", label: "Imaging" },
      ],
    },

    legal: {
      scope: [
        { key: "hourly_rate", label: "Hourly rate stated", patterns: [/\$\s*\d+\s*\/\s*h/i, /per\s*hour/i, /hourly.*rate/i] },
        { key: "retainer", label: "Retainer", patterns: [/retainer/i, /deposit/i] },
        { key: "filing_fees", label: "Filing fees", patterns: [/filing fee/i, /court fee/i, /filing cost/i] },
        { key: "itemized_time", label: "Time entries itemized", patterns: [/\d+\.\d+\s*(?:hrs?|hours?)/i] },
      ],
      brands: [],
      jobTypes: [
        { pattern: /estate\s*plan/i, value: "estate_planning", label: "Estate Planning" },
        { pattern: /trust/i, value: "trust", label: "Trust Administration" },
        { pattern: /divorce|family\s*law/i, value: "family_law", label: "Family Law" },
        { pattern: /personal\s*injury/i, value: "personal_injury", label: "Personal Injury" },
        { pattern: /real\s*estate|closing/i, value: "real_estate", label: "Real Estate" },
        { pattern: /criminal|defense/i, value: "criminal", label: "Criminal Defense" },
      ],
    },

    landscaping: {
      scope: [
        { key: "soil_prep", label: "Soil prep/amendment", patterns: [/soil.*prep/i, /topsoil/i, /compost/i, /amend/i, /soil.*test/i] },
        { key: "grading", label: "Grading/drainage", patterns: [/grad/i, /drain/i, /slope/i, /french drain/i, /swale/i, /dry.*well/i] },
        { key: "base_material", label: "Base material", patterns: [/gravel.*base/i, /crushed.*stone/i, /compacted.*base/i, /sub.?base/i] },
        { key: "edging", label: "Edging/borders", patterns: [/edg/i, /border/i, /paver.*restraint/i, /curbing/i] },
        { key: "irrigation", label: "Irrigation/sprinkler", patterns: [/irrigat/i, /sprinkler/i, /drip.*line/i, /zone/i, /backflow/i, /rain.*sensor/i] },
        { key: "lighting", label: "Landscape lighting", patterns: [/light/i, /low.?voltage/i, /led.*landscape/i, /path.*light/i, /fixture/i] },
        { key: "plants", label: "Plants/trees/shrubs", patterns: [/plant/i, /tree/i, /shrub/i, /perennial/i, /annual/i, /ground.*cover/i, /native/i] },
        { key: "mulch", label: "Mulch/rock", patterns: [/mulch/i, /decorat.*rock/i, /river.*rock/i, /pea.*gravel/i, /bark/i] },
        { key: "sod", label: "Sod/turf", patterns: [/\bsod\b/i, /turf/i, /bermuda/i, /zoysia/i, /fescue/i, /st.*augustine/i, /hydroseed/i] },
        { key: "permit", label: "Permit", patterns: [/permit/i, /inspection/i, /code.*complian/i] },
        { key: "cleanup", label: "Cleanup/haul-off", patterns: [/clean.?up/i, /haul.?off/i, /debris/i, /site.*clean/i, /leaf.*remov/i] },
        { key: "warranty", label: "Warranty", patterns: [/warranty/i, /guarantee/i, /plant.*warrant/i, /workmanship/i] },
        { key: "design", label: "Design plan", patterns: [/design/i, /layout/i, /plan/i, /render/i, /blueprint/i] },
      ],
      brands: [
        // Paver brands
        { pattern: /belgard/i, brand: "Belgard", tier: "mid" },
        { pattern: /techo.?bloc/i, brand: "Techo-Bloc", tier: "premium" },
        { pattern: /unilock/i, brand: "Unilock", tier: "premium" },
        { pattern: /cambridge.*paver/i, brand: "Cambridge Pavers", tier: "mid" },
        { pattern: /pavestone/i, brand: "Pavestone", tier: "budget" },
        // Retaining wall brands
        { pattern: /allan.*block/i, brand: "Allan Block", tier: "mid" },
        { pattern: /keystone/i, brand: "Keystone", tier: "mid" },
        { pattern: /versa.?lok/i, brand: "Versa-Lok", tier: "premium" },
        // Artificial turf brands
        { pattern: /foreverlawn/i, brand: "ForeverLawn", tier: "premium" },
        { pattern: /synlawn/i, brand: "SYNLawn", tier: "premium" },
        { pattern: /fieldturf/i, brand: "FieldTurf", tier: "mid" },
        // Irrigation brands
        { pattern: /rachio/i, brand: "Rachio", tier: "premium" },
        { pattern: /hunter/i, brand: "Hunter", tier: "mid" },
        { pattern: /rain\s*bird/i, brand: "Rain Bird", tier: "mid" },
        // Outdoor structure brands
        { pattern: /trex/i, brand: "Trex", tier: "premium" },
        { pattern: /timbertech|azek/i, brand: "TimberTech/Azek", tier: "premium" },
      ],
      jobTypes: [
        { pattern: /maintenance|weekly.*mow/i, value: "maintenance", label: "Lawn Maintenance" },
        { pattern: /landscape.*(?:design|install)/i, value: "install", label: "Landscape Installation" },
        { pattern: /hardscape|patio|walkway/i, value: "hardscape", label: "Hardscaping" },
        { pattern: /retaining.*wall/i, value: "retaining_wall", label: "Retaining Wall" },
        { pattern: /irrigation|sprinkler/i, value: "irrigation", label: "Irrigation" },
        { pattern: /tree.*(?:remov|trim|service)/i, value: "tree_service", label: "Tree Service" },
        { pattern: /artificial.*turf|fake.*grass/i, value: "turf", label: "Artificial Turf" },
        { pattern: /outdoor.*kitchen/i, value: "outdoor_kitchen", label: "Outdoor Kitchen" },
        { pattern: /fire.*pit|fireplace/i, value: "fire_pit", label: "Fire Pit / Fireplace" },
        { pattern: /pergola|gazebo|arbor/i, value: "pergola", label: "Pergola / Gazebo" },
        { pattern: /french.*drain/i, value: "french_drain", label: "French Drain" },
        { pattern: /sod.*install/i, value: "sod", label: "Sod Installation" },
      ],
    },
  };

  // ══════════════════════════════════════════════════════════════
  // UNIFIED EXTRACTION FUNCTION
  // ══════════════════════════════════════════════════════════════

  function extractFields(text, vertical) {
    var config = VERTICALS[vertical] || VERTICALS["plumbing"];
    var t = String(text || "");

    // Scope detection (with negation handling).
    // detected:true  → an unambiguous "included" line was found
    // excluded:true  → only mentions of this item were on negated lines
    //                  ("Sealer NOT included", "permit excluded", etc.)
    // both false     → not mentioned at all
    // detected wins over excluded (one positive line is enough), so the
    // compare table treats "Sealer included on driveway, NOT on patio"
    // as included, not excluded.
    var scope = [];
    var negationPattern = /\bnot\s+included\b|\bnot\s+available\b|\bexcluded\b|\bnot\s+covered\b|\blimited\s+to\s+existing\b|\bowner\s+responsible\b|\bextra\s+cost\b|\badditional\s+charge\b|\bnon-\w+ed\b|\bnon\s+insulated\b/i;
    if (config.scope) {
      var tLower = t.toLowerCase();
      var lines = tLower.split(/\n/);
      for (var i = 0; i < config.scope.length; i++) {
        var item = config.scope[i];
        var found = false;
        var negatedOnly = false;
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          if (item.patterns.some(function (p) { return p.test(line); })) {
            if (negationPattern.test(line)) {
              // Pattern present but negated on this line. Don't claim
              // detection yet — keep scanning in case a later line
              // includes the item without negation.
              negatedOnly = true;
            } else {
              found = true;
              break;
            }
          }
        }
        scope.push({
          key: item.key,
          label: item.label,
          detected: found,
          excluded: !found && negatedOnly
        });
      }
    }

    // Brand detection
    var brand = null;
    if (config.brands) {
      for (var b = 0; b < config.brands.length; b++) {
        if (config.brands[b].pattern.test(t)) {
          brand = { brand: config.brands[b].brand, tier: config.brands[b].tier };
          break;
        }
      }
    }

    // Job type detection
    var jobType = { value: "other", label: "Service" };
    if (config.jobTypes) {
      for (var j = 0; j < config.jobTypes.length; j++) {
        if (config.jobTypes[j].pattern.test(t)) {
          jobType = { value: config.jobTypes[j].value, label: config.jobTypes[j].label };
          break;
        }
      }
    }

    return {
      warranty: extractWarranty(t),
      laborRate: extractLaborRate(t),
      laborHours: extractLaborHours(t),
      laborTotal: extractLaborTotal(t),
      brand: brand,
      jobType: jobType,
      lineItems: extractLineItems(t),
      location: extractLocation(t),
      scope: scope,
      scopeDetected: scope.filter(function (s) { return s.detected; }).length,
      scopeTotal: scope.length,
    };
  }

  // Public API
  window.TP_VerticalScope = {
    extractFields: extractFields,
    extractWarranty: extractWarranty,
    extractLaborRate: extractLaborRate,
    extractLocation: extractLocation,
    extractLineItems: extractLineItems,
    VERTICALS: VERTICALS,
    VERSION: "1.0.0",
  };

})();
