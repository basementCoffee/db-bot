import { Message } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { getXdb2 } from '../database/retrieval';
import { getAssumptionMultipleMethods } from './search';
import { playLinkToVC } from './stream/stream';
import { botInVC, createQueueItem, setSeamless, verifyPlaylist } from '../utils/utils';
import { MAX_QUEUE_S } from '../utils/lib/constants';
import { updateActiveEmbed } from '../utils/embed';
import { addPlaylistToQueue } from '../utils/playlist';
import { isValidRequestWPlay } from '../utils/validation';
import { adjustQueueForPlayNow, shuffleArray, shuffleQueue } from '../utils/arrayUtils';

/**
 * Plays an entire custom playlist.
 * @param args {Array<string>} The array of playlists to play.
 * @param message {import('Discord.js').Message} The message object.
 * @param sheetName {string} The name of the sheet to reference.
 * @param playRightNow {boolean} If the playlist should be played right now.
 * @param printErrorMsg {boolean} If an error message should be printed.
 * @param server {LocalServer} The server metadata.
 * @param shuffle {boolean?} Whether to shuffle the playlist.
 * @returns {Promise<void>}
 */
async function playPlaylistDB(
  args: Array<string>,
  message: Message,
  sheetName: string,
  playRightNow: boolean,
  printErrorMsg: boolean,
  server: LocalServer,
  shuffle?: boolean
): Promise<void> {
  if (args.length < 1) {
    message.channel.send('*input playlist names after the command to play a specific playlists*');
    return;
  }
  const xdb = await getXdb2(server, sheetName, true);
  args.reverse();
  const keys: string[] = [];
  let playlistMap: any;
  const assumptionList = [];
  const unfoundPlaylists = [];
  for (const playlistName of args) {
    playlistMap = xdb.playlists.get(playlistName.toUpperCase());
    if (!playlistMap) {
      const assumption = getAssumptionMultipleMethods(playlistName, xdb.playlistArray);
      if (assumption) {
        playlistMap = xdb.playlists.get(assumption.toUpperCase());
        assumptionList.push(playlistName, assumption);
      } else {
        unfoundPlaylists.push(playlistName);
        continue;
      }
    }
    playlistMap.forEach((val: any) => keys.push(val.name));
  }
  keys.reverse();
  keys.unshift('dd');
  if (unfoundPlaylists.length > 0) {
    message.channel.send(`*could not find the playlists: ${unfoundPlaylists.join(', ')}*`);
    if (keys.length < 2) return;
  }
  if (assumptionList.length > 0) {
    let assumptionStr = 'could not find:';
    for (let i = 0; i < assumptionList.length; i += 2) {
      assumptionStr += ` ${assumptionList[i]} -> **assuming '${assumptionList[i + 1]}'**,`;
    }
    assumptionStr = assumptionStr.substring(0, assumptionStr.length - 1);
    message.channel.send(assumptionStr);
  }
  if (keys.length < 2) {
    message.channel.send('*no keys found in the playlists provided*');
    return;
  }
  const prevQueueSize = botInVC(message) ? server.queue.length : 0;
  const numAdded = await runDatabasePlayCommand(keys, message, sheetName, playRightNow, printErrorMsg, server);
  if (numAdded > 0) {
    if (prevQueueSize) {
      const itemsToShuffle = server.queue.splice(prevQueueSize, server.queue.length + 1 - numAdded);
      shuffleArray(itemsToShuffle);
      server.queue.concat(itemsToShuffle);
    } else {
      shuffleQueue(server);
    }
  }
}

/**
 * Executes play assuming that message args are intended for a database call.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetName the name of the sheet to reference
 * @param playRightNow bool of whether to play now or now
 * @param printErrorMsg prints error message, should be true unless attempting a followup db run
 * @param server {LocalServer} The server playback metadata
 * @returns The number of items added to the queue
 */
