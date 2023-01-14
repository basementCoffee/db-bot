import { Message, TextChannel } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';

import { getAssumptionMultipleMethods } from './search';
import { verifyPlaylist, createQueueItem, getLinkType, botInVC, setSeamless } from '../utils/utils';
import { MAX_QUEUE_S } from '../utils/lib/constants';
import { getPlaylistItems } from '../utils/playlist';
import { updateActiveEmbed } from '../utils/embed';
import { playLinkToVC } from './stream/stream';
import { getXdb2 } from '../database/retrieval';
import { isValidRequestWPlay } from '../utils/validation';
import { universalLinkFormatter } from '../utils/formatUtils';

/**
 * Runs the checks to add random songs to the queue
 * @param wArray {Array<string>} The arguments of what to play: can be a number, keys, or a playlist-name with a number
 * @param message The message that triggered the bot
 * @param sheetName The name of the sheet to reference
 * @param server {LocalServer} The local server object
 * @param addToFront {boolean?} True if to add to the front
 * @param isShuffle {boolean?} Whether it is a shuffle command (will shuffle the queue if no args are provided)
 */
async function runRandomToQueue(
  wArray: Array<string>,
  message: Message,
  sheetName: string,
  server: LocalServer,
  addToFront: boolean | null = false,
  isShuffle: boolean | null = false
) {
  wArray = wArray.filter((x: any) => x);
  if (!message.member!.voice?.channel) {
    const sentMsg = await message.channel.send(
      `must be in a voice channel to ${isShuffle ? 'shuffle' : 'play random'}`
    );
    if (!botInVC(message)) {
      setSeamless(server, runRandomToQueue, [wArray, message, sheetName, server, addToFront], sentMsg);
    }
    return;
  }
  // temporarily take just the first argument.
  if (!isValidRequestWPlay(server, message, 'shuffle keys')) return;
  let firstWord = wArray[0] || '';
  if (wArray.length < 1) {
    if (isShuffle) {
      return playRandomKeys(message, firstWord, undefined, server, false, addToFront);
    } else {
      message.channel.send('must provide an argument (can be a number, key, or playlist-link)');
    }
    return;
  }
  if (firstWord.includes('.')) {
    const link = universalLinkFormatter(firstWord);
    if (verifyPlaylist(link)) {
      return playRandomKeys(message, link, undefined, server, true, addToFront);
    }
  }
  // get the xdb playlist name if applicable
  let xdbPlaylist;
  let tempIndex = 0;
  const xdb = await getXdb2(server, sheetName, true);
  for (const word of wArray) {
    xdbPlaylist = xdb.playlists.get(word.toUpperCase());
    if (xdbPlaylist) {
      wArray.splice(tempIndex, 1);
      break;
    }
    tempIndex++;
  }
  firstWord = wArray[0];
  // convert addToFront into a number for playRandomKeys
  const numToPlay = Math.floor(Number(firstWord));
  server.numSinceLastEmbed++;
  if (!numToPlay) {
    if (firstWord) {
      playRandomKeys(message, firstWord, xdb.globalKeys, server, true, addToFront).then();
    } else {
      playRandomKeys(message, 1, xdbPlaylist || xdb.globalKeys, server, false, addToFront).then();
    }
  } else {
    if (numToPlay < 1) return message.channel.send('*invalid number*');
    // firstWord is a number
    let firstWordAsNum = parseInt(firstWord);
    if (firstWordAsNum > MAX_QUEUE_S) {
      message.channel.send('*max limit for random is ' + MAX_QUEUE_S + '*');
      firstWordAsNum = MAX_QUEUE_S;
    }
    playRandomKeys(
      message,
      firstWordAsNum,
      xdbPlaylist || xdb.playlists.get('GENERAL') || xdb.globalKeys,
      server,
      false,
      addToFront
    ).then();
  }
}

// shuffles the queue
function shuffleQueue(server: LocalServer, message: Message) {
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
function shuffleArray(array: any[]): void {
  // indices for shuffling
  let currentIndex = array.length;
  let randomIndex;
  // exclude what's actively playing (at index 0)
  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex) + 1;
    currentIndex--;
    // swap current and random index locations
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
}

