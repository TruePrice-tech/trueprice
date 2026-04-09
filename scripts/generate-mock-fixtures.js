#!/usr/bin/env node
/**
 * scripts/generate-mock-fixtures.js
 *
 * For verticals where Reddit scraping returned no results, generate
 * realistic-looking quote PNGs via puppeteer (HTML → screenshot).
 * Each PNG is a fake but visually plausible contractor quote with
 * real-format line items, real-looking totals, and fake contractor info.
 *
 * Saves to test-quotes/{vertical}-images/mock-{N}.png
 *
 * Run: node scripts/generate-mock-fixtures.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const TEMPLATES = {
  insulation: {
    contractor: ['Apex Insulation Co', 'Greenway Energy Solutions', 'Northern Comfort Insulation', 'Premier Foam Systems', 'Energy Smart Insulation', 'Thermal Pro Services', 'Shield Insulation', 'Eco Insulation Group', 'Fiberglass Plus', 'R-Value Experts'],
    job: 'Attic Insulation Upgrade',
    lines: [
      ['Remove existing R-19 insulation', 850],
      ['Air seal attic floor (top plates, bath fans, can lights)', 1200],
      ['Blown-in fiberglass to R-49', 2400],
      ['Vent baffles installed', 380],
      ['Disposal of old material', 240],
      ['Permit', 95],
    ],
  },
  kitchen: {
    contractor: ['Heritage Kitchen Designs', 'Ridgeline Remodeling', 'Modern Touch Kitchens', 'Crown Cabinetry & Design', 'Stone & Wood Kitchens', 'Cornerstone Renovations', 'Pinnacle Kitchen Co', 'Artisan Kitchen Builders', 'Summit Kitchen Pros', 'Lakeside Cabinets'],
    job: 'Mid-Range Kitchen Remodel',
    lines: [
      ['Cabinet demo and disposal', 1800],
      ['KraftMaid semi-custom cabinets', 18500],
      ['Cambria quartz countertops (45 sqft)', 4200],
      ['Subway tile backsplash + install', 1600],
      ['Bosch 800 series stainless appliance package', 8400],
      ['Plumbing rough-in modifications', 2100],
      ['Electrical: 4 new circuits, recessed lighting', 2800],
      ['Flooring: LVP (180 sqft installed)', 2160],
      ['Drywall + paint', 2400],
      ['Permit + inspections', 425],
      ['Project management', 3000],
    ],
  },
  landscaping: {
    contractor: ['Greenscape Designs', 'Heritage Landscape Co', 'Stone & Stem Landscaping', 'Outdoor Living Pros', 'Natural Touch Landscapes', 'Premier Hardscapes', 'Evergreen Landscape Services', 'Riverbend Outdoor Design', 'Cornerstone Landscaping', 'Oak & Pine Landscapes'],
    job: 'Backyard Hardscape Project',
    lines: [
      ['Site prep and grading', 1200],
      ['Paver patio (320 sqft Belgard pavers)', 7800],
      ['Retaining wall (28 linear feet, block)', 4400],
      ['Drainage tile install', 850],
      ['River rock border (40 sqft)', 320],
      ['Plant material (5 shrubs, 12 perennials)', 680],
      ['Mulch (3 cubic yards installed)', 510],
      ['Irrigation drip line connection', 425],
      ['Cleanup and disposal', 320],
    ],
  },
  foundation: {
    contractor: ['Foundation Pros LLC', 'Solid Ground Foundation Repair', 'Anchor Foundation Co', 'Bedrock Foundation Services', 'Stable Earth Foundation', 'Cornerstone Foundation Repair', 'PierTech Foundation', 'StraightLine Foundation', 'Rock Solid Foundation', 'Premier Foundation Group'],
    job: 'Foundation Settlement Repair',
    lines: [
      ['Independent structural engineer evaluation', 850],
      ['Steel push piers (8 piers @ $1,500 ea)', 12000],
      ['Pier installation labor', 4200],
      ['Drainage tile install (40 LF)', 1800],
      ['Grading correction', 750],
      ['Permit', 320],
      ['25-year transferable warranty', 0],
    ],
  },
  'garage-door': {
    contractor: ['ProDoor Garage Co', 'Overhead Door Specialists', 'Garage Door Pros LLC'],
    job: 'Premium Insulated Garage Door',
    lines: [
      ['Old door tear-out and disposal', 175],
      ['Clopay Premium Series steel door (16x7, R-12)', 1850],
      ['Carriage house overlay', 380],
      ['LiftMaster 84501 belt drive opener with smart features', 480],
      ['Bottom seal and weatherstripping', 65],
      ['Hardware and installation', 350],
      ['Permit', 95],
      ['10-year door warranty / 5-year opener warranty', 0],
    ],
  },
};

function calcTotal(lines) { return lines.reduce((s, l) => s + l[1], 0); }

function buildHtml(v, idx) {
  const t = TEMPLATES[v];
  const contractor = t.contractor[idx % t.contractor.length];
  const total = calcTotal(t.lines);
  const tax = Math.round(total * 0.06);
  const grandTotal = total + tax;
  return `<!DOCTYPE html><html><head><style>
body { font-family: Georgia, serif; padding: 40px; max-width: 720px; margin: 0 auto; background: white; color: #1a1a1a; }
.header { border-bottom: 3px solid #1a3a52; padding-bottom: 14px; margin-bottom: 24px; }
.contractor { font-size: 24px; font-weight: 700; }
.tagline { font-size: 13px; color: #666; margin-top: 4px; }
.meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
.box { border: 1px solid #ccc; padding: 14px; margin-bottom: 16px; }
h2 { font-size: 16px; margin: 0 0 10px; color: #1a3a52; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 8px 4px; border-bottom: 2px solid #1a3a52; font-size: 13px; }
td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
td.amt { text-align: right; }
.totals { margin-top: 16px; border-top: 2px solid #1a3a52; padding-top: 10px; font-size: 14px; }
.totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
.totals .grand { font-size: 18px; font-weight: 700; border-top: 1px solid #1a3a52; padding-top: 8px; margin-top: 8px; }
.footer { margin-top: 28px; font-size: 11px; color: #666; }
</style></head><body>
<div class="header">
  <div class="contractor">${contractor}</div>
  <div class="tagline">Quality work since 2008 &middot; Licensed &amp; Insured &middot; (555) 123-4567</div>
</div>
<div class="meta">
  <div><strong>Quote #:</strong> Q-2026-${(1000 + idx)}</div>
  <div><strong>Date:</strong> March 15, 2026</div>
  <div><strong>Valid:</strong> 30 days</div>
</div>
<div class="box">
  <h2>Customer</h2>
  <div>John &amp; Mary Sample<br/>123 Sample Street<br/>Charlotte, NC 28202</div>
</div>
<div class="box">
  <h2>${t.job}</h2>
  <table>
    <thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
    <tbody>
      ${t.lines.map(l => '<tr><td>' + l[0] + '</td><td class="amt">$' + l[1].toLocaleString() + '</td></tr>').join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>$${calcTotal(t.lines).toLocaleString()}</span></div>
    <div class="row"><span>Sales tax (6%)</span><span>$${tax.toLocaleString()}</span></div>
    <div class="row grand"><span>Total</span><span>$${grandTotal.toLocaleString()}</span></div>
  </div>
</div>
<div class="footer">Workmanship warranty: 2 years on labor. Manufacturer warranty applies to materials. 25% deposit due upon signing, balance due upon completion.</div>
</body></html>`;
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  for (const v of Object.keys(TEMPLATES)) {
    const dir = path.join('test-quotes', v + '-images');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 10; i++) {
      const html = buildHtml(v, i);
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 1100 });
      await page.setContent(html);
      const out = path.join(dir, 'mock-' + (i+1).toString().padStart(2, '0') + '.png');
      await page.screenshot({ path: out, fullPage: true });
      await page.close();
      console.log('  ' + out);
    }
  }
  await browser.close();
  console.log('done');
})();
