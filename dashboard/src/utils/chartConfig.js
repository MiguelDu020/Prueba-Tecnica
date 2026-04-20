/**
 * chartConfig.js — Shared Chart.js configuration constants.
 * Centralizes tooltip styles, scale presets, and color palette.
 */

// ── Brand palette ────────────────────────────────────────────────────────────
export const COLORS = {
  primary: "#0f3749",
  accent: "#fc674e",
  accentDark: "#ff4239",
  green: "#29D884",
  red: "#ff4239",
  orange: "#fc674e",
  purple: "#4f145e",
  teal: "#114541",
  blue: "#0e2a4f",
  warmBg: "#f5e5ce",
  cardBg: "#fff0dd",
  white: "#ffffff",
  gray: "#bbb",
  lightGray: "rgba(0,0,0,0.04)",
};

// ── Common tooltip ───────────────────────────────────────────────────────────
export const TOOLTIP_STYLE = {
  backgroundColor: COLORS.primary,
  titleFont: { size: 11, weight: "600" },
  bodyFont: { size: 11 },
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
};

// ── Shared scale configs ─────────────────────────────────────────────────────
const defaultAxisStyle = {
  ticks: { font: { size: 10 }, color: COLORS.gray },
};

export const SCALES = {
  clean: {
    x: { grid: { display: false }, ...defaultAxisStyle },
    y: { grid: { color: COLORS.lightGray }, ...defaultAxisStyle },
  },
};

// ── Pre-built chart option presets ───────────────────────────────────────────

export const LINE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE },
  scales: SCALES.clean,
};

export const BAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...TOOLTIP_STYLE,
      callbacks: { label: (c) => ` ${c.parsed.y} stores gap` },
    },
  },
  scales: SCALES.clean,
};

export const HOUR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...TOOLTIP_STYLE,
      callbacks: { label: (c) => ` Avg: ${Math.round(c.parsed.y)} stores` },
    },
  },
  scales: SCALES.clean,
};

export const DONUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "72%",
  plugins: {
    legend: { display: false },
    tooltip: {
      ...TOOLTIP_STYLE,
      callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` },
    },
  },
};

// ── Volatility chart options ─────────────────────────────────────────────────
export const VOLATILITY_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...TOOLTIP_STYLE,
      callbacks: { label: (c) => ` Δ${c.parsed.y > 0 ? "+" : ""}${c.parsed.y} stores` },
    },
  },
  scales: {
    x: { grid: { display: false }, ...defaultAxisStyle },
    y: {
      grid: { color: COLORS.lightGray },
      ...defaultAxisStyle,
    },
  },
};
