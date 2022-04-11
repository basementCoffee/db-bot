const {getData, getTracks} = require('spotify-url-info');
const {MessageEmbed} = require('discord.js');
const ytdl = require('ytdl-core-discord');
const ytpl = require('ytpl');
const {
  servers, botID, SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, StreamType, bot, MAX_QUEUE_S,
  dispatcherMapStatus, dispatcherMap, LEAVE_VC_TIMEOUT, CORE_ADM
} = require('./constants');
const scdl = require('soundcloud-downloader').default;
const unpipe = require('unpipe');
const cpu = require('node-os-utils').cpu;
const os = require('os');
const CH = require('../../channel.json');
const processStats = require('./ProcessStats');

/**
 * Given a positive duration in ms, returns a formatted string separating
 * the time in days, hours, minutes, and seconds. Otherwise, returns 0m 0s.
 * Will always return two time identifiers (ex: 2d 5h, 3h 12m, 1m 2s, 0m, 30s)
 * @param duration a duration in milliseconds
 * @returns {string} a formatted string duration
 */
function formatDuration (duration) {
  const seconds = duration / 1000;
  const min = (seconds / 60);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${Math.floor(hours % 24)}h`;
  }
  if (hours > 0) {
    return `${hours}h ${Math.floor(min % 60)}m`;
  }
  if (seconds >= 0) {
    return `${Math.floor(min)}m ${Math.floor(seconds % 60)}s`;
  }
  return `0m 0s`;
}

/**
 * Given an array of durations with hours, minutes, seconds, return the duration.
 * @param durationArray An array of durations.
 * @returns {number} The duration in MS or 0 if there was an error.
 */
function convertYTFormatToMS (durationArray) {
  try {
    if (durationArray) {
      let duration = 0;
      durationArray.reverse();
      if (durationArray[1]) duration += durationArray[1] * 60000;
      if (durationArray[2]) duration += durationArray[2] * 3600000;
      duration += durationArray[0] * 1000;
      return duration;
    }
  } catch (e) {}
  return 0;
}

/**
 * Converts a provided seek format (ex: 1s 10m2s 1h31s) to seconds. If a number without an appending letter
 * is provided, then assumes it is already provided in seconds.
 * @param seekString The string to parse.
 */
function convertSeekFormatToSec (seekString) {
  let numSeconds;
  if (Number(seekString)) {
    numSeconds = seekString;
  } else {
    let array = [];
    const testVals = ['h', 'm', 's'];
    const convertToArray = (formattedNum) => {
      for (let val of testVals) {
        const search = new RegExp(`(\\d*)${val}`);
        const res = search.exec(formattedNum);
        if (res) array.push(Number(res[1]) || 0);
        else array.push(0);
      }
    };
    convertToArray(seekString);
    numSeconds = convertYTFormatToMS(array) / 1000;
  }
  return numSeconds;
}

/**
 * Returns whether the bot is in a voice channel within the guild.
 * @param message The message that triggered the bot.
 * @returns {Boolean} True if the bot is in a voice channel.
 */
function botInVC (message) {
  try {
    return message.guild.voice?.channel;
  } catch (e) {
    return false;
  }
}

/**
 * Returns whether a given ID has Admin rights.
 * @param id {string} The id of the member.
 * @return {boolean} True if provided Admin rights.
 */
function isAdmin (id) {
  // kzbuu
  return ['268554823283113985', '443150640823271436', '730350452268597300', '799524729173442620',
    '434532121244073984'].includes(id);
}

/**
 * If the id is a coreAdmin ID;
 * @param id {string} The id of the user.
 * @return {boolean} If the user is a core admin.
 */
function isCoreAdmin (id) {
  return CORE_ADM.includes(id);
}

/**
 * A wrapper for getTracks to handle errors regarding Spotify requests.
 * @param playlistUrl {string} The url to get the tracks for.
 * @param retries {number=} Used within the function for error handling.
 * @returns { Promise<Tracks[]> | Tracks[]}
 */
async function getTracksWrapper (playlistUrl, retries = 0) {
  try {
    return await getTracks(playlistUrl);
  } catch {
    if (retries < 2) return getTracksWrapper(playlistUrl, ++retries);
    else return [];
  }
}

/**
 * Returns the queue display status.
 * @param server The server.
 */
function getQueueText (server) {
  let content;
  if (server.queue.length > 1) content = `1 / ${server.queue.length}`;
  else if (server.queue.length > 0) content = (server.autoplay ? 'smartplay' : '1 / 1');
  else content = 'empty';
  return content;
}

/**
 * Returns whether a given URL is valid. Returns false if given a playlist.
 * @param url The url to verify.
 * @returns {boolean} True if given a playable URL.
 */
function verifyUrl (url) {
  return (url.includes(SPOTIFY_BASE_LINK) ? url.includes('/track/') :
    (url.includes(SOUNDCLOUD_BASE_LINK) ? scdl.isValidUrl(linkFormatter(url, SOUNDCLOUD_BASE_LINK)) :
      (ytdl.validateURL(url) || url.includes(TWITCH_BASE_LINK))) && !verifyPlaylist(url));
}

/**
 * Given a link, formats the link with https://[index of base -> end].
 * Ex: url = m.youtube.com/test & suffix = youtube.com --> https://youtube.com/test
 * @param url {string} The link to format.
 * @param baseLink {string}  The starting of the remainder of the link to always add after the prefix.
 * @returns {string} The formatted URL.
 */
function linkFormatter (url, baseLink) {
  return `https://${url.substr(url.indexOf(baseLink))}`;
}

