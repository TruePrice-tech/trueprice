# Lawn / landscaping regulations and rebates (2026)

Research compiled for TruePrice's lawn/landscaping vertical. Goal: enable ZIP-aware estimates that surface hardiness zone, applicable rebates, license requirements, and permits.

---

## Part 1: USDA hardiness zones

USDA Plant Hardiness Zone Map updated November 2023 (replaces 2012 map). Based on 30-year average annual extreme minimum temperature (1991-2020). Each zone is 10 F wide and split into A (colder half) and B (warmer half), each 5 F.

### The 13 zones

| Zone | Temp range (F)   | Temp range (C)     | Representative regions |
|------|------------------|--------------------|------------------------|
| 1    | -60 to -50       | -51.1 to -45.6     | Interior Alaska (Fairbanks) |
| 2    | -50 to -40       | -45.6 to -40.0     | Northern Alaska, far northern MN |
| 3    | -40 to -30       | -40.0 to -34.4     | Northern MN, ND, northern ME, central AK |
| 4    | -30 to -20       | -34.4 to -28.9     | MN, WI, MT, northern NY, VT, NH, ME |
| 5    | -20 to -10       | -28.9 to -23.3     | IA, IL, IN, OH, southern NY, MA, CT, southern WI/MI |
| 6    | -10 to 0         | -23.3 to -17.8     | MO, KY, WV, PA, NJ, southern OH, Cape Cod |
| 7    | 0 to 10          | -17.8 to -12.2     | VA, NC piedmont, TN, AR, OK, NM mtns, eastern WA |
| 8    | 10 to 20         | -12.2 to -6.7      | Coastal NC/SC/GA, northern FL, central TX, AZ low desert fringe, OR/WA coast |
| 9    | 20 to 30         | -6.7 to -1.1       | Central FL, Houston, San Antonio, Phoenix, inland CA |
| 10   | 30 to 40         | -1.1 to 4.4        | South FL, southern CA coast, Tucson, southern TX coast |
| 11   | 40 to 50         | 4.4 to 10.0        | Florida Keys, Hawaii lowlands, Puerto Rico mainland |
| 12   | 50 to 60         | 10.0 to 15.6       | Hawaii (Hilo), southern PR coast |
| 13   | 60 to 70         | 15.6 to 21.1       | Hawaii (Kona coast lowlands), Puerto Rico south shore |

### ZIP-to-zone lookup approach

- Official interactive map: https://planthardiness.ars.usda.gov/ — supports ZIP lookup directly (returns half-zone).
- USDA does NOT publish an official ZIP CSV. Common community CSVs:
  - PlantMaps.com ZIP-to-zone (legacy 2012 map; needs 2023 refresh)
  - PRISM Climate Group GIS raster (the source data USDA uses) — free download, can be queried with any ZIP centroid.
- Recommended TruePrice approach: download USDA 2023 GIS raster (GeoTIFF) once, batch-process all US ZIP centroids (from USPS or GeoNames), store in `zip_to_hardiness_zone` table. Re-run only when USDA publishes new map (~10 years).
- Fallback: hit the USDA web service with ZIP at runtime and cache.

### Plant categories that thrive by zone (landscape install relevance)

| Zone | Common landscape plants | Notes for pricing |
|------|------------------------|-------------------|
| 3-4  | Spruce, paper birch, lilac, hosta, serviceberry, peony | Short growing season; install size matters more (trees stay smaller longer) |
| 5-6  | Maple, oak, hydrangea, boxwood, daylily, juniper | Most "national" plant lists target zone 5-6 |
| 7    | Dogwood, crape myrtle, azalea, holly, fescue lawn | Sweet spot: cool and warm season plants both work |
| 8    | Southern magnolia, gardenia, camellia, zoysia / centipede lawn | Zoysia install ~30% more than fescue sod |
| 9    | Citrus, bougainvillea, oleander, bermudagrass, palms | Watering costs spike; consider water budget |
| 10-11| Royal palm, hibiscus, plumeria, St. Augustine | Tropical plants are expensive; freeze damage replacement risk in zone 9b/10a edge |
| 12-13| Coconut palm, mango, plumeria, ti plant | Hawaii/PR; freight on plant material adds 25-40% |

### Why this matters for landscape pricing

