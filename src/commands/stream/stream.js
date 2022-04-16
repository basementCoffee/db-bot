const {
  botInVC, catchVCJoinError, getLinkType, linkFormatter, convertYTFormatToMS, verifyUrl, endStream, pauseComputation,
  playComputation, logError, formatDuration, createQueueItem, getQueueText, verifyPlaylist, resetSession
} = require('../../utils/utils');
const {
  StreamType, SPOTIFY_BASE_LINK, whatspMap, commandsMap, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, dispatcherMap,
  dispatcherMapStatus, LEAVE_VC_TIMEOUT, bot, MAX_QUEUE_S, botID
} = require('../../utils/process/constants');
const {getData} = require('spotify-url-info');
const m3u8stream = require('m3u8stream');
const ytdl_core = require('ytdl-core');
const ytdl = require('ytdl-core-discord');
const ytsr = require('ytsr');
const twitch = require('twitch-m3u8');
let scdl = require("scdl-core").SoundCloud.create().then(x => scdl = x);
const {updateActiveEmbed, createEmbed} = require('../../utils/embed');
const processStats = require('../../utils/process/ProcessStats');
const {shutdown} = require('../../utils/shutdown');
const {reactions} = require('../../utils/reactions');
const {getPlaylistItems} = require('../../utils/playlist');
const {MessageEmbed} = require('discord.js');
const {getAssumption} = require('../database/search');
const {getXdb} = require('../database/retrieval');
const {hasDJPermissions} = require('../../utils/permissions');
const {stopPlayingUtil, voteSystem, pauseCommandUtil} = require('./utils');
const {runPlayCommand} = require('../play');

/**
 *  The play function. Plays a given link to the voice channel. Does not add the item to the server queue.
 * @param {*} message The message that triggered the bot.
 * @param queueItem The queue item to play (see createQueueItem).
 * @param vc The voice channel to play the song in.
 * @param server The server playback metadata.
 * @param retries {number} Optional - Integer representing the number of retries.
 * @param seekSec {number} The amount to seek in seconds
 * @returns {Promise<void>}
 */
