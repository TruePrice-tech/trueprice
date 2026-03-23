// Test all synthetic quotes against expected values
// Run: node test-quotes/test-all-quotes.js

global.window = global;
global.document = { getElementById: () => null, createElement: () => ({ appendChild: () => {}, innerHTML: '', textContent: '' }) };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'test' };

const fs = require('fs');
eval(fs.readFileSync('js/analyzer-core.js', 'utf8'));
eval(fs.readFileSync('js/analyzer-parser.js', 'utf8'));

let pass = 0, fail = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); fail++; }
}

function expect(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ''} expected "${expected}" got "${actual}"`);
}

function expectInRange(actual, low, high, msg) {
  if (actual < low || actual > high) throw new Error(`${msg || ''} expected ${low}-${high} got ${actual}`);
}

// Strip HTML to get plain text (simulates pdftotext)
function htmlToText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6]|hr|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#?[a-z0-9]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

const quotes = [
  {
    file: 'test-quotes/quote1-architectural.html',
    name: 'Summit Roofing - Architectural',
    expected: { price: 13205, material: 'architectural', city: 'Charlotte', state: 'NC', roofSize: 2800,
      scope: { tearOff: 'included', underlayment: 'included', flashing: 'included', iceShield: 'included', dripEdge: 'included', ridgeVent: 'included' }
    }
  },
  {
    file: 'test-quotes/quote2-metal.html',
    name: 'Ironclad - Standing Seam Metal',
    expected: { price: 26065, material: 'metal', city: 'Denver', state: 'CO', roofSize: 1800,
      scope: { tearOff: 'included', iceShield: 'included', dripEdge: 'included', flashing: 'included', ridgeVent: 'included', ridgeCap: 'included' }
    }
  },
  {
    file: 'test-quotes/quote3-3tab-minimal.html',
    name: "Bill's Roofing - 3-Tab Minimal",
    expected: { price: 7200, material: 'asphalt', city: 'Tulsa', state: 'OK', roofSize: 1600,
      scope: { tearOff: 'included', underlayment: 'included' }
    }
  },
  {
    file: 'test-quotes/quote4-insurance.html',
    name: 'Restoration Experts - Insurance Claim',
    expected: { price: 14756.5, material: 'architectural', city: 'Atlanta', state: 'GA', roofSize: 3200,
      scope: { tearOff: 'included', underlayment: 'included', iceShield: 'included', dripEdge: 'included', flashing: 'included', ridgeVent: 'included', starterStrip: 'included', ridgeCap: 'included', decking: 'included' }
    }
  },
  {
    file: 'test-quotes/quote5-tile.html',
    name: 'Desert Sun - Tile Roof',
    expected: { price: 35055, material: 'tile', city: 'Scottsdale', state: 'AZ', roofSize: 2400,
      scope: { tearOff: 'included', underlayment: 'included', iceShield: 'included', dripEdge: 'included', flashing: 'included' }
    }
  }
];

quotes.forEach(q => {
  console.log(`\n=== ${q.name} ===`);

  const html = fs.readFileSync(q.file, 'utf8');
  const text = htmlToText(html);

  // Price
  const candidates = extractPriceCandidates(text);
  const topPrice = candidates.length > 0 ? candidates[0].value : 0;
  test(`Price = $${q.expected.price}`, () => expect(topPrice, q.expected.price));

  // Material
  const mat = detectMaterial(text);
  test(`Material = ${q.expected.material}`, () => expect(mat.value, q.expected.material));

  // Location
  const loc = detectLocation(text);
  if (q.expected.city) test(`City = ${q.expected.city}`, () => expect(loc.city, q.expected.city));
  if (q.expected.state) test(`State = ${q.expected.state}`, () => expect(loc.stateCode, q.expected.state));

  // Roof size
  if (q.expected.roofSize) {
    const size = detectRoofSize(text);
    test(`Roof size = ${q.expected.roofSize}`, () => expect(size.value, q.expected.roofSize));
  }

  // Scope items
  const signals = detectScopeSignals(text);
  Object.entries(q.expected.scope || {}).forEach(([key, expectedStatus]) => {
    test(`${key} = ${expectedStatus}`, () => expect(signals[key]?.status, expectedStatus));
  });
});

console.log(`\n========================================`);
console.log(`RESULTS: ${pass} passed, ${fail} failed`);
console.log(`========================================`);
process.exit(fail > 0 ? 1 : 0);
