#!/usr/bin/env python3
"""Build precise home service estimator with all 16 verticals' job data."""
import json, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')

# Load all pricing data
all_jobs = {}
service_labels = {}

files = {
    'hvac': 'hvac-pricing-model.json',
    'plumbing': 'plumbing-pricing.json',
    'electrical': 'electrical-pricing.json',
    'painting': 'painting-pricing.json',
    'foundation': 'foundation-pricing.json',
    'windows': 'windows-pricing.json',
    'siding': 'siding-pricing.json',
    'solar': 'solar-pricing.json',
    'fencing': 'fencing-pricing.json',
    'concrete': 'concrete-pricing.json',
    'landscaping': 'landscaping-pricing.json',
    'garage-door': 'garage-door-pricing.json',
    'kitchen': 'kitchen-pricing.json',
    'insulation': 'insulation-pricing.json',
    'gutters': 'gutters-pricing.json',
}

nice_labels = {
    'hvac': 'HVAC', 'plumbing': 'Plumbing', 'electrical': 'Electrical',
    'painting': 'Painting', 'foundation': 'Foundation', 'windows': 'Windows',
    'siding': 'Siding', 'solar': 'Solar', 'fencing': 'Fencing',
    'concrete': 'Concrete', 'landscaping': 'Landscaping', 'garage-door': 'Garage Door',
    'kitchen': 'Kitchen Remodel', 'insulation': 'Insulation', 'gutters': 'Gutters',
}

# Also add roofing from the main pricing
roofing_jobs = {
    "asphalt_roof_2000": {"label": "Asphalt Shingle Roof (2000 sqft)", "total": [6000, 12000], "service": "roofing"},
    "architectural_roof_2000": {"label": "Architectural Shingle Roof (2000 sqft)", "total": [8000, 15000], "service": "roofing"},
    "metal_roof_2000": {"label": "Standing Seam Metal Roof (2000 sqft)", "total": [18000, 35000], "service": "roofing"},
    "tile_roof_2000": {"label": "Tile Roof (2000 sqft)", "total": [20000, 40000], "service": "roofing"},
    "flat_roof_1500": {"label": "Flat/TPO Roof (1500 sqft)", "total": [5000, 12000], "service": "roofing"},
    "roof_repair": {"label": "Roof Repair (partial)", "total": [300, 1500], "service": "roofing"},
}
all_jobs['roofing'] = roofing_jobs
nice_labels['roofing'] = 'Roofing'

for svc, fname in files.items():
    path = os.path.join(DATA, fname)
    if not os.path.exists(path):
        print(f'  SKIP {fname} (not found)')
        continue
    with open(path) as f:
        d = json.load(f)

    jobs = {}
    # HVAC has systemTypes instead of commonJobs
    if 'systemTypes' in d:
        for stype, sdata in d['systemTypes'].items():
            if 'pricingByEfficiency' in sdata:
                for eff, prices in sdata['pricingByEfficiency'].items():
                    key = f"{stype}_{eff}"
                    total = prices.get('total', [0, 0])
                    jobs[key] = {"label": f"{sdata['label']} ({eff.replace('_', ' ')})", "total": total, "service": svc}
            elif 'pricingByZones' in sdata:
                for zone, prices in sdata['pricingByZones'].items():
                    key = f"{stype}_{zone}"
                    total = prices.get('total', [0, 0])
                    jobs[key] = {"label": f"{sdata['label']} ({zone.replace('_', ' ')})", "total": total, "service": svc}
            elif 'pricingBySize' in sdata:
                for size, prices in sdata['pricingBySize'].items():
                    key = f"{stype}_{size}"
                    total = prices.get('total', [0, 0])
                    jobs[key] = {"label": f"{sdata['label']} ({size})", "total": total, "service": svc}
    elif 'commonJobs' in d:
        for jkey, jdata in d['commonJobs'].items():
            total = jdata.get('total', jdata.get('totalRange', [0, 0]))
            # Handle per-unit pricing
            if isinstance(total, list) and len(total) == 2:
                per_foot = jdata.get('per_foot', False)
                per_unit = jdata.get('per_unit', False)
                note = ""
                if per_foot:
                    note = " (per linear foot)"
                elif per_unit:
                    note = " (per unit)"
                jobs[jkey] = {"label": jdata['label'] + note, "total": total, "service": svc, "per_foot": per_foot, "per_unit": per_unit}
            else:
                jobs[jkey] = {"label": jdata['label'], "total": [0, 0], "service": svc}

    all_jobs[svc] = jobs

