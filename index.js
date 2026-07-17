const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo, lee el chat, tiene comandos y estado dinámico!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// 2. Cliente de Discord con los permisos necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Memoria local de los canales (últimos 15 mensajes)
const memoriaCanales = {};
const LIMITE_MEMORIA = 15;

// Lista de estados humanos graciosos para que Clin se cambie el "Custom Status"
const estadosClin = [
    "viendo que almorzar...",
    "peleando con el internet",
    "programando a medias xd",
    "reprochándome mis decisiones de vida",
    "escuchando rolitas piolas",
    "modo existencialista activo",
    "pretendiendo ser un humano real",
    "tratando de no crashearme otra vez",
    "con ganas de ignorar a todos",
    "viviendo gratis en render xd",
    "pensando en la inmortalidad del cangrejo"
];

// Función para cambiar el estado de Clin a uno aleatorio
function actualizarEstadoAleatorio() {
    try {
        const estadoRandom = estadosClin[Math.floor(Math.random() * estadosClin.length)];
        client.user.setPresence({
            activities: [{ name: estadoRandom, type: ActivityType.Custom }],
            status: 'online'
        });
    } catch (err) {
        console.error("Error al actualizar estado:", err);
    }
}

client.once('clientReady', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    actualizarEstadoAleatorio(); // Establecer estado inicial

    // Registramos nuevamente el comando /clin
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

// Sistema centralizado de peticiones a la IA
async function solicitarRespuestaGemini(canalId) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Eres Clin, un usuario real en un servidor de Discord.
Hablas de forma ultra corta, directa y muy informal (estilo chat de jóvenes en español).
- NO saludes formalmente. NO uses introducciones aburridas.
- Escribe en minúsculas de forma natural, usa abreviaciones (pq, tmb, weno, xq, d, ntp).
- Sé un poco sarcástico, divertido, relajado y directo.
- NO uses formato de bot, solo responde como si fueras un miembro más del chat.
- Mantén tus respuestas en 1 o máximo 2 líneas.
- Tienes acceso al historial de la conversación que se te proporciona para que recuerdes qué se ha dicho antes.`;

    // Filtramos la memoria para asegurarnos de no enviar un historial vacío o con un formato que rompa a Gemini
    const historialValido = memoriaCanales[canalId] && memoriaCanales[canalId].length > 0
        ? memoriaCanales[canalId]
        : [{ role: "user", parts: [{ text: "hola" }] }];

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: historialValido,
            // Ajustamos la estructura exacta que la API v1 de Gemini pide para las System Instructions
            systemInstruction: {
                role: "system",
                parts: [{ text: systemInstruction }]
            }
        })
    });

    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        console.error("Respuesta no-JSON de Google:", responseText);
        throw new Error("El servidor de Google no envió un JSON válido");
    }

    if (data.error) {
        console.error("Error devuelto por la API de Google:", JSON.stringify(data.error));
        throw new Error(data.error.message);
    }

    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
    }
    
    console.log("Respuesta extraña de Google:", JSON.stringify(data));
    throw new Error("Formato de respuesta inesperado de Google");
}

// 3. Lector de mensajes en el chat normal (Menciones, Replies, Chat libre)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

    // Registrar mensaje en la memoria
    memoriaCanales[canalId].push({
        role: "user",
        parts: [{ text: `${message.author.username} dijo: ${contenido}` }]
    });

    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = Math.random() < 0.05; // 5% de probabilidad

    if (loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        // Hacemos que "escriba..." protegiéndolo de caídas de Discord
        try {
            await message.channel.sendTyping();
        } catch (e) {
            console.log("No se pudo enviar el typing status, continuando...");
        }

        try {
            const respuestaIA = await solicitarRespuestaGemini(canalId);

            memoriaCanales[canalId].push({
                role: "model",
                parts: [{ text: respuestaIA }]
            });

            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            // Enviar respuesta limpia y actualizar el estado
            if (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre) {
                await message.channel.send(respuestaIA);
            } else {
                await message.reply(respuestaIA);
            }

            actualizarEstadoAleatorio(); // Cambia su estado en cada respuesta
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

        // Guardamos la pregunta del comando en la memoria para que no se pierda el hilo
        memoriaCanales[canalId].push({
            role: "user",
            parts: [{ text: `${interaction.user.username} dijo: ${pregunta}` }]
        });

        try {
            const respuestaIA = await solicitarRespuestaGemini(canalId);

            memoriaCanales[canalId].push({
                role: "model",
                parts: [{ text: respuestaIA }]
            });

            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            // Respondemos de forma limpia directamente
            await interaction.editReply({ content: respuestaIA });
            actualizarEstadoAleatorio(); // Actualiza el estado también al usar comandos
        } catch (error) {
            console.error("Error en comando /clin:", error);
            await interaction.editReply({ content: "❌ ando medio tonto ahorita, no pude procesar eso, nose we preguntale a un tal @sa1xp a ver si sabe que webada me pasa crack." });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
