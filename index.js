const { Client, GatewayIntentBits, Partials, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin en su versión final ultra humana está vivo!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// 2. Cliente de Discord con permisos completos (incluyendo Presencias y Miembros)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences, // Para poder leer estados personalizados de la gente
        GatewayIntentBits.GuildMembers   // Para poder leer apodos reales del servidor
    ],
    partials: [Partials.Channel, Partials.Message]
});

// Memoria local de los canales (últimos 15 mensajes)
const memoriaCanales = {};
const LIMITE_MEMORIA = 15;

// Lista de estados humanos graciosos para el "Custom Status" de Clin
const estadosClin = [
    "viendo que almorzar...",
    "peleando con el internet",
    "programando a medias xd",
    "reprochándome mis decisiones de vida",
    "escuchando rolitas piolas",
    "modo existencialista activo",
    "pretendiendo ser un humano real",
    "tratando de no crashearme otra vez",
    "con ganas de ignorar a todos",
    "viviendo gratis en render xd",
    "pensando en la inmortalidad del cangrejo",
    "jugando algo piola",
    "ignorando mis responsabilidades",
    "en mi momento más humilde"
];

// Función para cambiar el estado de Clin de forma orgánica y asíncrona
function actualizarEstadoAleatorio() {
    try {
        const estadoRandom = estadosClin[Math.floor(Math.random() * estadosClin.length)];
        client.user.setPresence({
            activities: [{ name: estadoRandom, type: ActivityType.Custom }],
            status: 'online'
        });
    } catch (err) {
        console.error("Error al actualizar estado:", err);
    }
}

client.once('ready', async () => {
    console.log(`🤖 En línea y observando como: ${client.user.tag}`);
    actualizarEstadoAleatorio(); // Estado inicial al prenderse

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
async function solicitarRespuestaGemini(canalId) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `Instrucción de sistema muy importante: Eres Clin, un usuario real más en este chat de Discord.
Hablas de forma ultra corta, directa y muy informal (como un joven de internet).
- NUNCA saludes de forma robótica. NO uses introducciones como "como bot de discord" o "hola, soy Clin".
- Escribe siempre en minúsculas de forma natural.
- Usa abreviaciones de chat de forma natural si encajan (pq, tmb, weno, xq, d, ntp, xd).
- Sé un poco sarcástico, divertido, relajado y directo.
- Responde a la última intervención usando el contexto anterior de lo que han estado hablando.
- Mantén tus respuestas súper cortas, en una sola línea (máximo 2 líneas si es muy necesario).
- Se te proporciona información de los usuarios (su apodo, estado de conexión y lo que tienen escrito en su actividad de Discord) para que puedas comentar sobre ello con total naturalidad si te preguntan o quieres bromear con eso.`;

    const historialConInstruccion = [
        {
            role: "user",
            parts: [{ text: systemInstruction }]
        },
        {
            role: "model",
            parts: [{ text: "entendido, de ahora en adelante hablaré así, en minúsculas, ultra corto, directo y relajado xd. ¿qué pasó?" }]
        }
    ];

    if (memoriaCanales[canalId] && memoriaCanales[canalId].length > 0) {
        historialConInstruccion.push(...memoriaCanales[canalId]);
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: historialConInstruccion
        })
    });

    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        throw new Error("El servidor de Google no envió un JSON válido");
    }

    if (data.error) {
        throw new Error(data.error.message);
    }

    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error("Formato de respuesta inesperado de Google");
}

// 3. Lector de mensajes en el chat normal (Menciones, Replies, Chat libre)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const canalId = message.channel.id;
    const contenido = message.content.trim();
    const contenidoMinuscula = contenido.toLowerCase();

    if (!memoriaCanales[canalId]) memoriaCanales[canalId] = [];

    // Obtener información detallada del usuario para dársela a Clin
    const nickname = message.member ? message.member.displayName : message.author.username;
    const username = message.author.username;
    const presencia = message.member?.presence;
    const estadoConexion = presencia ? presencia.status : 'offline/invisible';
    
    // Obtener su estado personalizado de Discord si tiene uno puesto
    const customStatus = presencia?.activities.find(act => act.type === ActivityType.Custom)?.state || 'ninguno';

    // Registrar mensaje en la memoria con todos los datos contextuales del "humano"
    memoriaCanales[canalId].push({
        role: "user",
        parts: [{ text: `[Usuario: ${username} | Apodo: ${nickname} | Estado: ${estadoConexion} | EstadoPersonalizado: "${customStatus}"] dijo: ${contenido}` }]
    });

    if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

    const loMencionan = message.mentions.has(client.user);
    const esRespuestaAClin = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;
    const diceSuNombre = contenidoMinuscula.includes("clin");
    
    // 5% de probabilidad de meterse a la charla de la nada
    const hablarSoloAleatorio = Math.random() < 0.05; 

    if (loMencionan || esRespuestaAClin || diceSuNombre || hablarSoloAleatorio) {
        // Activamos la burbuja verde de "Escribiendo..." con total protección contra caídas de Discord
        try {
            await message.channel.sendTyping();
        } catch (e) {
            console.log("No se pudo enviar el typing status, continuando...");
        }

        try {
            const respuestaIA = await solicitarRespuestaGemini(canalId);

            memoriaCanales[canalId].push({
                role: "model",
                parts: [{ text: respuestaIA }]
            });

            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            // Enviar respuesta limpia
            if (hablarSoloAleatorio && !loMencionan && !esRespuestaAClin && !diceSuNombre) {
                await message.channel.send(respuestaIA);
            } else {
                await message.reply(respuestaIA);
            }

            // Cambiar estado de forma orgánica al azar (no siempre, solo el 40% de las veces que responde para que se vea real)
            if (Math.random() < 0.40) {
                actualizarEstadoAleatorio();
            }
        } catch (error) {
            console.error("Error en proceso de respuesta libre:", error);
        }
    } else {
        // Si Clin solo lee el chat de fondo y no responde, tiene un 2% de probabilidad de cambiar su estado
        // Esto hace que cambie su estado de la nada mientras ustedes hablan, ¡súper realista!
        if (Math.random() < 0.02) {
            actualizarEstadoAleatorio();
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

        const nickname = interaction.member ? interaction.member.displayName : interaction.user.username;
        const username = interaction.user.username;

        memoriaCanales[canalId].push({
            role: "user",
            parts: [{ text: `[Usuario: ${username} | Apodo: ${nickname}] dijo vía comando: ${pregunta}` }]
        });

        try {
            const respuestaIA = await solicitarRespuestaGemini(canalId);

            memoriaCanales[canalId].push({
                role: "model",
                parts: [{ text: respuestaIA }]
            });

            if (memoriaCanales[canalId].length > LIMITE_MEMORIA) memoriaCanales[canalId].shift();

            await interaction.editReply({ content: respuestaIA });
            
            // Probabilidad orgánica de cambiar estado tras el comando
            if (Math.random() < 0.40) {
                actualizarEstadoAleatorio();
            }
        } catch (error) {
            console.error("Error en comando /clin:", error);
            await interaction.editReply({ content: "❌ ando medio tonto ahorita, no pude procesar eso." });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
