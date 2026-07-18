const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');
const path = require('path'); // Requerido para servir el index.html de forma correcta

// 1. Servidor web Express configurado para renderizar tu página web index.html
const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos (aquí es donde Express buscará tu index.html)
app.use(express.static(path.join(__dirname)));

// Cuando alguien visite la URL de Render, se cargará tu archivo index.html automáticamente
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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

// Cooldown para cuidar la cuota gratis de Gemini
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 3000; // Bajado a 3 segundos para mayor fluidez

// Sistema de cola/buffer para mitigar mensajes fragmentados (Ráfagas)
const buffersConversacion = {};

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

// Bucle dinámico independiente para estados autónomos (0 gasto de API en el chat)
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

// Sistema centralizado de peticiones OPTIMIZADO (Texto Plano Puro para evitar bugs)
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
        return "Falta configurar la clave API en las variables de entorno de Render.";
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey.trim()}`;

    // Rediseño de instrucción: Eliminamos el JSON problemático
    const systemInstruction = "Eres Clin, un usuario real e informal en este chat de Discord. Hablas de forma corta (máximo 1 o 2 líneas), todo obligatoriamente en minúsculas, usas xd, pq, tmb, weno, ntp. Sé directo, algo sarcástico, despreocupado y relajado. Responde SOLO con texto plano limpio, sin usar bloques de código de markdown.";

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "ya entendi xd hablare normal en minusculas" }] }
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
            console.error("Error devuelto por la API de Google:", data.error.message);
            return "ando medio sordo xd háblame de nuevo";
        }

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        return "no te entendí ni pío xd";
    } catch (err) {
        console.error("Error crítico en la petición de red:", err);
        return "se me cruzaron los cables xd porfa repite";
    }
}

// 3. Lector de mensajes unificado con buffer inteligente integrado
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
        datosUsuario += ` | Apodo: ${nickname}`;
    }
    datosUsuario += `] dijo: ${contenido}`;

    // Guardar en el historial inmediato
    memoriaCanales[canalId].push({ role: "user", parts: [{ text: datosUsuario }] });
    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05;

    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        
        if (cooldownsCanales.has(canalId)) return;

        if (buffersConversacion[canalId]) {
            clearTimeout(buffersConversacion[canalId]);
        }

        try { await message.channel.sendTyping(); } catch (e) {}

        // Buffer corto de 1 segundo para juntar ráfagas rápidas y responder fluido
        buffersConversacion[canalId] = setTimeout(async () => {
            cooldownsCanales.set(canalId, true);
            setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

            try {
                // Ahora devuelve texto plano directo (Cero bugs de JSON)
                const respuestaTextual = await solicitarRespuestaGemini(canalId, adjuntoIA);

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuestaTextual }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                if (esDM || (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre)) {
                    await message.channel.send(respuestaTextual);
                } else {
                    await message.reply(respuestaTextual);
                }

                // Generar un estado divertido de fondo basado en la lista para no gastar cuota
                const fraseAleatoria = estadosClinFrases[Math.floor(Math.random() * estadosClinFrases.length)];
                actualizarEstadoClin(fraseAleatoria);

            } catch (error) {
                console.error("Error al procesar la respuesta libre en la ráfaga:", error);
            } finally {
                delete buffersConversacion[canalId];
            }
        }, 1000);
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

client.login(process.env.DISCORD_TOKEN);
