import express from 'express';
import { config } from 'dotenv';

// Load environment variables
config();

// Discord bot imports
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

// Initialize Express server
const app = express();
const PORT = parseInt(process.env.PORT || '10000');

// Create Discord client
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

// Helper: Check if user has Administrator or specific permission
function hasPermission(member, permission) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(permission)
  );
}

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
// 📜 HELP & MODERATION COMMANDS
// ========================

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('.') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Only allow if member exists
  const member = message.member;
  if (!member) return;

  // ========================
  // 📜 HELP COMMAND
  // ========================

  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('📚 Help Center')
      .setDescription('Here are the available commands:')
      .addFields(
        { name: '.help', value: 'Shows this help menu.' },
        { name: '.report @user <reason>', value: 'Opens a private report ticket with staff.' },
        { name: '.purge [amount]', value: 'Deletes messages (requires ManageMessages).' },
        { name: '.ban @user [reason]', value: 'Bans a user (requires BanMembers).' },
        { name: '.kick @user [reason]', value: 'Kicks a user (requires KickMembers).' },
        { name: '.mute @user [reason]', value: 'Mutes a user (requires ModerateMembers).' },
        { name: '.unmute @user', value: 'Unmutes a user (requires ModerateMembers).' }
      )
      .setColor(0xf1c40f)
      .setTimestamp();

    await message.reply({ embeds: [helpEmbed], ephemeral: true });
  }

  // ========================
  // 🗑️ PURGE COMMAND
  // ========================

  if (command === 'purge') {
    if (!hasPermission(member, PermissionFlagsBits.ManageMessages)) {
      return message.reply({
        content: "🚫 You don't have permission to purge messages.",
        ephemeral: true,
      });
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0 || amount > 100) {
      return message.reply({
        content: '❗ Please specify a number between 1 and 100.',
        ephemeral: true,
      });
    }

    await message.channel.bulkDelete(amount, true);
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Messages Purged')
      .setDescription(`✅ Cleared **${amount}** messages.`)
      .setColor(0xe67e22)
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }

  // ========================
  // ⚠️ BAN COMMAND
  // ========================

  if (command === 'ban') {
    if (!hasPermission(member, PermissionFlagsBits.BanMembers)) {
      return message.reply({
        content: "🚫 You don't have permission to ban users.",
        ephemeral: true,
      });
    }

    const target = message.mentions.members?.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    const reason = args.slice(1).join(' ') || 'No reason provided.';

    if (!target) {
      return message.reply({
        content: '❗ Please mention a valid user.',
        ephemeral: true,
      });
    }

    await target.ban({ reason });
    const embed = new EmbedBuilder()
      .setTitle('🔨 User Banned')
      .setDescription(`<@${target.id}> has been banned.\n**Reason:** ${reason}`)
      .setColor(0xc0392b)
      .setTimestamp();

    await message.reply({ embeds: [embed], ephemeral: true });
  }

  // ========================
  // ⚠️ KICK COMMAND
  // ========================

  if (command === 'kick') {
    if (!hasPermission(member, PermissionFlagsBits.KickMembers)) {
      return message.reply({
        content: "🚫 You don't have permission to kick users.",
        ephemeral: true,
      });
    }

    const target = message.mentions.members?.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    const reason = args.slice(1).join(' ') || 'No reason provided.';

    if (!target) {
      return message.reply({
        content: '❗ Please mention a valid user.',
        ephemeral: true,
      });
    }

    await target.kick(reason);
    const embed = new EmbedBuilder()
      .setTitle('👢 User Kicked')
      .setDescription(`<@${target.id}> has been kicked.\n**Reason:** ${reason}`)
      .setColor(0xe67e22)
      .setTimestamp();

    await message.reply({ embeds: [embed], ephemeral: true });
  }

  // ========================
  // ⚠️ MUTE / TIMEOUT
  // ========================

  if (command === 'mute') {
    if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
      return message.reply({
        content: "🚫 You don't have permission to mute users.",
        ephemeral: true,
      });
    }

    const target = message.mentions.members?.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    const reason = args.slice(1).join(' ') || 'No reason provided.';

    if (!target) {
      return message.reply({
        content: '❗ Please mention a valid user.',
        ephemeral: true,
      });
    }

    await target.timeout(604800000, reason); // 7 days timeout
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Member Muted')
      .setDescription(`<@${target.id}> has been muted.\n**Reason:** ${reason}`)
      .setColor(0xf39c12)
      .setTimestamp();

    await message.reply({ embeds: [embed], ephemeral: true });
  }

  // ========================
  // ⚠️ UNMUTE / REMOVE TIMEOUT
  // ========================

  if (command === 'unmute') {
    if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
      return message.reply({
        content: "🚫 You don't have permission to unmute users.",
        ephemeral: true,
      });
    }

    const target = message.mentions.members?.first() || await message.guild.members.fetch(args[0]).catch(() => null);

    if (!target) {
      return message.reply({
        content: '❗ Please mention a valid user.',
        ephemeral: true,
      });
    }

    await target.timeout(null);
    const embed = new EmbedBuilder()
      .setTitle('✅ Member Unmuted')
      .setDescription(`<@${target.id}> has been unmuted.`)
      .setColor(0x2ecc71)
      .setTimestamp();

    await message.reply({ embeds: [embed], ephemeral: true });
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
      return message.reply({
        content: 'Report channel not found.',
        ephemeral: true,
      });
    }

    // Find or create ticket category
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

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('🔒 Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

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
// 🧾 CLOSE TICKET BUTTON
// ========================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

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
