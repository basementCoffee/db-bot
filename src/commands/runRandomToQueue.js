const {addRandomToQueue} = require('./stream/stream');
const {getXdb2} = require('./database/retrieval');
const {botInVC, setSeamless, resetSession} = require('../utils/utils');
const {MAX_QUEUE_S} = require('../utils/process/constants');
const {hasDJPermissions} = require('../utils/permissions');

/**
 * Runs the checks to add random songs to the queue
 * @param num The number of songs to be added to random, could be string
 * @param message The message that triggered the bot
 * @param sheetName The name of the sheet to reference
 * @param server The server playback metadata
 * @param addToFront Optional - true if to add to the front
 */
async function runRandomToQueue(num, message, sheetName, server, addToFront = false) {
  if (!message.member.voice?.channel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play random');
    if (!botInVC(message)) {
      setSeamless(server, runRandomToQueue, [num, message, sheetName, server, addToFront], sentMsg);
    }
    return;
  }
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  }
  if (server.dictator && message.member.id !== server.dictator.id) {
    return message.channel.send('only the dictator can randomize to queue');
  }
  // in case of force disconnect
  if (!botInVC(message)) resetSession(server);
  else if (server.queue.length >= MAX_QUEUE_S) {
    return message.channel.send('*max queue size has been reached*');
  }
  let isPlaylist;
  // holds the string
  const origArg = num || 1;
  // convert addToFront into a number for addRandomToQueue
  num = Math.floor(num);
  if (!num) isPlaylist = true;
  else if (num < 1) return message.channel.send('*invalid number*');
  server.numSinceLastEmbed++;
  // addToFront parameter must be a number for addRandomToQueue
  if (addToFront) addToFront = 1;
  // if no arguments, assumes that the active queue should be shuffled
  if (origArg.toString().includes('.')) {
    return addRandomToQueue(message, origArg, undefined, server, true, addToFront);
  }
  const xdb = await getXdb2(server, sheetName, true);
  if (isPlaylist) {
    addRandomToQueue(message, origArg, xdb.globalKeys, server, true, addToFront).then();
  } else {
    if (num > MAX_QUEUE_S) {
      message.channel.send('*max limit for random is ' + MAX_QUEUE_S + '*');
      num = MAX_QUEUE_S;
    }
    addRandomToQueue(message, num, xdb.globalKeys, server, false, addToFront).then();
  }
}

/**
 * Shuffles the provided array. If provided a Message object, sends an update to the user regarding its status.
 * @param array {Array<*>} The array to shuffle.
 * @param message {Object?} The message object.
 * @returns {void}
 */
function shuffleArray(array) {
  let currentIndex = array.length; let randomIndex; // indices for shuffling
  // don't include what's actively playing
  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex) + 1;
    currentIndex--;
    // swap current and random index locations
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
}

// shuffles the queue
function shuffleQueue(server, message) {
  if (!botInVC(message)) {
    message.channel.send('*must be in an active session to shuffle the queue*');
    return;
  }
  if (server.queue.length < 3) {
    message.channel.send('*not enough links in queue to shuffle*');
    return;
  }
  // save the first item to prevent it from being shuffled
  const firstItem = server.queue.shift();
  shuffleArray(server.queue);
  server.queue.unshift(firstItem);
  message.channel.send('*your queue has been shuffled*');
}

module.exports = {runRandomToQueue, shuffleQueue};
