  const { EmbedBuilder } = require('discord.js');
  const userLastChannelMapCache = require('./UserLastChannelMapCache');
  const logger = require('./logger');
  const lavinMQQueueHandler = require('./LavinMQQueueHandler');

  class BotHandler {
      constructor(client) {
          this.validateClient(client);
          this.client = client;
          this.initializeQueueHandler();
      }

      validateClient(client) {
          if (!client) {
              const errorMsg = 'BotHandler requires a valid Discord client instance.';
              logger.error({ message: errorMsg });
              throw new Error(errorMsg);
          }
      }

      async initializeQueueHandler() {
          try {
              await lavinMQQueueHandler.initialize();
              lavinMQQueueHandler.consumeImageGenerationTasks(this.handleJobResult.bind(this));
              logger.info('LavinMQQueueHandler initialized and consuming tasks.');
          } catch (error) {
              logger.error({ message: 'Failed to initialize LavinMQQueueHandler', error: error.stack });
              throw error;
          }
      }

      async handleJobResult(msg) {
          if (!this.isValidMessage(msg)) {
              logger.warn('Invalid message received in handleJobResult.');
              return;
          }

          try {
              const resultData = JSON.parse(msg.content.toString());
              if (!this.validateJobResult(resultData)) {
                  logger.error('Invalid job result data received', { resultData });
                  return;
              }
              await this.respondToUser(resultData);
          } catch (error) {
              logger.error({ message: 'Error in handleJobResult', error: error.stack });
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
          logger.debug({ message: 'Starting respondToUser', userId: resultData.userId });

          try {
              const channelId = userLastChannelMapCache.getLastCommandChannelId(resultData.userId);
              const originalQuery = userLastChannelMapCache.getQuery(resultData.userId);

              if (!channelId || !originalQuery) {
                  logger.error({
                      message: 'No last channel or original query found',
                      userId: resultData.userId,
                      channelId,
                      originalQuery
                  });
                  return;
              }

              const channel = await this.fetchChannel(channelId);
              const user = await this.fetchUser(resultData.userId);
              const embed = this.createResponseEmbed(originalQuery, resultData.response, user);
              await this.retrySend(channel, embed, 3);
              logger.info('Response successfully sent', { channelId, userId: resultData.userId });
          } catch (error) {
              logger.error({
                  message: 'Error in respondToUser',
                  userId: resultData ? resultData.userId : 'Unknown',
                  channelId: resultData && resultData.channelId,
                  originalQuery: resultData && resultData.originalQuery,
                  error: {
                      message: error.message,
                      stack: error.stack,
                      ...error // Spread the rest of the error object in case it contains more contextual info
                  }
              });
          } finally {
              logger.debug({ message: 'Ending respondToUser', userId: resultData.userId });
              userLastChannelMapCache.clearUserCache(resultData.userId);
          }
      }

      async fetchChannel(channelId) {
          try {
              return await this.client.channels.fetch(channelId);
          } catch (error) {
              logger.error({ message: `Error fetching channel`, channelId, error: error.stack });
              throw error;  
          }
      }

      async fetchUser(userId) {
          try {
              return await this.client.users.fetch(userId);
          } catch (error) {
              logger.error({ message: `Error fetching user`, userId, error: error.stack });
              throw error;  
          }
      }

      async retrySend(channel, embed, retries) {
          for (let i = 0; i < retries; i++) {
              try {
                  await channel.send({ embeds: [embed] });
                  logger.info('Response sent to channel', { channelId: channel.id });
                  return;
              } catch (error) {
                  logger.warn('Retry failed', { attempt: i + 1, retries, error: error.stack });
                  if (i === retries - 1) throw error;
              }
          }
      }

      createResponseEmbed(query, responseMessage, user) {
          const embed = new EmbedBuilder()
              .setColor('#0099ff')
              .setTitle('Hana Chats')
              .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() })
              .setTimestamp();

          if (query && query.trim() !== '') {
              embed.addFields({ name: 'Your Query', value: query });
          } else {
              embed.addFields({ name: 'Your Query', value: 'No query provided' });
          }

          if (responseMessage && responseMessage.trim() !== '') {
              embed.addFields({ name: 'Hana Says', value: responseMessage });
          } else {
              embed.addFields({ name: 'Hana Says', value: 'No response provided' });
          }

          return embed;
      }
  }

  module.exports = BotHandler;