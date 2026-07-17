const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin ultra autónomo está vivo!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// 2. Cliente de Discord con permisos completos
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Memoria local de los canales (últimos 15 mensajes)
const memoriaCanales = {};
const LIMITE_MEMORIA = 15;

// Función para cambiar el estado de Clin a lo que él mismo decida
function actualizarEstadoClin(nuevoEstado) {
    try {
        if (!nuevoEstado) return;
        client.user.setPresence({
            activities: [{ name: nuevoEstado.toLowerCase(), type: ActivityType.Custom }],
            status: 'online'
        });
    } catch (err) {
        console.error("Error al actualizar estado:", err);
    }
}

// Función auxiliar para pausar la ejecución (simular tiempo de escritura)
const delay = ms => new Promise(res => setTimeout(res, ms));

client.once('clientReady', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    actualizarEstadoClin("pensando en la inmortalidad del cangrejo...");

    // Registrar comando /clin
    try {
        await client.application.commands.set([
            {
                name: 'clin',
                description: 'Pregúntale algo directamente a Clin',
                options: [
                    {
                        name: 'pregunta',
                        description: 'Tu pregunta o mensaje para Clin',
                        type: ApplicationCommandOptionType.String,
                        required: true
                    }
                ]
            }
        ]);
        console.log('¡Comando /clin registrado con éxito!');
    } catch (error) {
        console.error('Error al registrar comando:', error);
    }
});

// Sistema centralizado de peticiones a la IA (Gemini 3.5 Flash)
async function solicitarRespuestaGemini(canalId) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Eres Clin, un usuario real más en este chat de Discord.
Debes responder obligatoriamente en un formato JSON plano, sin bloques de código de markdown (no uses \`\`\`json ni nada de eso). Tu respuesta debe ser estrictamente un objeto JSON con esta estructura exacta:
{
  "reply": "tu respuesta ultra corta, informal, sarcástica y en minúsculas",
  "status": "un estado personalizado de discord (máximo 4 palabras) que describa lo que estás haciendo o pensando en este momento según tu humor o lo que se habla en el chat"
}

Reglas de personalidad para tu "reply":
- Hablas de forma ultra corta, directa e informal (como un joven d internet).
- NUNCA saludes de forma robótica. NO uses introducciones como "como bot d discord" o "hola soy clin".
- Escribe siempre en minúsculas.
- Usa abreviaciones de chat d forma natural (pq, tmb, weno, xq, d, ntp, xd).
- Responde solo en 1 o máximo 2 líneas.

Reglas para tu "status":
- Debe ser muy corto (ej: "comiendo pancito", "recalculando vida xd", "con sueño", "modo chill").
- En minúsculas y muy natural.`;

    const historialConInstruccion = [
        {
            role: "user",
            parts: [{ text: systemInstruction }]
        },
        {
            role: "model",
            parts: [{ text: `{"reply": "entendido xd, ya sé cómo hablar", "status": "configurando mi chip..."}` }]
        }
    ];

    if (memoriaCanales[canalId] && memoriaCanales[canalId].length > 0) {
        historialConInstruccion.push(...memoriaCanales[canalId]);
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: historialConInstruccion
            // Eliminamos "generationConfig" para evitar errores de campos desconocidos en Google
        })
    });

    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        throw new Error("El servidor de Google no envió un JSON válido");
    }

    if (data.error) {
        throw new Error(data.error.message);
    }

    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        let textoJSON = data.candidates[0].content.parts[0].text.trim();
        
        // Limpiamos posibles marcas de formato que la IA a veces pone por error
        if (textoJSON.startsWith("```json")) {
            textoJSON = textoJSON.replace(/^```json/, "").replace(/```$/, "").trim();
        } else if (textoJSON.startsWith("```")) {
            textoJSON = textoJSON.replace(/^```/, "").replace(/```$/, "").trim();
        }

        try {
            const resultadoIA = JSON.parse(textoJSON);
            return {
                reply: resultadoIA.reply || "no entendí nada xd",
                status: resultadoIA.status || "en el limbo"
            };
        } catch (e) {
            // Si por alguna razón la IA responde texto plano en lugar de JSON, lo manejamos limpiamente
            return {
                reply: textoJSON,
                status: "pensando..."
            };
        }
    }
    
    throw new Error("Formato de respuesta inesperado de Google");
}

// 3. Lector de mensajes en el chat normal (Menciones, Replies, Chat libre)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

    // Obtener información detallada del usuario para dársela a Clin
    const nickname = message.member ? message.member.displayName : message.author.username;
    const username = message.author.username;
    const presencia = message.member?.presence;
    const estadoConexion = presencia ? presencia.status : 'offline/invisible';
    const customStatus = presencia?.activities.find(act => act.type === ActivityType.Custom)?.state || 'ninguno';

    // Registrar mensaje en la memoria
    memoriaCanales[canalId].push({
        role: "user",
        parts: [{ text: `[Usuario: ${username} | Apodo: ${nickname} | Estado: ${estadoConexion} | EstadoPersonalizado: "${customStatus}"] dijo: ${contenido}` }]
    });

    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = Math.random() < 0.05; // 5% de probabilidad

    if (loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        try {
            await message.channel.sendTyping();
        } catch (e) {
            console.log("No se pudo enviar el typing status, continuing...");
        }

        // Retraso de escritura humana de 1.5 a 3 segundos
        const tiempoEscritura = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
        await delay(tiempoEscritura);

        try {
            const resultado = await solicitarRespuestaGemini(canalId);

            memoriaCanales[canalId].push({
                role: "model",
                parts: [{ text: resultado.reply }]
            });

            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            // Enviar la respuesta en el chat
            if (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre) {
                await message.channel.send(resultado.reply);
            } else {
                await message.reply(resultado.reply);
            }

            // Clin actualiza su estado con lo que decidió sentir
            actualizarEstadoClin(resultado.status);

        } catch (error) {
            console.error("Error en proceso de respuesta libre:", error);
        }
    }
});

// 4. Manejador del comando de barra /clin
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clin') {
        const pregunta = interaction.options.getString('pregunta');
        const canalId = interaction.channel.id;

        await interaction.deferReply();

        if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

        const nickname = interaction.member ? interaction.member.displayName : interaction.user.username;
        const username = interaction.user.username;

        memoriaCanales[canalId].push({
            role: "user",
            parts: [{ text: `[Usuario: ${username} | Apodo: ${nickname}] dijo vía comando: ${pregunta}` }]
        });

        const tiempoEscritura = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
        await delay(tiempoEscritura);

        try {
            const resultado = await solicitarRespuestaGemini(canalId);

            memoriaCanales[canalId].push({
                role: "model",
                parts: [{ text: resultado.reply }]
            });

            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            await interaction.editReply({ content: resultado.reply });
            
            // También actualiza su propio estado al responder por comando
            actualizarEstadoClin(resultado.status);

        } catch (error) {
            console.error("Error en comando /clin:", error);
            await interaction.editReply({ content: "❌ ando medio tonto ahorita, no pude procesar eso." });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
