require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const CreditManager = require('./CreditManager');
const CreditHandler = require('./CreditHandler');
const SelfieCommandHandler = require('./SelfieCommandHandler');
const ImagineCommandHandler = require('./ImagineCommandHandler');
const AskSlashCommand = require('./AskSlashCommand');
const BotHandler = require('./BotHandler');
const fs = require('fs');
const pino = require('pino');

// Logger setup
const logStream = fs.createWriteStream('./task.log');
const logger = pino({ level: 'info' }, logStream);

class MyDiscordBot extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupHandlers();
    // Register commands
    this.registerCommands();
  }

  setupHandlers() {
    this.creditManager = new CreditManager();
    this.creditHandler = new CreditHandler(this.creditManager);
    this.selfieCommandHandler = new SelfieCommandHandler(this.creditManager);
    this.imagineCommandHandler = new ImagineCommandHandler(this.creditManager);
    this.askSlashCommand = new AskSlashCommand();
    this.botHandler = new BotHandler(this);

    this.commands = {
      imagine: this.imagineCommandHandler,
      selfie: this.selfieCommandHandler,
      ask: this.askSlashCommand,
      ...this.creditHandler.commandHandlers,
    };
  }

  async registerCommands() {
    const commandsData = [
      this.imagineCommandHandler.getCommandData(),
      this.selfieCommandHandler.getCommandData(),
      this.askSlashCommand.data.toJSON(),
      ...this.creditHandler.getCommandData(),
    ];

    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsData });
      logger.info('Successfully registered global application commands.');
    } catch (error) {
      logger.error('Error registering global application commands:', error);
    }
  }

  async handleInteraction(interaction) {
    if (!interaction.isCommand()) return;

    const commandHandler = this.commands[interaction.commandName];
    if (!commandHandler) {
      logger.warn(`No handler found for command: ${interaction.commandName}`);
      await interaction.reply({ content: 'Command not recognized.', ephemeral: true });
      return;
    }

    try {
      await commandHandler.execute(interaction);
    } catch (error) {
      logger.error({
        message: 'Error handling command',
        commandName: interaction.commandName,
        error: error.message,
        stack: error.stack,
        interactionDetails: interaction.toJSON(),
      });

      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: 'Error processing your request.', ephemeral: true });
      } else {
        await interaction.followUp({ content: 'Error processing your request.', ephemeral: true });
      }
    }
  }
}

const bot = new MyDiscordBot();
bot.on('interactionCreate', (interaction) => bot.handleInteraction(interaction));
bot.login(process.env.DISCORD_BOT_TOKEN);

module.exports = MyDiscordBot;