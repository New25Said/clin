const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin Optimizado y Despierto está vivo!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// Sistema de Auto-Ping optimizado
setInterval(async () => {
    try {
        await fetch(`https://clin-7bfb.onrender.com/`);
    } catch (e) {
        console.log('Error en auto-ping, ignorando...');
    }
}, 300000); 

// 2. Cliente de Discord configurado correctamente
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

const memoriaCanales = {};
const LIMITE_MEMORIA = 15;
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 5000; // Un toque más humano para proteger tu cuota

// 🧠 BANCO DE RESPUESTAS HUMANAS LOCALES (Por si la API de Gemini colapsa o da error de cuota)
const respuestasFlojeraLocal = [
    "esperate un toque q me dio lag mental",
    "ia va, ando modo flojera xd",
    "se me fue el internet jajsjs esperate",
    "mucho texto mano, toy durmiendo",
    "q quieres csm toy chofleao",
    "recalculando... ando medio tonto ahorita",
    "no jodas un rato q toy jugando nes xd"
];

const estadosLocalesBackup = [
    "viendo el techo",
    "recalculando...",
    "modo chill",
    "con sueño xd",
    "ia vengo"
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

// Bucle dinámico autónomo blindado contra errores de API key o cuota
function iniciarBucleDeEstadosAutonomos() {
    // Espaciado más largo (cada 15 a 30 minutos) para no matar tu cuota gratis
    const tiempoAleatorio = Math.floor(Math.random() * (1800000 - 900000 + 1)) + 900000;
    setTimeout(async () => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Falta API Key");

            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: "Inventa un estado personalizado corto para tu perfil de discord (máximo 4 palabras). Estilo joven de internet, minúsculas, gracioso o existencial. Devuelve SOLO el texto plano sin comillas." }] }]
                })
            });
            const data = await response.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const nuevoEstadoRandom = data.candidates[0].content.parts[0].text.trim();
                actualizarEstadoClin(nuevoEstadoRandom);
            } else {
                throw new Error("Saturado");
            }
        } catch (e) {
            // Si da error de cuota, Clin saca un estado humano de su memoria local sin crashearse
            const estadoBackup = estadosLocalesBackup[Math.floor(Math.random() * estadosLocalesBackup.length)];
            actualizarEstadoClin(estadoBackup);
        }
        iniciarBucleDeEstadosAutonomos();
    }, tiempoAleatorio);
}

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
                                 .substring(0, 500); // Reducido para ahorrar tokens
        return `[Contenido del Link: "${titulo}" -> ${cuerpoLimpio}]`;
    } catch (e) {
        return `[Link ilegible]`;
    }
}

// ARREGLADO: Usamos clientReady para v14/v15 sin warnings molestos en consola
client.once('clientReady', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    iniciarBucleDeEstadosAutonomos();

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

// Sistema centralizado de peticiones blindado
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Falta la API Key en las variables de entorno de Render");

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Eres Clin, un usuario real más del chat, ignorante, sarcástico y despreocupado.
Responde OBLIGATORIAMENTE en un formato JSON plano, sin bloques de código markdown ni \`\`\`. Estructura:
{
  "reply": "tu respuesta corta, informal, sarcástica y en minúsculas",
  "status": "un estado de discord corto (máx 4 palabras) inventado sobre lo que sientes"
}
Reglas: minúsculas siempre, usa abreviaciones (pq, tmb, xd, weno, k, d).`;

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

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
    });

    const responseText = await response.text();
    let data;
    
    try {
        data = JSON.parse(responseText);
    } catch(e) {
        throw new Error("Respuesta de API inválida");
    }

    if (data.error) throw new Error(data.error.message);

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let textoJSON = data.candidates[0].content.parts[0].text.trim();
        
        // Limpieza profunda de formatos raros de markdown
        textoJSON = textoJSON.replace(/^```json/g, "").replace(/^```/g, "").replace(/```$/g, "").trim();

        try {
            return JSON.parse(textoJSON);
        } catch (e) {
            return { reply: textoJSON, status: "modo chill" };
        }
    }
    throw new Error("Estructura desconocida");
}

// 3. Lector de mensajes principal
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
        contenido += ` [El usuario envió un sticker: "${sticker.name}"]`;
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
        datosUsuario += ` | Apodo: ${nickname} | Estado: ${estadoConexion} | Status: "${customStatus}"`;
    }
    datosUsuario += `] dijo: ${contenido}`;

    memoriaCanales[canalId].push({ role: "user", parts: [{ text: datosUsuario }] });
    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05;

    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        
        // 🤫 FILTRO HUMANO DE SPAM LOCAL: Si abusan del bot, responde al toque sin usar tokens
        if (cooldownsCanales.has(canalId)) {
            if (Math.random() < 0.3) {
                try { await message.reply("deja d spamear csm, ando cargando"); } catch(e){}
            }
            return;
        }
        cooldownsCanales.set(canalId, true);
        setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

        // EFECTO HUMANO: "Escribiendo..." realista de inmediato
        try { await message.channel.sendTyping(); } catch (e) {}

        try {
            const resultado = await solicitarRespuestaGemini(canalId, adjuntoIA);

            memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            // Retardo humano artificial proporcional para que parezca que Clin tipea
            const delayTipeo = Math.min(Math.max(resultado.reply.length * 50, 1500), 4000);
            setTimeout(async () => {
                if (esDM) {
                    await message.channel.send(resultado.reply);
                } else {
                    await message.reply(resultado.reply);
                }
                actualizarEstadoClin(resultado.status);
            }, delayTipeo);

        } catch (error) {
            console.error("Error capturado de forma limpia:", error.message);
            
            // 🛡️ SALVACIÓN HUMANA: Si la API colapsa, Clin responde usando su flojera local instantánea
            const respuestaEmergencia = respuestasFlojeraLocal[Math.floor(Math.random() * respuestasFlojeraLocal.length)];
            
            memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuestaEmergencia }] });
            
            setTimeout(async () => {
                await message.reply(respuestaEmergencia);
                actualizarEstadoClin("con lag mental");
            }, 1500);
        }
    }
});

// 4. Comando de barra /clin blindado
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clin') {
        const pregunta = interaction.options.getString('pregunta');
        const canalId = interaction.channel.id;

        await interaction.deferReply();
        if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

        memoriaCanales[canalId].push({
            role: "user",
            parts: [{ text: `[Usuario: ${interaction.user.username}] vía comando: ${pregunta}` }]
        });

        try {
            const resultado = await solicitarRespuestaGemini(canalId);
            memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
            await interaction.editReply({ content: resultado.reply });
            actualizarEstadoClin(resultado.status);
        } catch (error) {
            const respuestaEmergencia = respuestasFlojeraLocal[Math.floor(Math.random() * respuestasFlojeraLocal.length)];
            await interaction.editReply({ content: `❌ ${respuestaEmergencia}` });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
