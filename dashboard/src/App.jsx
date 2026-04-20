import { useEffect, useMemo, useRef, useState } from "react";
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
import Papa from "papaparse";
import "./App.css";

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

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtNum(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return new Intl.NumberFormat("en-US").format(Math.round(v));
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? "-" : d.toLocaleString("es-CO");
}
function timeSince(v) {
  if (!v) return "-";
  const diff = (Date.now() - new Date(v)) / 60000;
  if (diff < 2) return "Just now";
  if (diff < 60) return `${Math.round(diff)} min ago`;
  return `${Math.round(diff / 60)} hour(s) ago`;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#0f3749",
  titleFont: { size: 11, weight: "600" },
  bodyFont: { size: 11 },
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
};

// ─── static demo data ──────────────────────────────────────────────────────
const DEMO_STORES = [
  { id: "#12345", name: "McDonald's Chapinero", status: "online", uptime: 97, changes: 234, last: "2 min ago" },
  { id: "#67890", name: "KFC Usaquén",          status: "offline", uptime: 72, changes: 456, last: "45 min ago" },
  { id: "#11223", name: "Subway Zona Rosa",      status: "online",  uptime: 89, changes: 189, last: "1 hour ago" },
  { id: "#44556", name: "Domino's Suba",         status: "online",  uptime: 95, changes: 312, last: "3 min ago" },
  { id: "#77889", name: "Pizza Hut Kennedy",     status: "offline", uptime: 61, changes: 578, last: "2 hours ago" },
];

// ─── sub-components ─────────────────────────────────────────────────────────
function MetricCard({ label, value, change, changeClass, indicator, cardClass }) {
  return (
    <div className={`metric-card ${cardClass}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <div className={`metric-indicator ${indicator}`} />
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-change ${changeClass}`}>{change}</div>
    </div>
  );
}