async function playLinkToVC (message, queueItem, vc, server, retries = 0, seekSec) {
  let whatToPlay = queueItem?.url;
  if (!whatToPlay) {
    queueItem = server.queue[0];
    whatToPlay = queueItem.url;
    if (!queueItem || !queueItem.url) return;
  }
  if (!vc) {
    vc = message.member.voice?.channel;
    if (!vc) return;
  }
  if (processStats.isInactive) {
    message.channel.send('*db bot has been updated*');
    return stopPlayingUtil(message.guild.id, vc, false, server);
  }
  if (server.voteAdmin.length > 0) {
    server.voteSkipMembersId.length = 0;
    server.voteRewindMembersId.length = 0;
    server.votePlayPauseMembersId.length = 0;
  }
  // the alternative url to play
  let urlAlt = whatToPlay;
  let connection = server.connection;
  if (!botInVC(message) || !connection || (connection.channel.id !== vc.id)) {
    try {
      connection = await vc.join();
      await new Promise(res => setTimeout(res, 300));
    } catch (e) {
      catchVCJoinError(e, message.channel);
      return;
    }
    if (processStats.startUpMessage.length > 1 && !server.startUpMessage) {
      server.startUpMessage = true;
      message.channel.send(processStats.startUpMessage);
    }
    server.connection = connection;
    connection.voice.setSelfDeaf(true).then();
  }
  if (server.leaveVCTimeout) {
    clearTimeout(server.leaveVCTimeout);
    server.leaveVCTimeout = null;
  }
  if (!queueItem.type) queueItem.type = getLinkType(whatToPlay);
  if (queueItem.type === StreamType.SPOTIFY) {
    if (queueItem.urlAlt) {
      urlAlt = queueItem.urlAlt;
    } else {
      whatToPlay = linkFormatter(whatToPlay, SPOTIFY_BASE_LINK);
      let itemIndex = 0;
      if (!queueItem.infos) {
        try {
          queueItem.infos = await getData(whatToPlay);
        } catch (e) {
          if (!retries) return playLinkToVC(message, queueItem, vc, server, ++retries, seekSec);
          console.log(e);
          message.channel.send('error: could not get link metadata <' + whatToPlay + '>');
          whatspMap[vc.id] = '';
          skipLink(message, vc, false, server, true);
          return;
        }
      }
      let artists = '';
      if (queueItem.infos.artists) {
        queueItem.infos.artists.forEach(x => artists += x.name + ' ');
        artists = artists.trim();
      } else artists = 'N/A';
      let search = await ytsr(queueItem.infos.name + ' ' + artists, {pages: 1});
      let youtubeDuration;
      if (search.items[itemIndex]) {
        if (search.items[itemIndex].duration) {
          youtubeDuration = convertYTFormatToMS(search.items[itemIndex].duration.split(':'));
        } else if (verifyUrl(search.items[itemIndex].url)) {
          const ytdlInfos = await ytdl.getBasicInfo(search.items[itemIndex].url);
          youtubeDuration = ytdlInfos.formats[itemIndex].approxDurationMs || 0;
        } else {
          skipLink(message, vc, false, server, true);
          await message.channel.send(`link not playable: <${search.items[itemIndex].url}>`);
          await updateActiveEmbed(server);
          return;
        }
        const spotifyDuration = parseInt(queueItem.infos.duration_ms);
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
      } else if (queueItem.infos.name.includes('feat')) {
        search = await ytsr(queueItem.infos.name + ' lyrics', {pages: 1});
      } else {
        search = await ytsr(queueItem.infos.name + ' ' + artists.split(' ')[0] + ' lyrics', {pages: 1});
      }
      if (search.items[itemIndex]) queueItem.urlAlt = urlAlt = search.items[itemIndex].url;
      else {
        message.channel.send(`could not find <${whatToPlay}>`);
        skipLink(message, vc, false, server, true);
        return;
      }
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
  if (server.streamData.type === StreamType.YOUTUBE) await server.streamData.stream.destroy();
  else if (server.streamData.stream) endStream(server);
  if (whatToPlay !== whatspMap[vc.id]) return;
  let dispatcher;
  try {
    let playbackTimeout;
    let stream;
    let encoderType;
    let streamHWM;
    // noinspection JSCheckFunctionSignatures
    if (queueItem.type === StreamType.SOUNDCLOUD) {
      commandsMap.set('SOUNDCLOUD', (commandsMap.get('SOUNDCLOUD') || 0) + 1);
      whatToPlay = linkFormatter(whatToPlay, SOUNDCLOUD_BASE_LINK);
      // add formatted link to whatspMap
      whatspMap[vc.id] = whatToPlay;
      stream = await scdl.download(whatToPlay, {highWaterMark: 1 << 25});
      streamHWM = 1 << 25;
      server.streamData.type = StreamType.SOUNDCLOUD;
    } else if (queueItem.type === StreamType.TWITCH) {
      let twitchEncoded;
      try {
        twitchEncoded = (await twitch.getStream(whatToPlay.substr(whatToPlay.indexOf(TWITCH_BASE_LINK) + TWITCH_BASE_LINK.length + 1).replace(/\//g, '')));
        if (twitchEncoded.length > 0) {
          twitchEncoded = twitchEncoded[twitchEncoded.length - 1];
        } else twitchEncoded = undefined;
      } catch (e) {}
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
      server.streamData.stream = stream;
    } else if (seekSec) {
      stream = await ytdl_core(urlAlt, {filter: 'audioonly'});
      server.streamData.type = StreamType.YOUTUBE;
      queueItem.urlAlt = urlAlt;
    } else {
      stream = await ytdl(urlAlt, {
        filter: (retries % 2 === 0 ? () => ['251'] : ''),
        highWaterMark: 1 << 25
      });
      streamHWM = 1 << 25;
      encoderType = 'opus';
      queueItem.urlAlt = urlAlt;
    }
    server.streamData.stream = stream;
    dispatcher = connection.play(stream, (seekSec ? {seek: seekSec} : {
        type: encoderType,
        volume: false,
        highWaterMark: streamHWM
      }
    ));
    dispatcherMap[vc.id] = dispatcher;
    if (server.streamData?.type === StreamType.SOUNDCLOUD) {
      pauseComputation(vc, true);
      await new Promise(res => setTimeout(() => {
        if (whatToPlay === whatspMap[vc.id]) playComputation(vc, true);
        res();
      }, 3000));
    } else dispatcherMapStatus[vc.id] = false;
    // if the server is not silenced then send the embed when playing
    if (server.silence) {
      if (server.currentEmbed) {
        if (server.currentEmbed.deletable) await server.currentEmbed.delete();
        server.currentEmbed = null;
      }
    } else if (!(retries && whatToPlay === server.queue[0]?.url)) {
      await sendLinkAsEmbed(message, queueItem, vc, server, false).then(() => dispatcher.setVolume(0.5));
    }
    processStats.removeActiveStream(message.guild.id);
    processStats.addActiveStream(message.guild.id);
    server.skipTimes = 0;
    dispatcher.on('error', async (e) => {
      if (dispatcher.streamTime < 1000 && retries < 4) {
        if (playbackTimeout) clearTimeout(playbackTimeout);
        if (retries === 3) await new Promise(res => setTimeout(res, 500));
        if (botInVC(message)) playLinkToVC(message, queueItem, vc, server, ++retries, seekSec);
        return;
      }
      skipLink(message, vc, false, server, false);
      // noinspection JSUnresolvedFunction
      logError(
        (new MessageEmbed()).setTitle('Dispatcher Error').setDescription(`url: ${urlAlt}
        timestamp: ${formatDuration(dispatcher.streamTime)}\nprevSong: ${server.queueHistory[server.queueHistory.length - 1]?.url}`)
      );
      console.log('dispatcher error: ', e);
    });
    dispatcher.once('finish', () => {
      if (whatToPlay !== whatspMap[vc.id]) {
        const errString = `There was a mismatch -----------\n old url: ${whatToPlay}\n current url: ${whatspMap[vc.id]}`;
        console.log(errString);
        try {
          // noinspection JSUnresolvedFunction
          logError(errString);
        } catch (e) {
          console.log(e);
        }
      }
      if (vc.members.size < 2) {
        connection.disconnect();
        dispatcherMap[vc.id] = undefined;
        processStats.removeActiveStream(message.guild.id);
      } else if (server.loop) {
        playLinkToVC(message, queueItem, vc, server, undefined, undefined);
      } else {
        server.queueHistory.push(server.queue.shift());
        if (server.queue.length > 0) {
          playLinkToVC(message, server.queue[0], vc, server, undefined, undefined);
        } else if (server.autoplay) {
          runAutoplayCommand(message, server, vc, queueItem);
        } else {
          if (server.collector) server.collector.stop();
          updateActiveEmbed(server);
          server.leaveVCTimeout = setTimeout(() => connection.disconnect(), LEAVE_VC_TIMEOUT);
          dispatcherMap[vc.id] = undefined;
          processStats.removeActiveStream(message.guild.id);
        }
      }
      if (server?.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
    });
    if (!retries) {
      playbackTimeout = setTimeout(() => {
        if (server.queue[0]?.url === whatToPlay && botInVC(message) && dispatcher.streamTime < 1) {
          playLinkToVC(message, queueItem, vc, server, ++retries, seekSec);
        }
      }, 2000);
    }
  } catch (e) {
    const errorMsg = e.toString().substring(0, 100);
    if (errorMsg.includes('ode: 404') || errorMsg.includes('ode: 410')) {
      if (!retries) playLinkToVC(message, queueItem, vc, server, ++retries, seekSec);
      else {
        server.skipTimes++;
        if (server.skipTimes < 4) {
          if (server.skipTimes === 2) checkStatusOfYtdl(message);
          message.channel.send(
            '***error code 404:*** *this video may contain a restriction preventing it from being played.*'
            + (server.skipTimes < 2 ? '\n*If so, it may be resolved sometime in the future.*' : ''));
          server.numSinceLastEmbed++;
          skipLink(message, vc, true, server, true);
        } else {
          console.log('status code 404 error');
          connection.disconnect();
          processStats.removeActiveStream(message.guild.id);
          message.channel.send('*db bot appears to be facing some issues: automated diagnosis is underway.*').then(() => {
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
        skipLink(message, vc, true, server, true);
      } else skipLink(message, vc, false, server, true);
      return;
    }
    if (retries < 2) {
      playLinkToVC(message, queueItem, vc, server, ++retries, seekSec);
      return;
    }
    console.log('error in playLinkToVC: ', whatToPlay);
    console.log(e);
    if (server.skipTimes > 3) {
      connection.disconnect();
      processStats.removeActiveStream(message.guild.id);
      message.channel.send('***db bot is facing some issues, may restart***');
      checkStatusOfYtdl(message);
      return;
    } else {
      server.skipTimes++;
    }
    // Error catching - fault with the link?
    message.channel.send('Could not play <' + whatToPlay + '>' +
      ((server.skipTimes === 1) ? '\nIf the link is not broken or restricted, please try again.' : ''));
    // search the db to find possible broken keys
    if (server.skipTimes < 2) searchForBrokenLinkWithinDB(message, server, whatToPlay);
    whatspMap[vc.id] = '';
    skipLink(message, vc, false, server, true);
    if (processStats.devMode) return;
    // noinspection JSUnresolvedFunction
    logError(`there was a playback error within playLinkToVC: ${whatToPlay}`);
    logError(e.toString().substring(0, 1910));
  }
}

/**
 * Searches the guild db and personal message db for a broken link
 * @param message The message
 * @param server The server
 * @param whatToPlayS The broken link provided as a string
 */
function searchForBrokenLinkWithinDB (message, server, whatToPlayS) {
  getXdb(server, message.channel.guild.id, botInVC(message)).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within the server db: ' + key + '*');
      }
    });
  });
  getXdb(server, `p${message.member.id}`, botInVC(message)).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within your personal db: ' + key + '*');
      }
    });
  });
}

