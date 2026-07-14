"""
Sales Trend Analysis System — Flask Web Server
================================================
This is a thin Python layer over the C backend engine.
All data storage and analysis logic runs in C via ctypes.
"""

from flask import Flask, render_template, request, jsonify
import ctypes
import os
import sys

app = Flask(__name__)

# ── Load the compiled C engine ──────────────────────────────────────
lib_ext = '.dll' if os.name == 'nt' else '.so'
lib_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sales_engine{lib_ext}")

try:
    engine = ctypes.CDLL(lib_path)
except OSError:
    print("=" * 60)
    print(f"ERROR: C backend library ({os.path.basename(lib_path)}) not found!")
    print("Please compile the C code first. You can run `compile.bat` to do this.")
    print("=" * 60)
    sys.exit(1)

# ── Configure ctypes signatures ─────────────────────────────────────

# int getCount(void);
engine.getCount.argtypes = []
engine.getCount.restype = ctypes.c_int

# void getRecord(int index, char *product, int product_len, int *month, int *year, float *sales);
engine.getRecord.argtypes = [
    ctypes.c_int,
    ctypes.c_char_p, ctypes.c_int,
    ctypes.POINTER(ctypes.c_int),
    ctypes.POINTER(ctypes.c_int),
    ctypes.POINTER(ctypes.c_float)
]
engine.getRecord.restype = None

# int addRecord(const char *product, int month, int year, float sales);
engine.addRecord.argtypes = [ctypes.c_char_p, ctypes.c_int, ctypes.c_int, ctypes.c_float]
engine.addRecord.restype = ctypes.c_int

# int generateRandomData(int n);
engine.generateRandomData.argtypes = [ctypes.c_int]
engine.generateRandomData.restype = ctypes.c_int

# int productAnalysis(const char *name, float *total, float *average, float *maximum, float *minimum, int *found_count);
engine.productAnalysis.argtypes = [
    ctypes.c_char_p,
    ctypes.POINTER(ctypes.c_float), ctypes.POINTER(ctypes.c_float),
    ctypes.POINTER(ctypes.c_float), ctypes.POINTER(ctypes.c_float),
    ctypes.POINTER(ctypes.c_int)
]
engine.productAnalysis.restype = ctypes.c_int

# void monthlyTrend(const char *product, int year, float *monthSales, int *trends);
engine.monthlyTrend.argtypes = [
    ctypes.c_char_p, ctypes.c_int,
    ctypes.POINTER(ctypes.c_float), ctypes.POINTER(ctypes.c_int)
]
engine.monthlyTrend.restype = None

# void yearlyTrend(const char *product, float *yearlySales, int *trends);
engine.yearlyTrend.argtypes = [
    ctypes.c_char_p,
    ctypes.POINTER(ctypes.c_float), ctypes.POINTER(ctypes.c_int)
]
engine.yearlyTrend.restype = None

# void clearRecords(void);
engine.clearRecords.argtypes = []
engine.clearRecords.restype = None


# ── Helpers ─────────────────────────────────────────────────────────

def read_all_records():
    """Read all records from the C backend into Python dicts."""
    n = engine.getCount()
    result = []
    
    # Pre-allocate buffers for ctypes
    product_buf = ctypes.create_string_buffer(50)
    month = ctypes.c_int()
    year = ctypes.c_int()
    sales = ctypes.c_float()

    for i in range(n):
        engine.getRecord(i, product_buf, 50, ctypes.byref(month), ctypes.byref(year), ctypes.byref(sales))
        result.append({
            "product": product_buf.value.decode("utf-8"),
            "month":   month.value,
            "year":    year.value,
            "sales":   round(float(sales.value), 2),
        })
    return result


# ── Route: Serve the UI ─────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ── API: Add a single sales record (calls C addRecord) ──────────────
@app.route("/api/add", methods=["POST"])
def add_record():
    data = request.json
    rc = engine.addRecord(
        data["product"].encode("utf-8"),
        int(data["month"]),
        int(data["year"]),
        float(data["sales"]),
    )
    if rc != 0:
        return jsonify({"error": "Storage Full!"}), 400

    return jsonify({
        "message": "Record Added Successfully!",
        "count": engine.getCount(),
    })


# ── API: Generate random data (calls C generateRandomData) ──────────
@app.route("/api/generate", methods=["POST"])
def generate_random_data():
    n = int(request.json.get("count", 10))
    added = engine.generateRandomData(n)
    return jsonify({
        "message": f"{added} Random Records Generated!",
        "count": engine.getCount(),
    })


# ── API: View all records ───────────────────────────────────────────
@app.route("/api/records")
def view_records():
    records = read_all_records()
    return jsonify({"records": records, "count": len(records)})


