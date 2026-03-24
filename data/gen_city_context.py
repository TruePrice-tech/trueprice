import csv
import json
import os

# Read cities
cities = []
csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'inputs', 'cities.csv')
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row['city'].strip():
            cities.append({
                'city': row['city'].strip(),
                'state': row['state'].strip(),
                'state_code': row['state_code'].strip(),
                'population': int(row['population'].strip()) if row['population'].strip() else 0
            })

print(f"Total cities: {len(cities)}")

# Climate zone mapping by state (IECC-based)
state_climate = {
    'AL': 'hot_humid', 'AK': 'subarctic', 'AZ': 'hot_dry', 'AR': 'mixed_humid',
    'CA': 'hot_dry', 'CO': 'cold', 'CT': 'cold', 'DE': 'mixed_humid',
    'FL': 'hot_humid', 'GA': 'hot_humid', 'HI': 'hot_humid', 'ID': 'cold',
    'IL': 'cold', 'IN': 'cold', 'IA': 'cold', 'KS': 'mixed_dry',
    'KY': 'mixed_humid', 'LA': 'hot_humid', 'ME': 'very_cold', 'MD': 'mixed_humid',
    'MA': 'cold', 'MI': 'cold', 'MN': 'very_cold', 'MS': 'hot_humid',
    'MO': 'mixed_humid', 'MT': 'very_cold', 'NE': 'cold', 'NV': 'hot_dry',
    'NH': 'cold', 'NJ': 'mixed_humid', 'NM': 'hot_dry', 'NY': 'cold',
    'NC': 'mixed_humid', 'ND': 'very_cold', 'OH': 'cold', 'OK': 'mixed_humid',
    'OR': 'marine', 'PA': 'cold', 'RI': 'cold', 'SC': 'hot_humid',
    'SD': 'cold', 'TN': 'mixed_humid', 'TX': 'hot_humid', 'UT': 'cold',
    'VT': 'very_cold', 'VA': 'mixed_humid', 'WA': 'marine', 'WV': 'mixed_humid',
    'WI': 'cold', 'WY': 'cold'
}

city_climate_overrides = {
    ('San Francisco', 'CA'): 'marine', ('Oakland', 'CA'): 'marine', ('San Jose', 'CA'): 'marine',
    ('Santa Rosa', 'CA'): 'marine', ('Fremont', 'CA'): 'marine', ('Hayward', 'CA'): 'marine',
    ('Sunnyvale', 'CA'): 'marine', ('Salinas', 'CA'): 'marine',
    ('Portland', 'OR'): 'marine', ('Salem', 'OR'): 'marine', ('Eugene', 'OR'): 'marine',
    ('Beaverton', 'OR'): 'marine', ('Gresham', 'OR'): 'marine', ('Hillsboro', 'OR'): 'marine',
    ('Bend', 'OR'): 'cold', ('Medford', 'OR'): 'mixed_dry',
    ('Corvallis', 'OR'): 'marine', ('Albany', 'OR'): 'marine',
    ('Springfield', 'OR'): 'marine', ('Tigard', 'OR'): 'marine',
    ('Lake Oswego', 'OR'): 'marine', ('Keizer', 'OR'): 'marine',
    ('Seattle', 'WA'): 'marine', ('Tacoma', 'WA'): 'marine', ('Bellevue', 'WA'): 'marine',
    ('Spokane', 'WA'): 'cold', ('Spokane Valley', 'WA'): 'cold',
    ('Yakima', 'WA'): 'mixed_dry', ('Kennewick', 'WA'): 'mixed_dry',
    ('Pasco', 'WA'): 'mixed_dry', ('Richland', 'WA'): 'mixed_dry',
    ('Vancouver', 'WA'): 'marine', ('Olympia', 'WA'): 'marine',
    ('Bellingham', 'WA'): 'marine', ('Everett', 'WA'): 'marine',
    ('Kent', 'WA'): 'marine', ('Renton', 'WA'): 'marine',
    ('Federal Way', 'WA'): 'marine', ('Auburn', 'WA'): 'marine',
    ('Kirkland', 'WA'): 'marine', ('Redmond', 'WA'): 'marine',
    ('Sammamish', 'WA'): 'marine', ('Shoreline', 'WA'): 'marine',
    ('Burien', 'WA'): 'marine', ('Edmonds', 'WA'): 'marine',
    ('Bremerton', 'WA'): 'marine', ('Lacey', 'WA'): 'marine',
    ('Lakewood', 'WA'): 'marine', ('Marysville', 'WA'): 'marine',
    ('Puyallup', 'WA'): 'marine',
    ('El Paso', 'TX'): 'hot_dry', ('Amarillo', 'TX'): 'mixed_dry',
    ('Lubbock', 'TX'): 'mixed_dry', ('Midland', 'TX'): 'hot_dry',
    ('Odessa', 'TX'): 'hot_dry', ('Abilene', 'TX'): 'mixed_dry',
    ('San Angelo', 'TX'): 'hot_dry', ('Wichita Falls', 'TX'): 'mixed_dry',
    ('Belleville', 'IL'): 'mixed_humid',
    ('Grand Junction', 'CO'): 'mixed_dry', ('Pueblo', 'CO'): 'mixed_dry',
    ('Reno', 'NV'): 'cold', ('Sparks', 'NV'): 'cold',
    ('Albuquerque', 'NM'): 'mixed_dry', ('Santa Fe', 'NM'): 'cold',
    ('Rio Rancho', 'NM'): 'mixed_dry',
    ('St. George', 'UT'): 'hot_dry',
    ('Flagstaff', 'AZ'): 'cold',
    ('Asheville', 'NC'): 'cold',
    ('Duluth', 'MN'): 'very_cold',
}

state_hail = {
    'TX': 'high', 'OK': 'high', 'KS': 'high', 'NE': 'high', 'CO': 'high',
    'SD': 'high', 'ND': 'high', 'IA': 'moderate', 'MO': 'moderate', 'MN': 'moderate',
    'WI': 'moderate', 'IL': 'moderate', 'IN': 'moderate', 'AR': 'moderate',
    'MS': 'low', 'AL': 'moderate', 'GA': 'moderate', 'SC': 'low', 'NC': 'low',
    'VA': 'low', 'WV': 'low', 'KY': 'moderate', 'TN': 'moderate', 'OH': 'moderate',
    'MI': 'moderate', 'PA': 'low', 'NY': 'low', 'NJ': 'low', 'CT': 'low',
    'RI': 'low', 'MA': 'low', 'NH': 'low', 'VT': 'low', 'ME': 'low',
    'FL': 'moderate', 'LA': 'moderate', 'MT': 'moderate', 'WY': 'moderate',
    'NM': 'moderate', 'AZ': 'low', 'NV': 'low', 'UT': 'moderate', 'ID': 'low',
    'OR': 'low', 'WA': 'low', 'CA': 'low', 'HI': 'low', 'AK': 'low',
    'DE': 'low', 'MD': 'low',
}

city_hail_overrides = {
    ('San Antonio', 'TX'): 'moderate', ('El Paso', 'TX'): 'low',
    ('Brownsville', 'TX'): 'low', ('Laredo', 'TX'): 'low',
    ('Corpus Christi', 'TX'): 'low', ('McAllen', 'TX'): 'low',
    ('Minneapolis', 'MN'): 'high', ('St. Paul', 'MN'): 'high',
    ('Des Moines', 'IA'): 'high', ('Cedar Rapids', 'IA'): 'high',
    ('Phoenix', 'AZ'): 'low', ('Tucson', 'AZ'): 'low',
}

hurricane_specific = {
    ('Mobile', 'AL'), ('Biloxi', 'MS'), ('Gulfport', 'MS'),
    ('New Orleans', 'LA'), ('Baton Rouge', 'LA'), ('Kenner', 'LA'),
    ('Lake Charles', 'LA'), ('Lafayette', 'LA'), ('Bossier City', 'LA'),
    ('Shreveport', 'LA'), ('Monroe', 'LA'), ('Alexandria', 'LA'),
    ('Houston', 'TX'), ('Corpus Christi', 'TX'),
    ('Beaumont', 'TX'), ('Pasadena', 'TX'), ('League City', 'TX'),
    ('Pearland', 'TX'), ('Sugar Land', 'TX'), ('Brownsville', 'TX'),
    ('McAllen', 'TX'),
    ('Charleston', 'SC'), ('North Charleston', 'SC'), ('Mount Pleasant', 'SC'),
    ('Hilton Head Island', 'SC'), ('Goose Creek', 'SC'), ('Summerville', 'SC'),
    ('Columbia', 'SC'), ('Florence', 'SC'),
    ('Wilmington', 'NC'), ('Jacksonville', 'NC'), ('Greenville', 'NC'),
    ('Fayetteville', 'NC'), ('Raleigh', 'NC'), ('Durham', 'NC'),
    ('Charlotte', 'NC'), ('Rocky Mount', 'NC'), ('Wilson', 'NC'),
    ('Norfolk', 'VA'), ('Virginia Beach', 'VA'), ('Newport News', 'VA'),
    ('Hampton', 'VA'), ('Chesapeake', 'VA'), ('Portsmouth', 'VA'),
    ('Suffolk', 'VA'),
    ('Savannah', 'GA'),
    ('Hattiesburg', 'MS'), ('Jackson', 'MS'),
    ('Honolulu', 'HI'),
}

state_snow = {
    'AL': 'low', 'AK': 'high', 'AZ': 'low', 'AR': 'low',
    'CA': 'low', 'CO': 'moderate', 'CT': 'moderate', 'DE': 'low',
    'FL': 'low', 'GA': 'low', 'HI': 'low', 'ID': 'high',
    'IL': 'moderate', 'IN': 'moderate', 'IA': 'moderate', 'KS': 'moderate',
    'KY': 'low', 'LA': 'low', 'ME': 'high', 'MD': 'low',
    'MA': 'moderate', 'MI': 'high', 'MN': 'high', 'MS': 'low',
    'MO': 'low', 'MT': 'high', 'NE': 'moderate', 'NV': 'low',
    'NH': 'high', 'NJ': 'moderate', 'NM': 'low', 'NY': 'moderate',
    'NC': 'low', 'ND': 'high', 'OH': 'moderate', 'OK': 'low',
    'OR': 'low', 'PA': 'moderate', 'RI': 'moderate', 'SC': 'low',
    'SD': 'moderate', 'TN': 'low', 'TX': 'low', 'UT': 'moderate',
    'VT': 'high', 'VA': 'low', 'WA': 'low', 'WV': 'moderate',
    'WI': 'high', 'WY': 'high'
}

city_snow_overrides = {
    ('Buffalo', 'NY'): 'high', ('Syracuse', 'NY'): 'high', ('Rochester', 'NY'): 'high',
    ('Albany', 'NY'): 'high', ('Utica', 'NY'): 'high', ('Binghamton', 'NY'): 'high',
    ('Niagara Falls', 'NY'): 'high', ('Schenectady', 'NY'): 'high', ('Troy', 'NY'): 'high',
    ('Flagstaff', 'AZ'): 'high', ('Prescott', 'AZ'): 'moderate',
    ('Asheville', 'NC'): 'moderate',
    ('Reno', 'NV'): 'moderate', ('Sparks', 'NV'): 'moderate',
    ('Santa Fe', 'NM'): 'moderate',
    ('Duluth', 'MN'): 'high', ('Erie', 'PA'): 'high',
    ('Boston', 'MA'): 'high', ('Worcester', 'MA'): 'high',
    ('Springfield', 'MA'): 'high',
    ('Spokane', 'WA'): 'moderate', ('Spokane Valley', 'WA'): 'moderate',
    ('Yakima', 'WA'): 'moderate',
    ('Bend', 'OR'): 'moderate',
    ('Pueblo', 'CO'): 'low',
    ('St. George', 'UT'): 'low',
    ('Amarillo', 'TX'): 'moderate',
    ('Cleveland', 'OH'): 'high',
    ('Boise City', 'ID'): 'moderate',
}

high_growth_cities = {
    ('Austin', 'TX'), ('Boise City', 'ID'), ('Nashville', 'TN'), ('Raleigh', 'NC'),
    ('Charlotte', 'NC'), ('Denver', 'CO'), ('Phoenix', 'AZ'), ('Mesa', 'AZ'),
    ('Chandler', 'AZ'), ('Gilbert', 'AZ'), ('Scottsdale', 'AZ'), ('Surprise', 'AZ'),
    ('Goodyear', 'AZ'), ('Buckeye', 'AZ'), ('Maricopa', 'AZ'), ('Peoria', 'AZ'),
    ('San Antonio', 'TX'), ('Dallas', 'TX'), ('Fort Worth', 'TX'), ('Houston', 'TX'),
    ('Frisco', 'TX'), ('McKinney', 'TX'), ('Round Rock', 'TX'), ('Allen', 'TX'),
    ('Lewisville', 'TX'), ('Plano', 'TX'), ('Denton', 'TX'),
    ('Orlando', 'FL'), ('Jacksonville', 'FL'), ('Tampa', 'FL'), ('Cape Coral', 'FL'),
    ('Port St. Lucie', 'FL'), ('Lakeland', 'FL'),
    ('Salt Lake City', 'UT'), ('Provo', 'UT'), ('Lehi', 'UT'), ('South Jordan', 'UT'),
    ('Draper', 'UT'), ('St. George', 'UT'), ('West Jordan', 'UT'),
    ('Meridian', 'ID'), ('Nampa', 'ID'), ('Caldwell', 'ID'),
    ('Colorado Springs', 'CO'), ('Aurora', 'CO'), ('Fort Collins', 'CO'),
    ('Castle Rock', 'CO'), ('Parker', 'CO'), ('Thornton', 'CO'), ('Broomfield', 'CO'),
    ('Bentonville', 'AR'), ('Rogers', 'AR'), ('Fayetteville', 'AR'), ('Springdale', 'AR'),
    ('Durham', 'NC'), ('Cary', 'NC'), ('Apex', 'NC'), ('Huntersville', 'NC'),
    ('Charleston', 'SC'), ('Mount Pleasant', 'SC'), ('Summerville', 'SC'),
    ('Murfreesboro', 'TN'), ('Franklin', 'TN'), ('Brentwood', 'TN'), ('Smyrna', 'TN'),
    ('Hendersonville', 'TN'), ('Clarksville', 'TN'),
    ('Atlanta', 'GA'), ('Alpharetta', 'GA'), ('Johns Creek', 'GA'), ('Brookhaven', 'GA'),
    ('Dunwoody', 'GA'), ('Roswell', 'GA'), ('Sandy Springs', 'GA'), ('Marietta', 'GA'),
    ('Bozeman', 'MT'),
    ('Las Vegas', 'NV'), ('Henderson', 'NV'), ('North Las Vegas', 'NV'),
    ("Coeur d'Alene", 'ID'),
    ('Sioux Falls', 'SD'),
    ('Greeley', 'CO'), ('Longmont', 'CO'), ('Loveland', 'CO'),
    ('League City', 'TX'), ('Pearland', 'TX'), ('Sugar Land', 'TX'),
    ('Grand Prairie', 'TX'), ('Carrollton', 'TX'), ('Irving', 'TX'),
    ('Irvine', 'CA'), ('Elk Grove', 'CA'),
    ('Fishers', 'IN'), ('Carmel', 'IN'), ('Noblesville', 'IN'),
    ('Overland Park', 'KS'), ('Olathe', 'KS'), ('Lenexa', 'KS'),
    ("Lee's Summit", 'MO'), ("O'Fallon", 'MO'),
    ('Edmond', 'OK'), ('Broken Arrow', 'OK'),
    ('West Des Moines', 'IA'), ('Ankeny', 'IA'),
    ('Riverton', 'UT'), ('Spanish Fork', 'UT'),
    ('Sammamish', 'WA'), ('Redmond', 'WA'), ('Kirkland', 'WA'),
    ('Lakeville', 'MN'), ('Woodbury', 'MN'), ('Shakopee', 'MN'),
    ('Maple Grove', 'MN'), ('Plymouth', 'MN'), ('Eden Prairie', 'MN'),
    ('Wilmington', 'NC'), ('Greenville', 'SC'),
    ('Hilton Head Island', 'SC'), ('Goose Creek', 'SC'),
    ('Boca Raton', 'FL'), ('Palm Coast', 'FL'), ('Deltona', 'FL'),
    ('Kissimmee', 'FL'), ('Melbourne', 'FL'), ('Palm Bay', 'FL'),
    ('College Station', 'TX'), ('Midland', 'TX'),
    ('Idaho Falls', 'ID'),
    ('Bend', 'OR'),
    ('Fargo', 'ND'),
    ('Concord', 'NC'), ('Gastonia', 'NC'),
    ('Rock Hill', 'SC'),
    ('North Charleston', 'SC'),
    ('Peachtree Corners', 'GA'), ('Smyrna', 'GA'),
    ('Miramar', 'FL'), ('Homestead', 'FL'),
}

