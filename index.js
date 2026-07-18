const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');
const path = require('path');

// =========================================================
// 1. SERVIDOR WEB Y MANTENIMIENTO
// =========================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT} - Sirviendo web de Clin`));

setInterval(async () => {
    try {
        await fetch(`https://clin-7bfb.onrender.com/`);
        console.log('⏰ Auto-ping: Clin sigue despierto.');
    } catch (e) { }
}, 300000);

// =========================================================
// 2. CONFIGURACIÓN DEL CLIENTE
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

const memoriaCanales = {};
const LIMITE_MEMORIA = 15;
const cooldownsCanales = new Map();
const buffersConversacion = {};

// Bandera para gestionar la rehabilitación de la API
let googleBloqueado = false;

// =========================================================
// 3. ESTADOS AUTÓNOMOS (LOCALES)
// =========================================================
const estadosClinFrases = ["saludando gente xd", "viendo memes", "con ganas d molestar", "modo chill", "recalculando", "con sueño xd", "existiendo"];

function actualizarEstadoClin(nuevoEstado) {
    try {
        client.user.setPresence({ activities: [{ name: nuevoEstado, type: ActivityType.Custom }], status: 'online' });
    } catch (err) { }
}

function iniciarBucleDeEstadosAutonomos() {
    setTimeout(() => {
        actualizarEstadoClin(estadosClinFrases[Math.floor(Math.random() * estadosClinFrases.length)]);
        iniciarBucleDeEstadosAutonomos();
    }, 900000); // 15 min
}

// =========================================================
// 4. FUNCIONES DE APOYO
// =========================================================
async function urlToBase64(url) {
    try {
        const res = await fetch(url);
        const buffer = Buffer.from(await res.arrayBuffer());
        return { inlineData: { data: buffer.toString("base64"), mimeType: res.headers.get("content-type") || "image/png" } };
    } catch (e) { return null; }
}

async function rasparLink(url) {
    try {
        const res = await fetch(url);
        const html = await res.text();
        return `[Link: ${html.match(/<title>([^<]+)<\/title>/)?.[1] || "Web"}]`;
    } catch (e) { return "[Link inaccesible]"; }
}

// =========================================================
// 5. MOTOR DE IA (CON MANEJO DE BLOQUEO)
// =========================================================
async function solicitarRespuestaGemini(canalId, adjuntoData = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey.trim()}`;

    const systemInstruction = "Eres Clin, un usuario real, informal, peruano. Hablas MUY corto, en minúsculas, usas xd, pq, tmb. Sé directo. Responde SOLO con texto plano.";
    
    const contents = [{ role: "user", parts: [{ text: systemInstruction }] }, { role: "model", parts: [{ text: "ya entendi xd" }] }];
    if (memoriaCanales[canalId]) contents.push(...memoriaCanales[canalId]);
    if (adjuntoData) contents[contents.length - 1].parts.push(adjuntoData);

    try {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents }) });
        const data = await response.json();

        if (data.error) {
            googleBloqueado = true;
            console.log("⚠️ API BLOQUEADA: Quota excedida.");
            return null;
        }

        // Si llegó aquí, la API funciona
        let respuesta = data.candidates[0].content.parts[0].text.trim();
        
        if (googleBloqueado) {
            googleBloqueado = false;
            return "¡ya volví xd, perdona la demora! " + respuesta;
        }
        return respuesta;

    } catch (err) {
        return null;
    }
}

// =========================================================
// 6. EVENTOS Y LÓGICA
// =========================================================
client.once('clientReady', async () => {
    console.log(`🤖 En línea como: ${client.user.tag}`);
    iniciarBucleDeEstadosAutonomos();
    try {
        await client.application.commands.set([{ name: 'clin', description: 'Pregunta', options: [{ name: 'pregunta', description: '?', type: ApplicationCommandOptionType.String, required: true }] }]);
    } catch (e) { }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

    // Registrar mensaje
    memoriaCanales[canalId].push({ role: "user", parts: [{ text: message.content }] });
    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    if (loMencionan || message.channel.type === 1) {
        
        if (buffersConversacion[canalId]) clearTimeout(buffersConversacion[canalId]);

        buffersConversacion[canalId] = setTimeout(async () => {
            try {
                await message.channel.sendTyping();
                const respuesta = await solicitarRespuestaGemini(canalId);
                
                if (respuesta) {
                    message.reply(respuesta);
                    memoriaCanales[canalId].push({ role: "model", parts: [{ text: respuesta }] });
                } else if (googleBloqueado) {
                    message.reply("ando sordo ahorita por el límite de google, dame un minuto xd");
                }
            } catch (error) { console.error(error); }
        }, 1500);
    }
});

client.login(process.env.DISCORD_TOKEN);
