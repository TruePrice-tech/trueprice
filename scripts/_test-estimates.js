var puppeteer=require("puppeteer"),http=require("http"),path=require("path"),fs=require("fs");
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
var ROOT=path.dirname(__dirname),PORT=4399;
var server=http.createServer(function(req,res){var u=req.url.split("?")[0];if(u==="/")u="/index.html";var fp=path.join(ROOT,decodeURIComponent(u));if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end("404");return;}var ext=path.extname(fp).toLowerCase();var types={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".wasm":"application/wasm"};res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});fs.createReadStream(fp).pipe(res);});

async function clickDiv(page,t){return await page.evaluate(function(t){var els=Array.from(document.querySelectorAll("div,span")).filter(function(el){return el.offsetParent&&el.textContent.trim()===t&&el.children.length===0;});if(els.length){els[els.length-1].click();return true;}return false;},t);}
async function clickP(page,t){return await page.evaluate(function(t){var re=new RegExp(t,"i");var els=Array.from(document.querySelectorAll("div,span")).filter(function(el){return el.offsetParent&&re.test(el.textContent.trim())&&el.textContent.trim().length<40&&el.children.length===0;});if(els.length){els[0].click();return els[0].textContent.trim();}return null;},t);}
async function fillAddr(page){
  await page.evaluate(function(){function s(sel,v){var el=document.querySelector(sel);if(el){el.focus();el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}}s("input[placeholder*='address' i],input[placeholder*='street' i]","17064 Laurelmont Ct");s("input[placeholder*='city' i]","Fort Mill");s("input[placeholder*='state' i]","SC");s("input[placeholder*='zip' i]","29707");});
  await sleep(500);
  await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/estimate|get/i.test(b.textContent);});if(b[0])b[0].click();});
  await sleep(4000);
}
function getResult(txt){
  var p=txt.match(/ESTIMATED COST\s*\n\s*\$([\d,]+)/);
  var r=txt.match(/Expected range:\s*\$([\d,]+)\s*.\s*\$([\d,]+)/);
  return {price:p?"$"+p[1]:"not found",range:r?"$"+r[1]+"-$"+r[2]:"not found"};
}

(async function(){
  await new Promise(function(r){server.listen(PORT,"127.0.0.1",r);});
  var browser=await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
  var BASE="http://127.0.0.1:"+PORT;

  // CONCRETE
  console.log("=== CONCRETE ===");
  var page=await browser.newPage();await page.setViewport({width:1366,height:900});
  await page.goto(BASE+"/concrete-estimate.html",{waitUntil:"networkidle2",timeout:30000});await sleep(5000);
  await fillAddr(page);
  console.log("1: "+await clickP(page,"Standard Driveway|Driveway"));await sleep(1500);
  console.log("2: "+await clickP(page,"400|sq ft"));await sleep(1500);
  console.log("3: "+await clickP(page,"4 inch|Standard"));await sleep(1500);
  console.log("4: "+await clickP(page,"No demo|None|New pour"));await sleep(1500);
  console.log("5: "+await clickP(page,"Planning|No rush"));await sleep(5000);
  var txt=await page.evaluate(function(){return(document.body.innerText||"").substring(0,600);});
  var res=getResult(txt);
  console.log("Concrete: "+res.price+" Range: "+res.range+"\n");
  await page.close();

  // FENCING
  console.log("=== FENCING ===");
  page=await browser.newPage();await page.setViewport({width:1366,height:900});
  await page.goto(BASE+"/fencing-estimate.html",{waitUntil:"networkidle2",timeout:30000});await sleep(5000);
  await fillAddr(page);
  console.log("1: "+await clickP(page,"Wood Privacy|Privacy"));await sleep(1500);
  console.log("2: "+await clickP(page,"6 ft|6 foot"));await sleep(1500);
  await page.evaluate(function(){var inp=document.querySelector("input[type=number],input[placeholder*=feet i],input[placeholder*=length i]");if(inp){inp.focus();inp.value="150";inp.dispatchEvent(new Event("input",{bubbles:true}));inp.dispatchEvent(new Event("change",{bubbles:true}));}});await sleep(500);
  await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/continue|next/i.test(b.textContent);});if(b[0])b[0].click();});await sleep(1500);
  console.log("3: 150 lf");
  console.log("4: "+await clickP(page,"Planning|No rush"));await sleep(5000);
  txt=await page.evaluate(function(){return(document.body.innerText||"").substring(0,600);});
  res=getResult(txt);
  console.log("Fencing: "+res.price+" Range: "+res.range+"\n");
  await page.close();

  // PAINTING
  console.log("=== PAINTING ===");
  page=await browser.newPage();await page.setViewport({width:1366,height:900});
  await page.goto(BASE+"/painting-estimate.html",{waitUntil:"networkidle2",timeout:30000});await sleep(5000);
  await fillAddr(page);
  console.log("1: "+await clickP(page,"Exterior"));await sleep(1500);
  console.log("2: "+await clickP(page,"2,000|2000"));await sleep(1500);
  console.log("3: "+await clickP(page,"2 coat|Standard"));await sleep(1500);
  console.log("4: "+await clickP(page,"Good|Average"));await sleep(1500);
  console.log("5: "+await clickP(page,"Planning|No rush"));await sleep(5000);
  txt=await page.evaluate(function(){return(document.body.innerText||"").substring(0,600);});
  res=getResult(txt);
  console.log("Painting: "+res.price+" Range: "+res.range+"\n");
  await page.close();

  // WINDOWS
  console.log("=== WINDOWS ===");
  page=await browser.newPage();await page.setViewport({width:1366,height:900});
  await page.goto(BASE+"/window-estimate.html",{waitUntil:"networkidle2",timeout:30000});await sleep(5000);
  await fillAddr(page);
  console.log("1: "+await clickP(page,"Vinyl"));await sleep(1500);
  console.log("2: "+await clickP(page,"6-10|6 to 10"));await sleep(1500);
  console.log("3: "+await clickP(page,"Standard|Medium"));await sleep(1500);
  console.log("4: "+await clickP(page,"Planning|No rush"));await sleep(5000);
  txt=await page.evaluate(function(){return(document.body.innerText||"").substring(0,600);});
  res=getResult(txt);
  console.log("Windows: "+res.price+" Range: "+res.range+"\n");
  await page.close();

  await browser.close();server.close();
  console.log("===== ALL DONE =====");
})();
