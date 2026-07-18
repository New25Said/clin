require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuración de la IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "Eres un integrante más del grupo de amigos. Hablas de forma natural, relajada, usas jerga peruana ocasionalmente, eres sarcástico pero buena onda. No actúes como un robot."
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Definir el comando /clin
const commands = [
  new SlashCommandBuilder()
    .setName('clin')
    .setDescription('Pregúntale algo a la IA')
    .addStringOption(option => option.setName('pregunta').setDescription('Tu mensaje').setRequired(true))
];

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  // Registrar comandos globalmente
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'clin') {
    await interaction.deferReply(); // Para que el bot tenga tiempo de pensar
    const pregunta = interaction.options.getString('pregunta');
    
    try {
      const result = await model.generateContent(pregunta);
      const response = result.response.text();
      await interaction.editReply(response);
    } catch (error) {
      console.error(error);
      await interaction.editReply('Oe, me quedé sin señal. Intenta de nuevo.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