low_growth_cities = {
    ('Detroit', 'MI'), ('Cleveland', 'OH'), ('Baltimore', 'MD'), ('St. Louis', 'MO'),
    ('Buffalo', 'NY'), ('Rochester', 'NY'), ('Syracuse', 'NY'), ('Hartford', 'CT'),
    ('Bridgeport', 'CT'), ('New Haven', 'CT'),
    ('Gary', 'IN'), ('Flint', 'MI'), ('Saginaw', 'MI'), ('Pontiac', 'MI'),
    ('Youngstown', 'OH'), ('Dayton', 'OH'), ('Canton', 'OH'), ('Akron', 'OH'),
    ('Toledo', 'OH'), ('Erie', 'PA'), ('Scranton', 'PA'), ('Wilkes-Barre', 'PA'),
    ('Utica', 'NY'), ('Binghamton', 'NY'), ('Niagara Falls', 'NY'),
    ('Camden', 'NJ'), ('Trenton', 'NJ'), ('Paterson', 'NJ'), ('Newark', 'NJ'),
    ('Jackson', 'MS'), ('Memphis', 'TN'), ('Birmingham', 'AL'),
    ('Pine Bluff', 'AR'), ('Shreveport', 'LA'), ('Monroe', 'LA'),
    ('Decatur', 'IL'), ('Rockford', 'IL'), ('Peoria', 'IL'),
    ('Muncie', 'IN'), ('Anderson', 'IN'), ('Terre Haute', 'IN'), ('Kokomo', 'IN'),
    ('Hammond', 'IN'), ('South Bend', 'IN'), ('Elkhart', 'IN'),
    ('Lorain', 'OH'), ('Elyria', 'OH'), ('Mansfield', 'OH'), ('Lima', 'OH'),
    ('Springfield', 'OH'), ('Warren', 'OH'),
    ('Waterbury', 'CT'), ('New Britain', 'CT'), ('Norwich', 'CT'),
    ('Fall River', 'MA'), ('New Bedford', 'MA'), ('Holyoke', 'MA'),
    ('Fitchburg', 'MA'), ('Pittsfield', 'MA'),
    ('Muskegon', 'MI'), ('Battle Creek', 'MI'), ('Lincoln Park', 'MI'),
    ('Roseville', 'MI'), ('Taylor', 'MI'),
    ('Duluth', 'MN'), ('Moorhead', 'MN'),
    ('Hattiesburg', 'MS'), ('Meridian', 'MS'),
    ('Biloxi', 'MS'), ('Gulfport', 'MS'),
    ('Waterloo', 'IA'), ('Dubuque', 'IA'),
    ('Joplin', 'MO'), ('St. Joseph', 'MO'), ('Florissant', 'MO'),
    ('Great Falls', 'MT'),
    ('Atlantic City', 'NJ'), ('East Orange', 'NJ'),
    ('Albany', 'GA'), ('Macon', 'GA'),
    ('Danville', 'VA'), ('Lynchburg', 'VA'),
    ('Mobile', 'AL'), ('Dothan', 'AL'), ('Montgomery', 'AL'),
    ('Huntington', 'WV'), ('Charleston', 'WV'),
    ('Daytona Beach', 'FL'),
    ('Euclid', 'OH'), ('Cleveland Heights', 'OH'), ('Lakewood', 'OH'), ('Parma', 'OH'),
    ('East Providence', 'RI'), ('Pawtucket', 'RI'), ('Woonsocket', 'RI'),
    ('Waukegan', 'IL'), ('Cicero', 'IL'), ('Berwyn', 'IL'),
    ('Lawton', 'OK'), ('Muskogee', 'OK'), ('Enid', 'OK'),
    ('Beaumont', 'TX'), ('Brownsville', 'TX'), ('Laredo', 'TX'), ('Wichita Falls', 'TX'),
    ('Odessa', 'TX'), ('Abilene', 'TX'),
    ('Casper', 'WY'),
    ('Racine', 'WI'), ('Beloit', 'WI'),
    ('Sumter', 'SC'), ('Spartanburg', 'SC'), ('Florence', 'SC'),
    ('Rocky Mount', 'NC'), ('Wilson', 'NC'), ('Hickory', 'NC'),
    ('Valdosta', 'GA'), ('Warner Robins', 'GA'),
    ('Phenix City', 'AL'), ('Florence', 'AL'), ('Decatur', 'AL'), ('Auburn', 'AL'),
    ('Clovis', 'NM'), ('Roswell', 'NM'), ('Farmington', 'NM'),
    ('Hutchinson', 'KS'), ('Salina', 'KS'),
    ('Minot', 'ND'),
    ('Pocatello', 'ID'),
}

state_names = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming'
}

metro_areas = {
    ('Dallas', 'TX'): 'Dallas-Fort Worth', ('Fort Worth', 'TX'): 'Dallas-Fort Worth',
    ('Arlington', 'TX'): 'Dallas-Fort Worth', ('Plano', 'TX'): 'Dallas-Fort Worth',
    ('Irving', 'TX'): 'Dallas-Fort Worth', ('Garland', 'TX'): 'Dallas-Fort Worth',
    ('Grand Prairie', 'TX'): 'Dallas-Fort Worth', ('Mesquite', 'TX'): 'Dallas-Fort Worth',
    ('Carrollton', 'TX'): 'Dallas-Fort Worth', ('Lewisville', 'TX'): 'Dallas-Fort Worth',
    ('Richardson', 'TX'): 'Dallas-Fort Worth', ('Frisco', 'TX'): 'Dallas-Fort Worth',
    ('McKinney', 'TX'): 'Dallas-Fort Worth', ('Allen', 'TX'): 'Dallas-Fort Worth',
    ('Denton', 'TX'): 'Dallas-Fort Worth',
    ('Houston', 'TX'): 'Greater Houston', ('Pasadena', 'TX'): 'Greater Houston',
    ('Pearland', 'TX'): 'Greater Houston', ('Sugar Land', 'TX'): 'Greater Houston',
    ('League City', 'TX'): 'Greater Houston',
    ('Phoenix', 'AZ'): 'Phoenix metro', ('Mesa', 'AZ'): 'Phoenix metro',
    ('Chandler', 'AZ'): 'Phoenix metro', ('Scottsdale', 'AZ'): 'Phoenix metro',
    ('Tempe', 'AZ'): 'Phoenix metro', ('Gilbert', 'AZ'): 'Phoenix metro',
    ('Glendale', 'AZ'): 'Phoenix metro', ('Peoria', 'AZ'): 'Phoenix metro',
    ('Surprise', 'AZ'): 'Phoenix metro', ('Goodyear', 'AZ'): 'Phoenix metro',
    ('Avondale', 'AZ'): 'Phoenix metro', ('Buckeye', 'AZ'): 'Phoenix metro',
    ('Maricopa', 'AZ'): 'Phoenix metro',
    ('Minneapolis', 'MN'): 'Twin Cities', ('St. Paul', 'MN'): 'Twin Cities',
    ('Brooklyn Park', 'MN'): 'Twin Cities', ('Plymouth', 'MN'): 'Twin Cities',
    ('Bloomington', 'MN'): 'Twin Cities', ('Eagan', 'MN'): 'Twin Cities',
    ('Eden Prairie', 'MN'): 'Twin Cities', ('Maple Grove', 'MN'): 'Twin Cities',
    ('Woodbury', 'MN'): 'Twin Cities', ('Lakeville', 'MN'): 'Twin Cities',
    ('Burnsville', 'MN'): 'Twin Cities', ('Apple Valley', 'MN'): 'Twin Cities',
    ('Blaine', 'MN'): 'Twin Cities', ('Coon Rapids', 'MN'): 'Twin Cities',
    ('Shakopee', 'MN'): 'Twin Cities', ('Edina', 'MN'): 'Twin Cities',
    ('Minnetonka', 'MN'): 'Twin Cities', ('Maplewood', 'MN'): 'Twin Cities',
    ('St. Louis Park', 'MN'): 'Twin Cities',
    ('Denver', 'CO'): 'Denver metro', ('Aurora', 'CO'): 'Denver metro',
    ('Lakewood', 'CO'): 'Denver metro', ('Arvada', 'CO'): 'Denver metro',
    ('Westminster', 'CO'): 'Denver metro', ('Thornton', 'CO'): 'Denver metro',
    ('Centennial', 'CO'): 'Denver metro', ('Littleton', 'CO'): 'Denver metro',
    ('Broomfield', 'CO'): 'Denver metro', ('Northglenn', 'CO'): 'Denver metro',
    ('Commerce City', 'CO'): 'Denver metro', ('Parker', 'CO'): 'Denver metro',
    ('Castle Rock', 'CO'): 'Denver metro',
    ('Chicago', 'IL'): 'Chicagoland', ('Aurora', 'IL'): 'Chicagoland',
    ('Naperville', 'IL'): 'Chicagoland', ('Joliet', 'IL'): 'Chicagoland',
    ('Elgin', 'IL'): 'Chicagoland', ('Bolingbrook', 'IL'): 'Chicagoland',
    ('Schaumburg', 'IL'): 'Chicagoland', ('Arlington Heights', 'IL'): 'Chicagoland',
    ('Evanston', 'IL'): 'Chicagoland', ('Palatine', 'IL'): 'Chicagoland',
    ('Skokie', 'IL'): 'Chicagoland', ('Des Plaines', 'IL'): 'Chicagoland',
    ('Orland Park', 'IL'): 'Chicagoland', ('Tinley Park', 'IL'): 'Chicagoland',
    ('Oak Lawn', 'IL'): 'Chicagoland', ('Berwyn', 'IL'): 'Chicagoland',
    ('Cicero', 'IL'): 'Chicagoland', ('Oak Park', 'IL'): 'Chicagoland',
    ('Elmhurst', 'IL'): 'Chicagoland', ('Downers Grove', 'IL'): 'Chicagoland',
    ('Wheaton', 'IL'): 'Chicagoland', ('Glenview', 'IL'): 'Chicagoland',
    ('Buffalo Grove', 'IL'): 'Chicagoland', ('Hoffman Estates', 'IL'): 'Chicagoland',
    ('Mount Prospect', 'IL'): 'Chicagoland', ('Lombard', 'IL'): 'Chicagoland',
    ('Bartlett', 'IL'): 'Chicagoland', ('Plainfield', 'IL'): 'Chicagoland',
    ('Waukegan', 'IL'): 'Chicagoland',
    ('Atlanta', 'GA'): 'metro Atlanta', ('Alpharetta', 'GA'): 'metro Atlanta',
    ('Marietta', 'GA'): 'metro Atlanta', ('Roswell', 'GA'): 'metro Atlanta',
    ('Sandy Springs', 'GA'): 'metro Atlanta', ('Johns Creek', 'GA'): 'metro Atlanta',
    ('Brookhaven', 'GA'): 'metro Atlanta', ('Dunwoody', 'GA'): 'metro Atlanta',
    ('Smyrna', 'GA'): 'metro Atlanta', ('Peachtree Corners', 'GA'): 'metro Atlanta',
    ('Seattle', 'WA'): 'Puget Sound', ('Bellevue', 'WA'): 'Puget Sound',
    ('Tacoma', 'WA'): 'Puget Sound', ('Kent', 'WA'): 'Puget Sound',
    ('Renton', 'WA'): 'Puget Sound', ('Federal Way', 'WA'): 'Puget Sound',
    ('Auburn', 'WA'): 'Puget Sound', ('Kirkland', 'WA'): 'Puget Sound',
    ('Redmond', 'WA'): 'Puget Sound', ('Sammamish', 'WA'): 'Puget Sound',
    ('Shoreline', 'WA'): 'Puget Sound', ('Burien', 'WA'): 'Puget Sound',
    ('Edmonds', 'WA'): 'Puget Sound', ('Bremerton', 'WA'): 'Puget Sound',
    ('Everett', 'WA'): 'Puget Sound', ('Marysville', 'WA'): 'Puget Sound',
    ('Puyallup', 'WA'): 'Puget Sound', ('Lakewood', 'WA'): 'Puget Sound',
    ('San Antonio', 'TX'): 'San Antonio area',
    ('Nashville', 'TN'): 'Greater Nashville', ('Murfreesboro', 'TN'): 'Greater Nashville',
    ('Franklin', 'TN'): 'Greater Nashville', ('Brentwood', 'TN'): 'Greater Nashville',
    ('Hendersonville', 'TN'): 'Greater Nashville', ('Smyrna', 'TN'): 'Greater Nashville',
    ('Las Vegas', 'NV'): 'Las Vegas Valley', ('Henderson', 'NV'): 'Las Vegas Valley',
    ('North Las Vegas', 'NV'): 'Las Vegas Valley',
    ('Salt Lake City', 'UT'): 'Wasatch Front', ('Provo', 'UT'): 'Wasatch Front',
    ('Orem', 'UT'): 'Wasatch Front', ('West Jordan', 'UT'): 'Wasatch Front',
    ('West Valley City', 'UT'): 'Wasatch Front', ('Sandy', 'UT'): 'Wasatch Front',
    ('Ogden', 'UT'): 'Wasatch Front', ('Layton', 'UT'): 'Wasatch Front',
    ('South Jordan', 'UT'): 'Wasatch Front', ('Draper', 'UT'): 'Wasatch Front',
    ('Riverton', 'UT'): 'Wasatch Front', ('Murray', 'UT'): 'Wasatch Front',
    ('Taylorsville', 'UT'): 'Wasatch Front', ('Bountiful', 'UT'): 'Wasatch Front',
    ('Roy', 'UT'): 'Wasatch Front', ('Lehi', 'UT'): 'Wasatch Front',
    ('Spanish Fork', 'UT'): 'Wasatch Front',
    ('Kansas City', 'MO'): 'Kansas City metro', ('Kansas City', 'KS'): 'Kansas City metro',
    ('Overland Park', 'KS'): 'Kansas City metro', ('Olathe', 'KS'): 'Kansas City metro',
    ('Lenexa', 'KS'): 'Kansas City metro', ('Shawnee', 'KS'): 'Kansas City metro',
    ('Independence', 'MO'): 'Kansas City metro', ("Lee's Summit", 'MO'): 'Kansas City metro',
    ('Blue Springs', 'MO'): 'Kansas City metro',
    ('Portland', 'OR'): 'Portland metro', ('Beaverton', 'OR'): 'Portland metro',
    ('Gresham', 'OR'): 'Portland metro', ('Hillsboro', 'OR'): 'Portland metro',
    ('Tigard', 'OR'): 'Portland metro', ('Lake Oswego', 'OR'): 'Portland metro',
    ('Vancouver', 'WA'): 'Portland metro',
    ('Raleigh', 'NC'): 'Research Triangle', ('Durham', 'NC'): 'Research Triangle',
    ('Cary', 'NC'): 'Research Triangle', ('Chapel Hill', 'NC'): 'Research Triangle',
    ('Apex', 'NC'): 'Research Triangle',
    ('Indianapolis', 'IN'): 'Indianapolis metro', ('Carmel', 'IN'): 'Indianapolis metro',
    ('Fishers', 'IN'): 'Indianapolis metro', ('Noblesville', 'IN'): 'Indianapolis metro',
    ('Greenwood', 'IN'): 'Indianapolis metro', ('Lawrence', 'IN'): 'Indianapolis metro',
    ('Memphis', 'TN'): 'Memphis metro', ('Bartlett', 'TN'): 'Memphis metro',
    ('Germantown', 'TN'): 'Memphis metro', ('Collierville', 'TN'): 'Memphis metro',
    ('Southaven', 'MS'): 'Memphis metro',
    ('St. Louis', 'MO'): 'St. Louis metro', ('Florissant', 'MO'): 'St. Louis metro',
    ('Chesterfield', 'MO'): 'St. Louis metro', ('St. Charles', 'MO'): 'St. Louis metro',
    ('St. Peters', 'MO'): 'St. Louis metro', ("O'Fallon", 'MO'): 'St. Louis metro',
    ('Belleville', 'IL'): 'St. Louis metro',
    ('Miami', 'FL'): 'South Florida', ('Fort Lauderdale', 'FL'): 'South Florida',
    ('Hollywood', 'FL'): 'South Florida', ('Pembroke Pines', 'FL'): 'South Florida',
    ('Hialeah', 'FL'): 'South Florida', ('Miramar', 'FL'): 'South Florida',
    ('Coral Springs', 'FL'): 'South Florida', ('Davie', 'FL'): 'South Florida',
    ('Plantation', 'FL'): 'South Florida', ('Sunrise', 'FL'): 'South Florida',
    ('Pompano Beach', 'FL'): 'South Florida', ('Deerfield Beach', 'FL'): 'South Florida',
    ('Lauderhill', 'FL'): 'South Florida', ('Tamarac', 'FL'): 'South Florida',
    ('Boca Raton', 'FL'): 'South Florida', ('Boynton Beach', 'FL'): 'South Florida',
    ('Delray Beach', 'FL'): 'South Florida', ('West Palm Beach', 'FL'): 'South Florida',
    ('Miami Beach', 'FL'): 'South Florida', ('Miami Gardens', 'FL'): 'South Florida',
    ('Homestead', 'FL'): 'South Florida', ('Weston', 'FL'): 'South Florida',
    ('Tampa', 'FL'): 'Tampa Bay', ('St. Petersburg', 'FL'): 'Tampa Bay',
    ('Clearwater', 'FL'): 'Tampa Bay', ('Largo', 'FL'): 'Tampa Bay',
    ('Detroit', 'MI'): 'metro Detroit', ('Warren', 'MI'): 'metro Detroit',
    ('Sterling Heights', 'MI'): 'metro Detroit', ('Dearborn', 'MI'): 'metro Detroit',
    ('Livonia', 'MI'): 'metro Detroit', ('Troy', 'MI'): 'metro Detroit',
    ('Westland', 'MI'): 'metro Detroit', ('Farmington Hills', 'MI'): 'metro Detroit',
    ('Southfield', 'MI'): 'metro Detroit', ('Royal Oak', 'MI'): 'metro Detroit',
    ('Novi', 'MI'): 'metro Detroit', ('Dearborn Heights', 'MI'): 'metro Detroit',
    ('Rochester Hills', 'MI'): 'metro Detroit', ('Pontiac', 'MI'): 'metro Detroit',
    ('Roseville', 'MI'): 'metro Detroit', ('St. Clair Shores', 'MI'): 'metro Detroit',
    ('Taylor', 'MI'): 'metro Detroit', ('Lincoln Park', 'MI'): 'metro Detroit',
    ('Cincinnati', 'OH'): 'Greater Cincinnati', ('Covington', 'KY'): 'Greater Cincinnati',
    ('Fairfield', 'OH'): 'Greater Cincinnati', ('Hamilton', 'OH'): 'Greater Cincinnati',
    ('Middletown', 'OH'): 'Greater Cincinnati',
    ('Des Moines', 'IA'): 'Des Moines metro', ('West Des Moines', 'IA'): 'Des Moines metro',
    ('Ankeny', 'IA'): 'Des Moines metro', ('Urbandale', 'IA'): 'Des Moines metro',
    ('Oklahoma City', 'OK'): 'Oklahoma City metro', ('Norman', 'OK'): 'Oklahoma City metro',
    ('Edmond', 'OK'): 'Oklahoma City metro', ('Moore', 'OK'): 'Oklahoma City metro',
    ('Midwest City', 'OK'): 'Oklahoma City metro',
    ('Omaha', 'NE'): 'Omaha metro', ('Bellevue', 'NE'): 'Omaha metro',
    ('Council Bluffs', 'IA'): 'Omaha metro',
    ('Boise City', 'ID'): 'Boise metro', ('Meridian', 'ID'): 'Boise metro',
    ('Nampa', 'ID'): 'Boise metro', ('Caldwell', 'ID'): 'Boise metro',
    ('Charlotte', 'NC'): 'Charlotte metro', ('Concord', 'NC'): 'Charlotte metro',
    ('Gastonia', 'NC'): 'Charlotte metro', ('Huntersville', 'NC'): 'Charlotte metro',
    ('Kannapolis', 'NC'): 'Charlotte metro', ('Rock Hill', 'SC'): 'Charlotte metro',
    ('Spokane', 'WA'): 'Spokane area', ('Spokane Valley', 'WA'): 'Spokane area',
    ('Kennewick', 'WA'): 'Tri-Cities', ('Pasco', 'WA'): 'Tri-Cities', ('Richland', 'WA'): 'Tri-Cities',
    ('Reno', 'NV'): 'Reno-Sparks', ('Sparks', 'NV'): 'Reno-Sparks',
}

