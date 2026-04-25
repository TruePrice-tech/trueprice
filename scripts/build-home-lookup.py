#!/usr/bin/env python3
"""Build the home services cost lookup page."""
import json, os

# National average price ranges by service (for a typical project)
services = {
    "roofing": {"label": "Roof Replacement", "range": [8000, 15000], "unit": "2,000 sq ft home", "notes": "Architectural shingles. Metal/tile 2-3x more."},
    "hvac": {"label": "HVAC Replacement", "range": [4500, 12000], "unit": "full system", "notes": "Central AC + furnace. Heat pump similar range."},
    "plumbing": {"label": "Plumbing", "range": [200, 5000], "unit": "varies by job", "notes": "Water heater $800-2K. Repipe $2-5K. Drain $150-500."},
    "electrical": {"label": "Electrical", "range": [200, 4000], "unit": "varies by job", "notes": "Panel upgrade $1-3K. Rewire $3-8K. Outlet $150-300."},
    "painting": {"label": "Interior/Exterior Painting", "range": [2000, 6000], "unit": "average home", "notes": "Interior 2-3 rooms $1-2K. Full exterior $3-6K."},
    "concrete": {"label": "Concrete Work", "range": [1500, 8000], "unit": "driveway/patio", "notes": "Driveway $3-6K. Patio $1.5-4K. Stamped +50%."},
    "siding": {"label": "Siding Replacement", "range": [5000, 15000], "unit": "average home", "notes": "Vinyl cheapest. Fiber cement mid. Wood highest."},
    "insulation": {"label": "Insulation", "range": [1500, 5000], "unit": "attic or walls", "notes": "Blown-in attic $1-2K. Spray foam $2-5K."},
    "fencing": {"label": "Fencing", "range": [1500, 6000], "unit": "average yard", "notes": "Wood $15-30/ft. Vinyl $20-40/ft. Chain link $10-20/ft."},
    "landscaping": {"label": "Landscaping", "range": [2000, 10000], "unit": "project", "notes": "Sod $1-3K. Pavers $2-8K. Retaining wall $3-10K."},
    "foundation": {"label": "Foundation Repair", "range": [2000, 15000], "unit": "varies", "notes": "Pier $1-3K each. Slabjacking $500-1.5K. Wall stabilization $5-15K."},
    "windows": {"label": "Window Replacement", "range": [3000, 10000], "unit": "5-10 windows", "notes": "Vinyl $300-600/window. Fiberglass $500-900. Wood $600-1.2K."},
    "garage-doors": {"label": "Garage Door", "range": [800, 3000], "unit": "single or double", "notes": "Single $800-1.5K. Double $1-2.5K. Opener $300-600."},
    "solar": {"label": "Solar Installation", "range": [15000, 30000], "unit": "6-10kW system", "notes": "Before tax credits. Federal 30% ITC reduces cost significantly."},
    "kitchen": {"label": "Kitchen Remodel", "range": [10000, 40000], "unit": "mid-range", "notes": "Minor $10-20K. Mid $20-40K. Major $40-80K+."},
    "gutters": {"label": "Gutters", "range": [1000, 3000], "unit": "average home", "notes": "Aluminum $6-12/ft. Seamless $8-15/ft. Gutter guards +$5-10/ft."}
}

svc_js = json.dumps(services, separators=(',',':'))

states = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]
state_opts = ''.join(f'<option value="{s}">{s}</option>' for s in states)

svc_opts = ''.join(f'<option value="{k}">{v["label"]}</option>' for k,v in services.items())

