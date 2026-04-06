#!/usr/bin/env python3
"""Build the medical cost lookup page with embedded CPT data."""
import json, os

with open(os.path.join(os.path.dirname(__file__), '..', 'data', 'medical-cpt-pricing.json')) as f:
    d = json.load(f)

codes_js = json.dumps(d['commonCPTCodes'], separators=(',',':'))
states_js = json.dumps(d['gpciLocalities']['stateMultipliers'], separators=(',',':'))
commercial_js = json.dumps(d['commercialByState'], separators=(',',':'))
fac_js = json.dumps({k:v for k,v in d['facilityMultipliers'].items() if k != 'notes'}, separators=(',',':'))

states_list = sorted(d['gpciLocalities']['stateMultipliers'].keys())
state_opts = ''.join(f'<option value="{s}">{s}</option>' for s in states_list)

html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<link rel="icon" href="/favicon-trudy.svg" type="image/svg+xml" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>What Should This Procedure Cost? | TruePrice</title>
<meta name="description" content="Search 146 medical procedures by name or CPT code. See Medicare rate, commercial estimate, and fair price in your state. Compare facility costs. Free." />
<link rel="canonical" href="https://truepricehq.com/medical-cost-lookup.html" />
<meta name="robots" content="index,follow" />
<meta property="og:title" content="What Should This Procedure Cost? | TruePrice" />
<meta property="og:description" content="Search 146 procedures. See Medicare vs commercial pricing for your state." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://truepricehq.com/medical-cost-lookup.html" />
<meta property="og:site_name" content="TruePrice" />
<meta property="og:image" content="https://truepricehq.com/images/trueprice-social.svg" />
<link rel="stylesheet" href="/css/trueprice.min.css" />
<style>
.mcl-wrap{max-width:800px;margin:0 auto;padding:32px 16px;}
.mcl-hero{text-align:center;margin-bottom:32px;}
.mcl-hero h1{font-size:28px;margin-bottom:8px;}
.mcl-hero p{color:var(--text-secondary);font-size:16px;}
.mcl-search{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;}
.mcl-search input{flex:2;min-width:200px;padding:12px 16px;border:1px solid var(--border);border-radius:10px;font-size:16px;}
.mcl-search input:focus{outline:none;border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.15);}
.mcl-search select{flex:1;min-width:100px;padding:12px;border:1px solid var(--border);border-radius:10px;font-size:14px;}
.mcl-results{display:flex;flex-direction:column;gap:12px;}
.mcl-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:20px;}
.mcl-card h3{margin:0 0 4px;font-size:16px;}
.mcl-card .cpt{color:#0d9488;font-weight:600;font-size:13px;}
.mcl-card .cat{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#f0fdfa;color:#0d9488;margin-left:6px;}
.mcl-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0;}
.mcl-price{padding:12px;background:#f8fafc;border-radius:10px;text-align:center;}
.mcl-price .label{font-size:11px;color:var(--text-muted);text-transform:uppercase;}
.mcl-price .value{font-size:20px;font-weight:700;color:#1e293b;}
.mcl-price.medicare .value{color:#0d9488;}
.mcl-price.commercial .value{color:#d97706;}
.mcl-price.fair .value{color:#1d4ed8;}
.mcl-facilities{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
.mcl-fac{padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#f1f5f9;color:#475569;}
.mcl-fac.best{background:#d1fae5;color:#065f46;}
.mcl-note{font-size:12px;color:var(--text-muted);margin-top:6px;}
.mcl-share{font-size:12px;color:#0d9488;cursor:pointer;float:right;}
.mcl-share:hover{text-decoration:underline;}
.mcl-empty{text-align:center;padding:40px;color:var(--text-secondary);}
.mcl-count{font-size:13px;color:var(--text-muted);margin-bottom:12px;}
@media(max-width:500px){.mcl-prices{grid-template-columns:1fr;}}
</style>
</head>
<body>
<header class="site-header"><div class="container"><a class="logo" href="/">TruePrice</a><nav><a href="/guides.html">Guides</a><a href="/medical-bill-analyzer.html">Bill Analyzer</a><a class="nav-cta" href="/analyze-quote.html">Check My Price</a></nav></div></header>

<main class="mcl-wrap">
<div class="mcl-hero">
<img src="/images/trudy-medical.png" alt="Trudy" width="100" style="margin-bottom:8px;" />
<h1>What Should This Cost?</h1>
<p>Search any procedure or CPT code. See the fair price in your state.</p>
</div>

<div class="mcl-search">
<input type="text" id="searchInput" placeholder="Search procedure or CPT code (e.g. MRI brain, 99213)" autocomplete="off" />
<select id="stateSelect"><option value="">State</option>''' + state_opts + '''</select>
<select id="facilitySelect">
<option value="hospital_outpatient">Hospital Outpatient</option>
<option value="ambulatory_surgery_center">Surgery Center (ASC)</option>
<option value="physician_office">Physician Office</option>
<option value="emergency_room">Emergency Room</option>
<option value="freestanding_imaging">Freestanding Imaging</option>
<option value="freestanding_lab">Freestanding Lab</option>
</select>
</div>

<div id="resultCount" class="mcl-count"></div>
<div id="results" class="mcl-results"><div class="mcl-empty">Type at least 2 characters to search 146 procedures.</div></div>

<div style="margin-top:24px;padding:12px;background:#f8fafc;border-radius:10px;font-size:11px;color:var(--text-muted);text-align:center;">
Prices based on CMS Medicare Physician Fee Schedule 2026 and RAND commercial rate studies. Not medical advice. Actual costs vary by provider, insurance, and circumstances.
</div>
</main>

<footer class="site-footer"><div class="container"><p>TruePrice helps consumers understand healthcare costs. <a href="/privacy.html" style="color:inherit;">Privacy</a> | <a href="/terms.html" style="color:inherit;">Terms</a></p></div></footer>

<script>
var CPT=''' + codes_js + ''';
var STATES=''' + states_js + ''';
var COM=''' + commercial_js + ''';
var FAC=''' + fac_js + ''';

var sEl=document.getElementById("searchInput"),stEl=document.getElementById("stateSelect"),fEl=document.getElementById("facilitySelect");
var rEl=document.getElementById("results"),cEl=document.getElementById("resultCount");
function fmt(n){return "$"+Math.round(n).toLocaleString();}
function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}

function doSearch(){
  var q=sEl.value.trim().toLowerCase(),st=stEl.value,fc=fEl.value;
  if(q.length<2){rEl.innerHTML='<div class="mcl-empty">Type at least 2 characters to search 146 procedures.</div>';cEl.textContent="";return;}
  var sm=st&&STATES[st]?STATES[st]:1.0,cm=st&&COM[st]?COM[st]:2.54,fm=typeof FAC[fc]==="number"?FAC[fc]:1.0;
  var matches=[];
  for(var code in CPT){var c=CPT[code];if(c.description.toLowerCase().indexOf(q)>-1||code.indexOf(q)>-1)matches.push({code:code,d:c});}
  if(!matches.length){rEl.innerHTML='<div class="mcl-empty">No procedures found.</div>';cEl.textContent="";return;}
  cEl.textContent=matches.length+" procedure"+(matches.length!==1?"s":"")+" found";
  var h="";
  matches.slice(0,30).forEach(function(m){
    var c=m.d,med=Math.round(c.medicareRate*sm*fm),com=Math.round(c.medicareRate*cm),lo=med,hi=Math.round(com*1.1);
    var stL=st||"national";
    var asc=Math.round(c.medicareRate*sm*0.58),img=Math.round(c.medicareRate*sm*0.40),er=Math.round(c.medicareRate*sm*2.8),off=Math.round(c.medicareRate*sm*0.45);
    h+='<div class="mcl-card">';
    h+='<span class="mcl-share" onclick="var t=\\''+esc(c.description)+' (CPT '+m.code+') in '+stL+': Medicare '+fmt(med)+', Commercial ~'+fmt(com)+'. truepricehq.com/medical-cost-lookup.html\\';navigator.clipboard.writeText(t);this.textContent=\\'Copied!\\'">Share</span>';
    h+='<h3>'+esc(c.description)+' <span class="cat">'+c.category.replace(/_/g," ")+'</span></h3>';
    h+='<div class="cpt">CPT '+m.code+'</div>';
    h+='<div class="mcl-prices">';
    h+='<div class="mcl-price medicare"><div class="label">Medicare ('+stL+')</div><div class="value">'+fmt(med)+'</div></div>';
    h+='<div class="mcl-price commercial"><div class="label">Commercial Est.</div><div class="value">'+fmt(com)+'</div></div>';
    h+='<div class="mcl-price fair"><div class="label">Fair Range</div><div class="value">'+fmt(lo)+'-'+fmt(hi)+'</div></div>';
    h+='</div>';
    if(c.category==="imaging"||c.category==="surgery"||c.category==="procedure"){
      h+='<div class="mcl-facilities">';
      h+='<span class="mcl-fac best">ASC: '+fmt(asc)+'</span>';
      h+='<span class="mcl-fac best">Imaging Ctr: '+fmt(img)+'</span>';
      h+='<span class="mcl-fac">Office: '+fmt(off)+'</span>';
      h+='<span class="mcl-fac" style="background:#fee2e2;color:#991b1b;">ER: '+fmt(er)+'</span>';
      h+='</div>';
    }
    if(c.notes)h+='<div class="mcl-note">'+esc(c.notes)+'</div>';
    h+='</div>';
  });
  if(matches.length>30)h+='<div class="mcl-empty">Showing 30 of '+matches.length+'. Narrow your search.</div>';
  rEl.innerHTML=h;
}

sEl.addEventListener("input",doSearch);
stEl.addEventListener("change",doSearch);
fEl.addEventListener("change",doSearch);
var p=new URLSearchParams(window.location.search);
if(p.get("state"))stEl.value=p.get("state").toUpperCase();
if(p.get("q")){sEl.value=p.get("q");doSearch();}
</script>
<script src="/js/tp-analytics.min.js" async></script>
</body>
</html>'''

out = os.path.join(os.path.dirname(__file__), '..', 'medical-cost-lookup.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written {len(html)} chars')
