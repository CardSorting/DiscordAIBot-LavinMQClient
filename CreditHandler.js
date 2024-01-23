const CheckCreditsCommand = require('./CheckCreditsCommand');
const AddCreditsCommand = require('./AddCreditsCommand');
const creditslog = require('./credit');

class CreditHandler {
  constructor(creditManager) {
    this.creditManager = creditManager;

    // Instantiate command handlers right here
    this.checkCreditsCommand = new CheckCreditsCommand(this.creditManager);
    this.addCreditsCommand = new AddCreditsCommand(this.creditManager);

    // Use a JavaScript object to store command handlers instead of a Map
    this.commandHandlers = {
      checkcredits: this.checkCreditsCommand,
      addcredits: this.addCreditsCommand,
    };

    creditslog.info('CreditHandler initialized');
  }

  getCommandData() {
    // Extract and convert command data to array from the commandHandlers object
    return Object.values(this.commandHandlers).map(handler => handler.data.toJSON());
  }

  async handleInteraction(interaction) {
    const commandName = interaction.commandName;
    const commandHandler = this.commandHandlers[commandName];

    if (!commandHandler) {
      creditslog.warn(`No handler found for command: ${commandName}`);
      return;
    }

    try {
      await commandHandler.execute(interaction);
    } catch (error) {
      creditslog.error(`Error executing command ${commandName}: ${error.message}`);
    }
  }
}

module.exports = CreditHandler;