# Load state multipliers (use city-cost-multipliers for roofing, state from others)
with open(os.path.join(DATA, 'city-cost-multipliers.json')) as f:
    city_mults = json.load(f)

# Get a generic state multiplier map
state_mults = {}
for key, val in city_mults.items():
    parts = key.split('|')
    if len(parts) == 2:
        st = parts[1]
        if st not in state_mults:
            state_mults[st] = []
        state_mults[st].append(val.get('multiplier', 1.0))

avg_state_mults = {}
for st, mults in state_mults.items():
    avg_state_mults[st] = round(sum(mults) / len(mults), 3)

# Tax rates
tax_rates = {
    "AL":0.04,"AK":0.0,"AZ":0.056,"AR":0.065,"CA":0.0725,"CO":0.029,"CT":0.0635,"DE":0.0,
    "FL":0.06,"GA":0.04,"HI":0.04,"ID":0.06,"IL":0.0625,"IN":0.07,"IA":0.06,"KS":0.065,
    "KY":0.06,"LA":0.0445,"ME":0.055,"MD":0.06,"MA":0.0625,"MI":0.06,"MN":0.0688,"MS":0.07,
    "MO":0.0423,"MT":0.0,"NE":0.055,"NV":0.0685,"NH":0.0,"NJ":0.0663,"NM":0.0513,"NY":0.04,
    "NC":0.0475,"ND":0.05,"OH":0.0575,"OK":0.045,"OR":0.0,"PA":0.06,"RI":0.07,"SC":0.06,
    "SD":0.045,"TN":0.07,"TX":0.0625,"UT":0.061,"VT":0.06,"VA":0.053,"WA":0.065,"WV":0.06,
    "WI":0.05,"WY":0.04,"DC":0.06
}

# Build compact JS data
jobs_by_service = {}
for svc, jobs in all_jobs.items():
    jobs_by_service[svc] = {}
    for jkey, jdata in jobs.items():
        jobs_by_service[svc][jkey] = {
            "l": jdata['label'],
            "t": jdata['total'],
        }
        if jdata.get('per_foot'):
            jobs_by_service[svc][jkey]["pf"] = True
        if jdata.get('per_unit'):
            jobs_by_service[svc][jkey]["pu"] = True

total_jobs = sum(len(j) for j in jobs_by_service.values())
jobs_js = json.dumps(jobs_by_service, separators=(',',':'))
labels_js = json.dumps(nice_labels, separators=(',',':'))
states_js = json.dumps(avg_state_mults, separators=(',',':'))
tax_js = json.dumps(tax_rates, separators=(',',':'))
state_opts = ''.join(f'<option value="{s}">{s}</option>' for s in sorted(avg_state_mults.keys()))

