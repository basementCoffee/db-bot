import LocalServer from '../utils/lib/LocalServer';
import EmbedBuilderLocal from '../utils/lib/EmbedBuilderLocal';
import reactions from '../utils/lib/reactions';
import { Message, MessageReaction, User } from 'discord.js';
import { botID, DB_BOT_ICON_MED } from '../utils/lib/constants';
import { botInVC, createQueueItem, getLinkType, getSheetName, getTitle } from '../utils/utils';
import { updateActiveEmbed } from '../utils/embed';
import { runInsertCommand } from './insert';
import { isValidRequestWPlay } from '../utils/validation';

/**
 * Displays the queue in the channel.
 * @param server {LocalServer} The server metadata.
 * @param message The message that triggered the bot
 * @param mgid The message guild id
 * @param noErrorMsg {Boolean} True if to not send error msg (if not in a voice channel)
 * @returns {Promise<void>|*}
 */
function runQueueCommand(
  server: LocalServer,
  message: Message,
  mgid: string,
  noErrorMsg: boolean
): Promise<void> | any {
  if (server.queue.length < 1 || !botInVC(message) || !server.audio.isVoiceChannelMember(message.member!)) {
    if (noErrorMsg) return;
    return message.channel.send('There is no active queue right now');
  }
  // a copy of the queue
  let serverQueue = server.queue.map((x) => x);
  let authorName: string;

  /**
   * Creates an embed to display the queue.
   * @param startingIndex The index to start at.
   * @param notFirstRun {boolean} True if not the first run.
   * @param sentMsg {Message} The message to edit.
   * @param sentMsgArray {Message[]} The message array to edit.
   */
  async function generateQueue(
    startingIndex: number,
    notFirstRun: boolean,
    sentMsg: Message | undefined,
    sentMsgArray: Message[]
  ) {
    let queueSB = '';
    const queueMsgEmbed = new EmbedBuilderLocal();
    if (!authorName) {
      authorName = await getTitle(serverQueue[0], 50);
    }
    const n = serverQueue.length - startingIndex - 1;
    // generating queue message
    let tempMsg;
    if (!sentMsg) {
      const msgTxt =
        (notFirstRun ? 'generating ' + (n < 11 ? 'remaining ' + n : 'next 10') : 'generating queue') + '...';
      tempMsg = await message.channel.send(msgTxt);
    }
    queueMsgEmbed
      .setTitle('Up Next')
      .setAuthor({ name: `playing:  ${authorName}` })
      .setThumbnail(DB_BOT_ICON_MED);
    let sizeConstraint = 0;
    const qIterations = Math.min(serverQueue.length, startingIndex + 11);
    for (let qi = startingIndex + 1; qi < qIterations && qi < serverQueue.length && sizeConstraint < 10; qi++) {
      const title = await getTitle(serverQueue[qi]);
      const url = serverQueue[qi].url;
      queueSB += qi + '. ' + `[${title}](${url})\n`;
      sizeConstraint++;
    }
    if (queueSB.length === 0) {
      queueSB = 'queue is empty';
    }
    queueMsgEmbed.setDescription(queueSB);
    if (serverQueue.length > 11) {
      queueMsgEmbed.setFooter({ text: "use 'insert' & 'remove' to edit the queue" });
    }
    if (tempMsg?.deletable) tempMsg.delete();
    if (sentMsg?.deletable) {
      await queueMsgEmbed.edit(sentMsg);
    } else {
      sentMsg = await queueMsgEmbed.send(message.channel);
      sentMsgArray.push(sentMsg!);
    }
    if (sentMsg!.reactions.cache.size < 1) {
      server.numSinceLastEmbed += 10;
      if (startingIndex + 11 < serverQueue.length) {
        sentMsg!.react(reactions.ARROW_L).then(() => {
          sentMsg!.react(reactions.ARROW_R).then(() => {
            if (!collector.ended && serverQueue.length < 12) {
              sentMsg!.react(reactions.INBOX).then(() => {
                if (server.queue.length > 0 && !collector.ended) {
                  sentMsg!.react(reactions.OUTBOX);
                }
              });
            }
          });
        });
      } else {
        sentMsg!.react(reactions.INBOX).then(() => {
          if (server.queue.length > 0) sentMsg!.react(reactions.OUTBOX);
        });
      }
    }
    const filter = (reaction: MessageReaction, user: User) => {
      if (message.member!.voice?.channel) {
        for (const mem of message.member!.voice.channel.members) {
          if (user.id === mem[1].id) {
            return (
              user.id !== botID &&
              [reactions.ARROW_R, reactions.INBOX, reactions.OUTBOX, reactions.ARROW_L].includes(reaction.emoji.name!)
            );
          }
        }
      }
      return false;
    };
    const collector = sentMsg!.createReactionCollector({ filter, time: 300000, dispose: true });
    const arrowReactionTimeout = setTimeout(() => {
      sentMsg!.reactions.removeAll();
    }, 300500);
    collector.on('collect', (reaction, reactionCollector) => {
      if (reaction.emoji.name === reactions.ARROW_L) {
        reaction.users.remove(reactionCollector);
        clearTimeout(arrowReactionTimeout);
        collector.stop();
        let newStartingIndex;
        if (startingIndex <= 0) {
          const lastDigit = Number(serverQueue.length.toString().slice(-1)[0]);
          newStartingIndex = serverQueue.length - (lastDigit > 1 ? lastDigit : 10);
        } else {
          newStartingIndex = Math.max(0, startingIndex - 10);
        }
        generateQueue(newStartingIndex, true, sentMsg, sentMsgArray);
      }
      if (reaction.emoji.name === reactions.ARROW_R) {
        reaction.users.remove(reactionCollector);
        clearTimeout(arrowReactionTimeout);
        collector.stop();
        let newStartingIndex = startingIndex + 10;
        if (newStartingIndex >= serverQueue.length - 1) {
          newStartingIndex = 0;
        }
        generateQueue(newStartingIndex, true, sentMsg, sentMsgArray);
      } else if (reaction.emoji.name === reactions.INBOX) {
        if (!isValidRequestWPlay(server, message, 'insert')) return;
        let link;
        message.channel.send("What link would you like to insert [or type 'q' to quit]").then((msg) => {
          const insertFilter = (m: Message) => {
            return reactionCollector.id === m.author.id && m.author.id !== botID;
          };
          message.channel
            .awaitMessages({ filter: insertFilter, time: 60000, max: 1, errors: ['time'] })
            .then(async (messages) => {
              link = messages.first()!.content.split(' ')[0].trim();
              if (link.toLowerCase() === 'q') {
                return;
              }
              if (link) {
                const num = await runInsertCommand(
                  message,
                  message.guild!.id,
                  [link],
                  server,
                  getSheetName(message.member!.id)
                );
                if (num < 0) {
                  msg.delete();
                  return;
                }
                serverQueue.splice(num, 0, createQueueItem(link, getLinkType(link), null));
                if (server.queue.length > 0) updateActiveEmbed(server).then();
                let pageNum;
                if (num === 11) pageNum = 0;
                else pageNum = Math.floor((num - 1) / 10);
                clearTimeout(arrowReactionTimeout);
                collector.stop();
                // update the local queue
                serverQueue = server.queue.map((x) => x);
                generateQueue(pageNum === 0 ? 0 : pageNum * 10, false, sentMsg, sentMsgArray).then();
              } else {
                message.channel.send('*cancelled*');
                msg.delete();
              }
            })
            .catch(() => {
              message.channel.send('*cancelled*');
              msg.delete();
            });
        });
      } else if (reaction.emoji.name === reactions.OUTBOX) {
        if (server.dictator && reactionCollector.id !== server.dictator.id) {
          return message.channel.send('only the dictator can remove from the queue');
        }
        if (
          server.voteAdmin.length > 0 &&
          server.voteAdmin.filter((x: User) => x.id === reactionCollector.id).length === 0
        ) {
          return message.channel.send('only a dj can remove from the queue');
        }
        if (serverQueue.length < 2) return message.channel.send('*cannot remove from an empty queue*');
        // remove question
        const rq = 'What in the queue would you like to remove? (1-' + (serverQueue.length - 1) + ") [or type 'q']";
        message.channel.send(rq).then((msg) => {
          const removeFilter = (m: Message) => {
            return reactionCollector.id === m.author.id && m.author.id !== botID;
          };
          message.channel
            .awaitMessages({ filter: removeFilter, time: 60000, max: 1, errors: ['time'] })
            .then(async (messages) => {
              let num: any = messages.first()!.content.trim();
              if (num.toLowerCase() === 'q') {
                return message.channel.send('*cancelled*');
              }
              num = parseInt(num);
              if (num) {
                if (server.queue[num] !== serverQueue[num]) {
                  // out of date text
                  const oodTxt =
                    "**queue is out of date:** the positions may not align properly with the embed shown\n*please use the 'queue' command again*";
                  return message.channel.send(oodTxt);
                }
                if (num >= server.queue.length) {
                  return message.channel.send(
                    '*that position is out of bounds, **' +
                      (server.queue.length - 1) +
                      '** is the last item in the queue.*'
                  );
                }
                server.queue.splice(num, 1);
                serverQueue.splice(num, 1);
                message.channel.send('removed item from queue');
                if (server.queue.length > 0) updateActiveEmbed(server).then();
                let pageNum;
                if (num === 11) pageNum = 0;
                else pageNum = Math.floor((num - 1) / 10);
                clearTimeout(arrowReactionTimeout);
                collector.stop();
                return generateQueue(pageNum === 0 ? 0 : pageNum * 10, false, sentMsg, sentMsgArray);
              } else {
                msg.delete();
              }
            })
            .catch(() => {
              message.channel.send('*cancelled*');
              msg.delete();
            });
        });
      }
    });
  }

  return generateQueue(0, false, undefined, []);
}

// creates a queue-like display of links
// arrayOfItems: Array<{url, title, index}>
// stringCallback: (index, title, url) => string
async function createVisualText(
  server: LocalServer,
  arrayOfItems: Array<any>,
  stringCallback: (index: number, title: string, url: string) => string
) {
  let finalText = '';
  for (const item of arrayOfItems) {
    const title = item.title;
    const url = item.url;
    finalText += stringCallback(item.index, title, url);
  }
  return finalText;
}

export { runQueueCommand, createVisualText };
