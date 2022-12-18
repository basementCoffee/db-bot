/* eslint-disable camelcase */
const {
  botInVC, catchVCJoinError, getLinkType, verifyUrl, endStream, logError, createQueueItem, getQueueText, getSheetName,
  resetSession,
} = require('../../utils/utils');
const {
  StreamType, SPOTIFY_BASE_LINK, whatspMap, commandsMap, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK,
  LEAVE_VC_TIMEOUT, bot, MAX_QUEUE_S,
} = require('../../utils/lib/constants');
const fetch = require('isomorphic-unfetch');
const { getData } = require('spotify-url-info')(fetch);
const m3u8stream = require('m3u8stream');
const ytdl_core = require('ytdl-core');
const ytdl = require('ytdl-core-discord');
const ytsr = require('ytsr');
const twitch = require('twitch-m3u8');
const { SoundCloud: scdl } = require('scdl-core');
scdl.connect();
const { createEmbed } = require('../../utils/embed');
const processStats = require('../../utils/lib/ProcessStats');
const { shutdown } = require('../../process/shutdown');
const { reactions } = require('../../utils/lib/reactions');
const { getXdb2 } = require('../../database/retrieval');
const { stopPlayingUtil, voteSystem, pauseCommandUtil, endAudioDuringSession, playCommandUtil, pauseComputation,
  playComputation,
} = require('./utils');
const { linkFormatter, convertYTFormatToMS, formatDuration } = require('../../utils/formatUtils');
const { runKeysCommand } = require('../keys');
const {
  createAudioResource,
  createAudioPlayer,
  StreamType: VoiceStreamType, getVoiceConnection,
} = require('@discordjs/voice');
const CH = require('../../../channel.json');
const fluentFfmpeg = require('fluent-ffmpeg');
const { EmbedBuilderLocal } = require('../../utils/lib/EmbedBuilderLocal');

/**
 *  The play function. Plays a given link to the voice channel. Does not add the item to the server queue.
 * @param message {import('discord.js').Message} The message that triggered the bot.
 * @param queueItem The queue item to play (see createQueueItem).
 * @param vc The voice channel to play the song in.
 * @param server {LocalServer} The server playback metadata.
 * @param retries {number} Optional - Integer representing the number of retries.
 * @param seekSec {number} Optional - The amount to seek in seconds
 * @returns {Promise<void>}
 */