- Plants installed in their proper zone grow faster, so contractors can install smaller (cheaper) sizes — a 5-gal shrub fills in within 2 seasons in zone 8 but needs to be installed at 15-gal in zone 5 to look "finished."
- Marginal-zone plants (e.g., gardenia in zone 7a) need mulch insulation, burlap wrap, and frequent replacement — adds 10-20% to long-term cost.
- Sod type is dictated by zone: cool season (fescue, KBG) zones 3-7, warm season (bermuda, zoysia, St. Augustine) zones 7-11. Fescue sod ~$0.40/sf, zoysia ~$0.65/sf, St. Aug ~$0.55/sf.
- Watering needs: a zone 9 install might need 40 gallons/sf/year; a zone 5 install might need 8. Drives irrigation system sizing.

---

## Part 2: Drought / water / native plant rebates by program

### Cash-for-grass and turf removal rebates

| Program | Region / utility | Rebate | Eligibility | Process | Active 2026? |
|---------|------------------|--------|-------------|---------|--------------|
| **SoCal WaterSmart Turf Replacement** (MWD of Southern California) | LA, Orange, San Diego, Riverside, San Bernardino, Ventura counties | $3-$5/sf (varies by member agency; LADWP tops at $5) | Live turf only, min 250 sf, 3 plants per 100 sf, no invasives, permeable cover, no synthetic turf | Pre-approval required, photos before/after, post-inspection | Yes (mwdh2o.com / socalwatersmart.com) |
| **SNWA Water Smart Landscapes** | Las Vegas Valley (LVVWD, Henderson, NLV) | $3/sf first 10,000 sf, $1.50/sf above | Live grass, drip irrigation conversion, 50% plant coverage at maturity | Pre-approval mandatory, post-install inspection | Yes — most aggressive nationally; mandatory turf removal on non-functional turf by 2027 |
| **AMWUA / Phoenix Water Landscape Rebate** | Phoenix, Tempe, Mesa, Chandler, Glendale, Scottsdale | $0.25-$2/sf (varies by city; Mesa $0.50/sf, Tempe up to $1,500) | Low-water plants from approved list, drip required | After-install rebate, photos | Yes (amwua.org) |
| **Tucson Water Rainwater Harvesting / Turf Removal** | Tucson | $2,000 max for harvesting; $0.10/gallon storage | Curb cuts, basins, tanks | Permit + inspection | Yes |
| **Albuquerque Bernalillo Water Authority Xeriscape** | ABQ NM | $2/sf turf removal, max $5,000 residential | Approved plants, mulch, drip | Pre-approval | Yes |
| **Santa Fe Water Conservation** | Santa Fe NM | $1.25/sf turf removal | Drip required, plant coverage min | Pre-approval | Yes |
| **Resource Central Garden in a Box** (Colorado) | Front Range (Denver Water, Aurora, Colorado Springs, Boulder etc.) | Pre-designed plant kits $130-$170 (subsidized by utility, ~$25-$50 off) + many utilities add $1-$2/sf turf rebate | Must order kit; some utilities require pre-approval for turf removal | Online order, utility verifies address | Yes (resourcecentral.org) |
| **Denver Water Garden In A Box / Turf Replacement** | Denver Water service area | Up to $1.50/sf | Functional vs nonfunctional turf rules | Pre-approval | Yes |
| **Slow the Flow / Utah Water Savers** | Utah (statewide via utahwatersavers.com) | $1.25-$3/sf depending on city; Salt Lake $1.25/sf | Localscapes-certified design preferred | Pre-approval, post-inspection | Yes |
| **Texas WaterIQ rebates** | Varies by city | Austin $35/100 sf (~$0.35/sf); San Antonio SAWS WaterSaver $1/sf to $1.25/sf for coupon program; El Paso $1/sf; Dallas no general program | Eligibility varies | Varies | Yes — highly fragmented |
| **Florida-Friendly Landscaping** | Statewide UF/IFAS | No cash; design help, "right plant right place" certification, protects HOA disputes (FL Statute 373.185) | Use FFL principles | Free | Yes |

### Smart irrigation controller rebates (EPA WaterSense labeled)