function UptimeBar({ pct }) {
  const low = pct < 80;
  return (
    <div className="uptime-bar">
      <div className="uptime-track">
        <div
          className={`uptime-fill${low ? " uptime-fill-low" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="uptime-text">{pct}%</span>
    </div>
  );
}

// ─── Chatbot ─────────────────────────────────────────────────────────────────
const RESPONSES = {
  offline: "Currently <strong>23 stores are offline</strong>. The most critical are #77889 (offline for 2h) and #67890 (offline for 45 min). Would you like details on a specific store?",
  uptime: "Average uptime today is <strong>94.5%</strong>, up +1.2% vs last month. Best performing store is #12345 at 97% uptime.",
  downtime: "Store <strong>#77889</strong> has the most accumulated downtime: 48 hours (61% uptime). Followed by #67890 with 36 hours.",
  default: "Based on current data: <strong>1,234 stores online</strong>, <strong>23 offline</strong>, average uptime <strong>94.5%</strong>. What would you like to drill into?",
};

function getReply(text) {
  const l = text.toLowerCase();
  if (l.includes("offline")) return RESPONSES.offline;
  if (l.includes("uptime") || l.includes("availability")) return RESPONSES.uptime;
  if (l.includes("downtime") || l.includes("worst") || l.includes("most")) return RESPONSES.downtime;
  return RESPONSES.default;
}

function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hello! I'm your Rappi data assistant. Ask me anything about store availability, uptime or recent events.", time: "Now" },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const msgEnd = useRef(null);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const nowTime = () => new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });

  async function send(text) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text, time: nowTime() }]);
    setInput("");
    setTyping(true);
    await new Promise((r) => setTimeout(r, 1100));
    setTyping(false);
    setMessages((m) => [...m, { role: "bot", text: getReply(text), time: nowTime() }]);
  }

  const chatIcon = (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="chat-icon-svg">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
    </svg>
  );
  const closeIcon = (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="chat-icon-svg">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
  const sendIcon = (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="white" />
    </svg>
  );

  return (
    <>
      <button className="chatbot-toggle" onClick={() => setOpen((o) => !o)} id="chatToggle">
        {open ? closeIcon : chatIcon}
        {!open && <div className="notif-dot" />}
      </button>

      <div className={`chatbot-window${open ? " open" : ""}`} id="chatWindow">
        <div className="chatbot-header">
          <div className="chatbot-avatar">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white" />
            </svg>
          </div>
          <div className="chatbot-info">
            <h3>Rappi Assistant</h3>
            <p><span className="chatbot-online-dot" />Online · Instant response</p>
          </div>
          <button className="chatbot-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="chatbot-messages" id="chatMessages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <div className={`msg-avatar ${m.role === "bot" ? "msg-avatar-bot" : "msg-avatar-user"}`}>
                {m.role === "bot" ? "R" : "U"}
              </div>
              <div className="msg-content">
                <div className="message-bubble" dangerouslySetInnerHTML={{ __html: m.text }} />
                <div className="message-time">{m.time}</div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="message bot">
              <div className="msg-avatar msg-avatar-bot">R</div>
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={msgEnd} />
        </div>

        <div className="quick-replies">
          {[
            ["Offline now", "How many stores are offline?"],
            ["Most downtime", "Which store has the most downtime?"],
            ["Avg uptime", "Average uptime today"],
          ].map(([label, q]) => (
            <button key={label} className="quick-reply-btn" onClick={() => send(q)}>{label}</button>
          ))}
        </div>

        <div className="chatbot-input-area">
          <input
            type="text"
            className="chatbot-input"
            id="chatInput"
            placeholder="Ask about store data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
          />
          <button className="chatbot-send" onClick={() => send(input)}>
            {sendIcon}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("2026-02-01");
  const [dateTo, setDateTo] = useState("2026-03-31");
  const [applied, setApplied] = useState({ store: "all", status: "all", from: "2026-02-01", to: "2026-03-31" });

  // Load CSV – columns: timestamp, value, source_file, metric
  useEffect(() => {
    setLoading(true);
    fetch("/cleaned_long_format.csv")
      .then((r) => r.text())
      .then((text) => {
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const cleaned = parsed.data
          .map((r) => ({
            timestamp: r["timestamp"] || r["timestamp_raw"] || "",
            metric: r["metric"] || r["metric (sf_metric)"] || "",
            source_file: r["source_file"] || "",
            value: Number(r["value"] ?? r["value_raw"] ?? 0),
          }))
          .filter((r) => r.timestamp && !isNaN(new Date(r.timestamp)) && !isNaN(r.value))
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setRows(cleaned);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  // Derived metrics from CSV or demo
  const storeNames = useMemo(() => {
    const s = new Set(rows.map((r) => r.source_file).filter(Boolean));
    return ["all", ...s];
  }, [rows]);

  // SLA threshold computed early so it can be used in filtered
  const preMaxStores = useMemo(() => {
    if (!rows.length) return 0;
    return Math.max(...rows.map(r => r.value));
  }, [rows]);
  const SLA_THRESHOLD = preMaxStores * 0.80;

  const filtered = useMemo(() => {
    if (!rows.length) return [];
    return rows.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      const fromOk = applied.from ? t >= new Date(applied.from).getTime() : true;
      const toOk = applied.to ? t <= new Date(applied.to + "T23:59:59").getTime() : true;
      const storeOk = applied.store === "all" || r.source_file === applied.store;
      const statusOk = applied.status === "all" || 
        (applied.status === "online" && r.value >= SLA_THRESHOLD) ||
        (applied.status === "offline" && r.value < SLA_THRESHOLD);
      return fromOk && toOk && storeOk && statusOk;
    });
  }, [rows, applied, SLA_THRESHOLD]);

  // KPI stats — value = count of visible stores (e.g. 1704)
  // Use demo data only while loading or if CSV truly empty
  const useDemoData = loading || rows.length === 0;

  // Real stats: avg visible stores, max, min, total events
  const allValues = filtered.map((r) => r.value);
  const maxStores  = allValues.length ? Math.max(...allValues) : 0;
  const minStores  = allValues.length ? Math.min(...allValues) : 0;
  const avgStores  = allValues.length ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;

  const onlineCount  = useDemoData ? 1234  : Math.round(avgStores);
  const offlineCount = useDemoData ? 23    : Math.round(maxStores - avgStores);
  const totalEvents  = useDemoData ? 45678 : filtered.length;
  const avgUptime    = useDemoData ? 94.5  : (maxStores > 0 ? (avgStores / maxStores) * 100 : 0);

  // Chart data – bucket by hour for real data to avoid 100k+ points
  const LINE_LABELS = ["Feb 1","Feb 3","Feb 5","Feb 7","Feb 9","Feb 11","Feb 13","Feb 15","Feb 17","Feb 19","Feb 21","Feb 23"];
  const lineData = useMemo(() => {
    if (useDemoData) {
      return {
        labels: LINE_LABELS,
        datasets: [
          {
            label: "Online",
            data: [1200,1180,1220,1190,1210,1230,1215,1200,1225,1234,1218,1240],
            borderColor: "#29D884",
            backgroundColor: "rgba(41,216,132,0.08)",
            borderWidth: 2, tension: 0.4, fill: true,
            pointBackgroundColor: "#29D884", pointRadius: 3, pointHoverRadius: 5,
          },
          {
            label: "Offline",
            data: [57,70,40,65,50,35,45,58,38,23,42,18],
            borderColor: "#ff4239",
            backgroundColor: "rgba(255,66,57,0.06)",
            borderWidth: 2, tension: 0.4, fill: true,
            pointBackgroundColor: "#ff4239", pointRadius: 3, pointHoverRadius: 5,
          },
        ],
      };
    }
    // Bucket into ~60 points by grouping every N records
    const N = Math.max(1, Math.floor(filtered.length / 60));
    const buckets = [];
    for (let i = 0; i < filtered.length; i += N) {
      const chunk = filtered.slice(i, i + N);
      buckets.push({
        label: new Date(chunk[0].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        avg: chunk.reduce((s, r) => s + r.value, 0) / chunk.length,
        gap: maxStores - (chunk.reduce((s, r) => s + r.value, 0) / chunk.length),
      });
    }
    return {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: "Online (avg visible)",
          data: buckets.map((b) => Math.round(b.avg)),
          borderColor: "#29D884",
          backgroundColor: "rgba(41,216,132,0.08)",
          borderWidth: 2, tension: 0.4, fill: true,
          pointBackgroundColor: "#29D884", pointRadius: 2, pointHoverRadius: 5,
        },
        {
          label: "Offline (gap to max)",
          data: buckets.map((b) => Math.round(b.gap)),
          borderColor: "#ff4239",
          backgroundColor: "rgba(255,66,57,0.06)",
          borderWidth: 2, tension: 0.4, fill: true,
          pointBackgroundColor: "#ff4239", pointRadius: 2, pointHoverRadius: 5,
        },
      ],
    };
  }, [filtered, useDemoData, maxStores]);

  const donutData = {
    labels: ["Online", "Offline"],
    datasets: [{
      data: [parseFloat(avgUptime.toFixed(1)), parseFloat((100 - avgUptime).toFixed(1))],
      backgroundColor: ["#29D884", "#ff4239"],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  // Top 10 Stores by Downtime – matches mockup
  const barData = useMemo(() => {
    if (useDemoData) {
      return {
        labels: ["#77889","#67890","#33445","#99012","#55678","#22334","#88901","#44567","#11223","#66789"],
        datasets: [{ label: "Offline hours",
          data: [48,36,29,24,21,18,15,12,9,7],
          backgroundColor: (ctx) => {
            const v = ctx.parsed?.y ?? 0;
            if (v >= 40) return "rgba(255,66,57,0.85)";
            if (v >= 25) return "rgba(252,103,78,0.75)";
            return "rgba(255,87,45,0.4)";
          },
          borderRadius: 5, borderSkipped: false }],
      };
    }
    // Group by source_file, compute avg gap to max
    const storeMap = {};
    filtered.forEach(r => {
      if (!storeMap[r.source_file]) storeMap[r.source_file] = { sum: 0, count: 0 };
      storeMap[r.source_file].sum += r.value;
      storeMap[r.source_file].count++;
    });
    const sorted = Object.entries(storeMap)
      .map(([name, s]) => ({ name, gap: Math.round(maxStores - s.sum / s.count) }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10);
    return {
      labels: sorted.map(s => s.name.slice(0, 12)),
      datasets: [{ label: "Offline hours",
        data: sorted.map(s => s.gap),
        backgroundColor: (ctx) => {
          const v = ctx.parsed?.y ?? 0;
          if (v >= 40) return "rgba(255,66,57,0.85)";
          if (v >= 25) return "rgba(252,103,78,0.75)";
          return "rgba(255,87,45,0.4)";
        },
        borderRadius: 5, borderSkipped: false }],
    };
  }, [filtered, useDemoData, maxStores]);

  // Hourly distribution – count records per hour of day
  const hourData = useMemo(() => {
    if (useDemoData) {
      return {
        labels: ["0h","2h","4h","6h","8h","10h","12h","14h","16h","18h","20h","22h"],
        datasets: [{ label: "State changes", data: [12,8,5,3,45,89,120,134,98,145,167,78],
          backgroundColor: "rgba(15,55,73,0.12)", borderColor: "#0f3749",
          borderWidth: 1, borderRadius: 5, borderSkipped: false }],
      };
    }
    const hourMap = new Array(24).fill(0);
    filtered.forEach((r) => { const h = new Date(r.timestamp).getHours(); hourMap[h]++; });
    return {
      labels: hourMap.map((_, i) => `${i}h`),
      datasets: [{ label: "Records", data: hourMap,
        backgroundColor: "rgba(15,55,73,0.12)", borderColor: "#0f3749",
        borderWidth: 1, borderRadius: 5, borderSkipped: false }],
    };
  }, [filtered, useDemoData]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#bbb" } },
      y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 10 }, color: "#bbb" } },
    },
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...TOOLTIP_STYLE, callbacks: { label: (c) => ` ${c.parsed.y}h offline` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#bbb" } },
      y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 10 }, color: "#bbb" } },
    },
  };
  const hourOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...TOOLTIP_STYLE, callbacks: { label: (c) => ` ${c.parsed.y} changes` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#bbb" } },
      y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 10 }, color: "#bbb" } },
    },
  };
  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: { ...TOOLTIP_STYLE, callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } },
    },
  };

  // SLA: % of time below threshold
  const belowSLA = !useDemoData && allValues.length
    ? ((allValues.filter(v => v < SLA_THRESHOLD).length / allValues.length) * 100).toFixed(1)
    : "5.5";

  // Table rows (real data or demo)
  const tableRows = useDemoData
    ? DEMO_STORES
    : filtered
        .slice(-20)
        .reverse()
        .map((r, i) => ({
          id: `#${(i + 1).toString().padStart(5, "0")}`,
          name: r.metric || r.source_file,
          status: maxStores > 0 && r.value >= SLA_THRESHOLD ? "online" : "offline",
          uptime: maxStores > 0 ? Math.min(100, Math.round((r.value / maxStores) * 100)) : 0,
          changes: r.value,
          last: fmtDate(r.timestamp),
        }));

  const exportCSV = () => {
    const data = tableRows.map((r) =>
      [r.id, r.name, r.status, r.uptime + "%", r.changes, r.last].join(",")
    );
    const blob = new Blob([["Store ID,Name,Status,Uptime,Changes,Last Event", ...data].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "store_activity.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="app">
      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-left">
          <svg className="logo-rappi" viewBox="0 0 80 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="22" fontFamily="Inter" fontWeight="800" fontSize="22" fill="white">rappi</text>
          </svg>
          <div className="header-divider" />
          <div className="header-title-group">
            <h1>Store Availability Dashboard</h1>
            <p>Operations Intelligence · Q1 2026</p>
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
        </div>
      </header>

      {/* ── FILTERS ── */}
      <div className="filters-bar">
        <span className="filter-label">Filters</span>
        <select className="filter-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="all">All stores</option>
          {storeNames.filter((s) => s !== "all").map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <input type="date" className="filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button className="filter-btn" onClick={() => setApplied({ store: storeFilter, status: statusFilter, from: dateFrom, to: dateTo })}>
          Apply
        </button>
        <button className="filter-btn-clear" onClick={() => {
          setStoreFilter("all"); setStatusFilter("all");
          setDateFrom("2026-02-01"); setDateTo("2026-03-31");
          setApplied({ store: "all", status: "all", from: "2026-02-01", to: "2026-03-31" });
        }}>
          Clear
        </button>
        {loading && <span style={{ color: "#fc674e", fontSize: 12, fontWeight: 600, marginLeft: 8 }}>⟳ Loading data…</span>}
      </div>

      {/* ── MAIN ── */}
      <main className="main">

        {/* ── METRICS ── */}
        <div className="metrics-grid">
          <MetricCard
            cardClass="metric-card-1" label="Stores Online"
            value={fmtNum(onlineCount)}
            change={useDemoData ? "+5.2% vs yesterday" : `Max: ${fmtNum(maxStores)}`}
            changeClass="up" indicator="indicator-green"
          />
          <MetricCard
            cardClass="metric-card-2" label="Total Events"
            value={fmtNum(totalEvents)} change="Historical total"
            changeClass="neutral" indicator="indicator-purple"
          />
          <MetricCard
            cardClass="metric-card-3" label="Avg Uptime"
            value={`${avgUptime.toFixed(1)}%`}
            change={useDemoData ? "+1.2% this month" : `+${(avgUptime - 90).toFixed(1)}% vs baseline`}
            changeClass="up" indicator="indicator-orange"
          />
          <MetricCard
            cardClass="metric-card-4" label="Stores Offline"
            value={fmtNum(offlineCount)}
            change={useDemoData ? "-3 vs last hour" : `${belowSLA}% below SLA`}
            changeClass="down" indicator="indicator-red"
          />
        </div>

        {/* ── MAIN CHART + DONUT ── */}
        <div className="charts-grid">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Availability Over Time</div>
                <div className="chart-subtitle">Daily online / offline state changes</div>
              </div>
              <div className="legend-row">
                <div className="legend-item"><div className="legend-dot" style={{ background: "#29D884" }} />Online</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: "#ff4239" }} />Offline</div>
              </div>
            </div>
            <div className="chart-container">
              <Line data={lineData} options={lineOptions} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Status Distribution</div>
                <div className="chart-subtitle">Overall proportion</div>
              </div>
            </div>
            <div className="chart-container-sm" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Doughnut data={donutData} options={donutOptions} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 14 }}>
              <div className="legend-item"><div className="legend-dot" style={{ background: "#29D884" }} />Online — {avgUptime.toFixed(1)}%</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: "#ff4239" }} />Offline — {(100 - avgUptime).toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM CHARTS: Downtime + Hourly pattern ── */}
        <div className="charts-grid-bottom">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Top 10 Stores by Downtime</div>
                <div className="chart-subtitle">Accumulated offline hours</div>
              </div>
              <span className="chart-tag chart-tag-warning">Critical</span>
            </div>
            <div className="chart-container">
              <Bar data={barData} options={barOptions} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Changes by Hour of Day</div>
                <div className="chart-subtitle">Hourly availability pattern</div>
              </div>
              <span className="chart-tag">Pattern</span>
            </div>
            <div className="chart-container">
              <Bar data={hourData} options={hourOptions} />
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="table-card">
          <div className="table-top-row">
            <div>
              <div className="chart-title">Store Activity Detail</div>
              <div className="chart-subtitle">Latest status changes per store</div>
            </div>
            <button className="filter-btn" style={{ fontSize: 12, padding: "7px 14px" }} onClick={exportCSV}>
              Export CSV
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Store ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Uptime</th>
                <th>Total Changes</th>
                <th>Last Event</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i}>
                  <td><span className="store-id">{row.id}</span></td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`status-badge status-${row.status}`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td><UptimeBar pct={row.uptime} /></td>
                  <td>{row.changes}</td>
                  <td>{row.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>

      {/* ── CHATBOT ── */}
      <Chatbot />
    </div>
  );
}
