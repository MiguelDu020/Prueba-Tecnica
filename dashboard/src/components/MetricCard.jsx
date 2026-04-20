/**
 * MetricCard.jsx — Reusable KPI metric card component.
 */
export default function MetricCard({ label, value, change, changeClass, indicator, cardClass }) {
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