/**
 * Returns true if the given url is a valid playlist link.
 * @param url The url to verify.
 * @returns {string | boolean} A StreamType or false.
 */
function verifyPlaylist (url) {
  try {
    url = url.toLowerCase();
    if (url.includes(SPOTIFY_BASE_LINK)) {
      if (url.includes('/playlist') || url.includes('/album')) {
        return StreamType.SPOTIFY;
      }
    } else if (url.includes(SOUNDCLOUD_BASE_LINK) && scdl.isPlaylistURL(linkFormatter(url, SOUNDCLOUD_BASE_LINK))) {
      return StreamType.SOUNDCLOUD;
    } else if ((url.includes('list=') || ytpl.validateID(url)) && !url.includes('&index=')) {
      return StreamType.YOUTUBE;
    }
  } catch (e) {}
  return false;
}

/**
 * Resets server playback to default args.
 * @param server The server to reset.
 */
function resetSession (server) {
  server.queue = [];
  server.queueHistory = [];
  server.loop = false;
}

/**
 * Adjusts the queue for play now depending on the stream time.
 * @param dsp The dispatcher to reference.
 * @param server The server to use.
 */
function adjustQueueForPlayNow (dsp, server) {
  if (server.queue[0] && dsp?.streamTime && (dsp.streamTime > 21000)) {
    server.queueHistory.push(server.queue.shift());
  }
}

/**
 * Shuffles the queue. If provided a Message object, sends an update to the user regarding its status.
 * @param queue {Array<*>} The queue to shuffle.
 * @param message {Object?} The message object.
 * @returns {*}
 */
function shuffleQueue (queue, message) {
  let currentIndex = queue.length, randomIndex; // indices for shuffling
  // don't include what's actively playing
  while (currentIndex > 1) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // swap current and random index locations
    [queue[currentIndex], queue[randomIndex]] = [queue[randomIndex], queue[currentIndex]];
  }
  if (message) message.channel.send('*your queue has been shuffled*');
}

/**
 * Gets the title of a link.
 * @param queueItem The queue item to get the title.
 * @param cutoff {number=} A number representing the cutoff value.
 * @returns {Promise<string>} The title of the provided link.
 */
