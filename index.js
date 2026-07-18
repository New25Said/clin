const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin Optimizado y Despierto está vivo!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// Sistema de Auto-Ping para evitar que Render congele la CPU del bot
setInterval(async () => {
    try {
        await fetch(`https://clin-7bfb.onrender.com/`);
        console.log('⏰ Auto-ping de optimización enviado para mantener despierto a Clin.');
    } catch (e) {
        console.log('Error en auto-ping, ignorando...');
    }
}, 300000); // Cada 5 minutos

// 2. Cliente de Discord con todos los intents y partials necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Memoria local de los canales y DMs (últimos 15 mensajes)
const memoriaCanales = {};
const LIMITE_MEMORIA = 15;

// Cooldown estricto para evitar ráfagas duplicadas peleando por recursos
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 4000;

const delay = ms => new Promise(res => setTimeout(res, ms));

// Función para cambiar el estado de Clin
function actualizarEstadoClin(nuevoEstado) {
    try {
        if (!nuevoEstado) return;
        const limpio = nuevoEstado.replace(/["']/g, "").toLowerCase().trim();
        client.user.setPresence({
            activities: [{ name: limpio, type: ActivityType.Custom }],
            status: 'online'
        });
    } catch (err) {
        console.error("Error al actualizar estado:", err);
    }
}

// Bucle dinámico independiente para estados autónomos libres (gasta 0 cuota de chat)
const estadosClinFrases = [
    "saludando gente xd",
    "viendo memes",
    "con ganas d molestar",
    "modo chill activo",
    "viviendo la vida",
    "recalculando existencia",
    "con sueño xd",
    "viendo que onda",
    "escuchando musica xd"
];

function iniciarBucleDeEstadosAutonomos() {
    const tiempoAleatorio = Math.floor(Math.random() * (1200000 - 600000 + 1)) + 600000;
    setTimeout(() => {
        try {
            const fraseAleatoria = estadosClinFrases[Math.floor(Math.random() * estadosClinFrases.length)];
            actualizarEstadoClin(fraseAleatoria);
        } catch (e) {
            console.log("No se pudo actualizar el estado autónomo.");
        }
        iniciarBucleDeEstadosAutonomos();
    }, tiempoAleatorio);
}

// Función para descargar imágenes y convertirlas a formato Base64 para Gemini
async function urlToBase64(url) {
    try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: res.headers.get("content-type") || "image/png"
            }
        };
    } catch (e) {
        console.error("Error al convertir imagen a Base64:", e);
        return null;
    }
}

// Función de raspado web (Web scraping ultraligero para links)
async function rasparLink(url) {
    try {
        const res = await fetch(url);
        const html = await res.text();
        const titulo = html.match(/<title>([^<]+)<\/title>/)?.[1] || "Web";
        const cuerpoLimpio = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                                 .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
                                 .replace(/<[^>]+>/g, ' ')
                                 .replace(/\s+/g, ' ')
                                 .substring(0, 1000);
        return `[Contenido del Link: "${titulo}" -> ${cuerpoLimpio}]`;
    } catch (e) {
        return `[No se pudo leer el contenido del link: ${url}]`;
    }
}

client.once('clientReady', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    iniciarBucleDeEstadosAutonomos();

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

// Sistema centralizado de peticiones blindado directo a Google AI Studio
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
        return { reply: "❌ no encontré mi clave api en las variables d render", status: "error" };
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey.trim()}`;

    const systemInstruction = `Eres Clin, un usuario real en este chat de Discord.
