const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');
const path = require('path');

// =========================================================
// 1. SERVIDOR WEB Y MANTENIMIENTO (RENDER)
// =========================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT} - Sirviendo web de Clin`));

// Auto-ping para que Render no suspenda el bot
setInterval(async () => {
    try {
        await fetch(`https://clin-7bfb.onrender.com/`);
        console.log('⏰ Auto-ping: Clin sigue despierto.');
    } catch (e) {
        console.log('Auto-ping falló (normal si está reiniciando).');
    }
}, 300000); // 5 minutos

// =========================================================
// 2. CONFIGURACIÓN DEL CLIENTE DISCORD
// =========================================================
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

// Memoria y mitigación de ráfagas
const memoriaCanales = {};
const LIMITE_MEMORIA = 15;
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 3000; 
const buffersConversacion = {};

// =========================================================
// 3. SISTEMA DE ESTADOS AUTÓNOMOS (SIN GASTAR API)
// =========================================================
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
    "ignorando mensajes xd",
    "jugando cositas",
    "existiendo y ya"
];

function actualizarEstadoClin(nuevoEstado) {
    try {
        if (!nuevoEstado) return;
        client.user.setPresence({
            activities: [{ name: nuevoEstado, type: ActivityType.Custom }],
            status: 'online'
        });
    } catch (err) {
        console.error("Error al actualizar estado local:", err);
    }
}

function iniciarBucleDeEstadosAutonomos() {
    const tiempoAleatorio = Math.floor(Math.random() * (1200000 - 600000 + 1)) + 600000; // 10 a 20 min
    setTimeout(() => {
        try {
            const fraseAleatoria = estadosClinFrases[Math.floor(Math.random() * estadosClinFrases.length)];
            actualizarEstadoClin(fraseAleatoria);
        } catch (e) {
            console.log("Error leve en bucle de estados.");
        }
        iniciarBucleDeEstadosAutonomos();
    }, tiempoAleatorio);
}

// =========================================================
// 4. FUNCIONES MULTIMODALES (IMÁGENES Y LINKS)
// =========================================================
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
        return null;
    }
}

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
        return `[Link inaccesible: ${url}]`;
    }
}

// =========================================================
// 5. MOTOR DE INTELIGENCIA ARTIFICIAL (GEMINI PURO TEXTO)
// =========================================================
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return "Falta la API Key en Render we.";

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey.trim()}`;

    // Instrucción de personalidad clara, sin forzar JSON
    const systemInstruction = "Eres Clin, un usuario real e informal en este chat de Discord. Eres de Perú. Hablas de forma MUY corta (1 o 2 líneas), todo obligatoriamente en minúsculas, usas abreviaciones como xd, pq, tmb, weno, ntp. Sé directo, a veces sarcástico, y despreocupado. Responde SOLO con el texto que dirías en el chat, NUNCA uses bloques de código ni formatos raros.";

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "ya entendi xd hablare normal" }] }
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

        // CAPTURA DE ERRORES LIMPIA (Si te pasas de límite, dice esto y no crashea)
        if (data.error) {
            console.log(`⚠️ Límite de Google o Error: ${data.error.message}`);
            return "ando medio sordo ahorita xd dame un minuto y repite";
        }

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        return "me quedé en blanco xd";
    } catch (err) {
        console.log(`⚠️ Error crítico de red en Gemini:`, err.message);
        return "se me fue el internet mental xd";
    }
}

// =========================================================
// 6. EVENTOS DE DISCORD
// =========================================================
client.once('ready', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    iniciarBucleDeEstadosAutonomos();

    try {
        await client.application.commands.set([
            {
                name: 'clin',
                description: 'Pregúntale algo directamente a Clin',
                options: [{
                    name: 'pregunta',
                    description: 'Tu pregunta o mensaje para Clin',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }]
            }
        ]);
        console.log('✅ Comando /clin registrado.');
    } catch (error) {
        console.error('Error registrando comando:', error);
    }
});

// Lector de mensajes unificado con buffer Anti-Ráfagas
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
        contenido += ` [Sticker recibido: "${sticker.name}"]`;
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
        const estadoConexion = presencia ? presencia.status : 'offline';
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

    // Solo procede si le hablan a él
    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        
        if (cooldownsCanales.has(canalId)) return;

        // Limpiar el temporizador si el usuario manda varios mensajes rápidos seguidos
        if (buffersConversacion[canalId]) {
            clearTimeout(buffersConversacion[canalId]);
        }

        try { await message.channel.sendTyping(); } catch (e) {}

        // Espera 1.5s antes de mandar a procesar, para agrupar mensajes
        buffersConversacion[canalId] = setTimeout(async () => {
            cooldownsCanales.set(canalId, true);
            setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

            try {
                const respuestaTextual = await solicitarRespuestaGemini(canalId, adjuntoIA);

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuestaTextual }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                if (esDM || (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre)) {
                    await message.channel.send(respuestaTextual);
                } else {
                    await message.reply(respuestaTextual);
                }

                // Generar un estado aleatorio después de hablar
                const fraseAleatoria = estadosClinFrases[Math.floor(Math.random() * estadosClinFrases.length)];
                actualizarEstadoClin(fraseAleatoria);

            } catch (error) {
                console.error("Error en buffer de respuesta:", error);
            } finally {
                delete buffersConversacion[canalId];
            }
        }, 1500); 
    }
});

// Manejador del comando de barra /clin
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
            const resultadoTextual = await solicitarRespuestaGemini(canalId);
            memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultadoTextual }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            await interaction.editReply({ content: resultadoTextual });
            
            const fraseAleatoria = estadosClinFrases[Math.floor(Math.random() * estadosClinFrases.length)];
            actualizarEstadoClin(fraseAleatoria);
        } catch (error) {
            await interaction.editReply({ content: "❌ ando medio tonto ahorita." });
        }
    }
});

// =========================================================
// 7. ARRANQUE DEL BOT
// =========================================================
client.login(process.env.DISCORD_TOKEN);
