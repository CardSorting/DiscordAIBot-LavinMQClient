const LavinMQWorkerQueueHandler = require("./LavinMQQueueHandler");
const CreditManager = require("./CreditManager");
const { creditConfig } = require("./creditconfig");
const logger = require("./logger");

class QueryHandler {
  constructor(userId, query) {
    this.validateInputs(userId, query);
    this.userId = userId;
    this.query = query;
    this.lavinMQQueueHandler = LavinMQWorkerQueueHandler;
    this.creditManager = new CreditManager(creditConfig);
  }

  validateInputs(userId, query) {
    if (!userId || typeof userId !== "string") {
      const errMsg = "UserId is required for QueryHandler and must be a string.";
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    if (!query || typeof query !== "string") {
      const errMsg = "Query is required for QueryHandler and must be a string.";
      logger.error(errMsg);
      throw new Error(errMsg);
    }
  }

  async handle(lastChannelId) {
    try {
      await this._handleCreditDeduction();

      const jobData = {
        userId: this.userId,
        query: this.query,
        lastChannelId: lastChannelId
      };

      await this.lavinMQQueueHandler.sendJobResult(jobData);
      logger.info("Query successfully sent for processing.");

      return { success: true };
    } catch (error) {
      logger.error(`Error in QueryHandler handle: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async _handleCreditDeduction() {
    try {
      const hasSufficientCredits = await this.creditManager.handleQueryCostDeduction(this.userId);
      if (!hasSufficientCredits) {
        const errMsg = `User ${this.userId} has insufficient credits for query processing.`;
        logger.warn(errMsg);
        throw new Error(errMsg);
      }
    } catch (error) {
      logger.error(`Error during credit deduction for query: ${error.message}`);
      throw error;
    }
  }
}

module.exports = QueryHandler;