const { SlashCommandBuilder } = require('@discordjs/builders');
const logger = require('./logger'); // Ensure this is the correct path to your logger

class AddCreditsCommand {
  constructor(creditManager) {
    this.creditManager = creditManager;
    this.data = new SlashCommandBuilder()
      .setName('addcredits')
      .setDescription('Add credits to a user.')
      .addUserOption(option => 
        option.setName('user')
              .setDescription('The user to give credits')
              .setRequired(true))
      .addIntegerOption(option =>
        option.setName('credits')
              .setDescription('The number of credits to add')
              .setRequired(true));
  }

  async execute(interaction) {
    const adminId = "530285329047879681"; // Admin user id

    try {
      // Check if the command user has the admin permission
      if (interaction.user.id !== adminId) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
      }

      const targetUser = interaction.options.getUser('user');
      const creditsToAdd = interaction.options.getInteger('credits');

      logger.info(`Adding ${creditsToAdd} credits to user id: ${targetUser.id}`);

      await this.creditManager.addUserCredits(targetUser.id, creditsToAdd);

      await interaction.reply(`Added ${creditsToAdd} credits to ${targetUser.username}.`);
      logger.info(`Added credits to user id: ${targetUser.id}`);
    } catch (error) {
      logger.error(`Error executing command for user id: ${interaction.user.id}, error: ${error.message}`);
      logger.debug(`Error stack: ${error.stack}`);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Error executing command', ephemeral: true });
      }
    }
  }
}

module.exports = AddCreditsCommand;