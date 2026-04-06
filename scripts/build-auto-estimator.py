#!/usr/bin/env python3
"""Build the precise auto repair estimator page with embedded data."""
import json, os

with open(os.path.join(os.path.dirname(__file__), '..', 'data', 'auto-repair-pricing.json')) as f:
    d = json.load(f)

repairs_js = json.dumps(d['commonRepairs'], separators=(',',':'))
states_js = json.dumps(d['stateMultipliers'], separators=(',',':'))
vehicles_js = json.dumps(d['vehicleCategoryMultipliers'], separators=(',',':'))
shops_js = json.dumps(d['laborRatesByShopType'], separators=(',',':'))
categories_js = json.dumps(d['categories'], separators=(',',':'))

# State sales tax rates (approximate)
tax_rates = {
    "AL":0.04,"AK":0.0,"AZ":0.056,"AR":0.065,"CA":0.0725,"CO":0.029,"CT":0.0635,"DE":0.0,
    "FL":0.06,"GA":0.04,"HI":0.04,"ID":0.06,"IL":0.0625,"IN":0.07,"IA":0.06,"KS":0.065,
    "KY":0.06,"LA":0.0445,"ME":0.055,"MD":0.06,"MA":0.0625,"MI":0.06,"MN":0.0688,"MS":0.07,
    "MO":0.0423,"MT":0.0,"NE":0.055,"NV":0.0685,"NH":0.0,"NJ":0.0663,"NM":0.0513,"NY":0.04,
    "NC":0.0475,"ND":0.05,"OH":0.0575,"OK":0.045,"OR":0.0,"PA":0.06,"RI":0.07,"SC":0.06,
    "SD":0.045,"TN":0.07,"TX":0.0625,"UT":0.061,"VT":0.06,"VA":0.053,"WA":0.065,"WV":0.06,
    "WI":0.05,"WY":0.04,"DC":0.06
}
tax_js = json.dumps(tax_rates, separators=(',',':'))

state_opts = ''.join(f'<option value="{s}">{s}</option>' for s in sorted(d['stateMultipliers'].keys()))

# Group repairs by category for the dropdown
cats = {}
for key, r in d['commonRepairs'].items():
    cat = r.get('category', 'other')
    if cat not in cats:
        cats[cat] = []
    cats[cat].append((key, r['label']))

cat_labels = {v.get('label', k): k for k, v in d['categories'].items()} if 'categories' in d else {}
repair_optgroups = ''
for cat_key in sorted(cats.keys()):
    cat_label = d.get('categories', {}).get(cat_key, {}).get('label', cat_key.replace('_', ' ').title())
    repair_optgroups += f'<optgroup label="{cat_label}">'
    for rkey, rlabel in sorted(cats[cat_key], key=lambda x: x[1]):
        repair_optgroups += f'<option value="{rkey}">{rlabel}</option>'
    repair_optgroups += '</optgroup>'

