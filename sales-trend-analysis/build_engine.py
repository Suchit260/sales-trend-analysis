"""
build_engine.py — Compiles sales_engine.c into a Python-callable extension via cffi.
Run this once: `python build_engine.py`
It produces _sales_engine.pyd (Windows) that app.py imports.
"""

import cffi
import os

ffi = cffi.FFI()

# ── Declare the C interface (what Python can call) ──────────────────
ffi.cdef("""
    int getCount(void);

    void getRecord(int index,
                   char *product, int product_len,
                   int *month, int *year, float *sales);

    int addRecord(const char *product, int month, int year, float sales);

    int generateRandomData(int n);

    int productAnalysis(const char *name,
                        float *total, float *average,
                        float *maximum, float *minimum,
                        int *found_count);

    void monthlyTrend(const char *product, int year,
                      float *monthSales,
                      int *trends);

    void yearlyTrend(const char *product,
                     float *yearlySales,
                     int *trends);

    void clearRecords(void);
""")

# ── Read the C source ──────────────────────────────────────────────
c_dir = os.path.dirname(os.path.abspath(__file__))
c_source_path = os.path.join(c_dir, "sales_engine.c")

with open(c_source_path, "r") as f:
    c_source = f.read()

# ── Compile ────────────────────────────────────────────────────────
ffi.set_source("_sales_engine", c_source)

if __name__ == "__main__":
    ffi.compile(verbose=True)
    print("\n✅ C backend compiled successfully!")
