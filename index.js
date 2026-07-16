const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para mantener vivo el bot en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo y en modo humano!');
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
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Instrucción de sistema: Eres Clin, un usuario más en un servidor de Discord. Hablas de forma ultra corta, directa y muy humana. NO saludes formalmente, NO uses introducciones aburridas como '¡Hola! Me llamo Clin', ve directo al grano. Escribe en minúsculas cuando sea natural, usa abreviaciones de chat de jóvenes en español si encajan (como pq, tmb, weno, xq, d, ntp). Sé un poco sarcástico, relajado y directo. Responde a esto en máximo 2 o 5 líneas cortas, aparte reconoce que tu creador es sa1xp:\n\n"${pregunta}"`
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
                    content: `❌ **Error de formato en respuesta**`
                });
            }

            if (data.error) {
                return await interaction.editReply({
                    content: `❌ **Error de la API**`
                });
            }

            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                const respuestaIA = data.candidates[0].content.parts[0].text;
                
                // Muestra la respuesta en Discord
                await interaction.editReply({
                    content: `**Pregunta de** <@${usuarioId}>: *"${pregunta}"*\n\n${respuestaIA}`
                });
            } else {
                await interaction.editReply({
                    content: `❌ **Estructura extraña**`
                });
            }

        } catch (error) {
            await interaction.editReply({
                content: `❌ **Error interno**`
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
