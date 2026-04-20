/**
 * OpportunityChart.jsx — Ventana de Oportunidad vs. Impacto de Inestabilidad Sistémica
 *
 * Responde la pregunta de negocio central:
 *  "¿Cuál es el impacto de la inestabilidad sistémica en la ventana de oportunidad
 *   de Rappi y qué tan resiliente es nuestra infraestructura para proteger
 *   la experiencia del usuario?"
 *
 * Codificación visual:
 *  🟢 Barras verdes  → % de capacidad protegida (oportunidad capturada)
 *  🔴 Barras rojas   → % de capacidad perdida   (oportunidad destruida por inestabilidad)
 *  🟠 Línea naranja  → Índice de micro-caídas por hora (resiliencia infraestructura)
 *
 * Ejes:
 *  Y1 (izq) → 0–100%  Ventana de oportunidad
 *  Y2 (der) → 0–N     Micro-caídas detectadas
 */
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";

const HOURS = Array.from({ length: 24 }, (_, i) => `${i}h`);

export default function OpportunityChart({ hourlyAvgs, maxStores, microDropsByHour }) {

  const { opp, loss, drops } = useMemo(() => {
    const opp = (hourlyAvgs ?? []).map(v =>
      maxStores > 0 ? Math.min(100, Math.round((v / maxStores) * 100)) : 0
    );
    const loss  = opp.map(v => 100 - v);
    const drops = microDropsByHour ?? new Array(24).fill(0);
    return { opp, loss, drops };
  }, [hourlyAvgs, maxStores, microDropsByHour]);

  const maxDrops = Math.max(...drops, 1);

  const chartData = {
    labels: HOURS,
    datasets: [
      {
        // ── Dataset 1: Oportunidad capturada ───────────────────────────
        type: "bar",
        label: "Oportunidad protegida (%)",
        data: opp,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(41,216,132,0.75)";
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0,   "rgba(41,216,132,0.90)");
          gradient.addColorStop(1,   "rgba(17,69,65,0.60)");
          return gradient;
        },
        borderRadius: { topLeft: 3, topRight: 3 },
        borderSkipped: "bottom",
        stack: "opportunity",
        order: 2,
        yAxisID: "y",
      },
      {
        // ── Dataset 2: Oportunidad perdida ─────────────────────────────
        type: "bar",
        label: "Oportunidad perdida (%)",
        data: loss,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(255,66,57,0.55)";
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0,   "rgba(255,66,57,0.75)");
          gradient.addColorStop(1,   "rgba(252,103,78,0.30)");
          return gradient;
        },
        borderRadius: { topLeft: 3, topRight: 3 },
        borderSkipped: "bottom",
        stack: "opportunity",
        order: 2,
        yAxisID: "y",
      },
      {
        // ── Dataset 3: Micro-caídas (índice de inestabilidad) ──────────
        type: "line",
        label: "Micro-caídas (inestabilidad)",
        data: drops,
        borderColor: "#fc674e",
        backgroundColor: "rgba(252,103,78,0.08)",
        borderWidth: 2.5,
        tension: 0.45,
        fill: false,
        pointBackgroundColor: drops.map(v =>
          v >= maxDrops * 0.75 ? "#ff4239" :
          v >= maxDrops * 0.40 ? "#fc674e" : "#ffb347"
        ),
        pointRadius: drops.map(v => v > 0 ? 4 : 2),
        pointHoverRadius: 7,
        order: 1,
        yAxisID: "y2",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: "easeOutQuart" },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#0f3749",
          font: { size: 11, family: "Inter" },
          boxWidth: 12,
          padding: 16,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(15,55,73,0.95)",
        titleColor: "#fff",
        bodyColor: "rgba(255,255,255,0.80)",
        borderColor: "rgba(255,255,255,0.10)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          title: (items) => `🕐 ${items[0].label}:00 – ${parseInt(items[0].label) + 1}:00`,
          label: (item) => {
            if (item.datasetIndex === 0) return `  ✅ Oportunidad protegida: ${item.raw}%`;
            if (item.datasetIndex === 1) return `  ❌ Oportunidad perdida:   ${item.raw}%`;
            return `  ⚡ Micro-caídas: ${item.raw} eventos`;
          },
          afterBody: (items) => {
            const oppVal = items[0]?.raw;
            if (oppVal >= 80) return [" ", "  🟢 Infraestructura resiliente"];
            if (oppVal >= 50) return [" ", "  🟡 Degradación moderada"];
            return [" ", "  🔴 Ventana de oportunidad crítica"];
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: "rgba(0,0,0,0.04)" },
        ticks: { color: "#888", font: { size: 11, family: "Inter" } },
      },
      y: {
        stacked: true,
        min: 0,
        max: 100,
        position: "left",
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: {
          color: "#888",
          font: { size: 11, family: "Inter" },
          callback: (v) => `${v}%`,
        },
        title: {
          display: true,
          text: "Ventana de oportunidad (%)",
          color: "#aaa",
          font: { size: 10, family: "Inter" },
        },
      },
      y2: {
        min: 0,
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: {
          color: "#fc674e",
          font: { size: 10, family: "Inter" },
          stepSize: 1,
        },
        title: {
          display: true,
          text: "Índice inestabilidad",
          color: "#fc674e",
          font: { size: 10, family: "Inter" },
        },
      },
    },
  };

  return (
    <div style={{ position: "relative", height: 230 }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
