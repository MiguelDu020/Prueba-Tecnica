/**
 * UptimeBar.jsx — Visual uptime percentage bar.
 */
export default function UptimeBar({ pct }) {
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
