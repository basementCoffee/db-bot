import { Message } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { getSheetName, linkValidator } from '../utils/utils';
import { convertSeekFormatToSec } from '../utils/formatUtils';
import { playLinkNow } from './playLink';

/**
 * Plays the link at a specific timestamp.
 * @param message The message metadata.
 * @param server {LocalServer} The local server object.
 * @param args {Array<string>} Ignores first argument. Must include a timestamp as an arg. Link is optional.
 * @param mgid The message guild id.
 * @return {unknown}
 */
async function runSeekCommand(message: Message, server: LocalServer, args: Array<string>, mgid: string) {
  const SEEK_ERR_MSG = '*provide a seek timestamp (ex: seek 5m32s)*';
  if (args[0]) {
    if (args[1]) {
      // assume exactly two arguments is provided
      const validLink = linkValidator(args[0]);
      const numSeconds = convertSeekFormatToSec(args[1]);
      if (validLink && numSeconds) {
        server.numSinceLastEmbed -= 2;
        args.splice(1, args.length - 1);
        await playLinkNow(message, args, mgid, server, getSheetName(message.member!.id), numSeconds, true);
        if (numSeconds > 1200) message.channel.send('*seeking...*');
        return;
      }
    } else {
      // provided one argument
      if (!server.queue[0]) {
        return message.channel.send(`*provide a seek link and timestamp (ex: ${args[0]} [link] 5m32s)*`);
      }
      // continues if only one argument was provided
      const numSeconds = convertSeekFormatToSec(args[0]);
      if (numSeconds) {
        server.numSinceLastEmbed -= 2;
        args.splice(0, 1);
        args.push(server.queue[0].url);
        await playLinkNow(message, args, mgid, server, getSheetName(message.member!.id), numSeconds, false);
        if (numSeconds > 1200) message.channel.send('*seeking...*');
        return;
      }
    }
  }
  // if successful then execution should not reach here
  message.channel.send(SEEK_ERR_MSG);
}

export { runSeekCommand };
