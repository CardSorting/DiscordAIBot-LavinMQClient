const request = require('request');
const logger = require('./logger'); // Ensure logger is correctly set up

class JobStatusPolling {
    constructor(fetchUrl, resolve, reject) {
        this.fetchUrl = fetchUrl;
        this.resolve = resolve;
        this.reject = reject;
        this.pollInterval = 10000; // 10 seconds, adjust as needed
        this.maxAttempts = 30; // 5 minutes of attempts, adjust as needed
        this.attempts = 0;
    }

    startPolling() {
        const interval = setInterval(() => {
            if (this.attempts >= this.maxAttempts) {
                logger.error(`Polling max attempts reached for URL: ${this.fetchUrl}`);
                clearInterval(interval);
                this.reject(new Error('Timeout waiting for image generation.'));
                return;
            }

            this.pollForImage(interval);
        }, this.pollInterval);
    }

    pollForImage(interval) {
        request(this.fetchUrl, (error, response) => {
            if (error) {
                logger.error(`Polling request error at attempt ${this.attempts}: ${error.message}`);
                clearInterval(interval);
                this.reject(new Error('Error during polling for image generation.'));
                return;
            }

            try {
                const result = JSON.parse(response.body);
                logger.info(`Polling attempt ${this.attempts}: Status - ${result.status}`);
                logger.debug(`Polling response: ${response.body}`);

                if (result.status === 'success' && result.output && result.output.length > 0) {
                    clearInterval(interval);
                    const imageUrl = result.output[0];
                    this.resolve(imageUrl);
                } else if (result.status === 'error') {
                    logger.error(`Error in image generation: ${result.message}`);
                    clearInterval(interval);
                    this.reject(new Error('Error during image generation.'));
                }
            } catch (parseError) {
                logger.error(`Error parsing response: ${parseError.message}`);
                clearInterval(interval);
                this.reject(new Error('Error parsing polling response.'));
            }

            this.attempts++;
        });
    }
}

module.exports = JobStatusPolling;