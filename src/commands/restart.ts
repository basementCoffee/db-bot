import { Message } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';

import { playLinkToVC } from './stream/stream';

/**
 * Restarts the song playing and what was within an older session.
 * @param message The message that triggered the bot.
 * @param mgid The message guild id.
 * @param keyword Enum in string format, being either 'restart' or 'replay'.
 * @param server {LocalServer} The local server object.
 * @returns {*}
 */
async function runRestartCommand(message: Message, mgid: string, keyword: string, server: LocalServer) {
  if (!server.queue[0] && !server.queueHistory) return message.channel.send('must be actively playing to ' + keyword);
  if (server.dictator && message.member!.id !== server.dictator.id) {
    return message.channel.send('only the dictator can ' + keyword);
  }
  if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member)) {
    return message.channel.send('as of right now, only the DJ can restart tracks');
  }
  if (server.queue[0]) {
    await playLinkToVC(message, server.queue[0], message.member!.voice?.channel, server);
  } else if (server.queueHistory.length > 0) {
    server.queue.unshift(server.queueHistory.pop());
    await playLinkToVC(message, server.queue[0], message.member!.voice?.channel, server);
  } else {
    message.channel.send('there is nothing to ' + keyword);
  }
}

export { runRestartCommand };