html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<link rel="icon" href="/favicon-trudy.svg" type="image/svg+xml" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Auto Repair Cost Estimator | TruePrice</title>
<meta name="description" content="Get a precise auto repair cost estimate for your car. Pick the repair, enter your vehicle and location. See labor, parts, tax, and total. 43 repairs, city-level pricing." />
<link rel="canonical" href="https://truepricehq.com/auto-estimate.html" />
<meta name="robots" content="index,follow" />
<meta property="og:title" content="Auto Repair Cost Estimator | TruePrice" />
<meta property="og:description" content="Precise repair estimates. 43 repairs, your car, your city." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://truepricehq.com/auto-estimate.html" />
<meta property="og:site_name" content="TruePrice" />
<meta property="og:image" content="https://truepricehq.com/images/trueprice-social.svg" />
<link rel="stylesheet" href="/css/trueprice.min.css" />
<style>
.ae-wrap{max-width:800px;margin:0 auto;padding:32px 16px;}
.ae-hero{text-align:center;margin-bottom:32px;}
.ae-hero h1{font-size:28px;margin-bottom:8px;}
.ae-hero p{color:var(--text-secondary);font-size:16px;}
.ae-form{display:flex;flex-direction:column;gap:12px;margin-bottom:24px;}
.ae-row{display:flex;gap:10px;flex-wrap:wrap;}
.ae-row>*{flex:1;min-width:140px;}
.ae-form label{font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:4px;}
.ae-form select,.ae-form input{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;}
.ae-form select:focus,.ae-form input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(29,78,216,0.15);}
.ae-btn{padding:14px 24px;border:none;border-radius:10px;background:var(--brand);color:#fff;font-size:16px;font-weight:700;cursor:pointer;width:100%;}
.ae-btn:hover{opacity:0.9;}
.ae-result{display:none;}
.ae-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:16px;}
.ae-total-box{text-align:center;padding:24px;background:var(--bg-subtle);border-radius:12px;margin:16px 0;}
.ae-total-box .total{font-size:42px;font-weight:800;color:var(--brand);}
.ae-total-box .range{font-size:14px;color:var(--text-secondary);}
.ae-breakdown{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;}
.ae-breakdown-item{padding:12px;background:#f8fafc;border-radius:8px;}
.ae-breakdown-item .label{font-size:11px;color:var(--text-muted);text-transform:uppercase;}
.ae-breakdown-item .value{font-size:18px;font-weight:700;color:#1e293b;}
.ae-parts-table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;}
.ae-parts-table th{text-align:left;padding:6px 8px;background:#f1f5f9;font-size:11px;text-transform:uppercase;color:var(--text-muted);}
.ae-parts-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9;}
.ae-parts-table tr.selected{background:#eff6ff;font-weight:600;}
.ae-note{font-size:12px;color:var(--text-muted);margin-top:8px;}
.ae-share{font-size:12px;color:var(--brand);cursor:pointer;float:right;}
.ae-share:hover{text-decoration:underline;}
.ae-cta{text-align:center;margin-top:24px;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;}
@media(max-width:500px){.ae-breakdown{grid-template-columns:1fr;}.ae-row{flex-direction:column;}}
</style>
</head>
<body>
<header class="site-header"><div class="container"><a class="logo" href="/">TruePrice</a><nav><a href="/guides.html">Guides</a><a href="/just-browsing.html">Just Browsing</a><a class="nav-cta" href="/analyze-quote.html">I Have a Quote</a></nav></div></header>

<main class="ae-wrap">
<div class="ae-hero">
<img src="/images/trudy-auto.png" alt="Trudy" width="100" style="margin-bottom:8px;" />
<h1>How Much Should This Repair Cost?</h1>
<p>Pick the repair, enter your car and location. Get a precise estimate with labor, parts, and tax.</p>
</div>

<div class="ae-form">
<div>
<label>What repair do you need?</label>
<select id="repairSelect"><option value="">Select a repair...</option>''' + repair_optgroups + '''</select>
</div>
<div class="ae-row">
<div><label>Year</label><input type="number" id="yearInput" placeholder="e.g. 2019" min="1970" max="2027" /></div>
<div><label>Make</label><input type="text" id="makeInput" placeholder="e.g. Honda" /></div>
<div><label>Model</label><input type="text" id="modelInput" placeholder="e.g. Civic" /></div>
</div>
<div class="ae-row">
<div><label>City (optional)</label><input type="text" id="cityInput" placeholder="e.g. Charlotte" /></div>
<div><label>State</label><select id="stateSelect"><option value="">State</option>''' + state_opts + '''</select></div>
<div><label>Shop Type</label><select id="shopSelect"><option value="independent">Independent</option><option value="dealer">Dealership</option><option value="chain">Chain (Midas, etc.)</option></select></div>
</div>
<button class="ae-btn" id="estimateBtn">Get My Estimate</button>
</div>

<div id="result" class="ae-result"></div>

<div style="padding:12px;background:#f8fafc;border-radius:10px;font-size:11px;color:var(--text-muted);text-align:center;">
Estimates based on industry labor guides, parts pricing databases, and state-level cost data. Actual costs vary by shop, vehicle condition, and specific parts used. Not professional automotive advice.
</div>
</main>

<footer class="site-footer"><div class="container"><p>TruePrice helps you understand fair auto repair pricing. <a href="/privacy.html" style="color:inherit;">Privacy</a> | <a href="/terms.html" style="color:inherit;">Terms</a></p></div></footer>

<script>
var REPAIRS=''' + repairs_js + ''';
var STATES=''' + states_js + ''';
var VEHICLES=''' + vehicles_js + ''';
var SHOPS=''' + shops_js + ''';
var TAX=''' + tax_js + ''';

// Vehicle category detection from make
var MAKE_MAP={
  economy:["nissan","hyundai","kia","mitsubishi","suzuki","datsun","geo","saturn","scion","daewoo","fiat"],
  standard:["honda","toyota","ford","chevrolet","chevy","mazda","subaru","volkswagen","vw","buick","chrysler","dodge","pontiac","oldsmobile","mercury"],
  truck_suv:["ram","gmc","jeep","land rover","isuzu","hummer"],
  luxury:["bmw","mercedes","audi","lexus","infiniti","acura","volvo","cadillac","lincoln","jaguar","maserati","alfa romeo","genesis"],
  performance:["porsche","corvette","ferrari","lamborghini","mclaren","aston martin","lotus"],
  ev_hybrid:["tesla","rivian","lucid","polestar"]
};
// Some makes span categories based on model
var TRUCK_MODELS=["f-150","f150","silverado","sierra","tundra","tacoma","ranger","colorado","frontier","titan","ram","wrangler","4runner","tahoe","suburban","expedition","explorer","highlander","pilot","pathfinder","rav4","cr-v","crv","equinox","traverse"];

function detectVehicleCategory(make, model) {
  var m = (make||"").toLowerCase().trim();
  var mod = (model||"").toLowerCase().trim();
  // Check truck/SUV models first (overrides make category)
  for (var i=0;i<TRUCK_MODELS.length;i++) { if (mod.indexOf(TRUCK_MODELS[i])>-1) return "truck_suv"; }
  for (var cat in MAKE_MAP) { for (var j=0;j<MAKE_MAP[cat].length;j++) { if (m.indexOf(MAKE_MAP[cat][j])>-1) return cat; } }
  return "standard";
}

function fmt(n){return "$"+Math.round(n).toLocaleString();}

document.getElementById("estimateBtn").addEventListener("click", function(){
  var repairKey = document.getElementById("repairSelect").value;
  var year = parseInt(document.getElementById("yearInput").value) || 0;
  var make = document.getElementById("makeInput").value.trim();
  var model = document.getElementById("modelInput").value.trim();
  var city = document.getElementById("cityInput").value.trim();
  var state = document.getElementById("stateSelect").value;
  var shopType = document.getElementById("shopSelect").value;

  if (!repairKey) { alert("Select a repair."); return; }
  if (!state) { alert("Select your state."); return; }

  var repair = REPAIRS[repairKey];
  var stateMult = STATES[state] || 1.0;
  var vehicleCat = detectVehicleCategory(make, model);
  var vehicleMult = VEHICLES[vehicleCat] ? VEHICLES[vehicleCat].mult : 1.0;
  var vehicleLabel = VEHICLES[vehicleCat] ? VEHICLES[vehicleCat].label : "Standard";
  var shopRates = SHOPS[shopType] || SHOPS.independent;
  var taxRate = TAX[state] || 0.06;

  // Calculate labor
  var laborRateLow = Math.round(shopRates.low * stateMult * vehicleMult);
  var laborRateMid = Math.round(shopRates.mid * stateMult * vehicleMult);
  var laborRateHigh = Math.round(shopRates.high * stateMult * vehicleMult);
  var laborHrsLow = repair.laborHours.low;
  var laborHrsHigh = repair.laborHours.high;
  var laborHrsMid = (laborHrsLow + laborHrsHigh) / 2;

  // Vehicle age adjustment (older cars can take more labor)
  var ageAdj = 1.0;
  if (year > 0 && year < 2000) ageAdj = 1.15;
  else if (year >= 2000 && year < 2010) ageAdj = 1.05;

  var laborLow = Math.round(laborRateLow * laborHrsLow * ageAdj);
  var laborMid = Math.round(laborRateMid * laborHrsMid * ageAdj);
  var laborHigh = Math.round(laborRateHigh * laborHrsHigh * ageAdj);

  // Parts pricing by type
  var partsTypes = [];
  if (repair.partsRange.oem) partsTypes.push({type:"OEM (Original)",low:repair.partsRange.oem[0],high:repair.partsRange.oem[1],mult:vehicleMult});
  if (repair.partsRange.aftermarket) partsTypes.push({type:"Aftermarket",low:repair.partsRange.aftermarket[0],high:repair.partsRange.aftermarket[1],mult:1.0});
  if (repair.partsRange.reman) partsTypes.push({type:"Remanufactured",low:repair.partsRange.reman[0],high:repair.partsRange.reman[1],mult:1.0});

  // Default to aftermarket mid for the main estimate
  var partsDefault = repair.partsRange.aftermarket || repair.partsRange.oem || [0,0];
  var partsMid = Math.round(((partsDefault[0]+partsDefault[1])/2) * (vehicleCat==="luxury"?1.3:vehicleCat==="truck_suv"?1.1:1.0) * stateMult);
  var partsLow = Math.round(partsDefault[0] * stateMult);
  var partsHigh = Math.round((repair.partsRange.oem||partsDefault)[1] * vehicleMult * stateMult);

  // Shop supplies (5-8% of labor)
  var shopSupplies = Math.round(laborMid * 0.06);

  // Subtotal
  var subtotalLow = laborLow + partsLow;
  var subtotalMid = laborMid + partsMid + shopSupplies;
  var subtotalHigh = laborHigh + partsHigh + shopSupplies;

  // Tax (on parts + shop supplies in most states, not labor)
  var taxLow = Math.round((partsLow + shopSupplies) * taxRate);
  var taxMid = Math.round((partsMid + shopSupplies) * taxRate);
  var taxHigh = Math.round((partsHigh + shopSupplies) * taxRate);

  var totalLow = subtotalLow + taxLow;
  var totalMid = subtotalMid + taxMid;
  var totalHigh = subtotalHigh + taxHigh;

  var vehicleDesc = (year>0?year+" ":"") + (make||"") + " " + (model||"");
  vehicleDesc = vehicleDesc.trim() || "Your vehicle";
  var locationDesc = city ? city + ", " + state : state;

  // Build result
  var h = '<div class="ae-card">';
  var shareText = repair.label + " for " + vehicleDesc + " in " + locationDesc + ": " + fmt(totalLow) + " - " + fmt(totalHigh) + " (aftermarket parts, " + shopType + " shop). truepricehq.com/auto-estimate.html";
  h += '<span class="ae-share" onclick="navigator.clipboard.writeText(\\''+shareText.replace(/'/g,"\\\\'")+'\\'');this.textContent=\\'Copied!\\'">Share</span>';
  h += '<h3>' + repair.label + '</h3>';
  h += '<div style="font-size:14px;color:#64748b;">' + vehicleDesc + ' &bull; ' + locationDesc + ' &bull; ' + vehicleLabel + ' &bull; ' + (shopType==="dealer"?"Dealership":shopType==="chain"?"Chain Shop":"Independent Shop") + '</div>';

  h += '<div class="ae-total-box">';
  h += '<div style="font-size:13px;color:var(--text-muted);">Estimated Total</div>';
  h += '<div class="total">' + fmt(totalMid) + '</div>';
  h += '<div class="range">Range: ' + fmt(totalLow) + ' - ' + fmt(totalHigh) + '</div>';
  h += '</div>';

  h += '<div class="ae-breakdown">';
  h += '<div class="ae-breakdown-item"><div class="label">Labor (' + laborHrsMid.toFixed(1) + ' hrs @ ' + fmt(laborRateMid) + '/hr)</div><div class="value">' + fmt(laborMid) + '</div></div>';
  h += '<div class="ae-breakdown-item"><div class="label">Parts (aftermarket)</div><div class="value">' + fmt(partsMid) + '</div></div>';
  h += '<div class="ae-breakdown-item"><div class="label">Shop Supplies (~6%)</div><div class="value">' + fmt(shopSupplies) + '</div></div>';
  h += '<div class="ae-breakdown-item"><div class="label">Tax (' + (taxRate*100).toFixed(1) + '% on parts)</div><div class="value">' + fmt(taxMid) + '</div></div>';
  h += '</div>';

  // Parts comparison table
  if (partsTypes.length > 1) {
    h += '<h4 style="margin:16px 0 8px;font-size:14px;">Parts Options</h4>';
    h += '<table class="ae-parts-table"><thead><tr><th>Type</th><th>Parts Cost</th><th>Total w/ Labor + Tax</th></tr></thead><tbody>';
    partsTypes.forEach(function(pt) {
      var ptMid = Math.round(((pt.low+pt.high)/2) * pt.mult * stateMult);
      var ptTotal = laborMid + ptMid + shopSupplies + Math.round((ptMid+shopSupplies)*taxRate);
      var isDefault = pt.type === "Aftermarket";
      h += '<tr' + (isDefault?' class="selected"':'') + '>';
      h += '<td>' + pt.type + '</td>';
      h += '<td>' + fmt(Math.round(pt.low*stateMult)) + ' - ' + fmt(Math.round(pt.high*pt.mult*stateMult)) + '</td>';
      h += '<td><strong>' + fmt(ptTotal) + '</strong></td>';
      h += '</tr>';
    });
    h += '</tbody></table>';
    h += '<div class="ae-note">Aftermarket parts are highlighted. OEM parts are original manufacturer quality. Remanufactured are factory-rebuilt.</div>';
  }

  if (repair.notes) h += '<div class="ae-note" style="margin-top:12px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#92400e;">' + repair.notes + '</div>';
  if (ageAdj > 1.0) h += '<div class="ae-note">Labor adjusted +' + Math.round((ageAdj-1)*100) + '% for older vehicle (more time to access parts).</div>';

  h += '</div>';

  // CTA
  h += '<div class="ae-cta">';
  h += '<p style="margin:0 0 8px;font-weight:600;">Have a quote for this repair?</p>';
  h += '<p style="margin:0 0 12px;font-size:14px;color:var(--text-secondary);">Upload it and Trudy checks every line item against this benchmark.</p>';
  h += '<a href="/auto-repair-quote-analyzer.html" class="ae-btn" style="display:inline-block;width:auto;padding:12px 24px;text-decoration:none;">Upload My Quote</a>';
  h += '</div>';

  document.getElementById("result").style.display = "block";
  document.getElementById("result").innerHTML = h;
  document.getElementById("result").scrollIntoView({behavior:"smooth"});
});

// URL params
var p = new URLSearchParams(window.location.search);
if (p.get("repair")) document.getElementById("repairSelect").value = p.get("repair");
if (p.get("year")) document.getElementById("yearInput").value = p.get("year");
if (p.get("make")) document.getElementById("makeInput").value = p.get("make");
if (p.get("model")) document.getElementById("modelInput").value = p.get("model");
if (p.get("state")) document.getElementById("stateSelect").value = p.get("state").toUpperCase();
if (p.get("city")) document.getElementById("cityInput").value = p.get("city");
</script>
<script src="/js/tp-analytics.min.js" async></script>
</body>
</html>'''

out = os.path.join(os.path.dirname(__file__), '..', 'auto-estimate.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written {len(html)} chars')
