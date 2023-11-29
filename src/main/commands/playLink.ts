import LocalServer from '../utils/lib/LocalServer';
import { Message } from 'discord.js';
import { botInVC, pushQueue, setSeamless, unshiftQueue, verifyPlaylist, verifyUrl } from '../utils/utils';
import { removeFormattingLink } from '../utils/formatUtils';
import { addLinkToQueue } from '../utils/playlist';
import { playLinkToVC } from './stream/stream';
import { updateActiveEmbed } from '../utils/embed';
import { playCommandUtil } from './stream/utils';
import { runDatabasePlayCommand } from './databasePlayCommand';
import { runYoutubeSearch } from './stream/youtubeSearch';
import { isValidRequestWPlay } from '../utils/validation';
import { adjustQueueForPlayNow } from '../utils/arrayUtils';

/**
 * Runs the commands and checks to play a link
 * @param message The message that triggered the bot
 * @param args An array of given play parameters, should be links or keywords
 * @param mgid The message guild id
 * @param server {LocalServer} The local server object
 * @param sheetName The name of the sheet to reference
 */
async function runPlayLinkCommand(
  message: Message,
  args: string[],
  mgid: string,
  server: LocalServer,
  sheetName: string
) {
  let initialLink = args[0];
  if (!message.member!.voice?.channel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message) && initialLink) {
      setSeamless(server, runPlayLinkCommand, [message, args, mgid, server, sheetName], sentMsg);
    }
    return;
  }
  if (!isValidRequestPlayLink(server, message, initialLink)) return;
  if (initialLink.includes('.')) {
    initialLink = removeFormattingLink(initialLink);
    if (!(verifyPlaylist(initialLink) || verifyUrl(initialLink))) {
      return playFromWord(message, args, sheetName, server, mgid, false);
    }
  } else {
    return playFromWord(message, args, sheetName, server, mgid, false);
  }
  // valid link
  let queueWasEmpty = false;
  if (server.queue.length < 1) {
    queueWasEmpty = true;
  }
  // the number of added links
  let pNums = 0;
  // counter to iterate over remaining link args
  let linkItem = 0;
  while (args[linkItem]) {
    let url = removeFormattingLink(args[linkItem]);
    if (url[url.length - 1] === ',') url = url.replace(/,/, '');
    pNums += await addLinkToQueue(args[linkItem], message, server, mgid, false, pushQueue);
    linkItem++;
  }
  // if queue was empty then play
  if (queueWasEmpty) {
    playLinkToVC(message, server.queue[0], message.member!.voice?.channel, server, 0).then();
  } else {
    message.channel.send('*added ' + (pNums < 2 ? '' : pNums + ' ') + 'to queue*');
    await updateActiveEmbed(server);
  }
}

/**
 * Runs the play now command.
 * @param message the message that triggered the bot
 * @param args the message split into an array (ignores the first argument)
 * @param mgid the message guild id
 * @param server {LocalServer} The server playback metadata
 * @param sheetName the name of the sheet to reference
 * @param seekSec {number?} Optional - The amount of time to seek in seconds
 * @param adjustQueue {boolean?} Whether to adjust the queue (is true by default).
 */
async function playLinkNow(
  message: Message,
  args: string[],
  mgid: string,
  server: LocalServer,
  sheetName = '',
  seekSec: number,
  adjustQueue = true
) {
  let initialLink = args[0];
  const voiceChannel = message.member!.voice?.channel;
  if (!voiceChannel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message) && initialLink) {
      setSeamless(server, playLinkNow, [message, args, mgid, server, sheetName], sentMsg);
    }
    return;
  }
  if (!isValidRequestPlayLink(server, message, initialLink)) return;
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  server.numSinceLastEmbed += 2;
  if (initialLink.includes('.')) {
    initialLink = removeFormattingLink(initialLink);
    if (!(verifyPlaylist(initialLink) || verifyUrl(initialLink))) {
      return playFromWord(message, args, sheetName, server, mgid, true);
    }
  } else {
    return playFromWord(message, args, sheetName, server, mgid, true);
  }
  // places the currently playing into the queue history if played long enough
  if (adjustQueue) adjustQueueForPlayNow(server.audio.resource!, server);
  // counter to iterate over all args - excluding args[0]
  let linkItem = args.length - 1;
  if (adjustQueue) {
    while (linkItem > 0) {
      let url = args[linkItem];
      if (url[url.length - 1] === ',') url = url.replace(/,/, '');
      url = removeFormattingLink(url);
      await addLinkToQueue(url, message, server, mgid, true, unshiftQueue);
      linkItem--;
    }
  }
  playLinkToVC(message, server.queue[0], voiceChannel, server, 0, seekSec).then();
}

/**
 * Determines what to play from a word, dependent on sheetName. The word is provided from initalLink.
 * Uses the database if a sheetName is provided, else uses YouTube.
 * @param message The message metadata.
 * @param args The args pertaining the content. The first argument is ignored.
 * @param sheetName Optional - The sheet to reference.
 * @param server {LocalServer} The server data.
 * @param mgid The guild id.
 * @param playNow Whether to play now.
 */
function playFromWord(
  message: Message,
  args: string[],
  sheetName: string,
  server: LocalServer,
  mgid: string,
  playNow: boolean
) {
  if (sheetName) {
    runDatabasePlayCommand(args, message, sheetName, playNow, false, server).then();
  } else {
    runYoutubeSearch(
      message,
      playNow,
      server,
      args
        .map((x: string) => x)
        .splice(1)
        .join(' ')
    ).then();
  }
}

/**
 * Determines whether to proceed with the play command, based on the request. Specific for playLink.
 * @param server {LocalServer} The local server object.
 * @param message The message metadata.
 * @param link {string} The link to validate.
 * @returns {boolean} If the request is valid.
 */
function isValidRequestPlayLink(server: LocalServer, message: Message, link: string): boolean {
  if (!isValidRequestWPlay(server, message, 'add a link')) return false;
  if (!link) {
    if (!playCommandUtil(message, message.member!, server, true)) {
      message.channel.send('What should I play? Put a link or some words after the command.');
    }
    return false;
  }
  return true;
}

export { runPlayLinkCommand, playLinkNow };