html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<link rel="icon" href="/favicon-trudy.svg" type="image/svg+xml" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>What Should This Home Project Cost? | Woogoro</title>
<meta name="description" content="Pick your home project and city. See fair price range for roofing, HVAC, plumbing, electrical, and 12 more services. Free instant estimates." />
<link rel="canonical" href="https://woogoro.com/home-cost-lookup.html" />
<meta name="robots" content="index,follow" />
<meta property="og:title" content="What Should This Home Project Cost? | Woogoro" />
<meta property="og:description" content="Pick a service and city. See fair prices for 16 home services." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://woogoro.com/home-cost-lookup.html" />
<meta property="og:site_name" content="Woogoro" />
<meta property="og:image" content="https://woogoro.com/images/woogoro-social.png" />
<link rel="stylesheet" href="/css/woogoro.min.css" />
<style>
.hcl-wrap{max-width:800px;margin:0 auto;padding:32px 16px;}
.hcl-hero{text-align:center;margin-bottom:32px;}
.hcl-hero h1{font-size:28px;margin-bottom:8px;}
.hcl-hero p{color:var(--text-secondary);font-size:16px;}
.hcl-search{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;}
.hcl-search select,.hcl-search input{flex:1;min-width:120px;padding:12px;border:1px solid var(--border);border-radius:10px;font-size:14px;}
.hcl-search select:focus,.hcl-search input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(29,78,216,0.15);}
.hcl-search button{padding:12px 24px;border:none;border-radius:10px;background:var(--brand);color:#fff;font-size:15px;font-weight:600;cursor:pointer;}
.hcl-result{display:none;}
.hcl-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:16px;}
.hcl-price-box{text-align:center;padding:24px;background:var(--bg-subtle);border-radius:12px;margin:16px 0;}
.hcl-price-box .label{font-size:14px;color:var(--text-muted);}
.hcl-price-box .value{font-size:36px;font-weight:800;color:var(--brand);}
.hcl-price-box .sub{font-size:13px;color:var(--text-secondary);}
.hcl-badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;}
.hcl-badge.above{background:#fef2f2;color:#dc2626;}
.hcl-badge.below{background:#f0fdf4;color:#16a34a;}
.hcl-badge.avg{background:#f0f9ff;color:#1d4ed8;}
.hcl-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;}
.hcl-links a{padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;}
.hcl-share{font-size:12px;color:var(--brand);cursor:pointer;float:right;}
.hcl-share:hover{text-decoration:underline;}
.hcl-note{font-size:13px;color:var(--text-muted);margin-top:8px;}
.hcl-loading{text-align:center;padding:20px;color:var(--text-muted);display:none;}
@media(max-width:500px){.hcl-search{flex-direction:column;}}
</style>
</head>
<body>
<header class="site-header"><div class="container"><a class="logo" href="/">Woogoro</a><nav><a href="/guides.html">Guides</a><a href="/just-browsing.html">Just Browsing</a><a class="nav-cta" href="/analyze-my-quote.html">I Have a Quote</a></nav></div></header>

<main class="hcl-wrap">
<div class="hcl-hero">
<img src="/images/trudy-thinking.png" alt="Trudy" width="100" style="margin-bottom:8px;" />
<h1>What Should This Cost?</h1>
<p>Pick your project and city for an instant price estimate.</p>
</div>

<div class="hcl-search">
<select id="svcSelect"><option value="">Select Service</option>''' + svc_opts + '''</select>
<input type="text" id="cityInput" placeholder="City (e.g. Charlotte)" />
<select id="stateSelect"><option value="">State</option>''' + state_opts + '''</select>
<button id="lookupBtn">See Prices</button>
</div>

<div id="loading" class="hcl-loading">Looking up local pricing...</div>
<div id="result" class="hcl-result"></div>

<div style="margin-top:24px;padding:12px;background:#f8fafc;border-radius:10px;font-size:11px;color:var(--text-muted);text-align:center;">
Estimates based on national averages adjusted by local cost multipliers. Actual costs vary by project scope, materials, and contractor. Not professional advice.
</div>
</main>

<footer class="site-footer"><div class="container"><p>Woogoro helps homeowners understand fair pricing. <a href="/privacy.html" style="color:inherit;">Privacy</a> | <a href="/terms.html" style="color:inherit;">Terms</a></p></div></footer>

<script>
var SVCS=''' + svc_js + ''';

function fmt(n){return "$"+Math.round(n).toLocaleString();}

document.getElementById("lookupBtn").addEventListener("click", function(){
  var svc=document.getElementById("svcSelect").value;
  var city=document.getElementById("cityInput").value.trim();
  var st=document.getElementById("stateSelect").value;
  if(!svc){alert("Select a service.");return;}
  if(!st){alert("Select a state.");return;}

  var loadEl=document.getElementById("loading");
  var resEl=document.getElementById("result");
  loadEl.style.display="block";
  resEl.style.display="none";

  // Fetch city multiplier from API
  var url="/api/city-multiplier?state="+encodeURIComponent(st)+"&service="+encodeURIComponent(svc==="gutters"?"roofing":svc);
  if(city) url+="&city="+encodeURIComponent(city);

  fetch(url).then(function(r){return r.json();}).then(function(d){
    loadEl.style.display="none";
    resEl.style.display="block";
    var mult=d.svcMult||d.multiplier||1.0;
    var s=SVCS[svc];
    var lo=Math.round(s.range[0]*mult);
    var hi=Math.round(s.range[1]*mult);
    var mid=Math.round((lo+hi)/2);
    var natMid=Math.round((s.range[0]+s.range[1])/2);
    var pct=Math.round((mult-1)*100);
    var badgeClass=pct>3?"above":pct<-3?"below":"avg";
    var badgeText=pct>3?pct+"% above national avg":pct<-3?Math.abs(pct)+"% below national avg":"Near national average";
    var locLabel=city?(city+", "+st):st;

    var slug=(city?city.toLowerCase().replace(/\\s+/g,"-")+"-"+st.toLowerCase():"");
    var cityPageLink=slug?"/"+slug+"-"+svc.replace("_","-")+"-cost.html":"";

    var shareText=s.label+" in "+locLabel+": "+fmt(lo)+" - "+fmt(hi)+". "+badgeText+". woogoro.com/home-cost-lookup.html";

    var h='<div class="hcl-card">';
    h+='<span class="hcl-share" onclick="navigator.clipboard.writeText(\\''+shareText.replace(/'/g,"\\\\'")+'\\'');this.textContent=\\'Copied!\\'">Share</span>';
    h+='<h3>'+s.label+' in '+locLabel+'</h3>';
    h+='<span class="hcl-badge '+badgeClass+'">'+badgeText+'</span>';
    h+='<div class="hcl-price-box">';
    h+='<div class="label">Estimated Cost</div>';
    h+='<div class="value">'+fmt(lo)+' - '+fmt(hi)+'</div>';
    h+='<div class="sub">'+s.unit+'</div>';
    h+='</div>';
    if(s.notes) h+='<div class="hcl-note">'+s.notes+'</div>';
    h+='<div class="hcl-links">';
    h+='<a href="/analyze-my-quote.html" style="background:var(--brand);color:#fff;">Have a quote? Check it</a>';
    if(cityPageLink) h+='<a href="'+cityPageLink+'" style="background:var(--bg-subtle);color:var(--brand);">Detailed '+locLabel+' pricing</a>';
    h+='</div>';
    h+='</div>';
    resEl.innerHTML=h;
  }).catch(function(){
    loadEl.style.display="none";
    resEl.style.display="block";
    // Fallback without API
    var s=SVCS[svc];
    resEl.innerHTML='<div class="hcl-card"><h3>'+s.label+'</h3><div class="hcl-price-box"><div class="label">National Average</div><div class="value">'+fmt(s.range[0])+' - '+fmt(s.range[1])+'</div><div class="sub">'+s.unit+'</div></div>'+(s.notes?'<div class="hcl-note">'+s.notes+'</div>':'')+'<div class="hcl-links"><a href="/analyze-my-quote.html" style="background:var(--brand);color:#fff;">Have a quote? Check it</a></div></div>';
  });
});

// URL params
var p=new URLSearchParams(window.location.search);
if(p.get("service"))document.getElementById("svcSelect").value=p.get("service");
if(p.get("city"))document.getElementById("cityInput").value=p.get("city");
if(p.get("state"))document.getElementById("stateSelect").value=p.get("state").toUpperCase();
</script>
<script src="/js/tp-analytics.min.js" async></script>
</body>
</html>'''

out = os.path.join(os.path.dirname(__file__), '..', 'home-cost-lookup.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written {len(html)} chars')
