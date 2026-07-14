/*
 * Sales Trend Analysis System — C Backend Engine
 * ================================================
 * This is the ORIGINAL C logic preserved as the backend.
 * Compiled as a shared library and called from Python via cffi.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_RECORDS 1000

struct Sale {
    char product[50];
    int month;
    int year;
    float sales;
};

/* ── Global State ──────────────────────────────────────────────── */
static struct Sale records[MAX_RECORDS];
static int count = 0;
static int rng_seeded = 0;

/* ── Getters for Python ────────────────────────────────────────── */

int getCount(void) {
    return count;
}

void getRecord(int index,
               char *product, int product_len,
               int *month, int *year, float *sales)
{
    if (index < 0 || index >= count) return;

    strncpy(product, records[index].product, product_len - 1);
    product[product_len - 1] = '\0';

    *month = records[index].month;
    *year  = records[index].year;
    *sales = records[index].sales;
}

/* ── Add Record (mirrors original addRecord) ───────────────────── */

int addRecord(const char *product, int month, int year, float sales) {
    if (count >= MAX_RECORDS) {
        return -1;  /* Storage Full */
    }

    strncpy(records[count].product, product, 49);
    records[count].product[49] = '\0';
    records[count].month = month;
    records[count].year  = year;
    records[count].sales = sales;

    count++;
    return 0;  /* Success */
}

/* ── Generate Random Data (mirrors original generateRandomData) ── */

int generateRandomData(int n) {
    char products[][20] = {
        "Laptop",
        "Mobile",
        "Keyboard",
        "Mouse",
        "Monitor"
    };

    if (!rng_seeded) {
        srand((unsigned int)time(NULL));
        rng_seeded = 1;
    }

    int added = 0;

    for (int i = 0; i < n && count < MAX_RECORDS; i++) {
        strcpy(records[count].product,
               products[rand() % 5]);

        records[count].month = rand() % 12 + 1;
        records[count].year  = 2023 + rand() % 4;
        records[count].sales = 1000 + rand() % 9000;

        count++;
        added++;
    }

    return added;
}

/* ── Product Analysis (mirrors original productAnalysis) ────────── */

int productAnalysis(const char *name,
                    float *total, float *average,
                    float *maximum, float *minimum,
                    int *found_count)
{
    float tot = 0;
    float max = -1;
    float min = 999999;
    int found = 0;

    for (int i = 0; i < count; i++) {
        if (strcmp(records[i].product, name) == 0) {

            found++;

            tot += records[i].sales;

            if (records[i].sales > max)
                max = records[i].sales;

            if (records[i].sales < min)
                min = records[i].sales;
        }
    }

    if (found == 0) {
        return -1;  /* Product Not Found */
    }

    *total       = tot;
    *average     = tot / found;
    *maximum     = max;
    *minimum     = min;
    *found_count = found;

    return 0;
}

/* ── Monthly Trend (mirrors original monthlyTrend) ──────────────── */

void monthlyTrend(const char *product, int year,
                  float *monthSales,  /* float[13], index 1-12 */
                  int *trends)        /* int[13], index 2-12:
                                         1=Increasing, -1=Decreasing, 0=Stable */
{
    /* Zero out */
    for (int i = 0; i < 13; i++) {
        monthSales[i] = 0;
        trends[i] = 0;
    }

    for (int i = 0; i < count; i++) {
        if (strcmp(records[i].product, product) == 0
            && records[i].year == year) {

            monthSales[records[i].month] +=
                records[i].sales;
        }
    }

    /* Trend Analysis — same logic as original */
    for (int i = 2; i <= 12; i++) {

        if (monthSales[i] > monthSales[i - 1])
            trends[i] = 1;   /* Increasing */

        else if (monthSales[i] < monthSales[i - 1])
            trends[i] = -1;  /* Decreasing */

        else
            trends[i] = 0;   /* Stable */
    }
}

/* ── Yearly Trend (mirrors original yearlyTrend) ────────────────── */

void yearlyTrend(const char *product,
                 float *yearlySales, /* float[4]: [2023,2024,2025,2026] */
                 int *trends)        /* int[3]: transitions between years */
{
    float sales2023 = 0;
    float sales2024 = 0;
    float sales2025 = 0;
    float sales2026 = 0;

    for (int i = 0; i < count; i++) {

        if (strcmp(records[i].product, product) == 0) {

            if (records[i].year == 2023)
                sales2023 += records[i].sales;

            else if (records[i].year == 2024)
                sales2024 += records[i].sales;

            else if (records[i].year == 2025)
                sales2025 += records[i].sales;

            else if (records[i].year == 2026)
                sales2026 += records[i].sales;
        }
    }

    yearlySales[0] = sales2023;
    yearlySales[1] = sales2024;
    yearlySales[2] = sales2025;
    yearlySales[3] = sales2026;

    float years[4] = {
        sales2023,
        sales2024,
        sales2025,
        sales2026
    };

    for (int i = 1; i < 4; i++) {

        if (years[i] > years[i - 1])
            trends[i - 1] = 1;   /* Increasing */

        else if (years[i] < years[i - 1])
            trends[i - 1] = -1;  /* Decreasing */

        else
            trends[i - 1] = 0;   /* Stable */
    }
}

/* ── Clear Records ──────────────────────────────────────────────── */

void clearRecords(void) {
    count = 0;
}
