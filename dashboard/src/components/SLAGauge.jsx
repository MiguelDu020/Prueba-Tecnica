import { COLORS } from "../utils/chartConfig.js";

export default function SLAGauge({ capacityIndex, slaStatus, latestValue, maxValue }) {
  const angle = (capacityIndex / 100) * 180;
  const color =
    slaStatus.level === "ok"
      ? COLORS.green
      : slaStatus.level === "warning"
        ? COLORS.orange
        : COLORS.red;

  const statusLabel =
    slaStatus.level === "ok"
      ? "OPERATIVO"
      : slaStatus.level === "warning"
        ? "DEGRADADO"
        : "CRÍTICO";

  return (
    <div className="sla-gauge-card">
      <div className="sla-gauge-header">
        <div className="chart-title">Índice de Capacidad Activa</div>
        <div className="chart-subtitle">SLA Global — % del máximo histórico</div>
      </div>

      <div className="sla-gauge-body">
        <svg viewBox="0 0 200 120" className="sla-gauge-svg">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Colored arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 251.2} 251.2`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
          {/* Center text */}
          <text x="100" y="85" textAnchor="middle" fontSize="28" fontWeight="800" fill={color}>
            {capacityIndex.toFixed(1)}%
          </text>
          <text x="100" y="105" textAnchor="middle" fontSize="10" fontWeight="600" fill="#999">
            {latestValue?.toLocaleString()} / {maxValue?.toLocaleString()}
          </text>
        </svg>

        <div className="sla-status-badge" style={{ background: color + "18", color }}>
          <div className="sla-status-dot" style={{ background: color }} />
          {statusLabel}
        </div>
      </div>
    </div>
  );
}