Debes responder OBLIGATORIAMENTE en un formato JSON plano, sin bloques de código de markdown. Estructura exacta:
{
  "reply": "tu respuesta ultra corta, informal, sarcástica y en minúsculas",
  "status": "un estado de discord corto (máximo 4 palabras) inventado por ti sobre lo que piensas u opinas en este instante"
}
Reglas críticas: 
- Todo en minúsculas. Usa abreviaciones d chat (pq, tmb, xd, weno). 
- El "status" NO puede ser el mensaje del usuario, debe ser algo inventado por ti que simule un pensamiento (ej: "con sueño xd", "recalculando", "modo chill").`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: `{"reply": "ya entendi xd", "status": "fino"}` }] }
    ];

    if (memoriaCanales[canalId] && memoriaCanales[canalId].length > 0) {
        contents.push(...memoriaCanales[canalId]);
    }

    if (adjuntoData && contents.length > 0) {
        const ultimaInteraccion = contents[contents.length - 1];
        if (ultimaInteraccion.role === "user") {
            ultimaInteraccion.parts.push(adjuntoData);
        }
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents })
        });

        const responseText = await response.text();
        let data = JSON.parse(responseText);

        if (data.error) {
            console.error("API Error de Google:", data.error.message);
            return { reply: "ando medio sordo xd háblame de nuevo", status: "recalculando..." };
        }

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let textoJSON = data.candidates[0].content.parts[0].text.trim();
            if (textoJSON.startsWith("```json")) textoJSON = textoJSON.replace(/^```json/, "").replace(/```$/, "").trim();
            else if (textoJSON.startsWith("```")) textoJSON = textoJSON.replace(/^```/, "").replace(/```$/, "").trim();

            try {
                return JSON.parse(textoJSON);
            } catch (e) {
                return { reply: textoJSON, status: "modo chill" };
            }
        }
        return { reply: "me diste un calambre mental xd", status: "recalculando..." };
    } catch (err) {
        console.error("Error en Fetch Google API:", err);
        return { reply: "se me cruzaron los cables xd porfa repite", status: "fino" };
    }
}

// 3. Lector de mensajes unificado con aislamiento asíncrono e hilos independientes por solicitud
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const esDM = message.channel.type === 1;
    let contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

    let adjuntoIA = null;

    if (message.attachments.size > 0) {
        const imagen = message.attachments.first();
        if (imagen.contentType?.startsWith("image/")) {
            adjuntoIA = await urlToBase64(imagen.url);
            contenido += " [Te he adjuntado una imagen para que la veas]";
        }
    }

    if (message.stickers && message.stickers.size > 0) {
        const sticker = message.stickers.first();
        contenido += ` [El usuario envió un sticker. Nombre del sticker: "${sticker.name}". Reacciona a este sticker de forma divertida]`;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(contenido)) {
        const linksEncontrados = contenido.match(urlRegex);
        const textoWeb = await rasparLink(linksEncontrados[0]);
        contenido += ` ${textoWeb}`;
    }

    const username = message.author.username;
    let datosUsuario = `[Usuario: ${username}`;

    if (!esDM && message.member) {
        const nickname = message.member.displayName;
        const presencia = message.member.presence;
        const estadoConexion = presencia ? presencia.status : 'offline/invisible';
        const customStatus = presencia?.activities.find(act => act.type === ActivityType.Custom)?.state || 'ninguno';
        datosUsuario += ` | Apodo: ${nickname} | Estado: ${estadoConexion} | EstadoPersonalizado: "${customStatus}"`;
    }
    datosUsuario += `] dijo: ${contenido}`;

    memoriaCanales[canalId].push({ role: "user", parts: [{ text: datosUsuario }] });
    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05;

    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        
        // Bloqueo estricto del canal para evitar colisión de requests fragmentadas
        if (cooldownsCanales.has(canalId)) return;
        cooldownsCanales.set(canalId, true);
        setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

        // EJECUCIÓN CONCURRENTE EN HILO AISLADO
        (async () => {
            try { await message.channel.sendTyping(); } catch (e) {}

            // Efecto humano de escritura
            await delay(Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000);

            try {
                const resultado = await solicitarRespuestaGemini(canalId, adjuntoIA);

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                if (esDM || (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre)) {
                    await message.channel.send(resultado.reply);
                } else {
                    await message.reply(resultado.reply);
                }

                actualizarEstadoClin(resultado.status);
            } catch (error) {
                console.error("Error en flujo asíncrono concurrente:", error);
            }
        })();
    }
});

// 4. Manejador del comando de barra /clin concurrente
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clin') {
        const pregunta = interaction.options.getString('pregunta');
        const canalId = interaction.channel.id;

        (async () => {
            await interaction.deferReply();
            if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

            memoriaCanales[canalId].push({
                role: "user",
                parts: [{ text: `[Usuario: ${interaction.user.username}] dijo vía comando: ${pregunta}` }]
            });

            try {
                const resultado = await solicitarRespuestaGemini(canalId);
                memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                await interaction.editReply({ content: resultado.reply });
                actualizarEstadoClin(resultado.status);
            } catch (error) {
                await interaction.editReply({ content: "❌ ando medio tonto ahorita." });
            }
        })();
    }
});

client.login(process.env.DISCORD_TOKEN);
