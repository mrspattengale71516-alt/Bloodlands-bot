const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('trader').setDescription('Bloodlands Trader commands')
    .addSubcommand(s => s.setName('shop').setDescription('Browse the Bloodlands trader catalog'))
    .addSubcommand(s => s.setName('order').setDescription('Place a manual in-game trader order')
      .addStringOption(o => o.setName('item').setDescription('Exact item name from /trader shop').setRequired(true).setMaxLength(80))
      .addIntegerOption(o => o.setName('quantity').setDescription('How many you want').setRequired(true).setMinValue(1).setMaxValue(100))
      .addStringOption(o => o.setName('notes').setDescription('Optional pickup notes').setRequired(false).setMaxLength(300)))
    .addSubcommand(s => s.setName('my-orders').setDescription('View your recent trader orders'))
    .addSubcommand(s => s.setName('add-item').setDescription('Add an item to the catalog (staff)')
      .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true).setMaxLength(80))
      .addNumberOption(o => o.setName('price').setDescription('Price in Bloodlands Cash').setRequired(true).setMinValue(0.01).setMaxValue(100000000))
      .addStringOption(o => o.setName('description').setDescription('Short description').setRequired(false).setMaxLength(250)))
    .addSubcommand(s => s.setName('remove-item').setDescription('Remove an item from the catalog (staff)')
      .addStringOption(o => o.setName('name').setDescription('Exact item name').setRequired(true).setMaxLength(80)))
    .addSubcommand(s => s.setName('items').setDescription('List catalog items (staff)'))
    .addSubcommand(s => s.setName('orders').setDescription('View recent orders (staff)'))
    .addSubcommand(s => s.setName('help').setDescription('Explain how Bloodlands Trader works'))
    .toJSON()
];

module.exports = { commands };
