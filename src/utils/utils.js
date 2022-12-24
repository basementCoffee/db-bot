/* eslint-disable camelcase */
const fetch = require('isomorphic-unfetch');
const { getData } = require('spotify-url-info')(fetch);
const ytdl = require('ytdl-core-discord');
const ytpl = require('ytpl');
const {
  botID, SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, StreamType, bot,
} = require('./lib/constants');
const scdl = require('soundcloud-downloader').default;
const unpipe = require('unpipe');
const cpu = require('node-os-utils').cpu;
const os = require('os');
const CH = require('../../channel.json');
const { getVoiceConnection } = require('@discordjs/voice');
const { EmbedBuilderLocal } = require('./lib/EmbedBuilderLocal');
const { linkFormatter } = require('./formatUtils');


/**
 * Returns whether the bot is in a voice channel within the guild.
 * @param message {import('discord.js').Message} The message that triggered the bot.
 * @returns {Object} The voice channel if the bot is in a voice channel.
 */
function botInVC(message) {
  return botInVcGuild(message.guild);
}

/**
 * Returns whether the bot is in a voice channel within the guild.
 * @param guild {import('discord.js').Guild} The guild.
 * @returns {Object} The voice channel if the bot is in a voice channel.
 */
function botInVcGuild(guild) {
  try {
    const members = bot.channels.cache.get(getVoiceConnection(guild.id)?.joinConfig.channelId)?.members;
    return bot.voice.adapters.get(guild.id) && members && members.has(bot.user.id);
  }
  catch (e) {
    return false;
  }
}

/**
 * Returns the queue display status.
 * @param server {LocalServer} The server.
 * @returns {string} The queue count/status.
 */
