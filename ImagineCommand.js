const { SlashCommandBuilder } = require('@discordjs/builders');
const ImagineCommandHandler = require('./ImagineCommandHandler');

class ImagineCommand {
    constructor() {
        this.commandHandler = new ImagineCommandHandler();
    }

    getCommandData() {
        return new SlashCommandBuilder()
            .setName('imagine')
            .setDescription('Generate an image from a text prompt')
            .addStringOption(option =>
                option.setName('prompt')
                    .setDescription('The text prompt for the image')
                    .setRequired(true))
            .toJSON();
    }

    async handleInteraction(interaction) {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply();

        try {
            await this.commandHandler.execute(interaction, prompt);
        } catch (error) {
            console.error(`Error handling interaction: ${error}`);
            await interaction.followUp({
                content: `Sorry, there was an error processing your request.`,
                ephemeral: true
            });
        }
    }
}

module.exports = ImagineCommand;