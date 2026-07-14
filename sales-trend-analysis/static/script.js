/* ═══════════════════════════════════════════════════════════════════
   Sales Trend Analysis System — Frontend Logic
   ═══════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_FULL = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const PALETTE = [
    '#6366f1', '#a855f7', '#06b6d4', '#22c55e', '#f59e0b',
    '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'
];

// Chart.js global defaults
Chart.defaults.color = '#7d8590';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter', sans-serif";

// ── Utility ────────────────────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function fmt(n) {
    return '$' + Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

let toastTimer;
function showToast(msg, type = 'success') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

async function api(path, opts = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    return res.json();
}

// ── Chart instances (destroy before re-creating) ───────────────────
let chartProductPie = null;
let chartYearlyBar = null;
let chartPA = null;
let chartMT = null;
let chartYT = null;

function destroyChart(ref) { if (ref) ref.destroy(); return null; }

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
function navigateTo(page) {
    $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
    $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));

    // Load page-specific data
    if (page === 'dashboard')         loadDashboard();
    if (page === 'view-records')      loadRecords();
    if (page === 'product-analysis')  populateProductDropdown('pa-product');
    if (page === 'monthly-trend')     populateProductDropdown('mt-product');
    if (page === 'yearly-trend')      populateProductDropdown('yt-product');
}

$$('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
async function loadDashboard() {
    const d = await api('/api/dashboard');

    $('#val-records').textContent   = d.total_records;
    $('#val-revenue').textContent   = fmt(d.total_revenue);
    $('#val-products').textContent  = d.unique_products;
    $('#val-avg').textContent       = fmt(d.avg_sale);

    const hasData = d.total_records > 0;
    $('#dashboard-empty').classList.toggle('hidden', hasData);
    $$('#page-dashboard .stats-grid, #page-dashboard .charts-row').forEach(el =>
        el.classList.toggle('hidden', !hasData)
    );

    if (!hasData) return;

    // Product Pie
    const productLabels = Object.keys(d.by_product);
    const productValues = Object.values(d.by_product);

    chartProductPie = destroyChart(chartProductPie);
    chartProductPie = new Chart($('#chart-product-pie'), {
        type: 'doughnut',
        data: {
            labels: productLabels,
            datasets: [{
                data: productValues,
                backgroundColor: PALETTE.slice(0, productLabels.length),
                borderWidth: 0,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw)}` }
                }
            }
        }
    });

    // Yearly Bar
    const yearLabels = Object.keys(d.by_year);
    const yearValues = Object.values(d.by_year);

    chartYearlyBar = destroyChart(chartYearlyBar);
    chartYearlyBar = new Chart($('#chart-yearly-bar'), {
        type: 'bar',
        data: {
            labels: yearLabels,
            datasets: [{
                label: 'Revenue',
                data: yearValues,
                backgroundColor: yearLabels.map((_, i) => PALETTE[i % PALETTE.length]),
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.55,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { callback: v => '$' + (v / 1000).toFixed(0) + 'k' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// ADD RECORD
// ═══════════════════════════════════════════════════════════════════
$('#form-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        product: $('#input-product').value.trim(),
        month:   $('#input-month').value,
        year:    $('#input-year').value,
        sales:   $('#input-sales').value,
    };
    const res = await api('/api/add', { method: 'POST', body: JSON.stringify(body) });
    if (res.error) return showToast(res.error, 'error');
    showToast(res.message);
    $('#form-add').reset();
});

// ═══════════════════════════════════════════════════════════════════
// GENERATE DATA
// ═══════════════════════════════════════════════════════════════════
$('#form-generate').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = $('#input-count').value;
    const res = await api('/api/generate', { method: 'POST', body: JSON.stringify({ count: n }) });
    if (res.error) return showToast(res.error, 'error');
    showToast(res.message);
});

// ═══════════════════════════════════════════════════════════════════
// VIEW RECORDS
// ═══════════════════════════════════════════════════════════════════
let allRecords = [];

async function loadRecords() {
    const res = await api('/api/records');
    allRecords = res.records;
    renderTable(allRecords);
}

function renderTable(data) {
    const tbody = $('#records-tbody');
    const empty = $('#table-empty');
    const label = $('#record-count-label');

    label.textContent = `${data.length} record${data.length !== 1 ? 's' : ''}`;

    if (data.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = data.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.product)}</td>
            <td>${MONTH_FULL[r.month]}</td>
            <td>${r.year}</td>
            <td>${fmt(r.sales)}</td>
        </tr>
    `).join('');
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

$('#table-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    if (!q) return renderTable(allRecords);
    const filtered = allRecords.filter(r =>
        r.product.toLowerCase().includes(q) ||
        String(r.year).includes(q) ||
        MONTH_FULL[r.month].toLowerCase().includes(q)
    );
    renderTable(filtered);
});

// ═══════════════════════════════════════════════════════════════════
// PRODUCT DROPDOWNS
// ═══════════════════════════════════════════════════════════════════
async function populateProductDropdown(id) {
    const res = await api('/api/products');
    const sel = $(`#${id}`);
    const current = sel.value;
    sel.innerHTML = '<option value="">Select product…</option>' +
        res.products.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    if (current && res.products.includes(current)) sel.value = current;
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCT ANALYSIS
// ═══════════════════════════════════════════════════════════════════
$('#btn-pa-analyze').addEventListener('click', async () => {
    const name = $('#pa-product').value;
    if (!name) return showToast('Select a product first', 'error');

    const res = await api(`/api/analysis/product?name=${encodeURIComponent(name)}`);
    if (res.error) return showToast(res.error, 'error');

    $('#pa-results').classList.remove('hidden');
    $('#pa-total').textContent = fmt(res.total);
    $('#pa-avg').textContent   = fmt(res.average);
    $('#pa-max').textContent   = fmt(res.maximum);
    $('#pa-min').textContent   = fmt(res.minimum);
    $('#pa-chart-title').textContent = `${name} — Sales Breakdown`;

    // Build chart from breakdown
    const keys = Object.keys(res.breakdown).sort();
    const vals = keys.map(k => res.breakdown[k]);

    chartPA = destroyChart(chartPA);
    chartPA = new Chart($('#chart-pa'), {
        type: 'bar',
        data: {
            labels: keys,
            datasets: [{
                label: 'Sales',
                data: vals,
                backgroundColor: 'rgba(99,102,241,0.6)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { callback: v => '$' + (v / 1000).toFixed(1) + 'k' }
                },
                x: { grid: { display: false }, ticks: { maxRotation: 45 } }
            }
        }
    });
});

// ═══════════════════════════════════════════════════════════════════
// MONTHLY TREND
// ═══════════════════════════════════════════════════════════════════
$('#btn-mt-analyze').addEventListener('click', async () => {
    const product = $('#mt-product').value;
    const year    = $('#mt-year').value;
    if (!product) return showToast('Select a product first', 'error');

    const res = await api(`/api/analysis/monthly?product=${encodeURIComponent(product)}&year=${year}`);

    $('#mt-results').classList.remove('hidden');
    $('#mt-chart-title').textContent = `${product} — Monthly Sales (${year})`;

    chartMT = destroyChart(chartMT);
    chartMT = new Chart($('#chart-mt'), {
        type: 'line',
        data: {
            labels: MONTH_NAMES.slice(1),
            datasets: [{
                label: 'Sales',
                data: res.sales,
                fill: true,
                backgroundColor: 'rgba(99,102,241,0.12)',
                borderColor: '#6366f1',
                borderWidth: 2.5,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                tension: 0.35,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { callback: v => '$' + (v / 1000).toFixed(1) + 'k' }
                },
                x: { grid: { display: false } }
            }
        }
    });

    // Trend badges
    const badges = $('#mt-trend-badges');
    badges.className = 'trend-badges';
    badges.innerHTML = res.trends.map(t => {
        const cls = t.direction === 'Increasing' ? 'up' : t.direction === 'Decreasing' ? 'down' : 'flat';
        const arrow = cls === 'up' ? '↑' : cls === 'down' ? '↓' : '→';
        return `<span class="trend-badge ${cls}">
            ${MONTH_NAMES[t.month - 1]} → ${MONTH_NAMES[t.month]} ${arrow} ${t.direction}
        </span>`;
    }).join('');
});

// ═══════════════════════════════════════════════════════════════════
// YEARLY TREND
// ═══════════════════════════════════════════════════════════════════
$('#btn-yt-analyze').addEventListener('click', async () => {
    const product = $('#yt-product').value;
    if (!product) return showToast('Select a product first', 'error');

    const res = await api(`/api/analysis/yearly?product=${encodeURIComponent(product)}`);

    $('#yt-results').classList.remove('hidden');
    $('#yt-chart-title').textContent = `${product} — Yearly Sales`;

    const years = Object.keys(res.sales);
    const vals  = Object.values(res.sales);

    chartYT = destroyChart(chartYT);
    chartYT = new Chart($('#chart-yt'), {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Sales',
                data: vals,
                backgroundColor: years.map((_, i) => [
                    'rgba(99,102,241,0.7)',
                    'rgba(168,85,247,0.7)',
                    'rgba(6,182,212,0.7)',
                    'rgba(34,197,94,0.7)'
                ][i]),
                borderRadius: 8,
                borderSkipped: false,
                barPercentage: 0.5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { callback: v => '$' + (v / 1000).toFixed(0) + 'k' }
                },
                x: { grid: { display: false } }
            }
        }
    });

    // Trend badges
    const badges = $('#yt-trend-badges');
    badges.className = 'trend-badges';
    badges.innerHTML = res.trends.map(t => {
        const cls = t.direction === 'Increasing' ? 'up' : t.direction === 'Decreasing' ? 'down' : 'flat';
        const arrow = cls === 'up' ? '↑' : cls === 'down' ? '↓' : '→';
        return `<span class="trend-badge ${cls}">
            ${t.from} → ${t.to} ${arrow} ${t.direction}
        </span>`;
    }).join('');
});

// ═══════════════════════════════════════════════════════════════════
// CLEAR ALL
// ═══════════════════════════════════════════════════════════════════
$('#btn-clear-all').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete ALL records?')) return;
    const res = await api('/api/clear', { method: 'POST' });
    showToast(res.message, 'info');
    loadDashboard();
});

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
loadDashboard();
