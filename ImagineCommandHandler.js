const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');
const BackblazeB2 = require('backblaze-b2');
const logger = require('./logger');
const Replicate = require('replicate');
const fastq = require('fastq');

class ImagineCommandHandler {
  constructor() {
    this.b2 = new BackblazeB2({
      applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
      applicationKey: process.env.B2_APPLICATION_KEY
    });
    this.bucketName = process.env.B2_BUCKET_NAME;
    this.taskQueue = fastq.promise(this, this.imageWorker.bind(this), 10);
    this.initializeServices();
  }

  async initializeServices() {
    try {
      await this.b2.authorize();
      this.initializeReplicate();
    } catch (error) {
      logger.error(`Error initializing Backblaze B2: ${error.message}`);
      // Consider re-throwing the error or implementing a retry mechanism
    }
  }

  initializeReplicate() {
    try {
      this.replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });
      logger.info('Replicate initialized successfully');
    } catch (error) {
      logger.error(`Error initializing Replicate: ${error.message}`);
      // Consider re-throwing the error or implementing a retry mechanism
    }
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

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    try {
      await interaction.deferReply();
      this.taskQueue.push({ interaction, prompt });
    } catch (error) {
      logger.error(`Error in execute method: ${error.message}`);
      await interaction.reply({ content: 'Error processing your request.', ephemeral: true });
      // Consider adding more detailed user feedback
    }
  }

  async createImage(prompt) {
    if (!this.replicate) {
      throw new Error('Replicate API client is not initialized');
    }
    const model = "playgroundai/playground-v2-1024px-aesthetic:42fe626e41cc811eaf02c94b892774839268ce1994ea778eba97103fe1ef51b8";
    const input = { prompt };

    try {
      const output = await this.replicate.run(model, { input });
      logger.info('Image generated successfully');
      return output[0];
    } catch (error) {
      logger.error(`Error in createImage: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      throw new Error('Failed to generate image');
    }
  }

  async backupToBackblaze(imageUrl, prompt) {
    let fileName;
    try {
      await this.b2.authorize();
      logger.info('Backblaze B2 authorization successful');

      const imageData = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      logger.info('Image data fetched successfully');

      const bucketId = process.env.B2_BUCKET_ID_ROCKET;
      const bucketName = process.env.B2_BUCKET_NAME;
      if (!bucketId || !bucketName) {
        throw new Error('Backblaze B2 bucket ID or name is not set');
      }

      const uploadUrl = await this.b2.getUploadUrl({ bucketId: bucketId });
      const sanitizedPrompt = prompt.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      fileName = `images/${sanitizedPrompt}_${Date.now()}.png`;

      await this.b2.uploadFile({
        uploadUrl: uploadUrl.data.uploadUrl,
        uploadAuthToken: uploadUrl.data.authorizationToken,
        fileName: fileName,
        data: imageData.data,
        mime: 'image/png',
      });

      const backblazeUrl = `https://f005.backblazeb2.com/file/${bucketName}/${fileName}`;
      logger.info(`Backup successful for ${fileName}`);
      return backblazeUrl;
    } catch (error) {
      logger.error(`Error during backup to Backblaze: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      throw new Error('Failed to backup image');
    }
  }

  async imageWorker(task, callback) {
    try {
      const imageUrl = await this.createImage(task.prompt);
      const backblazeUrl = await this.backupToBackblaze(imageUrl, task.prompt);
      await task.interaction.editReply({ content: backblazeUrl });
    } catch (error) {
      logger.error(`Error in imageWorker: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      await task.interaction.editReply({ content: 'Error in processing your request.' });
    } finally {
      callback();
    }
  }
}

module.exports = ImagineCommandHandler;