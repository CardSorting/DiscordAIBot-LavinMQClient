const fs = require('fs');
const pino = require('pino');

// Create a writable stream
const logStream = fs.createWriteStream('./task.log', { flags: 'a' }); // Ensure the stream appends to the file

// Create a custom serializer to handle complex objects
const customSerializers = {
  response: (res) => {
    // You can adjust the serialization logic here
    return JSON.stringify(res, null, 2); // Pretty print the response
  }
};

// Create a logger that writes to the stream
const logger = pino({
  level: 'trace', // log all messages
  serializers: {
    // Use custom serializers for specific fields
    ...pino.stdSerializers, // Include standard serializers
    responseData: customSerializers.response, // Custom serializer for responseData
  }
}, logStream);

module.exports = logger;