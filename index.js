const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin Ultra Humano con Visión, DMs y Web Scraping está vivo!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// 2. Cliente de Discord con todos los intents y partials necesarios (incluyendo DMs)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages // Permitir leer DMs
    ],
    partials: [Partials.Channel, Partials.Message] // Necesario para recibir DMs correctamente
});

// Memoria local de los canales y DMs (últimos 15 mensajes)
const memoriaCanales = {};
const LIMITE_MEMORIA = 15;

// Cooldown para cuidar la cuota gratis de Gemini
const cooldownsCanales = new Map();
const TIEMPO_COOLDOWN = 4000;

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

// Bucle dinámico para que Clin cambie su estado SOLO y de la nada (cada 10 a 20 minutos)
function iniciarBucleDeEstadosAutonomos() {
    const tiempoAleatorio = Math.floor(Math.random() * (1200000 - 600000 + 1)) + 600000; // Entre 10 y 20 min
    setTimeout(async () => {
        try {
            // Le pedimos a la IA un estado random rápido basándonos en una petición simple
            const apiKey = process.env.OPENROUTER_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: "Inventa un estado personalizado corto para tu perfil de discord (máximo 4 palabras). Estilo joven de internet, minúsculas, gracioso o existencial. Devuelve SOLO el texto plano." }] }]
                })
            });
            const responseText = await response.text();
            const data = JSON.parse(responseText);
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const nuevoEstadoRandom = data.candidates[0].content.parts[0].text.trim();
                actualizarEstadoClin(nuevoEstadoRandom);
            }
        } catch (e) {
            console.log("No se pudo actualizar el estado autónomo en este ciclo.");
        }
        iniciarBucleDeEstadosAutonomos(); // Re-inicia el ciclo de forma infinita
    }, tiempoAleatorio);
}

// Función auxiliar para pausar la ejecución (simular tiempo de escritura)
const delay = ms => new Promise(res => setTimeout(res, ms));

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
        // Extraemos solo fragmentos limpios de texto (título y párrafos básicos primitivos)
        const titulo = html.match(/<title>([^<]+)<\/title>/)?.[1] || "Web";
        const cuerpoLimpio = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                                 .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
                                 .replace(/<[^>]+>/g, ' ')
                                 .replace(/\s+/g, ' ')
                                 .substring(0, 1000); // Tomamos los primeros 1000 caracteres
        return `[Contenido del Link: "${titulo}" -> ${cuerpoLimpio}]`;
    } catch (e) {
        return `[No se pudo leer el contenido del link: ${url}]`;
    }
}

client.once('clientReady', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    iniciarBucleDeEstadosAutonomos(); // Arranca el cambiador de estados sin mensajes

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
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Eres Clin, un usuario real más en este chat de Discord (puedes hablar tanto en servidores como en DMs privados), un extra es que eres de Peru.
Debes responder obligatoriamente en un formato JSON plano, sin bloques de código de markdown. Estructura exacta:
{
  "reply": "tu respuesta ultra corta, informal, sarcástica y en minúsculas",
  "status": "un estado personalizado d discord (máximo 4 palabras) sobre tu humor o aveces el chat"
}
Reglas: minúsculas siempre, usa abreviaciones d chat (pq, tmb, weno, xd), longitud de 1 o 2 líneas. Si te adjuntan imágenes, stickers o enlaces web, coméntalos de manera natural y divertida.`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: `{"reply": "ya entendi xd", "status": "fino"}` }] }
    ];

    // Pegamos la memoria histórica
    if (memoriaCanales[canalId] && memoriaCanales[canalId].length > 0) {
        contents.push(...memoriaCanales[canalId]);
    }

    // Si el mensaje actual tiene una imagen adjunta procesada, se la inyectamos a la última petición
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
        if (textoJSON.startsWith("```json")) textoJSON = textoJSON.replace(/^```json/, "").replace(/```$/, "").trim();
        else if (textoJSON.startsWith("```")) textoJSON = textoJSON.replace(/^```/, "").replace(/```$/, "").trim();

        try {
            return JSON.parse(textoJSON);
        } catch (e) {
            return { reply: textoJSON, status: "recalculando..." };
        }
    }
    throw new Error("Formato inesperado");
}

// 3. Lector de mensajes unificado (Servidores y DMs privados)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const esDM = message.channel.type === 1; // Tipo 1 es DM privado en discord.js v14
    let contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

    // --- PARTE 1: COMPORTAMIENTO MULTIMODAL (IMÁGENES, STICKERS Y LINKS) ---
    let adjuntoIA = null;

    // Detectar imágenes normales adjuntas
    if (message.attachments.size > 0) {
        const imagen = message.attachments.first();
        if (imagen.contentType?.startsWith("image/")) {
            adjuntoIA = await urlToBase64(imagen.url);
            contenido += " [Te he adjuntado una imagen para que la veas]";
        }
    }

    // Detectar Stickers
    if (message.stickers && message.stickers.size > 0) {
        const sticker = message.stickers.first();
        contenido += ` [El usuario envió un sticker llamado: "${sticker.name}" desde la URL: ${sticker.url}]`;
    }

    // Detectar enlaces web (Web Scraping Básico)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(contenido)) {
        const linksEncontrados = contenido.match(urlRegex);
        const textoWeb = await rasparLink(linksEncontrados[0]);
        contenido += ` ${textoWeb}`;
    }

    // --- PARTE 2: CONTEXTO DEL MENSAJE ---
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

    // --- PARTE 3: DECISIÓN DE RESPUESTA ---
    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05; // Solo habla solo en servidores públicos

    // Clin responde si: Es DM privado OR lo mencionan OR es reply OR dice su nombre OR probabilidad
    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        
        if (cooldownsCanales.has(canalId)) return;
        cooldownsCanales.set(canalId, true);
        setTimeout(() => cooldownsCanales.delete(canalId), TIEMPO_COOLDOWN);

        try { await message.channel.sendTyping(); } catch (e) {}

        const tiempoEscritura = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
        await delay(tiempoEscritura);

        try {
            const resultado = await solicitarRespuestaGemini(canalId, adjuntoIA);

            memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            // Enviar respuesta según el contexto
            if (esDM) {
                await message.channel.send(resultado.reply);
            } else if (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre) {
                await message.channel.send(resultado.reply);
            } else {
                await message.reply(resultado.reply);
            }

            actualizarEstadoClin(resultado.status);
        } catch (error) {
            console.error("Error al procesar la respuesta libre:", error);
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

        memoriaCanales[canalId].push({
            role: "user",
            parts: [{ text: `[Usuario: ${interaction.user.username}] dijo vía comando: ${pregunta}` }]
        });

        await delay(1500);

        try {
            const resultado = await solicitarRespuestaGemini(canalId);
            memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            await interaction.editReply({ content: resultado.reply });
            actualizarEstadoClin(resultado.status);
        } catch (error) {
            await interaction.editReply({ content: "❌ ando medio tonto ahorita." });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
