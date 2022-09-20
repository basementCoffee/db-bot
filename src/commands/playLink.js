const {
  botInVC, setSeamless, resetSession, removeFormattingLink, verifyPlaylist, verifyUrl, pushQueue,
} = require('../utils/utils');
const {MAX_QUEUE_S} = require('../utils/lib/constants');
const {hasDJPermissions} = require('../utils/permissions');
const {addLinkToQueue} = require('../utils/playlist');
const {playLinkToVC} = require('./stream/stream');
const {updateActiveEmbed} = require('../utils/embed');
const {playCommandUtil} = require('./stream/utils');
const {playFromWord} = require('./playFromWord');

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
  if (!args[1]) {
    if (playCommandUtil(message, message.member, server, true)) return;
    return message.channel.send('What should I play? Put a link or some words after the command.');
  }
  if (server.dictator && message.member.id !== server.dictator.id) {
    return message.channel.send('only the dictator can perform this action');
  }
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  } else if (server.queue.length >= MAX_QUEUE_S) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  }
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


module.exports = {runPlayLinkCommand};
