const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const express = require('express');

// Mini-servidor para que Render no se duerma
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 ¡Clin está vivo!');
});

app.listen(PORT, () => console.log(`Puerto: ${PORT}`));

// Cliente de Discord
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
    console.log(`🤖 En línea como ${client.user.tag}`);
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
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clin') {
        const pregunta = interaction.options.getString('pregunta');
        const usuarioId = interaction.user.id;

        await interaction.deferReply();

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/clin-bot",
                    "X-Title": "Clin Bot"
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-3-8b-instruct:free", 
                    messages: [
                        { role: "system", content: "Eres Clin, un asistente de Discord." },
                        { role: "user", content: pregunta }
                    ]
                })
            });

            const data = await response.json();
            if (data.choices && data.choices[0]) {
                const respuestaIA = data.choices[0].message.content;
                await interaction.editReply({
                    content: `**Pregunta de** <@${usuarioId}>: *"${pregunta}"*\n\n${respuestaIA}`
                });
            } else {
                throw new Error("Respuesta inválida");
            }
        } catch (error) {
            await interaction.editReply({
                content: `Lo siento <@${usuarioId}>, tuve un problema al conectar con mi cerebro. 😢`
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
