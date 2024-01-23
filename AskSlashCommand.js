const { SlashCommandBuilder } = require("@discordjs/builders");
const QueryHandler = require("./QueryHandler");
const userLastChannelMapCache = require("./UserLastChannelMapCache");
const logger = require("./logger");

class AskSlashCommand {
    constructor() {
        this.data = this._buildCommandData();
    }

    _buildCommandData() {
        return new SlashCommandBuilder()
            .setName("ask")
            .setDescription("Submit a query for the bot to process")
            .addStringOption(option =>
                option
                    .setName("query")
                    .setDescription("The query text")
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        const userId = interaction.user.id;
        const query = interaction.options.getString("query");
        const channelId = interaction.channelId;
        const guildId = interaction.guild?.id || 'unknown';

        try {
            await interaction.deferReply({ ephemeral: true });

            // Storing the query in the cache along with channel and guild information
            userLastChannelMapCache.setIfAbsent(userId, channelId, "discord", query, guildId);

            const queryHandler = new QueryHandler(userId, query);
            const handleResult = await queryHandler.handle(channelId);

            const responseMessage = handleResult.success 
                ? "Your query has been submitted and is being processed."
                : `Error processing your request: ${handleResult.message}`;

            await interaction.editReply({ content: responseMessage });
        } catch (error) {
            logger.error(`Error processing query from user ${userId} in channel ${channelId}, guild ${guildId}: ${error.message}`);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: "Sorry, there was an error processing your request.", ephemeral: true });
            } else {
                await interaction.editReply({ content: "Sorry, there was an error processing your request." });
            }
        }
    }
}

module.exports = AskSlashCommand;