| Program | Region | Rebate | Approved devices |
|---------|--------|--------|------------------|
| SoCal WaterSmart | SoCal MWD | $80 residential, $35/station commercial | Rachio 3, Hydrawise HC, Rain Bird ESP-TM2 with LNK, Hunter Pro-C with Solar Sync — must be on EPA WaterSense product list |
| SNWA | Las Vegas | Free smart controller (rebate up to $300) | Same |
| AMWUA cities | Phoenix metro | $25-$250 | Same |
| Austin Water | Austin TX | Up to $200 + free WaterMyYard sensor | Same |
| SAWS | San Antonio | Up to $250 | Same |
| Denver Water | Denver | $75-$150 via Resource Central | Same |
| Many CA / NV / AZ retail utilities | various | $50-$100 typical | Same |

### Tree planting rebates

| Program | Region | Benefit | Notes |
|---------|--------|---------|-------|
| SMUD Sacramento Shade Tree Program (with Sacramento Tree Foundation) | Sacramento SMUD customers | Up to 10 free shade trees + planting consultation | Must place trees per cooling guidance | Yes |
| TreePeople / LADWP City Plants | LA | Free trees (up to 7) delivered + planted | Yes |
| Friends of Trees / Portland | Portland OR | Subsidized $35-$45 trees + planting | Yes |
| Casey Trees | DC | Up to $100 rebate | Yes |
| Phoenix Shade Tree Program | Phoenix | 2 free desert trees per household | Yes |
| Denver Be A Smart Ash | Denver | Free EAB-resistant replacement trees | Yes |

### Rain barrel / rainwater harvesting

| Program | Region | Rebate | Notes |
|---------|--------|--------|-------|
| Tucson Water | Tucson | Up to $2,000 (50% cost) | Active barrels + tanks |
| Austin Water | Austin | $0.50/gal capacity, up to $500 | Active |
| Santa Fe | Santa Fe NM | $25-$200 | Active |
| Texas (statewide sales tax exemption) | TX | No sales tax on rainwater equipment | Active |
| Colorado | CO | Legal as of 2016, max 110 gallons residential, no rebate | — |
| Maryland Bay-Wise | MD | $2/gal rebates in some counties | Active |

### Water restrictions affecting quote scope

These can make a contractor's proposed scope **illegal**, so TruePrice should warn:

- **Las Vegas (SNWA)**: Non-functional turf banned by 2027 — any quote installing new ornamental grass is illegal. Watering days assigned by address, drip-only in some seasons.
- **California statewide (SWRCB)**: Permanent ban on watering non-functional turf at commercial / institutional / industrial properties (2024 emergency reg made permanent). New developments restricted from non-functional turf.
- **Phoenix / AMWUA**: Stage 1 drought response; new pools require water budget review.
- **Colorado (Aurora, Castle Rock)**: New construction turf caps (15% of lot or 500 sf max in some cities).
- **Austin TX**: Stage 2 watering rules (1-2 days/wk by address), no mid-day watering, hand-water only with hose-end shutoff.
- **Salt Lake City**: 2 days/wk schedule, no watering 10am-6pm.
- **Many HOA areas in FL**: Florida Statute 373.185 protects FFL plants from HOA bans — quote claiming "must use St. Augustine" is wrong.
- **Tree removal ordinances**: Atlanta, Seattle, Portland, Austin, Tampa — removal of any "heritage" or large tree requires permit + sometimes mitigation fee.
- **Backflow preventer**: universally required on irrigation system tied to municipal water; testable annually in most cities.

---

## Part 3: State landscape contractor licensing

