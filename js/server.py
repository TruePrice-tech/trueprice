import json
import os
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "community-quotes.json")

MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN", "")

def normalize_property_address_key(payload):
    street = str(payload.get("street", "")).strip().lower()
    city = str(payload.get("city", "")).strip().lower()
    state_code = str(payload.get("stateCode", "")).strip().upper()
    zip_code = str(payload.get("zip", "")).strip()
    return f"{street}|{city}|{state_code}|{zip_code}"


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
        self.end_headers()
        self.wfile.write(body)

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

            key = normalize_property_address_key(data)
            record = MOCK_PROPERTY_DB.get(key)

            if not record:
                self._send_json({"success": False, "data": None}, status=200)
                return

            self._send_json({"success": True, "data": record}, status=200)
            return

        if parsed.path != "/api/community-quotes":
            self._send_json({"error": "Not found"}, status=404)
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