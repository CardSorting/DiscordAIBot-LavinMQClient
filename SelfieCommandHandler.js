const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const BackblazeB2 = require('backblaze-b2');
const logger = require('./logger');
const CreditManager = require('./CreditManager');
const fastq = require('fastq');

class SelfieCommandHandler {
  constructor(creditManager, concurrency = 5) {
    this.b2 = new BackblazeB2({
      applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
      applicationKey: process.env.B2_APPLICATION_KEY
    });
    this.bucketName = process.env.B2_BUCKET_NAME;
    this.directoryName = 'GALHL'; // Directory within the bucket
    this.imageFileNames = [];
    this.creditManager = creditManager;
    this.queue = fastq.promise(this, this.processSelfieTask, concurrency);
    this.initializeB2();
  }

  async initializeB2() {
    try {
      await this.b2.authorize();
      this.imageFileNames = await this.fetchImageFileNamesFromBucket();
    } catch (error) {
      logger.error(`Error initializing Backblaze B2: ${error.message}`);
    }
  }

  async fetchImageFileNamesFromBucket() {
    try {
      const bucketId = await this.getBucketId(this.bucketName);
      if (!bucketId) {
        throw new Error(`Bucket ${this.bucketName} not found`);
      }
      return await this.listFileNames(bucketId, this.directoryName);
    } catch (error) {
      logger.error(`Error fetching image file names from B2 bucket: ${error.message}`);
      return [];
    }
  }

  async getBucketId(bucketName) {
    const response = await this.b2.listBuckets();
    const bucket = response.data.buckets.find(b => b.bucketName === bucketName);
    return bucket ? bucket.bucketId : null;
  }

  async listFileNames(bucketId, directoryName) {
    const response = await this.b2.listFileNames({
      bucketId,
      maxFileCount: 1000,
      prefix: directoryName + '/',
      delimiter: '/'
    });
    return response.data.files.map(file => file.fileName);
  }

  async generatePresignedUrl(fileName) {
    const expirationTime = 300; // 5 minutes
    try {
      const response = await this.b2.getDownloadAuthorization({
        bucketId: await this.getBucketId(this.bucketName),
        fileNamePrefix: fileName,
        validDurationInSeconds: expirationTime
      });
      return `https://f005.backblazeb2.com/file/${this.bucketName}/${fileName}?Authorization=${response.data.authorizationToken}`;
    } catch (error) {
      logger.error(`Error generating presigned URL: ${error.message}`);
      return null;
    }
  }

  getCommandData() {
    return new SlashCommandBuilder()
      .setName('selfie')
      .setDescription('Take a selfie!')
      .toJSON();
  }

  async processSelfieTask(interaction) {
    try {
      const hasEnoughCredits = await this.creditManager.handleSelfieCommandCostDeduction(interaction.user.id);
      if (!hasEnoughCredits) {
        return { success: false, message: 'Insufficient credits for a selfie.' };
      }

      const fileName = this.getRandomImageFileName();
      if (!fileName) {
        return { success: false, message: 'No image available.' };
      }

      const presignedUrl = await this.generatePresignedUrl(fileName);
      if (!presignedUrl) {
        throw new Error('Failed to generate presigned URL');
      }

      return {
        success: true,
        embed: new EmbedBuilder()
          .setTitle('Hope You Enjoy 😛😘')
          .setImage(presignedUrl)
          .setColor(0x00AE86)
      };
    } catch (error) {
      logger.error(`Error processing selfie task: ${error.message}`);
      return { success: false, message: 'Error processing your request.' };
    }
  }

  async execute(interaction) {
    try {
      const result = await this.queue.push(interaction);
      if (!result.success) {
        throw new Error(result.message);
      }

      await interaction.reply({ embeds: [result.embed] });
    } catch (error) {
      logger.error(`SelfieCommandHandler execute error: ${error.message}`);
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }

  getRandomImageFileName() {
    if (this.imageFileNames.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * this.imageFileNames.length);
    return this.imageFileNames[randomIndex];
  }
}

module.exports = SelfieCommandHandler;