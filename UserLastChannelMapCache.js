      const pinoLogger = require('./logger');

      const CACHE_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour in milliseconds
      const CACHE_SWEEP_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

      class UserLastChannelMapCache {
          constructor() {
              if (!UserLastChannelMapCache.instance) {
                  this.cache = new Map();
                  this.startCacheSweep();
                  UserLastChannelMapCache.instance = this;
              }
              return UserLastChannelMapCache.instance;
          }

          _isValidString(value) {
              return typeof value === 'string' && value.trim() !== '';
          }

          _validateInput(userId, channelId, originChannelType, originGuildId) {
              if (![userId, channelId, originChannelType].every(this._isValidString) ||
                  (originGuildId && !this._isValidString(originGuildId))) {
                  throw new Error('Invalid parameters provided.');
              }
          }

          set(userId, channelId, originChannelType, query, originGuildId = null) {
              try {
                  this._validateInput(userId, channelId, originChannelType, originGuildId);

                  const expiryTime = Date.now() + CACHE_EXPIRY_TIME;
                  this.cache.set(userId, {
                      channelId,
                      originChannelType,
                      query,
                      originGuildId,
                      expiryTime
                  });
              } catch (error) {
                  pinoLogger.error(`Error setting user details in cache: ${error.message}`);
                  throw error;
              }
          }

          setIfAbsent(userId, channelId, originChannelType, query, originGuildId = null) {
              if (!this.cache.has(userId)) {
                  this.set(userId, channelId, originChannelType, query, originGuildId);
              }
          }

          get(userId) {
              if (!this._isValidString(userId)) {
                  pinoLogger.error('Invalid userId provided for cache retrieval.');
                  return null;
              }

              const userData = this.cache.get(userId);
              if (!userData || userData.expiryTime <= Date.now()) {
                  this.cache.delete(userId);
                  return null;
              }
              return userData;
          }

          getLastCommandChannelId(userId) {
              const userData = this.get(userId);
              return userData ? userData.channelId : null;
          }

          getQuery(userId) {
              const userData = this.get(userId);
              return userData ? userData.query : null;
          }

          clearUserCache(userId) {
              this.cache.delete(userId);
              pinoLogger.info(`Cache cleared for user ${userId}.`);
          }

          startCacheSweep() {
              setInterval(() => {
                  this.sweepCache();
              }, CACHE_SWEEP_INTERVAL);
          }

          sweepCache() {
              const currentTime = Date.now();
              this.cache.forEach((userData, userId) => {
                  if (userData.expiryTime <= currentTime) {
                      this.cache.delete(userId);
                      pinoLogger.info(`Cache for user ${userId} invalidated.`);
                  }
              });
          }
      }

      module.exports = new UserLastChannelMapCache();