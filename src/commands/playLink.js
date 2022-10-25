const {
  botInVC, setSeamless, resetSession, removeFormattingLink, verifyPlaylist, verifyUrl, pushQueue,
  adjustQueueForPlayNow, unshiftQueue,
} = require('../utils/utils');
const {MAX_QUEUE_S} = require('../utils/lib/constants');
const {hasDJPermissions} = require('../utils/permissions');
const {addLinkToQueue} = require('../utils/playlist');
const {playLinkToVC} = require('./stream/stream');
const {updateActiveEmbed} = require('../utils/embed');
const {playCommandUtil} = require('./stream/utils');
const {runDatabasePlayCommand} = require('./databasePlayCommand');
const {runYoutubeSearch} = require('./stream/youtubeSearch');

/**
 * Runs the commands and checks to play a link
 * @param message The message that triggered the bot
 * @param args An array of given play parameters, should be links or keywords
 * @param mgid The message guild id
 * @param server The server playback metadata
 * @param sheetName The name of the sheet to reference
 */
async function runPlayLinkCommand(message, args, mgid, server, sheetName) {
  if (!message.member.voice?.channel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message) && args[1]) {
      setSeamless(server, runPlayLinkCommand, [message, args, mgid, server, sheetName], sentMsg);
    }
    return;
  }
  if (!isValidRequest(server, message, args[1])) return;
  if (args[1].includes('.')) {
    args[1] = removeFormattingLink(args[1]);
    if (!(verifyPlaylist(args[1]) || verifyUrl(args[1]))) {
      return playFromWord(message, args, sheetName, server, mgid, false);
    }
  } else return playFromWord(message, args, sheetName, server, mgid, false);
  // valid link
  let queueWasEmpty = false;
  if (server.queue.length < 1) {
    queueWasEmpty = true;
  }
  // the number of added links
  let pNums = 0;
  // counter to iterate over remaining link args
  let linkItem = 1;
  while (args[linkItem]) {
    let url = args[linkItem];
    if (url[url.length - 1] === ',') url = url.replace(/,/, '');
    pNums += await addLinkToQueue(args[linkItem], message, server, mgid, false, pushQueue);
    linkItem++;
  }
  // if queue was empty then play
  if (queueWasEmpty) {
    playLinkToVC(message, server.queue[0], message.member.voice?.channel, server, 0).then();
  } else {
    message.channel.send('*added ' + (pNums < 2 ? '' : (pNums + ' ')) + 'to queue*');
    await updateActiveEmbed(server);
  }
}


/**
 * Runs the play now command.
 * @param message the message that triggered the bot
 * @param args the message split into an array (ignores the first argument)
 * @param mgid the message guild id
 * @param server The server playback metadata
 * @param sheetName the name of the sheet to reference
 * @param seekSec {number?} Optional - The amount of time to seek in seconds
 * @param adjustQueue {boolean?} Whether to adjust the queue (is true by default).
 */
async function playLinkNow(message, args, mgid, server, sheetName, seekSec, adjustQueue = true) {
  const voiceChannel = message.member.voice?.channel;
  if (!voiceChannel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message) && args[1]) {
      setSeamless(server, playLinkNow, [message, args, mgid, server, sheetName], sentMsg);
    }
    return;
  }
  if (!isValidRequest(server, message, args[1])) return;
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  server.numSinceLastEmbed += 2;
  if (args[1].includes('.')) {
    args[1] = removeFormattingLink(args[1]);
    if (!(verifyPlaylist(args[1]) || verifyUrl(args[1]))) {
      return playFromWord(message, args, sheetName, server, mgid, true);
    }
  } else return playFromWord(message, args, sheetName, server, mgid, true);
  // places the currently playing into the queue history if played long enough
  if (adjustQueue) adjustQueueForPlayNow(server.audio.resource, server);
  // counter to iterate over all args - excluding args[0]
  let linkItem = args.length - 1;
  if (adjustQueue) {
    while (linkItem > 0) {
      let url = args[linkItem];
      if (url[url.length - 1] === ',') url = url.replace(/,/, '');
      await addLinkToQueue(url, message, server, mgid, true, unshiftQueue);
      linkItem--;
    }
  }
  playLinkToVC(message, server.queue[0], voiceChannel, server, 0, seekSec).then();
}

/**
 * Determines what to play from a word, dependent on sheetName. The word is provided from args[1].
 * Uses the database if a sheetName is provided, else uses YouTube.
 * @param message The message metadata.
 * @param args The args pertaining the content.
 * @param sheetName Optional - The sheet to reference.
 * @param server The server data.
 * @param mgid The guild id.
 * @param playNow Whether to play now.
 */
function playFromWord(message, args, sheetName, server, mgid, playNow) {
  if (sheetName) {
    runDatabasePlayCommand(args, message, sheetName, playNow, false, server).then();
  } else {
    runYoutubeSearch(message, playNow, server, args.map((x) => x).splice(1).join('')).then();
  }
}

/**
 * Determines whether to proceed with the play command, based on the request.
 * @param server
 * @param message
 * @param link
 * @return {boolean} Returns true if the command should NOT proceed.
 */
function isValidRequest(server, message, link) {
  if (server.dictator && message.member.id !== server.dictator.id) {
    message.channel.send('only the dictator can perform this action');
    return false;
  }
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
    message.channel.send('the queue is locked: only the DJ can add to the queue');
    return false;
  }
  if (!link) {
    if (!playCommandUtil(message, message.member, server, true)) {
      message.channel.send('What should I play? Put a link or some words after the command.');
    }
    return false;
  }
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  } else if (server.queue.length >= MAX_QUEUE_S) {
    message.channel.send('*max queue size has been reached*');
    return false;
  }
  return true;
}


module.exports = {runPlayLinkCommand, playLinkNow};