html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<link rel="icon" href="/favicon-trudy.svg" type="image/svg+xml" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Home Service Cost Estimator | Woogoro</title>
<meta name="description" content="Get precise cost estimates for ''' + str(total_jobs) + ''' home services across 16 categories. Pick your project, enter your location, see labor + materials + tax. City-level pricing." />
<link rel="canonical" href="https://woogoro.com/home-estimate.html" />
<meta name="robots" content="index,follow" />
<link rel="stylesheet" href="/css/trueprice.min.css" />
<style>
.he-wrap{max-width:800px;margin:0 auto;padding:32px 16px;}
.he-hero{text-align:center;margin-bottom:32px;}
.he-hero h1{font-size:28px;margin-bottom:8px;}
.he-hero p{color:var(--text-secondary);font-size:16px;}
.he-form{display:flex;flex-direction:column;gap:12px;margin-bottom:24px;}
.he-row{display:flex;gap:10px;flex-wrap:wrap;}
.he-row>*{flex:1;min-width:140px;}
.he-form label{font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:4px;}
.he-form select,.he-form input{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;}
.he-form select:focus,.he-form input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(29,78,216,0.15);}
.he-btn{padding:14px 24px;border:none;border-radius:10px;background:var(--brand);color:#fff;font-size:16px;font-weight:700;cursor:pointer;width:100%;}
.he-result{display:none;}
.he-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:16px;}
.he-total-box{text-align:center;padding:24px;background:var(--bg-subtle);border-radius:12px;margin:16px 0;}
.he-total-box .total{font-size:42px;font-weight:800;color:var(--brand);}
.he-total-box .range{font-size:14px;color:var(--text-secondary);}
.he-breakdown{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;}
.he-breakdown-item{padding:12px;background:#f8fafc;border-radius:8px;}
.he-breakdown-item .label{font-size:11px;color:var(--text-muted);text-transform:uppercase;}
.he-breakdown-item .value{font-size:18px;font-weight:700;color:#1e293b;}
.he-share{font-size:12px;color:var(--brand);cursor:pointer;float:right;}
.he-share:hover{text-decoration:underline;}
.he-quantity{display:none;margin-top:8px;}
@media(max-width:500px){.he-breakdown{grid-template-columns:1fr;}.he-row{flex-direction:column;}}
</style>
</head>
<body>
<header class="site-header"><div class="container"><a class="logo" href="/">Woogoro</a><nav><a href="/guides.html">Guides</a><a href="/just-browsing.html">Just Browsing</a><a class="nav-cta" href="/analyze-my-quote.html">I Have a Quote</a></nav></div></header>

<main class="he-wrap">
<div class="he-hero">
<img src="/images/trudy-thinking.png" alt="Trudy" width="100" style="margin-bottom:8px;" />
<h1>How Much Should This Cost?</h1>
<p>Pick your project, enter your location, get a precise estimate with tax.</p>
</div>

<div class="he-form">
<div class="he-row">
<div><label>Category</label><select id="catSelect"><option value="">Select category...</option></select></div>
<div><label>Specific Service</label><select id="jobSelect"><option value="">Select service...</option></select></div>
</div>
<div id="quantityRow" class="he-quantity">
<label id="quantityLabel">Quantity</label>
<input type="number" id="quantityInput" min="1" value="1" />
</div>
<div class="he-row">
<div><label>City (optional)</label><input type="text" id="cityInput" placeholder="e.g. Charlotte" /></div>
<div><label>State</label><select id="stateSelect"><option value="">State</option>''' + state_opts + '''</select></div>
</div>
<div><label>Home Size (sq ft, if applicable)</label><input type="number" id="sqftInput" placeholder="e.g. 2000" min="500" max="10000" /></div>
<button class="he-btn" id="estimateBtn">Get My Estimate</button>
</div>

<div id="result" class="he-result"></div>

<div style="padding:12px;background:#f8fafc;border-radius:10px;font-size:11px;color:var(--text-muted);text-align:center;">
Estimates based on industry labor guides, material pricing, and state-level cost data. Actual costs vary by contractor, materials chosen, and project complexity. Not professional advice.
</div>
</main>

<footer class="site-footer"><div class="container"><p>Woogoro helps homeowners understand fair pricing. <a href="/privacy.html" style="color:inherit;">Privacy</a> | <a href="/terms.html" style="color:inherit;">Terms</a></p></div></footer>

<script>
var JOBS=''' + jobs_js + ''';
var LABELS=''' + labels_js + ''';
var STATES=''' + states_js + ''';
var TAX=''' + tax_js + ''';

var catEl=document.getElementById("catSelect");
var jobEl=document.getElementById("jobSelect");
var qRow=document.getElementById("quantityRow");
var qLabel=document.getElementById("quantityLabel");
var qInput=document.getElementById("quantityInput");

// Populate categories
Object.keys(LABELS).sort(function(a,b){return LABELS[a].localeCompare(LABELS[b]);}).forEach(function(k){
  var o=document.createElement("option");o.value=k;o.textContent=LABELS[k];catEl.appendChild(o);
});

catEl.addEventListener("change",function(){
  jobEl.innerHTML='<option value="">Select service...</option>';
  qRow.style.display="none";
  var cat=catEl.value;
  if(!cat||!JOBS[cat])return;
  var jobs=JOBS[cat];
  Object.keys(jobs).sort(function(a,b){return jobs[a].l.localeCompare(jobs[b].l);}).forEach(function(k){
    var o=document.createElement("option");o.value=k;o.textContent=jobs[k].l;jobEl.appendChild(o);
  });
});

jobEl.addEventListener("change",function(){
  var cat=catEl.value,jk=jobEl.value;
  if(!cat||!jk||!JOBS[cat]||!JOBS[cat][jk]){qRow.style.display="none";return;}
  var j=JOBS[cat][jk];
  if(j.pf){qRow.style.display="block";qLabel.textContent="Linear Feet";qInput.value=100;qInput.placeholder="e.g. 150";}
  else if(j.pu){qRow.style.display="block";qLabel.textContent="Quantity (windows, piers, etc.)";qInput.value=1;qInput.placeholder="e.g. 10";}
  else{qRow.style.display="none";}
});

function fmt(n){return "$"+Math.round(n).toLocaleString();}

document.getElementById("estimateBtn").addEventListener("click",function(){
  var cat=catEl.value,jk=jobEl.value;
  var state=document.getElementById("stateSelect").value;
  var city=document.getElementById("cityInput").value.trim();
  var sqft=parseInt(document.getElementById("sqftInput").value)||0;
  if(!cat||!jk){alert("Select a category and service.");return;}
  if(!state){alert("Select your state.");return;}

  var j=JOBS[cat][jk];
  var sm=STATES[state]||1.0;
  var taxRate=TAX[state]||0.06;
  var qty=j.pf||j.pu?parseInt(qInput.value)||1:1;

  var baseLow=j.t[0],baseHigh=j.t[1];
  // For per-unit/per-foot, the base IS per unit
  if(j.pf||j.pu){baseLow*=qty;baseHigh*=qty;}

  // Apply state multiplier
  var adjLow=Math.round(baseLow*sm);
  var adjHigh=Math.round(baseHigh*sm);
  var adjMid=Math.round((adjLow+adjHigh)/2);

  // Estimate labor vs materials split (~50/50 for most home services)
  var laborPct=0.50;
  if(cat==="painting")laborPct=0.65;
  else if(cat==="solar"||cat==="windows"||cat==="garage-door")laborPct=0.35;
  else if(cat==="kitchen")laborPct=0.40;

  var laborMid=Math.round(adjMid*laborPct);
  var materialsMid=Math.round(adjMid*(1-laborPct));
  var taxMid=Math.round(materialsMid*taxRate);
  var totalMid=adjMid+taxMid;
  var totalLow=adjLow+Math.round(adjLow*(1-laborPct)*taxRate);
  var totalHigh=adjHigh+Math.round(adjHigh*(1-laborPct)*taxRate);

  var locLabel=city?city+", "+state:state;
  var shareText=j.l+" in "+locLabel+": "+fmt(totalLow)+" - "+fmt(totalHigh)+". woogoro.com/home-estimate.html";

  var h='<div class="he-card">';
  h+='<span class="he-share" onclick="navigator.clipboard.writeText(\\''+shareText.replace(/'/g,"\\\\'")+'\\'');this.textContent=\\'Copied!\\'">Share</span>';
  h+='<h3>'+j.l+'</h3>';
  h+='<div style="font-size:14px;color:#64748b;">'+locLabel;
  if(j.pf)h+=' &bull; '+qty+' linear feet';
  else if(j.pu)h+=' &bull; '+qty+' units';
  h+='</div>';

  h+='<div class="he-total-box">';
  h+='<div style="font-size:13px;color:var(--text-muted);">Estimated Total (incl. tax)</div>';
  h+='<div class="total">'+fmt(totalMid)+'</div>';
  h+='<div class="range">Range: '+fmt(totalLow)+' - '+fmt(totalHigh)+'</div>';
  h+='</div>';

  h+='<div class="he-breakdown">';
  h+='<div class="he-breakdown-item"><div class="label">Labor (~'+Math.round(laborPct*100)+'%)</div><div class="value">'+fmt(laborMid)+'</div></div>';
  h+='<div class="he-breakdown-item"><div class="label">Materials (~'+Math.round((1-laborPct)*100)+'%)</div><div class="value">'+fmt(materialsMid)+'</div></div>';
  h+='<div class="he-breakdown-item"><div class="label">Tax ('+Math.round(taxRate*1000)/10+'% on materials)</div><div class="value">'+fmt(taxMid)+'</div></div>';
  h+='<div class="he-breakdown-item"><div class="label">State Adjustment</div><div class="value">'+(sm>1.01?"+"+Math.round((sm-1)*100)+"%":sm<0.99?Math.round((sm-1)*100)+"%":"Average")+'</div></div>';
  h+='</div>';

  h+='</div>';

  h+='<div style="text-align:center;margin-top:16px;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">';
  h+='<p style="margin:0 0 8px;font-weight:600;">Have a quote for this project?</p>';
  h+='<p style="margin:0 0 12px;font-size:14px;color:var(--text-secondary);">Upload it and Trudy checks every line against this benchmark.</p>';
  h+='<a href="/analyze-my-quote.html" class="he-btn" style="display:inline-block;width:auto;padding:12px 24px;text-decoration:none;">Upload My Quote</a>';
  h+='</div>';

  document.getElementById("result").style.display="block";
  document.getElementById("result").innerHTML=h;
  document.getElementById("result").scrollIntoView({behavior:"smooth"});
});
</script>
<script src="/js/tp-analytics.min.js" async></script>
</body>
</html>'''

out = os.path.join(os.path.dirname(__file__), '..', 'home-estimate.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written {len(html)} chars, {total_jobs} total jobs across {len(jobs_by_service)} categories')
