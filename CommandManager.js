const { REST, Routes } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const AddCreditsCommand = require("./AddCreditsCommand");
const AskSlashCommand = require("./AskSlashCommand");
const CheckCreditsCommand = require("./CheckCreditsCommand");
const logger = require("./logger"); // Update the path as per your project structure

class CommandManager {
  constructor(client, token, creditManager) {
    this.client = client;
    this.rest = new REST({ version: "10" }).setToken(token);
    this.commands = [];
    this.creditManager = creditManager;
  }

  addCommand(command) {
    // Dynamically initialize command with appropriate dependencies
    let commandInstance;
    switch (command) {
      case AddCreditsCommand:
      case CheckCreditsCommand:
        commandInstance = new command(this.creditManager);
        break;
      case AskSlashCommand:
        // Additional dependencies can be passed here if needed
        commandInstance = new command();
        break;
      default:
        logger.warn(`Unknown command type: ${command.name}`);
        return;
    }
    this.commands.push(commandInstance);
  }

  async registerCommands() {
    try {
      const commandsData = this.commands.map((cmd) => cmd.data.toJSON());
      await this.rest.put(Routes.applicationCommands(this.client.user.id), {
        body: commandsData,
      });
      logger.info("Successfully registered application commands.");
    } catch (error) {
      logger.error("Error registering application commands:", error);
    }
  }

  getCommand(name) {
    return this.commands.find((cmd) => cmd.data.name === name);
  }
}

module.exports = CommandManager;