/**
 *
 * @param input {string} can be a number or a word
 * @param cdb The database data.
 * @param serverQueue {Array} The server queue.
 * @param prefix The server-specific prefix.
 * @param isPlaylist {boolean} if it is a playlist link or playlist world (from db).
 * @return {Promise<{err: string}|{keys: *[], update: string}>}
 */
async function getRandomKeys(
  input: string | number,
  cdb: any,
  serverQueue: Array<any>,
  prefix: string,
  isPlaylist: boolean
): Promise<{ err?: string; keys?: any[]; update?: string }> {
  // the playlist url
  let playlistUrl;
  const randomKeysArr = [];
  // array of links
  let valArray: any;
  let updateMsg;
  if (isPlaylist) {
    // if given a cdb then it is a key-name, else it is a url
    // playlist name is passed from numOfTimes argument
    if (cdb) {
      if (typeof input !== 'string') {
        throw new Error('expected a string within getRandomKeys');
      }
      playlistUrl = cdb.get(input.toUpperCase());
      if (!playlistUrl) {
        // tries to get a close match
        const assumption = getAssumptionMultipleMethods(
          input,
          [...cdb.values()].map((item) => item.name)
        );
        if (assumption) {
          updateMsg = `could not find '${input}'. **Assuming '${assumption}'**`;
          playlistUrl = cdb.get(assumption.toUpperCase());
        }
      }
      if (playlistUrl) playlistUrl = playlistUrl.link;
    } else {
      playlistUrl = input;
    }
    if (!playlistUrl) {
      return {
        err: `*could not find **${input}** in the keys list*`
      };
    }
    input = '1';
  } else {
    valArray = [];
    cdb.forEach((value: any) => valArray.push(value.link));
    if (valArray.length < 1) {
      return {
        err: 'Your saved-links list is empty *(Try  `' + prefix + 'add` to add to a list)*'
      };
    }
  }
  // boolean to add all from cdb, if numOfTimes is negative
  let addAll = false;
  let numOfTimes = Math.floor(Number(input));
  if (!numOfTimes) {
    addAll = true;
    // number of times is now the size of the db
    numOfTimes = cdb.size;
  }
  // mutate numberOfTimes to not exceed MAX_QUEUE_S
  if (numOfTimes + serverQueue.length > MAX_QUEUE_S) {
    numOfTimes = MAX_QUEUE_S - serverQueue.length;
    if (numOfTimes < 1) {
      return {
        err: '*max queue size has been reached*'
      };
    }
    addAll = false;
  }
  try {
    let tempArray;
    for (let i = 0; i < numOfTimes; ) {
      if (isPlaylist) tempArray = [playlistUrl];
      else tempArray = [...valArray];
      let url;
      while (tempArray.length > 0 && i < numOfTimes) {
        const randomNumber = Math.floor(Math.random() * tempArray.length);
        url = tempArray[randomNumber];
        if (url) {
          if (url.url) {
            // if it is a queueItem
            randomKeysArr.push(url);
            i++;
          } else if (verifyPlaylist(url)) {
            // if it is a playlist, un-package the playlist
            // the number of items added to tempArray
            const addedItems = await getPlaylistItems(url, tempArray);
            if (isPlaylist || addAll) {
              // subtract the playlist link
              if (addAll) numOfTimes += addedItems - 1;
              // numOfTimes is new definitive value
              else numOfTimes = addedItems;
              if (randomKeysArr.length + serverQueue.length + numOfTimes - i > MAX_QUEUE_S) {
                // reduce numOfTimes if greater than MAX_QUEUE_S
                // add i because numOfTimes is in respect to i, which is num added so far
                numOfTimes = Math.max(MAX_QUEUE_S + i - randomKeysArr.length + serverQueue.length, 0);
              }
            }
          } else {
            // add url to queue
            randomKeysArr.push(createQueueItem(url, getLinkType(url), null));
            i++;
          }
        }
        // remove added item from tempArray
        tempArray.splice(randomNumber, 1);
      }
    }
    // here - queue should have all the items
  } catch (e) {
    console.log('error in getRandomKeys: ', e);
    if (isPlaylist) {
      return {
        err: 'There was an error.'
      };
    }
    updateMsg = 'there was an issue completing your request';
    // commented out because not sure if it is needed
    // const rn = Math.floor(Math.random() * valArray.length);
    // if (verifyPlaylist(valArray[rn])) {
    //   return {
    //     err: 'There was an error.',
    //   };
    // }
    // randomKeysArr.push(createQueueItem(valArray[rn], null, null));
  }
  return {
    update: updateMsg,
    keys: randomKeysArr
  };
}

