const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');

// 1. Servidor web Express para que Render no suspenda el servicio
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo y listo para responder!');
});

app.listen(PORT, () => {
    console.log(`Puerto activo: ${PORT}`);
});

// 2. Cliente de Discord (Se eliminó el Warning usando clientReady)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('clientReady', async () => {
    console.log(`🤖 En línea como: ${client.user.tag}`);
    try {
        // Registramos el comando de barra diagonal /clin
        await client.application.commands.set([
            {
                name: 'clin',
                description: 'Pregúntale algo a Clin usando Inteligencia Artificial',
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

        // Le dice a Discord que espere un momento para procesar
        await interaction.deferReply();

        try {
            // Llamamos a OpenRouter usando un modelo gratuito estable (Gemini 2.5 Flash)
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/New25Said/clin",
                    "X-Title": "Clin Bot"
                },
                body: JSON.stringify({
                    model: "google/gemini-2.5-flash:free", 
                    messages: [
                        { 
                            role: "system", 
                            content: "Eres Clin, un asistente de Discord muy amigable, inteligente y directo. Responde siempre en español." 
                        },
                        { 
                            role: "user", 
                            content: pregunta 
                        }
                    ]
                })
            });

            const data = await response.json();
            
            // Imprime en la consola de Render la respuesta para diagnosticar si hay fallas
            console.log("RESPUESTA COMPLETA DE OPENROUTER:", JSON.stringify(data));

            if (data.choices && data.choices[0] && data.choices[0].message) {
                const respuestaIA = data.choices[0].message.content;
                
                // Responder en Discord mencionando al usuario
                await interaction.editReply({
                    content: `**Pregunta de** <@${usuarioId}>: *"${pregunta}"*\n\n${respuestaIA}`
                });
            } else {
                throw new Error("La API no devolvió texto en el formato esperado.");
            }

        } catch (error) {
            console.error("ERROR DETECTADO:", error);
            await interaction.editReply({
                content: `Lo siento <@${usuarioId}>, tuve un problema al conectar con mi cerebro. 😢`
            });
        }
    }
});

// Conectar el bot
client.login(process.env.DISCORD_TOKEN);
