const {getXdb} = require('./database/retrieval');
const {getAssumption} = require('./database/search');
const {playLinkToVC} = require('./stream/stream');
const {
  botInVC, setSeamless, resetSession, verifyPlaylist, createQueueItem, adjustQueueForPlayNow
} = require('../utils/utils');
const {MAX_QUEUE_S, dispatcherMap} = require('../utils/process/constants');
const {updateActiveEmbed} = require('../utils/embed');
const {addPlaylistToQueue} = require('../utils/playlist');

/**
 * Executes play assuming that message args are intended for a database call.
 * The database referenced depends on what is passed in via mgid.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetName the name of the sheet to reference
 * @param playRightNow bool of whether to play now or now
 * @param printErrorMsg prints error message, should be true unless attempting a followup db run
 * @param server The server playback metadata
 * @returns {Promise<boolean>} whether the play command has been handled accordingly
 */
async function runDatabasePlayCommand (args, message, sheetName, playRightNow, printErrorMsg, server) {
  if (!args[1]) {
    message.channel.send("*put a key-name after the command to play a specific key*");
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
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  } else if (server.queue.length >= MAX_QUEUE_S) {
    message.channel.send('*max queue size has been reached*');
    return true;
  }
  server.numSinceLastEmbed++;
  const xdb = await getXdb(server, sheetName, true);
  let queueWasEmpty = false;
  // if the queue is empty then play
  if (server.queue.length < 1) {
    queueWasEmpty = true;
  }
  let tempUrl;
  let dbAddedToQueue = 0;
  if (args[2]) {
    let dbAddInt = 1;
    let unFoundString = '*could not find: ';
    let firstUnfoundRan = false;
    let otherSheet;
    let first = true;
    while (args[dbAddInt]) {
      args[dbAddInt] = args[dbAddInt].replace(/,/, '');
      tempUrl = xdb.referenceDatabase.get(args[dbAddInt].toUpperCase());
      if (tempUrl) {
        // push to queue
        await pushToQueue(message, server, first, playRightNow, tempUrl);
        if (first) first = false;
      } else {
        // check personal db if applicable
        if (sheetName.substring(0, 1) !== 'p') {
          if (!otherSheet) {
            const xdb = await getXdb(server, `p${message.member.id}`, true);
            otherSheet = xdb.referenceDatabase;
          }
          tempUrl = otherSheet.get(args[dbAddInt].toUpperCase());
          if (tempUrl) {
            // push to queue
            await pushToQueue(message, server, first, playRightNow, tempUrl);
            if (first) first = false;
            dbAddInt++;
            continue;
          }
        }
        if (firstUnfoundRan) {
          unFoundString = unFoundString.concat(', ');
        }
        unFoundString = unFoundString.concat(args[dbAddInt]);
        firstUnfoundRan = true;
      }
      dbAddInt++;
    }
    if (firstUnfoundRan) {
      unFoundString = unFoundString.concat('*');
      message.channel.send(unFoundString);
    }
    if (playRightNow) {
      playLinkToVC(message, server.queue[0], voiceChannel, server);
      return true;
    } else {
      message.channel.send('*added ' + dbAddedToQueue + ' to queue*');
      await updateActiveEmbed(server);
    }
  } else {
    tempUrl = xdb.referenceDatabase.get(args[1].toUpperCase());
    if (!tempUrl) {
      const ss = getAssumption(args[1], xdb.congratsDatabase);
      if (ss) {
        message.channel.send("could not find '" + args[1] + "'. **Assuming '" + ss + "'**");
        tempUrl = xdb.referenceDatabase.get(ss.toUpperCase());
        const playlistType = verifyPlaylist(tempUrl);
        if (playRightNow) { // push to queue and play
          adjustQueueForPlayNow(dispatcherMap[voiceChannel.id], server);
          if (playlistType) {
            await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
          } else {
            server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
          }
          playLinkToVC(message, server.queue[0], voiceChannel, server);
          message.channel.send('*playing now*');
          return true;
        } else {
          if (playlistType) {
            dbAddedToQueue = await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
          } else {
            server.queue.push(createQueueItem(tempUrl, playlistType, null));
          }
        }
      } else if (!printErrorMsg) {
        if (sheetName.includes('p')) {
          message.channel.send(`*could not find **${args[1]}** in the keys list*`);
          return true;
        } else {
          runDatabasePlayCommand(args, message, `p${message.member.id}`, playRightNow, false, server).then();
          return true;
        }
      } else if (ss?.length > 0) {
        message.channel.send("*could not find '" + args[1] + "' in database*\n*Did you mean: " + ss + '*');
        return true;
      } else {
        message.channel.send(`*could not find **${args[1]}** in the keys list*`);
        return true;
      }
    } else { // did find in database
      const playlistType = verifyPlaylist(tempUrl);
      if (playRightNow) { // push to queue and play
        adjustQueueForPlayNow(dispatcherMap[voiceChannel.id], server);
        if (playlistType) {
          await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
        } else {
          server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
        }
        playLinkToVC(message, server.queue[0], voiceChannel, server);
        message.channel.send('*playing now*');
        return true;
      } else {
        // push to queue
        if (playlistType) {
          await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
        } else {
          server.queue.push(createQueueItem(tempUrl, playlistType, null));
        }
      }
    }
    if (!queueWasEmpty) {
      message.channel.send('*added ' + (dbAddedToQueue > 1 ? dbAddedToQueue + ' ' : '') + 'to queue*');
      await updateActiveEmbed(server);
    }
  }
  // if queue was empty then play
  if (queueWasEmpty && server.queue.length > 0) {
    playLinkToVC(message, server.queue[0], voiceChannel, server);
  }
  return true;
}

async function pushToQueue (message, server, first, playRightNow, tempUrl) {
  let dbAddedToQueue = 0;
  const playlistType = verifyPlaylist(tempUrl);
  if (playlistType) {
    dbAddedToQueue += await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
  } else if (playRightNow) {
    if (first) {
      server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
    } else server.queue.splice(dbAddedToQueue, 0, createQueueItem(tempUrl, playlistType, null));
    dbAddedToQueue++;
  } else {
    server.queue.push(createQueueItem(tempUrl, playlistType, null));
    dbAddedToQueue++;
  }
  return dbAddedToQueue;
}

module.exports = {runDatabasePlayCommand}