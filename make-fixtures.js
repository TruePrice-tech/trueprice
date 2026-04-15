// Generate realistic phone-photo-style quote fixtures for all 20 verticals
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const DEST = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice/test-quotes/real-quotes";

// Ensure directories exist
const VERTICALS = [
  "plumbing","roofing","hvac","electrical","auto","solar","landscaping",
  "painting","moving","fencing","concrete","foundation","medical","legal",
  "general","gutters","insulation","kitchen","siding","windows","garage-door"
];
for (const v of VERTICALS) {
  const dir = path.join(DEST, v);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Fixture data: realistic quotes per vertical
const FIXTURES = [
  {
    vertical: "plumbing",
    name: "fixture-water-heater-handwritten.jpg",
    style: "handwritten",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:500px;padding:30px;background:#f5f0e8;border:1px solid #ccc;transform:rotate(-1.5deg);">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:22px;font-weight:bold;">PETE'S PLUMBING LLC</div>
          <div style="font-size:12px;">Lic #PLB-44829 | (502) 555-0147</div>
          <div style="font-size:12px;">Louisville, KY 40207</div>
        </div>
        <hr style="border:1px solid #999;">
        <div style="margin:15px 0;font-family:'Segoe Script',cursive;font-size:16px;line-height:2;">
          <div><strong>Customer:</strong> Johnson residence</div>
          <div><strong>Date:</strong> 3/28/2026</div>
          <div><strong>Job:</strong> 50 gal gas water heater replacement</div>
        </div>
        <table style="width:100%;font-size:14px;border-collapse:collapse;margin:15px 0;">
          <tr><td>Remove old 40 gal unit + disposal</td><td style="text-align:right;">$175</td></tr>
          <tr><td>Rheem 50 gal NG water heater</td><td style="text-align:right;">$849</td></tr>
          <tr><td>New flex connectors + shutoff valve</td><td style="text-align:right;">$95</td></tr>
          <tr><td>Expansion tank (code req'd)</td><td style="text-align:right;">$125</td></tr>
          <tr><td>Labor (4 hrs @ $125/hr)</td><td style="text-align:right;">$500</td></tr>
          <tr><td>Permit</td><td style="text-align:right;">$85</td></tr>
          <tr><td colspan="2"><hr></td></tr>
          <tr style="font-weight:bold;font-size:16px;"><td>TOTAL</td><td style="text-align:right;">$1,829</td></tr>
        </table>
        <div style="font-size:12px;margin-top:15px;font-style:italic;">
          6 yr manufacturer warranty on tank. 1 yr labor warranty.<br>
          Payment due on completion. Cash/check/Venmo accepted.
        </div>
        <div style="font-family:'Segoe Script',cursive;font-size:20px;margin-top:20px;color:#333;">
          - Pete M.
        </div>
      </div>`
  },
  {
    vertical: "roofing",
    name: "fixture-roof-replacement.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:550px;padding:35px;background:white;border:1px solid #ddd;">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <div style="font-size:20px;font-weight:bold;color:#1a3a5c;">APEX ROOFING & EXTERIORS</div>
            <div style="font-size:11px;color:#666;">NC GC #78432 | Fully Insured</div>
            <div style="font-size:11px;color:#666;">1200 Trade St, Charlotte, NC 28202</div>
          </div>
          <div style="text-align:right;font-size:12px;">
            <div><strong>Estimate #R-2847</strong></div>
            <div>March 15, 2026</div>
            <div>Valid 30 days</div>
          </div>
        </div>
        <hr style="margin:15px 0;">
        <div style="font-size:13px;margin-bottom:15px;">
          <strong>Property:</strong> 4412 Maple Ridge Dr, Charlotte, NC 28210<br>
          <strong>Roof size:</strong> ~28 squares (2,800 sq ft)
        </div>
        <div style="font-size:14px;font-weight:bold;margin:10px 0;color:#1a3a5c;">Complete Roof Replacement - Architectural Shingles</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr style="background:#f0f4f8;"><th style="text-align:left;padding:6px;">Item</th><th style="text-align:right;padding:6px;">Amount</th></tr>
          <tr><td style="padding:5px;">GAF Timberline HDZ shingles (Charcoal)</td><td style="text-align:right;padding:5px;">$4,200</td></tr>
          <tr><td style="padding:5px;">Synthetic underlayment (full deck)</td><td style="text-align:right;padding:5px;">$650</td></tr>
          <tr><td style="padding:5px;">Ice & water shield (eaves + valleys)</td><td style="text-align:right;padding:5px;">$420</td></tr>
          <tr><td style="padding:5px;">Drip edge, ridge cap, starter strip</td><td style="text-align:right;padding:5px;">$485</td></tr>
          <tr><td style="padding:5px;">Step & valley flashing</td><td style="text-align:right;padding:5px;">$310</td></tr>
          <tr><td style="padding:5px;">Ridge vent (continuous, 42 ft)</td><td style="text-align:right;padding:5px;">$195</td></tr>
          <tr><td style="padding:5px;">Pipe boots + vents</td><td style="text-align:right;padding:5px;">$165</td></tr>
          <tr><td style="padding:5px;">Tear-off, labor, cleanup</td><td style="text-align:right;padding:5px;">$5,200</td></tr>
          <tr><td style="padding:5px;">Dumpster + disposal</td><td style="text-align:right;padding:5px;">$475</td></tr>
          <tr><td style="padding:5px;">Permit</td><td style="text-align:right;padding:5px;">$150</td></tr>
          <tr style="border-top:2px solid #1a3a5c;font-weight:bold;font-size:15px;">
            <td style="padding:8px;">TOTAL</td><td style="text-align:right;padding:8px;">$12,250</td>
          </tr>
        </table>
        <div style="font-size:11px;margin-top:15px;color:#555;">
          GAF Golden Pledge warranty: 50-yr non-prorated + 25-yr labor.<br>
          50% deposit due at signing. Balance on completion.
        </div>
      </div>`
  },
  {
    vertical: "hvac",
    name: "fixture-ac-replacement.jpg",
    style: "receipt",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:420px;padding:25px;background:#fefefe;border:2px solid #333;">
        <div style="text-align:center;font-size:18px;font-weight:bold;">COMFORT ZONE HEATING & AIR</div>
        <div style="text-align:center;font-size:11px;">EPA Certified | NATE Certified Technicians</div>
        <div style="text-align:center;font-size:11px;">3900 Industrial Blvd, Raleigh NC 27604</div>
        <div style="text-align:center;font-size:11px;">(919) 555-0283</div>
        <div style="border-bottom:1px dashed #999;margin:10px 0;"></div>
        <div style="font-size:13px;">
          <div>Invoice #: CZ-11847</div>
          <div>Date: 04/02/2026</div>
          <div>Tech: Marcus W.</div>
        </div>
        <div style="border-bottom:1px dashed #999;margin:10px 0;"></div>
        <div style="font-size:14px;font-weight:bold;margin:10px 0;">AC System Replacement - 3 Ton</div>
        <table style="width:100%;font-size:12px;">
          <tr><td>Carrier 24ACC636 3-ton condenser</td><td style="text-align:right;">$3,200</td></tr>
          <tr><td>Carrier FV4CNF003 evap coil</td><td style="text-align:right;">$1,100</td></tr>
          <tr><td>TXV metering device</td><td style="text-align:right;">$285</td></tr>
          <tr><td>R-410A refrigerant charge</td><td style="text-align:right;">$350</td></tr>
          <tr><td>New disconnect + whip</td><td style="text-align:right;">$175</td></tr>
          <tr><td>Concrete pad</td><td style="text-align:right;">$85</td></tr>
          <tr><td>Labor (2 techs x 6 hrs)</td><td style="text-align:right;">$1,800</td></tr>
          <tr><td>Disposal old unit</td><td style="text-align:right;">$150</td></tr>
          <tr><td>Permit + inspection</td><td style="text-align:right;">$125</td></tr>
        </table>
        <div style="border-bottom:1px dashed #999;margin:10px 0;"></div>
        <div style="font-size:14px;font-weight:bold;text-align:right;">Subtotal: $7,270</div>
        <div style="font-size:12px;text-align:right;">Tax: $0.00</div>
        <div style="font-size:16px;font-weight:bold;text-align:right;margin-top:5px;">TOTAL: $7,270</div>
        <div style="font-size:10px;margin-top:15px;">10 yr compressor warranty. 5 yr parts. 1 yr labor.</div>
      </div>`
  },
  {
    vertical: "electrical",
    name: "fixture-panel-upgrade.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;padding:30px;background:white;border:1px solid #e0e0e0;">
        <div style="font-size:20px;font-weight:bold;color:#c0392b;">SPARKS ELECTRIC INC.</div>
        <div style="font-size:11px;color:#666;">Master Electrician Lic #E-29481 | Bonded & Insured</div>
        <div style="font-size:11px;color:#666;">Tampa, FL 33609 | (813) 555-0194</div>
        <hr style="margin:12px 0;">
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <div><strong>ESTIMATE</strong> for Panel Upgrade</div>
          <div>Date: 03/22/2026</div>
        </div>
        <table style="width:100%;font-size:13px;margin:15px 0;border-collapse:collapse;">
          <tr style="background:#fdf2f2;"><th style="text-align:left;padding:5px;">Description</th><th style="text-align:right;padding:5px;">Cost</th></tr>
          <tr><td style="padding:4px;">200A main breaker panel (Square D)</td><td style="text-align:right;">$485</td></tr>
          <tr><td style="padding:4px;">200A meter base</td><td style="text-align:right;">$225</td></tr>
          <tr><td style="padding:4px;">2/0 SER cable (25 ft)</td><td style="text-align:right;">$310</td></tr>
          <tr><td style="padding:4px;">Grounding electrode + bonding</td><td style="text-align:right;">$175</td></tr>
          <tr><td style="padding:4px;">Transfer all circuits (18 circuits)</td><td style="text-align:right;">$450</td></tr>
          <tr><td style="padding:4px;">AFCI/GFCI breakers (code upgrade)</td><td style="text-align:right;">$380</td></tr>
          <tr><td style="padding:4px;">Labor (8 hrs)</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td style="padding:4px;">Permit + inspection</td><td style="text-align:right;">$165</td></tr>
          <tr><td style="padding:4px;">FPL coordination / meter pull</td><td style="text-align:right;">$0</td></tr>
          <tr style="border-top:2px solid #c0392b;font-weight:bold;"><td style="padding:6px;">TOTAL</td><td style="text-align:right;padding:6px;">$3,390</td></tr>
        </table>
        <div style="font-size:11px;color:#555;">1 year labor warranty. Manufacturer warranty on panel. Permit #pending.</div>
      </div>`
  },
  {
    vertical: "auto",
    name: "fixture-brake-job.jpg",
    style: "receipt",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:400px;padding:20px;background:white;border:1px solid #ccc;transform:rotate(0.8deg);">
        <div style="text-align:center;font-weight:bold;font-size:16px;">MIKE'S AUTO REPAIR</div>
        <div style="text-align:center;font-size:11px;">ASE Certified | 790 Main St, Denver CO 80204</div>
        <div style="text-align:center;font-size:11px;">(303) 555-0167</div>
        <div style="border-bottom:1px solid #999;margin:8px 0;"></div>
        <div style="font-size:12px;">
          RO#: 8847 &nbsp;&nbsp; Date: 04/05/2026<br>
          Vehicle: 2019 Honda Accord EX-L<br>
          Mileage: 67,421<br>
          Customer: Sarah M.
        </div>
        <div style="border-bottom:1px solid #999;margin:8px 0;"></div>
        <div style="font-size:12px;font-weight:bold;">BRAKE SERVICE - FRONT & REAR</div>
        <table style="width:100%;font-size:11px;margin:8px 0;">
          <tr><td>Front brake pads (ceramic)</td><td style="text-align:right;">$89.99</td></tr>
          <tr><td>Rear brake pads (ceramic)</td><td style="text-align:right;">$79.99</td></tr>
          <tr><td>Front rotors (2) - resurfaced</td><td style="text-align:right;">$120.00</td></tr>
          <tr><td>Rear rotors (2) - resurfaced</td><td style="text-align:right;">$120.00</td></tr>
          <tr><td>Brake fluid flush</td><td style="text-align:right;">$49.99</td></tr>
          <tr><td>Labor (2.5 hrs @ $135)</td><td style="text-align:right;">$337.50</td></tr>
          <tr><td>Shop supplies</td><td style="text-align:right;">$18.50</td></tr>
        </table>
        <div style="border-bottom:1px solid #999;margin:5px 0;"></div>
        <div style="font-size:12px;text-align:right;">Subtotal: $815.97</div>
        <div style="font-size:12px;text-align:right;">Tax (8.31%): $67.81</div>
        <div style="font-size:14px;font-weight:bold;text-align:right;">TOTAL: $883.78</div>
        <div style="font-size:10px;margin-top:10px;">12 month / 12,000 mile warranty on parts and labor</div>
      </div>`
  },
  {
    vertical: "solar",
    name: "fixture-solar-proposal.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:550px;padding:30px;background:white;border:1px solid #ddd;">
        <div style="font-size:20px;font-weight:bold;color:#f39c12;">&#9728; SUNWISE ENERGY</div>
        <div style="font-size:11px;color:#666;">NABCEP Certified | ROC #331847</div>
        <div style="font-size:11px;color:#666;">Phoenix, AZ 85016</div>
        <hr style="margin:12px 0;">
        <div style="font-size:14px;font-weight:bold;">SOLAR SYSTEM PROPOSAL</div>
        <div style="font-size:12px;margin:10px 0;">
          System size: 8.4 kW (21 panels)<br>
          Panels: REC Alpha Pure-R 400W<br>
          Inverter: Enphase IQ8+<br>
          Racking: IronRidge XR100 - Black<br>
          Production est: 14,200 kWh/yr
        </div>
        <table style="width:100%;font-size:13px;margin:15px 0;border-collapse:collapse;">
          <tr><td style="padding:4px;">Equipment + materials</td><td style="text-align:right;">$14,800</td></tr>
          <tr><td style="padding:4px;">Installation labor</td><td style="text-align:right;">$5,200</td></tr>
          <tr><td style="padding:4px;">Electrical / main panel upgrade</td><td style="text-align:right;">$1,400</td></tr>
          <tr><td style="padding:4px;">Permit + interconnection</td><td style="text-align:right;">$850</td></tr>
          <tr><td style="padding:4px;">Monitoring (25 yr)</td><td style="text-align:right;">$0</td></tr>
          <tr style="border-top:2px solid #f39c12;font-weight:bold;">
            <td style="padding:6px;">System cost</td><td style="text-align:right;">$22,250</td>
          </tr>
          <tr style="color:green;"><td style="padding:4px;">Federal tax credit (30%)</td><td style="text-align:right;">-$6,675</td></tr>
          <tr style="font-weight:bold;font-size:15px;"><td style="padding:6px;">NET COST</td><td style="text-align:right;">$15,575</td></tr>
        </table>
        <div style="font-size:11px;color:#555;">25 yr panel warranty. 25 yr inverter warranty. 10 yr workmanship. Payback: ~5.8 years.</div>
      </div>`
  },
  {
    vertical: "landscaping",
    name: "fixture-yard-maintenance.jpg",
    style: "simple",
    html: `
      <div style="font-family:Georgia,serif;max-width:450px;padding:25px;background:#f9f7f2;border:1px solid #cba;">
        <div style="font-size:18px;font-weight:bold;color:#2d5016;">GREEN THUMB LANDSCAPING</div>
        <div style="font-size:11px;">Licensed & Insured | Columbus, OH 43214</div>
        <hr style="margin:10px 0;border-color:#8b7355;">
        <div style="font-size:13px;margin:10px 0;"><strong>Quote for:</strong> Full yard maintenance package</div>
        <div style="font-size:13px;"><strong>Property:</strong> ~0.4 acre lot</div>
        <div style="font-size:13px;margin-bottom:15px;"><strong>Season:</strong> April - October (28 visits)</div>
        <table style="width:100%;font-size:13px;">
          <tr><td>Weekly mowing + edging + blowing</td><td style="text-align:right;">$55/visit</td></tr>
          <tr><td>Spring cleanup (debris, beds, pruning)</td><td style="text-align:right;">$350</td></tr>
          <tr><td>Fall cleanup (leaves x3 visits)</td><td style="text-align:right;">$450</td></tr>
          <tr><td>Fertilization (4 applications)</td><td style="text-align:right;">$280</td></tr>
          <tr><td>Weed control (pre + post emergent)</td><td style="text-align:right;">$220</td></tr>
          <tr><td>Core aeration + overseeding (fall)</td><td style="text-align:right;">$275</td></tr>
        </table>
        <hr style="border-color:#8b7355;">
        <div style="font-size:15px;font-weight:bold;text-align:right;">Season Total: $3,115</div>
        <div style="font-size:11px;text-align:right;color:#666;">($111/visit average)</div>
      </div>`
  },
  {
    vertical: "painting",
    name: "fixture-interior-paint.jpg",
    style: "handwritten",
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:480px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">PRECISION PAINTING CO.</div>
        <div style="font-size:11px;color:#666;">Nashville, TN 37209 | (615) 555-0221</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Estimate</strong> - Interior Painting<br>
          <strong>Address:</strong> 892 Belmont Ave, Nashville TN<br>
          <strong>Date:</strong> 03/30/2026<br>
          <strong>Rooms:</strong> Living room, dining room, hallway, 3 bedrooms (approx 1,800 sq ft walls)
        </div>
        <table style="width:100%;font-size:13px;margin:10px 0;">
          <tr><td>Sherwin-Williams Duration paint (2 coats)</td><td style="text-align:right;">$680</td></tr>
          <tr><td>Primer (as needed, stain areas)</td><td style="text-align:right;">$120</td></tr>
          <tr><td>Prep: fill holes, sand, tape, cover floors</td><td style="text-align:right;">$450</td></tr>
          <tr><td>Ceiling paint (flat white, 2 rooms)</td><td style="text-align:right;">$280</td></tr>
          <tr><td>Trim / baseboard paint (semi-gloss)</td><td style="text-align:right;">$520</td></tr>
          <tr><td>Labor (3 painters x 2 days)</td><td style="text-align:right;">$2,400</td></tr>
          <tr><td>Materials (tape, plastic, supplies)</td><td style="text-align:right;">$95</td></tr>
        </table>
        <hr>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Total: $4,545</div>
        <div style="font-size:11px;margin-top:10px;">2 year touch-up warranty. Furniture moved by us. Cleanup included.</div>
      </div>`
  },
  {
    vertical: "moving",
    name: "fixture-local-move.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;color:#2c3e50;">RELIABLE MOVERS LLC</div>
        <div style="font-size:11px;color:#666;">USDOT #3847291 | MC #192847</div>
        <div style="font-size:11px;color:#666;">Atlanta, GA 30309</div>
        <hr style="margin:10px 0;">
        <div style="font-size:14px;font-weight:bold;">MOVING ESTIMATE - Local</div>
        <div style="font-size:12px;margin:8px 0;">
          From: 1420 Peachtree St NE, Atlanta GA<br>
          To: 892 Ponce De Leon Ave, Atlanta GA<br>
          Distance: ~8 miles | Date: 04/15/2026<br>
          Home size: 2BR apartment (~900 sq ft)
        </div>
        <table style="width:100%;font-size:13px;margin:10px 0;">
          <tr><td>3 movers x 4 hours @ $55/hr each</td><td style="text-align:right;">$660</td></tr>
          <tr><td>26 ft truck</td><td style="text-align:right;">$250</td></tr>
          <tr><td>Fuel surcharge</td><td style="text-align:right;">$35</td></tr>
          <tr><td>Packing materials (boxes, tape, wrap)</td><td style="text-align:right;">$95</td></tr>
          <tr><td>Mattress bags (2)</td><td style="text-align:right;">$30</td></tr>
          <tr><td>Stair fee (3rd floor, no elevator)</td><td style="text-align:right;">$150</td></tr>
        </table>
        <hr>
        <div style="font-size:15px;font-weight:bold;text-align:right;">Estimated Total: $1,220</div>
        <div style="font-size:11px;margin-top:8px;">*Hourly rate applies. Final based on actual time. $100k basic valuation included. Full replacement coverage available.</div>
      </div>`
  },
  {
    vertical: "fencing",
    name: "fixture-wood-fence.jpg",
    style: "simple",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">HEARTLAND FENCE CO.</div>
        <div style="font-size:11px;color:#666;">Kansas City, MO 64113 | (816) 555-0198</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Quote #F-4421</strong> | Date: 04/01/2026<br>
          <strong>Type:</strong> 6' cedar privacy fence<br>
          <strong>Linear feet:</strong> 185 LF<br>
          <strong>Gates:</strong> 1 walk gate + 1 double drive gate
        </div>
        <table style="width:100%;font-size:13px;margin:10px 0;">
          <tr><td>Western red cedar pickets (dog-ear)</td><td style="text-align:right;">$2,035</td></tr>
          <tr><td>4x4 cedar posts (24 posts)</td><td style="text-align:right;">$720</td></tr>
          <tr><td>2x4 cedar rails</td><td style="text-align:right;">$555</td></tr>
          <tr><td>Concrete + post setting</td><td style="text-align:right;">$480</td></tr>
          <tr><td>Walk gate + hardware</td><td style="text-align:right;">$285</td></tr>
          <tr><td>Double drive gate + hardware</td><td style="text-align:right;">$650</td></tr>
          <tr><td>Labor</td><td style="text-align:right;">$2,775</td></tr>
        </table>
        <hr>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Total: $7,500</div>
        <div style="font-size:11px;margin-top:8px;">Includes old fence removal. 5 yr labor warranty. Cedar weathers naturally - stain optional.</div>
      </div>`
  },
  {
    vertical: "concrete",
    name: "fixture-driveway.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;color:#555;">SOLID GROUND CONCRETE</div>
        <div style="font-size:11px;color:#888;">Lic #CON-88712 | Indianapolis, IN 46220</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Proposal:</strong> Driveway replacement<br>
          <strong>Dimensions:</strong> 18' x 40' (720 sq ft)<br>
          <strong>Concrete:</strong> 4" thick, 4000 PSI, fiber mesh<br>
          <strong>Finish:</strong> Broom finish with cut control joints
        </div>
        <table style="width:100%;font-size:13px;margin:10px 0;">
          <tr><td>Demo + removal of existing driveway</td><td style="text-align:right;">$1,800</td></tr>
          <tr><td>Grade + compact subbase (4" gravel)</td><td style="text-align:right;">$950</td></tr>
          <tr><td>Forms + rebar (#4 @ 18" OC)</td><td style="text-align:right;">$1,100</td></tr>
          <tr><td>Concrete (12 yards @ $175/yd)</td><td style="text-align:right;">$2,100</td></tr>
          <tr><td>Pour, finish, cure</td><td style="text-align:right;">$1,650</td></tr>
          <tr><td>Expansion joints + sealer</td><td style="text-align:right;">$400</td></tr>
        </table>
        <hr>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Total: $8,000</div>
        <div style="font-size:12px;text-align:right;color:#888;">($11.11/sq ft)</div>
      </div>`
  },
  {
    vertical: "foundation",
    name: "fixture-crack-repair.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">BEDROCK FOUNDATION REPAIR</div>
        <div style="font-size:11px;color:#666;">Houston, TX 77007 | (713) 555-0312</div>
        <hr style="margin:10px 0;">
        <div style="font-size:14px;font-weight:bold;">Foundation Stabilization Estimate</div>
        <div style="font-size:12px;margin:8px 0;">
          Property: 3,200 sq ft slab on grade<br>
          Issue: Settlement 1.5" NE corner, stair-step crack in brick
        </div>
        <table style="width:100%;font-size:13px;margin:10px 0;">
          <tr><td>Steel push piers (8 piers) installed to bedrock</td><td style="text-align:right;">$9,600</td></tr>
          <tr><td>Hydraulic lift to maximum practical recovery</td><td style="text-align:right;">$2,400</td></tr>
          <tr><td>Interior crack repair (epoxy inject x3)</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td>Exterior brick mortar repair</td><td style="text-align:right;">$800</td></tr>
          <tr><td>Engineering report</td><td style="text-align:right;">$500</td></tr>
        </table>
        <hr>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Total: $14,500</div>
        <div style="font-size:11px;margin-top:8px;">Lifetime transferable warranty on piers. 5 yr warranty on crack repair.</div>
      </div>`
  },
  {
    vertical: "medical",
    name: "fixture-er-visit.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;color:#2980b9;">MEMORIAL REGIONAL HOSPITAL</div>
        <div style="font-size:11px;color:#666;">2400 Medical Center Dr, Phoenix AZ 85012</div>
        <hr style="margin:10px 0;">
        <div style="font-size:14px;font-weight:bold;">PATIENT STATEMENT</div>
        <div style="font-size:12px;margin:8px 0;">
          Date of Service: 03/18/2026<br>
          Account #: MRH-884721<br>
          Department: Emergency Room
        </div>
        <table style="width:100%;font-size:12px;margin:10px 0;border-collapse:collapse;">
          <tr style="background:#e8f4fd;"><th style="text-align:left;padding:4px;">Service</th><th style="text-align:right;padding:4px;">Billed</th><th style="text-align:right;padding:4px;">Adj.</th><th style="text-align:right;padding:4px;">You Owe</th></tr>
          <tr><td style="padding:3px;">ER facility fee (Level 4)</td><td style="text-align:right;">$4,200</td><td style="text-align:right;">-$2,520</td><td style="text-align:right;">$1,680</td></tr>
          <tr><td style="padding:3px;">Physician services</td><td style="text-align:right;">$890</td><td style="text-align:right;">-$534</td><td style="text-align:right;">$356</td></tr>
          <tr><td style="padding:3px;">CT scan - abdomen w/contrast</td><td style="text-align:right;">$3,100</td><td style="text-align:right;">-$2,015</td><td style="text-align:right;">$1,085</td></tr>
          <tr><td style="padding:3px;">Lab work (CBC, BMP, lipase)</td><td style="text-align:right;">$680</td><td style="text-align:right;">-$476</td><td style="text-align:right;">$204</td></tr>
          <tr><td style="padding:3px;">IV fluids + administration</td><td style="text-align:right;">$450</td><td style="text-align:right;">-$315</td><td style="text-align:right;">$135</td></tr>
          <tr style="border-top:2px solid #2980b9;font-weight:bold;">
            <td style="padding:5px;">TOTAL</td><td style="text-align:right;">$9,320</td><td style="text-align:right;">-$5,860</td><td style="text-align:right;">$3,460</td>
          </tr>
        </table>
        <div style="font-size:11px;color:#555;">Insurance: Blue Cross PPO. Copay $250 applied. Deductible met.</div>
      </div>`
  },
  {
    vertical: "legal",
    name: "fixture-attorney-invoice.jpg",
    style: "formal",
    html: `
      <div style="font-family:'Times New Roman',serif;max-width:520px;padding:30px;background:white;border:1px solid #ccc;">
        <div style="font-size:20px;font-weight:bold;">HENDERSON & COLE, PLLC</div>
        <div style="font-size:12px;color:#666;">Attorneys at Law | 500 Market St, Suite 1200</div>
        <div style="font-size:12px;color:#666;">San Antonio, TX 78205 | (210) 555-0347</div>
        <hr style="margin:12px 0;">
        <div style="font-size:14px;font-weight:bold;">INVOICE</div>
        <div style="font-size:12px;margin:8px 0;">
          Invoice #: HC-2026-0441<br>
          Client: Martinez Family Trust<br>
          Matter: Estate Planning / Trust Administration<br>
          Period: March 2026
        </div>
        <table style="width:100%;font-size:12px;margin:10px 0;border-collapse:collapse;">
          <tr style="background:#f5f5f5;"><th style="text-align:left;padding:4px;">Date</th><th style="text-align:left;padding:4px;">Description</th><th style="text-align:right;padding:4px;">Hours</th><th style="text-align:right;padding:4px;">Amount</th></tr>
          <tr><td style="padding:3px;">03/04</td><td>Review existing trust documents</td><td style="text-align:right;">2.5</td><td style="text-align:right;">$875</td></tr>
          <tr><td style="padding:3px;">03/08</td><td>Client meeting - estate planning goals</td><td style="text-align:right;">1.5</td><td style="text-align:right;">$525</td></tr>
          <tr><td style="padding:3px;">03/12</td><td>Draft amended trust agreement</td><td style="text-align:right;">4.0</td><td style="text-align:right;">$1,400</td></tr>
          <tr><td style="padding:3px;">03/18</td><td>Research - TX community property rules</td><td style="text-align:right;">1.0</td><td style="text-align:right;">$350</td></tr>
          <tr><td style="padding:3px;">03/22</td><td>Finalize trust + pour-over will</td><td style="text-align:right;">2.0</td><td style="text-align:right;">$700</td></tr>
          <tr><td style="padding:3px;">03/25</td><td>Signing ceremony + notarization</td><td style="text-align:right;">0.5</td><td style="text-align:right;">$175</td></tr>
        </table>
        <hr>
        <div style="font-size:12px;text-align:right;">11.5 hours @ $350/hr</div>
        <div style="font-size:12px;text-align:right;">Filing fees: $75</div>
        <div style="font-size:16px;font-weight:bold;text-align:right;margin-top:5px;">Total Due: $4,100</div>
        <div style="font-size:11px;margin-top:8px;">Payment due within 30 days. Retainer balance: $900 remaining.</div>
      </div>`
  },
  {
    vertical: "gutters",
    name: "fixture-gutter-install.jpg",
    style: "simple",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:460px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">RAINFLOW GUTTER SYSTEMS</div>
        <div style="font-size:11px;color:#666;">Portland, OR 97201 | (503) 555-0284</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Quote:</strong> Seamless gutter install<br>
          <strong>Material:</strong> 5" K-style aluminum (.032 gauge)<br>
          <strong>Color:</strong> Bronze<br>
          <strong>Linear feet:</strong> 165 LF + 4 downspouts
        </div>
        <table style="width:100%;font-size:13px;">
          <tr><td>Seamless aluminum gutters (165 LF)</td><td style="text-align:right;">$1,155</td></tr>
          <tr><td>3x4 downspouts (4) + elbows</td><td style="text-align:right;">$320</td></tr>
          <tr><td>Hidden hangers (every 24")</td><td style="text-align:right;">$165</td></tr>
          <tr><td>End caps + miters + outlets</td><td style="text-align:right;">$90</td></tr>
          <tr><td>Old gutter removal + disposal</td><td style="text-align:right;">$250</td></tr>
          <tr><td>Labor</td><td style="text-align:right;">$825</td></tr>
        </table>
        <hr>
        <div style="font-size:15px;font-weight:bold;text-align:right;">Total: $2,805</div>
        <div style="font-size:12px;text-align:right;color:#666;">($17/LF installed)</div>
      </div>`
  },
  {
    vertical: "insulation",
    name: "fixture-attic-insulation.jpg",
    style: "simple",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">THERMAL SHIELD INSULATION</div>
        <div style="font-size:11px;color:#666;">Minneapolis, MN 55401 | (612) 555-0176</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Estimate:</strong> Attic insulation upgrade<br>
          <strong>Current R-value:</strong> R-19 (6" fiberglass batts)<br>
          <strong>Target R-value:</strong> R-60 (MN code)<br>
          <strong>Attic area:</strong> 1,400 sq ft
        </div>
        <table style="width:100%;font-size:13px;">
          <tr><td>Air sealing (top plates, penetrations, can lights)</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td>Blown-in fiberglass (Owens Corning AttiCat)</td><td style="text-align:right;">$2,100</td></tr>
          <tr><td>Baffles for soffit vents (22 bays)</td><td style="text-align:right;">$330</td></tr>
          <tr><td>Insulation dam at attic access</td><td style="text-align:right;">$85</td></tr>
          <tr><td>Labor (2 crew, 1 day)</td><td style="text-align:right;">$1,400</td></tr>
        </table>
        <hr>
        <div style="font-size:15px;font-weight:bold;text-align:right;">Total: $5,115</div>
        <div style="font-size:11px;margin-top:8px;">Xcel Energy rebate eligible (~$800). Lifetime warranty on material.</div>
      </div>`
  },
  {
    vertical: "kitchen",
    name: "fixture-kitchen-remodel.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:550px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">MODERN HOME RENOVATIONS</div>
        <div style="font-size:11px;color:#666;">Chicago, IL 60614 | (312) 555-0422</div>
        <hr style="margin:10px 0;">
        <div style="font-size:14px;font-weight:bold;">Kitchen Remodel Estimate</div>
        <div style="font-size:12px;margin:8px 0;">12' x 14' galley to open concept | Layout: L-shaped</div>
        <table style="width:100%;font-size:12px;margin:10px 0;">
          <tr><td>Demo (cabinets, counters, backsplash, flooring)</td><td style="text-align:right;">$2,800</td></tr>
          <tr><td>Cabinets - semi-custom shaker (18 LF)</td><td style="text-align:right;">$8,500</td></tr>
          <tr><td>Quartz countertops (42 sq ft, installed)</td><td style="text-align:right;">$4,200</td></tr>
          <tr><td>Tile backsplash (subway, 30 sq ft)</td><td style="text-align:right;">$1,100</td></tr>
          <tr><td>LVP flooring (168 sq ft)</td><td style="text-align:right;">$1,350</td></tr>
          <tr><td>Plumbing (relocate sink + dishwasher)</td><td style="text-align:right;">$1,800</td></tr>
          <tr><td>Electrical (6 outlets + under-cabinet LED)</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td>Painting (walls + ceiling)</td><td style="text-align:right;">$950</td></tr>
          <tr><td>Permit</td><td style="text-align:right;">$350</td></tr>
        </table>
        <hr>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Total: $22,250</div>
        <div style="font-size:11px;">*Appliances not included. Timeline: 3-4 weeks. 50% deposit required.</div>
      </div>`
  },
  {
    vertical: "siding",
    name: "fixture-vinyl-siding.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">EXTERIOR PROS SIDING</div>
        <div style="font-size:11px;color:#666;">Richmond, VA 23220 | (804) 555-0199</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Proposal:</strong> Complete siding replacement<br>
          <strong>Material:</strong> CertainTeed Monogram vinyl (double 4")<br>
          <strong>Color:</strong> Cypress<br>
          <strong>Sq footage:</strong> ~2,200 sq ft exterior walls
        </div>
        <table style="width:100%;font-size:13px;">
          <tr><td>Vinyl siding + accessories</td><td style="text-align:right;">$4,400</td></tr>
          <tr><td>Fanfold insulation board</td><td style="text-align:right;">$660</td></tr>
          <tr><td>J-channel, corners, starter strip</td><td style="text-align:right;">$520</td></tr>
          <tr><td>Soffit + fascia wrap (aluminum)</td><td style="text-align:right;">$1,800</td></tr>
          <tr><td>Old siding removal + disposal</td><td style="text-align:right;">$1,500</td></tr>
          <tr><td>Window/door trim wrap</td><td style="text-align:right;">$950</td></tr>
          <tr><td>Labor</td><td style="text-align:right;">$4,200</td></tr>
        </table>
        <hr>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Total: $14,030</div>
        <div style="font-size:11px;">Lifetime manufacturer warranty. 5 yr labor. ($6.38/sq ft installed)</div>
      </div>`
  },
  {
    vertical: "windows",
    name: "fixture-window-replacement.jpg",
    style: "formal",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;color:#1a5276;">CLEARVIEW WINDOWS & DOORS</div>
        <div style="font-size:11px;color:#666;">Baltimore, MD 21201 | (410) 555-0266</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Quote:</strong> Window replacement (10 windows)<br>
          <strong>Type:</strong> Pella 250 Series vinyl, double-hung<br>
          <strong>Glass:</strong> Low-E, argon-filled, double pane
        </div>
        <table style="width:100%;font-size:12px;margin:10px 0;">
          <tr><td>Standard windows (8) - 30x48</td><td style="text-align:right;">$4,800</td></tr>
          <tr><td>Large window (1) - 48x60</td><td style="text-align:right;">$850</td></tr>
          <tr><td>Picture window (1) - 60x48</td><td style="text-align:right;">$950</td></tr>
          <tr><td>Interior/exterior trim</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td>Caulk + foam insulation</td><td style="text-align:right;">$200</td></tr>
          <tr><td>Installation labor (10 windows)</td><td style="text-align:right;">$3,500</td></tr>
          <tr><td>Haul away old windows</td><td style="text-align:right;">$150</td></tr>
        </table>
        <hr>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Total: $11,650</div>
        <div style="font-size:12px;text-align:right;color:#666;">($1,165/window avg)</div>
        <div style="font-size:11px;margin-top:8px;">Pella limited lifetime warranty. 2 yr installation warranty.</div>
      </div>`
  },
  {
    vertical: "garage-door",
    name: "fixture-garage-door.jpg",
    style: "simple",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:460px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;">OVERHEAD DOOR SOLUTIONS</div>
        <div style="font-size:11px;color:#666;">Sacramento, CA 95814 | (916) 555-0341</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;margin:10px 0;">
          <strong>Estimate:</strong> 2-car garage door replacement<br>
          <strong>Size:</strong> 16' x 7'<br>
          <strong>Door:</strong> Clopay Classic Collection, insulated (R-12.9)<br>
          <strong>Opener:</strong> LiftMaster 87504 (belt drive, WiFi)
        </div>
        <table style="width:100%;font-size:13px;">
          <tr><td>Clopay 16x7 insulated steel door</td><td style="text-align:right;">$1,450</td></tr>
          <tr><td>LiftMaster 87504 opener</td><td style="text-align:right;">$475</td></tr>
          <tr><td>New tracks + hardware</td><td style="text-align:right;">$285</td></tr>
          <tr><td>Weather seal (bottom + sides)</td><td style="text-align:right;">$95</td></tr>
          <tr><td>Remove old door + opener</td><td style="text-align:right;">$200</td></tr>
          <tr><td>Installation</td><td style="text-align:right;">$650</td></tr>
        </table>
        <hr>
        <div style="font-size:15px;font-weight:bold;text-align:right;">Total: $3,155</div>
        <div style="font-size:11px;">Clopay lifetime warranty. LiftMaster lifetime motor + belt warranty.</div>
      </div>`
  },
];

async function generateFixtures() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  for (const fixture of FIXTURES) {
    const destFile = path.join(DEST, fixture.vertical, fixture.name);
    if (fs.existsSync(destFile)) {
      console.log(`EXISTS: ${fixture.vertical}/${fixture.name}`);
      continue;
    }

    // Random phone-photo effects
    const rotation = (Math.random() - 0.5) * 5; // -2.5 to +2.5 degrees
    const bgColors = ["#8B7355", "#6B6B6B", "#3E3E3E", "#5C4033", "#4A5568"];
    const bg = bgColors[Math.floor(Math.random() * bgColors.length)];
    const shadowX = Math.round((Math.random() - 0.3) * 15);
    const shadowY = Math.round(Math.random() * 20 + 5);

    const fullHtml = `<!DOCTYPE html>
<html><head><style>
  body {
    margin: 0; padding: 60px;
    background: ${bg};
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh;
    font-size: 14px;
  }
  .quote-wrapper {
    transform: rotate(${rotation}deg);
    box-shadow: ${shadowX}px ${shadowY}px 25px rgba(0,0,0,0.4);
    max-width: 600px;
  }
</style></head><body>
<div class="quote-wrapper">${fixture.html}</div>
</body></html>`;

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1200 });
    await page.setContent(fullHtml, { waitUntil: "load" });

    // Get the actual content height
    const bodyHandle = await page.$("body");
    const box = await bodyHandle.boundingBox();
    await page.setViewport({ width: 800, height: Math.ceil(box.height + 120) });

    await page.screenshot({
      path: destFile,
      type: "jpeg",
      quality: 72, // simulate phone compression
      fullPage: true,
    });
    await page.close();

    const kb = Math.round(fs.statSync(destFile).size / 1024);
    console.log(`OK: ${fixture.vertical}/${fixture.name} (${kb}KB)`);
  }

  await browser.close();
  console.log("\nDone!");
}

generateFixtures().catch(console.error);
