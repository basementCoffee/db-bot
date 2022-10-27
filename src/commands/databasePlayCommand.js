const { getXdb2 } = require('../database/retrieval');
const { getAssumptionMultipleMethods } = require('./search');
const { playLinkToVC } = require('./stream/stream');
const {
  botInVC, setSeamless, verifyPlaylist, createQueueItem, adjustQueueForPlayNow,
} = require('../utils/utils');
const { MAX_QUEUE_S } = require('../utils/lib/constants');
const { updateActiveEmbed } = require('../utils/embed');
const { addPlaylistToQueue } = require('../utils/playlist');
const { isValidRequestWPlay } = require('../utils/validation');

/**
 * Plays an entire custom playlist.
 * @param args {Array<string>} The array of playlists to play.
 * @param message {import('Discord.js').Message} The message object.
 * @param sheetName {string} The name of the sheet to reference.
 * @param playRightNow {boolean} If the playlist should be played right now.
 * @param printErrorMsg {boolean} If an error message should be printed.
 * @param server {Server} The server metadata.
 * @param shuffle {boolean?}
 * @returns {Promise<void>}
 */
async function playPlaylistDB(args, message, sheetName, playRightNow, printErrorMsg, server, shuffle) {
  if (args.length < 1) {
    message.channel.send('*input playlist names after the command to play a specific playlists*');
    return;
  }
  const xdb = await getXdb2(server, sheetName, true);
  args.reverse();
  const keys = [];
  let playlistMap;
  const assumptionList = [];
  const unfoundPlaylists = [];
  for (const playlistName of args) {
    playlistMap = xdb.playlists.get(playlistName.toUpperCase());
    if (!playlistMap) {
      const assumption = getAssumptionMultipleMethods(playlistName, xdb.playlistArray);
      if (assumption) {
        playlistMap = xdb.playlists.get(assumption.toUpperCase());
        assumptionList.push(playlistName, assumption);
      }
      else {
        unfoundPlaylists.push(playlistName);
        continue;
      }
    }
    playlistMap.forEach((val) => keys.push(val.name));
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
  await runDatabasePlayCommand(keys, message, sheetName, playRightNow, printErrorMsg, server);
}

/**
 * Executes play assuming that message args are intended for a database call.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetName the name of the sheet to reference
 * @param playRightNow bool of whether to play now or now
 * @param printErrorMsg prints error message, should be true unless attempting a followup db run
 * @param server The server playback metadata
 * @returns {Promise<boolean>} whether the play command has been handled accordingly
 */
async function runDatabasePlayCommand(args, message, sheetName, playRightNow, printErrorMsg, server) {
  if (!args[1]) {
    message.channel.send('*put a key-name after the command to play a specific key*');
    return true;
  }
  const voiceChannel = message.member.voice?.channel;
  if (!voiceChannel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message)) {
      setSeamless(server, runDatabasePlayCommand, [args, message, sheetName, playRightNow, printErrorMsg, server],
        sentMsg);
    }
    return true;
  }
  if (!isValidRequestWPlay(server, message, 'add keys')) return true;
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
  let dbAddedToQueue = 0;
  if (args[2]) {
    let dbAddInt;
    let unFoundString = '*could not find: ';
    let firstUnfoundRan = false;
    let incrementor;
    let whileExpression;
    let addQICallback;
    if (playRightNow) {
      dbAddInt = args.length - 1;
      incrementor = () => --dbAddInt;
      whileExpression = () => dbAddInt;
      addQICallback = (queueItem) => server.queue.unshift(queueItem);
    }
    else {
      dbAddInt = 1;
      incrementor = () => ++dbAddInt;
      whileExpression = () => dbAddInt < args.length;
      addQICallback = (queueItem) => server.queue.push(queueItem);
    }
    while (whileExpression()) {
      args[dbAddInt] = args[dbAddInt].replace(/,/, '');
      tempUrl = xdb.globalKeys.get(args[dbAddInt].toUpperCase())?.link;
      if (tempUrl) {
        // push to queue
        dbAddedToQueue += await addLinkToQueueSimple(message, server, playRightNow, tempUrl, addQICallback);
        if (server.queue.length >= MAX_QUEUE_S) break;
      }
      else {
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
      return true;
    }
    else {
      const msgTxt = '*added ' + (dbAddedToQueue > 1 ? dbAddedToQueue + ' ' : '') + 'to queue*';
      if (tempMsg && tempMsg.deletable) {
        tempMsg.edit(msgTxt);
      }
      else {
        message.channel.send(msgTxt);
      }
      await updateActiveEmbed(server);
    }
  }
  else {
    tempUrl = xdb.globalKeys.get(args[1].toUpperCase())?.link;
    if (!tempUrl) {
      const ss = getAssumptionMultipleMethods(args[1], [...xdb.globalKeys.values()].map((item) => item.name));
      if (ss) {
        message.channel.send('could not find \'' + args[1] + '\'. **Assuming \'' + ss + '\'**');
        tempUrl = xdb.globalKeys.get(ss.toUpperCase())?.link;
        const playlistType = verifyPlaylist(tempUrl);
        if (playRightNow) { // push to queue and play
          adjustQueueForPlayNow(server.audio.resource, server);
          if (playlistType) {
            await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
          }
          else {
            server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
          }
          playLinkToVC(message, server.queue[0], voiceChannel, server);
          message.channel.send('*playing now*');
          return true;
        }
        else if (playlistType) {
          dbAddedToQueue = await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
        }
        else {
          server.queue.push(createQueueItem(tempUrl, playlistType, null));
        }
      }
      else if (!printErrorMsg) {
        message.channel.send(`*could not find **${args[1]}** in the keys list*`);
        return true;
      }
      else if (ss?.length > 0) {
        message.channel.send('*could not find \'' + args[1] + '\' in database*\n*Did you mean: ' + ss + '*');
        return true;
      }
      else {
        message.channel.send(`*could not find **${args[1]}** in the keys list*`);
        return true;
      }
    }
    else { // did find in database
      const playlistType = verifyPlaylist(tempUrl);
      if (playRightNow) { // push to queue and play
        await adjustQueueForPlayNow(server.audio.resource, server);
        if (playlistType) {
          await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
        }
        else {
          server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
        }
        playLinkToVC(message, server.queue[0], voiceChannel, server);
        message.channel.send('*playing now*');
        return true;
      }
      else {
        // push to queue
        if (playlistType) {
          await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
        }
        else {
          server.queue.push(createQueueItem(tempUrl, playlistType, null));
        }
      }
    }
    if (!queueWasEmpty) {
      const msgTxt = '*added ' + (dbAddedToQueue > 1 ? dbAddedToQueue + ' ' : '') + 'to queue*';
      if (tempMsg && tempMsg.deletable) {
        tempMsg.edit(msgTxt);
      }
      else {
        message.channel.send(msgTxt);
      }
      await updateActiveEmbed(server);
    }
  }
  // if queue was empty then play
  if (queueWasEmpty && server.queue.length > 0) {
    playLinkToVC(message, server.queue[0], voiceChannel, server);
  }
  return true;
}

/**
 * Pushes a link to the queue. Will add individual links if valid playlist is provided.
 * @param message The message object.
 * @param server The server metadata.
 * @param addToFront If it should be added to the beginning of the queue.
 * @param tempUrl The url to add.
 * @param addQICallback A callback for the generated queueItem.
 * @returns {Promise<number>} The number of links added to the queue.
 */
async function addLinkToQueueSimple(message, server, addToFront, tempUrl, addQICallback) {
  let dbAddedToQueue = 0;
  const playlistType = verifyPlaylist(tempUrl);
  if (playlistType) {
    dbAddedToQueue += await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, addToFront);
  }
  else {
    addQICallback(createQueueItem(tempUrl, playlistType, null));
    dbAddedToQueue++;
  }
  return dbAddedToQueue;
}

module.exports = { runDatabasePlayCommand, playPlaylistDB };
