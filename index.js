const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin Versión 3 Perfectamente Optimizado y Despierto está vivo!');
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

// Control de última actividad por canal (para revivir canales muertos)
const ultimaActividadCanal = {};
const TIEMPO_CANAL_MUERTO = 10800000; // 3 horas

// Cooldown para cuidar la cuota de OpenRouter
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 3000; // 3 segundos para fluidez masiva

// Lista de estados predefinidos: Libertad absoluta sin gastar cuota de IA
const estadosClinFrases = [
    "saludando gente xd",
    "viendo memes",
    "con ganas d molestar",
    "modo chill activo",
    "viviendo la vida",
    "recalculando existencia",
    "con sueño xd",
    "viendo que onda",
    "escuchando musica xd",
    "jugando cositas xd"
];

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

// Bucle dinámico independiente: Cambia estados solo (cada 10 a 20 minutos) con 0 cuota
function iniciarBucleDeEstadosAutonomos() {
    const tiempoAleatorio = Math.floor(Math.random() * (1200000 - 600000 + 1)) + 600000;
    setTimeout(() => {
        try {
            const fraseAleatoria = estadosClinFrases[Math.floor(Math.random() * estadosClinFrases.length)];
            actualizarEstadoClin(fraseAleatoria);
        } catch (e) {
            console.log("Error en ciclo de estado independiente.");
        }
        iniciarBucleDeEstadosAutonomos();
    }, tiempoAleatorio);
}

// Bucle Autónomo para Revivir Canales Muertos (Cada 30 minutos revisa)
setInterval(async () => {
    const ahora = Date.now();
    for (const canalId in ultimaActividadCanal) {
        if (ahora - ultimaActividadCanal[canalId] > TIEMPO_CANAL_MUERTO) {
            try {
                const canal = await client.channels.fetch(canalId);
                if (canal && canal.isTextBased()) {
                    const respuesta = await solicitarRespuestaGemini(canalId);
                    if (respuesta !== "CUOTA_EXCEDIDA") {
                        await canal.send(respuesta);
                        ultimaActividadCanal[canalId] = Date.now(); // Resetea
                    }
                }
            } catch (e) {
                console.log(`No se pudo revivir el canal ${canalId}`);
            }
        }
    }
}, 1800000);

const delay = ms => new Promise(res => setTimeout(res, ms));

// Función para descargar imágenes y convertirlas a formato Base64 para Gemini
async function urlToBase64(url) {
    try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        return {
            inlineData: {
                data: Buffer.from(arrayBuffer).toString("base64"),
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
        return `[Contenido del Link: "${titulo}"]`;
    } catch (e) {
        return `[No se pudo leer el contenido del link]`;
    }
}

client.once('clientReady', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    actualizarEstadoClin("modo chill activo");
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

// Sistema centralizado de peticiones formateado de verdad para OpenRouter AI (Texto Plano Puro)
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const systemInstruction = "Eres Clin, un usuario real e informal en este chat de Discord. Hablas de forma ultra corta (máximo 1 o 2 líneas), siempre en minúsculas, usas xd, pq, tmb, weno, ntp. Sé directo, algo sarcástico y relajado. Responde SOLO en texto plano sin formatos raros.";

    // Mapear historial al formato oficial de OpenRouter (messages)
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
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash", // Modelo óptimo de OpenRouter
                messages: messages
            })
        });

        if (response.status === 429) return "CUOTA_EXCEDIDA";

        const data = await response.json();

        if (data.error) {
            if (data.error.code === 429 || JSON.stringify(data.error).toLowerCase().includes("quota")) {
                return "CUOTA_EXCEDIDA";
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
        throw err;
    }
}

// 3. Lector de mensajes masivo y concurrente (Soporta múltiples requests en paralelo)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    ultimaActividadCanal[canalId] = Date.now(); // Registra actividad para el despertador

    const esDM = message.channel.type === 1;
    let contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

    let adjuntoIA = null;

    // Detectar imágenes normales adjuntas
    if (message.attachments.size > 0) {
        const imagen = message.attachments.first();
        if (imagen.contentType?.startsWith("image/")) {
            adjuntoIA = await urlToBase64(imagen.url);
            contenido += " [Te he adjuntado una imagen]";
        }
    }

    // Detectar Stickers de forma nativa en Discord v14
    if (message.stickers && message.stickers.size > 0) {
        const sticker = message.stickers.first();
        contenido += ` [Sticker enviado por el usuario. Nombre: "${sticker.name}"]`;
    }

    // Detectar enlaces web (Web Scraping Básico)
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
        datosUsuario += ` | Apodo: ${nickname}`;
    }
    datosUsuario += `] dijo: ${contenido}`;

    memoriaCanales[canalId].push({ role: "user", parts: [{ text: datosUsuario }] });
    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05;

    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        if (cooldownsCanales.has(canalId)) return;
        cooldownsCanales.set(canalId, true);
        setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

        // EJECUCIÓN MULTITASKING ASÍNCRONA: Hilo totalmente aislado por petición
        (async () => {
            try { await message.channel.sendTyping(); } catch (e) {}

            const tiempoEscritura = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
            await delay(tiempoEscritura);

            try {
                const respuestaTextual = await solicitarRespuestaGemini(canalId, adjuntoIA);

                // Si hay un 429 real, no responde para no trabarse ni spamear
                if (respuestaTextual === "CUOTA_EXCEDIDA") return;

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuestaTextual }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                if (esDM || (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre)) {
                    await message.channel.send(respuestaTextual);
                } else {
                    await message.reply(respuestaTextual);
                }
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

            memoriaCanales[canalId].push({ role: "user", parts: [{ text: `[Usuario: ${interaction.user.username}] dijo vía comando: ${pregunta}` }] });
            await delay(1000);

            try {
                const respuesta = await solicitarRespuestaGemini(canalId);
                
                if (respuesta === "CUOTA_EXCEDIDA") {
                    await interaction.editReply({ content: "⚠️ ando saturado, dame un break d un min xfa" });
                    return;
                }

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuesta }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                await interaction.editReply({ content: respuesta });
            } catch (error) {
                await interaction.editReply({ content: "❌ me rayé, intenta otra vez xd" });
            }
        })();
    }
});

client.login(process.env.DISCORD_TOKEN);
