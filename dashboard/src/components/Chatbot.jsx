/**
 * Chatbot.jsx — Consultor Operativo de Rappi (Gemini Backend)
 *
 * Arquitectura:
 *   1. Usuario escribe pregunta
 *   2. POST /chat → backend Express → Google Gemini + store_data.json
 *   3. Respuesta mostrada en el chat
 *
 * El backend está en: /backend/server.js (puerto 3001)
 */
import { useEffect, useRef, useState } from "react";

// ── Backend URL (relative: Vite proxies /chat → http://localhost:3001/chat)
const BACKEND_URL = "/chat";

// ── Markdown → HTML (bold, italic, lists, line breaks) ────────────────────
function mdToHtml(text) {
  if (!text) return "";
  return text
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic: *text* or _text_
    .replace(/\*([^\*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    // Inline code: `code`
    .replace(/`([^`]+)`/g, "<code style='background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:3px;font-size:0.88em'>$1</code>")
    // Bullet lists: lines starting with - or •
    .replace(/^[-•]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul style='margin:6px 0 6px 16px;padding:0'>$1</ul>")
    // Headers: ## or ###
    .replace(/^###\s+(.+)$/gm, "<strong style='display:block;margin-top:8px'>$1</strong>")
    .replace(/^##\s+(.+)$/gm, "<strong style='display:block;font-size:1.05em;margin-top:8px'>$1</strong>")
    // Line breaks
    .replace(/\n/g, "<br>");
}

// ── Quick replies ──────────────────────────────────────────────────────────
const QUICK_REPLIES = [
  ["🔴 Tiendas offline", "¿Cuántas tiendas estuvieron offline?"],
  ["📊 Capacidad global", "¿Cuál es el índice de capacidad activa?"],
  ["⏱️ Mejor hora", "¿A qué hora hay más tiendas disponibles?"],
  ["📉 Micro-caídas", "¿Cuántas micro-caídas se detectaron?"],
];

// ── Helpers ────────────────────────────────────────────────────────────────
async function queryChatbot(question, history = []) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Error ${res.status}`);
  }

  const data = await res.json();
  return data.response;
}

// ══════════════════════════════════════════════════════════════════════════
export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text:
        "¡Hola! Soy el <strong>Consultor Operativo de Rappi</strong>. " +
        "Pregúntame sobre <strong>tiendas offline</strong>, <strong>capacidad activa</strong>, " +
        "<strong>micro-caídas</strong> o cualquier métrica del dashboard.",
      time: "Now",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("unknown"); // "ok" | "error" | "unknown"
  const msgEnd = useRef(null);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Check backend health on mount ────────────────────────────────────────
  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then((d) => setBackendStatus(d.dataReady ? "ok" : "no-data"))
      .catch(() => setBackendStatus("error"));
  }, []);

  const nowTime = () =>
    new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  // ── Send message ─────────────────────────────────────────────────────────
  async function send(text) {
    const question = text.trim();
    if (!question || loading) return;

    // Build conversation history (last 10 turns) so the model remembers context
    const history = messages
      .filter((m) => m.role === "user" || m.role === "bot")
      .slice(-10)
      .map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.text.replace(/<[^>]*>/g, ""), // strip HTML tags
      }));

    setMessages((m) => [...m, { role: "user", text: question, time: nowTime() }]);
    setInput("");
    setLoading(true);

    try {
      const reply = await queryChatbot(question, history);
      setMessages((m) => [...m, { role: "bot", text: reply, time: nowTime() }]);
      setBackendStatus("ok");
    } catch (err) {
      const errMsg =
        backendStatus === "error"
          ? "⚠️ No puedo conectarme al backend. Asegúrate de que el servidor esté corriendo en el puerto 3001."
          : `⚠️ ${err.message}`;
      setMessages((m) => [...m, { role: "bot", text: errMsg, time: nowTime() }]);
      if (backendStatus !== "ok") setBackendStatus("error");
    } finally {
      setLoading(false);
    }
  }

  // ── Status pill ──────────────────────────────────────────────────────────
  const statusDot =
    backendStatus === "ok"
      ? "#29D884"
      : backendStatus === "error"
      ? "#ff4239"
      : "#fc674e";
  const statusLabel =
    backendStatus === "ok"
      ? "IA Conectada · Groq"
      : backendStatus === "error"
      ? "Backend offline"
      : backendStatus === "no-data"
      ? "Sin datos JSON"
      : "Verificando...";

  // ── Icons ────────────────────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating toggle button */}
      <button
        className="chatbot-toggle"
        onClick={() => setOpen((o) => !o)}
        id="chatToggle"
        title="Consultor IA de Rappi"
      >
        {open ? closeIcon : chatIcon}
        {!open && <div className="notif-dot" />}
      </button>

      {/* Chat window */}
      <div className={`chatbot-window${open ? " open" : ""}`} id="chatWindow">
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-avatar">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                fill="white"
              />
            </svg>
          </div>
          <div className="chatbot-info">
            <h3>Rappi AI Consultant</h3>
            <p>
              <span className="chatbot-online-dot" style={{ background: statusDot }} />
              {statusLabel}
            </p>
          </div>
          <button className="chatbot-close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="chatbot-messages" id="chatMessages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <div className={`msg-avatar ${m.role === "bot" ? "msg-avatar-bot" : "msg-avatar-user"}`}>
                {m.role === "bot" ? "🤖" : "U"}
              </div>
              <div className="msg-content">
                <div
                  className="message-bubble"
                  dangerouslySetInnerHTML={{ __html: m.text }}
                />
                <div className="message-time">{m.time}</div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="message bot">
              <div className="msg-avatar msg-avatar-bot">🤖</div>
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={msgEnd} />
        </div>

        {/* Quick replies */}
        <div className="quick-replies">
          {QUICK_REPLIES.map(([label, q]) => (
            <button
              key={label}
              className="quick-reply-btn"
              onClick={() => send(q)}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="chatbot-input-area">
          <input
            type="text"
            className="chatbot-input"
            id="chatInput"
            placeholder="Pregunta sobre datos operativos..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            disabled={loading}
          />
          <button className="chatbot-send" onClick={() => send(input)} disabled={loading}>
            {sendIcon}
          </button>
        </div>
      </div>
    </>
  );
}
