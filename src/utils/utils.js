const {getData} = require('spotify-url-info');
const {MessageEmbed} = require('discord.js');
const ytdl = require('ytdl-core-discord');
const spdl = require('spdl-core');
const ytpl = require('ytpl');
const {servers, botID} = require('./constants');

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
    return message.guild.voice && message.guild.voice.channel;
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
  if (url.toString().includes('spotify.com')) {
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
  } else {
    if (!infos) infos = await ytdl.getInfo(url);
    let duration = formatDuration(infos.formats ? infos.formats[0].approxDurationMs : 0);
    timeMS = parseInt(duration);
    if (duration === 'NaNm NaNs') {
      duration = 'N/A';
    }
    embed = new MessageEmbed()
      .setTitle(`${infos.videoDetails.title}`)
      .setURL(infos.videoDetails.video_url)
      .setColor('#c40d00')
      .addField('Duration', duration, true)
      .setThumbnail(infos.videoDetails.thumbnails[0].url);
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
  return (url.includes('spotify.com') ? spdl.validateURL(url) : ytdl.validateURL(url)) && !verifyPlaylist(url);
}

/**
 * Returns true if the given url is a valid Spotify or YouTube playlist link.
 * @param url The url to verify
 * @returns {Boolean} True if given a valid playlist URL.
 */
function verifyPlaylist (url) {
  try {
    url = url.toLowerCase();
    return (url.includes('spotify.com') ? (url.includes('/playlist') || url.includes('/album')) :
      ((url.includes('list=') || ytpl.validateID(url)) && !url.includes('&index=')));
  } catch (e) {
    return false;
  }
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
  if (server.queue[0] && dsp && dsp.streamTime && (dsp.streamTime > 21000)) {
    server.queueHistory.push(server.queue.shift());
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
 * @param url {string} The link to get the title.
 * @param cutoff {number=} A number representing the cutoff value.
 * @returns {Promise<string>} The title of the provided link.
 */
async function getTitle (url, cutoff) {
  let title;
  try {
    if (url.includes('spotify')) {
      title = (await getData(url)).name;
    } else {
      title = (await ytdl.getBasicInfo(url)).videoDetails.title;
    }
  } catch (e) {
    title = 'broken_url';
  }
  if (cutoff && title.length > cutoff) {
    title = title.substr(0, cutoff) + '...';
  }
  return title;
}

/**
 * Function to generate an array of embeds representing the help list.
 * @param {*} prefixString the prefix in string format
 * @param numOfPages the number of embeds to generate
 */
function getHelpList (prefixString, numOfPages) {
  const page1 =
    '--------------  **Music Commands** --------------\n\`' +
    prefixString +
    'play [word] \` Searches YouTube and plays *[p]* \n\`' +
    prefixString +
    'play [link] \` Play YouTube/Spotify link *[p]* \n\`' +
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
    'dj \` DJ mode, requires members to vote skip tracks\n\`' +
    prefixString +
    'dictator \` Dictator mode, one member controls all music commands\n\`' +
    prefixString +
    'verbose \` Keep all song embeds during a session\n\`' +
    prefixString +
    'silence \` Silence/hide now playing embeds \n';
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
    'search [key] \` Search keys  *[s]*\n\`' +
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
    'insert [link] [num] \` Insert a link into a position within the queue\n\`' +
    prefixString +
    'remove [num] \` Remove a link from a position in the queue\n\`' +
    prefixString +
    'ticket [message] \` report an issue / request a new feature \n' +
    '\n**Or just say congrats to a friend. I will chime in too! :) **';
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
 * Produces the help list and manages its reactions.
 * @param message The message instance.
 * @param server The server.
 */
function runHelpCommand (message, server) {
  server.numSinceLastEmbed += 10;
  let helpPages = getHelpList(server.prefix, 2);
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
    // hold a ready-to-go function in case of vc join
    seamless: {
      // the name of the type of function
      function: undefined,
      // args for the function
      args: undefined,
      // optional message to delete
      message: undefined
    },
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
  initializeServer, runSearchCommand, runHelpCommand, getTitle
};
