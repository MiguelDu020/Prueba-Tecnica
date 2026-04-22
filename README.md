#  Dashboard de Rappi + Chatbot IA

Este proyecto es una solución integral (Frontend + Backend + IA) para la visualización e interpretación semántica de datos de disponibilidad de tiendas de Rappi. Transforma ~70,000 registros crudos en un Dashboard y permite consultarlos usando lenguaje natural gracias a un Agente de IA (Llama 3.3).

---

## 🏗 Arquitectura y Decisiones Técnicas

El proyecto consta de tres pilares principales:

1. **Pipeline de Datos (ETL en Python)**
   - **Por qué:** Enviar el dataset crudo (14MB+) a un LLM en cada solicitud es lento, costoso e induce a alucinaciones.
   - **Solución:** Pre-procesamos los datos para extraer métricas semánticas (SLA, micro-caídas, resiliencia) a un JSON ultraligero (`store_data.json`) de menos de 20KB.
2. **Dashboard (React 19 + Vite)**
   - **Por qué:** Necesitamos una visualización limpia e instantánea. React con Chart.js permite renderizar decenas de miles de puntos de forma optimizada.
   - **Solución:** Un frontend modular sin gestores de estado complejos, usando Context y Hooks (`useStoreData`) que exponen cálculos en tiempo real (KPIs).
3. **Chatbot Semántico (Express + Groq / Llama 3.3 70B)**
   - **Por qué Groq:** Su motor de inferencia (LPUs) ofrece latencia de respuesta en milisegundos, fundamental para una UX fluida. El modelo Llama 3.3 70B tiene excelentes capacidades de razonamiento numérico.
   - **Implementación Agéntica:** El chatbot recibe de forma dinámica tanto los datos históricos como los **filtros y KPIs activos** que el usuario está viendo en el Dashboard. Esto le da un contexto perfecto de la UI sin necesidad de un complejo sistema RAG (Retrieval-Augmented Generation).

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

