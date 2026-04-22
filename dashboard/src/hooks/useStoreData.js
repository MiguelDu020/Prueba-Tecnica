/**
 * useStoreData.js — Custom hook for loading and processing store availability data.
 *
 * Responsibilities:
 *   - Loads the CSV from /cleaned_long_format.csv via PapaParse
 *   - Applies filters (store, status, date range)
 *   - Computes all derived business metrics (SLA, Volatility, Recovery)
 *   - Exposes chart-ready data structures
 *
 * No demo/hardcoded data — everything comes from the CSV.
 */
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  computeCapacityIndex,
  evaluateSLAStatus,
  computeVolatility,
  detectMicroDrops,
  volatilityScore,
  computeRecoveryEvents,
  avgRecoveryTimeMinutes,
  bucketize,
  hourlyDistribution,
  storeGapRanking,
} from "../utils/analytics.js";

// ── SLA threshold: capacity index below 90% triggers alert ─────────────
const SLA_ALERT_THRESHOLD = 90;
const SLA_CAPACITY_FACTOR = 0.80; // 80% of max considered "below SLA"

export default function useStoreData() {
  // ── Raw state ─────────────────────────────────────────────────────────
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Filter state ──────────────────────────────────────────────────────
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("2026-02-01");
  const [dateTo, setDateTo] = useState("2026-03-31");
  const [applied, setApplied] = useState({
    store: "all",
    status: "all",
    from: "2026-02-01",
    to: "2026-03-31",
  });

  // ── CSV loading ───────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch("/cleaned_long_format.csv")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
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
      .catch((err) => {
        console.error("Failed to load CSV:", err);
        setError(err.message);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Store names for filter dropdown ───────────────────────────────────
  const storeNames = useMemo(() => {
    const s = new Set(rows.map((r) => r.source_file).filter(Boolean));
    return ["all", ...s];
  }, [rows]);

  // ── Global max (needed for SLA computations) ──────────────────────────
  const globalMax = useMemo(() => {
    if (!rows.length) return 0;
    return Math.max(...rows.map((r) => r.value));
  }, [rows]);

  const slaThreshold = globalMax * SLA_CAPACITY_FACTOR;

  // ── Filtered data (Alimenta tanto a los Charts como al Agente de IA) ──
  // El estado de estos filtros se pasa al backend al hacer una consulta.
  // Esto permite responder dinámicamente a "Cómo estuvo la disponibilidad el día X"
  // sin necesidad de enviarle a la IA todo el dataset completo.
  const filtered = useMemo(() => {
    if (!rows.length) return [];
    return rows.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      const fromOk = applied.from ? t >= new Date(applied.from).getTime() : true;
      const toOk = applied.to ? t <= new Date(applied.to + "T23:59:59").getTime() : true;
      const storeOk = applied.store === "all" || r.source_file === applied.store;
      const statusOk =
        applied.status === "all" ||
        (applied.status === "online" && r.value >= slaThreshold) ||
        (applied.status === "offline" && r.value < slaThreshold);
      return fromOk && toOk && storeOk && statusOk;
    });
  }, [rows, applied, slaThreshold]);

  // ── Core statistics ───────────────────────────────────────────────────
  const allValues = filtered.map((r) => r.value);
  const maxStores = allValues.length ? Math.max(...allValues) : 0;
  const minStores = allValues.length ? Math.min(...allValues) : 0;
  const avgStores = allValues.length ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
  const latestValue = allValues.length ? allValues[allValues.length - 1] : 0;

  // ── Business Metrics ──────────────────────────────────────────────────

  // 1. Active Capacity Index
  const capacityIndex = computeCapacityIndex(latestValue, globalMax);
  const slaStatus = evaluateSLAStatus(capacityIndex, SLA_ALERT_THRESHOLD);

  // 2. Network Volatility
  const volatilityData = useMemo(
    () => computeVolatility(filtered),
    [filtered]
  );
  const microDrops = useMemo(
    () => detectMicroDrops(volatilityData, -2),
    [volatilityData]
  );
  const volScore = useMemo(
    () => Math.round(volatilityScore(volatilityData)),
    [volatilityData]
  );

  // 3. Recovery Time
  const recoveryEvents = useMemo(
    () => computeRecoveryEvents(filtered, globalMax * 0.9),
    [filtered, globalMax]
  );
  const avgRecovery = useMemo(
    () => avgRecoveryTimeMinutes(recoveryEvents),
    [recoveryEvents]
  );

  // ── KPI display values ────────────────────────────────────────────────
  const kpis = {
    onlineCount: Math.round(avgStores),
    offlineCount: Math.round(maxStores - avgStores),
    totalEvents: filtered.length,
    avgUptime: maxStores > 0 ? (avgStores / maxStores) * 100 : 0,
    capacityIndex,
    slaStatus,
    volScore,
    microDropCount: microDrops.length,
    avgRecovery,
    recoveryCount: recoveryEvents.length,
    latestValue,
    maxStores: globalMax,
    minStores,
  };

  // ── Chart data ────────────────────────────────────────────────────────

  // Availability over time (bucketed)
  const chartBuckets = useMemo(
    () => bucketize(filtered, 60),
    [filtered]
  );

  // Hourly distribution (avg stores per hour-of-day)
  const hourlyAvgs = useMemo(
    () => hourlyDistribution(filtered),
    [filtered]
  );

  // Store gap ranking
  const gapRanking = useMemo(
    () => storeGapRanking(filtered, globalMax),
    [filtered, globalMax]
  );

  // Volatility chart data (bucketed deltas)
  const volatilityBuckets = useMemo(() => {
    if (!volatilityData.length) return [];
    const N = Math.max(1, Math.floor(volatilityData.length / 60));
    const buckets = [];
    for (let i = 0; i < volatilityData.length; i += N) {
      const chunk = volatilityData.slice(i, i + N);
      const avgDelta = chunk.reduce((s, d) => s + d.delta, 0) / chunk.length;
      buckets.push({
        label: new Date(chunk[0].timestamp).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "2-digit",
        }),
        value: Math.round(avgDelta),
      });
    }
    return buckets;
  }, [volatilityData]);

  // Heatmap matrix: [dayOfWeek 0=Mon..6=Sun][hour 0..23] = avgStores | null
  const heatmapMatrix = useMemo(() => {
    if (!filtered.length) return null;
    const sums = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const counts = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const r of filtered) {
      const d = new Date(r.timestamp);
      if (isNaN(d)) continue;
      const dow = (d.getDay() + 6) % 7;
      const hour = d.getHours();
      sums[dow][hour] += r.value;
      counts[dow][hour] += 1;
    }
    return sums.map((row, d) =>
      row.map((sum, h) =>
        counts[d][h] > 0 ? Math.round(sum / counts[d][h]) : null
      )
    );
  }, [filtered]);

  // Micro-drops count per hour (for OpportunityChart instability line)
  const microDropsByHour = useMemo(() => {
    const counts = new Array(24).fill(0);
    for (const drop of microDrops) {
      const h = new Date(drop.timestamp).getHours();
      if (h >= 0 && h < 24) counts[h]++;
    }
    return counts;
  }, [microDrops]);

  // ── Table rows ────────────────────────────────────────────────────────
  const tableRows = filtered
    .slice(-20)
    .reverse()
    .map((r, i) => ({
      id: `#${(i + 1).toString().padStart(5, "0")}`,
      name: r.metric || r.source_file,
      status: globalMax > 0 && r.value >= slaThreshold ? "online" : "offline",
      uptime: globalMax > 0 ? Math.min(100, Math.round((r.value / globalMax) * 100)) : 0,
      changes: r.value,
      last: r.timestamp,
    }));

  // ── Filter actions ────────────────────────────────────────────────────
  const applyFilters = () =>
    setApplied({ store: storeFilter, status: statusFilter, from: dateFrom, to: dateTo });

  const clearFilters = () => {
    setStoreFilter("all");
    setStatusFilter("all");
    setDateFrom("2026-02-01");
    setDateTo("2026-03-31");
    setApplied({ store: "all", status: "all", from: "2026-02-01", to: "2026-03-31" });
  };

  return {
    // State
    loading,
    error,
    filtered,
    rows,

    // Filters
    applied,
    storeFilter, setStoreFilter,
    statusFilter, setStatusFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    storeNames,
    applyFilters,
    clearFilters,

    // KPIs
    kpis,

    // Chart data
    chartBuckets,
    hourlyAvgs,
    gapRanking,
    volatilityBuckets,
    volatilityData,
    microDrops,
    microDropsByHour,
    heatmapMatrix,

    // Table
    tableRows,
  };
}
