#  Dashboard de Rappi + Chatbot IA

Este proyecto es una solución integral (Frontend + Backend + IA) para la visualización e interpretación semántica de datos de disponibilidad de tiendas de Rappi. Transforma ~70,000 registros crudos en un Dashboard y permite consultarlos usando lenguaje natural gracias a un Agente de IA (Llama 3.3).

---

## 🏗 Arquitectura y Stack Tecnológico

Este proyecto utiliza una arquitectura moderna, modular y *stateless*, diseñada para máxima velocidad y eficiencia de costos.

### 💻 Stack Tecnológico
- **Frontend:** React 19, Vite, Chart.js (Visualización de datos), Vanilla CSS.
- **Backend:** Node.js, Express.
- **Inteligencia Artificial:** Groq SDK, Modelo Llama-3.3-70b-versatile (Alta velocidad de inferencia).
- **Procesamiento de Datos (ETL):** Python (Pandas).
- **Despliegue y Orquestación:** Docker, Docker Compose, Nginx (Reverse Proxy).

### 🧠 Decisiones Arquitectónicas

1. **Pipeline de Datos (ETL Anti-RAG Pesado)**
   - **Problema:** Enviar un dataset crudo (14MB+) de ~70,000 registros a un LLM en cada solicitud es ineficiente, altamente costoso y propenso a alucinaciones. Las bases de datos vectoriales (RAG tradicional) son excesivas para datos tabulares estructurados.
   - **Solución:** Se implementó un script ETL en Python (`convert_csv_to_json`) que pre-procesa las métricas operativas (SLA, resiliencia, caídas) en un archivo JSON ultraligero (< 20KB) que se carga directamente en memoria.
2. **Dashboard de Alta Performance**
   - El frontend calcula y visualiza decenas de miles de puntos de datos en el navegador usando optimizaciones de Chart.js y Hooks de React (`useStoreData`) sin requerir un backend pesado para cálculos estadísticos.
3. **Chatbot "UI-Aware" (Consciencia de Interfaz)**
   - El agente de IA no está aislado. Cuando el usuario filtra fechas o tiendas en el dashboard, el frontend **inyecta los filtros activos y los KPIs actuales** directamente en el *System Prompt* del backend.
   - Esto permite que el Chatbot de Llama 3.3 entienda exactamente lo que el usuario está viendo en su pantalla, respondiendo con un contexto perfecto.

---

## 🛠 Cómo iniciar el proyecto (Local)

Existen dos maneras de correr este proyecto: usando Docker o ejecutándolo nativamente con Node.

### Opción 1: Usando Docker
*Requiere Docker y Docker Compose instalados.*

1. Clonar el repositorio.
2. Crear un archivo `.env` en la raíz del proyecto y agregar la API Key de Groq:
   ```env
   GROQ_API_KEY=tu_api_key_aqui
   ```
3. Levantar los contenedores:
   ```bash
   docker-compose up --build
   ```
4. Ingresa a `http://localhost:5173` para ver el Dashboard.

### Opción 2: Desarrollo Nativo (Node.js)
*Requiere Node.js 18+ instalado.*

1. **Inicia el Backend:**
   ```bash
   cd backend
   npm install
   # Crea el archivo .env en la carpeta backend con: GROQ_API_KEY=tu_api_key
   node server.js
   ```
   *El backend correrá en http://localhost:3001*

2. **Inicia el Frontend:**
   En otra terminal:
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```
   *El dashboard correrá en http://localhost:5173*

---

## Cómo probar el Agente IA

Una vez en el Dashboard, haz clic en el ícono de la esquina inferior derecha para abrir el Chatbot. Prueba hacer preguntas combinadas con los filtros:

- *"¿Cuál es la disponibilidad promedio?"*
- (Filtra la fecha en el Dashboard para el 3 de Febrero) -> *"¿Cuáles son los KPIs actuales para esta fecha?"*
- *"¿Cuál fue el peor horario operativo?"*
- *"Explícame en qué consiste la Ventana de Oportunidad."*

**Aviso:** El Bot está configurado con **System Grounding**. Si intentas preguntarle sobre un tema ajeno a las operaciones de Rappi (ej. *"¿Cómo hacer una tarta?"*), se negará a responder.

