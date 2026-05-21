// Propagate UX 1 (scope-aware compare verdict copy) from concrete to siblings.
const fs = require("fs");

const files = [
  "compare-electrical-quotes.html","compare-fencing-quotes.html",
  "compare-foundation-quotes.html","compare-garage-door-quotes.html",
  "compare-gutters-quotes.html","compare-hvac-quotes.html",
  "compare-insulation-quotes.html","compare-kitchen-quotes.html",
  "compare-landscaping-quotes.html","compare-medical-quotes.html",
  "compare-moving-quotes.html","compare-painting-quotes.html",
  "compare-plumbing-quotes.html","compare-roofing-quotes.html",
  "compare-siding-quotes.html","compare-solar-quotes.html",
  "compare-windows-quotes.html"
];

// Match the single-line biased verdict + the html += that follows.
// Source files use either literal U+2019/U+2014 OR JS \\u2019/\\u2014 escapes.
const old = /( *)var ctx = escHtml\(priced\[priced\.length - 1\]\.data\.name\) \+ " is \$" \+ diff\.toLocaleString\(\) \+ " \(" \+ pct \+ "%\) more than " \+ escHtml\(priced\[0\]\.data\.name\) \+ "\. A higher price doesn(?:’|\\u2019)t always indicate above-market pricing (?:—|\\u2014) check the scope and warranty before deciding\.";\r?\n( *)html \+= '<p style="font-size:13px;color:#475569;margin:8px 0 0;line-height:1\.5;">' \+ ctx \+ '<\/p>';/;

const replLines = [
  "$1// Frame the spread relative to scope completeness, not just price.",
  "$1// 'X is 61% more than Y' reads like X is overpriced when X may",
  "$1// actually be covering more scope items. When the priciest quote has",
  "$1// materially more scope confirmed than the cheapest, lead with that.",
  "$1var pricey = priced[priced.length - 1];",
  "$1var cheap = priced[0];",
  "$1var scopeDiff = (pricey.score.scopeCount || 0) - (cheap.score.scopeCount || 0);",
  "$1var ctx;",
  "$1if (scopeDiff >= 2) {",
  "$1  var missingFromCheap = [];",
  "$1  SCOPE_ITEMS.forEach(function(it) {",
  "$1    var pv = pricey.data.scopeItems && pricey.data.scopeItems[it.key];",
  "$1    var cv = cheap.data.scopeItems && cheap.data.scopeItems[it.key];",
  "$1    var inPricey = pv === \"included\" || pv === \"yes\" || pv === true;",
  "$1    var inCheap = cv === \"included\" || cv === \"yes\" || cv === true;",
  "$1    if (inPricey && !inCheap) missingFromCheap.push(it.label.toLowerCase());",
  "$1  });",
  "$1  var shown = missingFromCheap.slice(0, 3).join(\", \");",
  "$1  var more = missingFromCheap.length > 3 ? \", and others\" : \"\";",
  "$1  ctx = escHtml(pricey.data.name) + \" covers \" + scopeDiff + \" more scope items (\"",
  "$1    + pricey.score.scopeCount + \"/\" + SCOPE_ITEMS.length + \" vs \"",
  "$1    + cheap.score.scopeCount + \"/\" + SCOPE_ITEMS.length + \") for $\"",
  "$1    + diff.toLocaleString() + \" more. \" + escHtml(cheap.data.name)",
  "$1    + \" leaves out \" + (shown || \"items the other includes\") + more + \".\";",
  "$1} else {",
  "$1  ctx = escHtml(pricey.data.name) + \" is $\" + diff.toLocaleString() + \" (\" + pct + \"%) more than \" + escHtml(cheap.data.name) + \". A higher price doesn\\u2019t always indicate above-market pricing \\u2014 check the scope and warranty before deciding.\";",
  "$1}",
  "$2html += '<p style=\"font-size:13px;color:#475569;margin:8px 0 0;line-height:1.5;\">' + ctx + '</p>';"
];
const repl = replLines.join("\n");

let ok = 0, miss = 0;
files.forEach((f) => {
  const txt = fs.readFileSync(f, "utf8");
  if (old.test(txt)) {
    fs.writeFileSync(f, txt.replace(old, repl));
    console.log("OK:", f);
    ok++;
  } else {
    console.log("MISS:", f);
    miss++;
  }
});
console.log("Total:", ok, "of", files.length, "Miss:", miss);
