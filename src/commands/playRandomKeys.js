const { getAssumptionMultipleMethods } = require('./search');
const { verifyPlaylist, createQueueItem, getLinkType, botInVC, setSeamless } = require('../utils/utils');
const { MAX_QUEUE_S } = require('../utils/lib/constants');
const { getPlaylistItems } = require('../utils/playlist');
const { updateActiveEmbed } = require('../utils/embed');
const { playLinkToVC } = require('./stream/stream');
const { getXdb2 } = require('../database/retrieval');
const { isValidRequestWPlay } = require('../utils/validation');

/**
 * Runs the checks to add random songs to the queue
 * @param wArray {Array<string>} The arguments of what to play: can be a number, keys, or a playlist-name with a number todo: finish implementation
 * @param message The message that triggered the bot
 * @param sheetName The name of the sheet to reference
 * @param server The server playback metadata
 * @param addToFront Optional - true if to add to the front
 */
async function runRandomToQueue(wArray, message, sheetName, server, addToFront = false) {
  wArray = wArray.filter((x) => x);
  if (wArray.length < 1) {
    message.channel.send('must provide an argument (can be a number, key, or playlist-link)');
    return;
  }
  if (!message.member.voice?.channel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play random');
    if (!botInVC(message)) {
      setSeamless(server, runRandomToQueue, [wArray, message, sheetName, server, addToFront], sentMsg);
    }
    return;
  }
  // temporarily take just the first argument. TODO: remove and implement proper wildcard functionality
  let firstWord = wArray[0] || '';
  if (!isValidRequestWPlay(server, message, 'shuffle keys')) return;
  // if no arguments, assumes that the active queue should be shuffled
  if (firstWord.toString().includes('.')) {
    return playRandomKeys(message, firstWord, undefined, server, true, addToFront);
  }
  let isPlaylist;
  // holds the string
  const origArg = firstWord || 1;
  // convert addToFront into a number for playRandomKeys
  firstWord = Math.floor(firstWord);
  if (!firstWord) isPlaylist = true;
  else if (firstWord < 1) return message.channel.send('*invalid number*');
  server.numSinceLastEmbed++;
  // addToFront parameter must be a number for playRandomKeys
  if (addToFront) addToFront = 1;
  const xdb = await getXdb2(server, sheetName, true);
  if (isPlaylist) {
    playRandomKeys(message, origArg, xdb.globalKeys, server, true, addToFront).then();
  }
  else {
    if (firstWord > MAX_QUEUE_S) {
      message.channel.send('*max limit for random is ' + MAX_QUEUE_S + '*');
      firstWord = MAX_QUEUE_S;
    }
    playRandomKeys(message, firstWord, xdb.globalKeys, server, false, addToFront).then();
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

/**
 * Shuffles the provided array in place. Does not shuffle the first item in the array.
 * @param array {Array<*>} The array to shuffle.
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

/**
 * Adds a number of items from the database to the queue randomly.
 * @param message The message that triggered the bot
 * @param numOfTimes The number of items to add to the queue, or a playlist url if isPlaylist
 * @param cdb {Map}  The database to reference, should be mapped to keyObjects (see getXdb2)
 * @param server The server playback metadata
 * @param isPlaylist Optional - True if to randomize just a playlist
 * @param addToFront {number} Optional - Should be 1 if to add items to the front of the queue
 */
async function playRandomKeys(message, numOfTimes, cdb, server, isPlaylist, addToFront = 0) {
  // the playlist url
  let playlistUrl;
  let sentMsg;
  // array of links
  let valArray;
  if (isPlaylist) {
    // if given a cdb then it is a key-name, else it is a url
    // playlist name is passed from numOfTimes argument
    if (cdb) {
      playlistUrl = cdb.get(numOfTimes.toUpperCase()) || (() => {
        // tries to get a close match
        const assumption = getAssumptionMultipleMethods(numOfTimes, [...cdb.values()].map((item) => item.name));
        if (assumption) {
          message.channel.send(`could not find '${numOfTimes}'. **Assuming '${assumption}'**`);
          return cdb.get(assumption.toUpperCase());
        }
        return null;
      })();
      if (playlistUrl) playlistUrl = playlistUrl.link;
    }
    else {playlistUrl = numOfTimes;}
    if (!playlistUrl) return message.channel.send(`*could not find **${numOfTimes}** in the keys list*`);
    numOfTimes = 1;
    if (verifyPlaylist(playlistUrl)) sentMsg = message.channel.send('randomizing your playlist...');
  }
  else {
    valArray = [];
    cdb.forEach((value) => valArray.push(value.link));
    if (valArray.length < 1) {
      const pf = server.prefix;
      return message.channel.send('Your saved-links list is empty *(Try  `' + pf + 'add` to add to a list)*');
    }
    if (numOfTimes > 50) sentMsg = message.channel.send('generating random from your keys...');
  }
  // boolean to add all from cdb, if numOfTimes is negative
  let addAll = false;
  if (numOfTimes < 0) {
    addAll = true;
    numOfTimes = cdb.size; // number of times is now the size of the db
  }
  // mutate numberOfTimes to not exceed MAX_QUEUE_S
  if (numOfTimes + server.queue.length > MAX_QUEUE_S) {
    numOfTimes = MAX_QUEUE_S - server.queue.length;
    if (numOfTimes < 1) return message.channel.send('*max queue size has been reached*');
    addAll = false; // no longer want to add all
  }
  const queueWasEmpty = server.queue.length < 1;
  // place a filler string in the queue to show that it will no longer be empty
  // in case of another function call at the same time
  if (queueWasEmpty && !addToFront) server.queue[0] = 'filler link';
  try {
    let tempArray;
    for (let i = 0; i < numOfTimes;) {
      if (isPlaylist) tempArray = [playlistUrl];
      else tempArray = [...valArray];
      // continues until numOfTimes is 0 or the tempArray is completed
      let url;
      while (tempArray.length > 0 && (i < numOfTimes)) {
        const randomNumber = Math.floor(Math.random() * tempArray.length);
        url = tempArray[randomNumber];
        if (url.url) {
          // if it is a queueItem
          if (addToFront) {
            server.queue.splice(addToFront - 1, 0, url);
            addToFront++;
          }
          else {server.queue.push(url);}
          i++;
        }
        else if (verifyPlaylist(url)) {
          // if it is a playlist, un-package the playlist
          // the number of items added to tempArray
          const addedItems = await getPlaylistItems(url, tempArray);
          if (isPlaylist || addAll) {
            if (addAll) numOfTimes += addedItems - 1; // subtract the playlist link
            else numOfTimes = addedItems; // numOfTimes is new definitive value
            if ((server.queue.length + numOfTimes - i) > MAX_QUEUE_S) {
              // reduce numOfTimes if greater than MAX_QUEUE_S
              // add i because numOfTimes is in respect to i, which is num added so far
              numOfTimes = Math.max(MAX_QUEUE_S + i - server.queue.length, 0);
            }
            if (server.queue[0] === 'filler link') {
              server.queue.shift();
              numOfTimes++;
            }
          }
        }
        else if (url) {
          // add url to queue
          if (addToFront) {
            server.queue.splice(addToFront - 1, 0, createQueueItem(url, getLinkType(url), null));
            addToFront++;
          }
          else {server.queue.push(createQueueItem(url, getLinkType(url), null));}
          i++;
        }
        // remove added item from tempArray
        tempArray.splice(randomNumber, 1);
      }
    }
    // here - queue should have all the items
  }
  catch (e) {
    console.log('error in random: ', e);
    if (isPlaylist) return;
    const rn = Math.floor(Math.random() * valArray.length);
    sentMsg = await sentMsg;
    if (sentMsg?.deletable) sentMsg.delete();
    if (verifyPlaylist(valArray[rn])) {
      return message.channel.send('There was an error.');
    }
    server.queue.push(createQueueItem(valArray[rn], null, null));
  }
  // remove the filler string
  if (server.queue[0] === 'filler link') server.queue.shift();
  if (addToFront || (queueWasEmpty && server.queue.length === numOfTimes)) {
    await playLinkToVC(message, server.queue[0], message.member.voice?.channel, server);
  }
  else if (!botInVC(message)) {
    if (botInVC(message)) {
      updatedQueueMessage(message.channel, `*added ${numOfTimes} to queue*`, server);
    }
    else {
      await playLinkToVC(message, server.queue[0], message.member.voice?.channel, server);
    }
  }
  else {
    updatedQueueMessage(message.channel, `*added ${numOfTimes} to queue*`, server);
  }
  sentMsg = await sentMsg;
  if (sentMsg?.deletable) sentMsg.delete();
}

/**
 * Sends a message that the queue was updated and then updates the active embed.
 * @param channel The channel object.
 * @param messageText The text to send to the channel.
 * @param server The server object.
 */
function updatedQueueMessage(channel, messageText, server) {
  channel.send(messageText);
  updateActiveEmbed(server).then();
}

module.exports = { runRandomToQueue, shuffleQueue };
