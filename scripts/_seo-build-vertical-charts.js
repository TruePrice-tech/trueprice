#!/usr/bin/env node
/**
 * Generate SVG bar charts showing cost ranges across 8 major U.S. metros for
 * each of 20 verticals. Inject each chart into the corresponding vertical
 * guide page as an <img> tag. Creates original imagery for Google Images
 * discovery and AI-Overview citation eligibility.
 *
 * One SVG per vertical, written to images/[vertical]-cost-by-metro-2026.svg.
 * Idempotent — page injection skips if the chart image is already referenced.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MULTIPLIERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'city-cost-multipliers.json'), 'utf8'));

// Reference metros chosen for clear cost gradient and recognizable city names.
// Ordered high-to-low so the chart reads like a ranking.
const METROS = [
  'San Francisco|CA',
  'Seattle|WA',
  'Boston|MA',
  'Denver|CO',
  'Atlanta|GA',
  'Phoenix|AZ',
  'Houston|TX',
  'Memphis|TN',
];

// Per-vertical guide page + Atlanta baseline (extracted from existing
// Service schemas). Atlanta multiplier is ~0.986, so national baseline is
// Atlanta number divided by 0.986.
const ATLANTA_MULT = 0.986;

const VERTICALS = [
  { key: 'hvac',            file: 'hvac-cost.html',               label: 'HVAC Replacement',        atlanta: [3645, 11328] },
  { key: 'roof',            file: 'roof-cost-by-house-size.html', label: 'Roof Replacement',        atlanta: [5000, 30000] },
  { key: 'plumbing',        file: 'plumbing-cost.html',           label: 'Plumbing Service',        atlanta: [450, 8375] },
  { key: 'electrical',      file: 'electrical-cost.html',         label: 'Electrical Service',      atlanta: [1750, 14800] },
  { key: 'solar',           file: 'solar-cost.html',              label: 'Solar Installation',      atlanta: [12580, 30000] },
  { key: 'concrete',        file: 'concrete-cost.html',           label: 'Concrete Work',           atlanta: [4450, 9450] },
  { key: 'painting',        file: 'painting-cost.html',           label: 'House Painting',          atlanta: [5000, 10200] },
  { key: 'fence',           file: 'fence-cost.html',              label: 'Fence Installation',      atlanta: [3950, 11350] },
  { key: 'foundation',      file: 'foundation-repair-cost.html',  label: 'Foundation Repair',       atlanta: [500, 25900] },
  { key: 'siding',          file: 'siding-cost.html',             label: 'Siding Installation',     atlanta: [5900, 20700] },
  { key: 'window',          file: 'window-replacement-cost.html', label: 'Window Replacement',      atlanta: [5900, 17750] },
  { key: 'insulation',      file: 'insulation-cost.html',         label: 'Insulation',              atlanta: [1200, 5150] },
  { key: 'gutter',          file: 'gutters-cost.html',            label: 'Gutter Installation',     atlanta: [900, 1350] },
  { key: 'landscaping',     file: 'landscaping-cost.html',        label: 'Landscaping',             atlanta: [5950, 11800] },
  { key: 'kitchen-remodel', file: 'kitchen-remodel-cost.html',    label: 'Kitchen Remodel',         atlanta: [18700, 50000] },
  { key: 'garage-door',     file: 'garage-door-cost.html',        label: 'Garage Door Installation',atlanta: [956, 3967] },
  { key: 'auto-repair',     file: 'auto-repair-cost-guide.html',  label: 'Auto Repair',             atlanta: [148, 2465] },
  { key: 'legal',           file: 'legal-cost-guide.html',        label: 'Legal Fee (hourly)',      atlanta: [222, 493] },
  { key: 'medical',         file: 'medical-cost-guide.html',      label: 'Medical Bill',            atlanta: [148, 4930] },
  { key: 'moving',          file: 'moving-cost-guide.html',       label: 'Moving Service',          atlanta: [592, 7395] },
];

// Colors chosen to match the site palette (woogoro.css)
const BRAND = '#1d4ed8';
const BRAND_LIGHT = '#bfdbfe';
const TEXT = '#0f172a';
const TEXT_MUTED = '#64748b';
const GRID = '#e2e8f0';

function fmtUsd(n) {
  if (n >= 1000) {
    // $3,645 -> $3,645; $12580 -> $12,580
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  return '$' + Math.round(n);
}

function niceCeil(n) {
  // Round n up to a "nice" number for axis max.
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  const normalized = n / magnitude;
  let nice;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

function buildChart(vertical) {
  // Derive national baseline from Atlanta numbers.
  const [atlLow, atlHigh] = vertical.atlanta;
  const baselineLow = atlLow / ATLANTA_MULT;
  const baselineHigh = atlHigh / ATLANTA_MULT;

  // Compute per-metro range.
  const rows = METROS.map(key => {
    const mult = MULTIPLIERS[key].multiplier;
    const cityName = key.split('|')[0] + ', ' + key.split('|')[1];
    return {
      name: cityName,
      low: Math.round(baselineLow * mult),
      high: Math.round(baselineHigh * mult),
    };
  });

  const maxHigh = Math.max(...rows.map(r => r.high));
  const axisMax = niceCeil(maxHigh);

  // Layout
  const W = 720;
  const titleH = 72;       // room for title + subtitle + x-axis labels
  const axisH = 0;         // axis labels are inside titleH now
  const footerH = 20;
  const rowH = 32;
  const H = titleH + axisH + rows.length * rowH + footerH + 16;
  const labelX = 140;         // right edge of city labels (left-aligned col)
  const barStart = labelX + 14;
  const priceColW = 150;      // right-side price text column
  const barEnd = W - priceColW - 8;
  const barWidth = barEnd - barStart;

  function xPos(value) {
    return barStart + (value / axisMax) * barWidth;
  }

  // Axis ticks
  const tickCount = 5;
  const ticks = [];
  for (let i = 0; i <= tickCount; i++) {
    const v = (axisMax * i) / tickCount;
    ticks.push({ value: v, x: xPos(v) });
  }

  const chartTitle = `${vertical.label} Cost by Major U.S. Metro (2026)`;
  const altText = `${vertical.label} price ranges across eight major U.S. metros in 2026, showing variation from ${rows[rows.length-1].name} ($${rows[rows.length-1].low.toLocaleString()}-$${rows[rows.length-1].high.toLocaleString()}) to ${rows[0].name} ($${rows[0].low.toLocaleString()}-$${rows[0].high.toLocaleString()}).`;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${altText.replace(/"/g, '&quot;')}">`);
  parts.push(`<title>${chartTitle}</title>`);
  parts.push(`<desc>${altText}</desc>`);
  // Background
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" />`);

  // Title
  parts.push(`<text x="${W/2}" y="24" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="${TEXT}">${chartTitle}</text>`);
  parts.push(`<text x="${W/2}" y="44" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="${TEXT_MUTED}">Based on BLS wage data and BEA regional cost-of-living indices</text>`);

  // X-axis grid lines & tick labels (drawn behind bars)
  const gridTop = titleH + 8;
  const gridBottom = titleH + 8 + rows.length * rowH;
  parts.push(`<g stroke="${GRID}" stroke-width="1">`);
  for (const t of ticks) {
    parts.push(`<line x1="${t.x.toFixed(1)}" y1="${gridTop}" x2="${t.x.toFixed(1)}" y2="${gridBottom}" />`);
  }
  parts.push(`</g>`);

  // X-axis labels (above the chart)
  parts.push(`<g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" fill="${TEXT_MUTED}">`);
  for (const t of ticks) {
    parts.push(`<text x="${t.x.toFixed(1)}" y="${gridTop - 4}" text-anchor="middle">${fmtUsd(t.value)}</text>`);
  }
  parts.push(`</g>`);

  // Bars
  parts.push(`<g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">`);
  rows.forEach((r, i) => {
    const y = gridTop + i * rowH;
    const barY = y + 8;
    const barH = 14;
    const lowX = xPos(r.low);
    const highX = xPos(r.high);
    const barW = highX - lowX;

    // City label
    parts.push(`<text x="${labelX}" y="${barY + 11}" text-anchor="end" font-size="12" font-weight="600" fill="${TEXT}">${r.name}</text>`);

    // Bar — gradient from light to brand to emphasize the range
    parts.push(`<rect x="${lowX.toFixed(1)}" y="${barY}" width="${barW.toFixed(1)}" height="${barH}" fill="${BRAND_LIGHT}" rx="3" />`);
    parts.push(`<rect x="${lowX.toFixed(1)}" y="${barY}" width="${(barW * 0.35).toFixed(1)}" height="${barH}" fill="${BRAND}" rx="3" />`);
    // Low and high tick marks
    parts.push(`<line x1="${lowX.toFixed(1)}" y1="${barY - 2}" x2="${lowX.toFixed(1)}" y2="${barY + barH + 2}" stroke="${BRAND}" stroke-width="2" />`);
    parts.push(`<line x1="${highX.toFixed(1)}" y1="${barY - 2}" x2="${highX.toFixed(1)}" y2="${barY + barH + 2}" stroke="${BRAND}" stroke-width="2" />`);

    // Price text
    const priceText = `${fmtUsd(r.low)} – ${fmtUsd(r.high)}`;
    parts.push(`<text x="${highX + 8}" y="${barY + 11}" font-size="11" fill="${TEXT}">${priceText}</text>`);
  });
  parts.push(`</g>`);

  // Footer attribution
  parts.push(`<text x="${W/2}" y="${H - 6}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" fill="${TEXT_MUTED}">Source: Woogoro city-cost model, 2026 data. woogoro.com/methodology</text>`);

  parts.push(`</svg>`);
  return { svg: parts.join('\n'), altText, title: chartTitle };
}

// Ensure images/ dir exists
const imagesDir = path.join(ROOT, 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

let generated = 0;
let injected = 0;
let skippedHasImg = 0;
let skippedNoMain = 0;

for (const vertical of VERTICALS) {
  const filePath = path.join(ROOT, vertical.file);
  if (!fs.existsSync(filePath)) { console.log('  missing:', vertical.file); continue; }

  // Generate SVG
  const { svg, altText, title } = buildChart(vertical);
  const svgFilename = `${vertical.key}-cost-by-metro-2026.svg`;
  const svgPath = path.join(imagesDir, svgFilename);
  fs.writeFileSync(svgPath, svg, 'utf8');
  generated++;

  // Inject <img> tag in the guide page
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes(svgFilename)) { skippedHasImg++; continue; }

  // Find opening <main> tag (could have attributes); insert the chart right
  // after it so it appears at the very top of the main content.
  const mainMatch = html.match(/<main[^>]*>/i);
  if (!mainMatch) { skippedNoMain++; continue; }

  const insertAt = mainMatch.index + mainMatch[0].length;
  // Extract viewBox height from the SVG we just built so the <img> tag can
  // carry valid integer dimensions (prevents CLS and layout shift).
  const vbMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const imgW = vbMatch ? vbMatch[1] : '720';
  const imgH = vbMatch ? vbMatch[2] : '400';
  const imgBlock = `\n<figure class="tp-cost-chart" style="margin:0 0 32px; padding:16px 0; border-bottom:1px solid #e2e8f0;"><img src="/images/${svgFilename}" alt="${altText.replace(/"/g, '&quot;')}" width="${imgW}" height="${imgH}" loading="lazy" style="width:100%; height:auto; max-width:720px; display:block; margin:0 auto;" /><figcaption style="text-align:center; font-size:12px; color:#64748b; margin-top:8px;">${title}</figcaption></figure>\n`;
  const updated = html.slice(0, insertAt) + imgBlock + html.slice(insertAt);
  fs.writeFileSync(filePath, updated, 'utf8');
  injected++;
}

console.log('Charts generated:', generated);
console.log('<img> tags injected:', injected);
console.log('Skipped (already had img):', skippedHasImg);
console.log('Skipped (no <main>):', skippedNoMain);