async function getTitle (queueItem, cutoff) {
  let title;
  try {
    if (queueItem.type === StreamType.SPOTIFY) {
      if (!queueItem.infos) queueItem.infos = await getData(queueItem.url);
      title = queueItem.infos.name;
    } else if (queueItem.type === 'soundcloud') {
      if (!queueItem.infos) queueItem.infos = await scdl.getInfo(queueItem.url);
      title = queueItem.infos.title;
    } else if (queueItem.type === StreamType.TWITCH) {
      title = 'twitch livestream';
    } else {
      if (!queueItem.infos) queueItem.infos = await ytdl.getBasicInfo(queueItem.url);
      title = queueItem.infos.videoDetails?.title || queueItem.infos.title;
    }
  } catch (e) {
    console.log('broken_url', e);
    title = 'broken_url';
  }
  if (cutoff && title.length > cutoff) {
    title = title.substring(0, cutoff) + '...';
  }
  return title;
}

/**
 * Formats B to MB.
 * @param data The bytes to format to MB.
 * @returns {`${number}`} A string that has the number of MB.
 */
const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100}`;

/**
 * Creates an embed regarding memory usage.
 */
async function createMemoryEmbed () {
  const memUsage = process.memoryUsage();
  const cpuUsage = await cpu.usage();
  return new MessageEmbed()
    .setTitle('Memory Usage')
    .setDescription(`rss -  ${formatMemoryUsage(memUsage.rss)} MB\nheap -  ` +
      `${formatMemoryUsage(memUsage.heapUsed)} / ${formatMemoryUsage(memUsage.heapTotal)} MB ` +
      `(${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%)\ncpu: ${cpuUsage}%` +
      `\nload-avg: ${Math.round(os.loadavg()[1] * 100) / 100}%`);
}

/**
 * Initializes the server with all the required params.
 * @param mgid The message guild id.
 */
function initializeServer (mgid) {
  return servers[mgid] = {
    // now playing is the first element
    queue: [],
    // newest items are pushed
    queueHistory: [],
    // continue playing after queue end
    autoplay: false,
    // boolean status of looping
    loop: false,
    // the number of items sent since embed generation
    numSinceLastEmbed: 0,
    // the embed message
    currentEmbed: undefined,
    // the collector for the current embed message
    collector: false,
    // the playback status message
    followUpMessage: undefined,
    // the id of the channel for now-playing embeds
    currentEmbedChannelId: undefined,
    // boolean status of verbose mode - save embeds on true
    verbose: false,
    // A list of vote admins (members) in a server
    voteAdmin: [],
    // the ids of members who voted to skip
    voteSkipMembersId: [],
    // the ids of members who voted to rewind
    voteRewindMembersId: [],
    // the ids of members who voted to play/pause the link
    votePlayPauseMembersId: [],
    // locks the queue for dj mode
    lockQueue: false,
    // The member that is the acting dictator
    dictator: false,
    // If a start-up message has been sent
    startUpMessage: false,
    // the timeout IDs for the bot to leave a VC
    leaveVCTimeout: false,
    // the number of consecutive playback errors
    skipTimes: 0,
    // properties pertaining to the active stream
    streamData: {
      // the StreamType enum
      type: null,
      // the readable stream
      stream: null
      // urlAlt is added if it's a YT stream
    },
    // if a twitch notification was sent
    twitchNotif: {
      isSent: false,
      isTimer: false
    },
    // hold a ready-to-go function in case of vc join
    seamless: {
      // the name of the type of function
      function: undefined,
      // args for the function
      args: undefined,
      // optional message to delete
      message: undefined
    },
    userKeys: new Map(),
    // the server's prefix
    prefix: undefined,
    // the timeout for the YT search results
    searchReactionTimeout: undefined,
    // the timer for the active DJ
    djTimer: {
      timer: false,
      startTime: false,
      duration: 1800000
    },
    // the last time a DJ tip was sent to a group
    djMessageDate: false
  };
}

/**
 * Ends the stream if a configuration for it is available.
 * @param server The server in which to end the stream.
 */
function endStream (server) {
  try {
    if (server.streamData.type === StreamType.SOUNDCLOUD) {
      if (!server.streamData.stream._readableState.closed) console.log(`not closed: ${server.streamData.stream._readableState.pipes.length}`);
      if (server.streamData.stream._readableState.pipes.length > 0) {
        for (let v of Object.keys(server.streamData.stream._readableState.pipes[0])) {
          server.streamData.stream._readableState.pipes[v] = undefined;
        }
        server.streamData.stream._readableState.pipes.pop();
        server.streamData.stream.end();
        server.streamData.stream.destroy();
      }
    } else if (server.streamData.type === StreamType.TWITCH) {
      server.streamData.stream.end();
      unpipe(server.streamData.stream);
    }
  } catch (e) {
    console.log('Error: attempt stream close - ', e);
  }
  server.streamData.stream = null;
  server.streamData.type = null;
}

/**
 * Un-shifts the provided link to the server's queue.
 * @param queue {Array} The queue to unshift.
 * @param queueItem The item to add to the queue.
 */
function unshiftQueue (queue, queueItem) {
  queue.unshift(queueItem);
}

/**
 * Creates a queue item.
 * @param url The URL to add.
 * @param type? The type of URL. Provided as a StreamType.
 * @param infos? The infos of the URL.
 * @returns {{type, url, infos}}
 */
function createQueueItem (url, type, infos) {
  if (!type) type = getLinkType(url);
  return {
    url: url,
    type: type,
    infos: infos
  };
}

/**
 * Pushes the provided link to the server's queue.
 * @param queue {Array} The queue to push to.
 * @param queueItem The item to add to the queue.
 */
function pushQueue (queue, queueItem) {
  queue.push(queueItem);
}

/**
 * Returns a StreamType string depending on the source of the infos.
 * @param url The url to get the type of.
 * @returns {string} A StreamType.
 */
const getLinkType = (url) => {
  if (url.includes(SPOTIFY_BASE_LINK)) return StreamType.SPOTIFY;
  else if (url.includes(SOUNDCLOUD_BASE_LINK)) return StreamType.SOUNDCLOUD;
  else if (url.includes(TWITCH_BASE_LINK)) return StreamType.TWITCH;
  return StreamType.YOUTUBE;
};

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

/**
 * Sets seamless listening on voice channel error. Seamless listening allows the
 * bot to temporarily save a wanted command until voice channel join.
 * @param server The server.
 * @param fName The name of the function to play.
 * @param args The function parameters.
 * @param message A message to delete.
 */
function setSeamless (server, fName, args, message) {
  server.seamless.function = fName;
  server.seamless.args = args;
  server.seamless.message = message;
  if (server.seamless.timeout) clearTimeout(server.seamless.timeout);
  server.seamless.timeout = setTimeout(() => server.seamless.function = null, 9000);
}

/**
 * Removes a specific number of recent db bot messages.
 * Also removes the command message if possible.
 * @param channelID {string} The channel id to search within.
 * @param deleteNum {number} The number of recent db bot messages to remove.
 * @param force {boolean} True if to delete non db bot messages as well.
 */
function removeDBMessage (channelID, deleteNum = 1, force) {
  try {
    bot.channels.fetch(channelID).then(x =>
      x.messages.fetch(30).then(async x => {
        let firstRun = true;
        for (let [, item] of x) {
          if (item.deletable) {
            if (firstRun) {
              firstRun = false;
              await item.delete();
            } else if (item.member.id === botID || force) {
              await item.delete();
              deleteNum--;
            }
          }
          if (!deleteNum) break;
        }
      }));
  } catch (e) {}
}

/**
 * Logs an error to a channel.
 * @param msgTxt {string} The message to send.
 */
function logError (msgTxt) {
  bot.channels.fetch(CH.err)
    .then((channel) => channel.send(msgTxt))
    .catch((e) => console.log('Failed sending error message: ', e));
}

/**
 * Handles the error upon voice channel join. Sends the appropriate message to the user.
 * @param error The error.
 * @param textChannel The text channel to notify.
 */
function catchVCJoinError (error, textChannel) {
  const eMsg = error.toString();
  if (eMsg.includes('it is full')) textChannel.send('\`error: cannot join voice channel, it is full\`');
  else if (eMsg.includes('VOICE_JOIN_CHANNEL')) textChannel.send('\`permissions error: cannot join voice channel\`');
  else {
    textChannel.send('db bot ran into this error:\n`' + eMsg + '`');
    logError(`voice channel join error:\n ${eMsg}`);
    console.log(error);
  }
}

/**
 * Pause a dispatcher. Force may have unexpected behaviour with the stream if used excessively.
 * @param voiceChannel The voice channel that the dispatcher is playing in.
 * @param force {boolean=} Ignores the status of the dispatcher.
 */
function pauseComputation (voiceChannel, force = false) {
  if (!dispatcherMap[voiceChannel.id]) return;
  if (!dispatcherMapStatus[voiceChannel.id] || force) {
    dispatcherMap[voiceChannel.id].pause();
    dispatcherMap[voiceChannel.id].resume();
    dispatcherMap[voiceChannel.id].pause();
    dispatcherMapStatus[voiceChannel.id] = true;
    processStats.removeActiveStream(voiceChannel.guild.id);
  }
}

/**
 * Plays a dispatcher. Force may have unexpected behaviour with the stream if used excessively.
 * @param voiceChannel The voice channel that the dispatcher is playing in.
 * @param force {boolean=} Ignores the status of the dispatcher.
 */
function playComputation (voiceChannel, force) {
  if (!dispatcherMap[voiceChannel.id]) return;
  if (dispatcherMapStatus[voiceChannel.id] || force) {
    dispatcherMap[voiceChannel.id].resume();
    dispatcherMap[voiceChannel.id].pause();
    dispatcherMap[voiceChannel.id].resume();
    dispatcherMapStatus[voiceChannel.id] = false;
    processStats.addActiveStream(voiceChannel.guild.id);
  }
}

/**
 * Joins the voice channel of the message member (if applicable).
 * If there is an error upon join attempt then it caught and forwarded to the user.
 * @param message The message metadata.
 * @param server The server object.
 * @return {Promise<boolean>} True upon successful voice channel join.
 */
async function joinVoiceChannelSafe (message, server) {
  let connection = server.connection;
  let vc = message.member?.voice?.channel;
  if (vc && (!botInVC(message) || !connection || (connection.channel.id !== vc.id))) {
    if (connection && dispatcherMap[connection.channel.id]) pauseComputation(connection.channel);
    dispatcherMap[connection.channel.id] = undefined;
    resetSession(server);
    if (server.leaveVCTimeout) {
      clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = null;
    }
    await server.currentEmbed?.reactions?.removeAll();
    try {
      server.connection = await vc.join();
      server.leaveVCTimeout = setTimeout(() => server.connection.disconnect(), LEAVE_VC_TIMEOUT);
      return true;
    } catch (e) {
      catchVCJoinError(e, message.channel);
    }
  }
  return false;
}

module.exports = {
  formatDuration, botInVC, adjustQueueForPlayNow, verifyUrl, verifyPlaylist, resetSession, convertYTFormatToMS,
  setSeamless, getQueueText, initializeServer, getTitle, linkFormatter, endStream, unshiftQueue, pushQueue,
  shuffleQueue, createQueueItem, getLinkType, createMemoryEmbed, isAdmin, getTracksWrapper, isCoreAdmin,
  insertCommandVerification, convertSeekFormatToSec, removeDBMessage, catchVCJoinError, logError, joinVoiceChannelSafe,
  pauseComputation, playComputation
};
