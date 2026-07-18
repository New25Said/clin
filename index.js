// Sistema centralizado de peticiones formateado correctamente para OpenRouter AI
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    // VALIDACIÓN CRÍTICA: Si no encuentra la clave o está mal cargada, evita el crash
    if (!apiKey || apiKey.trim() === "") {
        console.error("❌ ERROR CRÍTICO: La variable OPENROUTER_API_KEY no está definida en Render.");
        return "ERROR_AUTH";
    }

    const url = "https://openrouter.ai/api/v1/chat/completions";
    const systemInstruction = "Eres Clin, un usuario real e informal en este chat de Discord. Hablas de forma ultra corta (máximo 1 o 2 líneas), siempre en minúsculas, usas xd, pq, tmb, weno, ntp. Sé directo, algo sarcástico y relajado. Responde SOLO en texto plano sin formatos raros.";

    const messages = [{ role: "system", content: systemInstruction }];

    if (memoriaCanales[canalId] && memoriaCanales[canalId].length > 0) {
        memoriaCanales[canalId].forEach(msg => {
            const roleMapped = msg.role === "model" ? "assistant" : "user";
            let textContent = msg.parts.map(p => p.text || "").join(" ");
            messages.push({ role: roleMapped, content: textContent });
        });
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey.trim()}` // Forzamos el trim para evitar espacios invisibles
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash", 
                messages: messages
            })
        });

        if (response.status === 429) return "CUOTA_EXCEDIDA";
        if (response.status === 401) return "ERROR_AUTH";

        const data = await response.json();

        if (data.error) {
            if (data.error.code === 429 || JSON.stringify(data.error).toLowerCase().includes("quota")) {
                return "CUOTA_EXCEDIDA";
            }
            if (JSON.stringify(data.error).toLowerCase().includes("auth") || data.error.code === 401) {
                return "ERROR_AUTH";
            }
            throw new Error(data.error.message);
        }

        if (data.choices?.[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        }
        throw new Error("Respuesta inválida de la API");
    } catch (err) {
        console.error("Error en Fetch OpenRouter:", err);
        if (err.message && err.message.includes("429")) return "CUOTA_EXCEDIDA";
        return "ERROR_CONEXION";
    }
}