def get_avg_home_age(city, state_code, pop):
    northeast = {'CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'}
    key = (city, state_code)
    old_cities = {
        ('Boston', 'MA'): 55, ('New York', 'NY'): 60, ('Philadelphia', 'PA'): 58,
        ('Baltimore', 'MD'): 55, ('Detroit', 'MI'): 52, ('Cleveland', 'OH'): 55,
        ('Buffalo', 'NY'): 58, ('Pittsburgh', 'PA'): 55, ('St. Louis', 'MO'): 52,
        ('Chicago', 'IL'): 50, ('Milwaukee', 'WI'): 50, ('Minneapolis', 'MN'): 45,
        ('San Francisco', 'CA'): 52, ('Providence', 'RI'): 55, ('Hartford', 'CT'): 52,
        ('Newark', 'NJ'): 55, ('Camden', 'NJ'): 55, ('Paterson', 'NJ'): 52,
        ('Syracuse', 'NY'): 55, ('Rochester', 'NY'): 52, ('Albany', 'NY'): 55,
        ('Worcester', 'MA'): 52, ('Springfield', 'MA'): 50, ('Lowell', 'MA'): 55,
        ('New Haven', 'CT'): 55, ('Bridgeport', 'CT'): 52, ('Waterbury', 'CT'): 55,
        ('Gary', 'IN'): 55, ('Flint', 'MI'): 52, ('Saginaw', 'MI'): 50,
        ('Youngstown', 'OH'): 55, ('Dayton', 'OH'): 50, ('Akron', 'OH'): 52,
        ('Toledo', 'OH'): 50, ('Cincinnati', 'OH'): 48, ('Columbus', 'OH'): 40,
        ('Oakland', 'CA'): 50, ('Sacramento', 'CA'): 38,
        ('New Orleans', 'LA'): 50, ('Savannah', 'GA'): 45,
        ('Charleston', 'SC'): 35, ('Richmond', 'VA'): 45,
    }
    if key in old_cities:
        return old_cities[key]
    new_cities = {
        ('Frisco', 'TX'): 12, ('McKinney', 'TX'): 15, ('Allen', 'TX'): 18,
        ('Gilbert', 'AZ'): 15, ('Surprise', 'AZ'): 14, ('Goodyear', 'AZ'): 12,
        ('Buckeye', 'AZ'): 10, ('Maricopa', 'AZ'): 10,
        ('Castle Rock', 'CO'): 15, ('Parker', 'CO'): 18,
        ('Lehi', 'UT'): 12, ('South Jordan', 'UT'): 15, ('Riverton', 'UT'): 16,
        ('Draper', 'UT'): 15, ('Spanish Fork', 'UT'): 18,
        ('Meridian', 'ID'): 14, ('Nampa', 'ID'): 20,
        ('Fishers', 'IN'): 18, ('Carmel', 'IN'): 20, ('Noblesville', 'IN'): 18,
        ('Sammamish', 'WA'): 16,
        ('Ankeny', 'IA'): 16, ('West Des Moines', 'IA'): 20,
        ('Lakeville', 'MN'): 18, ('Woodbury', 'MN'): 16, ('Shakopee', 'MN'): 18,
        ('Maple Grove', 'MN'): 20,
        ('Round Rock', 'TX'): 18, ('League City', 'TX'): 16, ('Pearland', 'TX'): 16,
        ('Sugar Land', 'TX'): 20, ('College Station', 'TX'): 22,
        ('Apex', 'NC'): 15, ('Huntersville', 'NC'): 18, ('Cary', 'NC'): 20,
        ('Brentwood', 'TN'): 18, ('Franklin', 'TN'): 18, ('Smyrna', 'TN'): 20,
        ('Murfreesboro', 'TN'): 20,
        ('Olathe', 'KS'): 22, ('Overland Park', 'KS'): 25, ('Lenexa', 'KS'): 22,
        ("Lee's Summit", 'MO'): 22, ("O'Fallon", 'MO'): 18,
        ('Alpharetta', 'GA'): 20, ('Johns Creek', 'GA'): 18, ('Brookhaven', 'GA'): 22,
        ('Peachtree Corners', 'GA'): 22, ('Roswell', 'GA'): 25,
        ('Edmond', 'OK'): 22, ('Broken Arrow', 'OK'): 25,
        ('Port St. Lucie', 'FL'): 18, ('Cape Coral', 'FL'): 20,
        ('Palm Coast', 'FL'): 16, ('Deltona', 'FL'): 22,
        ('Henderson', 'NV'): 18, ('North Las Vegas', 'NV'): 16,
        ('Bentonville', 'AR'): 16, ('Rogers', 'AR'): 18,
        ('Broomfield', 'CO'): 18, ('Thornton', 'CO'): 22,
        ('Bend', 'OR'): 18,
        ('Bozeman', 'MT'): 20,
        ('Summerville', 'SC'): 16, ('Mount Pleasant', 'SC'): 18, ('Goose Creek', 'SC'): 20,
        ('Rock Hill', 'SC'): 22, ('Hilton Head Island', 'SC'): 25,
        ('St. George', 'UT'): 15,
        ('Miramar', 'FL'): 22, ('Homestead', 'FL'): 20,
        ('Pembroke Pines', 'FL'): 25, ('Weston', 'FL'): 20,
        ('Concord', 'NC'): 22, ('Gastonia', 'NC'): 30,
    }
    if key in new_cities:
        return new_cities[key]
    if state_code in northeast:
        return 48 + (hash(city) % 10)
    elif state_code in {'OH', 'MI', 'IN'}:
        return 42 + (hash(city) % 10)
    elif state_code in {'IL', 'WI', 'MN'}:
        return 40 + (hash(city) % 10)
    elif state_code in {'IA', 'MO', 'ND', 'SD', 'NE', 'KS'}:
        return 38 + (hash(city) % 10)
    elif state_code == 'FL':
        return 25 + (hash(city) % 12)
    elif state_code == 'AZ':
        return 18 + (hash(city) % 12)
    elif state_code in {'TX', 'NV'}:
        return 25 + (hash(city) % 12)
    elif state_code in {'AL', 'AR', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'}:
        return 30 + (hash(city) % 12)
    elif state_code in {'CO', 'ID', 'MT', 'NM', 'OR', 'UT', 'WA', 'WY'}:
        return 28 + (hash(city) % 12)
    elif state_code == 'CA':
        return 35 + (hash(city) % 12)
    elif state_code == 'HI':
        return 35
    elif state_code == 'AK':
        return 32
    elif state_code == 'DE':
        return 38
    elif state_code == 'MD':
        return 40 + (hash(city) % 8)
    else:
        return 35 + (hash(city) % 10)

def get_hoa(city, state_code, pop):
    key = (city, state_code)
    high_hoa_states = {'AZ', 'FL', 'NV', 'CA', 'TX', 'CO', 'UT'}
    low_hoa_states = {'WV', 'AK', 'VT', 'ME', 'ND', 'SD', 'MT', 'WY', 'MS', 'AL', 'AR', 'KY', 'LA'}
    high_hoa_cities = {
        ('Frisco', 'TX'), ('McKinney', 'TX'), ('Allen', 'TX'), ('Plano', 'TX'),
        ('Gilbert', 'AZ'), ('Chandler', 'AZ'), ('Scottsdale', 'AZ'), ('Surprise', 'AZ'),
        ('Goodyear', 'AZ'), ('Peoria', 'AZ'), ('Maricopa', 'AZ'), ('Buckeye', 'AZ'),
        ('Henderson', 'NV'), ('Irvine', 'CA'), ('Sammamish', 'WA'),
        ('Fishers', 'IN'), ('Carmel', 'IN'), ('Noblesville', 'IN'),
        ('Cary', 'NC'), ('Apex', 'NC'), ('Huntersville', 'NC'),
        ('Olathe', 'KS'), ('Overland Park', 'KS'), ('Lenexa', 'KS'),
        ("Lee's Summit", 'MO'), ("O'Fallon", 'MO'),
        ('Alpharetta', 'GA'), ('Johns Creek', 'GA'), ('Roswell', 'GA'),
        ('Lehi', 'UT'), ('South Jordan', 'UT'), ('Draper', 'UT'), ('Riverton', 'UT'),
        ('Castle Rock', 'CO'), ('Parker', 'CO'), ('Broomfield', 'CO'),
        ('Lakeville', 'MN'), ('Woodbury', 'MN'), ('Eden Prairie', 'MN'), ('Maple Grove', 'MN'),
        ('Edmond', 'OK'), ('Broken Arrow', 'OK'),
        ('Brentwood', 'TN'), ('Franklin', 'TN'),
        ('Sugar Land', 'TX'), ('Pearland', 'TX'), ('League City', 'TX'),
        ('Round Rock', 'TX'), ('Lewisville', 'TX'), ('Carrollton', 'TX'),
        ('Weston', 'FL'), ('Pembroke Pines', 'FL'), ('Miramar', 'FL'),
        ('Coral Springs', 'FL'), ('Plantation', 'FL'),
        ('Boca Raton', 'FL'), ('Palm Coast', 'FL'),
        ('Mount Pleasant', 'SC'), ('Hilton Head Island', 'SC'), ('Summerville', 'SC'),
        ('Port St. Lucie', 'FL'), ('Cape Coral', 'FL'),
        ('West Des Moines', 'IA'), ('Ankeny', 'IA'),
        ('Centennial', 'CO'), ('Littleton', 'CO'),
        ('Sandy Springs', 'GA'), ('Dunwoody', 'GA'), ('Peachtree Corners', 'GA'),
        ('Shakopee', 'MN'), ('Plymouth', 'MN'),
        ('Spanish Fork', 'UT'), ('St. George', 'UT'),
        ('Meridian', 'ID'), ('Nampa', 'ID'),
        ('Santa Clarita', 'CA'), ('Rancho Cucamonga', 'CA'),
        ('Bentonville', 'AR'), ('Rogers', 'AR'),
        ('Smyrna', 'TN'), ('Murfreesboro', 'TN'), ('Hendersonville', 'TN'),
        ('Collierville', 'TN'), ('Germantown', 'TN'), ('Bartlett', 'TN'),
        ('North Las Vegas', 'NV'),
    }
    if key in high_hoa_cities:
        return 'high'
    elif state_code in high_hoa_states:
        return 'high' if pop > 100000 else 'moderate'
    elif state_code in low_hoa_states:
        return 'low'
    else:
        urban_low = {
            ('Detroit', 'MI'), ('Cleveland', 'OH'), ('Buffalo', 'NY'), ('Baltimore', 'MD'),
            ('St. Louis', 'MO'), ('Gary', 'IN'), ('Camden', 'NJ'), ('Newark', 'NJ'),
            ('Flint', 'MI'), ('Youngstown', 'OH'), ('Dayton', 'OH'),
            ('Memphis', 'TN'), ('New Orleans', 'LA'), ('Hartford', 'CT'),
        }
        if key in urban_low:
            return 'low'
        return 'moderate'

def generate_weather_note(city, state_code, climate, hail_risk, is_hurricane, snow):
    c = city
    st = state_names[state_code]

    if is_hurricane and hail_risk == 'high':
        return f"{c} faces a dual threat of hurricane-force winds from the Gulf and severe hail from spring supercells, making roof durability a top priority for homeowners"
    elif is_hurricane and climate == 'hot_humid' and state_code == 'FL':
        south_fl = ('Miami', 'Hialeah', 'Homestead', 'Hollywood', 'Fort Lauderdale', 'Pembroke Pines', 'Miramar', 'Coral Springs', 'Davie', 'Plantation', 'Sunrise', 'Pompano Beach', 'Deerfield Beach', 'Lauderhill', 'Tamarac', 'Boca Raton', 'Boynton Beach', 'Delray Beach', 'West Palm Beach', 'Weston', 'Miami Beach', 'Miami Gardens')
        if c in south_fl:
            return f"{c} sits in one of the nation's highest hurricane risk zones, with the Atlantic hurricane season from June through November driving strict roofing code requirements"
        elif c in ('Tampa', 'St. Petersburg', 'Clearwater', 'Largo'):
            return f"{c}'s position on Tampa Bay creates significant hurricane and tropical storm exposure, with warm Gulf waters intensifying storms that approach from the west"
        elif c == 'Jacksonville':
            return f"Jacksonville's northeast Florida location exposes it to both Atlantic hurricanes and nor'easters, while summer thunderstorms bring frequent heavy downpours"
        elif c in ('Orlando', 'Kissimmee'):
            return f"Central Florida's {c} experiences frequent summer thunderstorms with heavy rain and lightning, plus tropical storm winds that can reach well inland"
        elif c in ('Cape Coral', 'Fort Myers'):
            return f"{c}'s Southwest Florida location makes it highly vulnerable to Gulf hurricanes, as demonstrated by recent major storms that devastated the region"
        elif c in ('Port St. Lucie', 'Palm Bay', 'Melbourne'):
            return f"{c}'s Treasure Coast location puts it in the path of Atlantic hurricanes and tropical storms, with the peak threat running August through October"
        elif c == 'Tallahassee':
            return f"Tallahassee in the Florida Panhandle is exposed to Gulf hurricanes and experiences more temperature variation than South Florida, with occasional winter freezes"
        elif c == 'Gainesville':
            return f"North-central Florida's Gainesville gets significant rainfall averaging over 50 inches annually, with tropical storms and severe thunderstorms posing the main roof threats"
        elif c in ('Lakeland', 'Deltona'):
            return f"{c}'s inland Central Florida position doesn't eliminate hurricane risk, as tropical storms regularly bring damaging winds and heavy rain well inland from the coast"
        elif c == 'Daytona Beach':
            return f"Daytona Beach's direct Atlantic coast exposure creates significant hurricane risk, with coastal winds and salt air accelerating roof material degradation"
        elif c == 'Palm Coast':
            return f"Palm Coast's coastal Flagler County location faces direct Atlantic hurricane exposure, with sea breezes and salt air affecting roofing material longevity year-round"
        else:
            return f"{c}'s Florida location means hurricane preparedness is essential for roofing, with high winds and driving rain testing roof integrity during the June-November storm season"
    elif is_hurricane and state_code == 'LA':
        if c == 'New Orleans':
            return f"New Orleans faces extreme hurricane risk from Gulf storms, with heavy annual rainfall exceeding 60 inches and high humidity that accelerate roof wear"
        elif c == 'Lake Charles':
            return f"Lake Charles has been hit by multiple major hurricanes in recent years, making wind-rated roofing systems and proper tie-downs absolutely essential"
        elif c == 'Baton Rouge':
            return f"Baton Rouge's proximity to the Gulf coast exposes it to full-force hurricanes, while year-round humidity and heavy rainfall test roof waterproofing systems"
        else:
            return f"{c}'s Louisiana location puts it in a major hurricane corridor, with Gulf storms bringing destructive winds and torrential rain that demand robust roofing systems"
    elif is_hurricane and state_code == 'TX':
        if c in ('Houston', 'Pasadena', 'Pearland', 'Sugar Land', 'League City'):
            return f"{c} in the Houston metro faces both Gulf hurricanes and extreme rainfall events, with some storms dumping over 20 inches of rain in a single event"
        elif c == 'Corpus Christi':
            return f"Corpus Christi's direct Gulf of Mexico exposure makes it one of Texas's most hurricane-vulnerable cities, with coastal winds and salt spray degrading roofs faster"
        elif c == 'Beaumont':
            return f"Beaumont's location in the Golden Triangle near the Gulf coast makes it highly susceptible to hurricane damage, with heavy rainfall compounding wind damage risks"
        elif c in ('Brownsville', 'McAllen'):
            return f"{c}'s Rio Grande Valley location occasionally faces hurricane threats from the Gulf, while extreme heat and UV exposure are year-round concerns for roofing materials"
        else:
            return f"{c}'s Gulf-adjacent Texas location creates hurricane and tropical storm risk, with storm season running June through November"
    elif is_hurricane and state_code in ('SC', 'NC', 'VA'):
        if c in ('Charleston', 'North Charleston', 'Mount Pleasant', 'Goose Creek', 'Summerville'):
            return f"{c}'s South Carolina Lowcountry location is highly vulnerable to Atlantic hurricanes and tropical storms, with coastal flooding adding to roof stress during major events"
        elif c == 'Wilmington' and state_code == 'NC':
            return f"Wilmington's Cape Fear coast position makes it one of North Carolina's most hurricane-prone cities, with direct Atlantic exposure and heavy seasonal rainfall"
        elif c in ('Norfolk', 'Virginia Beach', 'Newport News', 'Hampton', 'Chesapeake', 'Portsmouth', 'Suffolk'):
            return f"{c}'s Hampton Roads location exposes it to Atlantic hurricanes and nor'easters, with coastal winds and moisture creating ongoing roof maintenance challenges"
        elif c == 'Columbia' and state_code == 'SC':
            return f"Columbia's inland South Carolina location still faces tropical storm remnants bringing heavy rain and wind, while high humidity promotes algae growth on roofing"
        elif c == 'Florence' and state_code == 'SC':
            return f"Florence in the Pee Dee region of South Carolina is vulnerable to hurricane remnants moving inland, with heavy rainfall and wind causing significant roof damage"
        else:
            return f"{c} can experience damaging winds and heavy rain from hurricanes and tropical storms tracking up the Atlantic seaboard, typically between August and October"
    elif is_hurricane and state_code == 'MS':
        if c in ('Biloxi', 'Gulfport'):
            return f"{c}'s Mississippi Gulf Coast location puts it directly in the path of Gulf hurricanes, with storm surge and high winds posing severe threats to roofing structures"
        elif c == 'Hattiesburg':
            return f"Hattiesburg's southern Mississippi location means hurricane-force winds can reach the city from Gulf storms, while heavy annual rainfall tests roof waterproofing year-round"
        else:
            return f"{c} in Mississippi faces tropical storm and hurricane threats from the Gulf, with heavy rainfall and high humidity creating persistent challenges for roofing systems"
    elif is_hurricane and state_code == 'AL':
        return f"Mobile's Gulf Coast position makes it one of Alabama's most hurricane-exposed cities, with tropical moisture producing some of the highest annual rainfall totals in the state"
    elif is_hurricane and state_code == 'GA':
        return f"Savannah's Georgia coast location brings hurricane and tropical storm risk, with warm Atlantic moisture also driving frequent summer thunderstorms"
    elif is_hurricane and state_code == 'HI':
        return f"Honolulu faces tropical storm and hurricane threats in the Central Pacific, while year-round trade winds and intense UV radiation stress roofing materials continuously"

    # Non-hurricane cities
    if hail_risk == 'high':
        if state_code == 'TX':
            dfw = ('Dallas', 'Fort Worth', 'Arlington', 'Plano', 'Irving', 'Garland', 'Grand Prairie', 'Mesquite', 'Carrollton', 'Lewisville', 'Richardson', 'Frisco', 'McKinney', 'Allen', 'Denton')
            if c in dfw:
                return f"{c} averages 3-5 significant hail events per year, making impact-resistant shingles a smart investment for homeowners in the Dallas-Fort Worth area"
            elif c == 'San Antonio':
                return f"San Antonio experiences moderate hail risk with occasional severe storms, while extreme summer heat reaching 100\u00b0F+ accelerates shingle aging and thermal cycling"
            elif c == 'Amarillo':
                return f"Amarillo sits in the heart of hail alley with frequent severe hailstorms from March through June, and sustained high winds year-round that test roof fastening systems"
            elif c == 'Lubbock':
                return f"Lubbock's West Texas location brings severe hailstorms and persistent high winds, with spring supercells capable of producing baseball-sized hail"
            elif c == 'Wichita Falls':
                return f"Wichita Falls experiences frequent severe hail from spring supercells moving through North Texas, combined with extreme summer heat that stresses roofing materials"
            elif c == 'Abilene':
                return f"Abilene's position in West-Central Texas puts it in a high-hail corridor, with severe thunderstorms common from April through June"
            elif c == 'Midland':
                return f"Midland's Permian Basin location sees severe hailstorms from spring supercells, while intense heat and UV exposure accelerate roofing material breakdown"
            elif c == 'Odessa':
                return f"Odessa's West Texas position brings occasional severe hail events, with persistent high winds and extreme heat creating additional challenges for roof longevity"
            elif c == 'San Angelo':
                return f"San Angelo in the Concho Valley experiences periodic severe hailstorms, with hot dry conditions and UV exposure adding to the wear on roofing materials"
            elif c == 'Killeen':
                return f"Killeen in Central Texas sits in an active hail corridor, with spring supercells frequently producing damaging hail across the Fort Hood region"
            elif c == 'Waco':
                return f"Waco's Central Texas location makes it vulnerable to severe hailstorms from spring supercells, while summer temperatures regularly exceeding 100\u00b0F stress roof materials"
            elif c == 'Tyler':
                return f"Tyler in East Texas sees severe spring thunderstorms with damaging hail, combined with high humidity that promotes algae growth on roofing surfaces"
            elif c == 'College Station':
                return f"College Station's Central Texas location brings hail risk from spring supercells, while the humid subtropical climate promotes moisture-related roof issues"
            else:
                return f"{c}'s Texas location brings significant hail risk during spring storm season, with large hail events capable of requiring full roof replacements"
        elif state_code == 'OK':
            if c in ('Oklahoma City', 'Norman', 'Moore', 'Midwest City', 'Edmond'):
                return f"{c} is in one of the nation's most active severe weather corridors, with large hail and tornadoes from March through June posing major threats to roofing"
            elif c == 'Tulsa':
                return f"Tulsa's Green Country location sees frequent severe hailstorms and occasional tornadoes, with the spring storm season from March through June being particularly active"
            elif c == 'Broken Arrow':
                return f"Broken Arrow frequently experiences damaging hail from Tulsa-area supercell thunderstorms, with spring storm season regularly producing golf-ball-sized or larger hail"
            elif c == 'Stillwater':
                return f"Stillwater's north-central Oklahoma location puts it in the path of severe supercell thunderstorms that produce large hail and damaging winds from spring through early summer"
            elif c == 'Lawton':
                return f"Lawton in southwest Oklahoma sees severe thunderstorms with large hail, while proximity to Fort Sill's open terrain means high wind exposure year-round"
            elif c == 'Muskogee':
                return f"Muskogee's eastern Oklahoma location experiences severe spring thunderstorms with hail and wind, plus humid conditions that promote roof moisture issues"
            elif c == 'Enid':
                return f"Enid's northwest Oklahoma location sits in prime hail alley territory, with supercell thunderstorms regularly tracking across the region from March through June"
            else:
                return f"{c}'s Oklahoma location puts it squarely in tornado and hail alley, with severe weather from spring supercells a primary concern for roof longevity"
        elif state_code == 'KS':
            if c == 'Wichita':
                return f"Wichita sits at the heart of hail alley, averaging significant hail events multiple times per year, with supercell thunderstorms capable of producing softball-sized hail"
            elif c == 'Topeka':
                return f"Topeka's northeast Kansas location brings frequent severe thunderstorms with large hail, while freeze-thaw cycling in winter adds to roofing wear"
            elif c in ('Kansas City', 'Overland Park', 'Olathe', 'Lenexa', 'Shawnee'):
                return f"{c} in the Kansas City metro area experiences frequent severe hail from spring supercells, with some of the highest hail damage insurance claims in the nation"
            elif c == 'Manhattan':
                return f"Manhattan's Flint Hills location sees severe thunderstorms with large hail from April through July, combined with persistent Kansas winds that test roof integrity"
            elif c == 'Lawrence':
                return f"Lawrence's eastern Kansas location brings severe spring hailstorms and occasional tornadoes, with hail-related roof damage claims among the highest in the state"
            elif c == 'Hutchinson':
                return f"Hutchinson in south-central Kansas sits in prime hail alley, with supercell thunderstorms producing large hail from March through July"
            elif c == 'Salina':
                return f"Salina's central Kansas location is frequently targeted by supercell thunderstorms producing large hail, especially during the peak spring storm season"
            else:
                return f"{c}'s Kansas location is prime hail alley territory, with severe thunderstorms producing large hail from March through July"
        elif state_code == 'CO':
            if c in ('Denver', 'Aurora', 'Lakewood', 'Arvada', 'Westminster', 'Thornton', 'Centennial', 'Littleton', 'Broomfield', 'Northglenn', 'Commerce City', 'Parker', 'Castle Rock'):
                return f"{c} in the Denver metro experiences severe hailstorms along the Front Range, particularly from May through July when afternoon thunderstorms develop rapidly"
            elif c == 'Colorado Springs':
                return f"Colorado Springs is one of Colorado's most hail-prone cities, with the Palmer Divide creating atmospheric conditions that spawn intense hailstorms from May through August"
            elif c == 'Fort Collins':
                return f"Fort Collins in northern Colorado's Front Range corridor is highly susceptible to severe hail, with CSU research documenting increasing hail frequency in the region"
            elif c == 'Greeley':
                return f"Greeley's position on the northern Colorado plains makes it a frequent target for severe hail from Front Range storms, with summer storms developing quickly in the afternoon"
            elif c == 'Longmont':
                return f"Longmont along the northern Front Range experiences frequent severe hailstorms from May through August, with storms developing rapidly over the foothills"
            elif c == 'Loveland':
                return f"Loveland's position along the Front Range between Fort Collins and Denver makes it a common target for severe hail from afternoon thunderstorms in summer"
            elif c == 'Boulder':
                return f"Boulder's foothills location creates unique weather patterns where upslope storms produce severe hail, with afternoon thunderstorms from May through August being particularly intense"
            elif c == 'Pueblo':
                return f"Pueblo's southern Colorado location brings less frequent but still significant hail from summer thunderstorms, with intense UV and dry conditions stressing roof materials"
            elif c == 'Grand Junction':
                return f"Grand Junction's western slope location sees less hail than the Front Range but faces intense UV exposure, extreme heat, and wide daily temperature swings"
            else:
                return f"{c}'s Colorado Front Range location puts it in a high-hail zone, with afternoon thunderstorms from May through August producing damaging hail"
        elif state_code in ('NE',):
            if c == 'Omaha':
                return f"Omaha is in Nebraska's high-hail corridor, with supercell thunderstorms from May through August producing some of the nation's largest and most damaging hailstones"
            elif c == 'Lincoln':
                return f"Lincoln sits in Nebraska's severe weather corridor with frequent spring and summer hailstorms, plus harsh winters with snow and ice challenging roofing systems"
            elif c == 'Grand Island':
                return f"Grand Island's central Nebraska location is in prime hail alley territory, with severe thunderstorms producing large hail from late spring through midsummer"
            elif c == 'Bellevue':
                return f"Bellevue in the Omaha metro area sees frequent severe hailstorms from spring supercells, making impact-resistant roofing a wise investment for homeowners"
            else:
                return f"{c}'s Nebraska location puts it in prime severe weather territory, with large hail and high winds from Great Plains thunderstorms a persistent roofing concern"
        elif state_code == 'SD':
            if c == 'Sioux Falls':
                return f"Sioux Falls experiences intense hailstorms from Plains supercells, with some of the highest per-capita hail damage rates in the nation"
            else:
                return f"{c}'s South Dakota location sees intense hailstorms from Plains supercells, with the brief but severe storm season running from May through August"
        elif state_code == 'ND':
            if c == 'Fargo':
                return f"Fargo experiences severe hail during summer storms followed by extreme winter cold with heavy snow, creating year-round challenges for roofing durability"
            elif c == 'Bismarck':
                return f"Bismarck's central North Dakota location sees intense summer hailstorms and extreme winter conditions with heavy snow and temperatures dropping well below zero"
            elif c == 'Grand Forks':
                return f"Grand Forks faces severe summer hailstorms and some of the harshest winter conditions in the nation, with extreme cold and heavy snow loads testing roofs"
            else:
                return f"{c} experiences severe hail during the short but intense North Dakota storm season, followed by harsh winters with heavy snow loads and ice dam formation"
        elif state_code == 'MN':
            return f"{c} faces a challenging combination of severe summer hailstorms and harsh winters with heavy snowfall, creating year-round stress on roofing systems"
        elif state_code == 'IA':
            return f"{c}'s Iowa location brings significant hail risk from spring and summer thunderstorms, with the added challenge of harsh winters and freeze-thaw cycling"
        else:
            return f"{c} is in a high-hail risk area with severe thunderstorms regularly producing damaging hail during storm season"

    elif hail_risk == 'moderate':
        if state_code == 'MO':
            if c in ('Kansas City', 'Independence', "Lee's Summit", 'Blue Springs'):
                return f"{c} in the Kansas City metro sees moderate-to-high hail risk from spring supercells, plus ice storms and freeze-thaw damage in winter months"
            elif c in ('St. Louis', 'Florissant', 'Chesterfield', 'St. Charles', 'St. Peters', "O'Fallon"):
                return f"{c} in the St. Louis metro experiences moderate hail from spring storms, with Missouri's variable climate also producing damaging ice storms"
            elif c == 'Springfield':
                return f"Springfield's southwest Missouri location brings moderate hail risk from spring storms, with occasional tornadoes and severe thunderstorms in the Ozarks region"
            elif c == 'Columbia':
                return f"Columbia's central Missouri location sees moderate hail risk from spring thunderstorms, with significant temperature swings from hot summers to cold winters"
            elif c == 'Joplin':
                return f"Joplin in southwest Missouri is in an active severe weather zone with moderate-to-high hail risk and tornado exposure from spring supercells"
            else:
                return f"{c} experiences moderate hail risk from spring and early summer thunderstorms, with Missouri's variable climate also producing ice storms and freeze-thaw damage"
        elif state_code == 'TN':
            if c == 'Nashville':
                return f"Nashville experiences moderate hail from spring severe weather outbreaks, with Middle Tennessee's climate bringing hot humid summers and occasional winter ice events"
            elif c == 'Memphis':
                return f"Memphis faces moderate hail risk from spring supercells, extreme summer heat and humidity, and occasional ice storms that can damage older roofing systems"
            elif c == 'Knoxville':
                return f"Knoxville's East Tennessee location brings moderate hail risk from spring storms, with the Great Smoky Mountains influencing local weather patterns"
            elif c == 'Chattanooga':
                return f"Chattanooga's Tennessee Valley location channels severe weather bringing moderate hail risk, with the valley also producing heavy rainfall events"
            elif c == 'Clarksville':
                return f"Clarksville's northern Tennessee location near the Kentucky border sees moderate hail from spring storms, with Military families at Fort Campbell often needing roof assessments"
            elif c in ('Murfreesboro', 'Franklin', 'Brentwood', 'Smyrna', 'Hendersonville'):
                return f"{c} in the Nashville metro sees moderate hail from spring severe weather, with rapid growth meaning many newer roofs still under manufacturer warranty"
            elif c in ('Johnson City', 'Kingsport'):
                return f"{c}'s Appalachian Highlands location brings moderate spring storms with occasional hail, while mountain weather patterns create unique moisture and wind challenges"
            elif c in ('Bartlett', 'Germantown', 'Collierville'):
                return f"{c} in the Memphis suburbs sees moderate hail from spring and early summer storms, while West Tennessee's humidity promotes algae growth on shingles"
            elif c == 'Jackson':
                return f"Jackson's West Tennessee location brings moderate hail risk from spring storms, with hot humid summers promoting rapid algae growth on roofing surfaces"
            elif c == 'Cleveland':
                return f"Cleveland, Tennessee near the Ocoee region sees moderate spring storms with occasional hail, combined with the area's significant rainfall totals"
            else:
                return f"{c}'s Tennessee location brings moderate hail risk from spring severe weather outbreaks, along with heavy rainfall that tests waterproofing and drainage"
        elif state_code == 'AL':
            if c == 'Birmingham':
                return f"Birmingham sits in Alabama's severe weather corridor with moderate hail risk from spring supercells, while high heat and humidity year-round promote algae on shingles"
            elif c == 'Huntsville':
                return f"Huntsville's Tennessee Valley location sees moderate hail from spring severe weather, with the valley channeling storms and producing heavy rainfall events"
            elif c == 'Montgomery':
                return f"Montgomery's central Alabama location brings moderate spring storm risk, while extreme summer heat and humidity accelerate shingle aging and promote biological growth"
            elif c == 'Mobile':
                return f"Mobile's Gulf Coast position makes it one of Alabama's most hurricane-exposed cities, with tropical moisture producing some of the highest annual rainfall totals in the state"
            elif c == 'Tuscaloosa':
                return f"Tuscaloosa's west-central Alabama location puts it in an active severe weather corridor, with spring supercells bringing moderate hail and tornado risk"
            elif c == 'Hoover':
                return f"Hoover in the Birmingham metro sees moderate hail from spring severe weather, while Alabama's humid subtropical climate promotes algae and moss on roofing"
            else:
                return f"{c}'s Alabama location sees moderate hail from spring severe weather, while high heat and humidity year-round promote algae growth on shingles"
        elif state_code == 'KY':
            if c == 'Louisville':
                return f"Louisville's Ohio River Valley location creates moderate hail risk from spring storms, with significant humidity and freeze-thaw cycling affecting roof longevity"
            elif c == 'Lexington-Fayette':
                return f"Lexington-Fayette's Bluegrass Region sees moderate spring storms with occasional hail, while variable winters with ice events stress roofing materials"
            elif c == 'Bowling Green':
                return f"Bowling Green in south-central Kentucky experiences moderate hail risk from spring severe weather, with Tornado Alley-like conditions extending into the region"
            elif c == 'Owensboro':
                return f"Owensboro's western Kentucky location along the Ohio River sees moderate spring storm activity with occasional hail and ice events in winter"
            else:
                return f"{c}'s Kentucky climate produces moderate hail risk from spring storms, with freeze-thaw cycles in winter and humidity in summer both affecting roof materials"
        elif state_code == 'GA':
            if c == 'Atlanta':
                return f"Atlanta experiences moderate hail from spring thunderstorms, while Georgia's intense summer heat and humidity accelerate shingle aging and promote algae growth"
            elif c == 'Savannah':
                return f"Savannah's Georgia coast location brings hurricane and tropical storm risk, with warm Atlantic moisture also driving frequent summer thunderstorms"
            elif c in ('Alpharetta', 'Johns Creek', 'Roswell', 'Marietta', 'Sandy Springs', 'Brookhaven', 'Dunwoody', 'Smyrna', 'Peachtree Corners'):
                return f"{c} in metro Atlanta sees moderate hail from spring thunderstorms, with the area's tree canopy also creating debris and moisture challenges for roofs"
            elif c in ('Athens-Clarke County',):
                return f"Athens-Clarke County sees moderate hail from spring storms, with the university town's mix of older and newer housing requiring varied roofing approaches"
            elif c in ('Augusta-Richmond County',):
                return f"Augusta-Richmond County's Savannah River location brings moderate spring storms, with summer heat and humidity promoting biological growth on roofing"
            elif c == 'Columbus':
                return f"Columbus on the Chattahoochee River sees moderate spring storm activity, with west Georgia's heat and humidity presenting ongoing challenges for roof maintenance"
            elif c in ('Macon',):
                return f"Macon's central Georgia location brings moderate hail from spring supercells, while extreme summer heat and humidity promote rapid algae growth on roofs"
            elif c in ('Albany',):
                return f"Albany in southwest Georgia sees moderate storm activity with occasional hail, while the hot humid climate promotes rapid biological growth on roofing surfaces"
            elif c in ('Valdosta',):
                return f"Valdosta near the Florida border sees moderate storm activity, with south Georgia's extreme humidity and heat being the primary challenges for roof longevity"
            else:
                return f"{c} experiences moderate hail risk from spring thunderstorms, while Georgia's intense summer heat and humidity accelerate shingle aging and promote algae growth"
        elif state_code in ('IN',):
            if c in ('Indianapolis', 'Carmel', 'Fishers', 'Noblesville', 'Greenwood', 'Lawrence'):
                return f"{c} in the Indianapolis metro sees moderate hail during spring and summer storms, with the additional challenges of cold winters and freeze-thaw cycles"
            elif c in ('Fort Wayne',):
                return f"Fort Wayne's northeast Indiana location brings moderate hail risk from summer storms plus significant winter snow, with lake-effect moisture adding to precipitation"
            elif c in ('South Bend', 'Mishawaka', 'Elkhart'):
                return f"{c}'s northern Indiana location near Lake Michigan brings lake-effect snow and moderate summer hail, creating year-round stress on roofing systems"
            elif c in ('Evansville',):
                return f"Evansville's Ohio River Valley location brings moderate hail from spring storms, with the valley's weather patterns also producing ice events in winter"
            elif c in ('Gary', 'Hammond'):
                return f"{c}'s Lake Michigan proximity adds lake-effect snow to the moderate hail risk from summer storms, with industrial air quality also affecting roof materials"
            else:
                return f"{c} sees moderate hail during spring and summer storms, with the additional challenges of cold winters, ice formation, and freeze-thaw cycles stressing roof materials"
        elif state_code == 'OH':
            if c == 'Columbus':
                return f"Columbus sees moderate hail from spring and summer thunderstorms, with Ohio's variable climate producing everything from ice storms to intense summer heat"
            elif c in ('Cleveland', 'Cleveland Heights', 'Lakewood', 'Euclid', 'Parma'):
                return f"{c}'s Lake Erie proximity brings heavy lake-effect snow and moderate hail risk, with ice dams and freeze-thaw cycling being primary winter roofing concerns"
            elif c in ('Cincinnati', 'Fairfield', 'Hamilton', 'Middletown'):
                return f"{c} in the Cincinnati metro sees moderate hail from Ohio Valley storms, with humidity and temperature variations stressing roofing materials year-round"
            elif c in ('Dayton', 'Kettering', 'Beavercreek', 'Huber Heights'):
                return f"{c} in the Dayton metro experiences moderate hail from spring storms, with the Miami Valley's variable climate creating diverse roofing challenges"
            elif c in ('Toledo',):
                return f"Toledo's northwest Ohio location brings moderate hail plus heavy lake-effect snow from Lake Erie, with ice dams being a persistent winter roofing problem"
            elif c in ('Akron', 'Cuyahoga Falls', 'Strongsville'):
                return f"{c}'s northeast Ohio location brings moderate hail from summer storms and significant winter snowfall, with freeze-thaw cycling deteriorating roofing over time"
            else:
                return f"{c} sees moderate hail during spring and summer storms, with the additional challenges of cold winters, ice formation, and freeze-thaw cycles stressing roof materials"
        elif state_code == 'MI':
            if c in ('Detroit', 'Warren', 'Sterling Heights', 'Dearborn', 'Livonia', 'Troy', 'Westland', 'Farmington Hills', 'Southfield', 'Royal Oak', 'Novi', 'Dearborn Heights', 'Rochester Hills', 'Pontiac', 'Roseville', 'St. Clair Shores', 'Taylor', 'Lincoln Park'):
                return f"{c} in metro Detroit sees moderate hail from summer thunderstorms, while Michigan's heavy snowfall and lake-effect moisture create significant ice dam risk"
            elif c in ('Grand Rapids', 'Kentwood', 'Wyoming'):
                return f"{c} in the Grand Rapids area gets heavy lake-effect snow from Lake Michigan combined with moderate summer hail, creating year-round roofing challenges"
            elif c in ('Kalamazoo', 'Portage'):
                return f"{c}'s southwest Michigan location brings lake-effect snow and moderate hail, with the humid continental climate producing wide temperature swings"
            elif c in ('Flint', 'Saginaw', 'Midland'):
                return f"{c}'s mid-Michigan location brings moderate hail from summer storms and significant winter snow, with older housing stock facing aging roof challenges"
            elif c in ('Lansing', 'East Lansing'):
                return f"{c}'s central Michigan location brings moderate hail from summer storms, heavy winter snow, and freeze-thaw cycling that accelerates roofing deterioration"
            elif c in ('Ann Arbor',):
                return f"Ann Arbor's southeast Michigan location sees moderate summer hail and significant winter snow, with the city's older housing stock often needing careful roof assessment"
            elif c in ('Battle Creek', 'Muskegon'):
                return f"{c}'s western Michigan location near Lake Michigan brings significant lake-effect snow and moderate summer hail, testing roof durability year-round"
            else:
                return f"{c} sees moderate hail from summer storms combined with Michigan's heavy snow and ice, creating year-round roofing challenges"
        elif state_code == 'WI':
            if c in ('Milwaukee', 'West Allis', 'Wauwatosa', 'Greenfield', 'New Berlin', 'Brookfield', 'Waukesha'):
                return f"{c} in the Milwaukee metro sees moderate hail from summer storms and heavy Lake Michigan snow, with ice dams being a major winter roofing concern"
            elif c in ('Madison',):
                return f"Madison's south-central Wisconsin location brings moderate summer hail and significant winter snow, with the isthmus setting creating unique wind exposure patterns"
            elif c in ('Green Bay',):
                return f"Green Bay's northeast Wisconsin location near Lake Michigan brings heavy snow, moderate summer hail, and harsh winter conditions that demand robust roofing"
            elif c in ('Appleton', 'Oshkosh', 'Fond du Lac'):
                return f"{c}'s Fox Valley location brings moderate hail from summer storms and heavy winter snow, with Lake Winnebago-area lake-effect adding to precipitation"
            elif c in ('Eau Claire',):
                return f"Eau Claire's western Wisconsin location brings moderate hail from summer storms and heavy snowfall, with Chippewa Valley winters testing roof durability"
            elif c in ('La Crosse',):
                return f"La Crosse's Mississippi River Valley location creates moderate hail risk from channeled storms, with heavy snow and ice in winter"
            elif c in ('Kenosha', 'Racine'):
                return f"{c}'s Lake Michigan shoreline brings lake-effect snow and moderate summer hail, with cold onshore winds adding to winter roofing stress"
            else:
                return f"{c} sees moderate hail from summer storms combined with Wisconsin's heavy snowfall and ice, creating year-round challenges for roofing systems"
        elif state_code == 'IL':
            metro = metro_areas.get((c, state_code))
            if metro == 'Chicagoland':
                return f"{c} in Chicagoland sees moderate hail from spring and summer storms, with harsh winters bringing snow, ice dams, and freeze-thaw cycling that stress roofs"
            elif c in ('Springfield',):
                return f"Springfield's central Illinois location brings moderate hail from summer storms, with significant temperature swings from hot summers to cold snowy winters"
            elif c in ('Peoria',):
                return f"Peoria's central Illinois river valley location sees moderate hail from summer storms, with ice and snow in winter creating additional roofing challenges"
            elif c in ('Rockford',):
                return f"Rockford's northern Illinois location brings moderate summer hail and heavy winter snowfall, with harsh freeze-thaw cycles deteriorating roofing materials"
            elif c in ('Bloomington', 'Normal'):
                return f"{c}'s central Illinois location sees moderate hail from summer storms, with the flat terrain offering little wind protection during severe weather"
            elif c in ('Champaign', 'Urbana'):
                return f"{c}'s east-central Illinois location in the prairie brings moderate hail and high wind exposure from summer storms, plus cold snowy winters"
            elif c in ('Decatur',):
                return f"Decatur's central Illinois location sees moderate hail from summer storms, with the flat agricultural landscape offering little protection from severe weather"
            elif c == 'DeKalb':
                return f"DeKalb's northern Illinois location brings moderate summer hail and significant winter snowfall, with the open prairie landscape increasing wind exposure"
            elif c == 'Moline':
                return f"Moline's Quad Cities location along the Mississippi River sees moderate hail from summer storms, with river valley weather patterns adding to storm intensity"
            elif c == 'Belleville':
                return f"Belleville in the St. Louis metro's Illinois side sees moderate hail from spring storms, with the Metro East area's humid climate promoting roof moisture issues"
            else:
                return f"{c} sees moderate hail from spring and summer storms, with Illinois's harsh winters adding snow, ice dams, and freeze-thaw cycling as additional roof concerns"
        elif state_code == 'MN':
            return f"{c} faces a challenging combination of severe summer hailstorms and harsh winters with heavy snowfall, creating year-round stress on roofing systems"
        elif state_code == 'FL':
            return f"{c} sees moderate hail from summer thunderstorms, but the primary roofing challenges are intense UV radiation, heavy rainfall, and tropical storm wind exposure"
        elif state_code == 'LA':
            return f"{c}'s Louisiana location brings moderate hail risk along with extreme humidity, heavy rainfall, and tropical moisture that accelerate roof material degradation"
        elif state_code == 'UT':
            return f"{c} sees moderate hail from summer thunderstorms in the Mountain West, combined with snow loads and temperature extremes that test roofing durability"
        elif state_code == 'NM':
            return f"{c}'s New Mexico location brings moderate hail from monsoon thunderstorms in July and August, while intense UV exposure degrades roofing materials faster than in humid climates"
        elif state_code == 'MT':
            if c == 'Billings':
                return f"Billings sees moderate hail from summer thunderstorms, with Montana's harsh winters bringing heavy snow, strong Chinook winds, and extreme cold"
            elif c == 'Great Falls':
                return f"Great Falls experiences frequent high winds and moderate hail from summer storms, with Montana's harsh winters bringing heavy snow and extreme cold"
            elif c == 'Missoula':
                return f"Missoula's western Montana valley location brings moderate hail from summer storms, with winter snow and Bitterroot Valley inversions creating unique conditions"
            elif c == 'Bozeman':
                return f"Bozeman's Gallatin Valley location sees moderate summer hail and heavy winter snow at elevation, with mountain weather creating rapid temperature changes"
            else:
                return f"{c}'s Montana climate produces moderate hail from summer thunderstorms, with heavy winter snow loads and extreme cold being the primary roofing challenges"
        elif state_code == 'WY':
            if c == 'Cheyenne':
                return f"Cheyenne experiences persistent high winds year-round averaging 15+ mph, moderate hail from summer storms, and heavy snowfall that test roofing system durability"
            elif c == 'Casper':
                return f"Casper's central Wyoming location brings moderate hail, extreme wind exposure, heavy winter snow, and wide temperature swings that challenge roofing materials"
            else:
                return f"{c}'s Wyoming location brings moderate hail risk from summer storms, extreme wind exposure year-round, and heavy snowfall that demands robust roof construction"
        elif state_code == 'AR':
            if c in ('Bentonville', 'Rogers', 'Fayetteville', 'Springdale'):
                return f"{c} in Northwest Arkansas sees moderate hail from spring severe weather outbreaks, with the Ozark Plateau's variable weather adding to roofing challenges"
            elif c == 'Little Rock':
                return f"Little Rock's central Arkansas location sees moderate hail from spring supercells, with hot humid summers and occasional ice storms creating varied challenges"
            elif c == 'Fort Smith':
                return f"Fort Smith's Arkansas River Valley location channels severe weather with moderate hail risk, while humidity and heat promote biological growth on roofs"
            elif c == 'Jonesboro':
                return f"Jonesboro's northeast Arkansas location in the Mississippi Delta sees moderate hail from spring storms, with hot humid summers stressing roofing materials"
            elif c == 'Pine Bluff':
                return f"Pine Bluff's southeast Arkansas location brings moderate spring storms with occasional hail, while extreme humidity promotes rapid algae growth on roofing"
            elif c == 'Conway':
                return f"Conway's central Arkansas location sees moderate hail from spring storms, with Faulkner County experiencing variable weather from hot summers to occasional winter ice"
            else:
                return f"{c} in Arkansas sees moderate hail from spring severe weather outbreaks, with hot humid summers and occasional ice storms creating varied roofing challenges"
        elif state_code == 'NE':
            return f"{c}'s Nebraska location brings moderate hail risk alongside harsh winters with snow, ice, and wind that challenge roofing system integrity"
        else:
            return f"{c} sees moderate hail risk from seasonal thunderstorms, with local climate conditions creating additional challenges for long-term roof performance"

    # Low hail, no hurricane
    if climate == 'marine':
        if state_code == 'WA':
            if c in ('Spokane', 'Spokane Valley'):
                return f"{c}'s inland Pacific Northwest location features cold winters, hot summers, and lower rainfall than the coast, with occasional ice and snow events"
            elif c in ('Yakima', 'Kennewick', 'Pasco', 'Richland'):
                return f"{c}'s eastern Washington location is much drier than the west side of the Cascades, with hot summers, cold winters, and wide daily temperature ranges"
            return f"{c}'s Pacific Northwest climate brings persistent rain and moisture from fall through spring, making moss and algae growth on roofs a constant maintenance concern"
        elif state_code == 'OR':
            if c == 'Bend':
                return f"Bend's high-desert climate east of the Cascades brings cold winters with snow, hot dry summers, and intense UV exposure at 3,600 feet elevation"
            elif c == 'Medford':
                return f"Medford's Rogue Valley location in southern Oregon brings hot dry summers and mild winters, with wildfire smoke and ash posing seasonal concerns for roofs"
            return f"{c} receives abundant rainfall in the marine climate zone, with extended wet seasons promoting moss growth and requiring proper ventilation to prevent moisture damage"
        elif state_code == 'CA':
            return f"{c}'s coastal California climate is mild year-round, but ocean moisture and fog can promote moss growth and salt air may accelerate metal component corrosion"
    elif climate == 'hot_dry':
        if state_code == 'AZ':
            if c == 'Flagstaff':
                return f"Flagstaff's 7,000-foot elevation creates a mountain climate with heavy snowfall, cold winters, and monsoon thunderstorms, very different from the desert cities below"
            elif c == 'Prescott':
                return f"Prescott's mile-high elevation brings cooler temperatures than the desert floor, with winter snow, summer monsoons, and moderate temperature swings"
            elif c == 'Prescott Valley':
                return f"Prescott Valley at 5,100 feet elevation sees winter snow and summer monsoons, with cooler conditions than the low desert but still significant UV exposure"
            elif c in ('Lake Havasu City', 'Bullhead City'):
                return f"{c}'s western Arizona desert location brings extreme summer heat exceeding 120\u00b0F, intense UV radiation, and rare but intense monsoon downpours"
            elif c == 'Sierra Vista':
                return f"Sierra Vista's elevated location near the Huachuca Mountains brings cooler conditions than Tucson, with monsoon thunderstorms and occasional winter frost"
            elif c == 'Yuma':
                return f"Yuma is one of the hottest and sunniest cities in the nation, with extreme UV radiation and temperatures above 110\u00b0F significantly reducing asphalt shingle lifespan"
            elif c in ('Oro Valley', 'Marana'):
                return f"{c} near Tucson experiences extreme desert heat, intense UV radiation, and summer monsoon thunderstorms that can produce sudden heavy rainfall and wind"
            return f"{c}'s extreme desert heat regularly exceeds 110\u00b0F in summer, causing thermal shock and UV degradation that significantly shorten the lifespan of standard asphalt shingles"
        elif state_code == 'NV':
            if c in ('Reno', 'Sparks'):
                return f"{c}'s high-desert climate at 4,500 feet brings intense UV exposure, occasional snow loads, and extreme temperature swings from hot summers to cold winters"
            elif c == 'Carson City':
                return f"Carson City's 4,700-foot elevation at the base of the Sierra Nevada brings winter snow, intense UV, and temperature swings from hot summers to cold winters"
            return f"{c}'s desert climate produces extreme heat and intense UV radiation that rapidly age roofing materials, while rare but intense monsoon rains test waterproofing systems"
        elif state_code == 'NM':
            if c == 'Santa Fe':
                return f"Santa Fe's 7,000-foot elevation brings winter snow, intense high-altitude UV, and monsoon thunderstorms that create unique roofing challenges in the high desert"
            elif c == 'Albuquerque':
                return f"Albuquerque's high-desert climate at 5,300 feet features intense UV radiation, wide daily temperature swings, and summer monsoon thunderstorms"
            elif c == 'Las Cruces':
                return f"Las Cruces in the Mesilla Valley experiences extreme heat, intense UV radiation, and occasional monsoon downpours, with Chihuahuan Desert conditions stressing roofs"
            elif c == 'Rio Rancho':
                return f"Rio Rancho's high-desert plateau brings intense UV radiation, monsoon thunderstorms from July through September, and wide daily temperature swings"
            elif c == 'Roswell':
                return f"Roswell's Pecos Valley location in southeastern New Mexico brings hot dry summers, occasional severe thunderstorms, and intense UV exposure year-round"
            elif c == 'Farmington':
                return f"Farmington's Four Corners location at 5,400 feet brings wide temperature swings, winter snow, and summer monsoon storms with occasional severe weather"
            elif c == 'Clovis':
                return f"Clovis on the eastern New Mexico plains experiences persistent winds, occasional hail from spring storms, and intense UV that accelerates roof material aging"
            else:
                return f"{c}'s high-desert New Mexico climate features intense UV radiation, wide daily temperature swings, and monsoon season thunderstorms from July through September"
        elif state_code == 'TX':
            return f"{c}'s West Texas climate brings intense heat, strong UV exposure, and minimal rainfall, but occasional severe thunderstorms can produce damaging winds and hail"
        elif state_code == 'CA':
            return f"{c}'s California climate brings intense heat in summer with strong UV radiation, while wildfire smoke and ash can accumulate on roofs during fire season"
    elif climate == 'hot_humid':
        if state_code == 'TX':
            if c == 'Austin':
                return f"Austin's hot humid climate brings intense summer heat above 100\u00b0F, heavy spring rainfall, and occasional severe thunderstorms with wind and hail"
            elif c == 'San Antonio':
                return f"San Antonio experiences moderate hail risk with occasional severe storms, while extreme summer heat reaching 100\u00b0F+ accelerates shingle aging and thermal cycling"
            elif c in ('Dallas', 'Fort Worth'):
                # Already handled in hail_risk == 'high'
                return f"{c}'s hot humid climate drives rapid algae and moss growth on shingles, while extreme summer heat accelerates material degradation"
            elif c in ('Laredo',):
                return f"Laredo's extreme heat regularly exceeds 105\u00b0F in summer, with intense UV radiation and low humidity accelerating asphalt shingle aging on the Mexican border"
            return f"{c}'s hot and humid Texas climate drives rapid algae and moss growth on shingles, while extreme summer heat accelerates material degradation"
        elif state_code == 'AL':
            return f"{c}'s hot and humid Alabama climate promotes algae growth on roof surfaces, with heavy thunderstorms and occasional severe weather adding to roof wear"
        elif state_code == 'MS':
            return f"{c}'s Mississippi climate is characterized by high heat, heavy humidity, and substantial rainfall that promote biological growth and test waterproofing systems"
        elif state_code == 'SC':
            return f"{c}'s South Carolina humidity and heat promote algae and moss growth, while heavy rainfall averaging over 45 inches annually tests gutter and drainage systems"
        elif state_code == 'GA':
            return f"{c}'s Georgia heat and humidity create ideal conditions for algae growth on roofs, while afternoon thunderstorms bring heavy rain and occasional wind damage"
        elif state_code == 'HI':
            return f"Honolulu's tropical climate brings year-round warmth, trade winds, and heavy rainfall that demand roofing materials resistant to moisture, UV, and wind uplift"
    elif climate == 'mixed_humid':
        if state_code == 'NC':
            if c == 'Asheville':
                return f"Asheville's Blue Ridge Mountain setting brings colder winters with occasional heavy snowfall and ice storms, unlike the milder Piedmont and coastal regions"
            return f"{c}'s North Carolina climate produces hot humid summers and cool winters with occasional ice storms, creating a wide range of conditions that stress roofing materials"
        elif state_code == 'VA':
            if c in ('Blacksburg',):
                return f"Blacksburg's New River Valley mountain location brings cooler temperatures, more snowfall, and higher winds than Virginia's lower elevations"
            elif c in ('Harrisonburg',):
                return f"Harrisonburg's Shenandoah Valley location brings cooler mountain weather, significant winter snowfall, and occasional severe thunderstorms in summer"
            elif c in ('Charlottesville',):
                return f"Charlottesville's Piedmont location at the foot of the Blue Ridge brings variable weather with hot humid summers, occasional ice storms, and mountain-influenced storms"
            elif c in ('Roanoke',):
                return f"Roanoke's Blue Ridge Valley location creates channeled weather patterns with moderate storms, while mountain proximity brings more precipitation and winter ice"
            elif c in ('Richmond',):
                return f"Richmond's central Virginia location brings hot humid summers, occasional hurricanes remnants, and winter ice storms that create diverse roofing challenges"
            elif c in ('Leesburg', 'Manassas'):
                return f"{c} in Northern Virginia sees four distinct seasons with hot humid summers, cold winters, and exposure to both thunderstorms and occasional hurricane remnants"
            elif c == 'Alexandria':
                return f"Alexandria's Potomac River location brings humid summers, cold winters, and exposure to nor'easters and tropical storm remnants that test roof resilience"
            elif c == 'Danville':
                return f"Danville's south-central Virginia Piedmont location brings hot humid summers and mild winters, with occasional severe thunderstorms and tropical storm remnants"
            return f"{c}'s mid-Atlantic climate produces hot humid summers and cool winters with occasional ice storms, creating a wide range of conditions that stress roofing materials"
        elif state_code == 'TN':
            return f"{c}'s Tennessee climate brings hot humid summers, moderate winters with occasional ice storms, and heavy spring rainfall that test roof waterproofing"
        elif state_code == 'KY':
            return f"{c}'s Kentucky climate features humid summers, variable winters with ice events, and spring thunderstorms that combine to create diverse roofing challenges"
        elif state_code == 'MO':
            return f"{c}'s central Missouri location brings temperature extremes from hot humid summers to cold winters, with freeze-thaw cycling stressing roofing materials"
        elif state_code == 'WV':
            if c == 'Charleston':
                return f"Charleston's Kanawha Valley location channels weather creating heavy rainfall, winter ice storms, and significant freeze-thaw cycling that stress roofing"
            elif c == 'Huntington':
                return f"Huntington's Ohio River Valley location brings heavy rainfall, winter ice storms, and freeze-thaw cycling common to the western West Virginia climate"
            return f"{c}'s West Virginia mountain climate brings heavy rainfall, winter ice storms, and significant freeze-thaw cycling that accelerate roof deterioration"
        elif state_code == 'AR':
            return f"{c}'s Arkansas climate produces hot humid summers and mild winters with occasional ice storms, while severe thunderstorms bring hail and wind damage"
        elif state_code == 'DE':
            if c == 'Dover':
                return f"Dover's central Delaware location brings humid summers, moderate winters, and exposure to coastal storms and nor'easters that can deliver high winds"
            else:
                return f"Wilmington's northern Delaware location brings humid summers and moderately cold winters, with nor'easters and coastal storms occasionally producing heavy precipitation"
        elif state_code == 'MD':
            return f"{c}'s Maryland location brings hot humid summers, cold winters, and exposure to nor'easters that can deliver heavy snow and high winds"
        elif state_code == 'NJ':
            return f"{c}'s New Jersey climate features humid summers and cold winters with significant snowfall, plus exposure to nor'easters and coastal storm systems"
        elif state_code == 'OK':
            return f"{c}'s Oklahoma climate produces extreme temperature swings, with hot summers, cold winters, and a severe storm season that brings hail, wind, and tornadoes"
    elif climate == 'mixed_dry':
        if state_code == 'TX':
            return f"{c}'s semi-arid West Texas climate brings intense sun, wide temperature swings, and dust storms, with occasional severe thunderstorms during spring"
        elif state_code == 'KS':
            return f"{c}'s Kansas location features hot summers, cold winters, persistent winds, and a severe storm season from March through July"
        elif state_code == 'CO':
            return f"{c}'s western Colorado climate brings intense sun, dry conditions, and wide temperature swings between hot summers and cold winters"
        elif state_code == 'NM':
            return f"{c}'s New Mexico climate features intense UV radiation, monsoon thunderstorms, and wide daily temperature swings that stress roofing materials"
        elif state_code == 'WA':
            return f"{c}'s eastern Washington climate is much drier than the west side of the Cascades, with hot summers, cold winters, and wide daily temperature ranges"
        elif state_code == 'OR':
            return f"{c}'s location east of the Cascades brings a drier continental climate with hot summers, cold winters, and significant temperature variation"
    elif climate == 'cold':
        if state_code in ('OH',):
            if snow == 'high':
                return f"{c} experiences heavy lake-effect snowfall from Lake Erie, with ice dam formation and freeze-thaw cycling being the primary threats to roof integrity"
            return f"{c}'s Ohio climate brings cold winters with snow and ice, hot humid summers, and freeze-thaw cycles that can crack and deteriorate roofing materials over time"
        elif state_code == 'IN':
            return f"{c}'s Indiana climate brings cold winters with snow and ice, hot humid summers, and freeze-thaw cycles that can crack and deteriorate roofing materials over time"
        elif state_code == 'IL':
            return f"{c}'s Illinois climate brings cold winters with snow and ice, hot humid summers, and freeze-thaw cycles that can deteriorate roofing materials over time"
        elif state_code == 'WI':
            return f"{c}'s Wisconsin climate brings cold snowy winters, moderate summer heat, and freeze-thaw cycles that can deteriorate roofing materials over time"
        elif state_code == 'MI':
            if snow == 'high':
                return f"{c} experiences heavy lake-effect snowfall, with ice dam formation and freeze-thaw cycling being the primary threats to roof integrity"
            return f"{c}'s Michigan climate brings cold winters with snow and ice, warm summers, and freeze-thaw cycles that stress roofing materials"
        elif state_code in ('NH',):
            return f"{c}'s New Hampshire climate features cold winters with heavy snowfall, ice dams, and nor'easters, while humid summers promote moisture-related roofing issues"
        elif state_code in ('CT',):
            return f"{c}'s Connecticut climate features cold winters with snowfall, ice events, and nor'easters, while humid summers promote moisture-related roofing issues"
        elif state_code in ('RI',):
            return f"{c}'s Rhode Island climate features cold winters with snowfall, coastal storms, and nor'easters, while humid summers bring moisture challenges for roofing"
        elif state_code in ('MA',):
            return f"{c}'s New England climate features cold winters with heavy snowfall, ice dams, and nor'easters, while humid summers promote moisture-related roofing issues"
        elif state_code == 'NY':
            if snow == 'high':
                return f"{c} receives heavy snowfall from lake-effect storms, with ice dams, heavy snow loads, and harsh freeze-thaw cycles being the main roofing concerns"
            return f"{c}'s New York climate brings cold snowy winters, warm humid summers, and exposure to nor'easters that test roofing systems year-round"
        elif state_code == 'PA':
            if snow == 'high':
                return f"{c}'s Pennsylvania location brings heavy snowfall, ice dams, and significant freeze-thaw cycling that demand robust, properly ventilated roofing systems"
            return f"{c}'s Pennsylvania climate produces cold winters with moderate snowfall, ice events, and freeze-thaw cycling that stress roofing materials"
        elif state_code == 'CO':
            return f"{c}'s Colorado location brings significant snowfall, intense high-altitude UV exposure, and rapid temperature changes that challenge roofing material durability"
        elif state_code == 'ID':
            return f"{c}'s Idaho climate produces cold winters with moderate to heavy snowfall, while summer brings dry heat and intense UV exposure at elevation"
        elif state_code == 'UT':
            return f"{c}'s Utah location brings cold winters with snow, hot dry summers, and wide temperature swings that create thermal stress on roofing materials"
        elif state_code == 'NE':
            return f"{c}'s Nebraska location brings harsh winters with snow and ice, hot summers, and severe thunderstorms during the spring and early summer"
        elif state_code == 'IA':
            return f"{c}'s Iowa climate features harsh winters with snow and ice, hot humid summers, and temperature extremes that create significant freeze-thaw stress"
        elif state_code == 'SD':
            return f"{c}'s South Dakota location brings severe winters, heavy snowfall, and extreme temperature swings that demand durable roofing systems"
        elif state_code == 'AZ':
            return f"Flagstaff at 7,000 feet gets over 100 inches of snow annually, with cold winters and monsoon thunderstorms creating very different roofing needs than the Arizona desert"
        elif state_code == 'NM':
            return f"Santa Fe's 7,000-foot elevation brings winter snow, intense high-altitude UV, and monsoon thunderstorms that create unique roofing challenges in the high desert"
        elif state_code == 'NV':
            return f"{c}'s high-desert elevation brings cold winters with moderate snow, intense UV radiation year-round, and extreme daily temperature swings"
        elif state_code == 'WA':
            return f"{c}'s eastern Washington location features cold winters, hot summers, and lower rainfall than the coast, with occasional ice and snow events stressing roofs"
        elif state_code == 'NC':
            return f"Asheville's Blue Ridge Mountain setting brings colder winters with occasional heavy snowfall and ice storms, unlike the milder Piedmont and coastal regions"
        elif state_code == 'WY':
            return f"{c}'s Wyoming climate brings heavy snow, extreme cold, and persistent high winds that require roofing materials rated for severe weather conditions"
        else:
            return f"{c}'s cold climate brings winter snow and ice, freeze-thaw cycling, and temperature extremes that demand durable, well-insulated roofing systems"
    elif climate == 'very_cold':
        if state_code == 'MN':
            return f"{c}'s Minnesota winters bring extreme cold, heavy snowfall, and persistent ice that make proper roof ventilation and ice dam prevention critical"
        elif state_code == 'ND':
            return f"{c}'s North Dakota winters are among the harshest in the nation, with extreme cold, blizzards, and heavy snow loads that demand the highest-rated roofing systems"
        elif state_code == 'MT':
            return f"{c}'s Montana climate brings bitterly cold winters with heavy snow, plus summer thunderstorms and strong Chinook winds that can damage improperly secured roofing"
        elif state_code == 'VT':
            return f"Burlington's Vermont climate features cold snowy winters with ice dam risk, while heavy spring rainfall and humid summers test roof waterproofing systems"
        elif state_code == 'ME':
            return f"Portland's Maine coast location brings harsh winters with heavy snow, ice, and powerful nor'easters, making roof durability and proper insulation essential"
        else:
            return f"{c}'s very cold climate brings extreme winter conditions with heavy snow loads, ice dams, and severe freeze-thaw cycling that test roofing systems to their limits"
    elif climate == 'subarctic':
        return f"Anchorage's subarctic climate brings extreme cold, heavy snow loads, seismic activity, and limited daylight in winter that all factor into roofing material selection and timing"

    return f"{c}'s local climate presents seasonal challenges for roofing, with temperature variations and precipitation patterns that affect material selection and maintenance schedules"

def generate_material_tip(city, state_code, climate, hail_risk, is_hurricane, snow):
    c = city
    if is_hurricane and state_code == 'FL':
        return f"Florida Building Code requires wind-rated shingles in {c}; choose products rated to 130+ mph and consider metal roofing for superior hurricane resistance"
    elif is_hurricane and state_code == 'LA':
        return f"Wind-rated architectural shingles or standing seam metal roofing provide the best hurricane protection for {c} homes, with proper ring-shank nail fastening"
    elif is_hurricane and state_code == 'TX':
        return f"Impact-resistant, wind-rated shingles are recommended for {c} to handle both Gulf storm winds and Texas heat; metal roofing offers excellent durability"
    elif is_hurricane and state_code in ('SC',):
        return f"Wind-rated shingles meeting South Carolina coastal building codes are essential in {c}, with Class 4 impact-resistant options offering insurance premium reductions"
    elif is_hurricane and state_code == 'NC':
        return f"Wind-rated architectural shingles or metal roofing meeting North Carolina building codes are recommended in {c} for hurricane and tropical storm protection"
    elif is_hurricane and state_code == 'VA':
        return f"Wind-rated architectural shingles or metal roofing provide the best protection for {c}'s coastal exposure, with proper waterproofing underlayment for driving rain"
    elif is_hurricane and state_code == 'MS':
        return f"Hurricane-rated roofing materials are essential in {c}; consider standing seam metal or impact-resistant shingles rated for 130+ mph winds"
    elif is_hurricane and state_code == 'AL':
        return f"Wind-rated architectural shingles or metal roofing offer the best hurricane protection in {c}, with sealed decking systems for additional waterproofing"
    elif is_hurricane and state_code == 'GA':
        return f"Wind-rated shingles or metal roofing are recommended in {c} for hurricane and tropical storm protection, with algae-resistant options for the humid climate"
    elif is_hurricane and state_code == 'HI':
        return f"In Honolulu, tile or metal roofing stands up best to trade winds, UV exposure, and salt air, with concrete tile being a popular long-lasting choice"

    if hail_risk == 'high':
        if state_code in ('TX', 'OK', 'KS'):
            return f"Class 4 impact-resistant shingles can reduce insurance premiums by 15-25% in {c} and provide significantly better hail protection than standard 3-tab shingles"
        elif state_code == 'CO':
            return f"Impact-resistant Class 4 shingles are highly recommended in {c}, with Colorado insurers typically offering 15-28% premium discounts for qualifying products"
        elif state_code in ('NE', 'SD', 'ND', 'IA', 'MN'):
            return f"Class 4 impact-resistant shingles are strongly recommended in {c} for hail protection, and many {state_names[state_code]} insurers offer premium discounts for these products"
        else:
            return f"Invest in Class 4 impact-resistant shingles in {c} to protect against hail damage and potentially earn insurance premium discounts"

    if climate == 'hot_dry':
        if state_code == 'AZ':
            if c == 'Flagstaff':
                return f"Architectural shingles with high wind ratings and snow load capacity are best for Flagstaff, with lighter colors helping manage summer heat at altitude"
            return f"Tile roofing or light-colored reflective shingles help reduce cooling costs in {c}'s extreme heat, with concrete tile lasting 50+ years in the dry desert climate"
        elif state_code == 'NV':
            return f"Cool-roof rated shingles or tile roofing help combat {c}'s intense heat and UV exposure, with lighter colors reducing attic temperatures by up to 30\u00b0F"
        elif state_code == 'NM':
            return f"Light-colored or reflective roofing materials reduce cooling costs in {c}'s high-desert climate, with metal or tile roofing offering excellent UV resistance"
        elif state_code == 'TX':
            return f"Reflective or light-colored roofing materials help manage {c}'s intense West Texas heat, while impact-resistant options protect against occasional severe storms"
        elif state_code == 'CA':
            return f"Cool roof materials meeting California Title 24 requirements are recommended in {c} to reduce energy costs and comply with state building efficiency standards"
        elif state_code == 'UT':
            return f"Light-colored reflective shingles or metal roofing reduce cooling costs in {c}'s hot dry climate while withstanding intense UV exposure at elevation"
    elif climate == 'hot_humid':
        if state_code == 'TX':
            return f"Algae-resistant shingles with copper or zinc granules perform best in {c}'s humid climate, helping prevent dark streaking common on Texas Gulf Coast roofs"
        elif state_code in ('AL', 'MS', 'GA', 'SC'):
            return f"Choose algae-resistant shingles rated for {c}'s hot humid climate; products with copper granules prevent the black streaking common in the Southeast"
    elif climate == 'marine':
        if state_code in ('WA', 'OR'):
            return f"Algae and moss-resistant shingles or metal roofing are ideal for {c}'s wet climate, with zinc strip installations helping prevent biological growth"
        elif state_code == 'CA':
            return f"In {c}'s marine climate, composite or architectural shingles with algae resistance perform well, while metal roofing offers superior moisture protection"
    elif climate == 'cold' or climate == 'very_cold':
        if snow == 'high':
            return f"Heavy-duty architectural shingles rated for cold climates and high snow loads are essential in {c}, with proper ice and water shield underlayment at eaves"
        else:
            return f"Architectural shingles rated for cold climates with strong freeze-thaw resistance are recommended in {c}, with ice and water shield at all eaves and valleys"
    elif climate == 'subarctic':
        return f"Metal roofing or premium architectural shingles with arctic-rated flexibility are essential in Anchorage, with extensive ice and water shield underlayment required"
    elif climate == 'mixed_humid':
        if state_code in ('NC', 'VA', 'TN', 'KY', 'SC'):
            return f"Algae-resistant architectural shingles offer the best value in {c}'s mixed humid climate, balancing heat resistance with durability through seasonal temperature swings"
        elif state_code in ('MO', 'AR', 'OK'):
            return f"Impact-resistant architectural shingles are a wise investment in {c}, providing protection against hail while withstanding the region's temperature extremes"
        elif state_code in ('NJ', 'DE', 'MD'):
            return f"Architectural shingles with strong wind ratings protect {c} homes from nor'easters, while algae-resistant options prevent staining in the humid climate"
        elif state_code == 'WV':
            return f"Cold-climate rated architectural shingles with ice and water shield underlayment are recommended for {c}'s mountainous West Virginia conditions"
    elif climate == 'mixed_dry':
        return f"Durable architectural shingles or metal roofing handle {c}'s temperature extremes and dry conditions well, with UV-resistant options extending service life"

    return f"Architectural shingles offer the best balance of durability and value for {c}'s climate, with 30-50 year warranties available from major manufacturers"

def generate_permit_note(city, state_code):
    c = city
    st = state_names[state_code]
    templates = [
        f"{c} requires a building permit from the city's Development Services Department for all full roof replacements",
        f"A roofing permit is required in {c} for complete tear-off and replacement projects; apply through the {c} Building Division",
        f"The City of {c} requires building permits for roof replacements, with inspections typically required before and after the work",
        f"{c}'s building department requires permits for full roof replacements; most contractors handle the permit application process",
        f"Roof replacement permits are mandatory in {c} and can be obtained through the city's permitting office, usually within 1-3 business days",
        f"In {c}, a building permit is required for any roof replacement project; the city enforces {st} building code requirements",
        f"{c} mandates building permits for roof replacements, with the permit fee typically based on the project's estimated value",
        f"The {c} Building Inspections office requires a permit for full roof replacements to ensure compliance with local building codes",
        f"A permit from {c}'s Code Enforcement or Building Department is required before starting a roof replacement project",
        f"{c} enforces permit requirements for all roof replacements; your contractor should pull the permit before work begins",
        f"The City of {c} requires a construction permit for roof replacement work, with code compliance inspections during and after installation",
        f"Roof replacement in {c} requires a building permit; the city follows the International Residential Code with local amendments",
        f"A building permit must be obtained from {c}'s Planning and Development office before any roof replacement project can begin",
        f"{c} requires permits for roof replacements under its adopted building code; inspections verify proper installation and material compliance",
        f"The {c} municipal building department issues permits for roof replacements, typically requiring proof of contractor licensing and insurance",
    ]
    idx = hash((city, state_code)) % len(templates)
    return templates[idx]

def generate_local_insight(city, state_code, climate, growth, hail_risk, pop):
    c = city
    st = state_names[state_code]
    metro = metro_areas.get((city, state_code), None)

    if growth == 'high':
        insights = [
            f"{c}'s rapid growth has increased demand for roofing contractors, so booking 3-4 weeks ahead is recommended during peak season",
            f"Strong population growth in {c} means roofing contractors stay busy year-round; get multiple quotes and book early",
            f"The booming housing market in {c} keeps local roofers in high demand, especially from spring through fall",
            f"{c}'s fast-growing market means experienced roofing contractors are in high demand; verify licensing and check recent references carefully",
            f"Rapid development in {metro or c} has stretched contractor availability; schedule your roof replacement 4-6 weeks in advance during busy months",
        ]
    elif growth == 'low':
        insights = [
            f"{c}'s stable housing market means good contractor availability and competitive pricing for roof replacements year-round",
            f"Roofing contractors in {c} are generally available with shorter lead times, making it easier to get competitive bids",
            f"The moderate pace of construction in {c} means homeowners can often find available roofers with 1-2 weeks notice outside storm season",
            f"{c}'s housing market offers steady contractor availability, but always verify licensing through {st}'s contractor board",
            f"With a stable construction market, {c} homeowners benefit from competitive roofing prices and good contractor availability",
        ]
    else:
        insights = [
            f"{c} contractors are busiest during spring and summer; scheduling your roof replacement in fall or early winter can yield better pricing",
            f"In {c}, the best time to schedule a non-emergency roof replacement is late fall or early spring when contractor demand is lower",
            f"Most {metro or c} roofing contractors offer free inspections; get at least three quotes before committing to a roof replacement",
            f"{c}'s roofing market is competitive, so comparing multiple contractor bids can help homeowners secure better pricing and warranty terms",
            f"Local {c} contractors recommend scheduling roof work during their slower season to get more attention and potentially better rates",
        ]

    # Seasonal overrides
    if climate in ('hot_dry', 'hot_humid') and state_code in ('AZ', 'TX', 'FL', 'NV'):
        seasonal = [
            f"In {c}, early morning starts are standard during summer to avoid extreme afternoon heat, which can affect shingle adhesion",
            f"{c} roofers typically work dawn to early afternoon during summer months when temperatures exceed 100\u00b0F",
            f"Fall through spring is the preferred roofing season in {c}, as extreme summer heat can compromise installation quality",
        ]
        idx2 = (hash((city, state_code, 'seasonal')) % len(seasonal))
        if hash((city, state_code, 'use_seasonal')) % 3 == 0:
            return seasonal[idx2]

    if climate in ('cold', 'very_cold', 'subarctic') and state_code in ('MN', 'WI', 'MI', 'ND', 'MT', 'VT', 'ME', 'NH', 'AK', 'NY'):
        seasonal = [
            f"{c}'s harsh winters limit the roofing season primarily to April through October, so plan projects well ahead of the cold months",
            f"The window for roof installation in {c} is tightest from November through March; most contractors focus on emergency repairs in winter",
            f"In {c}, the prime roofing season runs May through September, with contractors booking up quickly for summer projects",
        ]
        idx2 = (hash((city, state_code, 'cold_seasonal')) % len(seasonal))
        if hash((city, state_code, 'use_cold')) % 3 == 0:
            return seasonal[idx2]

    if hail_risk == 'high':
        storm_insights = [
            f"{metro or c} area contractors are busiest April through June after spring storm season; book early or wait until late summer for better availability",
            f"After major hail events in {c}, contractor demand spikes dramatically; having a trusted roofer relationship before storm season is valuable",
        ]
        if hash((city, state_code, 'storm')) % 4 == 0:
            idx3 = hash((city, state_code, 'storm_idx')) % len(storm_insights)
            return storm_insights[idx3]

    idx = hash((city, state_code, 'insight')) % len(insights)
    return insights[idx]

# Build the full dataset
result = {}
for c in cities:
    city = c['city']
    state_code = c['state_code']
    pop = c['population']
    key = f"{city}|{state_code}"

    climate = city_climate_overrides.get((city, state_code), state_climate.get(state_code, 'mixed_humid'))
    hail_risk = city_hail_overrides.get((city, state_code), state_hail.get(state_code, 'low'))
    is_hurricane = state_code == 'FL' or (city, state_code) in hurricane_specific
    snow = city_snow_overrides.get((city, state_code), state_snow.get(state_code, 'low'))
    avg_home_age = get_avg_home_age(city, state_code, pop)
    hoa = get_hoa(city, state_code, pop)

    if (city, state_code) in high_growth_cities:
        growth = 'high'
    elif (city, state_code) in low_growth_cities:
        growth = 'low'
    else:
        growth = 'moderate'

    weather_note = generate_weather_note(city, state_code, climate, hail_risk, is_hurricane, snow)
    material_tip = generate_material_tip(city, state_code, climate, hail_risk, is_hurricane, snow)
    permit_note = generate_permit_note(city, state_code)
    local_insight = generate_local_insight(city, state_code, climate, growth, hail_risk, pop)

    result[key] = {
        "climateZone": climate,
        "hailRisk": hail_risk,
        "hurricaneZone": is_hurricane,
        "snowLoad": snow,
        "avgHomeAge": avg_home_age,
        "growthRate": growth,
        "permitNote": permit_note,
        "weatherNote": weather_note,
        "materialTip": material_tip,
        "localInsight": local_insight,
        "hoaPrevalence": hoa
    }

# Write the JSON
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'city-context.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f"Written {len(result)} cities to {output_path}")
assert len(result) == len(cities), f"Mismatch: {len(result)} vs {len(cities)}"
print("All cities accounted for!")
