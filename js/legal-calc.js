// Woogoro Legal calculator — single source of truth for /legal-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroLegalCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LEGAL_PRICING = {
    services: {
      divorce: { label: "Divorce", subTypes: {
        uncontested:    { label: "Uncontested divorce", low: 1500, high: 5000 },
        contested:      { label: "Contested divorce", low: 8000, high: 30000 },
        with_children:  { label: "Divorce with children (custody)", low: 8000, high: 35000 },
        high_asset:     { label: "High-asset divorce", low: 15000, high: 75000 }
      }},
      estate_planning: { label: "Estate Planning", subTypes: {
        basic_will:     { label: "Basic will", low: 500, high: 2000 },
        trust:          { label: "Living trust package", low: 2000, high: 6000 },
        complex_estate: { label: "Complex estate plan", low: 5000, high: 15000 },
        probate:        { label: "Probate administration", low: 3000, high: 10000 }
      }},
      personal_injury: { label: "Personal Injury", subTypes: {
        auto_accident:       { label: "Auto accident claim", low: 0, high: 0, contingency: true, pctLow: 33, pctHigh: 40 },
        slip_and_fall:       { label: "Slip and fall", low: 0, high: 0, contingency: true, pctLow: 33, pctHigh: 40 },
        medical_malpractice: { label: "Medical malpractice", low: 0, high: 0, contingency: true, pctLow: 33, pctHigh: 40 },
        wrongful_death:      { label: "Wrongful death", low: 0, high: 0, contingency: true, pctLow: 33, pctHigh: 40 }
      }},
      criminal_defense: { label: "Criminal Defense", subTypes: {
        misdemeanor: { label: "Misdemeanor defense", low: 2000, high: 10000 },
        felony:      { label: "Felony defense", low: 5000, high: 25000 },
        dui:         { label: "DUI/DWI defense", low: 2500, high: 15000 },
        federal:     { label: "Federal criminal defense", low: 15000, high: 100000 }
      }},
      business_formation: { label: "Business Formation", subTypes: {
        llc:                 { label: "LLC formation", low: 500, high: 2000 },
        corporation:         { label: "Corporation formation", low: 1000, high: 3500 },
        partnership:         { label: "Partnership agreement", low: 1000, high: 3000 },
        operating_agreement: { label: "Operating agreement", low: 500, high: 2500 }
      }},
      real_estate_closing: { label: "Real Estate Closing", subTypes: {
        residential_purchase: { label: "Residential purchase closing", low: 1000, high: 3000 },
        residential_sale:     { label: "Residential sale closing", low: 800, high: 2500 },
        commercial:           { label: "Commercial real estate closing", low: 2500, high: 8000 },
        title_review:         { label: "Title search and review", low: 500, high: 1500 }
      }},
      immigration: { label: "Immigration", subTypes: {
        green_card:          { label: "Green card application", low: 3000, high: 10000 },
        citizenship:         { label: "Citizenship/naturalization", low: 1500, high: 5000 },
        work_visa:           { label: "Work visa (H-1B, L-1, etc.)", low: 2000, high: 8000 },
        deportation_defense: { label: "Deportation defense", low: 5000, high: 25000 }
      }},
      bankruptcy: { label: "Bankruptcy", subTypes: {
        chapter_7:        { label: "Chapter 7 bankruptcy", low: 1500, high: 4000 },
        chapter_13:       { label: "Chapter 13 bankruptcy", low: 3000, high: 6000 },
        chapter_11:       { label: "Chapter 11 (business)", low: 15000, high: 50000 },
        debt_negotiation: { label: "Debt negotiation", low: 1000, high: 5000 }
      }}
    },
    feeStructures: {
      flat_fee:    { label: "Flat fee",    description: "One fixed price for the entire matter. Common for straightforward cases like wills, LLC formation, and uncontested divorce." },
      hourly:      { label: "Hourly",      description: "Billed by the hour, typically $150-$500/hr depending on experience, specialty, and market." },
      contingency: { label: "Contingency", description: "Attorney takes a percentage of the settlement or verdict (typically 33-40%). You pay nothing upfront." },
      retainer:    { label: "Retainer",    description: "Upfront deposit into a trust account, billed against hourly." }
    },
    complexityMultipliers: {
      simple:   { label: "Simple/standard",   multiplier: 1.0 },
      moderate: { label: "Moderate complexity", multiplier: 1.4 },
      complex:  { label: "Highly complex",    multiplier: 2.0 }
    },
    regionMultipliers: { south: 0.85, southeast: 0.90, midwest: 0.88, mountain: 0.92, northeast: 1.20, west: 1.25 },
    hourlyRates: {
      south: { low: 150, high: 350 }, southeast: { low: 150, high: 350 },
      midwest: { low: 175, high: 400 }, mountain: { low: 175, high: 400 },
      northeast: { low: 250, high: 600 }, west: { low: 250, high: 600 }
    }
  };

  var STATE_REGIONS = {
    AL:"southeast",AK:"west",AZ:"west",AR:"south",CA:"west",CO:"mountain",CT:"northeast",
    DE:"northeast",FL:"southeast",GA:"southeast",HI:"west",ID:"mountain",IL:"midwest",
    IN:"midwest",IA:"midwest",KS:"midwest",KY:"southeast",LA:"south",ME:"northeast",
    MD:"northeast",MA:"northeast",MI:"midwest",MN:"midwest",MS:"south",MO:"midwest",
    MT:"mountain",NE:"midwest",NV:"west",NH:"northeast",NJ:"northeast",NM:"mountain",
    NY:"northeast",NC:"southeast",ND:"midwest",OH:"midwest",OK:"south",OR:"west",
    PA:"northeast",RI:"northeast",SC:"southeast",SD:"midwest",TN:"southeast",TX:"south",
    UT:"mountain",VT:"northeast",VA:"southeast",WA:"west",WV:"southeast",WI:"midwest",
    WY:"mountain",DC:"northeast"
  };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }

  function calcLegalEstimate(opts) {
    opts = opts || {};
    var svc = LEGAL_PRICING.services[opts.serviceType];
    if (!svc) return null;
    var sub = svc.subTypes[opts.subType];
    if (!sub) return null;
    var complexMult = LEGAL_PRICING.complexityMultipliers[opts.complexity]
      ? LEGAL_PRICING.complexityMultipliers[opts.complexity].multiplier
      : 1.0;
    var regionMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (LEGAL_PRICING.regionMultipliers[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;

    var isContingency = sub.contingency === true;
    var low, high, mid;
    if (isContingency) {
      low = sub.pctLow || 33;
      high = sub.pctHigh || 40;
      mid = Math.round((low + high) / 2);
    } else {
      low = roundTo50(sub.low * complexMult * regionMult * inflationMult);
      high = roundTo50(sub.high * complexMult * regionMult * inflationMult);
      mid = roundTo50((low + high) / 2);
    }

    // Flywheel blend on mid for non-contingency cases.
    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (!isContingency && opts.calData && FB && FB.FlywheelBlend && mid > 0) {
      var blended = FB.FlywheelBlend.blendMid(mid, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) {
        var ratio = blended.mid / mid;
        mid = blended.mid;
        low = low * ratio;
        high = high * ratio;
        flywheelApplied = true;
      }
    }

    // Contingency returns percentages (33-40), not dollar amounts — don't round.
    var roundFn = isContingency ? function(n){return Math.round(n);} : roundTo50;
    return {
      serviceLabel: svc.label, subLabel: sub.label,
      isContingency: isContingency,
      low: roundFn(low), high: roundFn(high), mid: roundFn(mid),
      hourlyRange: LEGAL_PRICING.hourlyRates[opts.region] || { low: 200, high: 450 },
      flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence
    };
  }

  return {
    LEGAL_PRICING: LEGAL_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    getRegionFromState: getRegionFromState,
    calcLegalEstimate: calcLegalEstimate,
    roundTo50: roundTo50
  };
});
