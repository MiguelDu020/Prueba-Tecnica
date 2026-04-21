/**
 * server.js — Backend Express para el Chatbot de Rappi
 *
 * Arquitectura:
 *   POST /chat  → recibe { question }
 *               → carga data/store_data.json
 *               → construye prompt con contexto de negocio
 *               → llama a Groq (llama-3.3-70b-versatile)
 *               → retorna { response }
 *
 * GET  /health  → verifica que el servidor está activo
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

// ── Paths ──────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH  = path.join(__dirname, "data", "store_data.json");

// ── Groq Client ────────────────────────────────────────────────────────────
const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile"; // 70B params — best free model on Groq

// ── Express App ────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Load store data (cached in memory) ────────────────────────────────────
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

// ── Build system prompt ────────────────────────────────────────────────────
function buildSystemPrompt(data) {
  const g = data.global_metrics;
  const h = data.hourly_distribution;

  const topSources = Object.entries(data.source_breakdown || {})
    .slice(0, 5)
    .map(
      ([src, s]) =>
        `  • ${src}: promedio ${s.avg_stores} tiendas, índice capacidad ${s.capacity_index_pct}%`
    )
    .join("\n");

  return `
Eres un Consultor de Inteligencia Operativa de Rappi. 
Tu única función es responder preguntas sobre los datos operativos de tiendas que se te proporcionan a continuación.

## REGLAS ESTRICTAS
1. Solo responde con información presente en los datos provistos.
2. Si la pregunta NO está relacionada con los datos de operaciones/tiendas, responde exactamente:
   "Lo siento, solo puedo responder preguntas sobre los datos operativos de tiendas Rappi."
3. No inventes cifras. Si no tienes el dato, dilo claramente.
4. Responde en español, de forma clara, concisa y directa.
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

---
Responde la siguiente pregunta del usuario usando solo los datos anteriores.
`.trim();
}

// ── POST /chat ─────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  const { question, history = [] } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "El campo 'question' es requerido." });
  }

  try {
    const data         = loadStoreData();
    const systemPrompt = buildSystemPrompt(data);

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

// ── GET /health ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  const dataReady = fs.existsSync(DATA_PATH);
  res.json({ status: "ok", dataReady, model: MODEL });
});

// ── Start ──────────────────────────────────────────────────────────────────
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
