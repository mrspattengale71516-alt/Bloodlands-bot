require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits, REST, Routes,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'ORDER_CHANNEL_ID'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ORDER_CHANNEL_ID = process.env.ORDER_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '';
const TRADER_ACCOUNT = process.env.TRADER_ACCOUNT || 'PayHerFirst';
const DATA_FILE = path.resolve(process.env.DATA_FILE || './data.json');

const { commands } = require('./commands');

function initialData() { return { nextOrderId: 1001, items: [], orders: [] }; }
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return initialData();
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...initialData(), ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [], orders: Array.isArray(parsed.orders) ? parsed.orders : [] };
  } catch (e) {
    console.error('Could not read data file. Refusing to overwrite it:', e.message);
    process.exit(1);
  }
}
let data = loadData();
function saveData() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DATA_FILE);
}
function money(n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function isStaff(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (!STAFF_ROLE_ID) return false;
  const roles = interaction.member?.roles;
  return Boolean(roles?.cache?.has(STAFF_ROLE_ID) || roles?.includes?.(STAFF_ROLE_ID));
}
function staffOnly(interaction) {
  if (isStaff(interaction)) return true;
  interaction.reply({ content: 'This command is for Bloodlands trader staff only.', ephemeral: true }).catch(() => {});
  return false;
}
function orderStatusLabel(status) {
  return ({ pending_payment: 'Awaiting payment', paid: 'Payment verified', ready: 'Ready for pickup', completed: 'Completed', rejected: 'Rejected' })[status] || status;
}
function orderEmbed(order) {
  const embed = new EmbedBuilder().setColor(order.status === 'completed' ? 0x4b9b64 : order.status === 'rejected' ? 0x8f3030 : 0xb77832)
    .setTitle(`Bloodlands Trader Order #${order.id}`)
    .setDescription(`**Status:** ${orderStatusLabel(order.status)}\n**Player:** <@${order.userId}> (${order.username})\n**Item:** ${order.itemName} × ${order.quantity}\n**Total:** $${money(order.total)} Cash\n**Payment recipient:** ${TRADER_ACCOUNT}\n**Notes:** ${order.notes || 'None'}\n**Fulfillment:** Manual in-game trade on PlayStation — no automatic delivery.`)
    .setFooter({ text: `Order ID ${order.id} • Created ${new Date(order.createdAt).toLocaleString('en-US')}` });
  return embed;
}
function orderButtons(order) {
  const disabled = order.status === 'completed' || order.status === 'rejected';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`order_paid:${order.id}`).setLabel('Payment Verified').setStyle(ButtonStyle.Success).setDisabled(disabled || order.status !== 'pending_payment'),
    new ButtonBuilder().setCustomId(`order_ready:${order.id}`).setLabel('Ready for Pickup').setStyle(ButtonStyle.Primary).setDisabled(disabled || order.status !== 'paid'),
    new ButtonBuilder().setCustomId(`order_completed:${order.id}`).setLabel('Complete Order').setStyle(ButtonStyle.Secondary).setDisabled(disabled || order.status !== 'ready'),
    new ButtonBuilder().setCustomId(`order_rejected:${order.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(disabled)
  );
}
async function notifyPlayer(client, order, message) {
  try { const user = await client.users.fetch(order.userId); await user.send(`Bloodlands Trader order #${order.id}: ${message}\nItem: ${order.itemName} × ${order.quantity} • Total: $${money(order.total)} Cash.`); } catch { /* DMs may be disabled */ }
}
async function sendOrderToStaff(client, order) {
  const channel = await client.channels.fetch(ORDER_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('Order channel not found or not a text channel.');
  const msg = await channel.send({ embeds: [orderEmbed(order)], components: [orderButtons(order)] });
  order.staffMessageId = msg.id;
  order.staffChannelId = channel.id;
  saveData();
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', () => console.log(`Bloodlands Trader logged in as ${client.user.tag}`));
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'trader') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'help') {
        return interaction.reply({ ephemeral: true, content: `**Bloodlands Trader**\n/trader shop — browse catalog\n/trader order — place an order\n/trader my-orders — view your orders\n\nOrders are paid manually using .b0ne's /pay command to **${TRADER_ACCOUNT}**. Staff verify payment, then meet you in-game on PlayStation. Items are never delivered automatically.` });
      }
      if (sub === 'shop') {
        if (!data.items.length) return interaction.reply({ ephemeral: true, content: 'The trader catalog is empty. Staff can add items with `/trader add-item`.' });
        const embed = new EmbedBuilder().setColor(0xb77832).setTitle('🏜️ Bloodlands Trader Catalog').setDescription(data.items.map(i => `**${i.name}** — $${money(i.price)} Cash${i.description ? `\n${i.description}` : ''}\nOrder with [36m/trader order[0m [90mitem:${i.name}[0m`).join('\n\n')).setFooter({ text: 'Manual in-game fulfillment • No automatic deliveries' });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (sub === 'order') {
        const itemInput = interaction.options.getString('item', true).trim();
        const item = data.items.find(i => i.name.toLowerCase() === itemInput.toLowerCase());
        if (!item) return interaction.reply({ ephemeral: true, content: `I couldn't find **${itemInput}** in the catalog. Run [36m/trader shop[0m and use the exact item name.` });
        const quantity = interaction.options.getInteger('quantity', true);
        const notes = interaction.options.getString('notes') || '';
        const order = { id: data.nextOrderId++, userId: interaction.user.id, username: interaction.user.tag, itemName: item.name, quantity, unitPrice: item.price, total: Math.round(item.price * quantity * 100) / 100, notes, status: 'pending_payment', createdAt: new Date().toISOString() };
        data.orders.push(order); saveData();
        try { await sendOrderToStaff(client, order); } catch (e) { data.orders = data.orders.filter(o => o.id !== order.id); data.nextOrderId--; saveData(); return interaction.reply({ ephemeral: true, content: 'I could not post your order to the staff channel. Please contact staff; no order was placed.' }); }
        return interaction.reply({ ephemeral: true, content: `Your Bloodlands order **#${order.id}** has been submitted.\n\n**Item:** ${item.name} × ${quantity}\n**Total:** $${money(order.total)} Cash\n**Pay to:** **${TRADER_ACCOUNT}** using .b0ne's [36m/pay[0m command.\n\nYour order remains **Awaiting payment** until staff verifies the transfer. Do not pay twice. Items are handed over manually in-game; nothing is delivered on restart.` });
      }
      if (sub === 'my-orders') {
        const orders = data.orders.filter(o => o.userId === interaction.user.id).slice(-10).reverse();
        if (!orders.length) return interaction.reply({ ephemeral: true, content: 'You have no trader orders yet. Use `/trader shop` to browse the catalog.' });
        return interaction.reply({ ephemeral: true, content: orders.map(o => `**#${o.id}** — ${o.itemName} × ${o.quantity} — $${money(o.total)} — **${orderStatusLabel(o.status)}**`).join('\n') });
      }
      if (sub === 'add-item') {
        if (!staffOnly(interaction)) return;
        const name = interaction.options.getString('name', true).trim();
        const price = Math.round(interaction.options.getNumber('price', true) * 100) / 100;
        const description = interaction.options.getString('description') || '';
        if (data.items.some(i => i.name.toLowerCase() === name.toLowerCase())) return interaction.reply({ ephemeral: true, content: 'An item with that name already exists.' });
        data.items.push({ name, price, description }); saveData();
        return interaction.reply({ ephemeral: true, content: `Added **${name}** at $${money(price)} Cash.` });
      }
      if (sub === 'remove-item') {
        if (!staffOnly(interaction)) return;
        const name = interaction.options.getString('name', true).trim();
        const before = data.items.length; data.items = data.items.filter(i => i.name.toLowerCase() !== name.toLowerCase());
        if (before === data.items.length) return interaction.reply({ ephemeral: true, content: 'No catalog item matched that exact name.' });
        saveData(); return interaction.reply({ ephemeral: true, content: `Removed **${name}** from the catalog. Existing orders are unchanged.` });
      }
      if (sub === 'items') {
        if (!staffOnly(interaction)) return;
        return interaction.reply({ ephemeral: true, content: data.items.length ? data.items.map(i => `**${i.name}** — $${money(i.price)}${i.description ? ` — ${i.description}` : ''}`).join('\n') : 'Catalog is empty.' });
      }
      if (sub === 'orders') {
        if (!staffOnly(interaction)) return;
        const orders = data.orders.slice(-15).reverse();
        if (!orders.length) return interaction.reply({ ephemeral: true, content: 'No orders yet.' });
        return interaction.reply({ ephemeral: true, embeds: orders.slice(0, 10).map(orderEmbed) });
      }
    }
    if (interaction.isButton() && interaction.customId.startsWith('order_')) {
      if (!isStaff(interaction)) return interaction.reply({ ephemeral: true, content: 'Only authorized trader staff can update orders.' });
      const [action, idText] = interaction.customId.split(':');
      const order = data.orders.find(o => o.id === Number(idText));
      if (!order) return interaction.reply({ ephemeral: true, content: 'Order not found.' });
      const next = ({ order_paid: 'paid', order_ready: 'ready', order_completed: 'completed', order_rejected: 'rejected' })[action];
      if (!next) return interaction.reply({ ephemeral: true, content: 'Unknown order action.' });
      const allowed = { pending_payment: ['paid', 'rejected'], paid: ['ready', 'rejected'], ready: ['completed', 'rejected'], completed: [], rejected: [] };
      if (!allowed[order.status]?.includes(next)) return interaction.reply({ ephemeral: true, content: `Order is already **${orderStatusLabel(order.status)}**; this transition is not allowed.` });
      if (next === 'paid') order.paymentVerifiedAt = new Date().toISOString();
      if (next === 'completed') order.completedAt = new Date().toISOString();
      order.status = next; order.updatedAt = new Date().toISOString(); order.updatedBy = interaction.user.id; saveData();
      await interaction.update({ embeds: [orderEmbed(order)], components: [orderButtons(order)] });
      const messages = { paid: 'Staff verified your .b0ne Cash payment. Your order is approved.', ready: 'Your order is ready for pickup. Please arrange an in-game meeting with Bloodlands trader staff.', completed: 'Your order has been marked completed by staff.', rejected: 'Your order was rejected. Please contact Bloodlands staff about payment/refund arrangements.' };
      await notifyPlayer(client, order, messages[next]);
    }
  } catch (e) {
    console.error('Interaction error:', e);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ ephemeral: true, content: 'Something went wrong. Please contact Bloodlands staff.' }).catch(() => {});
  }
});

(async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Registered Bloodlands Trader slash commands.');
  await client.login(TOKEN);
})();
