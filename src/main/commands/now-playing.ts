import LocalServer from '../utils/lib/LocalServer';
import { Message, VoiceBasedChannel } from 'discord.js';
import { getXdb2 } from '../database/retrieval';
import { runSearchCommand } from './search';
import { sendLinkAsEmbed } from './stream/stream';

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param server {LocalServer} The server metadata.
 * @param {*} message the message that activated the bot
 * @param {*} voiceChannel The active voice channel
 * @param keyName Optional - A key to search for to retrieve a link
 * @param {*} sheetName Required if dbKey is given - provides the name of the sheet reference.
 * @param sheetLetter Required if dbKey is given - a letter enum representing the type of sheet being referenced
 * (server or personal)
 */
async function runWhatsPCommand(
  server: LocalServer,
  message: Message,
  voiceChannel: VoiceBasedChannel | null | undefined,
  keyName?: string,
  sheetName?: string,
  sheetLetter?: string
) {
  if (keyName && sheetName) {
    const xdb = await getXdb2(server, sheetName, !!voiceChannel);
    let link = xdb.globalKeys.get(keyName.toUpperCase())?.link;
    // update link value here
    if (!link) {
      const sObj = runSearchCommand(
        keyName,
        Array.from(xdb.globalKeys.values()).map((x) => x.name)
      );
      if (sObj.ssi === 1 && sObj.ss) {
        link = `Assuming **${sObj.ss}**\n${xdb.globalKeys.get(sObj.ss.toUpperCase())!.link}`;
      }
    }
    if (link) {
      return message.channel.send(link);
    } else {
      // not found msg
      const notFound = `Could not find '${keyName}' in ${sheetLetter === 'm' ? 'your' : "the server's"} keys list.`;
      message.channel.send(notFound);
      return sendLinkAsEmbed(message, server.queue[0], voiceChannel, server, true);
    }
  } else if (!voiceChannel) {
    return message.channel.send('must be in a voice channel');
  } else if (server.queue[0]) {
    return sendLinkAsEmbed(message, server.queue[0], voiceChannel, server, true);
  } else {
    return message.channel.send('nothing is playing right now');
  }
}

export { runWhatsPCommand };