/**
 * Checks the status of ytdl-core-discord and exits the active process if the test link is unplayable.
 * @param message The message metadata to send a response to the appropriate channel
 */
function checkStatusOfYtdl (message) {
  // noinspection JSUnresolvedFunction
  bot.channels.fetch('839643770986561607').then(channel =>
    channel.join().then(async (connection) => {
      await new Promise(res => setTimeout(res, 500));
      try {
        // noinspection JSCheckFunctionSignatures
        connection.play(await ytdl('https://www.youtube.com/watch?v=1Bix44C1EzY', {
          filter: () => ['251'],
          highWaterMark: 1 << 25
        }), {
          type: 'opus',
          volume: false,
          highWaterMark: 1 << 25
        });
      } catch (e) {
        console.log(e);
        // noinspection JSUnresolvedFunction
        if (message) {
          const diagnosisStr = '*self-diagnosis complete: db bot will be restarting*';
          if (message.deletable) message.edit(diagnosisStr);
          else message.channel.send(diagnosisStr);
        }
        logError('ytdl status is unhealthy, shutting off bot');
        connection.disconnect();
        if (processStats.isInactive) setTimeout(() => process.exit(0), 2000);
        else shutdown('YTDL-POOR')();
        return;
      }
      setTimeout(() => {
        connection.disconnect();
        if (message) message.channel.send('*self-diagnosis complete: db bot does not appear to have any issues*');
      }, 6000);
    })
  );
}

