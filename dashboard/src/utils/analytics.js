/**
 * analytics.js — Pure analytics functions for Rappi Systemic Health Dashboard
 *
 * All functions are pure (no side effects) and operate on the "Long Format" data:
 *   { timestamp: string, value: number, source_file: string, metric: string }
 *
 * Business context:
 *   "value" = total visible stores at that 10-second snapshot.
 *   A drop in value = loss of operational capacity = fewer options for end users.
 */

// ──────────────────────────────────────────────────────────────────────────────
// 1. Índice de Capacidad Activa (Active Capacity Index / SLA Global)
//    → current value as % of historical maximum
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the Active Capacity Index (SLA).
 * @param {number} current  – current (or latest) store count
 * @param {number} maxValue – historical maximum store count
 * @returns {number} 0-100 percentage
 */
export function computeCapacityIndex(current, maxValue) {
  if (!maxValue || maxValue === 0) return 0;
  return Math.min(100, (current / maxValue) * 100);
}

/**
 * Determine if the SLA alert threshold is breached.
 * @param {number} capacityPct – capacity index percentage
 * @param {number} threshold   – alert threshold (default 90%)
 * @returns {{ level: 'ok' | 'warning' | 'critical', message: string }}
 */
export function evaluateSLAStatus(capacityPct, threshold = 90) {
  if (capacityPct >= threshold) {
    return { level: "ok", message: "Sistema operando dentro del SLA" };
  }
  if (capacityPct >= 75) {
    return {
      level: "warning",
      message: `Capacidad al ${capacityPct.toFixed(1)}% — pérdida de oferta moderada`,
    };
  }
  return {
    level: "critical",
    message: `¡ALERTA CRÍTICA! Capacidad al ${capacityPct.toFixed(1)}% — impacto severo en oferta`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Volatilidad de Red (Network Volatility / Micro-drops)
//    → detect sudden changes between consecutive 10-second intervals
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute deltas between consecutive readings to identify micro-drops.
 * @param {Array<{timestamp: string, value: number}>} rows – sorted by timestamp
 * @returns {Array<{timestamp: string, value: number, delta: number, deltaPct: number}>}
 */
export function computeVolatility(rows) {
  if (rows.length < 2) return [];

  return rows.slice(1).map((row, i) => {
    const prev = rows[i];
    const delta = row.value - prev.value;
    const deltaPct = prev.value !== 0 ? (delta / prev.value) * 100 : 0;
    return {
      timestamp: row.timestamp,
      value: row.value,
      delta,
      deltaPct,
    };
  });
}

/**
 * Identify micro-drops: sudden drops larger than a given threshold.
 * @param {Array} volatilityData – output of computeVolatility
 * @param {number} dropThresholdPct – minimum % drop to flag (default -2%)
 * @returns {Array<{timestamp: string, value: number, delta: number, deltaPct: number}>}
 */
export function detectMicroDrops(volatilityData, dropThresholdPct = -2) {
  return volatilityData.filter((d) => d.deltaPct <= dropThresholdPct);
}

/**
 * Compute a volatility score: standard deviation of deltas as % of mean value.
 * Higher = more unstable network.
 * @param {Array} volatilityData – output of computeVolatility
 * @returns {number} volatility score (0 = perfectly stable)
 */
export function volatilityScore(volatilityData) {
  if (!volatilityData.length) return 0;
  const deltas = volatilityData.map((d) => d.delta);
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance =
    deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length;
  return Math.sqrt(variance);
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Tiempo de Resiliencia (Recovery Time)
//    → how long it takes to recover from a massive drop back to optimal level
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Find recovery events: sequences where value drops below threshold,
 * then recovers back above it. Returns recovery duration.
 * @param {Array<{timestamp: string, value: number}>} rows – sorted
 * @param {number} threshold – threshold below which we consider "down"
 * @returns {Array<{dropTimestamp: string, recoveryTimestamp: string, durationMs: number, durationMinutes: number, dropValue: number, recoveredValue: number}>}
 */
export function computeRecoveryEvents(rows, threshold) {
  const events = [];
  let inDrop = false;
  let dropStart = null;
  let dropValue = 0;

  for (const row of rows) {
    if (!inDrop && row.value < threshold) {
      inDrop = true;
      dropStart = row;
      dropValue = row.value;
    } else if (inDrop && row.value >= threshold) {
      const durationMs =
        new Date(row.timestamp).getTime() -
        new Date(dropStart.timestamp).getTime();
      events.push({
        dropTimestamp: dropStart.timestamp,
        recoveryTimestamp: row.timestamp,
        durationMs,
        durationMinutes: Math.round(durationMs / 60000),
        dropValue,
        recoveredValue: row.value,
      });
      inDrop = false;
      dropStart = null;
    } else if (inDrop && row.value < dropValue) {
      dropValue = row.value;
    }
  }

  return events;
}

/**
 * Average recovery time across all events.
 * @param {Array} recoveryEvents – output of computeRecoveryEvents
 * @returns {number} average recovery time in minutes
 */
export function avgRecoveryTimeMinutes(recoveryEvents) {
  if (!recoveryEvents.length) return 0;
  const total = recoveryEvents.reduce((s, e) => s + e.durationMinutes, 0);
  return Math.round(total / recoveryEvents.length);
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Aggregation helpers for charts
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Bucket rows into N evenly-spaced groups for chart rendering.
 * @param {Array} rows  – sorted data
 * @param {number} bucketCount – desired number of chart points
 * @returns {Array<{label: string, avg: number, min: number, max: number, count: number}>}
 */
export function bucketize(rows, bucketCount = 60) {
  if (!rows.length) return [];
  const N = Math.max(1, Math.floor(rows.length / bucketCount));
  const buckets = [];

  for (let i = 0; i < rows.length; i += N) {
    const chunk = rows.slice(i, i + N);
    const values = chunk.map((r) => r.value);
    buckets.push({
      label: new Date(chunk[0].timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: chunk.length,
    });
  }

  return buckets;
}

/**
 * Group readings by hour-of-day (0-23) for pattern analysis.
 * @param {Array} rows
 * @returns {number[]} array of 24 values (counts or averages)
 */
export function hourlyDistribution(rows) {
  const hours = new Array(24).fill(null).map(() => []);
  rows.forEach((r) => {
    const h = new Date(r.timestamp).getHours();
    hours[h].push(r.value);
  });
  return hours.map((values) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  );
}

/**
 * Group by source_file (each CSV = a capture session) and compute gap to max.
 * @param {Array} rows
 * @param {number} maxValue – historical max
 * @returns {Array<{name: string, avgValue: number, gap: number, count: number}>} sorted descending by gap
 */
export function storeGapRanking(rows, maxValue) {
  const storeMap = {};
  rows.forEach((r) => {
    const key = r.source_file || "unknown";
    if (!storeMap[key]) storeMap[key] = { sum: 0, count: 0 };
    storeMap[key].sum += r.value;
    storeMap[key].count++;
  });

  return Object.entries(storeMap)
    .map(([name, s]) => ({
      name,
      avgValue: Math.round(s.sum / s.count),
      gap: Math.round(maxValue - s.sum / s.count),
      count: s.count,
    }))
    .sort((a, b) => b.gap - a.gap);
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Formatting helpers
// ──────────────────────────────────────────────────────────────────────────────

export function fmtNum(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return new Intl.NumberFormat("en-US").format(Math.round(v));
}

export function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return `${v.toFixed(1)}%`;
}

export function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? "-" : d.toLocaleString("es-CO");
}

export function timeSince(v) {
  if (!v) return "-";
  const diff = (Date.now() - new Date(v)) / 60000;
  if (diff < 2) return "Just now";
  if (diff < 60) return `${Math.round(diff)} min ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

export function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ${minutes % 60}min`;
  return `${Math.round(minutes / 1440)}d`;
}
