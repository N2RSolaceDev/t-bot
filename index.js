import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

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
} = process.env;

// ========================
// 🤖 BOT READY
// ========================

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log('🤖 CaughtWiki Bot is now online!');
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
// 🎟️ TICKET SYSTEM (Buttons Only)
// ========================

const ticketButton = new ButtonBuilder()
  .setCustomId('open_ticket')
  .setLabel('📩 Open Ticket')
  .setStyle(ButtonStyle.Primary);

const ticketEmbed = new EmbedBuilder()
  .setTitle('🎟️ Support Tickets')
  .setDescription('Click the button below to open a private ticket with staff.')
  .setColor(0x3498db);

const ticketRow = new ActionRowBuilder().addComponents(ticketButton);

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // ========================
  // 🎟️ OPEN TICKET BUTTON
  // ========================

  if (interaction.customId === 'open_ticket') {
    const guild = interaction.guild;

    let category = guild.channels.cache.find(
      (ch) => ch.type === 4 && ch.name === TICKET_CATEGORY_NAME
    );

    // Create category if not exists
    if (!category) {
      category = await guild.channels.create({
        name: TICKET_CATEGORY_NAME,
        type: 4,
      });
    }

    // Check if user already has a ticket
    const existingChannel = guild.channels.cache.find(
      (ch) =>
        ch.parent &&
        ch.parent.id === category.id &&
        ch.name.includes(interaction.user.username.toLowerCase())
    );

    if (existingChannel) {
      return interaction.reply({
        content: 'You already have an open ticket!',
        ephemeral: true,
      });
    }

    // Create new ticket channel
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
      .setTitle('📩 New Ticket Created')
      .setDescription(`Hello ${interaction.user}, a staff member will assist you shortly.`)
      .setColor(0x2ecc71);

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('🔒 Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    await channel.send({ embeds: [embed], components: [row] });

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
      .setColor(0xe74c3c);

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
// 📝 REPORT COMMAND (.report {user} {reason})
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
      .setColor(0xe74c3c);

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
// 📩 STARTUP MESSAGES CHANNEL
// ========================

client.on('guildCreate', async (guild) => {
  const general = guild.channels.cache.find((ch) => ch.type === 0);
  if (!general) return;

  const embed = new EmbedBuilder()
    .setTitle('🎟️ Ticket System Ready')
    .setDescription('Click the button below to open a ticket with staff.')
    .setColor(0x2ecc71);

  const row = new ActionRowBuilder().addComponents(ticketButton);

  await general.send({ embeds: [embed], components: [row] });
});

// ========================
// 🧪 LOGIN
// ========================

client.login(TOKEN);