/**
 * Skips the link that is currently being played.
 * Use for specific voice channel playback.
 * @param message the message that triggered the bot
 * @param voiceChannel the voice channel that the bot is in
 * @param playMessageToChannel whether to play message on successful skip
 * @param server The server playback metadata
 * @param noHistory Optional - true excludes link from the queue history
 */
function skipLink (message, voiceChannel, playMessageToChannel, server, noHistory) {
  // if server queue is not empty
  if (server.streamData.type === StreamType.TWITCH) endStream(server);
  if (server.queue.length > 0) {
    let link;
    if (noHistory) server.queue.shift();
    else {
      link = server.queue[0];
      server.queueHistory.push(server.queue.shift());
    }
    if (playMessageToChannel) message.channel.send('*skipped*');
    // if there is still items in the queue then play next link
    if (server.queue.length > 0) {
      playLinkToVC(message, server.queue[0], voiceChannel, server);
    } else if (server.autoplay && link) {
      runAutoplayCommand(message, server, voiceChannel, server.queueHistory[server.queueHistory.length - 1]).then();
    } else {
      stopPlayingUtil(message.guild.id, voiceChannel, true, server, message, message.member);
    }
  } else {
    stopPlayingUtil(message.guild.id, voiceChannel, true, server, message, message.member);
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
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
 * @param server The server playback metadata
 * @returns {*}
 */
function runRewindCommand (message, mgid, voiceChannel, numberOfTimes, ignoreSingleRewind, force, mem, server) {
  if (!voiceChannel) {
    return message.channel.send('You must be in a voice channel to rewind');
  }
  if (server.dictator && mem.id !== server.dictator.id)
    return message.channel.send('only the dictator can perform this action');
  // boolean to determine if there is a song
  let queueItem;
  let rewindTimes = 1;
  try {
    if (numberOfTimes) {
      rewindTimes = parseInt(numberOfTimes);
    }
  } catch (e) {
    rewindTimes = 1;
    message.channel.send('rewinding once');
  }
  if (server.voteAdmin.length > 0 && !force) {
    if (voteSystem(message, message.guild.id, 'rewind', mem, server.voteRewindMembersId, server)) {
      rewindTimes = 1;
      ignoreSingleRewind = true;
    } else return;
  }
  if (!rewindTimes || rewindTimes < 1 || rewindTimes > 10000) return message.channel.send('invalid rewind amount');
  let rwIncrementor = 0;
  while (server.queueHistory.length > 0 && rwIncrementor < rewindTimes) {
    if (server.queue.length > (MAX_QUEUE_S + 99)) {
      playLinkToVC(message, server.queue[0], voiceChannel, server);
      return message.channel.send('*max queue size has been reached, cannot rewind further*');
    }
    // assumes there is no queueItem to enter while
    queueItem = false;
    // remove undefined links from queueHistory
    while (server.queueHistory.length > 0 && !queueItem) {
      queueItem = server.queueHistory.pop();
    }
    if (queueItem) server.queue.unshift(queueItem);
    rwIncrementor++;
  }
  if (queueItem) {
    if (ignoreSingleRewind) {} else {
      message.channel.send('*rewound' + (rewindTimes === 1 ? '*' : ` ${rwIncrementor} times*`));
    }
    playLinkToVC(message, queueItem, voiceChannel, server);
  } else if (server.queue[0]) {
    playLinkToVC(message, server.queue[0], voiceChannel, server);
    message.channel.send('*replaying first link*');
  } else {
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
 * @param server The server playback metadata
 * @param skipTimes Optional - the number of times to skip
 * @param sendSkipMsg Whether to send a 'skipped' message when a single link is skipped
 * @param forceSkip Optional - If there is a DJ, grants force skip abilities
 * @param mem The user that is completing the action, used for DJ mode
 */
function runSkipCommand (message, voiceChannel, server, skipTimes, sendSkipMsg, forceSkip, mem) {
  // in case of force disconnect
  if (!botInVC(message)) return;
  if (!voiceChannel) {
    voiceChannel = mem.voice.channel;
    if (!voiceChannel) return message.channel.send('*must be in a voice channel to use this command*');
  }
  if (server.queue.length < 1) return message.channel.send('*nothing is playing right now*');
  if (server.dictator && mem.id !== server.dictator.id)
    return message.channel.send('only the dictator can perform this action');
  if (server.voteAdmin.length > 0 && !forceSkip) {
    if (voteSystem(message, message.guild.id, 'skip', mem, server.voteSkipMembersId, server)) {
      skipTimes = 1;
      sendSkipMsg = false;
    } else return;
  }
  if (dispatcherMap[voiceChannel.id]) dispatcherMap[voiceChannel.id].pause();
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
        skipLink(message, voiceChannel, (sendSkipMsg ? skipCounter === 1 : false), server);
        if (skipCounter > 1) {
          message.channel.send('*skipped ' + skipCounter + ' times*');
        }
      } else {
        message.channel.send('*invalid skip amount (must be between 1 - 1000)*');
      }
    } catch (e) {
      skipLink(message, voiceChannel, true, server);
    }
  } else {
    skipLink(message, voiceChannel, true, server);
  }
}

/**
 * Autoplay to the next recommendation. Assumes that the queue is empty.
 * @param message The message metadata.
 * @param server The server.
 * @param vc The voice channel to be played in.
 * @param queueItem The last queueItem.
 * @returns {Promise<void>}
 */
async function runAutoplayCommand (message, server, vc, queueItem) {
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
      }
      return;
    } catch (e) {}
    message.channel.send('*could not find a video to play*');
    server.collector.stop();
    dispatcherMap[vc.id] = undefined;
  } else {
    message.channel.send(`*smartplay is not supported for this stream type*`);
    stopPlayingUtil(message.guild.id, vc, true, server, message, message.member);
  }
}

