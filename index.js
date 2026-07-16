const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo y listo usando Gemini oficial!');
});

app.listen(PORT, () => console.log(`Puerto activo: ${PORT}`));

// 2. Cliente de Discord
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('clientReady', async () => {
    console.log(`🤖 En línea como: ${client.user.tag}`);
    try {
        await client.application.commands.set([
            {
                name: 'clin',
                description: 'Pregúntale algo a Clin',
                options: [
                    {
                        name: 'pregunta',
                        description: 'Tu pregunta para Clin',
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
            const apiKey = process.env.OPENROUTER_API_KEY;
            
            // Usamos la API v1beta con el modelo de producción super estable gemini-1.5-flash
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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

            const responseText = await response.text();
            let data;
            
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                return await interaction.editReply({
                    content: `❌ **Google devolvió HTML en vez de JSON:**\n\`\`\`html\n${responseText.substring(0, 1500)}\n\`\`\``
                });
            }

            // Si la API responde con un error estructurado en JSON
            if (data.error) {
                return await interaction.editReply({
                    content: `❌ **Error de la API de Google:**\n\`\`\`json\n${JSON.stringify(data.error, null, 2)}\n\`\`\``
                });
            }

            // Si todo está bien, extrae el texto
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                const respuestaIA = data.candidates[0].content.parts[0].text;
                await interaction.editReply({
                    content: `**Pregunta de** <@${usuarioId}>: *"${pregunta}"*\n\n${respuestaIA}`
                });
            } else {
                await interaction.editReply({
                    content: `❌ **Estructura extraña recibida:**\n\`\`\`json\n${JSON.stringify(data, null, 2).substring(0, 1500)}\n\`\`\``
                });
            }

        } catch (error) {
            await interaction.editReply({
                content: `❌ **Error interno del código:**\n\`\`\`text\n${error.message}\n\`\`\``
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