| State | Landscape contractor license? | Threshold | Pesticide applicator license | Irrigation specialty | Notes |
|-------|------------------------------|-----------|------------------------------|----------------------|-------|
| AL | No state license; business license only | — | AL Dept of Ag & Industries Pro Services license required | No | Tree work needs ISA cert by best practice |
| AK | General contractor license >$10k | $10k | AK DEC pesticide cert | No | — |
| AZ | ROC C-21 Landscaping ($1,000+) or L-21 limited | $1,000 | AZ Dept of Ag QA / QP license | Included in C-21 | Bond required |
| AR | No specific landscape; HIC if residential >$2k | $2,000 | AR Plant Board cert | No | — |
| CA | **CSLB C-27 Landscaping Contractor** required for any job >$500 (labor+material). Separate **C-61/D-12 Synthetic Turf** classification. | $500 | CA DPR QAL/QAC license for any commercial pesticide app | C-27 covers landscape irrigation; large municipal needs C-27 + backflow cert | Most stringent state — TruePrice must verify CSLB # |
| CO | No state license; city-level (Denver requires) | varies | CO Dept of Ag pesticide applicator | No | — |
| CT | Home Improvement Contractor (HIC) >$200; Arborist license required for tree work | $200 | CT DEEP supervisory cert | No | CT Arborist license is one of only 4 statutory tree licenses in US |
| DE | DE business license + contractor license | any | DE Dept of Ag cert | No | — |
| FL | No statewide landscape license; **certified pest control operator** required for chemical apps | — | FL DACS Limited Lawn & Ornamental cert | **FL Irrigation specialty license** (county level — Miami-Dade, Broward enforce) | FL has Best Management Practices (BMP) cert for fertilizer (mandatory in many counties) |
| GA | No general license; **GA Landscape Contractor registration** w/ state board | — | GA Dept of Ag pesticide cert | Irrigation contractor registration | Atlanta tree ordinance — heritage tree fees |
| HI | HI Contractor C-27 Landscaping | any | HI Dept of Ag pesticide | No | — |
| ID | Public Works only | — | ID Dept of Ag cert | No | — |
| IL | No state license; Chicago requires license | — | IL Dept of Ag pesticide | No | — |
| IN | No state license | — | OISC pesticide cert | No | — |
| IA | No state license | — | IA Dept of Ag cert | No | — |
| KS | No state license | — | KDA pesticide cert | No | — |
| KY | No state license | — | KY Dept of Ag cert | No | — |
| LA | **LA Horticulture Commission license** (one of strictest — separate licenses for landscape architect, landscape horticulturist, retail florist, arborist, utility arborist) | any | LDAF cert | LA Irrigation Contractor license required | LA also requires **Landscape Horticulturist exam** |
| ME | HIC | any | ME BPC pesticide cert | No | — |
| MD | MHIC for any home improvement >$0 | any | MDA pesticide cert; **MD Tree Expert license** for tree care | No | MD Tree Expert is one of the strictest in US |
| MA | HIC for residential | $1,000 | MDAR pesticide cert | No | — |
| MI | Residential builder license >$600 | $600 | MDARD pesticide cert | No | — |
| MN | No general license; specialty (irrigation, tree care) | — | MDA pesticide cert; **MN Tree Care Registration** | MN Irrigation Contractor required | — |
| MS | MS State Board of Contractors >$50k commercial / >$10k residential | $10k res | MDAC cert | No | — |
| MO | No state license | — | MDA pesticide cert | No | — |
| MT | Independent contractor registration | any | MDA cert | No | — |
| NE | No state license | — | NDA cert | No | — |
| NV | **NV State Contractors Board C-10 Landscape Contractor** required >$1,000 | $1,000 | NV Dept of Ag pesticide cert | C-10 covers basic irrigation | LV: SNWA also requires Water Smart Contractor cert for rebate eligibility |
| NH | No state license | — | NHDAMF pesticide cert; **NH Arborist license** | No | NH has statutory arborist license |
| NJ | HIC registration; **NJ Certified Tree Expert** for tree work | any | NJDEP pesticide cert | No | NJ Tree Expert is statutory |
| NM | NM CID GB-2 / GS-3 contractor license | $7,200 | NMDA pesticide cert | No | — |
| NY | No state landscape license; city level (NYC HIC) | — | NYSDEC pesticide cert | No | NYC requires HIC; Westchester separate |
| NC | NC Landscape Contractors Licensing Board (NCLCLB) >$30k | $30k per project | NCDA cert | NC Irrigation Contractor License (separate board) | — |
| ND | No state license | — | NDDA cert | No | — |
| OH | No state landscape license; city level | — | ODA pesticide cert | No | — |
| OK | OK Horticulture Industry license | any commercial | ODAFF cert | No | — |
| OR | **OR LCB Landscape Contracting Business license** + Landscape Construction Professional individual license | $500 | ODA pesticide cert | Included | Most rigorous after CA |
| PA | Home Improvement Contractor >$5,000 | $5,000 | PDA pesticide cert | No | — |
| RI | RI Contractor Registration | any | RI DEM pesticide cert; **RI Arborist license** | No | — |
| SC | SC Residential Builders / Specialty Contractor >$5k | $5k | SC DPR pesticide cert | No | — |
| SD | No state license | — | SDDA cert | No | — |
| TN | TN Contractor License >$25k | $25k | TDA "Charter 80" cert | No | — |
| TX | No state landscape license; **Texas Irrigator License (TCEQ)** required for ANY irrigation work | irrigation: any | TDA cert | TCEQ Licensed Irrigator (LI) — strictest single-trade license in US for irrigation | TX backflow tester separate license |
| UT | UT DOPL contractor (S330 specialty) | $3,000 | UDAF cert | No | — |
| VT | No state license | — | VAAFM pesticide cert | No | — |
| VA | Class A/B/C contractor based on $ value (>$1k = Class C) | $1,000 | VDACS cert | No | — |
| WA | **WA L&I Contractor Registration** required for any contractor work | any | WSDA pesticide cert | No | Bond + insurance required |
| WV | WV Contractor License >$2,500 | $2,500 | WVDA cert | No | — |
| WI | Dwelling Contractor for residential | any | DATCP cert | No | — |
| WY | No state license | — | WDA cert | No | — |

