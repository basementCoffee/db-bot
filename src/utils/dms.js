const {version} = require('../../package.json');
const {reactions} = require('./reactions');
const {bot, botID, INVITE_MSG} = require('./process/constants');
const {getHelpList} = require('./help');
const CH = require('../../channel.json');

/**
 * Handles message requests.
 * @param message The message metadata.
 * @param messageContent {string} The content of the message.
 * @returns {*}
 */
function dmHandler(message, messageContent) {
  // the message content - formatted in lower case
  const mc = messageContent.toLowerCase().trim() + ' ';
  if (mc.length < 9) {
    if (mc.length < 7 && mc.includes('help ')) {
      return message.author.send(getHelpList('.', 1, version)[0], version);
    } else if (mc.includes('invite ')) {
      return message.channel.send(INVITE_MSG);
    }
  }
  const mb = reactions.OUTBOX;
  // noinspection JSUnresolvedFunction
  bot.channels.cache.get(CH.dm)
    .send('------------------------------------------\n' +
      '**From: ' + message.author.username + '** (' + message.author.id + ')\n' +
      messageContent + '\n------------------------------------------').then((msg) => {
      msg.react(mb).then();
      const filter = (reaction, user) => {
        return user.id !== botID;
      };

      const collector = msg.createReactionCollector({filter, time: 86400000});

      collector.on('collect', (reaction, user) => {
        if (reaction.emoji.name === mb) {
          sendMessageToUser(msg, message.author.id, user.id);
          reaction.users.remove(user).then();
        }
      });
      collector.once('end', () => {
        msg.reactions.cache.get(mb).remove().then();
      });
    });
}

/**
 * Prompts the text channel for a response to forward to the given user.
 * @param message The original message that activates the bot.
 * @param userID The ID of the user to send the reply to.
 * @param reactionUserID Optional - The ID of a user who can reply to the prompt besides the message author
 */
function sendMessageToUser(message, userID, reactionUserID) {
  const user = bot.users.cache.get(userID);
  message.channel.send('What would you like me to send to ' + user.username +
    '? [type \'q\' to not send anything]').then((msg) => {
    const filter = (m) => {
      return ((message.author.id === m.author.id || reactionUserID === m.author.id) && m.author.id !== botID);
    };
    message.channel.awaitMessages({filter, time: 60000, max: 1, errors: ['time']})
      .then((messages) => {
        if (messages.first().content && messages.first().content.trim() !== 'q') {
          user.send(messages.first().content).then(() => {
            message.channel.send('Message sent to ' + user.username + '.');
            message.react(reactions.CHECK).then();
          });
        } else if (messages.first().content.trim().toLowerCase() === 'q') {
          message.channel.send('No message sent.');
        }
        msg.delete();
      }).catch(() => {
        message.channel.send('No message sent.');
        msg.delete();
      });
  });
}

module.exports = {dmHandler, sendMessageToUser};