/**
 * Adds a number of items from the database to the queue randomly.
 * @param message The message that triggered the bot
 * @param numOfTimes The number of items to add to the queue, or a playlist url if isPlaylist
 * @param cdb The database to reference, should be mapped to keyObjects (see getXdb2)
 * @param server The local server object
 * @param isPlaylist True if to randomize just a playlist
 * @param addToFront True if to add items to the front of the queue
 */
async function playRandomKeys(
  message: Message,
  numOfTimes: number | string,
  cdb: Map<string, any> | undefined,
  server: LocalServer,
  isPlaylist: boolean,
  addToFront: boolean | null = false
) {
  let sentMsg: any = message.channel.send('generating random from your keys...');
  const data = await getRandomKeys(numOfTimes, cdb, server.queue, server.prefix!, isPlaylist);
  sentMsg = await sentMsg;
  if (!data || data.err || !data.keys) {
    const errorTxt = data?.err || '*there was an error generating random from your keys*';
    message.channel.send(errorTxt);
    if (sentMsg && sentMsg.deletable) sentMsg.delete();
    return;
  } else if (data.update) {
    try {
      sentMsg.edit({ content: data.update });
    } catch (e) {
      message.channel.send(data.update);
    }
  } else if (sentMsg && sentMsg.deletable) {
    setTimeout(() => {
      sentMsg.delete();
    }, 1500);
  }
  playRandomKeysToVC(message, server, addToFront ?? false, data.keys);
}

/**
 * Given keys, adds the keys to the queue and, if applicable, plays them to a voice channel.
 * @param message {import('discord.js').Message} The message that triggered the bot
 * @param server {LocalServer} The server object.
 * @param addToFront {boolean} True if to add items to the front of the queue
 * @param keys {Array<*>} The keys to add to the queue and play.
 * @returns {Promise<void>}
 */
async function playRandomKeysToVC(message: Message, server: LocalServer, addToFront: boolean, keys: any[]) {
  const queueIsEmpty = server.queue.length < 1;
  const availableSpace = MAX_QUEUE_S - server.queue.length;
  if (keys.length > availableSpace) keys = keys.slice(0, availableSpace);
  server.queue.splice(addToFront ? 0 : server.queue.length, 0, ...keys);

  if (addToFront || (queueIsEmpty && server.queue.length === keys.length)) {
    await playLinkToVC(message, server.queue[0], message.member!.voice?.channel, server);
  } else if (!botInVC(message)) {
    if (botInVC(message)) {
      if (keys.length > 0) {
        updatedQueueMessage(<TextChannel>message.channel, `*added ${keys.length} to queue*`, server);
      }
    } else {
      await playLinkToVC(message, server.queue[0], message.member!.voice?.channel, server);
    }
  } else {
    updatedQueueMessage(<TextChannel>message.channel, `*added ${keys.length} to queue*`, server);
  }
}

/**
 * Sends a message that the queue was updated and then updates the active embed.
 * @param channel The channel object.
 * @param messageText The text to send to the channel.
 * @param server {LocalServer} The server object.
 */
function updatedQueueMessage(channel: TextChannel, messageText: string, server: LocalServer) {
  channel.send(messageText);
  updateActiveEmbed(server).then();
}

export { runRandomToQueue, shuffleQueue };
