const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FLAGSHIP_SLUGS = new Set(['new-york-ny','los-angeles-ca','chicago-il','houston-tx','phoenix-az','dallas-tx','atlanta-ga','denver-co','seattle-wa','austin-tx','san-francisco-ca','philadelphia-pa','miami-fl','boston-ma','san-diego-ca','tampa-fl','detroit-mi','minneapolis-mn','charlotte-nc','las-vegas-nv','st-louis-mo','orlando-fl','san-antonio-tx','portland-or','sacramento-ca']);
const pattern = '-plumbing-cost.html';
const allFiles = fs.readdirSync(ROOT).filter(f => f.endsWith(pattern));
const nonFlagship = allFiles.filter(f => !FLAGSHIP_SLUGS.has(f.replace(pattern, '')));

console.log('Non-flagship files:', nonFlagship.length);
const sampleCount = 10;
const step = Math.floor(nonFlagship.length / sampleCount);
const sample = [];
for (let i = 0; i < sampleCount; i++) sample.push(nonFlagship[Math.min(i * step, nonFlagship.length - 1)]);

console.log('Sample:');
sample.forEach(f => console.log('  ' + f));

const allSets = sample.map(f => {
  const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const headings = [];
  let m;
  while ((m = re.exec(c)) !== null) headings.push(m[1].replace(/<[^>]*>/g, '').trim());
  const prefix = f.replace(pattern, '');
  const parts = prefix.split('-');
  const stateCode = parts.pop().toUpperCase();
  const cityName = parts.map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  return headings.map(h => {
    let hn = h.toLowerCase();
    hn = hn.replace(new RegExp(cityName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'CITY');
    return hn;
  });
});

const baseSet = new Set(allSets[0]);
let sharedTotal = 0;
for (let i = 1; i < allSets.length; i++) {
  const otherSet = new Set(allSets[i]);
  let shared = 0;
  for (const h of baseSet) {
    if (otherSet.has(h)) shared++;
  }
  sharedTotal += shared;
}
const avgShared = sharedTotal / (allSets.length - 1);
console.log('\nBase headings:', baseSet.size);
console.log('Avg shared:', avgShared.toFixed(1));
console.log('Struct:', Math.round((1 - avgShared / baseSet.size) * 100) + '%');

for (const h of baseSet) {
  let mc = 0;
  for (let i = 1; i < allSets.length; i++) {
    if (new Set(allSets[i]).has(h)) mc++;
  }
  console.log('  ' + (mc > 0 ? 'S(' + mc + ')' : 'U    ') + '  ' + h);
}