function getQueueText(server) {
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
function verifyUrl(url) {
  return (url.includes(SPOTIFY_BASE_LINK) ? url.includes('/track/') :
    (url.includes(SOUNDCLOUD_BASE_LINK) ? scdl.isValidUrl(linkFormatter(url, SOUNDCLOUD_BASE_LINK)) :
      (ytdl.validateURL(url) || url.includes(TWITCH_BASE_LINK))) && !verifyPlaylist(url));
}


/**
 * Returns true if the given url is a valid playlist link.
 * @param url The url to verify.
 * @returns {string | boolean} A StreamType or false.
 */
function verifyPlaylist(url) {
  try {
    url = url.toLowerCase();
    if (url.includes(SPOTIFY_BASE_LINK)) {
      if (url.includes('/playlist') || url.includes('/album')) {
        return StreamType.SPOTIFY;
      }
    }
    else if (url.includes(SOUNDCLOUD_BASE_LINK) && scdl.isPlaylistURL(linkFormatter(url, SOUNDCLOUD_BASE_LINK))) {
      return StreamType.SOUNDCLOUD;
    }
    else if ((url.includes('list=') || ytpl.validateID(url)) && !url.includes('&index=')) {
      return StreamType.YOUTUBE;
    }
  }
  catch (e) {}
  return false;
}

/**
 * Resets server playback to default args. MUST occur before voice channel join, NOT after voice channel leave.
 * @param server {LocalServer} The server to reset.
 */
function resetSession(server) {
  server.queue = [];
  server.queueHistory = [];
  server.loop = false;
  server.audio.reset();
  server.mapFinishedLinks.clear();
}

/**
 * Adjusts the queue for play now depending on the stream time.
 * @param dsp {import('@discordjs/voice').AudioResource} The dispatcher to reference.
 * @param server {LocalServer} The server to use.
 */
function adjustQueueForPlayNow(dsp, server) {
  if (server.queue[0] && dsp?.playbackDuration && (dsp.playbackDuration > 21000)) {
    server.queueHistory.push(server.queue.shift());
  }
}

/**
 * Gets the title of a link.
 * @param queueItem The queue item to get the title.
 * @param cutoff {number=} A number representing the cutoff value.
 * @returns {Promise<string>} The title of the provided link.
 */
async function getTitle(queueItem, cutoff) {
  let title;
  const isEmptyQueueItem = !queueItem.infos || !Object.keys(queueItem.infos).length;
  try {
    if (queueItem.type === StreamType.SPOTIFY) {
      if (isEmptyQueueItem) queueItem.infos = Object.assign(queueItem.infos || {}, await getData(queueItem.url));
      title = queueItem.infos.name;
    }
    else if (queueItem.type === StreamType.SOUNDCLOUD) {
      if (isEmptyQueueItem) queueItem.infos = Object.assign(queueItem.infos || {}, await scdl.getInfo(queueItem.url));
      title = queueItem.infos.title;
    }
    else if (queueItem.type === StreamType.TWITCH) {
      title = 'twitch livestream';
    }
    else {
      if (isEmptyQueueItem) {
        queueItem.infos = Object.assign(queueItem.infos || {}, await ytdl.getBasicInfo(queueItem.url));
      }
      title = queueItem.infos.videoDetails?.title || queueItem.infos.title;
    }
  }
  catch (e) {
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
 * @param data {number} The bytes to format to MB.
 * @returns {string} A string that has the number of MB.
 */
const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100}`;

/**
 * Creates an embed regarding memory usage.
 * @return {Promise<EmbedBuilderLocal>}
 */
async function createMemoryEmbed() {
  const memUsage = process.memoryUsage();
  const cpuUsage = await cpu.usage();
  return new EmbedBuilderLocal()
    .setTitle('Memory Usage')
    .setDescription(`rss -  ${formatMemoryUsage(memUsage.rss)} MB\nheap -  ` +
      `${formatMemoryUsage(memUsage.heapUsed)} / ${formatMemoryUsage(memUsage.heapTotal)} MB ` +
      `(${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%)\ncpu: ${cpuUsage}%` +
      `\nload-avg: ${Math.round(os.loadavg()[1] * 100) / 100}%`);
}

/**
 * Ends the stream if a configuration for it is available.
 * @param server {LocalServer} The server in which to end the stream.
 */
function endStream(server) {
  try {
    if (server.streamData.type === StreamType.SOUNDCLOUD) {
      if (!server.streamData.stream._readableState.closed) {
        console.log(`not closed: ${server.streamData.stream._readableState.pipes.length}`);
      }
      if (server.streamData.stream._readableState.pipes.length > 0) {
        for (const v of Object.keys(server.streamData.stream._readableState.pipes[0])) {
          server.streamData.stream._readableState.pipes[v] = undefined;
        }
        server.streamData.stream._readableState.pipes.pop();
        server.streamData.stream.end();
        server.streamData.stream.destroy();
      }
    }
    else if (server.streamData.type === StreamType.TWITCH) {
      server.streamData.stream.end();
      unpipe(server.streamData.stream);
    }
  }
  catch (e) {
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
function unshiftQueue(queue, queueItem) {
  queue.unshift(queueItem);
}

/**
 * Creates a queue item.
 * @param url {string} The URL to add.
 * @param type {any?} The type of URL. Provided as a StreamType.
 * @param infos {any?} The infos of the URL.
 * @returns {{type, url, infos}}
 */
function createQueueItem(url, type, infos) {
  if (!type) type = getLinkType(url);
  return {
    url: url,
    type: type,
    infos: infos,
  };
}

/**
 * Pushes the provided link to the server's queue.
 * @param queue {Array} The queue to push to.
 * @param queueItem The item to add to the queue.
 */
function pushQueue(queue, queueItem) {
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
 * Sets seamless listening on voice channel error. Seamless listening allows the
 * bot to temporarily save a wanted command until voice channel join.
 * @param server {LocalServer} The server.
 * @param fName The name of the function to play.
 * @param args The function parameters.
 * @param message A message to delete.
 */
function setSeamless(server, fName, args, message) {
  server.seamless.function = fName;
  server.seamless.args = args;
  server.seamless.message = message;
  if (server.seamless.timeout) clearTimeout(server.seamless.timeout);
  server.seamless.timeout = setTimeout(() => server.seamless.function = null, 9000);
}

/**
 * Removes a specific number of recent db vibe messages.
 * Also removes the command message if possible.
 * @param channelID {string} The channel id to search within.
 * @param deleteNum {number} The number of recent db vibe messages to remove.
 * @param onlyDB {boolean} True if to delete only db vibe messages.
 */
function removeDBMessage(channelID, deleteNum = 1, onlyDB) {
  let firstRun = true;
  try {
    bot.channels.fetch(channelID).then((channel) =>
      channel.messages.fetch(30).then(async (msgs) => {
        for (const [, item] of msgs) {
          if (item.deletable) {
            if (firstRun) {
              firstRun = false;
              await item.delete();
            }
            else if (!onlyDB || item?.member?.id === botID) {
              await item.delete();
              deleteNum--;
            }
            if (!deleteNum) break;
          }
        }
      }));
  }
  catch (e) {}
}

/**
 * Logs an error to a channel.
 * @param errText {string || import('discord.js').MessagePayload || Error} The error object or message to send.
 */
function logError(errText) {
  if (errText instanceof Error) {
    errText = `${errText.stack}`;
  }
  bot.channels.fetch(CH.err)
    .then((channel) => channel?.send(errText))
    .catch((e) => console.log('Failed sending error message: ', e));
}

/**
 * Handles the error upon voice channel join. Sends the appropriate message to the user.
 * @param error The error.
 * @param textChannel The text channel to notify.
 */
function catchVCJoinError(error, textChannel) {
  const eMsg = error.toString();
  if (eMsg.includes('it is full')) {textChannel.send('\`error: cannot join voice channel; it is full\`');}
  else if (eMsg.includes('VOICE_JOIN_CHANNEL')) {textChannel.send('\`permissions error: cannot join voice channel\`');}
  else {
    textChannel.send('error when joining your VC:\n`' + error.message + '`');
    logError(`voice channel join error:\n\`${error.message}\``);
  }
}

