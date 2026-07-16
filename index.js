const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo, lee el chat y tiene memoria!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// 2. Cliente de Discord con permisos para leer mensajes de texto (GuildMessages, MessageContent)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // OJO: Asegúrate de activar "Message Content Intent" en Discord Developer Portal
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Memoria local para almacenar el historial de cada canal
// Estructura: { "id_del_canal": [ { role: "user"|"model", parts: [...] } ] }
const memoriaCanales = {};
const LIMITE_MEMORIA = 15; // Guarda los últimos 15 mensajes del historial

client.once('clientReady', () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
});

// 3. Lector de mensajes en tiempo real
client.on('messageCreate', async (message) => {
    // Ignorar mensajes de otros bots (o de sí mismo)
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    // Inicializar la memoria del canal si no existe
    if (!memoriaCanales[canalId]) {
        memoriaCanales[canalId] = [];
    }

    // Agregar lo que acaba de decir el usuario a la memoria del canal (para el contexto de Clin)
    // Nota: Aunque Clin no responda a este mensaje específico, guardamos la charla del canal para que sepa de qué están hablando.
    memoriaCanales[canalId].push({
        role: "user",
        parts: [{ text: `${message.author.username} dijo: ${contenido}` }]
    });

    // Mantener la memoria bajo el límite para no consumir RAM de más
    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) {
        memoriaCanales[canalId].shift();
    }

    // Condiciones para que Clin decida RESPONDER:
    // 1. Lo mencionan con @Clin
    // 2. Le responden directamente a uno de sus mensajes (Reply)
    // 3. Escriben la palabra "clin" en el texto
    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");

    // Condición extra: probabilidad aleatoria del 5% de que se meta a la charla de la nada (para iniciar conversación)
    const hablarSoloAleatorio = Math.random() < 0.05; // 0.05 = 5% de probabilidad en cada mensaje enviado en el canal

    if (loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        // Mostrar que Clin "está escribiendo..." en Discord para darle más realismo
        message.channel.sendTyping();

        try {
            const apiKey = process.env.OPENROUTER_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

            // Instrucciones súper estrictas de personalidad humana
            const systemInstruction = `Eres Clin, un usuario real en un servidor de Discord.
Hablas de forma ultra corta, directa y muy informal (estilo chat de jóvenes en español).
- NO saludes formalmente. NO uses introducciones como "como bot de discord" o "hola, soy Clin".
- Escribe en minúsculas de forma natural, usa abreviaciones (pq, tmb, weno, xq, d, ntp).
- Sé un poco sarcástico, divertido, relajado y directo.
- NO uses formato de bot, solo responde como si fueras un miembro más del chat.
- Mantén tus respuestas en 1 o máximo 2 líneas.
- Tienes acceso al historial de la conversación que se te proporciona para que recuerdes qué se ha dicho antes.`;

            // Construimos la petición enviando todo nuestro historial de memoria acumulado
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: memoriaCanales[canalId],
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    }
                })
            });

            const responseText = await response.text();
            let data;
            
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error("Error al parsear JSON:", responseText);
                return;
            }

            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                const respuestaIA = data.candidates[0].content.parts[0].text;

                // Guardamos la respuesta de Clin en la memoria para que recuerde lo que él mismo dijo
                memoriaCanales[canalId].push({
                    role: "model",
                    parts: [{ text: respuestaIA }]
                });

                // Si la memoria excede, limpiamos el mensaje más viejo
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) {
                    memoriaCanales[canalId].shift();
                }

                // Enviar la respuesta LIMPIA (sin el "Tu pregunta de...")
                if (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre) {
                    // Si habló de la nada, solo envía el mensaje normal
                    await message.channel.send(respuestaIA);
                } else {
                    // Si le hablaron a él, responde directamente a ese mensaje
                    await message.reply(respuestaIA);
                }
            }

        } catch (error) {
            console.error("Error al conectar con Gemini:", error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
