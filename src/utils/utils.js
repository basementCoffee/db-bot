const {getData, getTracks} = require('spotify-url-info');
const {MessageEmbed} = require('discord.js');
const ytdl = require('ytdl-core-discord');
const ytpl = require('ytpl');
const {
  servers, botID, SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, StreamType, bot, MAX_QUEUE_S
} = require('./constants');
const scdl = require('soundcloud-downloader').default;
const unpipe = require('unpipe');
const cpu = require('node-os-utils').cpu;
const os = require('os');
const AD_1 = '443150640823271436'; // z
const AD_2 = '268554823283113985'; // k
const destroyBot = () => bot.destroy();

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
 * Return an object containing the embed and time based on the data provided.
 * @param url {string} The url to create the embed for.
 * @param infos {Object?} Optional - the info metadata to use.
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
      .setThumbnail(infos.album?.images[infos.album.images.length - 1].url);
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
        timeMS = parseInt(infos.formats[0].approxDurationMs || videoDetails.lengthSeconds * 1000);
        duration = formatDuration(timeMS || 0);
      } else {
        timeMS = videoDetails.durationSec * 1000 || convertYTFormatToMS(videoDetails.duration.split(':'));
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
      .addField('Channel', `[${videoDetails.author.name || videoDetails.ownerChannelName || 'N/A'}]` +
        `(${videoDetails.author.url || videoDetails.author.channel_url})`, true)
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
 * Tries to get a close match of a valid existing key from the word provided.
 * Otherwise, returns false.
 * @param word {string} The word to check.
 * @param cdb {Map<>} A map containing all the keys and their links.
 * @return {string | false} The closest valid assumption or false.
 */
function getAssumption (word, cdb) {
  const sObj = runSearchCommand(word, cdb);
  const ss = sObj.ss;
  if (sObj.ssi === 1 && ss && word.length > 1 && (ss.length - word.length) < Math.floor((ss.length / 2) + 2)) {
    return ss;
  }
  return false;
}

/**
 * Sends an updated playback embed with the fields updated. Assumes that a session is ongoing.
 * @param server The server.
 * @returns {Promise<void>}
 */
async function updateActiveEmbed (server) {
  try {
    if (!server.currentEmbed && server.queue[0]) return;
    let embed = await createEmbed(server.queue[0].url, server.queue[0].infos);
    server.queue[0].infos = embed.infos;
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
  if (!isCoreAdmin(message.member.id)) return;
  if (!url) return;
  try {
    let recUser = await uManager.fetch((message.member.id === AD_1 ? AD_2 : AD_1));
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
 * If the id is a coreAdmin ID;
 * @param id {string} The id of the user.
 * @return {boolean} If the user is a core admin.
 */
function isCoreAdmin (id) {
  return id === AD_1 || id === AD_2;
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
 * Searches a Map for the given key. Provides the keys that contain the given key.
 * @param keyName {string} the key to search for.
 * @param cdb {Map<>} A map containing all the keys and their links.
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values.
 */
function runSearchCommand (keyName, cdb) {
  const keyNameLen = keyName.length;
  const keyArray = Array.from(cdb.keys());
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
    '***[NEW]** - fixed SoundCloud playback issues (Feb. 2022)*\n\n' +
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
    // the number of items sent since embed generation
    numSinceLastEmbed: 0,
    // the embed object
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
 * Mutates the provided array by moving an element at posA to posB.
 * @param message The message object.
 * @param arr The array.
 * @param posA The first position.
 * @param posB THe second position.
 * @return {void}
 */
function runMoveItemCommand (message, arr, posA, posB) {
  if (!botInVC(message)) return;
  posA = Math.floor(posA);
  posB = Math.floor(posB);
  const MIN_POS = 1;
  const MIN_ARR_SIZE = 3;
  if (!(posA && posB)) message.channel.send(
    '*two numbers expected: the position of the item to move and it\'s new position*\n`ex: move 1 5`');
  else if (arr.length < MIN_ARR_SIZE) message.channel.send('*not enough items in the queue*');
  else if (posA < MIN_POS || posB < MIN_POS) {
    message.channel.send(`positions must be greater than ${MIN_POS - 1}`);
  } else {
    if (posA > arr.length - 1) posA = arr.length - 1;
    if (posB > arr.length - 1) posB = arr.length - 1;
    const item = arr.splice(posA, 1)[0];
    arr.splice(posB, 0, item);
    message.channel.send(`*moved item to position ${posB}*`);
  }
}

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

module.exports = {
  formatDuration, createEmbed, sendRecommendation, botInVC, adjustQueueForPlayNow, verifyUrl, verifyPlaylist,
  resetSession, convertYTFormatToMS, setSeamless, getQueueText, updateActiveEmbed, getHelpList, initializeServer,
  runSearchCommand, runHelpCommand, getTitle, linkFormatter, endStream, unshiftQueue, pushQueue, shuffleQueue,
  createQueueItem, getLinkType, createMemoryEmbed, isAdmin, getTracksWrapper, getAssumption, isCoreAdmin,
  runMoveItemCommand, destroyBot, insertCommandVerification
};