async function playLinkToVC(message, queueItem, vc, server, retries = 0, seekSec) {
  if (!vc) {
    vc = message.member.voice?.channel;
    if (!vc) {
      getVoiceConnection(message.guildId)?.disconnect();
      return;
    }
  }
  if (processStats.isInactive) {
    message.channel.send(`*${message.guild.members.me.user.username} has been updated*`);
    return stopPlayingUtil(message.guild.id, vc, false, server);
  }
  if (server.leaveVCTimeout) {
    clearTimeout(server.leaveVCTimeout);
    server.leaveVCTimeout = null;
  }
  // the queue item's formal url (can be of any type)
  let whatToPlay = queueItem?.url;
  if (!whatToPlay) {
    queueItem = server.queue[0];
    if (!queueItem || !queueItem.url) {
      return stopPlayingUtil(message.guild.id, vc, true, server);
    }
    whatToPlay = queueItem.url;
  }
  if (server.voteAdmin.length > 0) {
    server.voteSkipMembersId.length = 0;
    server.voteRewindMembersId.length = 0;
    server.votePlayPauseMembersId.length = 0;
  }
  pauseComputation(server, false);
  // the alternative url to play
  let urlAlt = whatToPlay;
  if (!botInVC(message) || !server.audio.connection || await (async () => {
    if (server.audio?.connection.joinConfig.channelId !== vc.id) {
      server.audio.reset();
      await new Promise((res) => setTimeout(res, 500));
      return true;
    }
    return false;
  })()) {
    try {
      server.audio.joinVoiceChannel(message.guild, vc.id);
      await new Promise((res) => setTimeout(res, 300));
      if (!botInVC(message) || server.audio?.connection.joinConfig.channelId !== vc.id) {
        await new Promise((res, rej) => setTimeout((() => {
          if (botInVC(message)) {
            if (server.audio?.connection.joinConfig.channelId !== vc.id) {
              rej(new Error('VOICE_JOIN_CHANNEL_LIVE'));
            }
            else {
              res();
            }
          }
          else {
            rej(new Error('VOICE_JOIN_CHANNEL'));
          }
        }), 300));
      }
    }
    catch (e) {
      // if the bot is already in a voice channel but cannot join the requested channel
      if (e.message !== 'VOICE_JOIN_CHANNEL_LIVE') {
        resetSession(server);
      }
      catchVCJoinError(e, message.channel);
      return;
    }
    if (processStats.startUpMessage.length > 1 && !server.startUpMessage) {
      server.startUpMessage = true;
      message.channel.send(processStats.startUpMessage);
    }
  }
  if (!queueItem.type) queueItem.type = getLinkType(whatToPlay);
  if (queueItem.type === StreamType.SPOTIFY) {
    whatToPlay = linkFormatter(whatToPlay, SPOTIFY_BASE_LINK);
    const urlRes = await getYTUrlFromSpotifyUrl(queueItem, whatToPlay);
    if (urlRes.ok) {
      // the alternative url to play
      urlAlt = urlRes.url;
    }
    else {
      if (!retries) return playLinkToVC(message, queueItem, vc, server, ++retries, seekSec);
      message.channel.send(urlRes.errorMsg);
      whatspMap[vc.id] = '';
      skipLink(message, vc, false, server, true).catch((er) => processStats.debug(er));
      return;
    }
  }
  whatspMap[vc.id] = whatToPlay;
  // remove previous embed buttons
  if (server.numSinceLastEmbed > 4 && server.currentEmbed &&
    (!server.loop || whatspMap[vc.id] !== whatToPlay)) {
    server.numSinceLastEmbed = 0;
    server.currentEmbed.delete();
    server.currentEmbed = null;
  }
  if (server.streamData.type === StreamType.YOUTUBE) {
    try {
      if (server.streamData.isFluent) {
        server.streamData.stream.kill();
      }
      else {
        await server.streamData.stream.destroy();
      }
    }
    catch (e) {}
  }
  else if (server.streamData.stream) {endStream(server);}
  server.streamData = {};
  if (whatToPlay !== whatspMap[vc.id]) return;
  try {
    let playbackTimeout;
    let stream;
    let audioResourceOptions;
    // noinspection JSCheckFunctionSignatures
    if (queueItem.type === StreamType.SOUNDCLOUD) {
      commandsMap.set('SOUNDCLOUD', (commandsMap.get('SOUNDCLOUD') || 0) + 1);
      whatToPlay = linkFormatter(whatToPlay, SOUNDCLOUD_BASE_LINK);
      // add formatted link to whatspMap
      whatspMap[vc.id] = whatToPlay;
      stream = await scdl.download(whatToPlay, { highWaterMark: 1 << 25 });
      server.streamData.type = StreamType.SOUNDCLOUD;
    }
    else if (queueItem.type === StreamType.TWITCH) {
      let twitchEncoded;
      try {
        twitchEncoded = (await twitch.getStream(
          whatToPlay.substring(whatToPlay.indexOf(TWITCH_BASE_LINK) + TWITCH_BASE_LINK.length + 1)
            .replace(/\//g, '')));
        if (twitchEncoded.length > 0) {
          twitchEncoded = twitchEncoded[twitchEncoded.length - 1];
        }
        else {twitchEncoded = undefined;}
      }
      catch (e) {}
      if (!twitchEncoded) {
        message.channel.send('*could not find live twitch stream*');
        return skipLink(message, vc, false, server, true);
      }
      // if to send notification of ~20s loading delay
      if (!server.twitchNotif.isSent) {
        server.twitchNotif.isSent = true;
        // only send once every 3 hours
        if (!server.twitchNotif.isTimer) {
          server.twitchNotif.isTimer = true;
          setTimeout(() => {
            server.twitchNotif.isSent = false;
            server.twitchNotif.isTimer = false;
          }, 10800000);
        }
        const msg = await message.channel.send('`may take up to 20s to get livestream`');
        setTimeout(() => {
          if (msg.deletable) msg.delete();
        }, 11000);
      }
      commandsMap.set('TWITCH', (commandsMap.get('TWITCH') || 0) + 1);
      whatToPlay = linkFormatter(whatToPlay, TWITCH_BASE_LINK);
      // add formatted link to whatspMap
      whatspMap[vc.id] = whatToPlay;
      stream = await m3u8stream(twitchEncoded.url);
      server.streamData.type = StreamType.TWITCH;
    }
    else if (seekSec) {
      // set the video start time
      stream = fluentFfmpeg({ source: (await ytdl_core(urlAlt, { filter: 'audioonly' })) })
        .toFormat('mp3')
        .setStartTime(Math.ceil(seekSec));
      server.streamData.type = StreamType.YOUTUBE;
      server.streamData.isFluent = true;
      queueItem.urlAlt = urlAlt;
    }
    else {
      stream = await ytdl(urlAlt, {
        filter: (retries % 2 === 0 ? () => ['251'] : ''),
        highWaterMark: 1 << 25,
      });
      audioResourceOptions = { inputType: VoiceStreamType.Opus };
      queueItem.urlAlt = urlAlt;
      server.streamData.type = StreamType.YOUTUBE;
    }
    server.streamData.stream = stream;
    if (!server.audio.player) {
      server.audio.player = createAudioPlayer();
    }
    else {
      server.audio.player.removeAllListeners('idle');
      server.audio.player.removeAllListeners('error');
    }
    const resource = createAudioResource(stream, audioResourceOptions);
    server.audio.connection.subscribe(server.audio.player);
    server.audio.player.play(resource);
    server.audio.resource = resource;
    if (server.streamData?.type === StreamType.SOUNDCLOUD) {
      pauseComputation(server, true);
      await new Promise((res) => setTimeout(() => {
        if (whatToPlay === whatspMap[vc.id]) playComputation(server, true);
        res();
      }, 3000));
    }
    else {
      server.audio.status = true;
    }
    processStats.addActiveStreamIfNoneExists(message.guild.id);
    // if the server is not silenced then send the embed when playing
    if (server.silence) {
      if (server.currentEmbed) {
        if (server.currentEmbed.deletable) await server.currentEmbed.delete();
        server.currentEmbed = null;
      }
    }
    else if (!(retries && whatToPlay === server.queue[0]?.url)) {
      queueItem = await sendLinkAsEmbed(message, queueItem, vc, server, false) || queueItem;
    }
    server.skipTimes = 0;
    server.audio.player.on('error', async (error) => {
      if (resource.playbackDuration < 1000 && retries < 4) {
        if (playbackTimeout) clearTimeout(playbackTimeout);
        if (retries === 3) await new Promise((res) => setTimeout(res, 500));
        if (botInVC(message)) {
          playLinkToVC(message, queueItem, vc, server, ++retries, seekSec).catch((er) => processStats.debug(er));
        }
        return;
      }
      skipLink(message, vc, false, server, false).catch((er) => processStats.debug(er));
      // noinspection JSUnresolvedFunction
      logError(
        {
          embeds: [(new EmbedBuilderLocal()).setTitle('Dispatcher Error').setDescription(`url: ${urlAlt}
        timestamp: ${formatDuration(resource.playbackDuration)}\nprevSong: ${server.queueHistory[server.queueHistory.length - 1]?.url}`)],
        },
      );
      console.log('dispatcher error: ', error);
    });
    // similar to on 'finish'
    server.audio.player.once('idle', () => {
      // if there is a mismatch then don't change anything
      if (whatToPlay !== whatspMap[vc.id]) return;
      server.mapFinishedLinks.set(whatToPlay,
        {
          queueItem,
          numOfPlays: (server.mapFinishedLinks.get(whatToPlay)?.numOfPlays || 0) + 1,
        });
      if (vc.members.size < 2) {
        processStats.disconnectConnection(server);
      }
      else if (server.loop) {
        playLinkToVC(message, queueItem, vc, server, undefined, undefined);
      }
      else {
        skipLink(message, vc, false, server, false);
      }
      if (server?.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
    });
    if (!retries) {
      playbackTimeout = setTimeout(() => {
        if (server.queue[0]?.url === whatToPlay && botInVC(message) && resource.playbackDuration < 1) {
          playLinkToVC(message, queueItem, vc, server, ++retries, seekSec);
        }
      }, 2000);
    }
  }
  catch (e) {
    const errorMsg = e.toString().substring(0, 100);
    if (errorMsg.includes('ode: 404') || errorMsg.includes('ode: 410')) {
      if (!retries) {
        playLinkToVC(message, queueItem, vc, server, ++retries, seekSec).catch((er) => processStats.debug(er));
      }
      else {
        server.skipTimes++;
        if (server.skipTimes < 4) {
          if (server.skipTimes === 2) {
            checkStatusOfYtdl(server, message).catch((er) => processStats.debug(er));
          }
          message.channel.send(
            '***error code 404:*** *this video may contain a restriction preventing it from being played.*' +
            (server.skipTimes < 2 ? '\n*If so, it may be resolved sometime in the future.*' : ''));
          server.numSinceLastEmbed++;
          skipLink(message, vc, true, server, true).catch((er) => processStats.debug(er));
        }
        else {
          console.log('status code 404 error');
          processStats.disconnectConnection(server);
          message.channel.send('*db vibe appears to be facing some issues: automated diagnosis is underway.*').then(() => {
            console.log(e);
            // noinspection JSUnresolvedFunction
            logError('***status code 404 error***' +
              '\n*if this error persists, try to change the active process*');
          });
        }
      }
      return;
    }
    if (errorMsg.includes('No suitable format found')) {
      if (server.skipTimes === 0) {
        message.channel.send('*this video contains a restriction preventing it from being played*');
        server.numSinceLastEmbed++;
        server.skipTimes++;
        skipLink(message, vc, true, server, true).catch((er) => processStats.debug(er));
      }
      else {
        skipLink(message, vc, false, server, true).catch((er) => processStats.debug(er));
      }
      return;
    }
    if (retries < 2) {
      playLinkToVC(message, queueItem, vc, server, ++retries, seekSec).catch((er) => processStats.debug(er));
      return;
    }
    console.log('error in playLinkToVC: ', whatToPlay);
    console.log(e);
    if (server.skipTimes > 3) {
      processStats.disconnectConnection(server);
      message.channel.send('***db vibe is facing some issues, may restart***');
      checkStatusOfYtdl(processStats.getServer(CH['check-in-guild']), message).then();
      return;
    }
    else {
      server.skipTimes++;
    }
    // Error catching - fault with the link?
    message.channel.send('Could not play <' + whatToPlay + '>' +
      ((server.skipTimes === 1) ? '\nIf the link is not broken or restricted, please try again.' : ''));
    // search the db to find possible broken keys
    if (server.skipTimes < 2) searchForBrokenLinkWithinDB(message, server, whatToPlay);
    whatspMap[vc.id] = '';
    skipLink(message, vc, false, server, true).catch((er) => processStats.debug(er));
    if (processStats.devMode) return;
    // noinspection JSUnresolvedFunction
    logError(`there was a playback error within playLinkToVC: ${whatToPlay}`);
    logError(e.toString().substring(0, 1910));
    // end of try catch
  }
  // load the next link if conditions are met
  if (server.queue[1]?.type === StreamType.SPOTIFY && !server.queue[1].urlAlt) {
    // the next link to play
    const nextQueueItem = server.queue[1];
    // the next link to play, formatted
    const whatToPlay2Formatted = linkFormatter(nextQueueItem.url, SPOTIFY_BASE_LINK);
    await getYTUrlFromSpotifyUrl(nextQueueItem, whatToPlay2Formatted);
  }
}

async function getYTUrlFromSpotifyUrl(queueItem, whatToPlay) {
  if (!queueItem.urlAlt) {
    let itemIndex = 0;
    if (!queueItem.infos) {
      try {
        queueItem.infos = await getData(whatToPlay);
      }
      catch (e) {
        console.log(e);
        return {
          ok: false,
          errorMsg: `error: could not get link metadata <${whatToPlay}>`,
        };
      }
    }
    let artists = '';
    const queueItemNameLower = queueItem.infos.name.toLowerCase();
    if (queueItem.infos.artists) {
      queueItem.infos.artists.forEach((x) => artists += x.name + ' ');
      artists = artists.trim();
    }
    else {artists = 'N/A';}
    let search = await ytsr(queueItem.infos.name + ' ' + artists, { pages: 1 });
    let youtubeDuration;
    if (search.items[itemIndex]) {
      if (search.items[itemIndex].duration) {
        youtubeDuration = convertYTFormatToMS(search.items[itemIndex].duration.split(':'));
      }
      else if (verifyUrl(search.items[itemIndex].url)) {
        const ytdlInfos = await ytdl.getBasicInfo(search.items[itemIndex].url);
        youtubeDuration = ytdlInfos.formats[itemIndex].approxDurationMs || 0;
      }
      else {
        return {
          ok: false,
          errorMsg: `link not playable: <${search.items[itemIndex].url}>`,
        };
      }
      const spotifyDuration = parseInt(queueItem.infos.duration || queueItem.infos.duration_ms);
      let itemIndex2 = itemIndex + 1;
      while (search.items[itemIndex2] && search.items[itemIndex2].type !== 'video' && itemIndex2 < 6) {
        itemIndex2++;
      }
      // if the next video is a better match then play the next video
      if (search.items[itemIndex2] && search.items[itemIndex2].duration &&
        Math.abs(spotifyDuration - youtubeDuration) >
        (Math.abs(spotifyDuration - (convertYTFormatToMS(search.items[itemIndex2].duration.split(':')))) + 1000)) {
        itemIndex = itemIndex2;
      }
    }
    else if (queueItemNameLower.includes('feat') || queueItemNameLower.includes('remix')) {
      search = await ytsr(`${queueItem.infos.name} lyrics`, { pages: 1 });
    }
    else {
      search = await ytsr(`${queueItem.infos.name} ${artists.split(' ')[0]} lyrics`, { pages: 1 });
    }
    if (search.items[itemIndex]) {
      queueItem.urlAlt = search.items[itemIndex].url;
    }
    else {
      return {
        ok: false,
        errorMsg: `could not find <${whatToPlay}>`,
      };
    }
  }
  return {
    ok: true,
    url: queueItem.urlAlt,
  };
}

/**
 * Searches the guild db and personal message db for a broken link
 * @param message The message
 * @param server {LocalServer} The server
 * @param whatToPlayS The broken link provided as a string
 */
function searchForBrokenLinkWithinDB(message, server, whatToPlayS) {
  getXdb2(server, getSheetName(message.member.id), botInVC(message)).then((xdb) => {
    xdb.globalKeys.forEach((value) => {
      if (value.name === whatToPlayS) {
        return message.channel.send(`*possible broken link within your ${value.playlistName} playlist: ${value.name}*`);
      }
    });
  });
}

/**
 * Checks the status of ytdl-core-discord and exits the active process if the test link is unplayable.
 * @param server {LocalServer} The server metadata.
 * @param message The message metadata to send a response to the appropriate channel
 */
async function checkStatusOfYtdl(server, message) {
  // noinspection JSUnresolvedFunction
  const stream = await ytdl('https://www.youtube.com/watch?v=1Bix44C1EzY', {
    filter: () => ['251'],
    highWaterMark: 1 << 25,
  });
  const player = createAudioPlayer();
  const resource = createAudioResource(stream, { inputType: VoiceStreamType.Opus });
  await new Promise((res) => setTimeout(res, 500));
  let connection;
  try {
    connection = await server.audio.joinVoiceChannel((await bot.guilds.fetch(CH['check-in-guild'])), CH['check-in-voice']);
  }
  catch (e) {
    // if cannot join check-in voice channel, try the backup voice channel
    connection = await server.audio.joinVoiceChannel((await bot.guilds.fetch(CH['check-in-guild'])), CH['check-in-voice-2']);
  }
  try {
    connection.subscribe(player);
    player.play(resource);
  }
  catch (e) {
    console.log(e);
    if (message) {
      const diagnosisStr = '*self-diagnosis complete: db vibe will be restarting*';
      if (message.deletable) message.edit(diagnosisStr);
      else message.channel.send(diagnosisStr);
    }
    logError('ytdl status is unhealthy, shutting off bot');
    processStats.disconnectConnection(server);
    if (processStats.isInactive) setTimeout(() => process.exit(0), 2000);
    else shutdown('YTDL-POOR')();
    return;
  }
  setTimeout(() => {
    processStats.disconnectConnection(server);
    if (message) message.channel.send('*self-diagnosis complete: db vibe does not appear to have any issues*');
  }, 6000);
}

/**
 * Skips the link that is currently being played.
 * Use for specific voice channel playback.
 * @param message the message that triggered the bot
 * @param voiceChannel the voice channel that the bot is in
 * @param playMessageToChannel whether to play message on successful skip
 * @param server {LocalServer} The server playback metadata
 * @param noHistory Optional - true excludes link from the queue history
 */
async function skipLink(message, voiceChannel, playMessageToChannel, server, noHistory) {
  // if server queue is not empty
  if (server.streamData.type === StreamType.TWITCH) endStream(server);
  if (!botInVC(message)) return;
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  if (server.queue.length > 0) {
    const skippedLink = server.queue.shift();
    if (!noHistory) {
      server.queueHistory.push(skippedLink);
    }
    if (playMessageToChannel) message.channel.send('*skipped*');
    // if there is still items in the queue then play next link
    if (server.queue.length > 0) {
      await playLinkToVC(message, server.queue[0], voiceChannel, server);
    }
    else if (server.autoplay) {
      runAutoplayCommand(message, server, voiceChannel, skippedLink).then();
    }
    else {
      stopPlayingUtil(message.guild.id, voiceChannel, true, server, message, message.member);
      if (server.leaveVCTimeout) clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = setTimeout(
        () => processStats.disconnectConnection(server),
        LEAVE_VC_TIMEOUT);
    }
  }
  else {
    stopPlayingUtil(message.guild.id, voiceChannel, true, server, message, message.member);
    if (!server.leaveVCTimeout) {
      server.leaveVCTimeout = setTimeout(
        () => processStats.disconnectConnection(server),
        LEAVE_VC_TIMEOUT);
    }
  }
}

/**
 * Rewinds the link
 * @param message The message that triggered the bot
 * @param mgid The message guild id
 * @param voiceChannel The active voice channel
 * @param numberOfTimes The number of times to rewind
 * @param ignoreSingleRewind whether to print out the rewind text
 * @param force true can override votes during DJ mode
 * @param mem The metadata of the member using the command, used for DJ mode
 * @param server {LocalServer} The server playback metadata
 * @returns {*}
 */
function runRewindCommand(message, mgid, voiceChannel, numberOfTimes, ignoreSingleRewind, force, mem, server) {
  if (!voiceChannel) {
    return message.channel.send('You must be in a voice channel to rewind');
  }
  if (server.dictator && mem.id !== server.dictator.id) {
    return message.channel.send('only the dictator can perform this action');
  }
  // boolean to determine if there is a song
  let isQueueItem;
  let rewindTimes = 1;
  try {
    if (numberOfTimes) {
      rewindTimes = parseInt(numberOfTimes);
    }
  }
  catch (e) {
    rewindTimes = 1;
    message.channel.send('rewinding once');
  }
  if (server.voteAdmin.length > 0 && !force) {
    if (voteSystem(message, message.guild.id, 'rewind', mem, server.voteRewindMembersId, server)) {
      rewindTimes = 1;
      ignoreSingleRewind = true;
    }
    else {return;}
  }
  if (!rewindTimes || rewindTimes < 1 || rewindTimes > 10000) return message.channel.send('invalid rewind amount');
  let rwIncrementor = 0;
  while (server.queueHistory.length > 0 && rwIncrementor < rewindTimes) {
    if (server.queue.length > (MAX_QUEUE_S + 99)) {
      playLinkToVC(message, server.queue[0], voiceChannel, server);
      return message.channel.send('*max queue size has been reached, cannot rewind further*');
    }
    // assumes there is no queueItem to enter while
    isQueueItem = false;
    // remove undefined links from queueHistory
    while (server.queueHistory.length > 0 && !isQueueItem) {
      isQueueItem = server.queueHistory.pop();
    }
    if (isQueueItem) server.queue.unshift(isQueueItem);
    rwIncrementor++;
  }
  if (isQueueItem) {
    if (!ignoreSingleRewind) {
      message.channel.send('*rewound' + (rewindTimes === 1 ? '*' : ` ${rwIncrementor} times*`));
    }
    playLinkToVC(message, isQueueItem, voiceChannel, server).catch((er) => processStats.debug(er));
  }
  else if (server.queue[0]) {
    playLinkToVC(message, server.queue[0], voiceChannel, server).catch((er) => processStats.debug(er));
    message.channel.send('*replaying first link*');
  }
  else {
    message.channel.send('cannot find previous link');
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
}

/**
 * Function to skip link once or multiple times.
 * Recommended if voice channel is not present.
 * @param message the message that triggered the bot
 * @param voiceChannel The active voice channel
 * @param server {LocalServer} The server playback metadata
 * @param skipTimes Optional - the number of times to skip
 * @param sendSkipMsg Whether to send a 'skipped' message when a single link is skipped
 * @param forceSkip Optional - If there is a DJ, grants force skip abilities
 * @param mem The user that is completing the action, used for DJ mode
 * @returns {*}
 */
async function runSkipCommand(message, voiceChannel, server, skipTimes, sendSkipMsg, forceSkip, mem) {
  // in case of force disconnect
  if (!botInVC(message)) return;
  if (!voiceChannel) {
    voiceChannel = mem.voice.channel;
    if (!voiceChannel) return message.channel.send('*must be in a voice channel to use this command*');
  }
  if (server.queue.length < 1) return message.channel.send('*nothing is playing right now*');
  if (server.dictator && mem.id !== server.dictator.id) {
    return message.channel.send('only the dictator can perform this action');
  }
  if (server.voteAdmin.length > 0 && !forceSkip) {
    if (voteSystem(message, message.guild.id, 'skip', mem, server.voteSkipMembersId, server)) {
      skipTimes = 1;
      sendSkipMsg = false;
    }
    else {return;}
  }
  if (server.audio.player) {
    pauseComputation(server, false);
    // add link to finished map if being played for over 100 seconds
    if (server.audio.resource?.playbackDuration > 100000 && server.queue[0]) {
      server.mapFinishedLinks.set(server.queue[0].url,
        {
          queueItem: server.queue[0],
          numOfPlays: (server.mapFinishedLinks.get(server.queue[0].url)?.numOfPlays || 0) + 1,
        });
    }
  }
  if (skipTimes) {
    try {
      skipTimes = parseInt(skipTimes);
      if (skipTimes > 0 && skipTimes < 1001) {
        let skipCounter = 0;
        while (skipTimes > 1 && server.queue.length > 0) {
          server.queueHistory.push(server.queue.shift());
          skipTimes--;
          skipCounter++;
        }
        if (skipTimes === 1 && server.queue.length > 0) {
          skipCounter++;
        }
        await skipLink(message, voiceChannel, (sendSkipMsg ? skipCounter === 1 : false), server);
        if (skipCounter > 1) {
          message.channel.send('*skipped ' + skipCounter + ' times*');
        }
      }
      else {
        message.channel.send('*invalid skip amount (must be between 1 - 1000)*');
      }
    }
    catch (e) {
      await skipLink(message, voiceChannel, true, server);
    }
  }
  else {
    await skipLink(message, voiceChannel, true, server);
  }
}

/**
 * Autoplay to the next recommendation. Assumes that the queue is empty.
 * @param message The message metadata.
 * @param server {LocalServer} The server.
 * @param vc The voice channel to be played in.
 * @param queueItem The last queueItem.
 * @returns {Promise<void>}
 */
async function runAutoplayCommand(message, server, vc, queueItem) {
  if (queueItem?.urlAlt) {
    const whatToPlay = queueItem.urlAlt;
    try {
      let uniqueVid;
      let index = 0;
      // find a new recommendation that is unique
      do {
        uniqueVid = await getRecLink(whatToPlay, queueItem.infos, index++);
      } while (uniqueVid && (server.queueHistory.findIndex((qi) => qi.url === uniqueVid) > -1));
      // if no unique vid found then return the first recommendation
      if (!uniqueVid) uniqueVid = await getRecLink(whatToPlay, queueItem.infos, 0);
      if (uniqueVid) {
        server.queue.push(createQueueItem(uniqueVid, StreamType.YOUTUBE));
        playLinkToVC(message, server.queue[0], vc, server);
        // EXIT on SUCCESS
        return;
      }
    }
    catch (e) {}
    message.channel.send('*could not find a video to play*');
  }
  else {
    message.channel.send('*smartplay is not supported for this stream type*');
  }
  endAudioDuringSession(server);
}

/**
 * Gets the recommended link from infos depending on the given link and index.
 * @param whatToPlay The link to find recommendations for.
 * @param infos Optional - The infos of whatToPlay. Will mutate a reference.
 * @param index The index of the recommendation to get.
 * @returns {Promise<string|undefined>} A new link if successful.
 */
async function getRecLink(whatToPlay, infos, index = 0) {
  try {
    if (!infos || !infos.related_videos) infos = await ytdl.getBasicInfo(whatToPlay);
    const id = infos.related_videos[index].id;
    return `https://www.youtube.com/watch?v=${id}`;
  }
  catch (e) {
    return undefined;
  }
}

/**
 * Sends an embed to the channel depending on the given link.
 * If not given a voice channel then playback buttons will not appear. This is the main playabck embed.
 * If no url is provided then returns.
 * @param message {any} The message to send the channel to
 * @param queueItem {Object} the queueItem to generate the embed for
 * @param voiceChannel {any} the voice channel that the link is being played in, if playing
 * @param server {LocalServer} The server playback metadata
 * @param forceEmbed {Boolean} Force the embed to be re-sent in the text channel
 * @returns {Promise<any | void>} An updated queueItem (see createQueueItem) if successful.
 */
async function sendLinkAsEmbed(message, queueItem, voiceChannel, server, forceEmbed) {
  if (!message || !queueItem) return;
  const url = queueItem.url;
  if (!voiceChannel) {
    voiceChannel = message.member.voice?.channel;
    if (!voiceChannel) return;
  }
  if (server.verbose) forceEmbed = true;
  if (server.loop && url === server.queue[0]?.url && !forceEmbed && botInVC(message) &&
    server.currentEmbed.reactions) {
    return;
  }
  // the created embed
  let embedData;
  if (queueItem.embed) {
    embedData = queueItem.embed;
  }
  else {
    embedData = await createEmbed(url, queueItem.infos);
    queueItem.embed = embedData;
  }
  const timeMS = embedData.timeMS;
  const embed = new EmbedBuilderLocal()
    .setTitle(embedData.embed.data.title)
    .setURL(embedData.embed.data.url)
    .setColor(embedData.embed.data.color)
    .addFields([...embedData.embed.data.fields])
    .setThumbnail(embedData.embed.data.thumbnail.url);
  queueItem.infos = embedData.infos;
  if (botInVC(message) && (server.queue.length < 1 || server.queue[0]?.url === url)) {
    if (server.currentEmbedChannelId !== message.channel.id) {
      server.currentEmbedChannelId = message.channel.id.toString();
      server.numSinceLastEmbed += 10;
    }
    embed.addFields(
      {
        inline: true,
        name: 'Queue',
        value: getQueueText(server),
      },
    );
    if (server.numSinceLastEmbed < 5 && !forceEmbed && server.currentEmbed?.deletable) {
      try {
        const sentMsg = await embed.edit(server.currentEmbed);
        if (sentMsg.reactions.cache.size < 1 && server.audio.player) {
          generatePlaybackReactions(sentMsg, server, voiceChannel, timeMS, message.guild.id);
        }
        return queueItem;
      }
      catch (e) {
      }
    }
    await sendEmbedUpdate(message.channel, server, forceEmbed, embed).then((sentMsg) => {
      if (server.audio.player) {
        generatePlaybackReactions(sentMsg, server, voiceChannel, timeMS, message.guild.id);
      }
    });
  }
  return queueItem;
}

/**
 * Sends a new now-playing embed to the channel. Is a helper for sendLinkAsEmbed. Deletes the old embed.
 * @param channel {import(discord.js).TextChannel | import(discord.js).DMChannel | import(discord.js).NewsChannel}
 * Discord's Channel object. Used for sending the new embed.
 * @param server {LocalServer} The server.
 * @param forceEmbed {Boolean} If to keep the old embed and send a new one.
 * @param embed {EmbedBuilderLocal} The embed to send.
 * @returns {Promise<any>} The new message that was sent.
 */
async function sendEmbedUpdate(channel, server, forceEmbed, embed) {
  server.numSinceLastEmbed = 0;
  if (server.currentEmbed) {
    if (!forceEmbed && server.currentEmbed.deletable) {
      await server.currentEmbed.delete();
    }
    else if (server.currentEmbed.reactions) {
      if (server.collector) {
        server.collector.stop();
        server.collector = null;
      }
    }
  }
  // noinspection JSUnresolvedFunction
  const sentMsg = await embed.send(channel);
  server.currentEmbed = sentMsg;
  return sentMsg;
}

/**
 * Generates the playback reactions and handles the collection of the reactions.
 * @param sentMsg The message that the bot sent
 * @param server {LocalServer} The server metadata
 * @param voiceChannel The voice channel metadata
 * @param timeMS The time for the reaction collector
 * @param mgid The message guild id
 */
async function generatePlaybackReactions(sentMsg, server, voiceChannel, timeMS, mgid) {
  if (!sentMsg) return;
  // should be in the order of how they should be displayed
  const playbackReactions = [reactions.REWIND, reactions.PPAUSE, reactions.SKIP, reactions.STOP, reactions.BOOK_O];
  const filter = (reaction, user) => {
    if (user.id === bot.user.id) return false;
    if (!voiceChannel || !voiceChannel.members.has(bot.user.id)) {
      voiceChannel = bot.channels.cache.get(server.audio.voiceChannelId);
    }
    if (voiceChannel && voiceChannel.members.has(bot.user.id)) {
      if (voiceChannel.members.has(user.id)) {
        return playbackReactions.includes(reaction.emoji.name);
      }
    }
    return false;
  };

  timeMS += 7200000;
  const collector = sentMsg.createReactionCollector({ filter, time: timeMS, dispose: true });
  server.collector?.stop();
  server.collector = collector;
  for (const singleReaction of playbackReactions) {
    await sentMsg.react(singleReaction);
    if (collector.ended) {
      audioCollectorEndAction(server, sentMsg);
      return;
    }
  }
  // true if the bot is processing a reaction
  let processingReaction = false;
  collector.on('collect', async (reaction, reactionCollector) => {
    if (!server.audio.player || !voiceChannel) return;
    switch (reaction.emoji.name) {
    case reactions.SKIP:
      if (processingReaction) return;
      processingReaction = true;
      await runSkipCommand(sentMsg, voiceChannel, server, 1, false, false,
        sentMsg.member.voice?.channel.members.get(reactionCollector.id));
      await reaction.users.remove(reactionCollector.id);
      processingReaction = false;
      if (server.followUpMessage?.deletable) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
      break;
    case reactions.PPAUSE:
      let tempUser = sentMsg.guild.members.cache.get(reactionCollector.id.toString());
      if (!server.audio.status) {
        playCommandUtil(sentMsg, tempUser, server, true, false, true);
        if (server.voteAdmin.length < 1 && !server.dictator) {
          tempUser = tempUser.nickname;
          if (server.followUpMessage) {
            server.followUpMessage.edit('*played by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*');
          }
          else {
            sentMsg.channel.send('*played by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*').then((msg) => {
              server.followUpMessage = msg;
            });
          }
        }
      }
      else {
        pauseCommandUtil(sentMsg, tempUser, server, true, false, true);
        tempUser = tempUser.nickname;
        if (server.voteAdmin.length < 1 && !server.dictator) {
          if (server.followUpMessage) {
            server.followUpMessage.edit('*paused by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*');
          }
          else {
            sentMsg.channel.send('*paused by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*').then((msg) => {
              server.followUpMessage = msg;
            });
          }
        }
      }
      reaction.users.remove(reactionCollector.id).then();
      break;
    case reactions.REWIND:
      reaction.users.remove(reactionCollector.id).then();
      runRewindCommand(sentMsg, mgid, voiceChannel, undefined, true,
        false, sentMsg.member.voice?.channel.members.get(reactionCollector.id), server);
      if (server.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
      break;
    case reactions.STOP:
      const mem = sentMsg.member.voice?.channel.members.get(reactionCollector.id);
      stopPlayingUtil(mgid, voiceChannel, false, server, sentMsg, mem);
      if (server.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
      break;
    case reactions.BOOK_O:
      const tempUserBook = await sentMsg.guild.members.fetch(reactionCollector.id);
      runKeysCommand(sentMsg, server,
        getSheetName(reactionCollector.id.toString()), reactionCollector, undefined, tempUserBook.nickname).then();
      server.numSinceLastEmbed += 5;
      break;
    }
  });
  collector.on('end', () => {
    audioCollectorEndAction(server, sentMsg);
  });
}

/**
 * Removes the reactions when the collector is no longer listening.
 * @param server {LocalServer} The guild's localServer.
 * @param sentMsg The message containing the embed.
 */
function audioCollectorEndAction(server, sentMsg) {
  if (server.currentEmbed?.deletable && sentMsg.deletable && sentMsg.reactions) {
    sentMsg.reactions.removeAll().then().catch((e) => {
      if (e.toString().toLowerCase().includes('permissions') && !server.errors.permissionReaction) {
        server.errors.permissionReaction = true;
        sentMsg.channel.send('\`permissions error: cannot remove reactions (field: Manage Messages)\`');
      }
    });
  }
}

module.exports = {
  playLinkToVC, checkStatusOfYtdl, skipLink, runSkipCommand, runRewindCommand, sendLinkAsEmbed,
};
