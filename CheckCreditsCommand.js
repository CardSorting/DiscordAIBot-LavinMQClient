const { SlashCommandBuilder } = require('@discordjs/builders');
const creditslog = require('./credit');

class CheckCreditsCommand {
  constructor(creditManager) {
    this.creditManager = creditManager;
    this.data = new SlashCommandBuilder()
      .setName('checkcredits')
      .setDescription('Check your available credits.');
  }

  async execute(interaction) {
    const userId = interaction.user.id;
    try {
      creditslog.info(`User ${userId} started the process of checking credits.`);
      const interactionStr = JSON.stringify(interaction, (_, v) => typeof v === 'bigint' ? v.toString() : v);
      creditslog.debug(`Interaction object: ${interactionStr}`);

      // Fetch user's credits
      const userCredits = await this.creditManager.fetchUserCredits(userId);

      // Reply to the user with the credit info
      await interaction.reply(`You have ${userCredits.credits} credits.`);
      creditslog.info(`User ${userId} checked their credits. They have ${userCredits.credits} credits.`);
    } catch (error) {
      // Log the error
      creditslog.error(`Error while user ${userId} was checking credits: ${error.message}`);
      creditslog.debug(`Error stack: ${error.stack}`);

      // Reply to the user that there was an error while executing the command
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
        creditslog.error(`Replied with error for user id: ${userId}`);
      }
    }
  }
}

module.exports = CheckCreditsCommand;