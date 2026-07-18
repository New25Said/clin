const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');
const path = require('path');

// 1. Servidor web Express para mantener vivo el bot en Render y servir HTML estático
const app = express();
const PORT = process.env.PORT || 3000;

// Renderización de página HTML (Sirve index.html si existe, o un fallback visual moderno)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.send(`
                <body style="background:#0f0c1b; color:#b39ddb; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                    <div style="text-align:center; padding:20px; border:1px solid #311b92; border-radius:10px; background:#141226;">
                        <h1 style="color:#7c4dff; margin:0 0 10px 0;">🤖 Clin v2</h1>
                        <p style="margin:0; font-size:1.1em;">Optimizado, despierto y procesando de forma orgánica.</p>
                    </div>
                </body>
            `);
        }
    });
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// Sistema de Auto-Ping para evitar que Render congele la CPU
setInterval(async () => {
    try {
        await fetch(`https://clin-7bfb.onrender.com/`);
        console.log('⏰ Auto-ping de optimización enviado.');
    } catch (e) {
        console.log('Error en auto-ping, ignorando...');
    }
}, 300000);

// 2. Cliente de Discord
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

// Memoria local de los canales y DMs
const memoriaCanales = {};
const LIMITE_MEMORIA = 15;

// Cooldown y Control de ráfagas (Aislamiento/Buffers)
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 4000;
const buffersMensajes = new Map(); // Estructura: canalId -> { timeout: NodeJS.Timeout, mensajes: [] }

// Lista de estados locales predefinidos (Humor de internet / No consumen API)
const ESTADOS_LOCALES = [
    "con sueño xd", "recalculando", "modo chill", "viendo el vacio",
    "fino", "jugando al buscaminas", "existiendo nomas", "no se q poner",
    "re piola", "durmiendo parado", "ia chiquita", "tomando awita"
];

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

// Bucle de estados optimizado (Local y orgánico, SIN consumo de API)
function iniciarBucleDeEstadosAutonomos() {
    const tiempoAleatorio = Math.floor(Math.random() * (1200000 - 600000 + 1)) + 600000; // 10 a 20 min
    setTimeout(() => {
        try {
            const estadoRandom = ESTADOS_LOCALES[Math.floor(Math.random() * ESTADOS_LOCALES.length)];
            actualizarEstadoClin(estadoRandom);
        } catch (e) {
            console.log("No se pudo actualizar el estado autónomo local.");
        }
        iniciarBucleDeEstadosAutonomos();
    }, tiempoAleatorio);
}

// Descargar imágenes y convertirlas a Base64
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

// Web scraping ultraligero para links
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

client.once('ready', async () => {
    console.log(`🤖 En línea como: ${client.user.tag}`);
    iniciarBucleDeEstadosAutonomos();

    try {
        await client.application.commands.set([
            {
                name: 'clin',
                description: 'Pregúntale algo directamente a Clin',
                options: [{ name: 'pregunta', description: 'Tu pregunta o mensaje para Clin', type: ApplicationCommandOptionType.String, required: true }]
            }
        ]);
    } catch (error) {
        console.error('Error al registrar comando:', error);
    }
});

// Sistema centralizado de peticiones (Procesamiento de TEXTO PLANO sin forzar JSON)
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Eres Clin, un usuario real en este chat de Discord.
Responde de forma directa en texto plano, de manera ultra corta, informal, sarcástica y en minúsculas. 
Usa abreviaciones de chat (pq, tmb, xd, weno). No estructures JSON ni uses bloques de código markdown.`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "ya entendi xd" }] }
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
    let data = JSON.parse(responseText);

    if (data.error) throw new Error(data.error.message);

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error("Formato inesperado");
}

// Lector de mensajes con aislamiento y control de ráfagas rápidas (Buffer)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const esDM = message.channel.type === 1;
    let contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    // 1. Recolección de adjuntos/datos de contexto inmediatos
    let adjuntoIA = null;
    if (message.attachments.size > 0) {
        const imagen = message.attachments.first();
        if (imagen.contentType?.startsWith("image/")) {
            adjuntoIA = await urlToBase64(imagen.url);
            contenido += " [Te he adjuntado una imagen para que la veas]";
        }
    }

    if (message.stickers && message.stickers.size > 0) {
        contenido += ` [El usuario envió un sticker: "${message.stickers.first().name}"]`;
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

    // 2. Lógica de activación de respuesta
    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05;

    const debeResponder = esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio;

    if (debeResponder) {
        if (cooldownsCanales.has(canalId)) return;

        // Inicializar el búfer para este canal si no existe
        if (!buffersMensajes.has(canalId)) {
            buffersMensajes.set(canalId, { timeout: null, mensajes: [], adjunto: null });
        }

        const bufferActual = buffersMensajes.get(canalId);
        bufferActual.mensajes.push(datosUsuario);
        if (adjuntoIA) bufferActual.adjunto = adjuntoIA; // Guarda el último adjunto enviado en la ráfaga

        // Limpiar el temporizador anterior para refrescar la ventana de espera (recolector de ráfagas)
        if (bufferActual.timeout) clearTimeout(bufferActual.timeout);

        // Configurar la ventana de agrupación (ej. espera 1.5 segundos de silencio antes de procesar todo)
        bufferActual.timeout = setTimeout(async () => {
            buffersMensajes.delete(canalId); // Liberar el búfer del canal
            cooldownsCanales.set(canalId, true);
            setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

            if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];
            
            // Unificar todas las líneas consecutivas acumuladas en un solo bloque coherente
            const bloqueMensajesUnificados = bufferActual.mensajes.join("\n");
            memoriaCanales[canalId].push({ role: "user", parts: [{ text: bloqueMensajesUnificados }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            try { await message.channel.sendTyping(); } catch (e) {}

            try {
                // Petición limpia en texto plano
                const respuestaTexto = await solicitarRespuestaGemini(canalId, bufferActual.adjunto);

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuestaTexto }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                if (esDM || (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre)) {
                    await message.channel.send(respuestaTexto);
                } else {
                    await message.reply(respuestaTexto);
                }

                // Extrae un estado orgánico derivado de su propia respuesta (máximo 4 palabras) o usa uno local
                const lineasRespuesta = respuestaTexto.split(/[.,\n]/);
                const posibleEstado = lineasRespuesta[0].split(" ").slice(0, 4).join(" ");
                actualizarEstadoClin(posibleEstado || ESTADOS_LOCALES[Math.floor(Math.random() * ESTADOS_LOCALES.length)]);

            } catch (error) {
                console.error("Error al procesar la respuesta libre:", error);
            }
        }, 1500); // 1.5 segundos de tolerancia para agrupar ráfagas rápidas
    } else {
        // Si el mensaje es simple y no requiere respuesta, solo se añade de forma directa e independiente a la memoria
        if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];
        memoriaCanales[canalId].push({ role: "user", parts: [{ text: datosUsuario }] });
        if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();
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

        memoriaCanales[canalId].push({
            role: "user",
            parts: [{ text: `[Usuario: ${interaction.user.username}] dijo vía comando: ${pregunta}` }]
        });

        try {
            const respuestaTexto = await solicitarRespuestaGemini(canalId);
            memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuestaTexto }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            await interaction.editReply({ content: respuestaTexto });
            
            const posibleEstado = respuestaTexto.split(/[.,\n]/)[0].split(" ").slice(0, 4).join(" ");
            actualizarEstadoClin(posibleEstado || ESTADOS_LOCALES[Math.floor(Math.random() * ESTADOS_LOCALES.length)]);
        } catch (error) {
            await interaction.editReply({ content: "ando medio tonto ahorita." });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
