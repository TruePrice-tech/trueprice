// Generate MESSY phone-photo-style fixtures that simulate real-world conditions:
// - Heavy perspective skew (phone held at angle)
// - Uneven lighting (bright spot + shadow)
// - JPEG compression artifacts (quality 35-50)
// - Partial crop (edges cut off)
// - Background clutter (table, desk)
// - Some handwritten elements
// - Realistic scope items per vertical
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const DEST = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice/test-quotes/real-quotes";

const FIXTURES = [
  {
    vertical: "plumbing",
    name: "messy-sewer-repair.jpg",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:520px;padding:28px 24px;background:#f2ece0;border:1px solid #b8a88a;position:relative;">
        <div style="position:absolute;top:12px;right:15px;font-family:'Segoe Script',cursive;color:#c44;font-size:14px;transform:rotate(-8deg);">PAID 3/29</div>
        <div style="text-align:center;font-size:18px;font-weight:bold;letter-spacing:1px;">DRAIN MASTERS PLUMBING</div>
        <div style="text-align:center;font-size:11px;">Master Plumber Lic #MP-7821 | Bonded & Insured</div>
        <div style="text-align:center;font-size:11px;">2847 W. Commerce St, San Antonio TX 78207</div>
        <div style="text-align:center;font-size:11px;">(210) 555-0193</div>
        <hr style="border:1px solid #999;margin:12px 0;">
        <div style="font-size:13px;margin:8px 0;">
          <span style="font-family:'Segoe Script',cursive;font-size:15px;">Invoice #4471</span><br>
          Date: <span style="font-family:'Segoe Script',cursive;">March 27, 2026</span><br>
          Customer: <span style="font-family:'Segoe Script',cursive;">Garcia residence - 1840 Nogalitos</span>
        </div>
        <div style="font-size:14px;font-weight:bold;margin:12px 0;text-decoration:underline;">SEWER LINE REPAIR - TRENCHLESS</div>
        <table style="width:100%;font-size:12px;line-height:1.8;">
          <tr><td>Camera inspection + locate (60ft)</td><td style="text-align:right;font-family:'Segoe Script',cursive;font-size:14px;">$375</td></tr>
          <tr><td>Trenchless pipe lining (CIPP) - 45 linear ft</td><td style="text-align:right;font-family:'Segoe Script',cursive;font-size:14px;">$4,800</td></tr>
          <tr><td>Access pit excavation (2 pits)</td><td style="text-align:right;font-family:'Segoe Script',cursive;font-size:14px;">$1,200</td></tr>
          <tr><td>Cleanout install at property line</td><td style="text-align:right;font-family:'Segoe Script',cursive;font-size:14px;">$450</td></tr>
          <tr><td>Backfill + compact + sod patch</td><td style="text-align:right;font-family:'Segoe Script',cursive;font-size:14px;">$350</td></tr>
          <tr><td>City permit + inspection</td><td style="text-align:right;font-family:'Segoe Script',cursive;font-size:14px;">$225</td></tr>
          <tr><td>Post-repair camera verification</td><td style="text-align:right;font-family:'Segoe Script',cursive;font-size:14px;">$0</td></tr>
        </table>
        <hr style="border:1px solid #999;">
        <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;">
          <span>TOTAL</span>
          <span style="font-family:'Segoe Script',cursive;font-size:18px;">$7,400</span>
        </div>
        <div style="font-size:10px;margin-top:12px;color:#555;">
          25 year warranty on CIPP liner. 1 year warranty on excavation/restoration.<br>
          50% deposit due at signing. Balance on inspection approval.<br>
          <span style="font-family:'Segoe Script',cursive;font-size:12px;color:#333;">Warranty does NOT cover root intrusion from connected laterals - Pete</span>
        </div>
      </div>`
  },
  {
    vertical: "roofing",
    name: "messy-roof-repair.jpg",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:540px;padding:25px;background:white;border:1px solid #ccc;position:relative;">
        <div style="position:absolute;top:8px;right:10px;background:#ffd700;color:#333;padding:2px 8px;font-size:11px;font-weight:bold;transform:rotate(3deg);">COPY</div>
        <div style="font-size:19px;font-weight:bold;color:#8B0000;">RIDGE LINE ROOFING</div>
        <div style="font-size:10px;color:#666;">NC Licensed GC #81923 | GAF Master Elite Certified</div>
        <div style="font-size:10px;color:#666;">3100 Freedom Dr, Charlotte NC 28208 | (704) 555-0277</div>
        <hr style="margin:10px 0;border-color:#8B0000;">
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <div><strong>PROPOSAL #R-1192</strong><br>Date: 03/20/2026</div>
          <div style="text-align:right;">Property: 5521 Sardis Rd<br>Charlotte, NC 28270</div>
        </div>
        <div style="font-size:13px;margin:8px 0;"><strong>Roof:</strong> ~32 squares (3,200 sq ft) | Hip roof, 2 stories, 6/12 pitch</div>
        <div style="font-size:13px;font-weight:bold;margin:10px 0;color:#8B0000;">TEAR-OFF & REPLACEMENT - ARCHITECTURAL SHINGLES</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <tr style="background:#f9f0f0;"><th style="text-align:left;padding:4px;">Scope Item</th><th style="text-align:right;padding:4px;">Cost</th></tr>
          <tr><td style="padding:3px;">Tear off existing 2-layer shingles</td><td style="text-align:right;">$2,100</td></tr>
          <tr><td style="padding:3px;">Replace damaged decking (est. 8 sheets OSB)</td><td style="text-align:right;">$640</td></tr>
          <tr><td style="padding:3px;">GAF Tiger Paw synthetic underlayment (full deck)</td><td style="text-align:right;">$780</td></tr>
          <tr><td style="padding:3px;">GAF WeatherWatch ice & water shield (eaves + valleys)</td><td style="text-align:right;">$520</td></tr>
          <tr><td style="padding:3px;">GAF Timberline HDZ shingles (Pewter Gray)</td><td style="text-align:right;">$5,600</td></tr>
          <tr><td style="padding:3px;">Aluminum drip edge (eaves + rakes)</td><td style="text-align:right;">$485</td></tr>
          <tr><td style="padding:3px;">Step flashing + counter flashing (2 walls)</td><td style="text-align:right;">$420</td></tr>
          <tr><td style="padding:3px;">Ridge cap shingles (Timbertex)</td><td style="text-align:right;">$385</td></tr>
          <tr><td style="padding:3px;">Continuous ridge vent (48 LF)</td><td style="text-align:right;">$290</td></tr>
          <tr><td style="padding:3px;">Pipe boots (4) + attic vents (2)</td><td style="text-align:right;">$210</td></tr>
          <tr><td style="padding:3px;">Starter strip shingles (ProStart)</td><td style="text-align:right;">$180</td></tr>
          <tr><td style="padding:3px;">Dumpster + debris haul</td><td style="text-align:right;">$550</td></tr>
          <tr><td style="padding:3px;">Magnetic sweep + yard cleanup</td><td style="text-align:right;">$0</td></tr>
          <tr><td style="padding:3px;">Building permit + final inspection</td><td style="text-align:right;">$185</td></tr>
          <tr style="border-top:2px solid #8B0000;font-weight:bold;font-size:14px;">
            <td style="padding:6px;">PROJECT TOTAL</td><td style="text-align:right;padding:6px;">$12,345</td>
          </tr>
        </table>
        <div style="font-size:10px;margin-top:10px;color:#555;">
          GAF Golden Pledge: 50-yr material + 25-yr labor + 10-yr workmanship.<br>
          Price valid 30 days. 40% deposit, 60% on completion.<br>
          <em>Decking repair allowance: additional boards at $75/sheet if needed beyond estimate.</em>
        </div>
      </div>`
  },
  {
    vertical: "hvac",
    name: "messy-furnace-install.jpg",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:500px;padding:25px;background:#faf8f3;border:2px solid #444;position:relative;">
        <div style="position:absolute;bottom:15px;right:15px;font-family:'Segoe Script',cursive;color:#1a5276;font-size:16px;transform:rotate(-5deg);">Approved - JW</div>
        <div style="text-align:center;font-size:17px;font-weight:bold;">ALL SEASONS HVAC</div>
        <div style="text-align:center;font-size:10px;">NATE Certified | EPA Licensed | Est. 2003</div>
        <div style="text-align:center;font-size:10px;">4200 Hwy 70, Nashville TN 37209 | (615) 555-0388</div>
        <div style="border-bottom:2px dashed #999;margin:10px 0;"></div>
        <div style="font-size:12px;">
          <strong>WORK ORDER #AS-9928</strong><br>
          Customer: Williams - <span style="font-family:'Segoe Script',cursive;">4881 Nolensville Pike</span><br>
          Date: <span style="font-family:'Segoe Script',cursive;">April 3, 2026</span>
        </div>
        <div style="border-bottom:1px dashed #999;margin:8px 0;"></div>
        <div style="font-size:13px;font-weight:bold;">GAS FURNACE REPLACEMENT - 80K BTU</div>
        <table style="width:100%;font-size:11px;margin:8px 0;line-height:1.7;">
          <tr><td>Carrier 58SB0A080 furnace (80% AFUE)</td><td style="text-align:right;">$2,100</td></tr>
          <tr><td>New plenum + transition</td><td style="text-align:right;">$485</td></tr>
          <tr><td>Gas line modification + drip leg</td><td style="text-align:right;">$275</td></tr>
          <tr><td>New flue pipe (B-vent, 25ft)</td><td style="text-align:right;">$380</td></tr>
          <tr><td>Thermostat upgrade (Honeywell T6 Pro)</td><td style="text-align:right;">$185</td></tr>
          <tr><td>Filter rack + media filter</td><td style="text-align:right;">$145</td></tr>
          <tr><td>Condensate line + trap</td><td style="text-align:right;">$95</td></tr>
          <tr><td>Labor (2 techs, 6 hrs)</td><td style="text-align:right;">$1,500</td></tr>
          <tr><td>Remove + dispose old furnace</td><td style="text-align:right;">$200</td></tr>
          <tr><td>Mechanical permit</td><td style="text-align:right;">$135</td></tr>
        </table>
        <div style="border-bottom:2px dashed #999;margin:8px 0;"></div>
        <div style="font-size:14px;font-weight:bold;text-align:right;">TOTAL: $5,500</div>
        <div style="font-size:10px;margin-top:8px;">
          20 yr heat exchanger. 10 yr parts. 1 yr labor.<br>
          <span style="font-family:'Segoe Script',cursive;font-size:11px;">Duct cleaning recommended - quoted separately</span>
        </div>
      </div>`
  },
  {
    vertical: "electrical",
    name: "messy-ev-charger.jpg",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;padding:25px;background:white;border:1px solid #ddd;position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#e74c3c,#f39c12,#e74c3c);"></div>
        <div style="font-size:18px;font-weight:bold;margin-top:8px;">VOLT ELECTRIC SERVICES</div>
        <div style="font-size:10px;color:#666;">FL EC License #13009847 | Insured</div>
        <div style="font-size:10px;color:#666;">Orlando, FL 32801 | (407) 555-0216</div>
        <hr style="margin:10px 0;">
        <div style="font-size:12px;">
          <strong>Quote #VE-3384</strong> | Date: 04/08/2026<br>
          <strong>Job:</strong> EV Charger Installation (Level 2)<br>
          <strong>Location:</strong> Attached garage, 35ft from panel
        </div>
        <table style="width:100%;font-size:12px;margin:12px 0;">
          <tr><td>ChargePoint Home Flex (48A, NEMA 14-50)</td><td style="text-align:right;">$699</td></tr>
          <tr><td>50A 2-pole breaker</td><td style="text-align:right;">$45</td></tr>
          <tr><td>6/3 NM-B wire (40ft run)</td><td style="text-align:right;">$185</td></tr>
          <tr><td>NEMA 14-50 outlet + box</td><td style="text-align:right;">$65</td></tr>
          <tr><td>Conduit + fittings (exterior section)</td><td style="text-align:right;">$120</td></tr>
          <tr><td>Panel load calculation</td><td style="text-align:right;">$0</td></tr>
          <tr><td>Labor (4 hours @ $125/hr)</td><td style="text-align:right;">$500</td></tr>
          <tr><td>Permit + inspection</td><td style="text-align:right;">$95</td></tr>
        </table>
        <hr>
        <div style="font-size:15px;font-weight:bold;text-align:right;">Total: $1,709</div>
        <div style="font-size:10px;margin-top:8px;color:#666;">
          Note: Panel has capacity for 50A circuit. If panel upgrade needed, add ~$2,800.<br>
          ChargePoint warranty: 3 yr. Installation warranty: 1 yr.
        </div>
      </div>`
  },
  {
    vertical: "auto",
    name: "messy-transmission-service.jpg",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:480px;padding:20px;background:#fefefe;border:1px solid #aaa;position:relative;">
        <div style="position:absolute;top:10px;right:10px;color:#c0392b;font-weight:bold;font-size:13px;border:2px solid #c0392b;padding:2px 6px;">ESTIMATE ONLY</div>
        <div style="font-size:16px;font-weight:bold;text-align:center;">EASTSIDE TRANSMISSION</div>
        <div style="font-size:10px;text-align:center;">AAA Approved | 5501 E Colfax Ave, Denver CO 80220</div>
        <div style="font-size:10px;text-align:center;">(303) 555-0298</div>
        <div style="border-bottom:1px solid #999;margin:8px 0;"></div>
        <div style="font-size:11px;">
          RO#: T-2284 &nbsp; Date: 04/07/2026<br>
          2017 Ford F-150 XLT 4WD<br>
          VIN: ...ending 8847 &nbsp; Miles: 94,221<br>
          Customer: Robert K.
        </div>
        <div style="border-bottom:1px solid #999;margin:8px 0;"></div>
        <div style="font-size:12px;font-weight:bold;">TRANSMISSION REBUILD - 6R80</div>
        <table style="width:100%;font-size:11px;margin:6px 0;">
          <tr><td>R&R transmission</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td>Rebuild kit (clutches, bands, seals, gaskets)</td><td style="text-align:right;">$485</td></tr>
          <tr><td>Torque converter (remanufactured)</td><td style="text-align:right;">$375</td></tr>
          <tr><td>Solenoid pack</td><td style="text-align:right;">$290</td></tr>
          <tr><td>Fluid + filter (Mercon LV, 14 qts)</td><td style="text-align:right;">$165</td></tr>
          <tr><td>Labor - rebuild (12 hrs @ $140)</td><td style="text-align:right;">$1,680</td></tr>
          <tr><td>Cooler line flush</td><td style="text-align:right;">$85</td></tr>
          <tr><td>Shop supplies + fluids</td><td style="text-align:right;">$45</td></tr>
        </table>
        <div style="border-bottom:1px solid #999;margin:6px 0;"></div>
        <div style="font-size:11px;text-align:right;">Parts: $1,360</div>
        <div style="font-size:11px;text-align:right;">Labor: $2,965</div>
        <div style="font-size:11px;text-align:right;">Tax: $103.22</div>
        <div style="font-size:14px;font-weight:bold;text-align:right;">TOTAL: $4,428.22</div>
        <div style="font-size:9px;margin-top:8px;">3 yr / 36,000 mile warranty on rebuild. Nationwide warranty honored at ATRA shops.</div>
      </div>`
  },
  {
    vertical: "moving",
    name: "messy-interstate-move.jpg",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:18px;font-weight:bold;color:#1a5276;">ATLAS MOVING & STORAGE</div>
        <div style="font-size:10px;color:#666;">USDOT #2847391 | MC #928471 | Licensed & Insured</div>
        <div style="font-size:10px;color:#666;">Chicago, IL 60614 | (312) 555-0441</div>
        <hr style="margin:10px 0;">
        <div style="font-size:13px;font-weight:bold;">BINDING ESTIMATE - INTERSTATE MOVE</div>
        <div style="font-size:12px;margin:8px 0;">
          From: 2140 N. Halsted St, Chicago IL 60614<br>
          To: 4420 Magazine St, New Orleans LA 70115<br>
          Distance: 926 miles | Move date: 05/01/2026<br>
          Est. weight: 6,500 lbs (3BR home)
        </div>
        <table style="width:100%;font-size:12px;margin:10px 0;">
          <tr><td>Long distance transport (926 mi @ $0.85/lb)</td><td style="text-align:right;">$5,525</td></tr>
          <tr><td>Loading: 4 movers x 5 hrs @ $45/hr</td><td style="text-align:right;">$900</td></tr>
          <tr><td>Unloading: 3 movers x 4 hrs @ $45/hr</td><td style="text-align:right;">$540</td></tr>
          <tr><td>Packing service (full pack, 80 boxes est.)</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td>Packing materials</td><td style="text-align:right;">$350</td></tr>
          <tr><td>Mattress bags (3) + wardrobe boxes (4)</td><td style="text-align:right;">$95</td></tr>
          <tr><td>Fuel surcharge (8%)</td><td style="text-align:right;">$442</td></tr>
          <tr><td>Stair carry fee (3rd floor, origin)</td><td style="text-align:right;">$200</td></tr>
          <tr><td>Basic valuation ($0.60/lb)</td><td style="text-align:right;">$0</td></tr>
        </table>
        <hr>
        <div style="font-size:15px;font-weight:bold;text-align:right;">Binding Estimate: $9,252</div>
        <div style="font-size:10px;margin-top:8px;">
          Full replacement value coverage available: +$650<br>
          Delivery window: 5-10 business days. Storage: $175/mo if needed.
        </div>
      </div>`
  },
  {
    vertical: "fencing",
    name: "messy-chain-link.jpg",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:470px;padding:22px;background:#f5f0e8;border:1px solid #aaa;">
        <div style="font-size:16px;font-weight:bold;text-align:center;">AMERICAN FENCE & GATE</div>
        <div style="font-size:10px;text-align:center;">Tulsa, OK 74104 | (918) 555-0177</div>
        <div style="border-bottom:1px solid #999;margin:8px 0;"></div>
        <div style="font-size:12px;margin:8px 0;">
          <strong>Estimate</strong> | Date: <span style="font-family:'Segoe Script',cursive;">4/4/2026</span><br>
          <strong>Type:</strong> 4' chain link, galvanized, residential<br>
          <strong>Linear feet:</strong> <span style="font-family:'Segoe Script',cursive;">220 LF</span><br>
          <strong>Gates:</strong> 1 walk (4') + 1 double swing (12')
        </div>
        <table style="width:100%;font-size:11px;margin:8px 0;">
          <tr><td>4' galv. chain link fabric (11 gauge)</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$1,320</td></tr>
          <tr><td>Terminal + line posts (28)</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$840</td></tr>
          <tr><td>Top rail + fittings</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$440</td></tr>
          <tr><td>4' walk gate w/ hardware</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$285</td></tr>
          <tr><td>12' double swing gate w/ hardware</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$750</td></tr>
          <tr><td>Concrete (posts set 30")</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$560</td></tr>
          <tr><td>Labor</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$1,650</td></tr>
          <tr><td>Old fence removal (chain link, 180 LF)</td><td style="text-align:right;font-family:'Segoe Script',cursive;">$450</td></tr>
        </table>
        <div style="border-bottom:1px solid #999;margin:6px 0;"></div>
        <div style="font-size:14px;font-weight:bold;text-align:right;">Total: <span style="font-family:'Segoe Script',cursive;font-size:17px;">$6,295</span></div>
        <div style="font-size:10px;margin-top:8px;">Property survey required before install. Utility locate included.</div>
      </div>`
  },
  {
    vertical: "concrete",
    name: "messy-patio-pour.jpg",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;padding:25px;background:white;border:1px solid #ccc;">
        <div style="font-size:17px;font-weight:bold;">METRO CONCRETE & MASONRY</div>
        <div style="font-size:10px;color:#666;">Licensed Contractor | St. Louis, MO 63110</div>
        <hr style="margin:10px 0;">
        <div style="font-size:12px;margin:8px 0;">
          <strong>Proposal:</strong> Stamped concrete patio<br>
          <strong>Size:</strong> 16' x 20' (320 sq ft)<br>
          <strong>Pattern:</strong> Ashlar slate | <strong>Color:</strong> Autumn brown with charcoal release
        </div>
        <table style="width:100%;font-size:12px;margin:10px 0;">
          <tr><td>Excavation + grading</td><td style="text-align:right;">$800</td></tr>
          <tr><td>4" compacted gravel base</td><td style="text-align:right;">$480</td></tr>
          <tr><td>Forms + #4 rebar @ 18" OC</td><td style="text-align:right;">$650</td></tr>
          <tr><td>Concrete (5 yards, 4000 PSI, fiber)</td><td style="text-align:right;">$950</td></tr>
          <tr><td>Stamp pattern + integral color</td><td style="text-align:right;">$1,920</td></tr>
          <tr><td>Color release + antiquing wash</td><td style="text-align:right;">$320</td></tr>
          <tr><td>Acrylic sealer (2 coats)</td><td style="text-align:right;">$480</td></tr>
          <tr><td>Expansion joints to house</td><td style="text-align:right;">$150</td></tr>
          <tr><td>Labor</td><td style="text-align:right;">$2,400</td></tr>
        </table>
        <hr>
        <div style="font-size:15px;font-weight:bold;text-align:right;">Total: $8,150</div>
        <div style="font-size:12px;text-align:right;color:#888;">($25.47/sq ft)</div>
        <div style="font-size:10px;margin-top:6px;">Reseal recommended every 2-3 years ($1.50/sq ft). 5 yr structural warranty.</div>
      </div>`
  },
  {
    vertical: "solar",
    name: "messy-solar-quote.jpg",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:530px;padding:25px;background:white;border:1px solid #ddd;">
        <div style="font-size:19px;font-weight:bold;color:#d35400;">SOLAR SOLUTIONS TX</div>
        <div style="font-size:10px;color:#666;">NABCEP Certified | TECL #38847 | Austin, TX 78701</div>
        <hr style="margin:10px 0;border-color:#d35400;">
        <div style="font-size:13px;font-weight:bold;">RESIDENTIAL SOLAR PROPOSAL</div>
        <div style="font-size:12px;margin:8px 0;">
          System: 10.8 kW DC | 27 x Q Cells Q.PEAK DUO 400W<br>
          Inverter: SolarEdge SE10000H + P401 optimizers<br>
          Mounting: Roof-mount, south-facing, 25 degree tilt<br>
          Est. production: 15,400 kWh/year (1,426 kWh/kW)<br>
          Current bill: $285/mo avg
        </div>
        <table style="width:100%;font-size:12px;margin:10px 0;">
          <tr><td>Panels (27 x Q Cells 400W)</td><td style="text-align:right;">$8,100</td></tr>
          <tr><td>SolarEdge inverter + optimizers</td><td style="text-align:right;">$4,200</td></tr>
          <tr><td>Racking + mounting hardware</td><td style="text-align:right;">$1,350</td></tr>
          <tr><td>Electrical (conduit, disconnect, wiring)</td><td style="text-align:right;">$1,800</td></tr>
          <tr><td>Installation labor</td><td style="text-align:right;">$4,500</td></tr>
          <tr><td>Permit + interconnection + inspection</td><td style="text-align:right;">$950</td></tr>
          <tr><td>Critter guard</td><td style="text-align:right;">$350</td></tr>
          <tr><td>Monitoring (lifetime)</td><td style="text-align:right;">$0</td></tr>
        </table>
        <hr>
        <div style="font-size:13px;text-align:right;">Gross cost: $21,250</div>
        <div style="font-size:13px;text-align:right;color:green;">Federal ITC (30%): -$6,375</div>
        <div style="font-size:16px;font-weight:bold;text-align:right;">Net cost: $14,875</div>
        <div style="font-size:10px;margin-top:8px;">
          25 yr panel warranty. 12 yr inverter (extendable to 25). 10 yr workmanship.<br>
          Simple payback: ~4.9 years. 25-yr savings: ~$78,000.
        </div>
      </div>`
  },
  {
    vertical: "painting",
    name: "messy-exterior-paint.jpg",
    html: `
      <div style="font-family:'Courier New',monospace;max-width:480px;padding:22px;background:#faf8f3;border:1px solid #b8a88a;">
        <div style="font-size:16px;font-weight:bold;text-align:center;">COLORCRAFT PAINTING</div>
        <div style="font-size:10px;text-align:center;">Atlanta, GA 30306 | (404) 555-0229</div>
        <div style="border-bottom:1px solid #999;margin:8px 0;"></div>
        <div style="font-size:12px;">
          <strong>Estimate - Exterior Repaint</strong><br>
          Property: 2,400 sq ft 2-story colonial<br>
          Exterior walls: ~3,200 sq ft paint surface<br>
          Date: <span style="font-family:'Segoe Script',cursive;">3/31/2026</span>
        </div>
        <table style="width:100%;font-size:11px;margin:10px 0;line-height:1.7;">
          <tr><td>Power wash (house + trim)</td><td style="text-align:right;">$450</td></tr>
          <tr><td>Scrape + sand peeling areas</td><td style="text-align:right;">$800</td></tr>
          <tr><td>Caulk windows + doors + trim joints</td><td style="text-align:right;">$350</td></tr>
          <tr><td>Prime bare wood + spot prime</td><td style="text-align:right;">$400</td></tr>
          <tr><td>2 coats SW Duration exterior (body color)</td><td style="text-align:right;">$1,800</td></tr>
          <tr><td>Trim paint (2 coats, accent color)</td><td style="text-align:right;">$1,200</td></tr>
          <tr><td>Shutters (12) - remove, paint, reinstall</td><td style="text-align:right;">$720</td></tr>
          <tr><td>Front door (strip + 2 coats)</td><td style="text-align:right;">$250</td></tr>
          <tr><td>Labor (4 painters x 4 days)</td><td style="text-align:right;">$3,200</td></tr>
          <tr><td>Equipment + scaffolding rental</td><td style="text-align:right;">$480</td></tr>
        </table>
        <div style="border-bottom:1px solid #999;margin:6px 0;"></div>
        <div style="font-size:14px;font-weight:bold;text-align:right;">Total: $9,650</div>
        <div style="font-size:10px;margin-top:6px;">5 year warranty against peeling/blistering. Landscaping protection included.</div>
      </div>`
  },
];

async function generateMessyFixtures() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  for (const fixture of FIXTURES) {
    const destFile = path.join(DEST, fixture.vertical, fixture.name);
    if (fs.existsSync(destFile)) {
      console.log(`EXISTS: ${fixture.vertical}/${fixture.name}`);
      continue;
    }

    // Heavy phone-photo effects
    const rotation = (Math.random() - 0.5) * 8; // -4 to +4 degrees
    const skewX = (Math.random() - 0.5) * 6;
    const skewY = (Math.random() - 0.5) * 3;
    const scale = 0.85 + Math.random() * 0.15;

    // Uneven lighting: bright spot gradient
    const lightX = 30 + Math.random() * 40;
    const lightY = 20 + Math.random() * 40;

    // Background: simulate desk/table surface
    const surfaces = [
      "linear-gradient(135deg, #5a4e3e 0%, #7a6e5e 50%, #4a3e2e 100%)", // wood desk
      "linear-gradient(160deg, #404040 0%, #5a5a5a 40%, #333 100%)", // dark surface
      "linear-gradient(120deg, #6b5b4b 0%, #8b7b6b 60%, #5b4b3b 100%)", // brown table
      "#4a5568", // gray desk
    ];
    const surface = surfaces[Math.floor(Math.random() * surfaces.length)];

    // Simulate hand shadow on one side
    const shadowSide = Math.random() > 0.5 ? "left" : "right";
    const handShadow = shadowSide === "left"
      ? "linear-gradient(90deg, rgba(0,0,0,0.25) 0%, transparent 15%)"
      : "linear-gradient(270deg, rgba(0,0,0,0.25) 0%, transparent 15%)";

    const fullHtml = `<!DOCTYPE html>
<html><head><style>
  body {
    margin: 0; padding: 50px 40px;
    background: ${surface};
    min-height: 100vh;
    display: flex; justify-content: center; align-items: center;
    overflow: hidden;
  }
  .wrapper {
    transform: perspective(800px) rotateY(${skewX}deg) rotateX(${skewY}deg) rotate(${rotation}deg) scale(${scale});
    box-shadow: ${Math.round(skewX*2)}px ${Math.round(8+Math.random()*12)}px 30px rgba(0,0,0,0.5);
    position: relative;
    max-width: 620px;
  }
  /* Uneven lighting overlay */
  .wrapper::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(ellipse at ${lightX}% ${lightY}%, rgba(255,255,255,0.15) 0%, transparent 60%),
                ${handShadow};
    pointer-events: none;
  }
</style></head><body>
<div class="wrapper">${fixture.html}</div>
</body></html>`;

    const page = await browser.newPage();
    await page.setViewport({ width: 750, height: 1100 });
    await page.setContent(fullHtml, { waitUntil: "load" });

    const bodyHandle = await page.$("body");
    const box = await bodyHandle.boundingBox();
    await page.setViewport({ width: 750, height: Math.ceil(box.height + 100) });

    // Low JPEG quality to simulate phone compression + messaging app
    const jpegQuality = 38 + Math.floor(Math.random() * 15); // 38-52

    await page.screenshot({
      path: destFile,
      type: "jpeg",
      quality: jpegQuality,
      fullPage: true,
    });
    await page.close();

    const kb = Math.round(fs.statSync(destFile).size / 1024);
    console.log(`OK: ${fixture.vertical}/${fixture.name} (${kb}KB, q=${jpegQuality})`);
  }

  await browser.close();
  console.log("\nDone! Generated messy fixtures.");
}

generateMessyFixtures().catch(console.error);