async function runDatabasePlayCommand(
  args: string[],
  message: Message,
  sheetName: string,
  playRightNow: boolean,
  printErrorMsg: boolean,
  server: LocalServer
): Promise<number> {
  if (!args[1]) {
    message.channel.send('*put a key-name after the command to play a specific key*');
    return 0;
  }
  const voiceChannel = message.member!.voice?.channel;
  if (!voiceChannel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message)) {
      setSeamless(
        server,
        runDatabasePlayCommand,
        [args, message, sheetName, playRightNow, printErrorMsg, server],
        sentMsg
      );
    }
    return 0;
  }
  if (!isValidRequestWPlay(server, message, 'add keys')) return 0;
  server.numSinceLastEmbed++;
  let tempMsg;
  if (args.length > 100) tempMsg = await message.channel.send('*getting keys...*');
  const xdb = await getXdb2(server, sheetName, true);
  let queueWasEmpty = false;
  // if the queue is empty then play
  if (server.queue.length < 1) {
    queueWasEmpty = true;
  }
  let tempUrl;
  // the number of items added to the queue
  let dbAddedToQueue = 0;
  if (args[2]) {
    let dbAddInt: number;
    let unFoundString = '*could not find: ';
    let firstUnfoundRan = false;
    let incrementor;
    let whileExpression;
    let addQICallback;
    if (playRightNow) {
      dbAddInt = args.length - 1;
      incrementor = () => --dbAddInt;
      whileExpression = () => dbAddInt;
      addQICallback = (queueItem: any) => server.queue.unshift(queueItem);
    } else {
      dbAddInt = 1;
      incrementor = () => ++dbAddInt;
      whileExpression = () => dbAddInt < args.length;
      addQICallback = (queueItem: any) => server.queue.push(queueItem);
    }
    while (whileExpression()) {
      args[dbAddInt] = args[dbAddInt].replace(/,/, '');
      tempUrl = xdb.globalKeys.get(args[dbAddInt].toUpperCase())?.link;
      if (tempUrl) {
        // push to queue
        dbAddedToQueue += await addLinkToQueueSimple(message, server, playRightNow, tempUrl, addQICallback);
        if (server.queue.length >= MAX_QUEUE_S) break;
      } else {
        if (firstUnfoundRan) {
          unFoundString = unFoundString.concat(', ');
        }
        unFoundString = unFoundString.concat(args[dbAddInt]);
        firstUnfoundRan = true;
      }
      incrementor();
    }
    if (firstUnfoundRan) {
      unFoundString = unFoundString.concat('*');
      message.channel.send(unFoundString);
    }
    if (playRightNow) {
      playLinkToVC(message, server.queue[0], voiceChannel, server);
      return dbAddedToQueue;
    } else {
      const msgTxt = '*added ' + (dbAddedToQueue > 1 ? dbAddedToQueue + ' ' : '') + 'to queue*';
      if (tempMsg && tempMsg.deletable) {
        tempMsg.edit(msgTxt);
      } else {
        message.channel.send(msgTxt);
      }
      await updateActiveEmbed(server);
    }
  } else {
    tempUrl = xdb.globalKeys.get(args[1].toUpperCase())?.link;
    if (!tempUrl) {
      const ss = getAssumptionMultipleMethods(
        args[1],
        [...xdb.globalKeys.values()].map((item) => item.name)
      );
      if (ss) {
        message.channel.send("could not find '" + args[1] + "'. **Assuming '" + ss + "'**");
        tempUrl = xdb.globalKeys.get(ss.toUpperCase())?.link;
        const playlistType: any = verifyPlaylist(tempUrl);
        if (playRightNow) {
          // push to queue and play
          adjustQueueForPlayNow(server.audio.resource!, server);
          if (playlistType) {
            await addPlaylistToQueue(message, server.queue, 0, tempUrl!, playlistType, playRightNow);
          } else {
            server.queue.unshift(createQueueItem(tempUrl!, playlistType, null));
          }
          playLinkToVC(message, server.queue[0], voiceChannel, server);
          message.channel.send('*playing now*');
          return dbAddedToQueue;
        } else if (playlistType) {
          dbAddedToQueue = await addPlaylistToQueue(message, server.queue, 0, tempUrl!, playlistType, playRightNow);
        } else {
          server.queue.push(createQueueItem(tempUrl!, playlistType, null));
        }
      } else if (!printErrorMsg) {
        message.channel.send(`*could not find **${args[1]}** in the keys list*`);
        return dbAddedToQueue;
      } else if (ss && ss.length > 0) {
        message.channel.send("*could not find '" + args[1] + "' in database*\n*Did you mean: " + ss + '*');
        return dbAddedToQueue;
      } else {
        message.channel.send(`*could not find **${args[1]}** in the keys list*`);
        return dbAddedToQueue;
      }
    } else {
      // if it was found within the database
      const playlistType: any = verifyPlaylist(tempUrl);
      if (playRightNow) {
        // push to queue and play
        await adjustQueueForPlayNow(server.audio.resource!, server);
        if (playlistType) {
          await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
        } else {
          server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
        }
        playLinkToVC(message, server.queue[0], voiceChannel, server);
        message.channel.send('*playing now*');
        return dbAddedToQueue;
      } else if (playlistType) {
        // push to queue
        await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
      } else {
        server.queue.push(createQueueItem(tempUrl, playlistType, null));
      }
    }
    if (!queueWasEmpty) {
      const msgTxt = '*added ' + (dbAddedToQueue > 1 ? dbAddedToQueue + ' ' : '') + 'to queue*';
      if (tempMsg && tempMsg.deletable) {
        tempMsg.edit(msgTxt);
      } else {
        message.channel.send(msgTxt);
      }
      await updateActiveEmbed(server);
    }
  }
  // if queue was empty then play
  if (queueWasEmpty && server.queue.length > 0) {
    playLinkToVC(message, server.queue[0], voiceChannel, server);
  }
  return dbAddedToQueue;
}

/**
 * Pushes a link to the queue. Will add individual links if valid playlist is provided.
 * @param message The message object.
 * @param server {LocalServer} The server metadata.
 * @param addToFront If it should be added to the beginning of the queue.
 * @param tempUrl The url to add.
 * @param addQICallback A callback for the generated queueItem.
 * @returns {Promise<number>} The number of links added to the queue.
 */
async function addLinkToQueueSimple(
  message: Message,
  server: LocalServer,
  addToFront: boolean,
  tempUrl: string,
  addQICallback: (any: any) => any
): Promise<number> {
  let dbAddedToQueue = 0;
  const playlistType: any = verifyPlaylist(tempUrl);
  if (playlistType) {
    dbAddedToQueue += await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, addToFront);
  } else {
    addQICallback(createQueueItem(tempUrl, playlistType, null));
    dbAddedToQueue++;
  }
  return dbAddedToQueue;
}

export { runDatabasePlayCommand, playPlaylistDB };
