import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "store_data.json");

const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

const app = express();
app.use(cors());
app.use(express.json());

let storeData = null;

function loadStoreData() {
  if (storeData) return storeData;
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(
      `store_data.json no encontrado en ${DATA_PATH}. ` +
      "Ejecuta: python convert_csv_to_json.py"
    );
  }
  storeData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  return storeData;
}

function buildSystemPrompt(data, dashboardData) {
  const g = data.global_metrics;
  const h = data.hourly_distribution;

  const topSources = Object.entries(data.source_breakdown || {})
    .slice(0, 5)
    .map(
      ([src, s]) =>
        `  • ${src}: promedio ${s.avg_stores} tiendas, índice capacidad ${s.capacity_index_pct}%`
    )
    .join("\n");

  let dashboardContext = "";
  if (dashboardData && dashboardData.kpis) {
    const kpis = dashboardData.kpis;
    const hours = Math.floor((kpis.avgRecovery || 0) / 60);
    const mins = Math.round((kpis.avgRecovery || 0) % 60);
    const recoveryStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

    dashboardContext = `
### KPIs Calculados en Tiempo Real (Visibles en Dashboard)
- Índice de Capacidad: ${kpis.capacityIndex?.toFixed(1) || 0}% (${(kpis.latestValue || 0).toLocaleString()} / ${(kpis.maxStores || 0).toLocaleString()} stores)
- Volatilidad de Red (Score): ${(kpis.volScore || 0).toLocaleString()} (${kpis.microDropCount || 0} micro-drops detectados)
- Tiempo de Resiliencia: ${recoveryStr} (${kpis.recoveryCount || 0} recovery events)
- Eventos Totales: ${(kpis.totalEvents || 0).toLocaleString()}
`;
  }

  if (dashboardData && dashboardData.tableRows) {
    const rows = dashboardData.tableRows;
    const allSources = rows.map(r => `  • ${r.name}: Capacidad ${r.uptime?.toFixed(1) || 0}%, Estado ${r.status}`).join("\n");
    dashboardContext += `
### Detalle de Todas las Fuentes (All sources)
${allSources}
`;
  }

  return `
Eres un Consultor de Inteligencia Operativa de Rappi. 
Tu única función es responder preguntas sobre los datos operativos de tiendas que se te proporcionan a continuación.

## REGLAS ESTRICTAS
1. Solo responde con información presente en los datos provistos.
2. Si la pregunta NO está relacionada con los datos de operaciones/tiendas, responde exactamente:
   "Lo siento, solo puedo responder preguntas sobre los datos operativos de tiendas Rappi."
3. No inventes cifras. Si no tienes el dato, dilo claramente.
4. Responde en español, de forma clara, concisa y directa. Usa formato Markdown.
5. Cuando corresponda, usa números exactos del dataset.
6. Puedes saludar y mantener una conversación amigable, pero siempre enfocado en los datos.

## DATOS OPERATIVOS (Q1 2026)

**Período:** ${data.date_range?.from ?? "N/A"} → ${data.date_range?.to ?? "N/A"}
**Total de lecturas:** ${(data.total_readings ?? 0).toLocaleString()}
**Fuentes de datos:** ${data.total_sources ?? 0} archivos

### Métricas Globales
- Máximo de tiendas visibles registrado: **${g.max_stores_ever}**
- Mínimo de tiendas visibles registrado: **${g.min_stores_ever}**
- Promedio de tiendas visibles: **${g.avg_stores}**
- Índice de Capacidad Activa: **${g.capacity_index_pct}%**
- Lecturas con capacidad ONLINE (≥80% del máximo): **${g.online_readings_pct}%**
- Lecturas con capacidad OFFLINE/Degradada (<80% del máximo): **${g.offline_readings_pct}%**
- Micro-caídas detectadas (drops >2% entre lecturas): **${g.micro_drops_detected}**

### Distribución Horaria
- Mejor hora operativa (más tiendas promedio): **${h.best_hour}**
- Peor hora operativa (menos tiendas promedio): **${h.worst_hour}**
- Distribución por hora (avg tiendas): ${JSON.stringify(h.avg_stores_by_hour)}

### Top Fuentes de Datos
${topSources || "Sin detalle disponible"}

${dashboardContext}

## EL DASHBOARD
El usuario está viendo un dashboard con estos elementos. Si te pregunta qué ve o te pide que le expliques la interfaz o los KPIs mostrados en las tarjetas, usa esta información:
1. **Índice de Capacidad:** Tarjeta verde. Muestra el % promedio de capacidad activa respecto al máximo de tiendas posibles.
2. **Volatilidad de Red:** Tarjeta morada. Mide el número de micro-caídas. Si es alto, el sistema ha sido inestable.
3. **Tiempo de Resiliencia:** Tarjeta naranja. Promedio del tiempo que toma recuperar el número de tiendas luego de una caída masiva.
4. **Eventos Totales:** Tarjeta roja. Número total de lecturas tomadas (cada lectura es una "foto" del sistema).
5. **Gráfico de Oportunidad vs Inestabilidad:** Gráfico de barras apiladas. Verde (Oportunidad Protegida) indica tiendas online; Rojo (Oportunidad Perdida) indica tiendas que se cayeron; la Línea Naranja indica índice de micro-caídas (Inestabilidad) por hora. Mide el impacto en negocio de las fallas sistémicas.
6. **Detalle de Actividad del Sistema:** Tabla con las fuentes de datos (cada CSV/Excel) y su respectiva capacidad y estado.

---
Responde la siguiente pregunta del usuario usando solo los datos anteriores.
`.trim();
}

app.post("/chat", async (req, res) => {
  const { question, history = [], dashboardData = null } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "El campo 'question' es requerido." });
  }

  try {
    const data         = loadStoreData();
    const systemPrompt = buildSystemPrompt(data, dashboardData);

    // Build multi-turn messages: system → history → current question
    const historyMessages = Array.isArray(history)
      ? history.map((m) => ({ role: m.role, content: String(m.content) }))
      : [];

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user",   content: question.trim() },
      ],
      temperature: 0.5,
      max_tokens:  1024,
    });

    const text = completion.choices[0].message.content;
    return res.json({ response: text });

  } catch (err) {
    console.error("[/chat] Error:", err.message.slice(0, 200));

    if (err.message.includes("store_data.json")) {
      return res.status(503).json({ error: "Datos no disponibles. Ejecuta el script de conversión primero." });
    }
    if (err.message.includes("429") || err.message.includes("rate_limit") || err.message.includes("quota")) {
      return res.status(429).json({ error: "⚠️ Límite de requests alcanzado. Intenta en un minuto." });
    }
    return res.status(500).json({ error: "Error al procesar la pregunta. Intenta de nuevo." });
  }
});

app.get("/health", (req, res) => {
  const dataReady = fs.existsSync(DATA_PATH);
  res.json({ status: "ok", dataReady, model: MODEL });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Backend Rappi Chatbot corriendo en http://localhost:${PORT}`);
  console.log(`   Modelo: ${MODEL}`);
  console.log(`   POST http://localhost:${PORT}/chat`);
  console.log(`   GET  http://localhost:${PORT}/health\n`);

  try {
    loadStoreData();
    console.log("✅ store_data.json cargado en memoria.");
  } catch (e) {
    console.warn("⚠️  " + e.message);
  }
});
