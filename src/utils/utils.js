const {getData} = require('spotify-url-info');
const {MessageEmbed} = require('discord.js');
const ytdl = require('ytdl-core-discord');
const spdl = require('spdl-core');
const ytpl = require('ytpl');
const {servers, botID, SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, StreamType} = require('./constants');
const scdl = require('soundcloud-downloader').default;
const unpipe = require('unpipe');

/**
 * Given a duration in ms, it returns a formatted string separating
 * the hours, minutes, and seconds.
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
  return `${Math.floor(min)}m ${Math.floor(seconds % 60)}s`;
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
      if (durationArray[2]) duration += durationArray[1] * 3600000;
      duration += durationArray[0] * 1000;
      return duration;
    }
  } catch (e) {}
  return 0;
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
 * Return an object containing the embed and time based on the data provided.
 * @param url {string} The url to create the embed for.
 * @param infos Optional - the info metadata to use.
 * @return {Promise<{embed: module:"discord.js".MessageEmbed, infos: {formats}, timeMS: number}>}
 */
async function createEmbed (url, infos) {
  let timeMS;
  let embed;
  if (url.toString().includes(SPOTIFY_BASE_LINK)) {
    if (!infos) infos = await getData(url);
    let artists = '';
    infos.artists.forEach(x => artists ? artists += ', ' + x.name : artists += x.name);
    embed = new MessageEmbed()
      .setTitle(`${infos.name}`)
      .setURL(infos.external_urls.spotify)
      .setColor('#1DB954')
      .addField(`Artist${infos.artists.length > 1 ? 's' : ''}`, artists, true)
      .addField('Duration', formatDuration(infos.duration_ms), true)
      .setThumbnail(infos.album.images[infos.album.images.length - 1].url);
    timeMS = parseInt(infos.duration_ms);
  } else if (url.includes(SOUNDCLOUD_BASE_LINK)) {
    if (!infos) infos = await scdl.getInfo(url);
    const artist = infos.user.full_name || infos.user.username || infos.publisher_metadata.artist || 'N/A';
    const title = (infos.publisher_metadata ? (infos.publisher_metadata.release_title || infos.publisher_metadata.album_title) : '') || (infos.title.replace(/"/g, '') || 'SoundCloud');
    embed = new MessageEmbed()
      .setTitle(title)
      .setURL(url)
      .setColor('#ee4900')
      .addField(`Artist`, artist, true)
      .addField('Duration', formatDuration(infos.duration || 0), true)
      .setThumbnail(infos.artwork_url || infos.user?.avatar_url || null);
    timeMS = infos.duration || infos.full_duration || 'N/A';
  } else if (url.includes(TWITCH_BASE_LINK)) {
    const artist = url.substr(url.indexOf(TWITCH_BASE_LINK) + TWITCH_BASE_LINK.length + 1).replace(/\//g, '');
    embed = new MessageEmbed()
      .setTitle(`${artist}'s stream`)
      .setURL(url)
      .setColor('#8a2aef')
      .addField(`Channel`, artist, true)
      .addField('Duration', 'live', true)
      .setThumbnail('https://raw.githubusercontent.com/Reply2Zain/db-bot/master/assets/twitchLogo.jpeg');
  } else {
    if (!infos) infos = await ytdl.getBasicInfo(url);
    let duration;
    let videoDetails = infos.videoDetails;
    if (!videoDetails) videoDetails = infos;
    if (videoDetails.isLiveContent || videoDetails.isLive) {
      duration = 'live';
      timeMS = 3600000; // set to 1hr
    } else {
      if (infos.formats && infos.formats[0]) {
        timeMS = parseInt(infos.formats[0].approxDurationMs);
        duration = formatDuration(timeMS || 0);
      } else {
        timeMS = videoDetails.durationSec * 1000;
        duration = formatDuration(timeMS);
      }
      if (duration === 'NaNm NaNs') {
        duration = 'N/A';
        timeMS = 0;
      }
    }
    embed = new MessageEmbed()
      .setTitle(`${videoDetails.title}`)
      .setURL(videoDetails.video_url || videoDetails.shortUrl || infos.url)
      .setColor('#c40d00')
      .addField('Duration', duration || videoDetails.duration, true)
      .setThumbnail(videoDetails.thumbnails[0].url);
  }
  return {
    embed,
    timeMS,
    infos
  };
}

/**
 * Sends an updated playback embed with the fields updated. Assumes that a session is ongoing.
 * @param server The server.
 * @returns {Promise<void>}
 */
async function updateActiveEmbed (server) {
  try {
    if (!server.currentEmbed) return;
    let embed = await createEmbed(server.currentEmbedLink, server.infos);
    server.infos = embed.infos;
    embed = embed.embed;
    embed.addField('Queue', getQueueText(server), true);
    server.currentEmbed.edit(embed);
  } catch (e) {
    console.log(e);
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
 * Send a recommendation to a user. EXPERIMENTAL.
 * @param message The message metadata.
 * @param content Optional - text to add to the recommendation.
 * @param url The url to recommend.
 * @param uManager bot.users
 * @returns {Promise<void>}
 */
async function sendRecommendation (message, content, url, uManager) {
  if (message.member.id !== '443150640823271436' && message.member.id !== '268554823283113985') return;
  if (!url) return;
  try {
    let recUser = await uManager.fetch((message.member.id === '443150640823271436' ? '268554823283113985' : '443150640823271436'));
    await recUser.send({
      content: `**${message.member.user.username}** has a recommendation for you${(content ? `:\n*${content}*` : '')}\n<${url}>`,
      embed: (await createEmbed(url)).embed
    });
    message.channel.send(`*recommendation sent to ${recUser.username}*`);
  } catch (e) {
    console.log(e);
  }
}

/**
 * Returns whether a given URL is valid. Returns false if given a playlist.
 * @param url The url to verify.
 * @returns {boolean} True if given a playable URL.
 */
function verifyUrl (url) {
  // noinspection JSUnresolvedFunction
  return (url.includes(SPOTIFY_BASE_LINK) ? spdl.validateURL(linkFormatter(url, SPOTIFY_BASE_LINK)) :
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
 * Shuffles the queue and sends updates to the user regarding its status.
 * @param message The message object.
 * @param queue {Array<*>} The queue to shuffle.
 * @returns {*}
 */
function shuffleQueue (message, queue) {
  if (queue.length < 1) return message.channel.send(`*need a playlist url to shuffle, or a number to use random items from your keys list.*`);
  shuffleQueueComputation(queue);
  message.channel.send('*your queue has been shuffled*');
}

/**
 * Shuffles the queue. Does not send any message to the user.
 * @param queue {Array<*>} The queue to shuffle.
 */
function shuffleQueueComputation (queue) {
  let currentIndex = queue.length, randomIndex; // indices for shuffling
  // don't include what's actively playing
  while (currentIndex > 1) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // swap current and random index locations
    [queue[currentIndex], queue[randomIndex]] = [queue[randomIndex], queue[currentIndex]];
  }
}

/**
 * Searches a Map for the given key. Provides the keys that contain the given key.
 * @param keyName the key to search for.
 * @param xdb An object containing a Map called congratsDatabase.
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values
 */
function runSearchCommand (keyName, xdb) {
  const keyNameLen = keyName.length;
  const keyArray = Array.from(xdb.congratsDatabase.keys());
  let ss = '';
  let ssi = 0;
  let searchKey;
  keyName = keyName.toUpperCase();
  for (let ik = 0; ik < keyArray.length; ik++) {
    searchKey = keyArray[ik].toUpperCase();
    if (keyName === searchKey.substr(0, keyNameLen) || (keyNameLen > 1 && searchKey.includes(keyName))) {
      ssi++;
      ss += `${keyArray[ik]}, `;
    }
  }
  if (ssi) ss = ss.substring(0, ss.length - 2);
  return {
    // the search string
    ss: ss,
    // the number of searches found
    ssi: ssi
  };
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
    title = title.substr(0, cutoff) + '...';
  }
  return title;
}

/**
 * Function to generate an array of embeds representing the help list.
 * @param {string} prefixString the prefix in string format
 * @param numOfPages {number} the number of embeds to generate (between 1 and 2)
 * @param version {string} the current version of the db bot
 */
function getHelpList (prefixString, numOfPages, version) {
  const page1 =
    '***[NEW]** - added support for SoundCloud & Twitch (Nov. 2021)*\n\n' +
    '--------------  **Music Commands** --------------\n\`' +
    prefixString +
    'play [word] \` Searches YouTube and plays *[p]* \n\`' +
    prefixString +
    'play [link] \` Play YT/Spotify/SoundCloud/Twitch link *[p]* \n\`' +
    prefixString +
    'playnow [word/link] \` Plays now, overrides queue *[pn]*\n\`' +
    prefixString +
    'pause \` Pause *[pa]*\n\`' +
    prefixString +
    'resume \` Resume if paused *[res]* \n\`' +
    prefixString +
    'skip [# times] \` Skip the current link *[sk]*\n\`' +
    prefixString +
    'rewind [# times] \` Rewind to play previous links *[rw]*\n\`' +
    prefixString +
    'end \` Stops playing and ends session  *[e]*\n\`' +
    prefixString +
    'now \` See now playing *[np]*\n\`' +
    prefixString +
    'loop \` Loops songs on finish *[l]*\n\`' +
    prefixString +
    'queue \` Displays the queue *[q]*\n' +
    '\n-----------  **Advanced Music Commands**  -----------\n\`' +
    prefixString +
    'smartplay \` Autoplay when there is nothing next to play\n\`' +
    prefixString +
    'lyrics \` Get lyrics of what\'s currently playing\n\`' +
    prefixString +
    'shuffle [link] \` Shuffle a playlist before playing\n\`' +
    prefixString +
    'dj \` DJ mode, members have to vote to skip tracks\n\`' +
    prefixString +
    'dictator \` Dictator mode, one member controls all music commands\n\`' +
    prefixString +
    'verbose \` Keep all song embeds during a session\n\`' +
    prefixString +
    'silence \` Silence/hide the now-playing embed \n';
  const page2 =
    '-----------  **Server Keys**  -----------\n\`' +
    prefixString +
    "keys \` See all of the server's keys *[k]*\n\`" +
    prefixString +
    'd [key] \` Play a song from the server keys \n\`' +
    prefixString +
    'dnow [key] \` Play immediately, overrides queue *[kn]* \n\`' +
    prefixString +
    'add [key] [url] \` Add a link to the server keys  *[a]*\n\`' +
    prefixString +
    'delete [key] \` Deletes a link from the server keys  *[del]*\n\`' +
    prefixString +
    'shuffle [# times] \` Play a random song from server keys  *[r]*\n\`' +
    prefixString +
    'find [key / link] \` See if a link/key is in the keys-list *[s]*\n\`' +
    prefixString +
    'link [key] \` Get the full link of a specific key  *[url]*\n' +
    '\n-----------  **Personal Keys**  -----------\n' +
    "*Prepend 'm' to each command above to access your personal keys list*\nex: \`" + prefixString + "mkeys \`\n" +
    '\n--------------  **Other Commands**  -----------------\n\`' +
    prefixString +
    'guess \` Random roll for the number of people in the voice channel \n\`' +
    prefixString +
    'changeprefix [new prefix] \` Changes the prefix for all commands \n\`' +
    prefixString +
    'insert [link] \` Insert a link anywhere within the queue\n\`' +
    prefixString +
    'remove [num] \` Remove a link from the queue\n\`' +
    prefixString +
    'ticket [message] \` report an issue / request a new feature \n' +
    `\n**Or just say congrats to a friend. I will chime in too! :) **\n*version ${version}*`;
  const helpListEmbed = new MessageEmbed();
  helpListEmbed.setTitle('Help List  *[short-command]*');
  const arrayOfPages = [];
  if (numOfPages > 1) {
    const helpListEmbed2 = new MessageEmbed();
    helpListEmbed
      .setTitle('Help List  *[short-command]*')
      .setDescription(page1)
      .setFooter('(1/2)');
    helpListEmbed2
      .setTitle('Help List  *[short-command]*')
      .setDescription(page2)
      .setFooter('(2/2)');
    arrayOfPages.push(helpListEmbed);
    arrayOfPages.push(helpListEmbed2);
  } else {
    helpListEmbed
      .setDescription(page1 + '\n' + '\n' + page2);
    arrayOfPages.push(helpListEmbed);
  }
  return arrayOfPages;
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
function createMemoryEmbed () {
  const memUsage = process.memoryUsage();
  return new MessageEmbed()
    .setTitle('Memory Usage')
    .setDescription(`rss -  ${formatMemoryUsage(memUsage.rss)} MB\nheap -  ` +
      `${formatMemoryUsage(memUsage.heapUsed)} / ${formatMemoryUsage(memUsage.heapTotal)} MB (${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%)`);
}

/**
 * Produces the help list and manages its reactions.
 * @param message The message instance.
 * @param server The server.
 * @param version {string} The version.
 */
function runHelpCommand (message, server, version) {
  server.numSinceLastEmbed += 10;
  let helpPages = getHelpList(server.prefix, 2, version);
  message.channel.send(helpPages[0]).then((sentMsg) => {
    let currentHelp = 0;
    const hr = '➡️';
    sentMsg.react(hr).then();
    const filter = (reaction, user) => {
      return user.id !== botID;
    };

    const collector = sentMsg.createReactionCollector(filter, {time: 600000, dispose: true});
    collector.on('collect', (reaction) => {
      if (reaction.emoji.name === hr) {
        sentMsg.edit(helpPages[(++currentHelp % 2)]);
      }
    });
    collector.on('remove', (reaction) => {
      if (reaction.emoji.name === hr) {
        sentMsg.edit(helpPages[(++currentHelp % 2)]);
        currentHelp -= 2;
      }
    });
    collector.on('end', () => {
      if (sentMsg.reactions) sentMsg.reactions.removeAll().then();
    });
  });
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
    // the collector for the current embed message
    collector: false,
    // the metadata of the link
    infos: false,
    // the playback status message
    followUpMessage: undefined,
    // the active link of what is playing
    currentEmbedLink: undefined,
    // the alternative link of what is playing
    altUrl: undefined,
    // the current embed message
    currentEmbed: undefined,
    // the number of items sent since embed generation
    numSinceLastEmbed: 0,
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
 * @param server The server.
 * @param queueItem The item to add to the queue.
 */
function unshiftQueue (server, queueItem) {
  server.queue.unshift(queueItem);
}

/**
 * Creates a queue item.
 * @param url The URL to add.
 * @param type The type of URL. Provided as a StreamType.
 * @param infos The infos of the URL.
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
 * @param server The server.
 * @param queueItem The item to add to the queue.
 */
function pushQueue (server, queueItem) {
  server.queue.push(queueItem);
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

module.exports = {
  formatDuration, createEmbed, sendRecommendation, botInVC, adjustQueueForPlayNow, verifyUrl, verifyPlaylist,
  resetSession: resetSession, convertYTFormatToMS, setSeamless, getQueueText, updateActiveEmbed, getHelpList,
  initializeServer, runSearchCommand, runHelpCommand, getTitle, linkFormatter, endStream, unshiftQueue, pushQueue,
  shuffleQueue, createQueueItem, getLinkType, createMemoryEmbed
};
