// Parser test suite — run with: node test-parser.js
global.window = global;
global.document = { getElementById: () => null, createElement: () => ({ appendChild: () => {}, innerHTML: '', textContent: '' }) };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'test' };

const fs = require('fs');
eval(fs.readFileSync('js/analyzer-core.js', 'utf8'));
eval(fs.readFileSync('js/analyzer-parser.js', 'utf8'));

let pass = 0, fail = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    fail++;
  }
}

function expect(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ''} expected "${expected}" got "${actual}"`);
}

// ============================================================
// QUOTE 1: Jason.pdf (Crosby Roofing — architectural shingles)
// ============================================================
console.log('\n=== QUOTE 1: Crosby Roofing (architectural, $18,260.33) ===');

const q1 = `Docusign Envelope ID: 7586A505-4C8A-4F30-9638-8D543DACF561
Crosby Roofing & Seamless Gutters
Jason Neal 532 Meldon Road Evans, GA 30809
Shingle Roofing Section
Remove, tear off, haul and dispose of existing roof.
Install aluminum drip metal
Install Ice and Water Shield in all valleys and plumbing penetrations.
Install synthetic underlayment (Free upgrade from 15# felt paper).
Continuous ridge vent - shingle over style
Ridge venting is used to maximize year-round air flow.
Replace wall flashing if needed 64ft
Install New Architectural Shingles Includes CertainTeedTM SureStartTM
10 Year Workmanship Warranty.
33.00 SQ
TOTAL
$18,260.33
Metal Roofs, Windows and Siding-Half payment down is required.`;

const q1price = extractPriceCandidates(q1);
test('Price = $18,260.33', () => expect(q1price[0].value, 18260.33));

const q1mat = detectMaterial(q1);
test('Material = architectural', () => expect(q1mat.value, 'architectural'));

const q1scope = detectScopeSignals(q1);
test('Tear off = included', () => expect(q1scope.tearOff.status, 'included'));
test('Drip edge = included', () => expect(q1scope.dripEdge.status, 'included'));
test('Ice barrier = included', () => expect(q1scope.iceShield.status, 'included'));
test('Underlayment = included', () => expect(q1scope.underlayment.status, 'included'));
test('Ridge vent = included', () => expect(q1scope.ridgeVent.status, 'included'));
test('Ventilation = included', () => expect(q1scope.ventilation.status, 'included'));

// ============================================================
// QUOTE 2: Typical residential asphalt shingle quote
// ============================================================
console.log('\n=== QUOTE 2: ABC Roofing (asphalt 3-tab, $9,850) ===');

const q2 = `ABC Roofing Company
Proposal for: John Smith
123 Oak Street, Dallas, TX 75201

Scope of Work:
- Remove existing 3-tab asphalt shingles (1 layer)
- Install new 3-tab asphalt shingles (GAF Royal Sovereign)
- Install 15# felt underlayment
- Replace pipe boots (3)
- Install drip edge on all eaves and rakes
- Dispose of all debris
- 5 year workmanship warranty

Roof Size: 22 squares (2,200 sq ft)

Total Estimate: $9,850.00

Payment terms: 50% deposit, balance on completion.`;

const q2price = extractPriceCandidates(q2);
test('Price = $9,850', () => expect(q2price[0].value, 9850));

const q2mat = detectMaterial(q2);
test('Material = asphalt', () => expect(q2mat.value, 'asphalt'));

const q2scope = detectScopeSignals(q2);
test('Tear off = included', () => expect(q2scope.tearOff.status, 'included'));
test('Drip edge = included', () => expect(q2scope.dripEdge.status, 'included'));
test('Underlayment = included', () => expect(q2scope.underlayment.status, 'included'));

const q2loc = detectLocation(q2);
test('City = Dallas', () => expect(q2loc.city, 'Dallas'));
test('State = TX', () => expect(q2loc.stateCode, 'TX'));

const q2size = detectRoofSize(q2);
test('Roof size = 2200', () => expect(q2size.value, 2200));

// ============================================================
// QUOTE 3: Metal roof quote
// ============================================================
console.log('\n=== QUOTE 3: Premium Metal Roofing ($28,500) ===');

const q3 = `Premium Metal Roofing LLC
Estimate for: Sarah Johnson
456 Pine Ave, Denver, CO 80202

Standing seam metal roof installation
- Remove existing asphalt shingles
- Install self-adhesive ice and water shield (full deck)
- Install standing seam metal panels (24-gauge Galvalume)
- Install ridge cap
- Install drip edge
- Flashing at all penetrations and walls
- 30 year manufacturer warranty + 10 year workmanship

Roof area: 1,800 sq ft

Grand Total: $28,500.00`;

const q3price = extractPriceCandidates(q3);
test('Price = $28,500', () => expect(q3price[0].value, 28500));

const q3mat = detectMaterial(q3);
test('Material = metal', () => expect(q3mat.value, 'metal'));

const q3scope = detectScopeSignals(q3);
test('Tear off = included', () => expect(q3scope.tearOff.status, 'included'));
test('Ice barrier = included', () => expect(q3scope.iceShield.status, 'included'));
test('Ridge cap = included', () => expect(q3scope.ridgeCap.status, 'included'));
test('Flashing = included', () => expect(q3scope.flashing.status, 'included'));

// ============================================================
// QUOTE 4: Insurance quote with confusing numbers
// ============================================================
console.log('\n=== QUOTE 4: Insurance claim quote ($14,200) ===');

const q4 = `XYZ Restoration
Insurance Roofing Estimate
Claim #: 2024-58731
Policy #: HO-9876543

Property: 789 Elm St, Atlanta, GA 30301
Roof size: 2,400 sq ft

Description                        Qty    Unit    Amount
Tear off existing shingles         24     SQ      $2,400.00
Install synthetic underlayment     24     SQ      $1,440.00
Install architectural shingles     24     SQ      $7,200.00
Ice and water shield (valleys)     120    LF      $720.00
Drip edge                          280    LF      $560.00
Ridge vent                         45     LF      $450.00
Flashing                           1      EA      $350.00
Starter strip                      280    LF      $280.00
Debris disposal                    1      EA      $800.00

Total:                                            $14,200.00

Deductible: $1,000.00
ACV: $12,800.00
Depreciation: $1,400.00`;

const q4price = extractPriceCandidates(q4);
test('Price = $14,200 (not deductible or ACV)', () => expect(q4price[0].value, 14200));

const q4mat = detectMaterial(q4);
test('Material = architectural', () => expect(q4mat.value, 'architectural'));

const q4scope = detectScopeSignals(q4);
test('Tear off = included', () => expect(q4scope.tearOff.status, 'included'));
test('Underlayment = included', () => expect(q4scope.underlayment.status, 'included'));
test('Ice barrier = included', () => expect(q4scope.iceShield.status, 'included'));
test('Ridge vent = included', () => expect(q4scope.ridgeVent.status, 'included'));
test('Drip edge = included', () => expect(q4scope.dripEdge.status, 'included'));
test('Flashing = included', () => expect(q4scope.flashing.status, 'included'));
test('Starter strip = included', () => expect(q4scope.starterStrip.status, 'included'));

const q4size = detectRoofSize(q4);
test('Roof size = 2400', () => expect(q4size.value, 2400));

// ============================================================
// QUOTE 5: Minimal quote (vague, missing items)
// ============================================================
console.log('\n=== QUOTE 5: Vague quote ($7,500) ===');

const q5 = `Bill's Roofing
Quote for roof replacement
Total price: $7,500
Includes labor and materials.
Thank you for your business.`;

const q5price = extractPriceCandidates(q5);
test('Price = $7,500', () => expect(q5price[0].value, 7500));

const q5scope = detectScopeSignals(q5);
test('Tear off = unclear (not mentioned)', () => expect(q5scope.tearOff.status, 'unclear'));
test('Flashing = unclear', () => expect(q5scope.flashing.status, 'unclear'));

// ============================================================
console.log(`\n========================================`);
console.log(`RESULTS: ${pass} passed, ${fail} failed`);
console.log(`========================================`);
process.exit(fail > 0 ? 1 : 0);
