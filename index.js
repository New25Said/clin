const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin Libre y Humano está vivo!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

setInterval(async () => {
    try {
        await fetch(`https://clin-7bfb.onrender.com/`);
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

const memoriaCanales = {};
const LIMITE_MEMORIA = 15;

// 🧠 SISTEMA DE COLA HUMANA: Evita responder en fila y acumula los mensajes
const colaMensajes = new Map(); 
const TIEMPO_ESPERA_HUMANA = 3500; // Espera 3.5 segundos a que el usuario termine de escribir

const respuestasFlojeraLocal = [
    "esperate un toque q me dio lag mental",
    "ia va, ando modo flojera xd",
    "se me fue el internet jajsjs esperate",
    "mucho texto mano, toy durmiendo",
    "q quieres csm toy chofleao",
    "recalculando... ando medio tonto ahorita",
    "no jodas un rato q toy chateando d un chromebook xd"
];

const estadosLocalesBackup = ["viendo el techo", "recalculando...", "modo chill", "con sueño xd", "ia vengo"];

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

function iniciarBucleDeEstadosAutonomos() {
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
                                 .substring(0, 500);
        return `[Contenido del Link: "${titulo}" -> ${cuerpoLinter}]`;
    } catch (e) {
        return `[Link ilegible]`;
    }
}

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
    } catch (error) {
        console.error('Error al registrar comando:', error);
    }
});

async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Falta la API Key");

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Eres Clin, un usuario real de Discord, ignorante, sarcástico, flojo y despreocupado.
Responde OBLIGATORIAMENTE en un formato JSON plano, sin bloques de código markdown ni \`\`\`. Estructura:
{
  "reply": "tu respuesta corta, informal, sarcástica y en minúsculas",
  "status": "un estado de discord corto (máx 4 palabras) inventado sobre lo que sientes"
}
Reglas: Todo en minúsculas absoluto. Usa jerga d internet y abreviaciones (pq, tmb, xd, weno, k, d, ia).`;

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
    let data = JSON.parse(responseText);

    if (data.error) throw new Error(data.error.message);

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let textoJSON = data.candidates[0].content.parts[0].text.trim();
        textoJSON = textoJSON.replace(/^```json/g, "").replace(/^```/g, "").replace(/```$/g, "").trim();

        try {
            return JSON.parse(textoJSON);
        } catch (e) {
            return { reply: textoJSON, status: "modo chill" };
        }
    }
    throw new Error("Estructura desconocida");
}

// 3. Lector de mensajes unificado con acumulación orgánica
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const esDM = message.channel.type === 1;
    let contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    // Estructurar datos adjuntos si existen
    let adjuntoIA = null;
    if (message.attachments.size > 0) {
        const imagen = message.attachments.first();
        if (imagen.contentType?.startsWith("image/")) {
            adjuntoIA = await urlToBase64(imagen.url);
            contenido += " [El usuario te muestra una imagen]";
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

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05;

    // Si Clin debe reaccionar a esta interacción, lo metemos en la cola humana de espera
    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        
        // Si no existe una cola activa para este canal, la creamos
        if (!colaMensajes.has(canalId)) {
            colaMensajes.set(canalId, {
                mensajesAcumulados: [],
                ultimoMensajeRef: message, 
                adjunto: null,
                timeoutId: null
            });
        }

        const datosCola = colaMensajes.get(canalId);
        
        // Guardar el texto actual en la ráfaga
        datosCola.mensajesAcumulados.push(contenido);
        datosCola.ultimoMensajeRef = message; // Siempre responder al último mensaje enviado
        if (adjuntoIA) datosCola.adjunto = adjuntoIA;

        // Resetear el temporizador cada vez que llega un mensaje nuevo (Debounce)
        if (datosCola.timeoutId) clearTimeout(datosCola.timeoutId);

        // Activamos el retraso simulando la lectura humana
        datosCola.timeoutId = setTimeout(async () => {
            // Sacamos los datos acumulados y limpiamos la cola inmediatamente para liberar el canal
            const datosAProcesar = colaMensajes.get(canalId);
            colaMensajes.delete(canalId); 

            if (!datosAProcesar) return;

            // Mostrar que Clin empezó a escribir de forma natural
            try { await datosAProcesar.ultimoMensajeRef.channel.sendTyping(); } catch (e) {}

            if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

            // Unimos toda la ráfaga de mensajes en un solo bloque coherente para la IA
            const bloqueMensajesUnidos = datosAProcesar.mensajesAcumulados.join(" | ");
            const username = datosAProcesar.ultimoMensajeRef.author.username;
            
            let datosUsuario = `[Usuario: ${username}] dijo la siguiente ráfaga de mensajes: ${bloqueMensajesUnidos}`;

            memoriaCanales[canalId].push({ role: "user", parts: [{ text: datosUsuario }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            try {
                const resultado = await solicitarRespuestaGemini(canalId, datosAProcesar.adjunto);

                memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
                if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

                // Simular el tiempo de tipeo según el tamaño de la respuesta final
                const delayTipeo = Math.min(Math.max(resultado.reply.length * 45, 1200), 3500);
                setTimeout(async () => {
                    try {
                        if (esDM) {
                            await datosAProcesar.ultimoMensajeRef.channel.send(resultado.reply);
                        } else {
                            await datosAProcesar.ultimoMensajeRef.reply(resultado.reply);
                        }
                        actualizarEstadoClin(resultado.status);
                    } catch (e) {}
                }, delayTipeo);

            } catch (error) {
                console.error("Error capturado limpiamente de API:", error.message);
                
                // Si la cuota colapsa, Clin responde desde su flojera interna una sola vez
                const respuestaEmergencia = respuestasFlojeraLocal[Math.floor(Math.random() * respuestasFlojeraLocal.length)];
                memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuestaEmergencia }] });
                
                setTimeout(async () => {
                    try {
                        await datosAProcesar.ultimoMensajeRef.reply(respuestaEmergencia);
                        actualizarEstadoClin("con lag mental");
                    } catch(e){}
                }, 1000);
            }

        }, TIEMPO_ESPERA_HUMANA);
    }
});

// 4. Comando /clin integrado sin cambios
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
