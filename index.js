import dotenv from 'dotenv';
import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  Collection,
} from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';

// Handle __dirname in ES Module
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Load templates
const templatesDir = path.join(__dirname, 'templates');
const templates = {};
try {
  const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
  for (const file of templateFiles) {
    const name = file.split('.')[0];
    try {
      templates[name] = JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf-8'));
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err.message);
    }
  }
} catch (err) {
  console.error('Error reading templates directory:', err.message);
}

// === DISCORD CLIENT ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
client.commands = new Collection();

// === SLASH COMMAND HANDLER ===
const commands = [];
const commandData = {
  name: 'template',
  description: 'Apply a server template to this guild.',
  options: [
    {
      name: 'name',
      type: 3,
      description: 'Name of the template to apply.',
      required: true,
      choices: Object.keys(templates).map(name => ({ name, value: name })),
    },
  ],
};
commands.push(commandData);
client.commands.set(commandData.name, {
  execute: async interaction => {
    try {
      // Defer reply once
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const templateName = interaction.options.getString('name');
      const template = templates[templateName];
      if (!template) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Error')
              .setDescription('Template not found!')
              .setColor('Red'),
          ],
        });
      }

      const guild = interaction.guild;
      if (!guild) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Error')
              .setDescription('This command must be used in a server.')
              .setColor('Red'),
          ],
        });
      }

      // Apply template
      await applyTemplate(guild, template, interaction);
    } catch (error) {
      console.error('Unexpected error during execution:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred while applying the template.')
                .setColor('Red'),
            ],
            ephemeral: true,
          });
        } else {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Execution Failed')
                .setDescription('There was an error while applying the template.')
                .setColor('Red'),
            ],
          });
        }
      } catch (replyError) {
        console.error('Could not send final reply:', replyError.message);
      }
    }
  },
});

// === LISTEN FOR INTERACTIONS ===
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`Command not found: ${interaction.commandName}`);
    return;
  }
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command "${interaction.commandName}":`, error);
    try {
      if (!interaction.replied || !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: 'There was an error while executing this command!',
          embeds: [],
          components: [],
        });
      }
    } catch (editError) {
      console.error('Failed to respond to interaction:', editError.message);
    }
  }
});

// === TEMPLATE APPLY FUNCTION ===
async function applyTemplate(guild, template, interaction) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  let statusEmbed = new EmbedBuilder()
    .setTitle('🔄 Resetting Server')
    .setDescription('Deleting all roles and channels...')
    .setColor('Yellow');

  try {
    // Defer first
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
    }

    // Save original channel ID before it gets deleted
    const originalChannelId = interaction.channelId;

    // First reply
    await interaction.editReply({ embeds: [statusEmbed] });

    // Delete roles
    const roleCache = guild.roles.cache.filter(r => !r.managed && r.id !== guild.id);
    if (roleCache.size > 0) {
      await Promise.all(
        [...roleCache.values()].map(async role => {
          try {
            await role.delete();
            await delay(200);
          } catch (e) {
            console.warn(`Could not delete role ${role.name}:`, e.message);
          }
        })
      );
    }

    // Delete channels
    const channelCache = guild.channels.cache;
    if (channelCache.size > 0) {
      await Promise.all(
        [...channelCache.values()].map(async channel => {
          try {
            await channel.delete();
            await delay(200);
          } catch (e) {
            console.warn(`Could not delete channel ${channel.name}:`, e.message);
          }
        })
      );
    }

    // Recreate a status channel
    const statusChannel = await guild.channels.create({
      name: 'setup-status',
      type: 0, // Text Channel
    });

    // Function to send status updates via webhook
    const webhook = await statusChannel.createWebhook({
      name: 'Template Status',
    });

    const sendStatus = async embed => {
      await webhook.send({
        embeds: [embed],
      });
    };

    // Rebuild Roles
    statusEmbed.setTitle('🛠️ Creating Roles').setDescription('Rebuilding roles...');
    await sendStatus(statusEmbed);

    const createdRoles = {};
    if (Array.isArray(template.roles)) {
      await Promise.all(
        template.roles.map(async roleData => {
          try {
            const permissions = new PermissionsBitField();
            if (roleData.permissions) {
              permissions.add(roleData.permissions);
            }
            const role = await guild.roles.create({
              name: roleData.name,
              color: roleData.color || 'White',
              hoist: roleData.hoist || false,
              position: roleData.position || 1,
              permissions,
            });
            createdRoles[roleData.name] = role;
            await delay(200);
          } catch (e) {
            console.warn(`Failed to create role "${roleData.name}":`, e.message);
          }
        })
      );
    }

    // Create Categories
    statusEmbed.setTitle('📁 Creating Categories').setDescription('Setting up categories...');
    await sendStatus(statusEmbed);

    const categoryMap = {};
    if (Array.isArray(template.categories)) {
      await Promise.all(
        template.categories.map(async catData => {
          try {
            const category = await guild.channels.create({
              name: catData.name,
              type: 4, // Category
            });
            categoryMap[catData.name] = category;
            await delay(300);
          } catch (e) {
            console.warn(`Failed to create category "${catData.name}":`, e.message);
          }
        })
      );
    }

    // Create Channels
    statusEmbed.setTitle('💬 Creating Channels').setDescription('Creating channels under categories...');
    await sendStatus(statusEmbed);

    if (Array.isArray(template.channels)) {
      await Promise.all(
        template.channels.map(async chanData => {
          try {
            let parent = null;
            if (chanData.parent && categoryMap[chanData.parent]) {
              parent = categoryMap[chanData.parent];
            }
            const permissionOverwrites = [];
            if (
              chanData.permission_overwrites &&
              Array.isArray(chanData.permission_overwrites)
            ) {
              for (const perm of chanData.permission_overwrites) {
                const role =
                  perm.type === 'role' ? createdRoles[perm.id] : perm.id;
                if (!role && perm.id !== '@everyone') continue;
                permissionOverwrites.push({
                  id: perm.id === '@everyone' ? guild.id : role?.id || guild.id,
                  deny: perm.deny ? new PermissionsBitField(perm.deny) : [],
                  allow: perm.allow ? new PermissionsBitField(perm.allow) : [],
                });
              }
            }
            await guild.channels.create({
              name: chanData.name,
              type: chanData.type,
              parent: parent?.id || null,
              permissionOverwrites,
            });
            await delay(300);
          } catch (e) {
            console.warn(`Failed to create channel "${chanData.name}":`, e.message);
          }
        })
      );
    }

    // Final success message
    statusEmbed.setTitle('✅ Success')
      .setDescription(`Successfully applied template: **${template.name}**`)
      .setColor('Green');
    await sendStatus(statusEmbed);

    // Optional: Notify user via ephemeral message
    try {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Done')
            .setDescription('The template has been successfully applied!')
            .setColor('Green'),
        ],
      });
    } catch (e) {
      console.warn('Could not update interaction.');
    }

  } catch (error) {
    console.error('Error applying template:', error);
    try {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('An error occurred while applying the template.')
            .setColor('Red'),
        ],
      });
    } catch (editError) {
      try {
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Error')
              .setDescription('An error occurred while applying the template.')
              .setColor('Red'),
          ],
          ephemeral: true,
        });
      } catch (followUpError) {
        console.error('Failed to send follow-up:', followUpError.message);
      }
    }
  }
}
