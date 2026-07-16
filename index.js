const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo usando Gemini!');
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

// 3. Manejador del comando /clin
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clin') {
        const pregunta = interaction.options.getString('pregunta');
        const usuarioId = interaction.user.id;

        await interaction.deferReply();

        try {
            // Usamos la variable OPENROUTER_API_KEY que ya tienes configurada
            const apiKey = process.env.OPENROUTER_API_KEY;
            
            // Llamada directa a la API de Google Gemini (Modelo Gemini 1.5 Flash)
            const url = `https://generativetutorial.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Instrucción de sistema: Eres Clin, un bot de Discord muy amigable, divertido, minimalista y directo. Responde siempre en español. Responde a la siguiente consulta del usuario de forma natural:\n\n"${pregunta}"`
                        }]
                    }]
                })
            });

            const data = await response.json();

            // Verificar si la API devolvió la respuesta estructurada correctamente
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                const respuestaIA = data.candidates[0].content.parts[0].text;
                
                await interaction.editReply({
                    content: `**Pregunta de** <@${usuarioId}>: *"${pregunta}"*\n\n${respuestaIA}`
                });
            } else {
                console.log("RESPUESTA EXTRAÑA DE GEMINI:", JSON.stringify(data));
                throw new Error("Formato de respuesta desconocido de la API de Google");
            }

        } catch (error) {
            console.error("ERROR DETECTADO EN GEMINI:", error);
            await interaction.editReply({
                content: `Lo siento <@${usuarioId}>, tuve un problema al conectar con mi cerebro de Google. 😢`
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
