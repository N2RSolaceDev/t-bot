// === MODULE IMPORTS ===
import express from 'express';
import { config } from 'dotenv';

import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from 'discord.js';

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

// === ENV CONFIG ===
config(); // Load .env variables

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 1000;

// === DISCORD BOT ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// ========================
// 🛠 ENVIRONMENT VARIABLES
// ========================

const {
  TOKEN,
  GUILD_ID,
  AUTO_ROLE_ID,
  WELCOME_CHANNEL_ID,
  REPORTS_CHANNEL_ID,
  STAFF_ROLE_ID,
  TICKET_CATEGORY_NAME,
  PANEL_CHANNEL_ID,
} = process.env;

// ========================
// 🤖 BOT READY
// ========================

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log('🤖 CaughtWiki Bot is now online!');

  const panelChannel = client.channels.cache.get(PANEL_CHANNEL_ID);
  if (!panelChannel) return console.error('❌ Panel channel not found.');

  // Create buttons
  const supportButton = new ButtonBuilder()
    .setCustomId('ticket_support')
    .setLabel('🛠️ Support')
    .setStyle(ButtonStyle.Primary);

  const applyButton = new ButtonBuilder()
    .setCustomId('ticket_apply')
    .setLabel('📝 Apply')
    .setStyle(ButtonStyle.Success);

  const reportButton = new ButtonBuilder()
    .setCustomId('ticket_report')
    .setLabel('🚨 Report')
    .setStyle(ButtonStyle.Danger);

  const appealButton = new ButtonBuilder()
    .setCustomId('ticket_appeal')
    .setLabel('⚖️ Appeal')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(
    supportButton,
    applyButton,
    reportButton,
    appealButton
  );

  const embed = new EmbedBuilder()
    .setTitle('🎫 Open a Ticket')
    .setDescription('Click one of the buttons below to open a ticket.')
    .setColor(0x3498db)
    .setTimestamp();

  // Check for existing panel message
  try {
    const messages = await panelChannel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.embeds[0]?.title === '🎫 Open a Ticket'
    );

    if (existingMessage) {
      await existingMessage.edit({ embeds: [embed], components: [row] });
      console.log('📎 Existing ticket panel updated.');
    } else {
      await panelChannel.send({ embeds: [embed], components: [row] });
      console.log('📩 New ticket panel sent.');
    }
  } catch (error) {
    console.error('❌ Error updating/sending panel:', error.message);
  }
});

// ========================
// 👤 AUTO ROLE ON JOIN
// ========================

client.on('guildMemberAdd', async (member) => {
  const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
  if (role) {
    try {
      await member.roles.add(role);
      console.log(`📎 Assigned role to ${member.user.tag}`);
    } catch (e) {
      console.error(`❌ Could not assign role to ${member.user.tag}`, e);
    }
  }
});

// ========================
// 🎉 WELCOME MESSAGE
// ========================

client.on('guildMemberAdd', async (member) => {
  const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!welcomeChannel) return console.error('❌ Welcome channel not found.');

  const embed = new EmbedBuilder()
    .setTitle('👋 Welcome to CaughtWiki!')
    .setDescription(
      `Hello ${member}, welcome to **CaughtWiki | Exposing Esports**!\n\nRead the rules before participating.\nEnjoy exposing the truth! 🔍`
    )
    .setColor(0x2ecc71)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  await welcomeChannel.send({ embeds: [embed] });
});

// ========================
// 📜 HELP COMMAND
// ========================

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('.') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('📚 Help Center')
      .setDescription('Here are the available commands:')
      .addFields(
        { name: '.help', value: 'Shows this help menu.' },
        { name: '.report @user <reason>', value: 'Opens a ticket and logs a report.' }
      )
      .setColor(0xf1c40f)
      .setTimestamp();

    await message.reply({ embeds: [helpEmbed], ephemeral: true });
  }
});

