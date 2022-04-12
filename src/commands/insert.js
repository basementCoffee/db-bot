const {verifyUrl, verifyPlaylist, linkFormatter, createQueueItem} = require('../utils/utils');
const {getXdb} = require('./database/retrieval');
const {
  SPOTIFY_BASE_LINK, StreamType, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, MAX_QUEUE_S
} = require('../utils/process/constants');
const {addPlaylistToQueue} = require('../utils/playlist');
const ytpl = require('ytpl');
const {updateActiveEmbed} = require('../utils/embed');

/**
 * Inserts a term into position into the queue. Accepts a valid link or key.
 * @param message The message metadata.
 * @param mgid The message guild id.
 * @param args {string[]} An array of string args to parse, can include multiple terms and a position.
 * @param server The server to use.
 * @returns {Promise<number>} The position to insert or a negative if failed.
 */
async function runInsertCommand (message, mgid, args, server) {
  if (!args) return -1;
  if (insertCommandVerification(message, server, args) !== 1) return -1;
  let num = args.filter(item => !Number.isNaN(Number(item))).slice(-1)[0];
  let links;
  // get position
  if (num) {
    links = args.filter(item => item !== num);
    num = parseInt(num);
  } else {
    links = args;
    if (server.queue.length === 1) num = 1;
    else {
      const sentMsg = await message.channel.send('What position would you like to insert? (1-' + server.queue.length + ') [or type \'q\' to quit]');
      const filter = m => {
        return (message.author.id === m.author.id);
      };
      let messages = await sentMsg.channel.awaitMessages(filter, {time: 60000, max: 1, errors: ['time']});
      num = messages.first().content.trim();
      if (num.toLowerCase() === 'q') {
        message.channel.send('*cancelled*');
        return -1;
      } else {
        num = parseInt(num);
      }
      if (!num) {
        message.channel.send('*cancelled*');
        return -1;
      }
    }
  }
  if (num < 1) {
    if (num === 0) message.channel.send('0 changes what\'s actively playing, use the \'playnow\' command instead.');
    else message.channel.send('position must be a positive number');
    return -1;
  }
  if (num > server.queue.length) num = server.queue.length;
  let tempLink;
  // convert all terms into links
  let notFoundString = '';
  for (let i = 0; i < links.length; i++) {
    tempLink = links[i]?.replace(',', '');
    if (!verifyUrl(tempLink) && !verifyPlaylist(tempLink)) {
      let xdb = await getXdb(server, mgid, true);
      let link = xdb.referenceDatabase.get(tempLink.toUpperCase());
      if (!link) {
        xdb = await getXdb(server, `p${message.member.id}`, true);
        link = xdb.referenceDatabase.get(tempLink.toUpperCase());
      }
      if (!link) {
        notFoundString += `${tempLink}, `;
        links.splice(i, 1);
      } else links[i] = link;
    }
  }
  if (notFoundString.length) message.channel.send(`could not find ${notFoundString} in any keys list`);
  let pNums = 0;
  let link;
  let failedLinks = '';
  // todo - address soundcloud link issues (tested with soundcloud key)
  while (links.length > 0) {
    try {
      link = links.pop();
      if (link.includes(SPOTIFY_BASE_LINK)) {
        link = linkFormatter(link, SPOTIFY_BASE_LINK);
        pNums += await addPlaylistToQueue(message, server.queue, 0, link, StreamType.SPOTIFY, false, num);
      } else if (ytpl.validateID(link)) {
        pNums += await addPlaylistToQueue(message, server.queue, 0, link, StreamType.YOUTUBE, false, num);
      } else if (link.includes(SOUNDCLOUD_BASE_LINK)) {
        link = linkFormatter(link, SOUNDCLOUD_BASE_LINK);
        pNums += await addPlaylistToQueue(message, server.queue, 0, link, StreamType.SOUNDCLOUD, false, num);
      } else {
        server.queue.splice(num, 0, createQueueItem(link, link.includes(TWITCH_BASE_LINK) ? StreamType.TWITCH : StreamType.YOUTUBE, undefined));
        pNums++;
      }
    } catch (e) {
      failedLinks += `<${link}>, `;
    }
  }
  if (failedLinks.length) {
    message.channel.send(`there were issues adding the following: ${failedLinks.substring(0, failedLinks.length - 2)}`);
  }
  await message.channel.send(`inserted ${(pNums > 1 ? (pNums + ' links') : 'link')} into position ${num}`);
  await updateActiveEmbed(server);
  return num;
}

/**
 * Helper for runInsertCommand. Does some preliminary verification.
 * @param message The message object.
 * @param server The server.
 * @param args {Array<string>} args[1] being the term, args[2] being the position.
 * @returns {*} 1 if passed
 */
function insertCommandVerification (message, server, args) {
  if (!message.member.voice?.channel) return message.channel.send('must be in a voice channel');
  if (server.dictator && message.member.id !== server.dictator.id)
    return message.channel.send('only the dictator can insert');
  if (server.lockQueue && server.voteAdmin.filter(x => x.id === message.member.id).length === 0)
    return message.channel.send('the queue is locked: only the dj can insert');
  if (server.queue.length > MAX_QUEUE_S) return message.channel.send('*max queue size has been reached*');
  if (server.queue.length < 1) return message.channel.send('cannot insert when the queue is empty (use \'play\' instead)');
  if (!args[1]) return message.channel.send('put a link followed by a position in the queue \`(i.e. insert [link] [num])\`');
  return 1;
}

module.exports = {runInsertCommand};