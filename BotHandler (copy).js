const { EmbedBuilder } = require('discord.js');
const userLastChannelMapCache = require("./UserLastChannelMapCache");
const logger = require("./logger");
const lavinMQQueueHandler = require("./LavinMQQueueHandler");
const Database = require('better-sqlite3');

class BotHandler {
    constructor(client) {
        this.validateClient(client);
        this.client = client;
        this.db = new Database('bot_logs.db');
        this.initializeQueueHandler();
        this.initializeDatabase();
    }

    validateClient(client) {
        if (!client) {
            const errorMsg = "BotHandler requires a valid Discord client instance.";
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    initializeDatabase() {
        const createTable = `
            CREATE TABLE IF NOT EXISTS response_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                query TEXT NOT NULL,
                response TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;
        this.db.prepare(createTable).run();
    }

    async initializeQueueHandler() {
        try {
            await lavinMQQueueHandler.initialize();
            lavinMQQueueHandler.consumeImageGenerationTasks(this.handleJobResult.bind(this));
            logger.info('LavinMQQueueHandler initialized and consuming tasks.');
        } catch (error) {
            logger.error(`Failed to initialize LavinMQQueueHandler: ${error.message}`);
            throw error;
        }
    }

    async handleJobResult(msg) {
        if (!this.isValidMessage(msg)) {
            logger.warn("Invalid message received in handleJobResult.");
            return;
        }

        try {
            const resultData = JSON.parse(msg.content.toString());
            if (!this.validateJobResult(resultData)) {
                logger.error("Invalid job result data received:", resultData);
                return;
            }
            await this.respondToUser(resultData);
        } catch (error) {
            logger.error(`Error in handleJobResult: ${error.message}`);
        }
    }

    isValidMessage(msg) {
        return msg && msg.content;
    }

    validateJobResult(resultData) {
        return resultData && typeof resultData === 'object' &&
               'userId' in resultData && 'response' in resultData;
    }

    async respondToUser(resultData) {
        const channelId = userLastChannelMapCache.getLastCommandChannelId(resultData.userId);
        const originalQuery = userLastChannelMapCache.getQuery(resultData.userId);

        if (!channelId || !originalQuery) {
            logger.error(`No last channel or original query found for user: ${resultData.userId}`);
            return;
        }

        try {
            const channel = await this.client.channels.fetch(channelId);
            const user = await this.client.users.fetch(resultData.userId);
            const embed = this.createResponseEmbed(originalQuery, resultData.response, user);
            await channel.send({ embeds: [embed] });
            this.logResponse(resultData.userId, originalQuery, resultData.response);
            logger.info(`Response sent to user ${resultData.userId} in channel: ${channelId}`);
        } catch (error) {
            logger.error(`Failed to send response to channel: ${channelId}, Error: ${error.message}`);
        }
    }

    logResponse(userId, query, response) {
        try {
            const insert = this.db.prepare(`
                INSERT INTO response_logs (userId, query, response)
                VALUES (?, ?, ?);
            `);
            insert.run(userId, query, response);
            logger.info(`Logged response for user ${userId}`);
        } catch (error) {
            logger.error(`Error logging response: ${error.message}`);
        }
    }

    createResponseEmbed(query, responseMessage, user) {
        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Ask Hana')
            .addFields(
                { name: 'Your Query', value: query },
                { name: 'Hana says', value: responseMessage }
            )
            .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() })
            .setTimestamp();
    }
}

module.exports = BotHandler;