/**
 * Gets the recommended link from infos depending on the given link and index.
 * @param whatToPlay The link to find recommendations for.
 * @param infos Optional - The infos of whatToPlay. Will mutate a reference.
 * @param index The index of the recommendation to get.
 * @returns {Promise<string|undefined>} A new link if successful.
 */
async function getRecLink (whatToPlay, infos, index = 0) {
  try {
    let id;
    if (!infos || !infos.related_videos) infos = await ytdl.getBasicInfo(whatToPlay);
    id = infos.related_videos[index].id;
    return `https://www.youtube.com/watch?v=${id}`;
  } catch (e) {
    return undefined;
  }
}

/**
 * Sends an embed to the channel depending on the given link.
 * If not given a voice channel then playback buttons will not appear. This is the main playabck embed.
 * If no url is provided then returns.
 * @param message {module:"discord.js".Message} The message to send the channel to
 * @param queueItem {Object} the queueItem to generate the embed for
 * @param voiceChannel {module:"discord.js".VoiceChannel} the voice channel that the link is being played in, if playing
 * @param server {Object} The server playback metadata
 * @param forceEmbed {Boolean} Force the embed to be re-sent in the text channel
 * @returns {Promise<void>}
 */
async function sendLinkAsEmbed (message, queueItem, voiceChannel, server, forceEmbed) {
  if (!message || !queueItem) return;
  const url = queueItem.url;
  if (!voiceChannel) {
    voiceChannel = message.member.voice?.channel;
    if (!voiceChannel) return;
  }
  if (server.verbose) forceEmbed = true;
  if (server.loop && url === server.queue[0]?.url && !forceEmbed && botInVC(message)
    && server.currentEmbed.reactions) {
    return;
  }
  // the created embed
  const embedData = await createEmbed(url, queueItem.infos);
  const timeMS = embedData.timeMS;
  const embed = embedData.embed;
  let showButtons = true;
  if (botInVC(message)) {
    if (server.currentEmbedChannelId !== message.channel.id) {
      server.currentEmbedChannelId = message.channel.id;
      server.numSinceLastEmbed += 10;
    }
    embed.addField('Queue', getQueueText(server), true);
  } else {
    server.currentEmbedChannelId = '0';
    server.numSinceLastEmbed = 0;
    embed.addField('-', 'Session ended', true);
    showButtons = false;
  }
  if (server.queue.length < 1 || server.queue[0]?.url === url) {
    queueItem.infos = embedData.infos;
    if (server.numSinceLastEmbed < 5 && !forceEmbed && server.currentEmbed?.deletable) {
      try {
        const sentMsg = await server.currentEmbed.edit(embed);
        if (sentMsg.reactions.cache.size < 1 && showButtons && dispatcherMap[voiceChannel.id])
          generatePlaybackReactions(sentMsg, server, voiceChannel, timeMS, message.guild.id);
        return;
      } catch (e) {}
    }
    await sendEmbedUpdate(message.channel, server, forceEmbed, embed).then(sentMsg => {
      if (showButtons && dispatcherMap[voiceChannel.id])
        generatePlaybackReactions(sentMsg, server, voiceChannel, timeMS, message.guild.id);
    });
  }
}

