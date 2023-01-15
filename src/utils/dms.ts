import { ClientUser, Message, MessageReaction, User } from 'discord.js';
import { bot, botID, INVITE_MSG } from './lib/constants';
import { getHelpList } from './help';
import reactions from './lib/reactions';
import { logError } from './utils';
const { version } = require('../../package.json');
const CH = require('../../channel.json');

/**
 * Handles message requests.
 * @param message The message metadata.
 * @param messageContent The content of the message.
 * @returns {*}
 */
async function dmHandler(message: Message, messageContent: string) {
  // the message content - formatted in lower case
  const mc = messageContent.toLowerCase().trim() + ' ';
  if (mc.length < 9) {
    if (mc.length < 7 && mc.includes('help ')) {
      return message.author.send({ embeds: [getHelpList('.', 1, version)[0].build()] });
    } else if (mc.includes('invite ')) {
      return message.channel.send(INVITE_MSG);
    }
  }
  const mb = reactions.OUTBOX;
  const messagePayload =
    '------------------------------------------\n' +
    '**From: ' +
    message.author.username +
    '** (' +
    message.author.id +
    ')\n' +
    messageContent +
    '\n------------------------------------------';
  const channel = await bot.channels.fetch(CH.dm);
  if (!channel) {
    logError(`error: could not find DM channel\nmessage-payload:\n${messagePayload}`);
    return;
  }
  // @ts-ignore
  channel.send(messagePayload).then((msg: Message) => {
    msg.react(mb).then();
    const filter = (reaction: MessageReaction, user: User) => {
      return user.id !== botID;
    };

    const collector = msg.createReactionCollector({ filter, time: 86400000 });

    collector.on('collect', (reaction: MessageReaction, user: ClientUser) => {
      if (reaction.emoji.name === mb) {
        sendMessageToUser(msg, message.author.id.toString(), user.id);
        reaction.users.remove(user).then();
      }
    });
    collector.once('end', () => {
      msg.reactions.cache.get(mb)?.remove().then();
    });
  });
}

/**
 * Prompts the text channel for a response to forward to the given user.
 * @param message The original message that activates the bot.
 * @param userID The ID of the user to send the reply to.
 * @param reactionUserID Optional - The ID of a user who can reply to the prompt besides the message author
 */
function sendMessageToUser(message: Message, userID: string, reactionUserID: string | undefined) {
  const user = bot.users.cache.get(userID);
  if (!user) {
    message.channel.send('error: could not find user');
    return;
  }
  message.channel
    .send('What would you like me to send to ' + user.username + "? [type 'q' to not send anything]")
    .then((msg) => {
      const filter = (m: any) => {
        return (message.author.id === m.author.id || reactionUserID === m.author.id) && m.author.id !== botID;
      };
      message.channel
        .awaitMessages({ filter, time: 60000, max: 1, errors: ['time'] })
        .then((messages) => {
          if (messages.first()!.content && messages.first()!.content.trim() !== 'q') {
            user.send(messages.first()!.content).then(() => {
              message.channel.send('Message sent to ' + user.username + '.');
              message.react(reactions.CHECK).then();
            });
          } else if (messages.first()!.content.trim().toLowerCase() === 'q') {
            message.channel.send('No message sent.');
          }
          msg.delete();
        })
        .catch(() => {
          message.channel.send('No message sent.');
          msg.delete();
        });
    });
}

export { dmHandler, sendMessageToUser };
