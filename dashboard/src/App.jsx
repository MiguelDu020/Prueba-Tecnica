import { useMemo } from "react";
import rappiLogo from "./assets/logo/rappi-logo.svg";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import "./App.css";

// ── Modular imports ──────────────────────────────────────────────────────
import useStoreData from "./hooks/useStoreData.js";
import { fmtNum, fmtPct, fmtDate, fmtDuration } from "./utils/analytics.js";
import {
  COLORS,
  LINE_OPTIONS,
  BAR_OPTIONS,
  HOUR_OPTIONS,
  DONUT_OPTIONS,
  VOLATILITY_OPTIONS,
} from "./utils/chartConfig.js";
import MetricCard from "./components/MetricCard.jsx";
import UptimeBar from "./components/UptimeBar.jsx";
import SLAGauge from "./components/SLAGauge.jsx";
import Chatbot from "./components/Chatbot.jsx";
import OpportunityChart from "./components/OpportunityChart.jsx";

// ── Chart.js registration ────────────────────────────────────────────────
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ═════════════════════════════════════════════════════════════════════════
// Main App Component
// ═════════════════════════════════════════════════════════════════════════
export default function App() {
  const data = useStoreData();
  const {
    loading,
    error,
    filtered,
    kpis,
    chartBuckets,
    hourlyAvgs,
    gapRanking,
    volatilityBuckets,
    microDrops,
    microDropsByHour,
    tableRows,
    // Filters
    storeFilter, setStoreFilter,
    statusFilter, setStatusFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    storeNames,
    applyFilters,
    clearFilters,
  } = data;

  // ── Build chart datasets ──────────────────────────────────────────────

  // 1. Availability Over Time
  const lineData = useMemo(() => ({
    labels: chartBuckets.map((b) => b.label),
    datasets: [
      {
        label: "Stores Visibles (promedio)",
        data: chartBuckets.map((b) => Math.round(b.avg)),
        borderColor: COLORS.green,
        backgroundColor: "rgba(41,216,132,0.08)",
        borderWidth: 2, tension: 0.4, fill: true,
        pointBackgroundColor: COLORS.green, pointRadius: 2, pointHoverRadius: 5,
      },
      {
        label: "Gap vs Máximo",
        data: chartBuckets.map((b) => Math.round(kpis.maxStores - b.avg)),
        borderColor: COLORS.red,
        backgroundColor: "rgba(255,66,57,0.06)",
        borderWidth: 2, tension: 0.4, fill: true,
        pointBackgroundColor: COLORS.red, pointRadius: 2, pointHoverRadius: 5,
      },
    ],
  }), [chartBuckets, kpis.maxStores]);

  // 2. Status Distribution (Donut)
  const donutData = {
    labels: ["Capacidad Activa", "Pérdida de Oferta"],
    datasets: [{
      data: [
        parseFloat(kpis.avgUptime.toFixed(1)),
        parseFloat((100 - kpis.avgUptime).toFixed(1)),
      ],
      backgroundColor: [COLORS.green, COLORS.red],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  // 3. Volatility Chart (Network micro-drops)
  const volatilityChartData = useMemo(() => ({
    labels: volatilityBuckets.map((b) => b.label),
    datasets: [{
      label: "Δ Stores",
      data: volatilityBuckets.map((b) => b.value),
      backgroundColor: (ctx) => {
        const v = ctx.parsed?.y ?? 0;
        return v >= 0 ? "rgba(41,216,132,0.5)" : "rgba(255,66,57,0.6)";
      },
      borderRadius: 4, borderSkipped: false,
    }],
  }), [volatilityBuckets]);

  // 4. Hourly Pattern
  const hourData = useMemo(() => ({
    labels: hourlyAvgs.map((_, i) => `${i}h`),
    datasets: [{
      label: "Avg stores visible",
      data: hourlyAvgs.map((v) => Math.round(v)),
      backgroundColor: "rgba(15,55,73,0.12)",
      borderColor: COLORS.primary,
      borderWidth: 1, borderRadius: 5, borderSkipped: false,
    }],
  }), [hourlyAvgs]);

  // ── Export CSV ─────────────────────────────────────────────────────────
  const exportCSV = () => {
    const csvData = tableRows.map((r) =>
      [r.id, r.name, r.status, r.uptime + "%", r.changes, r.last].join(",")
    );
    const blob = new Blob(
      [["Store ID,Name,Status,Uptime,Value,Last Event", ...csvData].join("\n")],
      { type: "text/csv" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rappi_systemic_health_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };


  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="app">
      {/* ── HEADER ── */}
      <header className="header" id="dashboard-header">
        <div className="header-left">
          <img src={rappiLogo} alt="Rappi" className="logo-rappi" />
          <div className="header-divider" />
          <div className="header-title-group">
            <h1>Prueba Técnica Rappi</h1>
          </div>
        </div>
        <div className="header-right">
          <div className="live-badge">
            <div className="pulse-dot" />
            Live
          </div>
          <div className="date-badge">
            {loading ? "Loading…" : `${filtered.length.toLocaleString()} records`}
          </div>
          {error && (
            <div className="date-badge" style={{ color: COLORS.red, borderColor: COLORS.red }}>
              ⚠ Error
            </div>
          )}
        </div>
      </header>

      {/* ── FILTERS ── */}
      <div className="filters-bar" id="dashboard-filters">
        <span className="filter-label">Filters</span>
        <select className="filter-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="all">All sources</option>
          {storeNames.filter((s) => s !== "all").map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="online">Online (≥80% capacity)</option>
          <option value="offline">Degraded (&lt;80%)</option>
        </select>
        <input type="date" className="filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button className="filter-btn" onClick={applyFilters}>Apply</button>
        <button className="filter-btn-clear" onClick={clearFilters}>Clear</button>
        {loading && (
          <span style={{ color: COLORS.accent, fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
            ⟳ Loading data…
          </span>
        )}
      </div>

      {/* ── MAIN ── */}
      <main className="main">

        {/* ── BUSINESS METRICS (SLA, Volatility, Recovery, Capacity) ── */}
        <div className="metrics-grid" id="metrics-grid">
          <MetricCard
            cardClass="metric-card-1"
            label="Índice de Capacidad"
            value={fmtPct(kpis.capacityIndex)}
            change={`${fmtNum(kpis.latestValue)} / ${fmtNum(kpis.maxStores)} stores`}
            changeClass={kpis.slaStatus.level === "ok" ? "up" : "down"}
            indicator="indicator-green"
          />
          <MetricCard
            cardClass="metric-card-2"
            label="Volatilidad de Red"
            value={fmtNum(kpis.volScore)}
            change={`${kpis.microDropCount} micro-drops detectados`}
            changeClass={kpis.volScore > 200 ? "down" : "neutral"}
            indicator="indicator-purple"
          />
          <MetricCard
            cardClass="metric-card-3"
            label="Tiempo de Resiliencia"
            value={fmtDuration(kpis.avgRecovery)}
            change={`${kpis.recoveryCount} recovery events`}
            changeClass="up"
            indicator="indicator-orange"
          />
          <MetricCard
            cardClass="metric-card-4"
            label="Eventos Totales"
            value={fmtNum(kpis.totalEvents)}
            change={`Uptime: ${fmtPct(kpis.avgUptime)}`}
            changeClass="neutral"
            indicator="indicator-red"
          />
        </div>

        {/* ── SLA GAUGE + DONUT (Business Intelligence Row) ── */}
        <div className="charts-grid" id="sla-charts">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Capacidad Operativa en Tiempo Real</div>
                <div className="chart-subtitle">Stores visibles vs gap al máximo histórico</div>
              </div>
              <div className="legend-row">
                <div className="legend-item">
                  <div className="legend-dot" style={{ background: COLORS.green }} />
                  Stores Visibles
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{ background: COLORS.red }} />
                  Gap vs Máximo
                </div>
              </div>
            </div>
            <div className="chart-container">
              <Line data={lineData} options={LINE_OPTIONS} />
            </div>
          </div>

          <SLAGauge
            capacityIndex={kpis.capacityIndex}
            slaStatus={kpis.slaStatus}
            latestValue={kpis.latestValue}
            maxValue={kpis.maxStores}
          />
        </div>

        {/* ── VOLATILITY + RECOVERY (Infrastructure Row) ── */}
        <div className="charts-grid-bottom" id="infra-charts">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Volatilidad de Red (Micro-caídas)</div>
                <div className="chart-subtitle">Cambios bruscos entre intervalos de 10s</div>
              </div>
              <span className={`chart-tag ${kpis.volScore > 200 ? "chart-tag-warning" : ""}`}>
                {kpis.volScore > 200 ? "⚠ Inestable" : "✓ Estable"}
              </span>
            </div>
            <div className="chart-container">
              <Bar data={volatilityChartData} options={VOLATILITY_OPTIONS} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Distribución por Hora del Día</div>
                <div className="chart-subtitle">Promedio de stores visibles por hora</div>
              </div>
              <span className="chart-tag">Patrón</span>
            </div>
            <div className="chart-container">
              <Bar data={hourData} options={HOUR_OPTIONS} />
            </div>
          </div>
        </div>

        {/* ── DONUT + TOP GAPS (Operational Row) ── */}
        <div className="charts-grid-bottom" id="ops-charts">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Distribución de Capacidad</div>
                <div className="chart-subtitle">Proporción global operativa</div>
              </div>
            </div>
            <div className="chart-container-sm" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Doughnut data={donutData} options={DONUT_OPTIONS} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 14 }}>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: COLORS.green }} />
                Capacidad — {kpis.avgUptime.toFixed(1)}%
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: COLORS.red }} />
                Pérdida — {(100 - kpis.avgUptime).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Ventana de Oportunidad vs. Impacto de Inestabilidad</div>
                <div className="chart-subtitle">Capacidad protegida · Oportunidad perdida · Índice de inestabilidad por hora</div>
              </div>
              <span className="chart-tag chart-tag-warning">Negocio</span>
            </div>
            <OpportunityChart
              hourlyAvgs={hourlyAvgs}
              maxStores={kpis.maxStores}
              microDropsByHour={microDropsByHour}
            />
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="table-card" id="activity-table">
          <div className="table-top-row">
            <div>
              <div className="chart-title">Detalle de Actividad del Sistema</div>
              <div className="chart-subtitle">Últimas lecturas de capacidad operativa</div>
            </div>
            <button className="filter-btn" style={{ fontSize: 12, padding: "7px 14px" }} onClick={exportCSV}>
              Export CSV
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Metric / Source</th>
                <th>Status</th>
                <th>Capacidad</th>
                <th>Stores Value</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i}>
                  <td><span className="store-id">{row.id}</span></td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`status-badge status-${row.status}`}>
                      {row.status === "online" ? "Operativo" : "Degradado"}
                    </span>
                  </td>
                  <td><UptimeBar pct={row.uptime} /></td>
                  <td>{typeof row.changes === "number" ? fmtNum(row.changes) : row.changes}</td>
                  <td>{fmtDate(row.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>

      {/* ── CHATBOT (AI Consultant via n8n) ── */}
      <Chatbot />
    </div>
  );
}