# ── API: Product analysis (calls C productAnalysis) ─────────────────
@app.route("/api/analysis/product")
def product_analysis():
    name = request.args.get("name", "")

    total = ctypes.c_float()
    average = ctypes.c_float()
    maximum = ctypes.c_float()
    minimum = ctypes.c_float()
    found_count = ctypes.c_int()

    rc = engine.productAnalysis(
        name.encode("utf-8"),
        ctypes.byref(total), ctypes.byref(average),
        ctypes.byref(maximum), ctypes.byref(minimum),
        ctypes.byref(found_count)
    )

    if rc != 0:
        return jsonify({"error": "Product Not Found!"}), 404

    # Build a monthly breakdown for the chart (reading records)
    records = read_all_records()
    breakdown = {}
    for r in records:
        if r["product"] == name:
            key = f"{r['year']}-{r['month']:02d}"
            breakdown[key] = breakdown.get(key, 0) + r["sales"]

    return jsonify({
        "product":   name,
        "total":     round(float(total.value), 2),
        "average":   round(float(average.value), 2),
        "maximum":   round(float(maximum.value), 2),
        "minimum":   round(float(minimum.value), 2),
        "count":     found_count.value,
        "breakdown": breakdown,
    })


# ── API: Monthly trend (calls C monthlyTrend) ───────────────────────
@app.route("/api/analysis/monthly")
def monthly_trend():
    product = request.args.get("product", "")
    year = int(request.args.get("year", 2023))

    month_sales = (ctypes.c_float * 13)()
    trends = (ctypes.c_int * 13)()

    engine.monthlyTrend(product.encode("utf-8"), year, month_sales, trends)

    # Convert trend ints to direction strings
    trend_list = []
    for i in range(2, 13):
        if trends[i] == 1:
            direction = "Increasing"
        elif trends[i] == -1:
            direction = "Decreasing"
        else:
            direction = "Stable"
        trend_list.append({"month": i, "direction": direction})

    return jsonify({
        "product": product,
        "year":    year,
        "sales":   [round(float(month_sales[i]), 2) for i in range(1, 13)],
        "trends":  trend_list,
    })


# ── API: Yearly trend (calls C yearlyTrend) ─────────────────────────
@app.route("/api/analysis/yearly")
def yearly_trend():
    product = request.args.get("product", "")

    yearly_sales = (ctypes.c_float * 4)()
    trends = (ctypes.c_int * 3)()

    engine.yearlyTrend(product.encode("utf-8"), yearly_sales, trends)

    # Convert trend ints to direction strings
    trend_list = []
    for i in range(3):
        yr_from = 2023 + i
        yr_to = 2024 + i
        if trends[i] == 1:
            direction = "Increasing"
        elif trends[i] == -1:
            direction = "Decreasing"
        else:
            direction = "Stable"
        trend_list.append({"from": yr_from, "to": yr_to, "direction": direction})

    return jsonify({
        "product": product,
        "sales":   {
            "2023": round(float(yearly_sales[0]), 2),
            "2024": round(float(yearly_sales[1]), 2),
            "2025": round(float(yearly_sales[2]), 2),
            "2026": round(float(yearly_sales[3]), 2),
        },
        "trends": trend_list,
    })


# ── API: Get unique product names for dropdowns ─────────────────────
@app.route("/api/products")
def get_products():
    records = read_all_records()
    unique = sorted(set(r["product"] for r in records))
    return jsonify({"products": unique})


# ── API: Dashboard summary ──────────────────────────────────────────
@app.route("/api/dashboard")
def dashboard():
    records = read_all_records()

    if not records:
        return jsonify({
            "total_records":   0,
            "total_revenue":   0,
            "unique_products": 0,
            "avg_sale":        0,
            "by_product":      {},
            "by_year":         {},
        })

    total_revenue = sum(r["sales"] for r in records)
    unique_products = set(r["product"] for r in records)

    by_product = {}
    for r in records:
        by_product[r["product"]] = by_product.get(r["product"], 0) + r["sales"]

    by_year = {}
    for r in records:
        yr = str(r["year"])
        by_year[yr] = by_year.get(yr, 0) + r["sales"]

    return jsonify({
        "total_records":   len(records),
        "total_revenue":   round(total_revenue, 2),
        "unique_products": len(unique_products),
        "avg_sale":        round(total_revenue / len(records), 2),
        "by_product":      {k: round(v, 2) for k, v in by_product.items()},
        "by_year":         {k: round(v, 2) for k, v in sorted(by_year.items())},
    })


# ── API: Clear all records (calls C clearRecords) ───────────────────
@app.route("/api/clear", methods=["POST"])
def clear_records():
    engine.clearRecords()
    return jsonify({"message": "All records cleared!", "count": 0})


if __name__ == "__main__":
    print("C backend loaded via ctypes successfully!")
    app.run(debug=True, port=5000)
