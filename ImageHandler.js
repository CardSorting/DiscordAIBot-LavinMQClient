const ImageGenerationQueueHandler = require("./ImageGenerationQueueHandler");
const userLastChannelMapCache = require("./UserLastChannelMapCache");
const logger = require("./logger");

class ImageHandler {
    constructor(client) {
        this.validateClient(client);
        this.client = client;
        this.initializeImageQueueHandler();
    }

    validateClient(client) {
        if (!client) {
            const errorMsg = "ImageHandler requires a valid Discord client instance.";
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    async initializeImageQueueHandler() {
        try {
            await ImageGenerationQueueHandler.initialize();
            ImageGenerationQueueHandler.consume(this.handleImageGenerationTask.bind(this));
            logger.info('ImageGenerationQueueHandler initialized and consuming tasks.');
        } catch (error) {
            logger.error(`Failed to initialize ImageGenerationQueueHandler: ${error.message}`);
        }
    }

    async handleImageGenerationTask(msg) {
        if (!this.isValidMessage(msg)) {
            return;
        }

        try {
            const imageData = JSON.parse(msg.content.toString());
            this.validateImageData(imageData);
            await this.respondToUser(imageData);
        } catch (error) {
            logger.error(`Error in handleImageGenerationTask: ${error.message}`);
        }
    }

    isValidMessage(msg) {
        if (!msg || !msg.content) {
            logger.warn("Received an empty or invalid message in handleImageGenerationTask.");
            return false;
        }
        return true;
    }

    validateImageData(imageData) {
        if (!imageData || typeof imageData !== 'object' || !imageData.userId || !imageData.imageUrl) {
            const errorMsg = "Invalid image data received in handleImageGenerationTask.";
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    async respondToUser(imageData) {
        const channelId = userLastChannelMapCache.getLastCommandChannelId(imageData.userId);
        if (!channelId) {
            logger.error(`No last channel found for user: ${imageData.userId}`);
            return;
        }

        try {
            const channel = await this.client.channels.fetch(channelId);
            const message = `Here is your image: ${imageData.imageUrl}`;
            await channel.send(message);
            logger.info(`Image response sent to user ${imageData.userId} in channel: ${channelId}`);
        } catch (error) {
            logger.error(`Failed to send image response to channel: ${channelId}, Error: ${error.message}`);
        }
    }
}

module.exports = ImageHandler;