// ========================
// 🎟️ BUTTON INTERACTIONS
// ========================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const buttonType = interaction.customId;

  if (
    ['ticket_support', 'ticket_apply', 'ticket_report', 'ticket_appeal'].includes(
      buttonType
    )
  ) {
    const guild = interaction.guild;

    let category = guild.channels.cache.find(
      (ch) => ch.type === 4 && ch.name === TICKET_CATEGORY_NAME
    );

    if (!category) {
      category = await guild.channels.create({
        name: TICKET_CATEGORY_NAME,
        type: 4,
      });
    }

    // Check for existing ticket
    const existingChannel = guild.channels.cache.find(
      (ch) =>
        ch.parent?.id === category.id &&
        ch.name.includes(interaction.user.username.toLowerCase())
    );

    if (existingChannel) {
      return interaction.reply({
        content: 'You already have an open ticket!',
        ephemeral: true,
      });
    }

    // Create new ticket
    const ticketType =
      buttonType === 'ticket_support'
        ? 'Support'
        : buttonType === 'ticket_apply'
        ? 'Apply'
        : buttonType === 'ticket_report'
        ? 'Report'
        : 'Appeal';

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: STAFF_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle(`📩 New ${ticketType} Ticket`)
      .setDescription(
        `Hello ${interaction.user}, a staff member will assist you shortly.`
      )
      .setColor(0x2ecc71)
      .setTimestamp();

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('🔒 Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const closeRow = new ActionRowBuilder().addComponents(closeButton);

    await channel.send({ embeds: [embed], components: [closeRow] });

    await interaction.reply({
      content: `Your ticket has been created: ${channel}`,
      ephemeral: true,
    });
  }

  // ========================
  // 🧾 CLOSE TICKET BUTTON
  // ========================

  if (interaction.customId === 'close_ticket') {
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_close')
      .setLabel('✅ Confirm')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_close')
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const replyEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Closure')
      .setDescription('Are you sure you want to close this ticket?')
      .setColor(0xe74c3c)
      .setTimestamp();

    await interaction.reply({ embeds: [replyEmbed], components: [row], ephemeral: true });
  }

  if (interaction.customId === 'confirm_close') {
    const channel = interaction.channel;
    await channel.delete();
  }

  if (interaction.customId === 'cancel_close') {
    await interaction.message.delete();
  }
});

// ========================
// 📝 REPORT COMMAND (.report @user reason)
// ========================

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('.') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'report') {
    const targetUser = message.mentions.users.first() || args[0];
    const reason = args.slice(1).join(' ');

    if (!targetUser || !reason) {
      return message.reply({
        content: '❗ Usage: `.report @user <reason>`',
        ephemeral: true,
      });
    }

    const guild = message.guild;
    const reportsChannel = guild.channels.cache.get(REPORTS_CHANNEL_ID);
    if (!reportsChannel) {
      return message.reply({ content: 'Report channel not found.', ephemeral: true });
    }

    // Create or find ticket category
    let category = guild.channels.cache.find(
      (ch) => ch.type === 4 && ch.name === TICKET_CATEGORY_NAME
    );

    if (!category) {
      category = await guild.channels.create({
        name: TICKET_CATEGORY_NAME,
        type: 4,
      });
    }

    // Create ticket channel
    const channel = await guild.channels.create({
      name: `ticket-${message.author.username}`,
      type: 0,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: message.author.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: STAFF_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle('🚨 Report Filed')
      .setDescription(
        `Filed by: <@${message.author.id}> (${message.author.tag})\nTarget: ${targetUser}\nReason: ${reason}`
      )
      .setColor(0xe74c3c)
      .setTimestamp();

    const closeBtn = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('🔒 Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeBtn);

    await channel.send({ embeds: [embed], components: [row] });

    await message.reply({
      content: `✅ Your report has been submitted and a ticket opened: ${channel}`,
      ephemeral: true,
    });

    // Send log to reports channel
    const logEmbed = new EmbedBuilder()
      .setTitle('🕵️‍♂️ New Report Filed')
      .setDescription(
        `Filed by: <@${message.author.id}>\nTarget: ${targetUser}\nReason: ${reason}`
      )
      .setColor(0xe74c3c)
      .setTimestamp();

    await reportsChannel.send({ embeds: [logEmbed] });
  }
});

// ========================
// 🌐 EXPRESS SERVER FOR RENDER
// ========================

app.get('/', (req, res) => {
  res.send('CaughtWiki Bot is Online!');
});

app.listen(PORT, () => {
  console.log(`🌐 Listening on port ${PORT}`);
});

// ========================
// 🧪 LOGIN
// ========================

client.login(TOKEN);
