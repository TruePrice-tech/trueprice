// Woogoro Window calculator — single source of truth for /window-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroWindowCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FRAME = {
    vinyl:      { label: "Vinyl",      low: 400, mid: 600,  high: 800 },
    fiberglass: { label: "Fiberglass", low: 600, mid: 900,  high: 1200 },
    "wood-clad":{ label: "Wood-clad",  low: 800, mid: 1150, high: 1500 },
    composite:  { label: "Composite",  low: 700, mid: 1000, high: 1400 },
    aluminum:   { label: "Aluminum",   low: 400, mid: 650,  high: 900 }
  };

  var STYLE_MULT = { "double-hung": 1.00, casement: 1.08, sliding: 0.95, picture: 0.90, "bay-bow": 2.60 };
  var GLASS_MULT = { "double-standard": 0.92, "double-lowe": 1.00, "triple": 1.25 };
  var INSTALL_MULT = { pocket: 1.00, fullframe: 1.40 };

  var BRAND_TIER = {
    value: {
      label: "Value / Budget",
      tag: "Reliable basics. Best for rentals, flips, or budget-first.",
      perMat: {
        vinyl:    { low: 250, mid: 375, high: 550, brands: "Window World, Jeld-Wen Builders, Alside Sheffield" },
        aluminum: { low: 350, mid: 500, high: 700, brands: "Jeld-Wen Builders Aluminum" }
      }
    },
    mid: {
      label: "Mid-Range",
      tag: "Most popular. Solid performance at a fair price.",
      perMat: {
        vinyl:      { low: 400, mid: 675, high: 1000, brands: "Simonton 5500, Pella 250, Milgard Tuscany, Alside Mezzo" },
        fiberglass: { low: 700, mid: 1050, high: 1600, brands: "Milgard Ultra" },
        "wood-clad":{ low: 600, mid: 1000, high: 1500, brands: "Jeld-Wen Siteline" },
        composite:  { low: 400, mid: 650, high: 1500, brands: "Andersen 100 Series" },
        aluminum:   { low: 400, mid: 650, high: 900, brands: "Standard aluminum frames" }
      }
    },
    premium: {
      label: "Premium",
      tag: "Better performance, stronger warranties, proven names.",
      perMat: {
        vinyl:      { low: 700, mid: 1200, high: 1800, brands: "ProVia Endure, Soft-Lite Imperial, Pella 350" },
        fiberglass: { low: 900, mid: 1300, high: 2400, brands: "Marvin Essential, Marvin Elevate" },
        "wood-clad":{ low: 500, mid: 1200, high: 3000, brands: "Andersen 400 Series, Pella Lifestyle, ProVia Aeris" },
        composite:  { low: 650, mid: 1000, high: 1800, brands: "Andersen 200 Series" },
        aluminum:   { low: 600, mid: 900, high: 1400, brands: "Jeld-Wen Premium Atlantic (impact-rated)" }
      }
    },
    luxury: {
      label: "Luxury / Architectural",
      tag: "Top-of-line. Custom options, architectural-grade.",
      perMat: {
        vinyl:      { low: 1000, mid: 1700, high: 3500, brands: "Renewal by Andersen" },
        "wood-clad":{ low: 1100, mid: 2000, high: 4000, brands: "Andersen A-Series, Pella Reserve, Marvin Signature" },
        composite:  { low: 1100, mid: 2200, high: 4000, brands: "Andersen A-Series" }
      }
    }
  };

  var COUNT_MID = { "1-3": 2, "4-8": 6, "9-15": 12, "16+": 20 };

  var STATE_REGION = {
    CT:1.18,MA:1.18,ME:1.15,NH:1.15,NJ:1.18,NY:1.20,PA:1.15,RI:1.15,VT:1.15,
    CA:1.13,OR:1.10,WA:1.10,
    CO:1.00,UT:0.98,AZ:1.00,NV:1.00,NM:0.95,ID:0.98,MT:1.00,WY:0.98,
    IL:1.02,IN:0.97,IA:0.95,KS:0.93,MI:0.98,MN:1.00,MO:0.95,ND:0.95,NE:0.93,OH:0.97,SD:0.92,WI:0.98,
    AL:0.92,FL:1.08,GA:0.95,KY:0.93,MS:0.90,NC:0.95,SC:0.93,TN:0.93,VA:0.98,WV:0.93,
    AR:0.88,LA:0.90,OK:0.88,TX:0.92,
    AK:1.22,HI:1.30,DC:1.18,DE:1.10,MD:1.10
  };

  var STATE_ZONE = {
    AK:"N",ME:"N",VT:"N",NH:"N",MA:"N",NY:"N",MI:"N",MN:"N",WI:"N",ND:"N",SD:"N",MT:"N",ID:"N",WY:"N",
    WA:"N",OR:"N",RI:"N",CT:"N",
    PA:"NC",NJ:"NC",OH:"NC",IN:"NC",IL:"NC",IA:"NC",MO:"NC",KS:"NC",NE:"NC",CO:"NC",UT:"NC",NV:"NC",
    WV:"NC",KY:"NC",MD:"NC",DE:"NC",DC:"NC",
    VA:"SC",NC:"SC",TN:"SC",AR:"SC",OK:"SC",NM:"SC",CA:"SC",AZ:"SC",
    FL:"S",GA:"S",AL:"S",MS:"S",LA:"S",TX:"S",HI:"S",SC:"S"
  };

  var ZONE_SPECS = {
    N:  { label:"Northern",      uMax:0.20, shgcText:"≥ 0.20 (passive solar)", uFactorEs:0.22 },
    NC: { label:"North-Central", uMax:0.20, shgcText:"≤ 0.40",                 uFactorEs:0.25 },
    SC: { label:"South-Central", uMax:0.20, shgcText:"≤ 0.23",                 uFactorEs:0.28 },
    S:  { label:"Southern",      uMax:0.25, shgcText:"≤ 0.23",                 uFactorEs:0.32 }
  };

  var REBATES = {
    MA:{name:"Mass Save",               perWindow:75, note:"Triple-pane ENERGY STAR Northern Most Efficient; single-pane replacement only"},
    NY:{name:"NYSERDA Comfort Home",    perWindow:65, note:"Bundled weatherization; BPI contractor"},
    VT:{name:"Efficiency Vermont",      perWindow:40, note:"ENERGY STAR Northern; up to 10 windows"},
    ME:{name:"Efficiency Maine",        perWindow:65, note:"Tiered by U-factor; triple-pane bonus"},
    WI:{name:"Focus on Energy",         perWindow:75, note:"ENERGY STAR Northern; max 15 windows"},
    CO:{name:"Xcel Energy",             perWindow:40, note:"ENERGY STAR Northern / North-Central"},
    MN:{name:"CenterPoint Energy",      perWindow:25, note:"Gas-heated home only"},
    MI:{name:"DTE Energy",              perWindow:50, note:"ENERGY STAR Northern; single-pane replacement"},
    CT:{name:"Eversource CT",           perWindow:50, note:"Electric-heat home; ENERGY STAR"},
    RI:{name:"Rhode Island Energy",     perWindow:50, note:"Replacing single-pane"},
    WA:{name:"Puget Sound Energy",      perWindow:50, note:"ENERGY STAR Northern, U ≤ 0.22"},
    OR:{name:"Energy Trust of Oregon",  perWindow:55, note:"ENERGY STAR Northern; Trade Ally contractor"},
    IL:{name:"Ameren Illinois",         perWindow:40, note:"Replacing single-pane"},
    NH:{name:"NHSaves",                 perWindow:40, note:"ENERGY STAR Northern"}
  };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function stateMult(st) { return STATE_REGION[st] || 1.00; }
  function stateToZone(st) { return STATE_ZONE[st] || "NC"; }

  function calcWindowEstimate(opts) {
    opts = opts || {};
    var st = opts.stateCode || "TX";
    var regionMult = (typeof opts.cityMult === "number" && opts.cityMult > 0) ? opts.cityMult : stateMult(st);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;

    var baseFrame = FRAME[opts.material] || FRAME.vinyl;
    var tierData = BRAND_TIER[opts.brandTier];
    var tierMat = tierData && tierData.perMat && tierData.perMat[opts.material];
    var frame = tierMat
      ? { low: tierMat.low, mid: tierMat.mid, high: tierMat.high, label: baseFrame.label }
      : baseFrame;

    var styleMult = STYLE_MULT[opts.style] || 1.00;
    var glassMult = GLASS_MULT[opts.glass] || 1.00;
    var installMult = INSTALL_MULT[opts.install] || 1.00;
    var count = COUNT_MID[opts.count] || (Number(opts.count) || 10);

    var baseMult = styleMult * glassMult * installMult * regionMult * inflationMult;
    var perMid  = roundTo50(frame.mid * baseMult);
    var perLow  = roundTo50(perMid * 0.88);
    var perHigh = roundTo50(perMid * 1.15);

    var totalMid  = perMid * count;
    var totalLow  = perLow * count;
    var totalHigh = perHigh * count;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend && totalMid > 0) {
      var blended = FB.FlywheelBlend.blendMid(totalMid, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) {
        var ratio = blended.mid / totalMid;
        totalMid = blended.mid;
        totalLow = totalLow * ratio;
        totalHigh = totalHigh * ratio;
        flywheelApplied = true;
      }
    }

    var rebate = REBATES[st] || null;
    var rebateTotal = rebate ? rebate.perWindow * count : 0;
    var zone = stateToZone(st);

    return {
      perLow: perLow, perMid: perMid, perHigh: perHigh,
      totalLow: roundTo50(totalLow), totalMid: roundTo50(totalMid), totalHigh: roundTo50(totalHigh),
      count: count, regionMult: regionMult,
      brandTierLabel: tierData ? tierData.label : "Mid-Range",
      brandExamples: tierMat ? tierMat.brands : "",
      materialLabel: frame.label,
      zone: zone, zoneSpec: ZONE_SPECS[zone],
      rebate: rebate, rebateTotal: rebateTotal,
      flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence
    };
  }

  return {
    FRAME: FRAME, STYLE_MULT: STYLE_MULT, GLASS_MULT: GLASS_MULT, INSTALL_MULT: INSTALL_MULT,
    BRAND_TIER: BRAND_TIER, COUNT_MID: COUNT_MID,
    STATE_REGION: STATE_REGION, STATE_ZONE: STATE_ZONE, ZONE_SPECS: ZONE_SPECS,
    REBATES: REBATES,
    stateMult: stateMult, stateToZone: stateToZone,
    calcWindowEstimate: calcWindowEstimate,
    roundTo50: roundTo50
  };
});