/**
 * Returns the error message informing the user that it is not in a voice channel with the bot.
 * @param guild The guild.
 * @return {string} The error message.
 */
function notInVoiceChannelErrorMsg(guild) {
  return `must be in a voice channel with ${getBotDisplayName(guild)} for this command`;
}

/**
 * Gets the display name of the bot. If there is a nickname, it will return it, otherwise it will return the default
 * name.
 * @param guild The guild from which to get the name.
 * @returns {string} The display name of the bot.
 */
function getBotDisplayName(guild) {
  return guild.members.me.nickname || guild.members.me.user.username;
}


/**
 * Returns true if the link is a valid playable link (includes playlists).
 * @param link {string} The link to validate.
 * @returns {boolean} If the link is a valid, playable link.
 */
function linkValidator(link) {
  return verifyUrl(link) || verifyPlaylist(link);
}

/**
 * Returns the sheet name for the user id.
 * @param userId {string}
 * @returns {string} The sheet name.
 */
function getSheetName(userId) {
  return `p${userId}`;
}

/**
 * Determines if the provided sheetName is a user sheet.
 * @param sheetName {string} A sheet name.
 * @returns {boolean} True if is a user sheet.
 */
function isPersonalSheet(sheetName) {
  return sheetName[0] === 'p';
}

/**
 * Gets the members of a voice channel.
 * @param guildId {string} The guild id.
 * @return {Array<*>}} The members of the voice channel.
 */
function getVCMembers(guildId) {
  const voiceConnection = getVoiceConnection(guildId);
  if (voiceConnection) {
    const collectionOfMembers = bot.channels.cache.get(voiceConnection.joinConfig.channelId)?.members;
    if (collectionOfMembers) {
      const gmArray = Array.from(collectionOfMembers);
      gmArray.map((item) => item[1].user.username);
      return gmArray[0];
    }
  }
  return [];
}

/**
 * Creates a visual embed.
 * @param title {string} The title of the embed.
 * @param text {string} The text of the embed.
 * @param color {string?} The color of the embed.
 * @return {EmbedBuilderLocal} The embed.
 */
function createVisualEmbed(title, text, color) {
  return new EmbedBuilderLocal()
    .setTitle(title)
    .setDescription(text)
    .setColor(color || '#0099ff');
}

module.exports = {
  botInVC, adjustQueueForPlayNow, verifyUrl, verifyPlaylist, resetSession, setSeamless, getQueueText, getTitle,
  endStream, unshiftQueue, pushQueue, createQueueItem, getLinkType, createMemoryEmbed, removeDBMessage,
  catchVCJoinError, logError, linkValidator, getSheetName, isPersonalSheet, getBotDisplayName, createVisualEmbed,
  notInVoiceChannelErrorMsg, getVCMembers, botInVcGuild,
};