### Universal requirements (all 50 states)
- Secretary of State business registration (LLC / Inc / DBA).
- Federal EIN.
- General liability insurance (typically $1M).
- Workers comp if employees.
- Pesticide applicator license through state Dept of Agriculture for ANY commercial chemical application (pesticide, herbicide, restricted-use fertilizer). FIFRA federal baseline.
- ISA Certified Arborist — voluntary except in CT, MD, NH, NJ, RI (statutory tree licenses) — but the only credible national signal for tree work competence.

---

## Part 4: Permits commonly required

The 18 most common landscape work permits / approvals:

1. **Retaining walls > 4 ft** (measured from bottom of footing) — building permit + stamped engineering. Some jurisdictions trigger at 3 ft if surcharged.
2. **Pools / spas** — building, electrical, plumbing, barrier inspection, sometimes seismic.
3. **Water features > X gallons** (varies; often 50-100 gal triggers permit).
4. **Significant grading** — typically >50 cy of cut or fill, or any change to drainage onto neighbor property.
5. **Tree removal in tree-ordinance cities** — Atlanta, Seattle, Portland, Austin, Tampa, Sacramento, DC, Charlotte, Nashville, Knoxville, Coral Gables. Heritage / protected species rules.
6. **Backflow preventer (RPZ or DCV)** on any new irrigation tied to municipal water — universal; annual testing by certified tester.
7. **Pesticide / herbicide application near schools, wells, wetlands, surface water** — federal WPS plus state buffer zones.
8. **Fertilizer ordinances** — FL counties (Pinellas, Sarasota, Manatee, Lee) ban summer N application; MD/VA Chesapeake Bay restrictions.
9. **Curb cuts and right-of-way work** (rainwater curb-in, driveway aprons).
10. **HOA architectural review** — not a legal permit but enforceable; FL FFL law preempts for native plants only.
11. **Irrigation install permit** — required in FL (county), TX (any), some CA cities, NC.
12. **Outdoor lighting** for systems >60 V or any line-voltage; dark sky compliance in AZ, NM, parts of UT, HI.
13. **Fence permits** — over 6 ft typical trigger; HOA / setback rules.
14. **Erosion / sediment control plan** for any disturbance >1 acre (federal NPDES) or smaller per state (DE 5,000 sf, MD 5,000 sf).
15. **Wetland buffer / shoreline alteration permits** (state-level; coastal states + Great Lakes).
16. **Septic protection** — no plantings with deep roots within X ft of drain field; permit to alter.
17. **Underground utility locate (811)** — not a permit but a required pre-dig call; failure is a criminal violation in many states.
18. **Burn permits** for vegetation disposal in fire-prone counties (CA, OR, CO, NM, AZ).

---

## Synthesis: what TruePrice's lawn estimate should surface based on ZIP

Given a ZIP, TruePrice's lawn/landscape estimator should auto-display:

