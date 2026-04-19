var fs = require("fs");

// Correct SCOPE_ITEMS for each compare page, matching vertical-scope-all.js keys exactly
var mapping = {
  "compare-plumbing-quotes.html": [
    {key:"permit",label:"Permit included"},{key:"warranty_parts",label:"Parts warranty"},{key:"warranty_labor",label:"Labor warranty"},
    {key:"disposal",label:"Old unit disposal"},{key:"labor_rate",label:"Labor rate disclosed"},{key:"code_compliance",label:"Code compliance"},
    {key:"camera_inspection",label:"Camera inspection"},{key:"expansion_tank",label:"Expansion tank"},{key:"shutoff_valve",label:"Shut-off valve"},
    {key:"cleanup",label:"Cleanup"},{key:"pressure_test",label:"Pressure test"}
  ],
  "compare-electrical-quotes.html": [
    {key:"permit",label:"Permit"},{key:"grounding",label:"Grounding"},{key:"afci_gfci",label:"AFCI/GFCI"},
    {key:"panel",label:"Panel work"},{key:"wiring",label:"New wiring"},{key:"utility_coord",label:"Utility coordination"},
    {key:"code_upgrade",label:"Code upgrade"},{key:"cleanup",label:"Cleanup"},{key:"labeling",label:"Panel labeling"}
  ],
  "compare-auto-quotes.html": [
    {key:"parts_warranty",label:"Parts warranty"},{key:"labor_warranty",label:"Labor warranty"},{key:"diagnostic",label:"Diagnostic fee"},
    {key:"fluid_change",label:"Fluid service"},{key:"tax_shown",label:"Tax itemized"},{key:"shop_supplies",label:"Shop supplies"},
    {key:"oem_parts",label:"OEM parts"},{key:"aftermarket",label:"Aftermarket parts"}
  ],
  "compare-solar-quotes.html": [
    {key:"permit",label:"Permit"},{key:"monitoring",label:"Monitoring"},{key:"critter_guard",label:"Critter guard"},
    {key:"panel_upgrade",label:"Panel upgrade"},{key:"tax_credit",label:"Tax credit noted"},{key:"battery",label:"Battery storage"},
    {key:"racking",label:"Racking/mounting"},{key:"roof_warranty",label:"Roof penetration warranty"},
    {key:"production",label:"Production guarantee"},{key:"net_metering",label:"Net metering"},
    {key:"warranty",label:"Warranty terms"},{key:"cleanup",label:"Cleanup"}
  ],
  "compare-moving-quotes.html": [
    {key:"packing",label:"Packing service"},{key:"materials",label:"Packing materials"},{key:"insurance",label:"Insurance/valuation"},
    {key:"stair_fee",label:"Stair fee"},{key:"fuel",label:"Fuel charge"},{key:"storage",label:"Storage available"},
    {key:"disassembly",label:"Disassembly/reassembly"},{key:"heavy_items",label:"Heavy item fee"},
    {key:"hourly_rate",label:"Hourly rate disclosed"},{key:"binding_estimate",label:"Binding estimate"},{key:"timeline",label:"Delivery timeline"}
  ],
  "compare-painting-quotes.html": [
    {key:"power_wash",label:"Power wash"},{key:"scraping",label:"Scrape/sand prep"},{key:"priming",label:"Primer"},
    {key:"caulking",label:"Caulk/wood repair"},{key:"trim",label:"Trim painting"},{key:"ceiling",label:"Ceiling included"},
    {key:"two_coats",label:"Two coats"},{key:"furniture_move",label:"Furniture moved"},
    {key:"drop_cloth",label:"Drop cloths/protection"},{key:"cleanup",label:"Cleanup"},
    {key:"paint_brand",label:"Paint brand specified"},{key:"warranty",label:"Warranty"}
  ],
  "compare-concrete-quotes.html": [
    {key:"permit",label:"Permit"},{key:"rebar",label:"Rebar/wire mesh"},{key:"grading",label:"Grading/compaction"},
    {key:"forms",label:"Formwork"},{key:"finish",label:"Finish type"},{key:"sealer",label:"Sealer/curing"},
    {key:"demo",label:"Demo/removal"},{key:"disposal",label:"Disposal"},{key:"cleanup",label:"Cleanup"},
    {key:"warranty",label:"Warranty"}
  ],
  "compare-fencing-quotes.html": [
    {key:"permit",label:"Permit"},{key:"removal",label:"Old fence removal"},{key:"posts",label:"Post type"},
    {key:"concrete_footings",label:"Concrete footings"},{key:"hardware",label:"Hardware/gates"},
    {key:"stain_seal",label:"Stain/seal"},{key:"cleanup",label:"Cleanup"},{key:"warranty",label:"Warranty"}
  ],
  "compare-gutters-quotes.html": [
    {key:"removal",label:"Old gutter removal"},{key:"downspouts",label:"Downspouts"},{key:"guards",label:"Gutter guards"},
    {key:"fascia_repair",label:"Fascia repair"},{key:"splash_blocks",label:"Splash blocks"},
    {key:"hidden_hangers",label:"Hidden hangers"},{key:"cleanup",label:"Cleanup"},{key:"warranty",label:"Warranty"}
  ],
  "compare-insulation-quotes.html": [
    {key:"removal",label:"Old insulation removal"},{key:"air_sealing",label:"Air sealing"},{key:"vapor_barrier",label:"Vapor barrier"},
    {key:"ventilation",label:"Ventilation check"},{key:"r_value",label:"R-value specified"},
    {key:"blower_door",label:"Blower door test"},{key:"cleanup",label:"Cleanup"},{key:"warranty",label:"Warranty"}
  ],
  "compare-foundation-quotes.html": [
    {key:"engineering",label:"Engineering report"},{key:"permit",label:"Permit"},{key:"waterproofing",label:"Waterproofing"},
    {key:"drainage",label:"Drainage"},{key:"warranty",label:"Warranty"},{key:"cleanup",label:"Cleanup"},
    {key:"monitoring",label:"Post-repair monitoring"}
  ],
  "compare-garage-door-quotes.html": [
    {key:"removal",label:"Old door removal"},{key:"opener",label:"Opener included"},{key:"hardware",label:"Hardware/tracks"},
    {key:"insulation",label:"Insulation"},{key:"weatherseal",label:"Weather seal"},
    {key:"safety",label:"Safety features"},{key:"warranty",label:"Warranty"},{key:"cleanup",label:"Cleanup"}
  ],
  "compare-kitchen-quotes.html": [
    {key:"demo",label:"Demo"},{key:"cabinets",label:"Cabinets"},{key:"countertops",label:"Countertops"},
    {key:"plumbing",label:"Plumbing"},{key:"electrical",label:"Electrical"},{key:"flooring",label:"Flooring"},
    {key:"appliances",label:"Appliances"},{key:"permit",label:"Permit"},{key:"cleanup",label:"Cleanup"},{key:"warranty",label:"Warranty"}
  ],
  "compare-landscaping-quotes.html": [
    {key:"grading",label:"Grading/drainage"},{key:"irrigation",label:"Irrigation"},{key:"plants",label:"Plant material"},
    {key:"mulch",label:"Mulch/stone"},{key:"edging",label:"Edging"},{key:"lighting",label:"Landscape lighting"},
    {key:"cleanup",label:"Cleanup"},{key:"warranty",label:"Plant warranty"}
  ],
  "compare-siding-quotes.html": [
    {key:"removal",label:"Old siding removal"},{key:"housewrap",label:"House wrap"},{key:"trim",label:"Trim/corners"},
    {key:"flashing",label:"Flashing"},{key:"insulation",label:"Insulation board"},{key:"soffit_fascia",label:"Soffit/fascia"},
    {key:"caulking",label:"Caulking"},{key:"cleanup",label:"Cleanup"},{key:"warranty",label:"Warranty"}
  ],
  "compare-windows-quotes.html": [
    {key:"removal",label:"Old window removal"},{key:"trim",label:"Interior/exterior trim"},{key:"flashing",label:"Flashing/waterproofing"},
    {key:"insulation",label:"Insulation/foam"},{key:"screens",label:"Screens included"},
    {key:"hardware",label:"Hardware/locks"},{key:"cleanup",label:"Cleanup"},{key:"warranty",label:"Warranty"}
  ],
  "compare-medical-quotes.html": [
    {key:"cpt_codes",label:"CPT codes listed"},{key:"itemized",label:"Itemized charges"},{key:"insurance_adj",label:"Insurance adjustments"},
    {key:"patient_resp",label:"Patient responsibility"},{key:"facility_fee",label:"Facility fee"},
    {key:"provider_fee",label:"Provider fee"},{key:"payment_plan",label:"Payment plan"}
  ],
  "compare-legal-quotes.html": [
    {key:"fee_structure",label:"Fee structure"},{key:"retainer",label:"Retainer amount"},{key:"hourly_rate",label:"Hourly rate"},
    {key:"expenses",label:"Expenses"},{key:"billing_freq",label:"Billing frequency"},
    {key:"scope",label:"Scope of work"},{key:"termination",label:"Termination clause"}
  ],
};

var fixed = 0;
for (var file in mapping) {
  if (!fs.existsSync(file)) { console.log("SKIP: " + file); continue; }
  var c = fs.readFileSync(file, "utf8");
  var m = c.match(/var SCOPE_ITEMS = \[.*?\];/);
  if (m) {
    c = c.replace(m[0], "var SCOPE_ITEMS = " + JSON.stringify(mapping[file]) + ";");
    fs.writeFileSync(file, c);
    fixed++;
    console.log("Fixed " + file + " (" + mapping[file].length + " scope items)");
  } else {
    console.log("NO SCOPE_ITEMS in " + file);
  }
}
console.log("\n" + fixed + " compare pages updated");