/**
 * Sends a new message embed to the channel. Is a helper for sendLinkAsEmbed.
 * @param channel {module:"discord.js".TextChannel | module:"discord.js".DMChannel | module:"discord.js".NewsChannel}
 * Discord's Channel object. Used for sending the new embed.
 * @param server The server.
 * @param forceEmbed {Boolean} If to keep the old embed and send a new one.
 * @param embed The embed to send.
 * @returns {Promise<Message>} The new message that was sent.
 */
async function sendEmbedUpdate (channel, server, forceEmbed, embed) {
  server.numSinceLastEmbed = 0;
  if (server.currentEmbed) {
    if (!forceEmbed && server.currentEmbed.deletable) {
      await server.currentEmbed.delete();
    } else if (server.currentEmbed.reactions) {
      server.collector.stop();
    }
  }
  // noinspection JSUnresolvedFunction
  const sentMsg = await channel.send(embed);
  server.currentEmbed = sentMsg;
  return sentMsg;
}

/**
 * Generates the playback reactions and handles the collection of the reactions.
 * @param sentMsg The message that the bot sent
 * @param server The server metadata
 * @param voiceChannel The voice channel metadata
 * @param timeMS The time for the reaction collector
 * @param mgid The message guild id
 */
function generatePlaybackReactions (sentMsg, server, voiceChannel, timeMS, mgid) {
  if (!sentMsg) return;
  sentMsg.react(reactions.REWIND).then(() => {
    if (collector.ended) return;
    sentMsg.react(reactions.PPAUSE).then(() => {
      if (collector.ended) return;
      sentMsg.react(reactions.SKIP).then(() => {
        if (collector.ended) return;
        sentMsg.react(reactions.STOP).then(() => {
          if (collector.ended) return;
          sentMsg.react(reactions.KEY).then(() => {
            if (collector.ended) return;
            sentMsg.react(reactions.PKEY).then();
          });
        });
      });
    });
  });

  const filter = (reaction, user) => {
    if (voiceChannel && user.id !== botID) {
      if (voiceChannel.members.has(user.id)) return [reactions.PPAUSE, reactions.SKIP, reactions.REWIND, reactions.STOP, reactions.KEY, reactions.PKEY].includes(reaction.emoji.name);
    }
    return false;
  };

  timeMS += 7200000;
  const collector = sentMsg.createReactionCollector(filter, {time: timeMS, dispose: true});
  server.collector = collector;

  collector.on('collect', (reaction, reactionCollector) => {
    if (!dispatcherMap[voiceChannel.id] || !voiceChannel) return;
    switch (reaction.emoji.name) {
      case reactions.SKIP:
        runSkipCommand(sentMsg, voiceChannel, server, 1, false, false, sentMsg.member.voice?.channel.members.get(reactionCollector.id));
        reaction.users.remove(reactionCollector.id).then();
        if (server.followUpMessage?.deletable) {
          server.followUpMessage.delete();
          server.followUpMessage = undefined;
        }
        break;
      case reactions.PPAUSE:
        let tempUser = sentMsg.guild.members.cache.get(reactionCollector.id);
        if (dispatcherMapStatus[voiceChannel.id]) {
          runPlayCommand(sentMsg, tempUser, server, true, false, true);
          if (server.voteAdmin.length < 1 && !server.dictator) {
            tempUser = tempUser.nickname;
            if (server.followUpMessage) {
              server.followUpMessage.edit('*played by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*');
            } else {
              sentMsg.channel.send('*played by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*').then(msg => {server.followUpMessage = msg;});
            }
          }
        } else {
          pauseCommandUtil(sentMsg, tempUser, server, true, false, true);
          tempUser = tempUser.nickname;
          if (server.voteAdmin.length < 1 && !server.dictator) {
            if (server.followUpMessage) {
              server.followUpMessage.edit('*paused by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*');
            } else {
              sentMsg.channel.send('*paused by \`' + (tempUser ? tempUser : reactionCollector.username) +
                '\`*').then(msg => {server.followUpMessage = msg;});
            }
          }
        }
        reaction.users.remove(reactionCollector.id).then();
        break;
      case reactions.REWIND:
        reaction.users.remove(reactionCollector.id).then();
        runRewindCommand(sentMsg, mgid, voiceChannel, undefined, true, false, sentMsg.member.voice?.channel.members.get(reactionCollector.id), server);
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
      case reactions.KEY:
        runKeysCommand(sentMsg, server, mgid, '', voiceChannel, '').then();
        server.numSinceLastEmbed += 5;
        break;
      case reactions.PKEY:
        runKeysCommand(sentMsg, server, `p${reactionCollector.id}`, 'm', voiceChannel, reactionCollector).then();
        server.numSinceLastEmbed += 5;
        break;
    }
  });
  collector.on('end', () => {
    if (server.currentEmbed?.deletable && sentMsg.deletable && sentMsg.reactions) sentMsg.reactions.removeAll().then();
  });
}

