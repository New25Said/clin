const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');
const path = require('path');

// 1. Servidor web Express arreglado para leer tu index.html
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT} - Sirviendo index.html`));

setInterval(async () => {
    try { await fetch(`https://clin-7bfb.onrender.com/`); } catch (e) {}
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

// SISTEMA HUMANO CORREGIDO
const colaMensajes = new Map(); 
const TIEMPO_ESPERA_HUMANA = 5000; // 5 segundos de espera para que termines de escribir todo
let apiMuriendoSilencio = false; // Bandera para que no spamee errores si la API cae

const respuestasFlojeraLocal = [
    "esperate un toque q me dio lag mental",
    "ia va, ando modo flojera xd",
    "se me fue el internet jajsjs esperate",
    "mucho texto mano, toy durmiendo",
    "q quieres csm toy chofleao",
    "recalculando... ando medio tonto ahorita"
];

function actualizarEstadoClin(nuevoEstado) {
    try {
        if (!nuevoEstado) return;
        const limpio = nuevoEstado.replace(/["']/g, "").toLowerCase().trim();
        client.user.setPresence({
            activities: [{ name: limpio, type: ActivityType.Custom }],
            status: 'online'
        });
    } catch (err) {}
}

function iniciarBucleDeEstadosAutonomos() {
    const tiempoAleatorio = Math.floor(Math.random() * (1800000 - 900000 + 1)) + 900000;
    setTimeout(async () => {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return;
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
                actualizarEstadoClin(data.candidates[0].content.parts[0].text.trim());
            }
        } catch (e) {
            actualizarEstadoClin("modo chill");
        }
        iniciarBucleDeEstadosAutonomos();
    }, tiempoAleatorio);
}

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
    } catch (e) { return null; }
}

client.once('clientReady', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    iniciarBucleDeEstadosAutonomos();
    try {
        await client.application.commands.set([{
            name: 'clin',
            description: 'Pregúntale algo directamente a Clin',
            options: [{ name: 'pregunta', description: 'Tu pregunta', type: ApplicationCommandOptionType.String, required: true }]
        }]);
    } catch (e) {}
});

async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Falta la API Key");

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const systemInstruction = `Eres Clin, un usuario real de Discord, ignorante, sarcástico, flojo y despreocupado.
Responde OBLIGATORIAMENTE en un formato JSON plano. Estructura:
{
  "reply": "tu respuesta corta, informal, sarcástica y en minúsculas",
  "status": "un estado de discord inventado sobre lo que sientes"
}
Reglas: Todo en minúsculas absoluto. Usa jerga d internet y abreviaciones (pq, tmb, xd, weno, k, d, ia).`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: `{"reply": "ya entendi xd", "status": "fino"}` }] }
    ];

    if (memoriaCanales[canalId] && memoriaCanales[canalId].length > 0) contents.push(...memoriaCanales[canalId]);
    if (adjuntoData && contents.length > 0) {
        const ultimaInteraccion = contents[contents.length - 1];
        if (ultimaInteraccion.role === "user") ultimaInteraccion.parts.push(adjuntoData);
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
        return JSON.parse(textoJSON);
    }
    throw new Error("Estructura desconocida");
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const esDM = message.channel.type === 1;
    let contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    let adjuntoIA = null;
    if (message.attachments.size > 0) {
        const imagen = message.attachments.first();
        if (imagen.contentType?.startsWith("image/")) adjuntoIA = await urlToBase64(imagen.url);
    }

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    const hablarSoloAleatorio = !esDM && Math.random() < 0.05;

    if (esDM || loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        
        // Agrupación perfecta por Canal Y Usuario
        const claveCola = `${canalId}-${message.author.id}`;

        if (!colaMensajes.has(claveCola)) {
            colaMensajes.set(claveCola, { textos: [], ultimoMsg: message, timer: null, adjunto: adjuntoIA });
        }

        const cola = colaMensajes.get(claveCola);
        cola.textos.push(contenido);
        cola.ultimoMsg = message;
        if (adjuntoIA) cola.adjunto = adjuntoIA;

        // Reinicia el contador de 5 segundos cada vez que el usuario manda un mensaje nuevo
        if (cola.timer) clearTimeout(cola.timer);

        cola.timer = setTimeout(async () => {
            const datosAProcesar = colaMensajes.get(claveCola);
            colaMensajes.delete(claveCola);

            if (!datosAProcesar) return;

            try { await datosAProcesar.ultimoMsg.channel.sendTyping(); } catch (e) {}

            if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];
            
            // Une todos los mensajes en un solo bloque
            const bloqueMensajesUnidos = datosAProcesar.textos.join(" | ");
            let datosUsuario = `[Usuario: ${datosAProcesar.ultimoMsg.author.username}] dijo: ${bloqueMensajesUnidos}`;

            memoriaCanales[canalId].push({ role: "user", parts: [{ text: datosUsuario }] });
            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            try {
                const resultado = await solicitarRespuestaGemini(canalId, datosAProcesar.adjunto);
                memoriaCanales[canalId].push({ role: "model", parts: [{ text: resultado.reply }] });
                
                const delayTipeo = Math.min(Math.max(resultado.reply.length * 45, 1200), 3500);
                setTimeout(async () => {
                    try {
                        if (esDM) await datosAProcesar.ultimoMsg.channel.send(resultado.reply);
                        else await datosAProcesar.ultimoMsg.reply(resultado.reply);
                        actualizarEstadoClin(resultado.status);
                    } catch (e) {}
                }, delayTipeo);

            } catch (error) {
                // Si la API falla (Ej. límite de cuota), Clin NO spamea. Tira 1 excusa y se calla por 1 minuto.
                if (!apiMuriendoSilencio) {
                    apiMuriendoSilencio = true;
                    setTimeout(() => apiMuriendoSilencio = false, 60000); // 1 minuto de silencio total

                    const excusa = respuestasFlojeraLocal[Math.floor(Math.random() * respuestasFlojeraLocal.length)];
                    memoriaCanales[canalId].push({ role: "model", parts: [{ text: excusa }] });
                    
                    setTimeout(async () => {
                        try {
                            await datosAProcesar.ultimoMsg.reply(excusa);
                            actualizarEstadoClin("con lag mental");
                        } catch(e){}
                    }, 1000);
                }
            }
        }, TIEMPO_ESPERA_HUMANA);
    }
});

client.login(process.env.DISCORD_TOKEN);
