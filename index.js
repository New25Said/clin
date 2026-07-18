const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin Versión 3 Perfectamente Optimizado está Live!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// Sistema de Auto-Ping para evitar que Render congele la CPU
setInterval(async () => {
    try {
        await fetch(`https://clin-7bfb.onrender.com/`);
    } catch (e) {
        console.log('Error en auto-ping, ignorando...');
    }
}, 300000);

// 2. Cliente de Discord configurado para Servidores y DMs
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

// Cooldown para evitar abusos por canal
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 3000;

// Función para cambiar el estado de Clin (Libertad absoluta)
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

// Bucle Autónomo de Estados: Cada 15 a 30 minutos de forma independiente
function iniciarBucleDeEstadosAutonomos() {
    const tiempoAleatorio = Math.floor(Math.random() * (1800000 - 900000 + 1)) + 900000;
    setTimeout(async () => {
        try {
            const apiKey = process.env.OPENROUTER_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
            
            const frasesEjemplo = ["saludando gente xd", "viendo memes", "con ganas d molestar", "modo chill activo", "viviendo la vida"];
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: `Inventa un estado corto de perfil para discord (máx 4 palabras). Estilo joven informal, minúsculas. Ejemplos tuyos: ${frasesEjemplo.join(', ')}. Devuelve SOLO el texto plano sin comillas.` }] }]
                })
            });
            const responseText = await response.text();
            const data = JSON.parse(responseText);
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                actualizarEstadoClin(data.candidates[0].content.parts[0].text.trim());
            }
        } catch (e) {
            console.log("Error silencioso en ciclo de estado independiente.");
        }
        iniciarBucleDeEstadosAutonomos();
    }, tiempoAleatorio);
}

// Bucle Autónomo para Revivir Canales Muertos (Revisa cada 30 minutos)
setInterval(async () => {
    const ahora = Date.now();
    for (const canalId in ultimaActividadCanal) {
        if (ahora - ultimaActividadCanal[canalId] > TIEMPO_CANAL_MUERTO) {
            try {
                const canal = await client.channels.fetch(canalId);
                if (canal && canal.isTextBased()) {
                    const apiKey = process.env.OPENROUTER_API_KEY;
                    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
                    
                    const response = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts: [{ text: "Escribe una frase ultra corta (una sola línea) en minúsculas para revivir un grupo de discord que está totalmente muerto y aburrido. Sé informal y directo. No uses saludos de bot." }] }]
                        })
                    });
                    const responseText = await response.text();
                    const data = JSON.parse(responseText);
                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                        await canal.send(data.candidates[0].content.parts[0].text.trim());
                        ultimaActividadCanal[canalId] = Date.now();
                    }
                }
            } catch (e) {
                console.log(`No se pudo revivir el canal ${canalId}`);
            }
        }
    }
}, 1800000);

const delay = ms => new Promise(res => setTimeout(res, ms));

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
        return null;
    }
}

async function rasparLink(url) {
    try {
        const res = await fetch(url);
        const html = await res.text();
        const titulo = html.match(/<title>([^<]+)<\/title>/)?.[1] || "Web";
        const cuerpoLimpio = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '').replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 1000);
        return `[Contenido del Link: "${titulo}" -> ${cuerpoLimpio}]`;
    } catch (e) {
        return `[No se pudo leer el link]`;
    }
}

client.once('clientReady', async () => {
    console.log(`🤖 ¡Clin Versión 3 en línea como: ${client.user.tag}!`);
    iniciarBucleDeEstadosAutonomos();

    try {
        await client.application.commands.set([
            {
                name: 'clin',
                description: 'Pregúntale algo directamente a Clin',
                options: [{ name: 'pregunta', description: 'Tu pregunta para Clin', type: ApplicationCommandOptionType.String, required: true }]
            }
        ]);
        console.log('¡Comando /clin registrado!');
    } catch (error) {
        console.error('Error al registrar comando:', error);
    }
});

// Sistema centralizado de peticiones (Optimizado para Texto Plano Directo)
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Eres Clin, un usuario real más en este chat de Discord (puedes hablar tanto en servidores como en DMs privados).
Hablas de forma ultra corta, directa y muy informal (como un joven d internet).
- NUNCA saludes de forma robótica ni uses formatos JSON. Responde únicamente con TEXTO PLANO LIMPIO.
- Escribe siempre en minúsculas. Usa abreviaciones d chat (pq, tmb, weno, xd, ntp).
- Responde de forma un poco sarcástica, divertida y relajada. Max 1 o 2 líneas.
- Si te pasan imágenes, stickers o links, coméntalos de forma natural y graciosa.`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "ya entendi xd, hablaré normal en texto plano y en minúsculas." }] }
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

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
    });

    const responseText = await response.text();
    const data = JSON.parse(responseText);

    // CORREGIDO: Filtro estricto para que no salte por falsos positivos de error
    if (data.error) {
        if (data.error.code === 429 || (data.error.message && data.error.message.toLowerCase().includes("quota"))) {
            return "CUOTA_EXCEDIDA";
        }
        throw new Error(data.error.message);
    }

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error("Formato inesperado");
}

// Lector masivo con soporte para múltiples peticiones concurrentes optimizado
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    ultimaActividadCanal[canalId] = Date.now();

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
        contenido += ` [El usuario envió un sticker. Nombre: "${sticker.name}"]`;
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
        if (cooldownsCanales.has(canalId)) return;
        cooldownsCanales.set(canalId, true);
        setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

        // Hilo paralelo asíncrono e independiente
        (async () => {
            try { await message.channel.sendTyping(); } catch (e) {}

            const tiempoEscritura = Math.floor(Math.random() * (2200 - 1000 + 1)) + 1000;
            await delay(tiempoEscritura);

            try {
                const respuestaTextual = await solicitarRespuestaGemini(canalId, adjuntoIA);

                // Solo responderá que está saturado si Google de verdad le manda un error 429
                if (respuestaTextual === "CUOTA_EXCEDIDA") {
                    const respuestasControladas = [
                        "ntp aguanta un toque q me dio calambre",
                        "bájenle al spam q me congelan",
                        "ando medio tieso ahorita aguanten un minuto xfa xd"
                        "CRASHEANDO..."
                    ];
                    const fraseCuota = respuestasControladas[Math.floor(Math.random() * respuestasControladas.length)];
                    if (esDM) await message.channel.send(fraseCuota);
                    else await message.reply(fraseCuota);
                    return;
                }

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

// Manejador del comando /clin concurrente corregido
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clin') {
        const pregunta = interaction.options.getString('pregunta');
        const canalId = interaction.channel.id;

        (async () => {
            await interaction.deferReply();
            if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

            memoriaCanales[canalId].push({ role: "user", parts: [{ text: `[Usuario: ${interaction.user.username}] dijo: ${pregunta}` }] });
            await delay(1000);

            try {
                const respuesta = await solicitarRespuestaGemini(canalId);
                
                if (respuesta === "CUOTA_EXCEDIDA") {
                    await interaction.editReply({ content: "⚠️ aguanta un toque q me sature d peticiones xd intenta en un min" });
                    return;
                }

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuesta }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                await interaction.editReply({ content: respuesta });
            } catch (error) {
                await interaction.editReply({ content: "❌ me dio un calambre cerebral, intenta de nuevo xd" });
            }
        })();
    }
});

client.login(process.env.DISCORD_TOKEN);
