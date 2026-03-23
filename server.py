import json
import os
import math
import threading
import requests
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN", "")
QUOTES_LOCK = threading.Lock()
VALID_MATERIALS = {"asphalt", "architectural", "metal", "tile"}

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "community-quotes.json")

DEFAULT_TIMEOUT = 8
OVERPASS_TIMEOUT = 12
OSM_SEARCH_RADIUS_METERS = 60
MIN_BUILDING_SQFT = 400
MAX_BUILDING_SQFT = 20000

SESSION = requests.Session()
RETRY = Retry(
    total=2,
    backoff_factor=0.5,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET", "POST"]
)
ADAPTER = HTTPAdapter(max_retries=RETRY)
SESSION.mount("https://", ADAPTER)
SESSION.mount("http://", ADAPTER)

DEFAULT_HEADERS = {
    "User-Agent": "TruePriceRoofSignals/1.0",
    "Accept": "application/json"
}

def normalize_property_address_key(payload):
    street = str(payload.get("street", "")).strip().lower()
    city = str(payload.get("city", "")).strip().lower()
    state_code = str(payload.get("stateCode", "")).strip().upper()
    zip_code = str(payload.get("zip", "")).strip()
    return f"{street}|{city}|{state_code}|{zip_code}"

def haversine_distance_meters(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def polygon_centroid(coords):
    if not coords:
        return None

    lat_sum = 0
    lon_sum = 0
    count = 0

    for lat, lon in coords:
        lat_sum += lat
        lon_sum += lon
        count += 1

    if count == 0:
        return None

    return {
        "lat": lat_sum / count,
        "lon": lon_sum / count
    }


def clamp(value, low, high):
    return max(low, min(high, value))


def score_building_candidate(candidate):
    distance_m = candidate.get("distanceMeters")
    sqft = candidate.get("footprintSqFt")

    if distance_m is None or sqft is None:
        return 0

    if sqft < MIN_BUILDING_SQFT or sqft > MAX_BUILDING_SQFT:
        return 0

    distance_score = max(0, 100 - (distance_m * 2.2))

    size_score = 0
    if 800 <= sqft <= 6000:
        size_score = 25
    elif 600 <= sqft <= 9000:
        size_score = 15
    else:
        size_score = 5

    return round(distance_score + size_score, 2)


def classify_building_match(best_candidate, viable_candidates):
    if not best_candidate:
        return "low", -0.2

    distance_m = best_candidate.get("distanceMeters")
    score = best_candidate.get("score", 0)
    count = len(viable_candidates)

    if distance_m is not None and distance_m <= 12 and score >= 95 and count == 1:
        return "high", 0.15

    if distance_m is not None and distance_m <= 25 and score >= 70:
        if count <= 2:
            return "medium", 0.0
        return "medium", -0.08

    return "low", -0.18

MOCK_PROPERTY_DB = {
    "123 main st|dallas|TX|75201": {
        "footprintSqFt": 2050,
        "livingAreaSqFt": 3200,
        "stories": 2,
        "propertyType": "single_family",
        "city": "Dallas",
        "stateCode": "TX",
        "sourceQuality": "medium",
        "source": "property_api"
    },
    "742 willow bend dr|austin|TX|78704": {
        "footprintSqFt": 2280,
        "livingAreaSqFt": 2280,
        "stories": 1,
        "propertyType": "single_family",
        "city": "Austin",
        "stateCode": "TX",
        "sourceQuality": "high",
        "source": "property_api"
    },
    "321 pine lane|san antonio|TX|78205": {
        "footprintSqFt": 1850,
        "livingAreaSqFt": 1850,
        "stories": 1,
        "propertyType": "single_family",
        "city": "San Antonio",
        "stateCode": "TX",
        "sourceQuality": "high",
        "source": "property_api"
    },
    "100 oak ave|nashville|TN|37203": {
        "footprintSqFt": 1600,
        "livingAreaSqFt": 2400,
        "stories": 2,
        "propertyType": "single_family",
        "city": "Nashville",
        "stateCode": "TN",
        "sourceQuality": "medium",
        "source": "property_api"
    }
}

def geocode_address(address):
    if not MAPBOX_TOKEN:
        return None

    try:
        query = f"{address.get('street', '')} {address.get('city', '')} {address.get('stateCode', '')} {address.get('zip', '')}".strip()
        if not query:
            return None

        url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
        params = {
            "access_token": MAPBOX_TOKEN,
            "limit": 1,
            "types": "address"
        }

        res = SESSION.get(
            url,
            params=params,
            headers=DEFAULT_HEADERS,
            timeout=DEFAULT_TIMEOUT
        )
        res.raise_for_status()
        data = res.json()

        features = data.get("features") or []
        if not features:
            return None

        feature = features[0]
        coords = feature.get("center") or []
        if len(coords) != 2:
            return None

        relevance = feature.get("relevance", 0)
        place_type = feature.get("place_type", [])
        match_quality = "high" if relevance >= 0.95 else "medium" if relevance >= 0.8 else "low"

        result = {
            "lon": coords[0],
            "lat": coords[1],
            "relevance": relevance,
            "matchQuality": match_quality,
            "placeType": place_type,
            "fullPlaceName": feature.get("place_name")
        }
        return result

    except Exception as e:
        return None


def fetch_osm_footprint(lat, lon):
    try:
        overpass_url = "https://overpass-api.de/api/interpreter"

        query = f"""
        [out:json][timeout:10];
        (
          way(around:{OSM_SEARCH_RADIUS_METERS},{lat},{lon})["building"];
          relation(around:{OSM_SEARCH_RADIUS_METERS},{lat},{lon})["building"];
        );
        out geom tags;
        """

        res = SESSION.post(
            overpass_url,
            data=query,
            headers={**DEFAULT_HEADERS, "Content-Type": "text/plain"},
            timeout=OVERPASS_TIMEOUT
        )
        res.raise_for_status()
        data = res.json()

        elements = data.get("elements", [])
        if not elements:
            return None

        candidates = []

        for element in elements:
            geometry = element.get("geometry") or []
            coords = [(p["lat"], p["lon"]) for p in geometry if "lat" in p and "lon" in p]
            if len(coords) < 3:
                continue

            sqft = polygon_area_sqft(coords)
            if not sqft:
                continue

            centroid = polygon_centroid(coords)
            if not centroid:
                continue

            distance_m = haversine_distance_meters(
                lat,
                lon,
                centroid["lat"],
                centroid["lon"]
            )

            candidate = {
                "osmType": element.get("type"),
                "osmId": element.get("id"),
                "tags": element.get("tags", {}),
                "coords": coords,
                "footprintSqFt": sqft,
                "centroidLat": round(centroid["lat"], 7),
                "centroidLon": round(centroid["lon"], 7),
                "distanceMeters": round(distance_m, 2)
            }
            candidate["score"] = score_building_candidate(candidate)

            if candidate["score"] > 0:
                candidates.append(candidate)

        if not candidates:
            return None

        candidates.sort(key=lambda c: (-c["score"], c["distanceMeters"], c["footprintSqFt"]))

        best = candidates[0]
        viable_candidates = [c for c in candidates if c["score"] >= 50]

        building_match_quality, confidence_modifier = classify_building_match(best, viable_candidates)

        ambiguous = False
        if len(viable_candidates) >= 2:
            top = viable_candidates[0]
            runner_up = viable_candidates[1]
            if abs(top["score"] - runner_up["score"]) <= 10 and abs(top["distanceMeters"] - runner_up["distanceMeters"]) <= 12:
                ambiguous = True

        return {
            "bestCandidate": best,
            "viableCandidates": viable_candidates[:5],
            "candidateCount": len(candidates),
            "buildingMatchQuality": "low" if ambiguous else building_match_quality,
            "confidenceModifier": -0.12 if ambiguous else confidence_modifier,
            "ambiguous": ambiguous
        }

    except Exception as e:
        return None


def polygon_area_sqft(coords):
    if not coords or len(coords) < 3:
        return None

    avg_lat = sum(lat for lat, _ in coords) / len(coords)
    meters_per_deg_lat = 111320
    meters_per_deg_lon = 111320 * math.cos(math.radians(avg_lat))

    def to_xy(lat, lon):
        x = lon * meters_per_deg_lon
        y = lat * meters_per_deg_lat
        return x, y

    points = [to_xy(lat, lon) for lat, lon in coords]

    area = 0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        area += x1 * y2 - x2 * y1

    area = abs(area) / 2
    sqft = area * 10.7639
    return round(sqft)

def lookup_property_signals_from_provider(payload):
    geo = geocode_address(payload)
    if not geo:
        return None

    osm_result = fetch_osm_footprint(geo["lat"], geo["lon"])
    if not osm_result:
        return None

    best = osm_result.get("bestCandidate")
    if not best:
        return None

    source_quality = "high"
    if osm_result.get("buildingMatchQuality") == "medium":
        source_quality = "medium"
    elif osm_result.get("buildingMatchQuality") == "low":
        source_quality = "low"

    return {
        "footprintSqFt": best.get("footprintSqFt"),
        "livingAreaSqFt": None,
        "stories": 1,
        "propertyType": "unknown",
        "city": payload.get("city"),
        "stateCode": payload.get("stateCode"),
        "sourceQuality": source_quality,
        "source": "osm_footprint",
        "confidenceModifier": osm_result.get("confidenceModifier", 0),
        "buildingMatchQuality": osm_result.get("buildingMatchQuality", "low"),
        "candidateCount": osm_result.get("candidateCount", 0),
        "ambiguousBuildingMatch": osm_result.get("ambiguous", False),
        "geocodeMatchQuality": geo.get("matchQuality"),
        "geocodeRelevance": geo.get("relevance"),
        "geocodedAddress": geo.get("fullPlaceName"),
        "selectedBuilding": {
            "footprintSqFt": best.get("footprintSqFt"),
            "distanceMeters": best.get("distanceMeters"),
            "score": best.get("score"),
            "osmType": best.get("osmType"),
            "osmId": best.get("osmId")
        },
        "candidatePreview": [
            {
                "footprintSqFt": c.get("footprintSqFt"),
                "distanceMeters": c.get("distanceMeters"),
                "score": c.get("score"),
                "osmType": c.get("osmType"),
                "osmId": c.get("osmId")
            }
            for c in osm_result.get("viableCandidates", [])[:3]
        ]
    }


def ensure_data_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def read_quotes():
    ensure_data_file()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return []


def write_quotes(quotes):
    ensure_data_file()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(quotes, f, indent=2)


def get_roof_size_bucket(roof_size):
    try:
        size = float(roof_size)
    except Exception:
        return ""

    if size <= 0:
        return ""
    if size < 1500:
        return "0_1499"
    if size < 2000:
        return "1500_1999"
    if size < 2500:
        return "2000_2499"
    if size < 3000:
        return "2500_2999"
    return "3000_plus"

def median(values):
    if not values:
        return None
    values = sorted(values)
    n = len(values)
    mid = n // 2
    if n % 2 == 0:
        return (values[mid - 1] + values[mid]) / 2
    return values[mid]


def percentile(values, pct):
    if not values:
        return None
    values = sorted(values)
    idx = int((pct / 100) * (len(values) - 1))
    return values[idx]


def build_position_label(quote_price, mid):
    try:
        price = float(quote_price)
        midpoint = float(mid)
    except Exception:
        return "In line with most quotes analyzed"

    if midpoint <= 0:
        return "In line with most quotes analyzed"

    pct_diff = ((price - midpoint) / midpoint) * 100

    if pct_diff >= 15:
        return "Higher than most quotes analyzed"
    if pct_diff >= 8:
        return "Higher than many quotes analyzed"
    if pct_diff <= -15:
        return "Lower than most quotes analyzed"
    if pct_diff <= -8:
        return "Lower than many quotes analyzed"
    return "In line with most quotes analyzed"


class TruePriceHandler(SimpleHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/property-signals":
            content_length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(content_length)

            try:
                data = json.loads(raw.decode("utf-8"))
            except Exception:
                self._send_json({"success": False, "error": "Invalid JSON"}, status=400)
                return

            required_fields = ["street", "city", "stateCode"]
            missing = [field for field in required_fields if not str(data.get(field, "")).strip()]

            if missing:
                self._send_json(
                    {"success": False, "error": f"Missing required fields: {', '.join(missing)}"},
                    status=400
                )
                return

            key = normalize_property_address_key(data)

            try:
                provider_record = lookup_property_signals_from_provider(data)
            except Exception as e:
                provider_record = None

            if provider_record:
                normalized_provider_record = {
                    **provider_record,
                    "source": provider_record.get("source", "property_provider")
                }
                self._send_json({"success": True, "data": normalized_provider_record}, status=200)
                return

            mock_record = MOCK_PROPERTY_DB.get(key)
            if mock_record:
                self._send_json({"success": True, "data": mock_record}, status=200)
                return

            self._send_json({"success": False, "data": None}, status=200)
            return

        if parsed.path != "/api/community-quotes":
            self._send_json({"error": "Not found"}, status=404)
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length)

        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            self._send_json({"error": "Invalid JSON"}, status=400)
            return

        city = str(data.get("city", "")).strip()
        state_code = str(data.get("stateCode", "")).strip().upper()
        material = str(data.get("material", "")).strip().lower()

        try:
            roof_size = float(data.get("roofSize"))
            quote_price = float(data.get("quotePrice"))
            price_per_sq_ft = float(data.get("pricePerSqFt")) if data.get("pricePerSqFt") is not None else None
        except Exception:
            self._send_json({"error": "Invalid numeric values"}, status=400)
            return

        if not material or roof_size <= 0 or quote_price <= 0:
            self._send_json({"error": "Invalid quote payload"}, status=400)
            return

        # Input validation
        if material not in VALID_MATERIALS:
            self._send_json({"error": "Invalid material type"}, status=400)
            return
        if not (100 <= roof_size <= 50000):
            self._send_json({"error": "Roof size out of range"}, status=400)
            return
        if not (100 <= quote_price <= 500000):
            self._send_json({"error": "Quote price out of range"}, status=400)
            return
        if len(city) > 100 or len(state_code) > 5:
            self._send_json({"error": "Invalid location data"}, status=400)
            return

        with QUOTES_LOCK:
            quotes = read_quotes()
            quotes.append({
                "city": city,
                "stateCode": state_code,
                "material": material,
                "roofSize": roof_size,
                "roofSizeBucket": get_roof_size_bucket(roof_size),
                "quotePrice": quote_price,
                "pricePerSqFt": price_per_sq_ft,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            write_quotes(quotes)

        self._send_json({"ok": True})

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/community-quotes":
            params = parse_qs(parsed.query)

            city = str(params.get("city", [""])[0]).strip().lower()
            state_code = str(params.get("stateCode", [""])[0]).strip().upper()
            material = str(params.get("material", [""])[0]).strip().lower()
            roof_size_bucket = str(params.get("roofSizeBucket", [""])[0]).strip()
            quote_price = params.get("quotePrice", ["0"])[0]

            quotes = read_quotes()

            filtered = [
                q for q in quotes
                if q.get("material") == material
                and q.get("roofSizeBucket") == roof_size_bucket
                and str(q.get("city", "")).strip().lower() == city
                and str(q.get("stateCode", "")).strip().upper() == state_code
            ]

            if len(filtered) < 10:
                filtered = [
                    q for q in quotes
                    if q.get("material") == material
                    and q.get("roofSizeBucket") == roof_size_bucket
                    and str(q.get("stateCode", "")).strip().upper() == state_code
                ]

            if len(filtered) < 10:
                filtered = [
                    q for q in quotes
                    if q.get("material") == material
                    and q.get("roofSizeBucket") == roof_size_bucket
                ]

            if len(filtered) < 10:
                filtered = [
                    q for q in quotes
                    if q.get("material") == material
                ]

            prices = []
            for q in filtered:
                try:
                    p = float(q.get("quotePrice"))
                    if p > 0:
                        prices.append(p)
                except Exception:
                    pass

            if not prices:
                self._send_json({
                    "count": 0,
                    "low": None,
                    "mid": None,
                    "high": None,
                    "positionLabel": "Community comparison is still building"
                })
                return

            low = percentile(prices, 20)
            mid = median(prices)
            high = percentile(prices, 80)

            self._send_json({
                "count": len(prices),
                "low": low,
                "mid": mid,
                "high": high,
                "positionLabel": build_position_label(quote_price, mid)
            })
            return

        return super().do_GET()


if __name__ == "__main__":
    os.chdir(ROOT_DIR)
    port = 8000
    server = ThreadingHTTPServer(("0.0.0.0", port), TruePriceHandler)
    print(f"TruePrice server running at http://localhost:{port}")
    server.serve_forever()