1. **USDA hardiness zone (with half letter)** — drives plant recommendations and sod type, and flags marginal-zone plant risk in the contractor quote.
2. **Drought / restriction status** — if ZIP is in SoCal MWD, SNWA, AMWUA, CO Front Range, UT Wasatch, Austin/SAWS, or any FL fertilizer-banned county, show a warning banner with what scope is illegal or restricted.
3. **Cash-for-grass rebate** — if utility offers turf replacement, show $/sf and link to pre-approval portal. Adjust net price downward if user opts in.
4. **Smart sprinkler controller rebate** — if installing irrigation, surface EPA WaterSense rebate amount for the ZIP utility and a list of qualifying models (Rachio 3, Hydrawise HC, Rain Bird ESP-TM2 LNK, Hunter Pro-C w/ Solar Sync).
5. **Tree planting rebate / free tree program** — if Sacramento SMUD, LADWP, Phoenix, Denver, Portland, DC, surface free or rebated tree count.
6. **Rain barrel rebate** — if Tucson, Austin, Santa Fe, MD counties.
7. **Required licenses to verify on the quote** — pull from Part 3 table by state. For CA show CSLB C-27, for TX show TCEQ Licensed Irrigator if scope includes irrigation, for OR show LCB, for NV show C-10, for FL show county irrigation cert + pesticide cert if chemicals are line-itemed.
8. **Permits the user might need** — auto-flag if quote includes: retaining wall (ask height), pool, water feature, tree removal in a tree-ordinance city, grading >50 cy, backflow preventer, or irrigation tie-in.
9. **Watering schedule reality check** — show local watering days/restrictions so the user understands the irrigation system they're paying for has to comply.
10. **Fertilizer / pesticide compliance** — in FL fertilizer-restricted counties and Chesapeake Bay states, flag any line item that proposes summer N.

Quote red flag: any landscape quote in CA over $500 without a CSLB # is illegal. Any TX quote with sprinkler work without a TCEQ LI # is illegal. Any tree work in CT/MD/NH/NJ/RI without the state arborist/tree expert license is illegal. TruePrice should refuse to score these quotes as "good" regardless of price.

---

## Sources

- USDA Plant Hardiness Zone Map (2023): https://planthardiness.ars.usda.gov/
- PRISM Climate Group: https://prism.oregonstate.edu/
- EPA WaterSense product list: https://www.epa.gov/watersense/product-search
- SoCal WaterSmart: https://socalwatersmart.com/
- MWD of Southern California: https://www.mwdh2o.com/
- LADWP Turf Replacement: https://www.ladwp.com/save-water/rebates-programs
- SNWA Water Smart Landscapes: https://www.snwa.com/rebates/wsl/
- AMWUA: https://www.amwua.org/
- Tucson Water Conservation: https://www.tucsonaz.gov/water/conservation
- ABCWUA Xeriscape: https://www.abcwua.org/xeriscape-rebate/
- Resource Central / Garden in a Box: https://resourcecentral.org/gardens/
- Denver Water: https://www.denverwater.org/residential/rebates
- Utah Water Savers: https://utahwatersavers.com/
- SAWS WaterSaver: https://www.saws.org/conservation/
- Austin Water Conservation: https://www.austintexas.gov/department/water-conservation
- UF/IFAS Florida-Friendly Landscaping: https://ffl.ifas.ufl.edu/
- FL Statute 373.185 (FFL HOA preemption): http://www.leg.state.fl.us/Statutes/
- SMUD Sacramento Shade: https://www.smud.org/sacshade
- Sacramento Tree Foundation: https://www.sactree.com/
- City Plants LA: https://www.cityplants.org/
- Friends of Trees: https://friendsoftrees.org/
- Casey Trees DC: https://caseytrees.org/
- CA CSLB classifications: https://www.cslb.ca.gov/
- TX TCEQ Licensed Irrigator: https://www.tceq.texas.gov/licensing/licenses/lic_irrigators
- OR Landscape Contractors Board: https://www.oregon.gov/lcb/
- NC Landscape Contractors Licensing Board: https://nclclb.com/
- LA Horticulture Commission: https://www.ldaf.state.la.us/horticulture/
- MD Tree Expert: https://dnr.maryland.gov/forests/Pages/programs/lte.aspx
- CT Arborist License: https://portal.ct.gov/DEEP
- NJ Certified Tree Expert: https://www.nj.gov/dep/parksandforests/forest/community/cte_overview.html
- ISA Certified Arborist: https://www.isa-arbor.com/Credentials/ISA-Certified-Arborist
- 811 Call Before You Dig: https://call811.com/
- EPA NPDES Construction General Permit: https://www.epa.gov/npdes/stormwater-discharges-construction-activities
- FIFRA Worker Protection Standard: https://www.epa.gov/pesticide-worker-safety