/**
 * Adds a number of items from the database to the queue randomly.
 * @param message The message that triggered the bot
 * @param numOfTimes The number of items to add to the queue, or a playlist url if isPlaylist
 * @param cdb {Map}  The database to reference
 * @param server The server playback metadata
 * @param isPlaylist Optional - True if to randomize just a playlist
 * @param addToFront {number} Optional - Should be 1 if to add items to the front of the queue
 */
async function addRandomToQueue (message, numOfTimes, cdb, server, isPlaylist, addToFront = 0) {
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin))
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  // the playlist url
  let playlistUrl;
  let sentMsg;
  // array of links
  let valArray;
  if (isPlaylist) {
    // if given a cdb then it is a key-name, else it is a url
    // playlist name is passed from numOfTimes argument
    if (cdb) {
      playlistUrl = cdb.get(numOfTimes) || (() => {
        // tries to get a close match
        const assumption = getAssumption(numOfTimes, cdb);
        if (assumption) {
          message.channel.send(`could not find '${numOfTimes}'. **Assuming '${assumption}'**`);
          return cdb.get(assumption);
        }
        return null;
      })();
    } else playlistUrl = numOfTimes;
    if (!playlistUrl) return message.channel.send(`*could not find **${numOfTimes}** in the keys list*`);
    numOfTimes = 1;
    if (verifyPlaylist(playlistUrl)) sentMsg = message.channel.send('randomizing your playlist...');
  } else {
    valArray = Array.from(cdb.values());
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
          } else server.queue.push(url);
          i++;
        } else if (verifyPlaylist(url)) {
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
        } else if (url) {
          // add url to queue
          if (addToFront) {
            server.queue.splice(addToFront - 1, 0, createQueueItem(url, getLinkType(url), null));
            addToFront++;
          } else server.queue.push(createQueueItem(url, getLinkType(url), null));
          i++;
        }
        // remove added item from tempArray
        tempArray.splice(randomNumber, 1);
      }
    }
    // here - queue should have all the items
  } catch (e) {
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
  } else if (!botInVC(message)) {
    if (botInVC(message)) {
      updatedQueueMessage(message.channel, `*added ${numOfTimes} to queue*`, server);
    } else {
      await playLinkToVC(message, server.queue[0], message.member.voice?.channel, server);
    }
  } else {
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
function updatedQueueMessage (channel, messageText, server) {
  channel.send(messageText);
  updateActiveEmbed(server).then();
}

/**
 * Grabs all the keys/names from the database.
 * @param {*} message The message trigger
 * @param server The server
 * @param {*} sheetName The name of the sheet to retrieve
 * @param cmdType the prefix to call the keys being displayed
 * @param voiceChannel optional, a specific voice channel to use besides the message's
 * @param user Optional - username, overrides the message owner's name
 */
async function runKeysCommand (message, server, sheetName, cmdType, voiceChannel, user) {
  const keysMsg = (botInVC(message) ? {edit: (content, embed) => message.channel.send(content || embed)} :
    await message.channel.send('*getting keys...*'));
  const xdb = await getXdb(server, sheetName, botInVC(message));
  const prefixString = server.prefix;
  const keyArrayUnsorted = Array.from(xdb.congratsDatabase.keys()).reverse();
  const keyArraySorted = keyArrayUnsorted.map(x => x).sort();
  // the keyArray to generate
  let keyArray = keyArraySorted;
  if (keyArray.length < 1) {
    let emptyDBMessage;
    if (!cmdType) {
      emptyDBMessage = "The server's ";
    } else {
      emptyDBMessage = 'Your ';
    }
    keysMsg.edit('**' + emptyDBMessage + 'saved-links list is empty.**\n*Save a link by putting a word followed by a link.' +
      '\nEx:* \` ' + prefixString + cmdType + 'a [key] [link] \`');
  } else {
    let sortByRecent = true;
    let dbName = '';
    /**
     * Generates the keys list embed
     * @param sortByRecent True if to return an array sorted by date added
     * @returns {module:"discord.js".MessageEmbed}
     */
    const generateKeysEmbed = (sortByRecent) => {
      if (sortByRecent) keyArray = keyArrayUnsorted;
      else keyArray = keyArraySorted;
      let s = '';
      for (const key in keyArray) {
        s = `${s}, ${keyArray[key]}`;
      }
      s = s.substring(1);
      let keysMessage = '';
      let keyEmbedColor = '#ffa200';
      if (cmdType === 'm') {
        let name;
        user ? name = user.username : name = message.member.nickname;
        if (!name) {
          name = message.author.username;
        }
        if (name) {
          keysMessage += '**' + name + "'s keys ** ";
          dbName = name.toLowerCase() + "'s keys";
        } else {
          keysMessage += '** Personal keys ** ';
          dbName = 'personal keys';
        }
      } else if (!cmdType) {
        keysMessage += '**Server keys ** ';
        dbName = "server's keys";
        keyEmbedColor = '#90d5cf';
      }
      const embedKeysMessage = new MessageEmbed();
      embedKeysMessage.setTitle(keysMessage + (sortByRecent ? '(recently added)' : '(alphabetical)')).setDescription(s)
        .setColor(keyEmbedColor).setFooter(`play command: ${prefixString + cmdType}d [key]`);
      return embedKeysMessage;
    };
    keysMsg.edit('', generateKeysEmbed(sortByRecent)).then(async sentMsg => {
      const server = processStats.servers[message.guild.id];
      sentMsg.react(reactions.QUESTION).then(() => sentMsg.react(reactions.SHUFFLE).then(sentMsg.react(reactions.MIX)));
      const filter = (reaction, user) => {
        return user.id !== botID && [reactions.QUESTION, reactions.MIX, reactions.SHUFFLE].includes(reaction.emoji.name);
      };
      const keysButtonCollector = sentMsg.createReactionCollector(filter, {time: 1200000});
      keysButtonCollector.on('collect', async (reaction, reactionCollector) => {
        if (reaction.emoji.name === reactions.QUESTION) {
          let nameToSend;
          let descriptionSuffix;
          if (dbName === "server's keys") {
            nameToSend = 'the server';
            descriptionSuffix = 'Each server has it\'s own server keys. ' +
              '\nThey can be used by any member in the server.';
          } else {
            nameToSend = 'your personal';
            descriptionSuffix = 'Your personal keys are keys that only you can play. ' +
              '\nThey work for you in any server with the db bot.';
          }
          const embed = new MessageEmbed()
            .setTitle('How to add/delete keys from ' + nameToSend + ' list')
            .setDescription('Add a link by putting a word followed by a link -> \` ' +
              prefixString + cmdType + 'a [key] [link]\`\n' +
              'Delete a key by typing the name you wish to delete -> \` ' +
              prefixString + cmdType + 'del [key]\`')
            .setFooter(descriptionSuffix);
          message.channel.send(embed);
        } else if (reaction.emoji.name === reactions.SHUFFLE) {
          if (!voiceChannel) {
            voiceChannel = message.member.voice?.channel;
            if (!voiceChannel) return message.channel.send("must be in a voice channel to randomize");
          }
          // in case of force disconnect
          if (!botInVC(message)) {
            resetSession(server);
          } else if (server.queue.length >= MAX_QUEUE_S) {
            return message.channel.send('*max queue size has been reached*');
          }
          if (server.lockQueue && !hasDJPermissions(message, reactionCollector.id, true, server.voteAdmin))
            return message.channel.send('the queue is locked: only the DJ can add to the queue');
          if (server.dictator && server.dictator.id !== reactionCollector.id)
            return message.channel.send('only the dictator can perform this action');
          for (const mem of voiceChannel.members) {
            if (reactionCollector.id === mem[1].id) {
              if (sheetName.includes('p')) {
                if (reactionCollector.username) {
                  message.channel.send('*randomizing from ' + reactionCollector.username + "'s keys...*");
                } else {
                  message.channel.send('*randomizing...*');
                }
                if (reactionCollector.id === user.id) {
                  addRandomToQueue(message, -1, xdb.congratsDatabase, server, false).then();
                  return;
                } else {
                  const xdb2 = await getXdb(server, `p${reactionCollector.id}`, botInVC(message));
                  addRandomToQueue(message, -1, xdb2.congratsDatabase, server, false).then();
                }
              } else {
                message.channel.send('*randomizing from the server keys...*');
                addRandomToQueue(message, -1, xdb.congratsDatabase, server, false).then();
              }
              return;
            }
          }
          return message.channel.send('must be in a voice channel to shuffle play');
        } else if (reaction.emoji.name === reactions.MIX) {
          sortByRecent = !sortByRecent;
          sentMsg.edit(generateKeysEmbed(sortByRecent));
          reaction.users.remove(reactionCollector.id).then();
        }
      });
      keysButtonCollector.once('end', () => {
        sentMsg.reactions.removeAll();
      });
    });
  }
}

module.exports = {
  playLinkToVC, checkStatusOfYtdl, skipLink, runSkipCommand, runRewindCommand, sendLinkAsEmbed, addRandomToQueue,
  runKeysCommand
};