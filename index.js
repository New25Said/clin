const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo y listo usando Gemini oficial!');
});

app.listen(PORT, () => {
    console.log(`Puerto activo: ${PORT}`);
});

// 2. Cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('clientReady', async () => {
    console.log(`🤖 En línea como: ${client.user.tag}`);
    try {
        await client.application.commands.set([
            {
                name: 'clin',
                description: 'Pregúntale algo a Clin usando la IA de Google Gemini',
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
        console.log('¡Comando /clin registrado correctamente!');
    } catch (error) {
        console.error('Error al registrar comando:', error);
    }
});

// 3. Manejador del comando /clin cuando alguien lo usa
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clin') {
        const pregunta = interaction.options.getString('pregunta');
        const usuarioId = interaction.user.id;

        await interaction.deferReply();

        try {
            const apiKey = process.env.OPENROUTER_API_KEY;
            
            // LA LÍNEA MÁGICA CORREGIDA: Usando la API v1 con gemini-2.5-flash
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Instrucción de sistema: Eres Clin, un bot de Discord amigable, divertido, un poco sarcástico pero buena onda. Responde siempre de forma clara, directa y en español. Responde a la siguiente consulta de manera natural:\n\n"${pregunta}"`
                        }]
                    }]
                })
            });

            // Capturamos el texto de la respuesta
            const responseText = await response.text();
            let data;
            
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error("RESPUESTA NO-JSON RECIBIDA DEL SERVIDOR:", responseText);
                throw new Error("El servidor no devolvió una respuesta JSON válida.");
            }

            // Verificamos si la API de Google devolvió la respuesta en el formato correcto
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                const respuestaIA = data.candidates[0].content.parts[0].text;
                
                await interaction.editReply({
                    content: `**Pregunta de** <@${usuarioId}>: *"${pregunta}"*\n\n${respuestaIA}`
                });
            } else {
                console.log("RESPUESTA INESPERADA DE LA API:", JSON.stringify(data));
                throw new Error("La API no devolvió una estructura compatible.");
            }

        } catch (error) {
            console.error("ERROR DETECTADO EN GEMINI:", error);
            await interaction.editReply({
                content: `Lo siento <@${usuarioId}>, tuve un calambre cerebral al intentar procesar eso. 😢`
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
