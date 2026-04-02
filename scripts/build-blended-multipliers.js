/**
 * Build blended city cost multipliers combining:
 * - BLS trade-specific wages (labor component, ~55% of project cost)
 * - BEA Regional Price Parities (materials/overhead component, ~45%)
 *
 * Produces data/city-cost-multipliers.json (replaces the RPP-only version)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TRADE_WAGES = path.join(ROOT, "data", "trade-wages-by-metro.json");
const RPP_CSV = path.join(ROOT, "data", "bls", "marpp", "MARPP_MSA_2008_2024.csv");
const CITIES_CSV = path.join(ROOT, "inputs", "cities.csv");
const STATE_REGIONS = path.join(ROOT, "data", "state-regions.json");
const OUTPUT = path.join(ROOT, "data", "city-cost-multipliers.json");

const LABOR_WEIGHT = 0.55;
const MATERIALS_WEIGHT = 0.45;

// ---------------------------------------------------------------------------
// Manual suburb-to-MSA mapping for cities that can't be matched by name
// Key format: "city|ST" (use the city name exactly as it appears in cities.csv)
// ---------------------------------------------------------------------------
const SUBURB_TO_MSA = {
  // Texas - Dallas-Fort Worth-Arlington
  "Allen|TX": "Dallas-Fort Worth-Arlington, TX",
  "Carrollton|TX": "Dallas-Fort Worth-Arlington, TX",
  "Denton|TX": "Dallas-Fort Worth-Arlington, TX",
  "Frisco|TX": "Dallas-Fort Worth-Arlington, TX",
  "Garland|TX": "Dallas-Fort Worth-Arlington, TX",
  "Grand Prairie|TX": "Dallas-Fort Worth-Arlington, TX",
  "Irving|TX": "Dallas-Fort Worth-Arlington, TX",
  "Lewisville|TX": "Dallas-Fort Worth-Arlington, TX",
  "McKinney|TX": "Dallas-Fort Worth-Arlington, TX",
  "Mesquite|TX": "Dallas-Fort Worth-Arlington, TX",
  "Plano|TX": "Dallas-Fort Worth-Arlington, TX",
  "Richardson|TX": "Dallas-Fort Worth-Arlington, TX",
  "Flower Mound|TX": "Dallas-Fort Worth-Arlington, TX",
  "Mansfield|TX": "Dallas-Fort Worth-Arlington, TX",
  "North Richland Hills|TX": "Dallas-Fort Worth-Arlington, TX",
  "Rowlett|TX": "Dallas-Fort Worth-Arlington, TX",
  "Wylie|TX": "Dallas-Fort Worth-Arlington, TX",
  // Texas - Houston
  "League City|TX": "Houston-Pasadena-The Woodlands, TX",
  "Pearland|TX": "Houston-Pasadena-The Woodlands, TX",
  "Sugar Land|TX": "Houston-Pasadena-The Woodlands, TX",
  "Baytown|TX": "Houston-Pasadena-The Woodlands, TX",
  "Conroe|TX": "Houston-Pasadena-The Woodlands, TX",
  "Missouri City|TX": "Houston-Pasadena-The Woodlands, TX",
  // Texas - San Antonio
  "New Braunfels|TX": "San Antonio-New Braunfels, TX",

  // Georgia - Atlanta
  "Alpharetta|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Brookhaven|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Dunwoody|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Johns Creek|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Marietta|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Peachtree Corners|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Smyrna|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Peachtree City|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Kennesaw|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Woodstock|GA": "Atlanta-Sandy Springs-Roswell, GA",
  "Newnan|GA": "Atlanta-Sandy Springs-Roswell, GA",
  // Georgia - Augusta
  "Evans|GA": "Augusta-Richmond County, GA-SC",

  // Florida - Miami-Fort Lauderdale
  "Boca Raton|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Boynton Beach|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Coral Springs|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Davie|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Deerfield Beach|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Delray Beach|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Hollywood|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Lauderhill|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Miramar|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Pembroke Pines|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Plantation|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Pompano Beach|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Sunrise|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Tamarac|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Weston|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Coconut Creek|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Doral|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Homestead|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Jupiter|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Margate|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "Wellington|FL": "Miami-Fort Lauderdale-West Palm Beach, FL",
  // Florida - Tampa
  "Largo|FL": "Tampa-St. Petersburg-Clearwater, FL",
  "Plant City|FL": "Tampa-St. Petersburg-Clearwater, FL",
  // Florida - Orlando
  "Apopka|FL": "Orlando-Kissimmee-Sanford, FL",
  "Altamonte Springs|FL": "Orlando-Kissimmee-Sanford, FL",
  "Ocoee|FL": "Orlando-Kissimmee-Sanford, FL",
  // Florida - Jacksonville
  "St. Augustine|FL": "Jacksonville, FL",

  // Illinois - Chicago
  "Arlington Heights|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Aurora|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Bartlett|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Berwyn|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Bolingbrook|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Buffalo Grove|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Cicero|IL": "Chicago-Naperville-Elgin, IL-IN",
  "DeKalb|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Des Plaines|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Downers Grove|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Elmhurst|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Evanston|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Glenview|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Hoffman Estates|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Joliet|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Lombard|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Mount Prospect|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Normal|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Oak Lawn|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Oak Park|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Orland Park|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Palatine|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Plainfield|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Schaumburg|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Skokie|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Tinley Park|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Waukegan|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Wheaton|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Romeoville|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Carol Stream|IL": "Chicago-Naperville-Elgin, IL-IN",
  "Hanover Park|IL": "Chicago-Naperville-Elgin, IL-IN",

  // Minnesota - Minneapolis
  "Apple Valley|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Blaine|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Brooklyn Park|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Burnsville|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Coon Rapids|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Eagan|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Eden Prairie|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Edina|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Lakeville|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Maple Grove|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Maplewood|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Minnetonka|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Plymouth|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "St. Louis Park|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Shakopee|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Woodbury|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Cottage Grove|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Fridley|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Inver Grove Heights|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Roseville|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",
  "Savage|MN": "Minneapolis-St. Paul-Bloomington, MN-WI",

  // Colorado - Denver
  "Arvada|CO": "Denver-Aurora-Centennial, CO",
  "Broomfield|CO": "Denver-Aurora-Centennial, CO",
  "Castle Rock|CO": "Denver-Aurora-Centennial, CO",
  "Commerce City|CO": "Denver-Aurora-Centennial, CO",
  "Lakewood|CO": "Denver-Aurora-Centennial, CO",
  "Littleton|CO": "Denver-Aurora-Centennial, CO",
  "Longmont|CO": "Denver-Aurora-Centennial, CO",
  "Northglenn|CO": "Denver-Aurora-Centennial, CO",
  "Parker|CO": "Denver-Aurora-Centennial, CO",
  "Thornton|CO": "Denver-Aurora-Centennial, CO",
  "Westminster|CO": "Denver-Aurora-Centennial, CO",

  // Ohio - Cleveland area
  "Cleveland Heights|OH": "Cleveland, OH",
  "Cuyahoga Falls|OH": "Akron, OH",
  "Elyria|OH": "Cleveland, OH",
  "Euclid|OH": "Cleveland, OH",
  "Lakewood|OH": "Cleveland, OH",
  "Lorain|OH": "Cleveland, OH",
  "Mentor|OH": "Cleveland, OH",
  "Parma|OH": "Cleveland, OH",
  "Strongsville|OH": "Cleveland, OH",
  // Ohio - Cincinnati area
  "Fairfield|OH": "Cincinnati, OH-KY-IN",
  "Hamilton|OH": "Cincinnati, OH-KY-IN",
  "Middletown|OH": "Cincinnati, OH-KY-IN",
  // Ohio - Columbus area
  "Dublin|OH": "Columbus, OH",
  "Grove City|OH": "Columbus, OH",
  "Westerville|OH": "Columbus, OH",
  "Newark|OH": "Columbus, OH",
  // Ohio - Dayton area
  "Beavercreek|OH": "Dayton-Kettering-Beavercreek, OH",
  "Huber Heights|OH": "Dayton-Kettering-Beavercreek, OH",
  "Kettering|OH": "Dayton-Kettering-Beavercreek, OH",
  // Ohio - other
  "Lancaster|OH": "Columbus, OH",

  // Washington - Seattle
  "Auburn|WA": "Seattle-Tacoma-Bellevue, WA",
  "Burien|WA": "Seattle-Tacoma-Bellevue, WA",
  "Edmonds|WA": "Seattle-Tacoma-Bellevue, WA",
  "Everett|WA": "Seattle-Tacoma-Bellevue, WA",
  "Federal Way|WA": "Seattle-Tacoma-Bellevue, WA",
  "Kent|WA": "Seattle-Tacoma-Bellevue, WA",
  "Kirkland|WA": "Seattle-Tacoma-Bellevue, WA",
  "Marysville|WA": "Seattle-Tacoma-Bellevue, WA",
  "Puyallup|WA": "Seattle-Tacoma-Bellevue, WA",
  "Redmond|WA": "Seattle-Tacoma-Bellevue, WA",
  "Renton|WA": "Seattle-Tacoma-Bellevue, WA",
  "Sammamish|WA": "Seattle-Tacoma-Bellevue, WA",
  "Shoreline|WA": "Seattle-Tacoma-Bellevue, WA",
  "Tukwila|WA": "Seattle-Tacoma-Bellevue, WA",
  "Lynnwood|WA": "Seattle-Tacoma-Bellevue, WA",
  "Bothell|WA": "Seattle-Tacoma-Bellevue, WA",
  "Issaquah|WA": "Seattle-Tacoma-Bellevue, WA",
  "Covington|WA": "Seattle-Tacoma-Bellevue, WA",
  "University Place|WA": "Seattle-Tacoma-Bellevue, WA",

  // New Jersey - New York metro
  "Bayonne|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Clifton|NJ": "New York-Newark-Jersey City, NY-NJ",
  "East Orange|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Elizabeth|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Hackensack|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Hoboken|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Jersey City|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Kearny|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Linden|NJ": "New York-Newark-Jersey City, NY-NJ",
  "New Brunswick|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Passaic|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Paterson|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Perth Amboy|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Plainfield|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Sayreville|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Union City|NJ": "New York-Newark-Jersey City, NY-NJ",
  "West New York|NJ": "New York-Newark-Jersey City, NY-NJ",
  "North Bergen|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Woodbridge|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Edison|NJ": "New York-Newark-Jersey City, NY-NJ",
  "Old Bridge|NJ": "New York-Newark-Jersey City, NY-NJ",

  // Massachusetts - Boston
  "Attleboro|MA": "Boston-Cambridge-Newton, MA-NH",
  "Beverly|MA": "Boston-Cambridge-Newton, MA-NH",
  "Brockton|MA": "Boston-Cambridge-Newton, MA-NH",
  "Chelsea|MA": "Boston-Cambridge-Newton, MA-NH",
  "Chicopee|MA": "Boston-Cambridge-Newton, MA-NH",
  "Everett|MA": "Boston-Cambridge-Newton, MA-NH",
  "Fall River|MA": "Boston-Cambridge-Newton, MA-NH",
  "Fitchburg|MA": "Boston-Cambridge-Newton, MA-NH",
  "Haverhill|MA": "Boston-Cambridge-Newton, MA-NH",
  "Holyoke|MA": "Boston-Cambridge-Newton, MA-NH",
  "Lawrence|MA": "Boston-Cambridge-Newton, MA-NH",
  "Leominster|MA": "Boston-Cambridge-Newton, MA-NH",
  "Lowell|MA": "Boston-Cambridge-Newton, MA-NH",
  "Lynn|MA": "Boston-Cambridge-Newton, MA-NH",
  "Malden|MA": "Boston-Cambridge-Newton, MA-NH",
  "Marlborough|MA": "Boston-Cambridge-Newton, MA-NH",
  "Medford|MA": "Boston-Cambridge-Newton, MA-NH",
  "Methuen|MA": "Boston-Cambridge-Newton, MA-NH",
  "New Bedford|MA": "Boston-Cambridge-Newton, MA-NH",
  "Peabody|MA": "Boston-Cambridge-Newton, MA-NH",
  "Quincy|MA": "Boston-Cambridge-Newton, MA-NH",
  "Revere|MA": "Boston-Cambridge-Newton, MA-NH",
  "Salem|MA": "Boston-Cambridge-Newton, MA-NH",
  "Somerville|MA": "Boston-Cambridge-Newton, MA-NH",
  "Taunton|MA": "Boston-Cambridge-Newton, MA-NH",
  "Waltham|MA": "Boston-Cambridge-Newton, MA-NH",
  "Westfield|MA": "Boston-Cambridge-Newton, MA-NH",
  "Weymouth Town|MA": "Boston-Cambridge-Newton, MA-NH",
  "Woburn|MA": "Boston-Cambridge-Newton, MA-NH",

  // California - Los Angeles
  "Glendale|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Huntington Beach|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Irvine|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Lancaster|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Palmdale|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Santa Clarita|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Torrance|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Garden Grove|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Orange|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Santa Ana|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Pomona|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Pasadena|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Downey|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Norwalk|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "El Monte|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "West Covina|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Burbank|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Inglewood|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Costa Mesa|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Compton|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Carson|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Mission Viejo|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Westminster|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Whittier|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Newport Beach|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Hawthorne|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Alhambra|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Buena Park|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Lake Forest|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Tustin|CA": "Los Angeles-Long Beach-Anaheim, CA",
  "Fullerton|CA": "Los Angeles-Long Beach-Anaheim, CA",
  // California - Riverside-San Bernardino
  "Corona|CA": "Riverside-San Bernardino-Ontario, CA",
  "Fontana|CA": "Riverside-San Bernardino-Ontario, CA",
  "Moreno Valley|CA": "Riverside-San Bernardino-Ontario, CA",
  "Rancho Cucamonga|CA": "Riverside-San Bernardino-Ontario, CA",
  "Temecula|CA": "Riverside-San Bernardino-Ontario, CA",
  "Murrieta|CA": "Riverside-San Bernardino-Ontario, CA",
  "Perris|CA": "Riverside-San Bernardino-Ontario, CA",
  "Hesperia|CA": "Riverside-San Bernardino-Ontario, CA",
  "Victorville|CA": "Riverside-San Bernardino-Ontario, CA",
  "Menifee|CA": "Riverside-San Bernardino-Ontario, CA",
  "Indio|CA": "Riverside-San Bernardino-Ontario, CA",
  "Lake Elsinore|CA": "Riverside-San Bernardino-Ontario, CA",
  "Upland|CA": "Riverside-San Bernardino-Ontario, CA",
  "Redlands|CA": "Riverside-San Bernardino-Ontario, CA",
  "Apple Valley|CA": "Riverside-San Bernardino-Ontario, CA",
  // California - San Diego
  "Escondido|CA": "San Diego-Chula Vista-Carlsbad, CA",
  "Oceanside|CA": "San Diego-Chula Vista-Carlsbad, CA",
  "Vista|CA": "San Diego-Chula Vista-Carlsbad, CA",
  "San Marcos|CA": "San Diego-Chula Vista-Carlsbad, CA",
  "Encinitas|CA": "San Diego-Chula Vista-Carlsbad, CA",
  "National City|CA": "San Diego-Chula Vista-Carlsbad, CA",
  // California - Sacramento
  "Elk Grove|CA": "Sacramento-Roseville-Folsom, CA",
  "Citrus Heights|CA": "Sacramento-Roseville-Folsom, CA",
  "Rancho Cordova|CA": "Sacramento-Roseville-Folsom, CA",
  // California - San Francisco/San Jose
  "Hayward|CA": "San Francisco-Oakland-Fremont, CA",
  "Daly City|CA": "San Francisco-Oakland-Fremont, CA",
  "San Mateo|CA": "San Francisco-Oakland-Fremont, CA",
  "San Leandro|CA": "San Francisco-Oakland-Fremont, CA",
  "South San Francisco|CA": "San Francisco-Oakland-Fremont, CA",
  "Berkeley|CA": "San Francisco-Oakland-Fremont, CA",
  "Richmond|CA": "San Francisco-Oakland-Fremont, CA",
  "Concord|CA": "San Francisco-Oakland-Fremont, CA",
  "Antioch|CA": "San Francisco-Oakland-Fremont, CA",
  "Pleasanton|CA": "San Francisco-Oakland-Fremont, CA",
  "Walnut Creek|CA": "San Francisco-Oakland-Fremont, CA",
  "San Ramon|CA": "San Francisco-Oakland-Fremont, CA",
  "Livermore|CA": "San Francisco-Oakland-Fremont, CA",
  "Milpitas|CA": "San Jose-Sunnyvale-Santa Clara, CA",
  "Mountain View|CA": "San Jose-Sunnyvale-Santa Clara, CA",
  "Cupertino|CA": "San Jose-Sunnyvale-Santa Clara, CA",
  "Palo Alto|CA": "San Jose-Sunnyvale-Santa Clara, CA",
  "Redwood City|CA": "San Jose-Sunnyvale-Santa Clara, CA",
  "Campbell|CA": "San Jose-Sunnyvale-Santa Clara, CA",

  // Arizona - Phoenix
  "Apache Junction|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Avondale|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Buckeye|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Casa Grande|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Gilbert|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Glendale|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Goodyear|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Marana|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Maricopa|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Oro Valley|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Peoria|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Scottsdale|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Surprise|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Tempe|AZ": "Phoenix-Mesa-Chandler, AZ",
  "Queen Creek|AZ": "Phoenix-Mesa-Chandler, AZ",
  "San Tan Valley|AZ": "Phoenix-Mesa-Chandler, AZ",
  // Arizona - Tucson
  "Marana|AZ": "Tucson, AZ",
  "Oro Valley|AZ": "Tucson, AZ",

  // Utah - Salt Lake City
  "Bountiful|UT": "Salt Lake City-Murray, UT",
  "Draper|UT": "Salt Lake City-Murray, UT",
  "Riverton|UT": "Salt Lake City-Murray, UT",
  "Sandy|UT": "Salt Lake City-Murray, UT",
  "South Jordan|UT": "Salt Lake City-Murray, UT",
  "Taylorsville|UT": "Salt Lake City-Murray, UT",
  "West Jordan|UT": "Salt Lake City-Murray, UT",
  "West Valley City|UT": "Salt Lake City-Murray, UT",
  // Utah - Provo
  "Spanish Fork|UT": "Provo-Orem-Lehi, UT",
  // Utah - Ogden
  "Layton|UT": "Ogden, UT",
  "Roy|UT": "Ogden, UT",

  // Oklahoma - Oklahoma City
  "Edmond|OK": "Oklahoma City, OK",
  "Midwest City|OK": "Oklahoma City, OK",
  "Moore|OK": "Oklahoma City, OK",
  "Norman|OK": "Oklahoma City, OK",
  "Stillwater|OK": "Oklahoma City, OK",
  // Oklahoma - Tulsa
  "Broken Arrow|OK": "Tulsa, OK",

  // Arkansas
  "Bentonville|AR": "Fayetteville-Springdale-Rogers, AR",

  // Kentucky
  "Covington|KY": "Cincinnati, OH-KY-IN",

  // Indiana - Indianapolis
  "Carmel|IN": "Indianapolis-Carmel-Greenwood, IN",
  "Fishers|IN": "Indianapolis-Carmel-Greenwood, IN",
  "Greenwood|IN": "Indianapolis-Carmel-Greenwood, IN",
  "Lawrence|IN": "Indianapolis-Carmel-Greenwood, IN",
  "Noblesville|IN": "Indianapolis-Carmel-Greenwood, IN",
  "Anderson|IN": "Indianapolis-Carmel-Greenwood, IN",
  // Indiana - Chicago
  "Gary|IN": "Chicago-Naperville-Elgin, IL-IN",
  "Hammond|IN": "Chicago-Naperville-Elgin, IL-IN",
  // Indiana - Louisville
  "Jeffersonville|IN": "Louisville/Jefferson County, KY-IN",

  // Louisiana
  "Bossier City|LA": "Shreveport-Bossier City, LA",
  "Kenner|LA": "New Orleans-Metairie, LA",

  // Missouri - Kansas City
  "Blue Springs|MO": "Kansas City, MO-KS",
  "Independence|MO": "Kansas City, MO-KS",
  "Lee's Summit|MO": "Kansas City, MO-KS",
  // Missouri - St. Louis
  "O'Fallon|MO": "St. Louis, MO-IL",
  "St. Charles|MO": "St. Louis, MO-IL",
  "St. Peters|MO": "St. Louis, MO-IL",
  "Florissant|MO": "St. Louis, MO-IL",
  "Chesterfield|MO": "St. Louis, MO-IL",

  // Hawaii
  "Honolulu|HI": "Urban Honolulu, HI",

  // North Carolina - Charlotte
  "Concord|NC": "Charlotte-Concord-Gastonia, NC-SC",
  "Gastonia|NC": "Charlotte-Concord-Gastonia, NC-SC",
  "Huntersville|NC": "Charlotte-Concord-Gastonia, NC-SC",
  "Mooresville|NC": "Charlotte-Concord-Gastonia, NC-SC",
  "Indian Trail|NC": "Charlotte-Concord-Gastonia, NC-SC",
  // North Carolina - Raleigh
  "Apex|NC": "Raleigh-Cary, NC",
  "Cary|NC": "Raleigh-Cary, NC",
  "Holly Springs|NC": "Raleigh-Cary, NC",
  "Wake Forest|NC": "Raleigh-Cary, NC",
  "Fuquay-Varina|NC": "Raleigh-Cary, NC",

  // South Carolina - Charlotte
  "Fort Mill|SC": "Charlotte-Concord-Gastonia, NC-SC",
  "Rock Hill|SC": "Charlotte-Concord-Gastonia, NC-SC",

  // Tennessee - Nashville
  "Franklin|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",
  "Murfreesboro|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",
  "Hendersonville|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",
  "Smyrna|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",
  "Spring Hill|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",
  "Lebanon|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",
  "Gallatin|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",
  "Mount Juliet|TN": "Nashville-Davidson--Murfreesboro--Franklin, TN",

  // Maryland - Baltimore
  "Towson|MD": "Baltimore-Columbia-Towson, MD",
  "Columbia|MD": "Baltimore-Columbia-Towson, MD",
  "Ellicott City|MD": "Baltimore-Columbia-Towson, MD",
  // Maryland - DC area
  "Bowie|MD": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Frederick|MD": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Gaithersburg|MD": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Germantown|MD": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Rockville|MD": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Silver Spring|MD": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Waldorf|MD": "Washington-Arlington-Alexandria, DC-VA-MD-WV",

  // Virginia - DC area
  "Centreville|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Dale City|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Fairfax|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Herndon|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Leesburg|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Manassas|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Reston|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Woodbridge|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Ashburn|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
  "Sterling|VA": "Washington-Arlington-Alexandria, DC-VA-MD-WV",

  // Michigan - Detroit
  "Dearborn|MI": "Detroit-Warren-Dearborn, MI",
  "Dearborn Heights|MI": "Detroit-Warren-Dearborn, MI",
  "Livonia|MI": "Detroit-Warren-Dearborn, MI",
  "Novi|MI": "Detroit-Warren-Dearborn, MI",
  "Rochester Hills|MI": "Detroit-Warren-Dearborn, MI",
  "Royal Oak|MI": "Detroit-Warren-Dearborn, MI",
  "Southfield|MI": "Detroit-Warren-Dearborn, MI",
  "Sterling Heights|MI": "Detroit-Warren-Dearborn, MI",
  "Taylor|MI": "Detroit-Warren-Dearborn, MI",
  "Troy|MI": "Detroit-Warren-Dearborn, MI",
  "Westland|MI": "Detroit-Warren-Dearborn, MI",
  "Canton|MI": "Detroit-Warren-Dearborn, MI",
  "Farmington Hills|MI": "Detroit-Warren-Dearborn, MI",
  "Pontiac|MI": "Detroit-Warren-Dearborn, MI",
  "St. Clair Shores|MI": "Detroit-Warren-Dearborn, MI",

  // Pennsylvania - Philadelphia
  "Chester|PA": "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
  "Norristown|PA": "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
  // Pennsylvania - Pittsburgh
  "McKeesport|PA": "Pittsburgh, PA",

  // Connecticut
  "New Britain|CT": "Hartford-West Hartford-East Hartford, CT",
  "Bristol|CT": "Hartford-West Hartford-East Hartford, CT",
  "Meriden|CT": "New Haven, CT",
  "Milford|CT": "New Haven, CT",
  "Stamford|CT": "Bridgeport-Stamford-Danbury, CT",
  "Norwalk|CT": "Bridgeport-Stamford-Danbury, CT",

  // Wisconsin - Milwaukee
  "Brookfield|WI": "Milwaukee-Waukesha, WI",
  "Waukesha|WI": "Milwaukee-Waukesha, WI",
  "Wauwatosa|WI": "Milwaukee-Waukesha, WI",
  "West Allis|WI": "Milwaukee-Waukesha, WI",
  "New Berlin|WI": "Milwaukee-Waukesha, WI",
  "Greenfield|WI": "Milwaukee-Waukesha, WI",
  "Menomonee Falls|WI": "Milwaukee-Waukesha, WI",

  // Oregon - Portland
  "Beaverton|OR": "Portland-Vancouver-Hillsboro, OR-WA",
  "Gresham|OR": "Portland-Vancouver-Hillsboro, OR-WA",
  "Hillsboro|OR": "Portland-Vancouver-Hillsboro, OR-WA",
  "Lake Oswego|OR": "Portland-Vancouver-Hillsboro, OR-WA",
  "Tigard|OR": "Portland-Vancouver-Hillsboro, OR-WA",
  "Tualatin|OR": "Portland-Vancouver-Hillsboro, OR-WA",
  // Oregon - Vancouver WA is in Portland MSA
  "Vancouver|WA": "Portland-Vancouver-Hillsboro, OR-WA",

  // Kansas - Kansas City
  "Overland Park|KS": "Kansas City, MO-KS",
  "Olathe|KS": "Kansas City, MO-KS",
  "Lenexa|KS": "Kansas City, MO-KS",
  "Shawnee|KS": "Kansas City, MO-KS",
  "Leavenworth|KS": "Kansas City, MO-KS",

  // Nevada - Las Vegas
  "Henderson|NV": "Las Vegas-Henderson-North Las Vegas, NV",
  "North Las Vegas|NV": "Las Vegas-Henderson-North Las Vegas, NV",
  "Sparks|NV": "Reno, NV",

  // Alabama - Birmingham
  "Hoover|AL": "Birmingham, AL",
  "Vestavia Hills|AL": "Birmingham, AL",
  "Bessemer|AL": "Birmingham, AL",
  "Alabaster|AL": "Birmingham, AL",
  "Homewood|AL": "Birmingham, AL",
  "Trussville|AL": "Birmingham, AL",
};

// Service-specific trade mappings (which trades drive each service's labor cost)
const SERVICE_TRADE_WEIGHTS = {
  roofing: { roofers: 1.0, construction_laborers: 0.5, sheet_metal_workers: 0.3 },
  hvac: { hvac_mechanics: 1.0, sheet_metal_workers: 0.5, electricians: 0.3 },
  plumbing: { plumbers: 1.0, construction_laborers: 0.3 },
  electrical: { electricians: 1.0, construction_laborers: 0.2 },
  painting: { painters: 1.0, construction_laborers: 0.3 },
  concrete: { cement_masons: 1.0, construction_laborers: 0.5 },
  siding: { carpenters: 0.8, drywall_installers: 0.5, construction_laborers: 0.3 },
  insulation: { drywall_installers: 0.8, construction_laborers: 0.5 },
  fencing: { carpenters: 0.8, construction_laborers: 0.5 },
  landscaping: { construction_laborers: 1.0 },
  foundation: { cement_masons: 0.8, construction_laborers: 0.5 },
  windows: { carpenters: 0.8, construction_laborers: 0.3 },
  "garage-doors": { carpenters: 0.5, electricians: 0.3, construction_laborers: 0.3 },
  solar: { electricians: 1.0, construction_laborers: 0.5 },
  kitchen: { carpenters: 0.6, plumbers: 0.4, electricians: 0.4, painters: 0.3 },
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (c === ',' && !inQuotes) { vals.push(current.trim()); current = ""; continue; }
      current += c;
    }
    vals.push(current.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function extractMsaCities(msaName) {
  const match = msaName.match(/^(.+?),\s*([A-Z]{2}(?:-[A-Z]{2})*)/);
  if (!match) return { cities: [], states: [] };
  return {
    cities: match[1].split(/[-\/]/).map(c => c.trim().replace(/ Town$| City$/, "")),
    states: match[2].split("-")
  };
}

function main() {
  const tradeData = JSON.parse(fs.readFileSync(TRADE_WAGES, "utf8"));
  const stateRegions = JSON.parse(fs.readFileSync(STATE_REGIONS, "utf8"));
  const cities = parseCsv(fs.readFileSync(CITIES_CSV, "utf8"));

  // Parse RPP data
  const rppRows = parseCsv(fs.readFileSync(RPP_CSV, "utf8"));
  const msaRpp = {};
  for (const row of rppRows) {
    if (row.LineCode !== "1") continue;
    const geoName = row.GeoName || "";
    if (!geoName.includes("Metropolitan")) continue;
    let rpp = parseFloat(row["2024"]);
    if (isNaN(rpp)) rpp = parseFloat(row["2023"]);
    if (isNaN(rpp)) continue;
    const cleanName = geoName.replace(/\s*\(Metropolitan Statistical Area\)/, "").trim();
    msaRpp[cleanName] = rpp;
  }

  // Build city -> MSA mapping for trade wages
  const cityToTradesMsa = {};
  for (const msaName of Object.keys(tradeData.metros)) {
    const { cities: msaCities, states } = extractMsaCities(msaName);
    for (const c of msaCities) {
      for (const st of states) {
        cityToTradesMsa[normalize(c) + "|" + st] = msaName;
      }
    }
  }

  // Build city -> MSA mapping for RPP
  const cityToRppMsa = {};
  for (const msaName of Object.keys(msaRpp)) {
    const { cities: msaCities, states } = extractMsaCities(msaName);
    for (const c of msaCities) {
      for (const st of states) {
        cityToRppMsa[normalize(c) + "|" + st] = msaName;
      }
    }
  }

  // Apply manual suburb mappings to both trade and RPP lookups
  for (const [suburbKey, msaName] of Object.entries(SUBURB_TO_MSA)) {
    const [cityName, stateCode] = suburbKey.split("|");
    const normalizedKey = normalize(cityName) + "|" + stateCode;

    // Only add if not already matched by MSA name parsing
    if (!cityToTradesMsa[normalizedKey] && tradeData.metros[msaName]) {
      cityToTradesMsa[normalizedKey] = msaName;
    }
    if (!cityToRppMsa[normalizedKey] && msaRpp[msaName]) {
      cityToRppMsa[normalizedKey] = msaName;
    }
  }

  // Build per-state MSA lists for fallback proximity matching
  // For unmatched cities, assign to the largest MSA (most trades reported) in their state
  const stateMsas = {};
  for (const [msaName, metro] of Object.entries(tradeData.metros)) {
    const { states } = extractMsaCities(msaName);
    const tradeCount = Object.keys(metro.trades).length;
    for (const st of states) {
      if (!stateMsas[st]) stateMsas[st] = [];
      stateMsas[st].push({ msaName, tradeCount, compositeMultiplier: metro.compositeMultiplier });
    }
  }
  // Sort each state's MSAs by trade count descending (most data = largest metro)
  for (const st of Object.keys(stateMsas)) {
    stateMsas[st].sort((a, b) => b.tradeCount - a.tradeCount);
  }

  // Same for RPP
  const stateMsasRpp = {};
  for (const [msaName, rpp] of Object.entries(msaRpp)) {
    const { states } = extractMsaCities(msaName);
    for (const st of states) {
      if (!stateMsasRpp[st]) stateMsasRpp[st] = [];
      stateMsasRpp[st].push({ msaName, rpp });
    }
  }

  // Compute state-level averages for fallback
  const stateAvgLabor = {};
  const stateAvgRpp = {};
  const stateLaborCounts = {};
  const stateRppCounts = {};

  for (const [msaName, metro] of Object.entries(tradeData.metros)) {
    const { states } = extractMsaCities(msaName);
    for (const st of states) {
      if (!stateAvgLabor[st]) { stateAvgLabor[st] = 0; stateLaborCounts[st] = 0; }
      stateAvgLabor[st] += metro.compositeMultiplier;
      stateLaborCounts[st]++;
    }
  }
  for (const st of Object.keys(stateAvgLabor)) {
    stateAvgLabor[st] = Math.round((stateAvgLabor[st] / stateLaborCounts[st]) * 1000) / 1000;
  }

  for (const [msaName, rpp] of Object.entries(msaRpp)) {
    const { states } = extractMsaCities(msaName);
    for (const st of states) {
      if (!stateAvgRpp[st]) { stateAvgRpp[st] = 0; stateRppCounts[st] = 0; }
      stateAvgRpp[st] += rpp;
      stateRppCounts[st]++;
    }
  }
  for (const st of Object.keys(stateAvgRpp)) {
    stateAvgRpp[st] = Math.round((stateAvgRpp[st] / stateRppCounts[st]) * 10) / 10;
  }

  // Process each of our 739 cities
  const result = {};
  let directBoth = 0, directOne = 0, stateLevel = 0;
  let manualMatches = 0, proximityMatches = 0;
  const unmatchedCities = [];

  for (const city of cities) {
    const cityName = city.city;
    const stateCode = city.state_code;
    const key = normalize(cityName) + "|" + stateCode;
    const displayKey = `${cityName}|${stateCode}`;

    // Find labor multiplier
    let laborMult = 1.0;
    let laborSource = "default";
    let tradeMsaName = cityToTradesMsa[key];

    // If no direct or manual match, try proximity: use the largest MSA in the state
    if (!tradeMsaName && stateMsas[stateCode] && stateMsas[stateCode].length > 0) {
      tradeMsaName = stateMsas[stateCode][0].msaName;
      if (tradeData.metros[tradeMsaName]) {
        cityToTradesMsa[key] = tradeMsaName; // cache it
      }
    }

    if (tradeMsaName && tradeData.metros[tradeMsaName]) {
      laborMult = tradeData.metros[tradeMsaName].compositeMultiplier;
      laborSource = SUBURB_TO_MSA[displayKey] ? "suburb_mapped" :
                    cityToTradesMsa[key] === tradeMsaName ? "msa_direct" : "msa_direct";
      // Check if this was a manual mapping
      if (SUBURB_TO_MSA[displayKey]) {
        laborSource = "suburb_mapped";
      }
    } else if (stateAvgLabor[stateCode]) {
      laborMult = stateAvgLabor[stateCode];
      laborSource = "state_avg";
    }

    // Find RPP/materials multiplier
    let materialsMult = 1.0;
    let materialsSource = "default";
    let rppMsaName = cityToRppMsa[key];

    // Proximity fallback for RPP too
    if (!rppMsaName && stateMsasRpp[stateCode] && stateMsasRpp[stateCode].length > 0) {
      rppMsaName = stateMsasRpp[stateCode][0].msaName;
      if (msaRpp[rppMsaName]) {
        cityToRppMsa[key] = rppMsaName;
      }
    }

    if (rppMsaName && msaRpp[rppMsaName]) {
      materialsMult = msaRpp[rppMsaName] / 100;
      materialsSource = SUBURB_TO_MSA[displayKey] ? "suburb_mapped" :
                        "msa_direct";
    } else if (stateAvgRpp[stateCode]) {
      materialsMult = stateAvgRpp[stateCode] / 100;
      materialsSource = "state_avg";
    }

    // Blend: 55% labor + 45% materials
    const blendedMult = Math.round((laborMult * LABOR_WEIGHT + materialsMult * MATERIALS_WEIGHT) * 1000) / 1000;

    // Per-service multipliers using trade-specific wages
    const serviceMultipliers = {};
    if (tradeMsaName && tradeData.metros[tradeMsaName]) {
      const metro = tradeData.metros[tradeMsaName];
      for (const [service, tradeWeights] of Object.entries(SERVICE_TRADE_WEIGHTS)) {
        let wSum = 0, wTotal = 0;
        for (const [trade, weight] of Object.entries(tradeWeights)) {
          if (metro.multipliers[trade]) {
            wSum += metro.multipliers[trade] * weight;
            wTotal += weight;
          }
        }
        if (wTotal > 0) {
          const serviceLaborMult = wSum / wTotal;
          serviceMultipliers[service] = Math.round((serviceLaborMult * LABOR_WEIGHT + materialsMult * MATERIALS_WEIGHT) * 1000) / 1000;
        }
      }
    }

    // Determine source category for counting
    const isManual = !!SUBURB_TO_MSA[displayKey];
    const hasDirectLabor = laborSource === "msa_direct" || laborSource === "suburb_mapped";
    const hasDirectMaterials = materialsSource === "msa_direct" || materialsSource === "suburb_mapped";

    if (hasDirectLabor && hasDirectMaterials) directBoth++;
    else if (hasDirectLabor || hasDirectMaterials) directOne++;
    else stateLevel++;

    if (isManual) manualMatches++;
    if (laborSource === "state_avg" && materialsSource === "state_avg") {
      unmatchedCities.push(displayKey);
    }

    // Determine the effective source label
    let sourceLabel = "state_avg";
    if (hasDirectLabor) {
      sourceLabel = isManual ? "suburb_mapped" : "msa_direct";
    }

    result[displayKey] = {
      multiplier: blendedMult,
      laborMult: Math.round(laborMult * 1000) / 1000,
      materialsMult: Math.round(materialsMult * 1000) / 1000,
      serviceMultipliers: Object.keys(serviceMultipliers).length > 0 ? serviceMultipliers : undefined,
      source: sourceLabel
    };
  }

  console.log(`\nBlended multiplier results:`);
  console.log(`  Both MSA direct (incl. suburb mapped): ${directBoth}`);
  console.log(`  One MSA + one state: ${directOne}`);
  console.log(`  Both state-level: ${stateLevel}`);
  console.log(`  Total: ${cities.length}`);
  console.log(`\nMatch breakdown:`);
  console.log(`  MSA name match: ${directBoth + directOne - manualMatches}`);
  console.log(`  Manual suburb mapping: ${manualMatches}`);
  console.log(`  State avg fallback: ${stateLevel}`);

  if (unmatchedCities.length > 0 && unmatchedCities.length <= 50) {
    console.log(`\nCities still on state averages:`);
    for (const c of unmatchedCities) console.log(`  ${c}`);
  } else if (unmatchedCities.length > 50) {
    console.log(`\n${unmatchedCities.length} cities still on state averages (showing first 30):`);
    for (const c of unmatchedCities.slice(0, 30)) console.log(`  ${c}`);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), "utf8");
  console.log(`\nWrote ${OUTPUT}`);

  // Samples
  console.log("\nSample blended multipliers (labor | materials | blended | source):");
  const samples = [
    "New York|NY", "San Francisco|CA", "Dallas|TX", "Houston|TX",
    "Seattle|WA", "Miami|FL", "Jackson|MS", "Fort Mill|SC",
    "Birmingham|AL", "Denver|CO", "Allen|TX", "Alpharetta|GA",
    "Plano|TX", "Scottsdale|AZ", "Edmond|OK", "Carmel|IN",
    "Honolulu|HI", "Broken Arrow|OK", "Frisco|TX", "Schaumburg|IL"
  ];
  for (const k of samples) {
    const v = result[k];
    if (v) console.log(`  ${k}: labor=${v.laborMult} materials=${v.materialsMult} blended=${v.multiplier} (${v.source})`);
  }
}

main();
