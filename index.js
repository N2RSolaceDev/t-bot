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

dotenv.config();

// Load templates
const templatesDir = path.join(__dirname, 'templates');
const templates = {};

try {
  const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
  for (const file of templateFiles) {
    const name = file.split('.')[0];
    templates[name] = JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf-8'));
  }
} catch (err) {
  console.error('Error loading templates:', err.message);
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
      // Only defer once
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
        console.log(`Interaction deferred for ${interaction.commandName}`);
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

      await applyTemplate(guild, template, interaction);
    } catch (error) {
      console.error('Unexpected error:', error);

      if (interaction.replied || interaction.deferred) {
        try {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred while applying the template.')
                .setColor('Red'),
            ],
          });
        } catch (editError) {
          console.error('Failed to send final error reply:', editError);
        }
      } else {
        try {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Unexpected Error')
                .setDescription('An unexpected error occurred while applying the template.')
                .setColor('Red'),
            ],
            ephemeral: true,
          });
        } catch (replyError) {
          console.error('Failed to reply:', replyError);
        }
      }
    }
  },
});

// === LISTEN FOR INTERACTIONS ===
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    try {
      if (!interaction.replied && !interaction.deferred) {
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
    } catch (sendError) {
      console.error('Could not respond to interaction:', sendError);
    }
  }
});

// === TEMPLATE APPLY FUNCTION ===
async function applyTemplate(guild, template, interaction) {
  let statusEmbed = new EmbedBuilder()
    .setTitle('🔄 Resetting Server')
    .setDescription('Deleting all roles and channels...')
    .setColor('Yellow');

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
    }

    await interaction.editReply({ embeds: [statusEmbed], components: [] });

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Delete all roles except @everyone
    const roles = guild.roles.cache.filter(r => !r.managed && r.id !== guild.id);
    await Promise.all(
      roles.map(async ([id, role]) => {
        try {
          await role.delete();
          await delay(200);
        } catch (e) {
          console.warn(`Could not delete role ${role.name}:`, e.message);
        }
      })
    );

    // Delete all channels
    const channels = guild.channels.cache;
    await Promise.all(
      channels.map(async ([id, channel]) => {
        try {
          await channel.delete();
          await delay(200);
        } catch (e) {
          console.warn(`Could not delete channel ${channel.name}:`, e.message);
        }
      })
    );

    // Rebuild Roles
    const createdRoles = {};
    statusEmbed = new EmbedBuilder()
      .setTitle('🛠️ Creating Roles')
      .setDescription('Rebuilding roles...')
      .setColor('Yellow');

    await interaction.editReply({ embeds: [statusEmbed] });

    if (template.roles) {
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
              permissions: permissions,
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
    const categoryMap = {};
    statusEmbed.setTitle('📁 Creating Categories');
    statusEmbed.setDescription('Setting up categories...');
    await interaction.editReply({ embeds: [statusEmbed] });

    if (template.categories) {
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
    statusEmbed.setTitle('💬 Creating Channels');
    statusEmbed.setDescription('Creating channels under categories...');
    await interaction.editReply({ embeds: [statusEmbed] });

    if (template.channels) {
      await Promise.all(
        template.channels.map(async chanData => {
          try {
            let parent = null;
            if (chanData.parent) {
              parent = categoryMap[chanData.parent];
            }

            const permissionOverwrites = [];

            if (chanData.permission_overwrites) {
              for (const perm of chanData.permission_overwrites) {
                const role = perm.type === 'role' ? createdRoles[perm.id] : perm.id;
                if (!role && perm.id !== '@everyone') return;

                permissionOverwrites.push({
                  id: perm.id === '@everyone' ? guild.id : role.id,
                  deny: perm.deny ? new PermissionsBitField(perm.deny) : [],
                  allow: perm.allow ? new PermissionsBitField(perm.allow) : [],
                });
              }
            }

            await guild.channels.create({
              name: chanData.name,
              type: chanData.type,
              parent: parent || null,
              permissionOverwrites,
            });

            await delay(300);
          } catch (e) {
            console.warn(`Failed to create channel "${chanData.name}":`, e.message);
          }
        })
      );
    }

    statusEmbed.setTitle('✅ Success')
      .setDescription(`Successfully applied template: **${template.name}**`)
      .setColor('Green');

    await interaction.editReply({ embeds: [statusEmbed] });
  } catch (error) {
    console.error('Error during template application:', error);
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
      console.error('Could not update interaction:', editError.message);
    }
  }
}

// === DEPLOY SLASH COMMANDS GLOBALLY ===
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands globally.');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Successfully reloaded application commands.');
  } catch (error) {
    console.error('Error while refreshing commands:', error);
  }
})();

// === START WEB SERVER FOR RENDER PORT 10000 ===
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// === LOGIN ===
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
