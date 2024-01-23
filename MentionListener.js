const QueryHandler = require('./QueryHandler');

class MentionListener {
    constructor(bot) {
        this.bot = bot;
    }

    async handleMessage(message) {
        if (message.mentions.has(this.bot.user.id) && !message.author.bot) {
            const query = this.extractQueryFromMention(message.content);
            if (query) {
                const queryHandler = new QueryHandler(message.author.id, query);
                queryHandler.setUserLastChannel(message.author.id, message.channelId);
                const response = await queryHandler.handle();
                await message.channel.send(response.message);
            }
        }
    }

    extractQueryFromMention(mentionMessage) {
        const parts = mentionMessage.split(/\s+/);
        const mentionIndex = parts.findIndex(part => part.startsWith('<@') && part.endsWith('>'));
        const queryParts = parts.slice(mentionIndex + 1);
        return queryParts.join(' ');
    }
}

module.exports = MentionListener;