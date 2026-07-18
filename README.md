# Clin 🤖

Clin es un agente conversacional inteligente y robusto para Discord desarrollado en **Node.js** con **Discord.js v14** e integrado con los modelos avanzados de inteligencia artificial a través de **OpenRouter AI**. Su diseño está enfocado en emular las interacciones orgánicas de un usuario real, adoptando un tono altamente informal, minimalista y dinámico dentro del chat.

---

## 🚀 Características Principales

*   **Procesamiento Concurrente Asíncrono:** Arquitectura diseñada para gestionar múltiples solicitudes simultáneas en canales públicos y DMs sin bloqueos ni cuellos de botella.
*   **Contexto Dinámico de Conversación:** Mantiene una memoria caché local optimizada para los últimos mensajes de cada canal, preservando el hilo de la charla de forma precisa.
*   **Multimodalidad Nativa:** Soporte para interpretar imágenes adjuntas, interactuar dinámicamente con stickers y procesar contenidos a través de web scraping ultraligero de enlaces.
*   **Comportamiento Autónomo:** Bucle independiente para la actualización de estados personalizados en Discord y temporizadores capaces de reactivar la interacción en canales inactivos de manera orgánica.
*   **Optimización de Infraestructura:** Servidor Express nativo integrado para mantener la estabilidad del proceso y prevenir la suspensión del servicio en entornos Cloud como Render.

---

## 🛠️ Tecnologías Utilizadas

*   **Entorno:** Node.js
*   **Librería Core:** Discord.js v14
*   **API AI Engine:** OpenRouter API (Gemini Flash Architecture)
*   **Servidor Web:** Express

---

## ⚙️ Configuración del Entorno

El proyecto requiere las siguientes variables de entorno configuradas de manera local o en tu plataforma de hosting:

```env
DISCORD_TOKEN=Tu_Discord_Bot_Token
OPENROUTER_API_KEY=Tu_OpenRouter_API_Key
PORT=3000
