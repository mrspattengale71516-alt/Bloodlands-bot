require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');
const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commands })
  .then(() => console.log('Bloodlands Trader slash commands registered to the configured guild.'))
  .catch(err => { console.error('Failed to register slash commands:', err); process.exit(1); });
