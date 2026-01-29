const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

// ====== CONFIG ======
const ALLOWED_ROLE_ID = '1464635769087066359';      // Role allowed to run this command, set null to allow everyone
const LOG_CHANNEL_ID = '1464356020041023730';        // Optional: channel to log commands

module.exports = {
  data: new SlashCommandBuilder()
    .setName('run-command')
    .setDescription('Run a command in the ERLC in-game server.')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Command to run in ERLC, e.g., :mod <username>')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const command = interaction.options.getString('command');

    // ====== ROLE CHECK ======
    if (ALLOWED_ROLE_ID && !interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({
        content: '🚫 You do not have permission to run this command.',
        ephemeral: true
      });
    }

    try {
      // ====== API REQUEST ======
      const response = await fetch(
        'https://api.policeroleplay.community/v1/server/command',
        {
          method: 'POST',
          headers: {
            "Server-Key": process.env.serverToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ command })
        }
      );

      const text = await response.text();

      // ====== SAFE JSON PARSE ======
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('ERLC API did not return JSON:', text);
        return interaction.reply({
          content: '⚠️ ERLC API is currently unavailable (502/503). Please try again later.',
          ephemeral: true
        });
      }

      // ====== RATE LIMIT OR ERROR CHECK ======
      if (data.message !== 'Success') {
        const retry = data.retry_after ? ` Retry in ${data.retry_after}s.` : '';
        return interaction.reply({
          content: `❌ Command failed: ${data.message}${retry}`,
          ephemeral: true
        });
      }

      // ====== LOG COMMAND SAFELY ======
      if (LOG_CHANNEL_ID) {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (
          logChannel &&
          logChannel.viewable &&
          logChannel.permissionsFor(client.user).has(['SendMessages', 'EmbedLinks'])
        ) {
          const embed = new EmbedBuilder()
            .setTitle('ERLC Command Executed')
            .setColor('#336d91')
            .setDescription(
              `**Discord User:** ${interaction.user.tag}\n` +
              `**Command:** \`${command}\``
            )
            .setTimestamp();
          logChannel.send({ embeds: [embed] }).catch(err => console.error('Log channel send failed:', err));
        } else {
          console.warn('Bot cannot access log channel, skipping log.');
        }
      }

      // ====== SUCCESS RESPONSE ======
      return interaction.reply({
        content: '✅ Command run successfully!',
        ephemeral: true
      });

    } catch (err) {
      console.error('Error running ERLC command:', err);
      return interaction.reply({
        content: '❌ An unexpected error occurred while running the command.',
        ephemeral: true
      });
    }
  }
};
