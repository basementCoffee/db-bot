require('dotenv').config();
const {MessageEmbed, Client} = require('discord.js');
const {gsrun, gsUpdateAdd, deleteRows, gsUpdateOverwrite} = require('./database');

const token = process.env.TOKEN.replace(/\\n/gm, '\n');

// initialization
const bot = new Client();

// YouTube imports
let ytdl = require('ytdl-core-discord');
const ytsr = require('ytsr');
const ytpl = require('ytpl');

// Genius imports
const Genius = require("genius-lyrics");
const GeniusClient = new Genius.Client();

// Spotify imports
const spdl = require('spdl-core');
const {getTracks, getData} = require("spotify-url-info");

// imports for YouTube captions
const https = require('https');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();

// UPDATE HERE - Before Git Push
let devMode = false; // default false
const version = '5.3.2';
const buildNo = '05030202'; // major, minor, patch, build
let isInactive = !devMode; // default true - (see: bot.on('ready'))
let servers = {};
// the max size of the queue
const maxQueueSize = 500;
process.setMaxListeners(0);

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
 * Determines whether the message contains a form of congratulations
 * @param message The message that the discord client is parsing
 * @returns {*} true if congrats is detected
 */
function contentContainCongrats (message) {
  return (message.content.includes('grats') || message.content.includes('gratz') ||
    message.content.includes('ongratulations'));
}

/**
 * Skips the song that is currently being played.
 * Use for specific voice channel playback.
 * @param message the message that triggered the bot
 * @param voiceChannel the voice channel that the bot is in
 * @param playMessageToChannel whether to play message on successful skip
 * @param server The server playback metadata
 * @param noHistory Optional - true excludes song from the queue history
 */
function skipSong (message, voiceChannel, playMessageToChannel, server, noHistory) {
  // if server queue is not empty
  if (server.queue.length > 0) {
    if (noHistory) server.queue.shift();
    else server.queueHistory.push(server.queue.shift());
    if (playMessageToChannel) message.channel.send('*skipped*');
    // if there is still items in the queue then play next song
    if (server.queue.length > 0) {
      // get rid of previous dispatch
      playSongToVC(message, server.queue[0], voiceChannel, true, server);
    } else {
      runStopPlayingCommand(message.guild.id, voiceChannel, true, server, message, message.member);
    }
  } else {
    runStopPlayingCommand(message.guild.id, voiceChannel, true, server, message, message.member);
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
}

/**
 * Removes an item from the database.
 * @param message the message that triggered the bot
 * @param {string} keyName the key to remove
 * @param sheetName the name of the sheet to remove from
 * @param sendMsgToChannel whether to send a response to the channel when looking for track keys
 */
async function runRemoveItemCommand (message, keyName, sheetName, sendMsgToChannel) {
  if (keyName) {
    await gsrun('A', 'B', sheetName).then(async (xdb) => {
      let couldNotFindKey = true;
      for (let i = 0; i < xdb.line.length; i++) {
        const itemToCheck = xdb.line[i];
        if (itemToCheck.toLowerCase() === keyName.toLowerCase()) {
          i += 1;
          couldNotFindKey = false;
          await gsUpdateOverwrite(-1, -1, sheetName, xdb.dsInt);
          await deleteRows(message, sheetName, i);
          if (sendMsgToChannel) {
            message.channel.send("*removed '" + itemToCheck + "'*");
          }
        }
      }
      if (couldNotFindKey && sendMsgToChannel) {
        await gsrun('A', 'B', sheetName).then(async (xdb) => {
          const foundStrings = runSearchCommand(keyName, xdb).ss;
          if (foundStrings && foundStrings.length > 0 && keyName.length > 1) {
            message.channel.send("Could not find '" + keyName + "'.\n*Did you mean: " + foundStrings + '*');
          } else {
            let dbType = "the server's";
            if (message.content.substr(1, 1).toLowerCase() === 'm') {
              dbType = 'your';
            }
            message.channel.send("*could not find '" + keyName + "' in " + dbType + ' database*');
          }
        });
      }
    });
  } else {
    if (sendMsgToChannel) {
      message.channel.send('Need to specify the key to delete.');
    }
  }
}

/**
 * Runs the play now command.
 * @param message the message that triggered the bot
 * @param args the message split into an array
 * @param mgid the message guild id
 * @param server The server playback metadata
 * @param sheetName the name of the sheet to reference
 */
async function runPlayNowCommand (message, args, mgid, server, sheetName) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.channel.send('must be in a voice channel to play');
  }
  if (server.dictator && message.member !== server.dictator)
    return message.channel.send('only the dictator can play perform this action');
  if (!args[1]) {
    return message.channel.send('What should I play now? Put a link or some words.');
  }
  // in case of force disconnect
  if (!message.guild.client.voice || !message.guild.voice || !message.guild.voice.channel) {
    server.queue = [];
    server.queueHistory = [];
  } else if (server.queue.length >= maxQueueSize) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  server.numSinceLastEmbed += 3;
  if (!ytdl.validateURL(args[1]) && !spdl.validateURL(args[1]) && !args[1].includes('spotify.com/playlist')) {
    if (sheetName) {
      return runDatabasePlayCommand(args, message, sheetName, true, false, server);
    } else {
      return runYoutubeSearch(message, args, mgid, true, server);
    }
  }
  try {
    // places the currently playing into the queue history if played long enough
    const dsp = dispatcherMap[voiceChannel.id];
    if (server.queue[0] && server.queue[0] === whatspMap[voiceChannel.id] &&
    dsp && dsp.streamTime && server.queue[0].includes('spotify.com') ? dsp.streamTime > 90000 : dsp.streamTime > 150000) {
      server.queueHistory.push(server.queue.shift());
    }
  } catch (e) {}
  let pNums = 0;
  if (args[1].includes('spotify.com/playlist')) {
    await addPlaylistToQueue(message, mgid, pNums, args[1], true, true);
  } else if (ytpl.validateID(args[1])) {
    await addPlaylistToQueue(message, mgid, pNums, args[1], false, true);
  } else {
    // push to queue
    server.queue.unshift(args[1]);
  }
  message.channel.send('*playing now*');
  playSongToVC(message, server.queue[0], voiceChannel, true, server).then();
}

/**
 *
 * @param message The message metadata
 * @param mgid The message guild id
 * @param pNums The number of items added to queue
 * @param playlistUrl The url of the playlist
 * @param isSpotify If the playlist is a spotify playlist
 * @param addToFront Optional - true if to add to the front of the queue
 * @returns {Promise<void>} The number of items added to the queue
 */
async function addPlaylistToQueue (message, mgid, pNums, playlistUrl, isSpotify, addToFront) {
  let playlist;
  try {
    if (isSpotify) {
      //playlink
      playlist = await getTracks(playlistUrl);
    } else {
      playlist = await ytpl(await ytpl.getPlaylistID(playlistUrl), {pages: 1});
      playlist = playlist.items;
    }
    let url;
    if (addToFront) {
      let itemsLeft = maxQueueSize - servers[mgid].queue.length;
      let lowestLengthIndex = Math.min(playlist.length, itemsLeft) - 1;
      let item;
      while (lowestLengthIndex > -1) {
        item = playlist[lowestLengthIndex];
        lowestLengthIndex--;
        url = isSpotify ? item.external_urls.spotify : (item.shortUrl ? item.shortUrl : item.url);
        if (itemsLeft > 0) {
          if (url) {
            servers[mgid].queue.unshift(url);
            pNums++;
            itemsLeft--;
          }
        } else {
          message.channel.send('*queue is full*');
          break;
        }
      }
    } else {
      let itemsLeft = maxQueueSize - servers[mgid].queue.length;
      for (let j of playlist) {
        url = isSpotify ? j.external_urls.spotify : (j.shortUrl ? j.shortUrl : j.url);
        if (itemsLeft > 0) {
          if (url) {
            servers[mgid].queue.push(url);
            pNums++;
            itemsLeft--;
          }
        } else {
          message.channel.send('*queue is full*');
          break;
        }
      }
    }
  } catch (e) {
    console.log(e);
    message.channel.send('there was an error');
  }
  return pNums;
}

/**
 * Runs the commands and checks to play a link
 * @param message The message that triggered the bot
 * @param args An array of given play parameters, should be links or keywords
 * @param mgid The message guild id
 * @param server The server playback metadata
 * @param sheetName The name of the sheet to reference
 */
async function runPlayLinkCommand (message, args, mgid, server, sheetName) {
  if (!message.member.voice.channel) {
    return message.channel.send("must be in a voice channel to play");
  }
  if (!args[1]) {
    if (runPlayCommand(message, message.member, server, true)) return;
    return message.channel.send('What should I play? Put a link or some words.');
  }
  if (server.dictator && message.member !== server.dictator)
    return message.channel.send('only the dictator can perform this action');
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    server.queue = [];
    server.queueHistory = [];
  } else if (server.queue.length >= maxQueueSize) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (!ytdl.validateURL(args[1]) && !spdl.validateURL(args[1]) && !verifyPlaylist(args[1])) {
    if (sheetName) {
      return runDatabasePlayCommand(args, message, sheetName, false, false, server);
    } else {
      return runYoutubeSearch(message, args, mgid, false, server);
    }
  }
  let queueWasEmpty = false;
  if (server.queue.length < 1) {
    queueWasEmpty = true;
  }
  let pNums = 0;
  if (args[1].includes('spotify.com/playlist')) {
    pNums = await addPlaylistToQueue(message, mgid, pNums, args[1], true);
  } else if (ytpl.validateID(args[1])) {
    pNums = await addPlaylistToQueue(message, mgid, pNums, args[1], false);
  } else {
    pNums = 1;
    while (args[pNums]) {
      let linkZ = args[pNums];
      if (linkZ.substring(linkZ.length - 1) === ',') {
        linkZ = linkZ.substring(0, linkZ.length - 1);
      }
      // push to queue
      server.queue.push(args[pNums]);
      pNums += 1;
    }
    // make pNums the number of added songs
    pNums--;
  }
  // if queue was empty then play
  if (queueWasEmpty) {
    playSongToVC(message, server.queue[0], message.member.voice.channel, true, server);
  } else if (pNums < 2) {
    message.channel.send('*added to queue*');
  } else {
    message.channel.send('*added ' + pNums + ' to queue*');
  }
}

/**
 * Restarts the song playing and what was within an older session.
 * @param message The message that triggered the bot
 * @param mgid The message guild id
 * @param keyword Enum in string format, being either 'restart' or 'replay'
 * @param server The server playback metadata
 * @returns {*}
 */
async function runRestartCommand (message, mgid, keyword, server) {
  if (!server.queue[0] && !server.queueHistory) return message.channel.send('must be actively playing to ' + keyword);
  if (server.dictator && message.member !== server.dictator)
    return message.channel.send('only the dictator can ' + keyword);
  if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member)) {
    return message.channel.send('as of right now, only the DJ can restart tracks');
  }
  if (server.queue[0]) {
    await playSongToVC(message, server.queue[0], message.member.voice.channel, true, server);
  } else if (server.queueHistory.length > 0) {
    server.queue.push(server.queueHistory.pop());
    await playSongToVC(message, server.queue[0], message.member.voice.channel, true, server);
  } else {
    message.channel.send('there is nothing to ' + keyword);
  }
}

/**
 * Initializes the server with all the required params.
 * @param mgid The message guild id.
 */
function initializeServer (mgid) {
  servers[mgid] = {
    queue: [],
    queueHistory: [],
    loop: false,
    collector: false,
    followUpMessage: undefined,
    currentEmbedLink: undefined,
    currentEmbed: undefined,
    numSinceLastEmbed: 0,
    currentEmbedChannelId: undefined,
    verbose: false,
    // A list of vote admins (members) in a server
    voteAdmin: [],
    voteSkipMembersId: [],
    voteRewindMembersId: [],
    votePlayPauseMembersId: [],
    // The member that is the acting dictator
    dictator: false
  };
}

/**
 * The execution for all of the bot commands
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
async function runCommandCases (message) {
  const mgid = message.guild.id;
  if (devMode) {
    if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985' && message.member.id.toString() !== '799524729173442620' && message.member.id !== '434532121244073984') {
      return; // DEBUG MODE
    }
    prefixMap[mgid] = '=';
  }
  if (servers[mgid] && servers[mgid].currentEmbedChannelId === message.channel.id && servers[mgid].numSinceLastEmbed < 10) {
    servers[mgid].numSinceLastEmbed++;
  }
  let prefixString = prefixMap[mgid];
  if (!prefixString) {
    try {
      await gsrun('A', 'B', 'prefixes').then(async (xdb) => {
        const newPrefix = xdb.congratsDatabase.get(mgid);
        if (!newPrefix) {
          prefixMap[mgid] = '.';
          await gsUpdateAdd(mgid, '.', 'A', 'B', 'prefixes', xdb.dsInt);
        } else {
          prefixMap[mgid] = newPrefix;
        }
      });
    } catch (e) {
      prefixMap[mgid] = '.';
      gsUpdateAdd(mgid, '.', 'A', 'B', 'prefixes', 1);
    }
    prefixString = prefixMap[mgid];
  }
  const firstWordBegin = message.content.substr(0, 14).trim() + ' ';
  const fwPrefix = firstWordBegin.substr(0, 1);
  if (fwPrefix !== prefixString) {
    if (fwPrefix.toUpperCase() === fwPrefix.toLowerCase() && fwPrefix.charCodeAt(0) < 120 && !devMode) {
      const fwCommand = firstWordBegin.substr(1, 13);
      if (fwPrefix === '.' && (fwCommand === 'changeprefix ' || fwCommand === 'h ' || fwCommand === 'help ')) {
        return message.channel.send('Current prefix is: ' + prefixString);
      }
      if (message.guild.me.nickname && message.guild.me.nickname.substr(0, 1) === '['
        && message.guild.me.nickname.substr(2, 1) === ']') {
        const falsePrefix = message.guild.me.nickname.substr(1, 1);
        if (fwPrefix === falsePrefix && (fwCommand === 'changeprefix ' || fwCommand === 'h ' || fwCommand === 'help ')) {
          return message.channel.send('Current prefix is: ' + prefixString);
        }
      }
    }
    if (contentContainCongrats(message)) {
      if (!servers[mgid]) {
        initializeServer(mgid);
      } else if (!message.guild.voice || !message.guild.voice.channel) {
        servers[mgid].queue = [];
        servers[mgid].queueHistory = [];
        servers[mgid].loop = false;
      }
      message.channel.send('Congratulations!').then();
      return playSongToVC(message, 'https://www.youtube.com/watch?v=oyFQVZ2h0V8', message.member.voice.channel, false, servers[mgid]);
    }
    return;
  }
  const args = message.content.replace(/\s+/g, ' ').split(' ');
  // console.log(args); // see recent bot commands within console for testing
  const statement = args[0].substr(1).toLowerCase();
  if (statement.substr(0, 1) === 'g' && statement !== 'guess') {
    if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
      return;
    }
  }
  // the server guild playback data
  if (!servers[mgid]) {
    initializeServer(mgid);
  }
  const server = servers[mgid];
  if (message.channel.id === server.currentEmbedChannelId) server.numSinceLastEmbed += 2;
  switch (statement) {
    // the normal play command
    case 'play':
    case 'p':
      runPlayLinkCommand(message, args, mgid, server, undefined);
      break;
    case 'mplay':
    case 'mp':
      runPlayLinkCommand(message, args, mgid, server, 'p' + message.member.id);
      break;
    // test purposes - play command
    case 'gplay':
    case 'gp':
      runPlayLinkCommand(message, args, mgid, server, 'entries');
      break;
    // test purposes - play now command
    case 'gpnow':
    case 'gpn':
      runPlayNowCommand(message, args, mgid, server, 'entries');
      break;
    // the play now command
    case 'pnow':
    case 'playnow':
    case 'pn':
      runPlayNowCommand(message, args, mgid, server, undefined);
      break;
    // the personal play now command
    case 'mplaynow':
    case 'mpnow':
    case 'mpn':
      runPlayNowCommand(message, args, mgid, server, 'p' + message.member.id);
      break;
    // stop session commands
    case 'quit':
    case 'leave':
    case 'end':
    case 'e':
      runStopPlayingCommand(mgid, message.member.voice.channel, false, server, message, message.member);
      break;
    case 'loop':
      if (!message.guild.voice || !message.guild.voice.channel) {
        return message.channel.send('must be playing a song to loop');
      }
      if (server.loop) {
        server.loop = false;
        message.channel.send('*looping disabled*');
      } else {
        server.loop = true;
        message.channel.send('*looping enabled*');
      }
      break;
    case 'lyric':
    case 'lyrics':
      runLyricsCommand(message, mgid, args, server);
      break;
    // test purposes - run database songs
    case 'gd':
      runDatabasePlayCommand(args, message, 'entries', false, true, server);
      break;
    // test purposes - run database command
    case 'gdnow':
    case 'gdn':
      runDatabasePlayCommand(args, message, 'entries', true, true, server);
      break;
    // test purposes - run database command
    case 'gkn':
    case 'gknow':
      runDatabasePlayCommand(args, message, 'entries', true, true, server);
      break;
    // .d is the normal play link from database command
    case 'd':
      runDatabasePlayCommand(args, message, mgid, false, false, server);
      break;
    case 'know':
    case 'kn':
    case 'dnow':
    case 'dn':
      runPlayNowCommand(message, args, mgid, server, mgid);
      break;
    // .md is retrieves and plays from the keys list
    case 'md':
      runDatabasePlayCommand(args, message, 'p' + message.member.id, false, true, server);
      break;
    // .mdnow retrieves and plays from the keys list immediately
    case 'mkn':
    case 'mknow':
    case 'mdnow':
    case 'mdn':
      runPlayNowCommand(message, args, mgid, server, 'p' + message.member.id);
      break;
    // .r is a random that works with the normal queue
    case 'rand':
    case 'r':
      runRandomToQueue(args[1], message, mgid, server);
      break;
    // test purposes - random command
    case 'grand':
    case 'gr':
      runRandomToQueue(args[1], message, 'entries', server);
      break;
    // .mr is the personal random that works with the normal queue
    case 'mrand':
    case 'mr':
      runRandomToQueue(args[1], message, 'p' + message.member.id, server);
      break;
    // .keys is server keys
    case 'k':
    case 'key':
    case 'keys':
      if (args[1]) runDatabasePlayCommand(args, message, mgid, false, false, server);
      else runKeysCommand(message, prefixString, mgid, '', '', '');
      break;
    // .mkeys is personal keys
    case 'mk':
    case 'mkey':
    case 'mkeys':
      if (args[1]) runDatabasePlayCommand(args, message, 'p' + message.member.id, false, false, server);
      else runKeysCommand(message, prefixString, 'p' + message.member.id, 'm', '', '');
      break;
    // test purposes - return keys
    case 'gk':
    case 'gkey':
    case 'gkeys':
      runKeysCommand(message, prefixString, 'entries', 'g', '', '');
      break;
    // .search is the search
    case 'search':
      if (!args[1]) {
        return message.channel.send('No argument was given.');
      }
      runUniversalSearchCommand(message, mgid, args[1]);
      break;
    // .s prints out the db size or searches
    case 's':
      if (!args[1]) {
        return gsrun('A', 'B', mgid).then((xdb) =>
          message.channel.send('Server list size: ' + Array.from(xdb.congratsDatabase.keys()).length)
        );
      }
      runUniversalSearchCommand(message, mgid, args[1]);
      break;
    case 'size':
      if (!args[1]) {
        return gsrun('A', 'B', mgid).then((xdb) =>
          message.channel.send('Server list size: ' + (xdb.dsInt - 1))
        );
      }
      break;
    case 'msize':
      if (!args[1]) {
        return gsrun('A', 'B', 'p' + message.member.id).then((xdb) =>
          message.channel.send('Personal list size: ' + (xdb.dsInt - 1))
        );
      }
      break;
    // .m is the personal search command
    case 'msearch':
      if (!args[1]) {
        return message.channel.send('No argument was given.');
      }
      gsrun('A', 'B', 'p' + message.member.id).then((xdb) => {
        const ss = runSearchCommand(args[1], xdb).ss;
        if (ss && ss.length > 0) {
          message.channel.send('Keys found: ' + ss);
        } else {
          message.channel.send('Could not find any keys in your list that start with the given letters.');
        }
      });
      break;
    case 'ms':
      if (!args[1]) {
        return gsrun('A', 'B', 'p' + message.member.id).then((xdb) =>
          message.channel.send('Personal list size: ' + Array.from(xdb.congratsDatabase.keys()).length)
        );
      }
      gsrun('A', 'B', 'p' + message.member.id).then((xdb) => {
        const ss = runSearchCommand(args[1], xdb).ss;
        if (ss && ss.length > 0) {
          message.channel.send('Keys found: ' + ss);
        } else {
          message.channel.send(
            'Could not find any keys in your list that start with the given letters.'
          );
        }
      });
      break;
    case 'gs':
      if (!args[1]) {
        return gsrun('A', 'B', 'p' + message.member.id).then((xdb) =>
          message.channel.send('Global list size: ' + Array.from(xdb.congratsDatabase.keys()).length)
        );
      }
      gsrun('A', 'B', 'entries').then((xdb) => {
        ss = runSearchCommand(args[1], xdb).ss;
        if (ss && ss.length > 0) {
          message.channel.send('Keys found: ' + ss);
        } else {
          message.channel.send(
            'Could not find any keys that start with the given letters.'
          );
        }
      });
      break;
    // !? is the command for what's playing?
    case 'current':
    case '?':
    case 'np':
    case 'nowplaying':
    case 'playing':
    case 'what':
    case 'now':
      await runWhatsPCommand(message, message.member.voice.channel, args[1], mgid, '');
      break;
    case 'g?':
      await runWhatsPCommand(message, message.member.voice.channel, args[1], 'entries', 'g');
      break;
    case 'm?':
      await runWhatsPCommand(message, message.member.voice.channel, args[1], 'p' + message.member.id, 'm');
      break;
    case 'gurl':
    case 'glink':
      if (!args[1]) {
        if (server.queue[0] && message.member.voice.channel) {
          return message.channel.send(server.queue[0]);
        }
      }
      await runWhatsPCommand(message, message.member.voice.channel, args[1], 'entries', 'g');
      break;
    case 'url':
    case 'link':
      if (!args[1]) {
        if (server.queue[0] && message.member.voice.channel) {
          return message.channel.send(server.queue[0]);
        }
      }
      await runWhatsPCommand(message, message.member.voice.channel, args[1], mgid, '');
      break;
    case 'murl':
    case 'mlink':
      if (!args[1]) {
        if (server.queue[0] && message.member.voice.channel) {
          return message.channel.send(server.queue[0]);
        }
      }
      await runWhatsPCommand(message, message.member.voice.channel, args[1], 'p' + message.member.id, 'm');
      break;
    case 'q':
      runQueueCommand(message, mgid, true);
      break;
    case 'que':
    case 'list':
    case 'upnext':
    case 'queue':
      runQueueCommand(message, mgid);
      break;
    case 'changeprefix':
      if (!message.member.hasPermission('KICK_MEMBERS')) {
        return message.channel.send('Permissions Error: Only members who can kick other members can change the prefix.');
      }
      if (!args[1]) {
        return message.channel.send('No argument was given. Enter the new prefix after the command.');
      }
      if (args[1].length > 1) {
        return message.channel.send('Prefix length cannot be greater than 1.');
      }
      if (args[1] === '+' || args[1] === '=' || args[1] === '\'') {
        return message.channel.send('Cannot have ' + args[1] + ' as a prefix.');
      }
      if (args[1].toUpperCase() !== args[1].toLowerCase() || args[1].charCodeAt(0) > 126) {
        return message.channel.send("cannot have a letter as a prefix.");
      }
      args[2] = args[1];
      args[1] = mgid;
      message.channel.send('*changing prefix...*').then(async sentPrefixMsg => {
        await gsrun('A', 'B', 'prefixes').then(async () => {
          await runRemoveItemCommand(message, args[1], 'prefixes', false);
          await runAddCommand(args, message, 'prefixes', false);
          await gsrun('A', 'B', 'prefixes').then(async (xdb) => {
            await gsUpdateOverwrite(xdb.congratsDatabase.size + 2, 1, 'prefixes', xdb.dsInt);
            prefixMap[mgid] = args[2];
            message.channel.send('Prefix successfully changed to ' + args[2]);
            prefixString = '\\' + args[2];
            sentPrefixMsg.delete();
            let name = 'db bot';
            if (message.guild.me.nickname) {
              name = message.guild.me.nickname.substring(message.guild.me.nickname.indexOf(']') + 1);
            }

            async function changeNamePrefix () {
              if (!message.guild.me.nickname) {
                await message.guild.me.setNickname('[' + prefixString + '] ' + "db bot");
              } else if (message.guild.me.nickname.indexOf('[') > -1 && message.guild.me.nickname.indexOf(']') > -1) {
                await message.guild.me.setNickname('[' + prefixString + '] ' + message.guild.me.nickname.substring(message.guild.me.nickname.indexOf(']') + 2));
              } else {
                await message.guild.me.setNickname('[' + prefixString + '] ' + message.guild.me.nickname);
              }
            }

            if (!message.guild.me.nickname || (message.guild.me.nickname.substr(0, 1) !== '[' && message.guild.me.nickname.substr(2, 1) !== ']')) {
              message.channel.send('----------------------\nWould you like me to update my name to reflect this? (yes or no)\nFrom **' +
                (message.guild.me.nickname || 'db bot') + '**  -->  **[' + prefixString + '] ' + name + '**').then(() => {
                const filter = m => message.author.id === m.author.id;

                message.channel.awaitMessages(filter, {time: 30000, max: 1, errors: ['time']})
                  .then(async messages => {
                    // message.channel.send(`You've entered: ${messages.first().content}`);
                    if (messages.first().content.toLowerCase() === 'yes' || messages.first().content.toLowerCase() === 'y') {
                      await changeNamePrefix();
                      message.channel.send('name has been updated, prefix is: ' + prefixString);
                    } else {
                      message.channel.send('name remains the same, prefix is: ' + prefixString);
                    }
                  })
                  .catch(() => {
                    message.channel.send('name remains the same, prefix is: ' + prefixString);
                  });
              });
            } else if (message.guild.me.nickname.substr(0, 1) === '[' && message.guild.me.nickname.substr(2, 1) === ']') {
              await changeNamePrefix();
            }
          });
        });
      });
      break;
    // list commands for public commands
    case 'h':
    case 'help':
      server.numSinceLastEmbed += 10;
      sendHelp(message, prefixString);
      break;
    // !skip
    case 'sk':
    case 'skip':
      runSkipCommand(message, message.member.voice.channel, server, args[1], true, false, message.member);
      break;
    case 'dic' :
    case 'dict' :
    case 'dictator' :
      runDictatorCommand(message, mgid, prefixString, server);
      break;
    case 'vote':
    case 'dj':
      runDJCommand(message, server);
      break;
    case 'fs' :
    case 'forceskip' :
      if (hasDJPermissions(message, message.member, true)) {
        runSkipCommand(message, message.member.voice.channel, server, args[1], true, true, message.member);
      }
      break;
    case 'fr':
    case 'frw':
    case 'forcerewind':
      if (hasDJPermissions(message, message.member, true)) {
        runRewindCommand(message, mgid, message.member.voice.channel, args[1], true, false, message.member, server);
      }
      break;
    case 'fp':
      if (hasDJPermissions(message, message.member, true)) {
        message.channel.send('use \'fpl\' to force play and \'fpa\' to force pause.');
      }
      break;
    case 'fpl' :
    case 'forceplay' :
      if (hasDJPermissions(message, message.member, true)) {
        runPlayCommand(message, message.member, server, false, true);
      }
      break;
    case 'fpa' :
    case 'forcepause' :
      if (hasDJPermissions(message, message.member, true)) {
        runPauseCommand(message, message.member, server, false, true);
      }
      break;
    case 'resign':
      if (!server.voteAdmin.length && !server.dictator) {
        message.channel.send('There is no DJ or dictator right now');
      } else if (server.dictator) {
        if (message.member === server.dictator) {
          server.dictator = false;
          message.channel.send((message.member.nickname ? message.member.nickname : message.member.user.username) +
            ' has resigned from being the dictator!');
        } else {
          message.channel.send('Only the dictator can resign');
        }
      } else if (server.voteAdmin[0] === message.member) {
        server.voteAdmin.pop();
        let resignMsg = (message.member.nickname ? message.member.nickname : message.member.user.username) +
          ' has resigned from being DJ.';
        if (server.voteAdmin.length < 1) {
          server.voteSkipMembersId = [];
          server.voteRewindMembersId = [];
          server.votePlayPauseMembersId = [];
          resignMsg += ' DJ mode is disabled.';
        }
        message.channel.send(resignMsg);
      } else {
        message.channel.send('Only the DJ can resign');
      }
      break;
    // !pa
    case 'pa':
    case 'stop':
    case 'pause':
      runPauseCommand(message, message.member, server);
      break;
    // !pl
    case 'pl':
    case 'res':
    case 'resume':
      runPlayCommand(message, message.member, server);
      break;
    case 'ts':
    case 'time':
    case 'timestamp':
      if (dispatcherMap[message.member.voice.channel.id]) {
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      }
      break;
    case 'verbose':
      if (!server.verbose) {
        server.verbose = true;
        message.channel.send('***verbose mode enabled***, *embeds will be kept during this listening session*');
      } else {
        server.verbose = false;
        message.channel.send('***verbose mode disabled***');
      }
      break;
    case 'unverbose':
      if (!server.verbose) {
        message.channel.send('*verbose mode is not currently enabled*');
      } else {
        server.verbose = false;
        message.channel.send('***verbose mode disabled***');
      }
      break;
    case 'devadd':
      if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
        return;
      }
      message.channel.send(
        "Here's the dev docs:\n" +
        "<https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622>"
      );
      break;
    // TEST - .ga adds to the server database
    case 'ga':
    case 'gadd':
      runAddCommandWrapper(message, args, 'entries', true, prefixString);
      break;
    // .a is normal add
    case 'a':
    case 'add':
      runAddCommandWrapper(message, args, mgid, true, prefixString);
      break;
    // .ma is personal add
    case 'ma':
    case 'madd':
      runAddCommandWrapper(message, args, 'p' + message.member.id, true, prefixString);
      break;
    // .rm removes database entries
    case 'rm':
    case 'remove':
      runRemoveItemCommand(message, args[1], mgid, true).catch((e) => console.log(e));
      break;
    // test remove database entries
    case 'grm':
      runRemoveItemCommand(message, args[1], 'entries', true).catch((e) => console.log(e));
      break;
    // .mrm removes personal database entries
    case 'mrm':
    case 'mremove':
      runRemoveItemCommand(message, args[1], 'p' + message.member.id, true).catch((e) => console.log(e));
      break;
    case 'rw':
    case 'rewind':
      runRewindCommand(message, mgid, message.member.voice.channel, args[1], false, false, message.member, server);
      break;
    case 'rp':
    case 'replay':
      runRestartCommand(message, mgid, 'replay', server);
      break;
    case 'rs':
    case 'restart':
      runRestartCommand(message, mgid, 'restart', server);
      break;
    case 'clear' :
      if (!message.member.voice.channel) return message.channel.send('must be in a voice channel to clear');
      if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member))
        return message.channel.send('only the DJ can clear the queue');
      if (server.dictator && server.dictator !== message.member)
        return message.channel.send('only the Dictator can clear the queue');
      const currentSong =
        (dispatcherMap[message.member.voice.channel.id] && message.guild.voice && message.guild.voice.channel)
          ? server.queue[0] : undefined;
      server.queue = [];
      server.queueHistory = [];
      message.channel.send('The queue has been scrubbed clean');
      if (currentSong) {
        server.queue[0] = currentSong;
        message.channel.send('queue size: 1');
        await runWhatsPCommand(message, message.member.voice.channel, undefined);
      } else {
        server.currentEmbedLink = false;
        whatspMap[message.member.voice.channel.id] = false;
      }
      break;
    case 'inv':
    case 'invite':
      message.channel.send("Here's the invite link!\n<https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot>");
      break;
    case 'hide':
    case 'silence':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to silence');
      }
      if (server.silence) {
        return message.channel.send('*song notifications already silenced, use \'unsilence\' to unsilence.*');
      }
      server.silence = true;
      message.channel.send('*song notifications silenced for this session*');
      break;
    case 'unhide':
    case 'unsilence':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to unsilence');
      }
      if (!server.silence) {
        return message.channel.send('*song notifications already unsilenced*');
      }
      server.silence = false;
      message.channel.send('*song notifications enabled*');
      if (dispatcherMap[message.member.voice.channel.id]) {
        sendLinkAsEmbed(message, whatspMap[message.member.voice.channel.id], message.member.voice.channel, server).then();
      }
      break;
    case 'l':
      if (!message.guild.voice || !message.guild.voice.channel) {
        return;
      }
      if (server.loop) {
        server.loop = false;
        message.channel.send('*looping disabled*');
      } else {
        server.loop = true;
        message.channel.send('*looping enabled*');
      }
      break;
    // print out the version number
    case 'version':
    case 'v':
      const vEmbed = new MessageEmbed();
      vEmbed.setTitle('Version').setDescription('[' + version + '](https://github.com/Reply2Zain/db-bot)');
      message.channel.send(vEmbed);
      break;
    // dev commands for testing purposes
    case 'gzh':
      const devCEmbed = new MessageEmbed()
        .setTitle('Dev Commands')
        .setDescription(
          prefixString + 'gzs - statistics' +
          '\n' + prefixString + 'gzid - user, bot, and guild id' +
          '\n' + prefixString + 'gzq - quit/restarts the active bot' +
          '\n' + prefixString + 'gzm update - sends a message to all active guilds that the bot will be updating' +
          '\n\n**calibrate multiple bots**' +
          '\n=gzl - return the bot\'s ping and latency' +
          '\n=gzk - start/kill a process' +
          '\n=gzd - toggle dev mode' +
          '\n=gzc - ensure no two bots are on at the same time\n*(do not call gzc more than once within 5 minutes)*'
        )
        .setFooter('version: ' + version);
      message.channel.send(devCEmbed);
      break;
    case 'gzq':
      message.channel.send("restarting the bot... (may only shutdown)").then(process.exit());
      break;
    case 'gzid':
      message.channel.send('guild id: ' + message.guild.id + '\nbot id: ' + bot.user.id +
        '\nyour id: ' + message.member.id);
      break;
    case 'gzs':
      const embed = new MessageEmbed()
        .setTitle('db bot - statistics')
        .setDescription('version: ' + version +
          '\nbuild: ' + buildNo +
          '\nservers: ' + bot.guilds.cache.size +
          '\nuptime: ' + formatDuration(bot.uptime) +
          '\nup since: ' + bot.readyAt.toString().substr(0, 21) +
          '\nactive voice channels: ' + bot.voice.connections.size
        );
      message.channel.send(embed);
      break;
    case 'gzr':
      if (!args[1] || !parseInt(args[1])) return;
      sendMessageToUser(message, args[1], undefined);
      break;
    case 'gzm' :
      if (!args[1]) {
        message.channel.send('active process #' + process.pid.toString() + ' is in ' + bot.voice.connections.size + ' servers.');
        break;
      } else if (args[1] === 'update') {
        if (process.pid === 4 || (args[2] && args[2] === 'force')) {
          bot.voice.connections.map(x => bot.channels.cache.get(x.channel.guild.systemChannelID).send('db bot is about to be updated. This may lead to a temporary interruption.'));
          message.channel.send('Update message sent to ' + bot.voice.connections.size + ' channels.');
        } else {
          message.channel.send('The active bot is not running on Heroku so a git push would not interrupt listening.\n' +
            'To still send out an update use \'gzm update force\'');
        }
      } else if (args[1] === 'listu') {
        let gx = '';
        let tgx;
        let tempSet = new Set();
        bot.voice.connections.forEach(x => {
          tgx = '';
          tempSet.clear();
          x.channel.guild.voice.channel.members.map(y => tempSet.add(y.user.username));
          tempSet.forEach(z => tgx += z + ', ');
          tgx = tgx.substring(0, tgx.length - 2);
          gx += x.channel.guild.name + ': *' + tgx + '*\n';
        });
        if (gx) message.channel.send(gx);
        else message.channel.send('none found');
      }
      break;
    // !rand
    case 'guess':
      if (args[1]) {
        const numToCheck = parseInt(args[1]);
        if (!numToCheck || numToCheck < 1) {
          return message.channel.send('Number has to be positive.');
        }
        const randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
        message.channel.send('Assuming ' + numToCheck + ' in total. Your number is ' + randomInt2 + '.');
      } else {
        if (message.member && message.member.voice && message.member.voice.channel) {
          const numToCheck = message.member.voice.channel.members.size;
          if (numToCheck < 1) {
            return message.channel.send('Need at least 1 person in a voice channel.');
          }
          const randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
          const person = message.member.voice.channel.members.array()[randomInt2 - 1];
          message.channel.send(
            '**Voice channel size: ' + numToCheck + '**\nRandom number: \`' + randomInt2 + '\`\n' +
            'Random person: \`' + (person.nickname ? person.nickname : person.user.username) + '\`');
        } else {
          message.channel.send('need to be in a voice channel for this command');
        }
      }
      break;
  }
}

bot.on('guildCreate', guild => {
  if (isInactive) return;
  guild.systemChannel.send("Thanks for adding me :) \nType '.help' to see my commands.");
});

bot.once('ready', () => {
  // if (!devMode && !isInactive) bot.channels.cache.get("827195452507160627").send("=gzc");
  // bot starts up as inactive, if no response from the channel then activates itself
  if (!devMode) {
    bot.user.setActivity('[ .help ]', {type: 'WATCHING'}).then();
    mainActiveTimer = setInterval(checkToSeeActive, mainTimerTimeout);
    bot.channels.cache.get('827195452507160627').send('starting up: ' + process.pid);
    if (isInactive) {
      console.log('-starting up sidelined-');
      console.log('checking status of other bots...');
      checkToSeeActive();
    } else {
      bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
    }
  } else {
    console.log('-devmode enabled-');
  }
});
const setOfBotsOn = new Set();
// calibrate on startup
bot.on('message', async (message) => {
  if (devMode) return;
  // turn off active bots -- activates on '~db-bot-process'
  if (message.content.substr(0, 15) === '~db-bot-process' &&
    message.member.id.toString() === '730350452268597300' && !devMode) {
    // if seeing bots that are on
    if (message.content.substr(15, 3) === '-on') {
      const oBuildNo = message.content.substr(18, 8);
      // if the other bot's version number is less than this bot's then turn the other bot off
      if (parseInt(oBuildNo) >= buildNo) {
        setOfBotsOn.add(oBuildNo);
      }
    } else if (!isInactive) {
      console.log('calibrating...');
      const oBuildNo = message.content.substr(15, 8);
      if (parseInt(oBuildNo) > parseInt(buildNo)) {
        isInactive = true;
        return console.log('-sidelined(1)-');
      } else if (parseInt(oBuildNo) === parseInt(buildNo) && parseInt(message.content.substr(message.content.lastIndexOf('ver') + 3, 10)) > process.pid) {
        isInactive = true;
        return console.log('-sidelined(2)-');
      }
    }
  }
});

const mainTimerTimeout = 600000;
let mainActiveTimer;
let resHandlerTimer;

/**
 * Sends a message to a shared channel to see all active processes, responds accordingly using responseHandler.
 */
function checkToSeeActive () {
  if (devMode) return;
  setOfBotsOn.clear();
  // see if any bots are active
  bot.channels.cache.get('827195452507160627').send('=gzk').then(() => {
    resHandlerTimer = setInterval(responseHandler, 9000);
  });
}

/**
 * Returns whether a given URL is valid. Also sends an appropriate error
 * message to the channel if the link were to be invalid.
 * @param message The message that triggered the bot
 * @param url The url to verify
 * @returns {boolean} True if the bot was able to verify the link
 */
function verifyUrl (message, url) {
  if (!url.includes('.')) {
    message.channel.send('You can only add links to the database. (Names cannot be more than one word)');
    return false;
  }
  if (url.includes('spotify.com') ? (!spdl.validateURL(url) && !url.includes('.com/playlist'))
    : (!ytdl.validateURL(url) && !ytpl.validateID(url))) {
    message.channel.send('Invalid link');
    return false;
  }
  return true;
}

/**
 * Returns true if the given url is a valid Spotify or YouTube playlist link.
 * @param url The url to verify
 * @returns {*|boolean}
 */
function verifyPlaylist (url) {
  try {
    url = url.toLowerCase();
    return url.includes('spotify.com/playlist') || (ytpl.validateID(url) && !url.includes('&index='));
  } catch (e) {
    return false;
  }
}

/**
 * Checks the status of ytdl-core-discord and exits the active process if the test link is unplayable.
 */
function checkStatusOfYtdl () {
  bot.channels.cache.get('833458014124113991').join().then(async (connection) => {
    try {
      connection.play(await ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {}), {
        type: 'opus',
        filter: 'audioonly',
        quality: '140',
        volume: false
      });
      const verifyPlaying = setInterval(() => {
        clearInterval(verifyPlaying);
        connection.disconnect();
      }, 6000);
    } catch (e) {
      await bot.channels.cache.get('827195452507160627').send('=gzk');
      await bot.channels.cache.get('826195051188191293').send('ytdl status was unhealthy, shutting off bot');
      process.exit(0);
    }
  });
}

/**
 * Check to see if there was a response. If not then makes the current bot active.
 * @returns {boolean} if there was an initial response
 */
function responseHandler () {
  clearInterval(resHandlerTimer);
  if (setOfBotsOn.size < 1) {
    isInactive = false;
    devMode = false;
    bot.channels.cache.get('827195452507160627').send('=gzk').then(() => {
      console.log('-active-');
      servers = {};
      const waitForFollowup = setInterval(() => {
        clearInterval(waitForFollowup);
        bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
        checkStatusOfYtdl();
      }, 2500);
    });
  } else if (setOfBotsOn.size > 1) {
    setOfBotsOn.clear();
    bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
  }
}

// parses message, provides a response
bot.on('message', async (message) => {
  if (message.content.substr(0, 2) === '=g' &&
    (message.member.id === '730350452268597300' ||
      message.member.id === '443150640823271436' ||
      message.member.id === '268554823283113985')) {
    const zmsg = message.content.substr(2, 2);
    if (zmsg === 'zk') {
      if (message.member.id === '730350452268597300') {
        if (!isInactive && !devMode) {
          message.channel.send('~db-bot-process-on' + buildNo + 'ver' + process.pid);
        }
        return;
      }
      const zargs = message.content.split(' ');
      if (!zargs[1]) {
        let dm;
        if (devMode) {
          dm = ' (dev mode)';
        } else {
          dm = bot.voice.connections.size ? ' (VCs: ' + bot.voice.connections.size + ')' : '';
        }
        message.channel.send((isInactive ? 'sidelined: ' : (devMode ? 'active: ' : '**active: **')) + process.pid +
          ' (' + version + ')' + dm);
      } else if (zargs[1] === 'all') {
        isInactive = true;
        message.channel.send('db bot ' + process.pid + ' has been sidelined');
      } else {
        let i = 1;
        while (zargs[i]) {
          if (zargs[i].replace(/,/g, '') === process.pid.toString()) {
            isInactive = !isInactive;
            message.channel.send('db bot ' + process.pid + (isInactive ? ' has been sidelined' : ' is now active'));
            console.log((isInactive ? '-sidelined-' : '-active-'));
            return;
          }
          i++;
        }
      }
      return;
    } else if (zmsg === 'zc') {
      if (!devMode) {
        if (message.member.id !== '730350452268597300') {
          await message.channel.send((isInactive ? 'inactive' : 'active') +
            ' bot #' + process.pid + ' (' + version + ') ' +
            ' **is calibrating...** (may take up to 30 seconds)');
        }
        bot.channels.cache.get('827195452507160627').send('~db-bot-process' + buildNo + 'ver' + process.pid);
      }
    } else if (zmsg === 'zd') {
      const zargs = message.content.split(' ');
      let activeStatus = 'active';
      if (isInactive) {
        activeStatus = 'inactive';
      }
      if (!zargs[1]) {
        return message.channel.send(activeStatus + ' bot id: ' + process.pid.toString() +
          ' (' + 'dev mode: ' + devMode + ')');
      }
      if (devMode && zargs[1] === process.pid.toString()) {
        devMode = false;
        prefixMap[message.guild.id] = undefined;
        return message.channel.send('*devmode is off* ' + process.pid.toString());
      } else if (zargs[1] === process.pid.toString()) {
        devMode = true;
        prefixMap[message.guild.id] = '=';
        return message.channel.send('*devmode is on* ' + process.pid.toString());
      }
    } else if (zmsg === 'zl') {
      return message.channel.send(process.pid.toString() +
        `: Latency is ${Date.now() - message.createdTimestamp}ms.\nNetwork latency is ${Math.round(bot.ws.ping)}ms`);
    }
  }
  if (message.author.bot || isInactive) {
    return;
  }
  if (message.channel.type === 'dm') {
    const mb = '📤';
    bot.channels.cache.get('840420205867302933')
      .send('------------------------------------------\n' +
        '**From: ' + message.author.username + '** (' + message.author.id + ')\n' +
        message.content + '\n------------------------------------------').then(msg => {
      msg.react(mb);
      const filter = (reaction, user) => {
        return user.id !== bot.user.id;
      };

      const collector = msg.createReactionCollector(filter, {time: 86400000});

      collector.on('collect', (reaction, user) => {
        if (reaction.emoji.name === mb) {
          sendMessageToUser(msg, message.author.id, user.id);
          reaction.users.remove(user);
        }
      });
      collector.once('end', () => {
        msg.reactions.cache.get(mb).remove();
      });
    });
    if (message.content.substr(1, 6) === 'invite' || message.content.substr(0, 6) === 'invite') {
      message.channel.send('Here\'s the invite link!\n<https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot>').then();
    }
  } else {
    return runCommandCases(message);
  }
});

/**
 * Verifies if a member is a vote admin (DJ moderator) or has the same permissions as a vote admin.
 * @param message The message metadata
 * @param member The member metadata of the user to verify
 * @param printErrMsg True if to print an error if the user is not a vote admin
 * @returns {boolean} Returns true if the member has DJ permissions.
 */
function hasDJPermissions (message, member, printErrMsg) {
  if (!servers[message.guild.id].voteAdmin || servers[message.guild.id].voteAdmin.includes(member)) {
    return true;
  } else if (printErrMsg) {
    message.channel.send('*you do not have the necessary permissions to perform this action*');
  }
  return false;
}

/**
 * Pauses the now playing, if playing.
 * @param message The message content metadata
 * @param actionUser The user that is performing the action
 * @param server The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
 */

function runPauseCommand (message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  if (actionUser.voice && message.guild.voice && message.guild.voice.channel &&
    dispatcherMap[actionUser.voice.channel.id]) {
    if (server.dictator && actionUser !== server.dictator)
      return message.channel.send('only the dictator can pause');
    let cmdResponse = '*paused*';
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        const vs = voteSystem(message, message.guild.id, 'pause', actionUser, server.votePlayPauseMembersId);
        server.votePlayPauseMembersId = vs.votes;
        if (vs.bool) {
          cmdResponse = '***Pausing with ' + vs.votesNow + ' vote' + (vs.votesNow > 1 ? 's' : '') + '***';
          server.votePlayPauseMembersId = [];
        } else return true;
      }
    }
    dispatcherMap[actionUser.voice.channel.id].pause();
    dispatcherMap[actionUser.voice.channel.id].resume();
    dispatcherMap[actionUser.voice.channel.id].pause();
    dispatcherMapStatus[actionUser.voice.channel.id] = true;
    if (noPrintMsg && cmdResponse === '*paused*') return true;
    message.channel.send(cmdResponse);
    return true;
  } else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    return false;
  }
}

/**
 * Plays the now playing if paused.
 * @param message The message content metadata
 * @param actionUser The user that is performing the action
 * @param server The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
 */
function runPlayCommand (message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  if (actionUser.voice && message.guild.voice && message.guild.voice.channel &&
    dispatcherMap[actionUser.voice.channel.id]) {
    if (server.dictator && actionUser !== server.dictator)
      return message.channel.send('only the dictator can play');
    let cmdResponse = '*playing*';
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        const vs = voteSystem(message, message.guild.id, 'play', actionUser, server.votePlayPauseMembersId);
        server.votePlayPauseMembersId = vs.votes;
        if (vs.bool) {
          cmdResponse = '***Playing with ' + vs.votesNow + ' vote' + (vs.votesNow > 1 ? 's' : '') + '***';
          server.votePlayPauseMembersId = [];
        } else return true;
      }
    }
    dispatcherMap[actionUser.voice.channel.id].resume();
    dispatcherMap[actionUser.voice.channel.id].pause();
    dispatcherMap[actionUser.voice.channel.id].resume();
    dispatcherMapStatus[actionUser.voice.channel.id] = false;
    if (noPrintMsg && cmdResponse === '*playing*') return true;
    message.channel.send(cmdResponse);
    return true;
  } else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    return false;
  }
}

/**
 * Prompts the text channel for a response to forward to the given user.
 * @param message The original message that activates the bot.
 * @param userID The ID of the user to forward the message to.
 * @param reactionUserID Optional - The ID of a user who can reply to the prompt besides the message author
 */
function sendMessageToUser (message, userID, reactionUserID) {
  const user = bot.users.cache.get(userID);
  message.channel.send('What would you like me to send to ' + user.username +
    '? (type \'cancel\' to not send anything)').then(msg => {
    const filter = m => {
      return ((message.author.id === m.author.id || reactionUserID === m.author.id) && m.author.id !== bot.user.id);
    };
    message.channel.awaitMessages(filter, {time: 60000, max: 1, errors: ['time']})
      .then(messages => {
        if (messages.first().content && messages.first().content.trim() !== 'cancel') {
          user.send(messages.first().content).then(() => {
            message.channel.send('Message sent to ' + user.username + '.');
            message.react('✅').then();
          });
        } else if (messages.first().content.trim() === 'cancel') {
          message.channel.send('No message sent.');
        }
        msg.delete();
      }).catch(() => {
      message.channel.send('No message sent.');
      msg.delete();
    });
  });
}

/**
 * Run the command to enable a music mode allowing only one user to control music commands in a server.
 * @param message The message metadata
 * @param mgid The message guild id
 * @param prefixString The prefix string for the guild
 * @param server The server playback metadata
 * @returns {*}
 */
function runDictatorCommand (message, mgid, prefixString, server) {
  if (!message.guild.voice || !message.guild.voice.channel || !message.member.voice || !message.member.voice.channel)
    return message.channel.send('must be in a voice channel with the db bot for this command');
  const vcMembersId = message.guild.voice.channel.members.map(x => x.id);
  if (!vcMembersId.includes(message.member.id)) return message.channel.send('must be in a voice channel with db bot for this command');
  if (server.voteAdmin.length > 0)
    return message.channel.send('cannot have a dictator while there is a DJ');
  if (server.dictator) {
    if (server.dictator === message.member) {
      message.channel.send('**you are the dictator.** If you want to forfeit your powers say \`' + prefixString + 'resign\`');
    } else {
      const dic = server.dictator;
      for (let i of vcMembersId) {
        if (i === dic.id) {
          return message.channel.send((dic.nickname ? dic.nickname : dic.user.username) + ' is the dictator, and has control over '
            + (message.guild.me.nickname ? message.guild.me.nickname : message.guild.me.user.username));
        }
      }
      server.dictator = message.member;
      message.channel.send('The dictator is missing! ***' + (message.member.nickname ?
        message.member.nickname : message.member.user.username) + ' is now the new dictator.***');
    }
  } else {
    server.dictator = message.member;
    const dicEmbed = new MessageEmbed();
    dicEmbed.setTitle('Dictator Commands')
      .setDescription('\`resign\` - forfeit being dictator')
      .setFooter('The dictator has control over all music commands for the session. Enjoy!');
    message.channel.send('***' + (message.member.nickname ?
      message.member.nickname : message.member.user.username) + ', you are the dictator. (BETA)***')
      .then(message.channel.send(dicEmbed));
  }
}

/**
 * Handles the validation and provision of DJ permissions to members within a server.
 * @param message The message metadata
 * @param server The server playback metadata
 * @returns {*}
 */
function runDJCommand (message, server) {
  if (!message.guild.voice || !message.guild.voice.channel || !message.member.voice || !message.member.voice.channel)
    return message.channel.send('must be in a voice channel with the db bot for this command');
  const vcMembersId = message.guild.voice.channel.members.map(x => x.id);
  if (!vcMembersId.includes(message.member.id)) return message.channel.send('must be in a voice channel with db bot for this command');
  if (server.dictator) return message.channel.send('There is a dictator, cannot enable DJ mode.');
  if (server.voteAdmin.length < 1) {
    server.voteAdmin.push(message.member);
    const dj = (message.member.nickname ? message.member.nickname : message.member.user.username);
    message.channel.send('***DJ mode has been enabled for this session (DJ: ' + dj + ') (BETA)***');
    const msgEmbed = new MessageEmbed();
    msgEmbed.setTitle('DJ Commands').setDescription('\`forceskip\` - force skip a track [fs]\n' +
      '\`forcerewind\`- force rewind a track [fr]\n' +
      '\`force[play/pause]\` - force play/pause a track f[pl/pa]\n' +
      '\`resign\` - forfeit DJ permissions')
      .setFooter('DJ mode requires users to vote to skip, rewind, play, and pause tracks. ' +
        'The DJ can override voting by using the force commands above.');
    message.channel.send(msgEmbed);
  } else {
    let ix = 0;
    for (let x of server.voteAdmin) {
      if (!vcMembersId.includes(x.id)) {
        let oldMem = server.voteAdmin[ix];
        oldMem = (oldMem.nickname ? oldMem.nickname : oldMem.user.username);
        let newMem = message.member;
        server.voteAdmin[ix] = message.member;
        newMem = (newMem.nickname ? newMem.nickname : newMem.user.username);
        message.channel.send('*DJ ' + oldMem + ' is missing.* ***' + newMem + ' is now the new DJ.***');
        const msgEmbed = new MessageEmbed();
        msgEmbed.setTitle('DJ Commands').setDescription('\`forceskip\` - force skip a track [fs]\n' +
          '\`forcerewind\`- force rewind a track [fr]\n' +
          '\`force[play/pause]\` - force play/pause a track f[pl/pa]\n' +
          '\`resign\` - forfeit DJ permissions')
          .setFooter('DJ mode requires users to vote to skip, rewind, play, and pause tracks. ' +
            'The DJ can override voting by using the force commands above.');
        return message.channel.send(msgEmbed);
      }
      ix++;
    }
    const currentAdmin = server.voteAdmin[0];
    message.channel.send((currentAdmin.nickname ? currentAdmin.nickname : currentAdmin.user.username) + ' is ' +
      'the DJ. Any skip, rewind, play, or pause command can be used to vote for that action.');
  }
}

/**
 * Returns lyrics for what is currently playing in a server.
 * @param message The message metadata
 * @param mgid The message guild id
 * @param args The args with the message content
 * @param server The server playback metadata
 * @returns {*}
 */
function runLyricsCommand (message, mgid, args, server) {
  if ((!message.guild.voice || !message.guild.voice.channel || !server.queue[0]) && !args[1]) {
    return message.channel.send('must be playing a song');
  }
  message.channel.send('retrieving lyrics...').then(async sentMsg => {
    server.numSinceLastEmbed += 2;
    let searchTerm;
    let searchTermRemix;
    let songName;
    let artistName;
    const lUrl = server.queue[0];
    if (args[1]) {
      args[0] = '';
      searchTerm = args.join(' ').trim();
    } else {
      if (lUrl.toLowerCase().includes('spotify')) {
        const infos = await getData(lUrl);
        songName = infos.name.toLowerCase();
        let songNameSubIndex = songName.search('[-]');
        if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
        songNameSubIndex = songName.search('[(]');
        if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
        else {
          songNameSubIndex = songName.search('[\[]');
          if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
        }
        artistName = infos.artists[0].name;
        searchTerm = songName + ' ' + artistName;
        if (infos.name.toLowerCase().includes('remix')) {
          let remixArgs = infos.name.toLowerCase().split(' ');
          let remixArgs2 = [];
          let wordIndex = 0;
          for (let i of remixArgs) {
            if (i.includes('remix') && wordIndex !== 0) {
              wordIndex--;
              break;
            }
            remixArgs2[wordIndex] = remixArgs[wordIndex];
            wordIndex++;
          }
          if (wordIndex) {
            remixArgs2[wordIndex] = '';
            searchTermRemix = remixArgs2.join(' ').trim() + ' ' +
              remixArgs[wordIndex].replace('(', '').trim() +
              ' remix';
          }
        }
      } else {
        const infos = await ytdl.getInfo(lUrl);
        if (infos.videoDetails.media && infos.videoDetails.title.includes(infos.videoDetails.media.song)) {
          // use video metadata
          songName = infos.videoDetails.media.song;
          let songNameSubIndex = songName.search('[(]');
          if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
          else {
            songNameSubIndex = songName.search('[\[]');
            if (songNameSubIndex !== -1) songName = songName.substr(0, songNameSubIndex);
          }
          artistName = infos.videoDetails.media.artist;
          if (artistName) {
            let artistNameSubIndex = artistName.search('ft.');
            if (artistNameSubIndex !== -1) artistName = artistName.substr(0, artistNameSubIndex);
            else {
              artistNameSubIndex = artistName.search(' feat');
              if (artistNameSubIndex !== -1) artistName = artistName.substr(0, artistNameSubIndex);
            }
            searchTerm = songName + ' ' + artistName;
          }
        } else {
          // use title
          let songNameSubIndex = infos.videoDetails.title.search('[(]');
          if (songNameSubIndex !== -1) {
            searchTerm = infos.videoDetails.title.substr(0, songNameSubIndex);
          } else {
            songNameSubIndex = infos.videoDetails.title.search('[\[]');
            if (songNameSubIndex !== -1) searchTerm = infos.videoDetails.title.substr(0, songNameSubIndex);
            else searchTerm = infos.videoDetails.title;
          }
        }
        if (infos.videoDetails.title.toLowerCase().includes('remix')) {
          let remixArgs = infos.videoDetails.title.toLowerCase().split(' ');
          let wordIndex = 0;
          for (let i of remixArgs) {
            if (i.includes('remix') && wordIndex !== 0) {
              wordIndex--;
              break;
            }
            wordIndex++;
          }
          if (wordIndex) {
            searchTermRemix = (songName ? songName : searchTerm) + ' ' +
              remixArgs[wordIndex].replace('(', '') +
              ' remix';
          }
        }
      }
    }
    const sendSongLyrics = async (searchTerm) => {
      try {
        const searches = await GeniusClient.songs.search(searchTerm);
        const firstSong = searches[0];
        const lyrics = await firstSong.lyrics();
        message.channel.send('***Lyrics for ' + firstSong.title + '***\n<' + firstSong.url + '>').then(sentMsg => {
          const lyricsText = lyrics.length > 1900 ? lyrics.substr(0, 1900) + '...' : lyrics;
          const mb = '📄';
          sentMsg.react(mb);

          const filter = (reaction, user) => {
            return user.id !== bot.user.id && [mb].includes(reaction.emoji.name);
          };

          const collector = sentMsg.createReactionCollector(filter, {time: 600000});

          collector.once('collect', (reaction, user) => {
            message.channel.send(lyricsText).then(server.numSinceLastEmbed += 10);
          });

        });
        return true;
      } catch (e) {
        return false;
      }
    };
    if (searchTermRemix ? (!await sendSongLyrics(searchTermRemix)
      && !await sendSongLyrics(searchTermRemix.replace(' remix', ''))
      && !await sendSongLyrics(searchTerm)) :
      !await sendSongLyrics(searchTerm)) {
      if (!args[1] && !lUrl.toLowerCase().includes('spotify')) {
        getYoutubeSubtitles(message, lUrl);
      } else {
        message.channel.send('no results found');
        server.numSinceLastEmbed -= 9;
      }
    }
    sentMsg.delete();
  });
}

/**
 * Wrapper for the function 'runAddCommand', for the purpose of user-facing error checking.
 * @param message The message that triggered the bot
 * @param args The args that of the message contents
 * @param sheetName The name of the sheet to add to
 * @param printMsgToChannel Whether to print a response to the channel
 * @param prefixString The prefix string
 * @returns {*}
 */
function runAddCommandWrapper (message, args, sheetName, printMsgToChannel, prefixString) {
  if (!args[1] || !args[2]) {
    return message.channel.send('Could not add to the database. Put a desired name followed by a link. *(ex:\` ' +
      prefixString + 'add [key] [link]\`)*');
  }
  if (args[2].substr(0, 1) === '[' && args[2].substr(args[2].length - 1, 1) === ']') {
    args[2] = args[2].substr(1, args[2].length - 2);
  }
  if (!verifyUrl(message, args[2])) return;
  // in case the database has not been initialized
  gsrun('A', 'B', sheetName).then(() => {
    runAddCommand(args, message, sheetName, printMsgToChannel);
  });
}

/**
 * The command to add a song to a given database.
 * @param {*} args The command arguments
 * @param {*} message The message that triggered the command
 * @param {string} sheetName the name of the sheet to add to
 * @param printMsgToChannel whether to print response to channel
 */
function runAddCommand (args, message, sheetName, printMsgToChannel) {
  let songsAddedInt = 0;
  let z = 1;
  gsrun('A', 'B', sheetName).then(async (xdb) => {
    while (args[z] && args[z + 1]) {
      let linkZ = args[z + 1];
      if (linkZ.substring(linkZ.length - 1) === ',') {
        linkZ = linkZ.substring(0, linkZ.length - 1);
      }
      if (args[z].includes('.')) {
        message.channel.send("did not add '" + args[z] + "', names cannot include '.'");
        songsAddedInt--;
      } else {
        let alreadyExists = false;
        if (printMsgToChannel) {
          for (const x of xdb.congratsDatabase.keys()) {
            if (x === args[z]) {
              message.channel.send("'" + args[z] + "' is already in your list");
              alreadyExists = true;
              songsAddedInt--;
              break;
            }
          }
        }
        if (!alreadyExists) {
          await gsUpdateAdd(args[z], args[z + 1], 'A', 'B', sheetName, xdb.dsInt);
        }
      }
      z = z + 2;
      songsAddedInt += 1;
    }
    if (printMsgToChannel) {
      const ps = prefixMap[message.guild.id];
      // the specific database user-access character
      let databaseType = args[0].substr(1, 1).toLowerCase();
      if (databaseType === 'a') {
        databaseType = '';
      }
      if (songsAddedInt === 1) {
        let typeString;
        if (databaseType === 'm') {
          typeString = 'your personal';
        } else {
          typeString = "the server's";
        }
        message.channel.send('*song added to ' + typeString + " database. (see '" + ps + databaseType + "keys')*");
      } else if (songsAddedInt > 1) {
        gsrun('A', 'B', sheetName).then((xdb) => {
          gsUpdateOverwrite(-1, songsAddedInt, sheetName, xdb.dsInt);
          message.channel.send('*' + songsAddedInt + " songs added to the database. (see '" + ps + databaseType + "keys')*");
        });
      }
    }
  });
}

/**
 * Prints the queue to the console
 * @param message The message that triggered the bot
 * @param mgid The message guild id
 * @param noErrorMsg Optional - Do not send error msg if true
 * @returns {Promise<void>|*}
 */
function runQueueCommand (message, mgid, noErrorMsg) {
  if (servers[mgid].queue < 1 || !message.guild.voice.channel) {
    if (noErrorMsg) return;
    return message.channel.send('There is no active queue right now');
  }
  const serverQueue = servers[mgid].queue.map((x) => x);
  let qIterations = serverQueue.length;
  if (qIterations > 11) qIterations = 11;
  let title;
  let authorName;

  async function getTitle (url, cutoff) {
    try {
      if (url.includes('spotify')) {
        const infos = await getData(url);
        title = infos.name;
      } else {
        const infos = await ytdl.getInfo(url);
        title = infos.videoDetails.title;
      }
    } catch (e) {
      title = 'broken_url';
    }
    if (cutoff && title.length > cutoff) {
      title = title.substr(0, cutoff) + '...';
    }
    return title;
  }

  async function generateQueue (startingIndex, notFirstRun) {
    let queueSB = '';
    const queueMsgEmbed = new MessageEmbed();
    if (!authorName) {
      authorName = await getTitle(serverQueue[0], 50);
    }
    const n = serverQueue.length - startingIndex - 1;
    let msgTxt = (notFirstRun ? 'generating ' + (n < 11 ? 'remaining ' + n : 'next 10') : 'generating queue') + '...';
    message.channel.send(msgTxt).then(async msg => {
      queueMsgEmbed.setTitle('Up Next')
        .setAuthor('playing:  ' + authorName)
        .setThumbnail('https://raw.githubusercontent.com/Reply2Zain/db-bot/master/assets/dbBotIconMedium.jpg');
      for (let qi = startingIndex + 1; (qi < qIterations && qi < serverQueue.length); qi++) {
        const title = (await getTitle(serverQueue[qi]));
        const url = serverQueue[qi];
        queueSB += qi + '. ' + `[${title}](${url})\n`;
      }
      if (queueSB.length === 0) {
        queueSB = 'queue is empty';
      }
      queueMsgEmbed.setDescription(queueSB);
      if (startingIndex + 10 < serverQueue.length) {
        queueMsgEmbed.setFooter('embed displays 10 at a time');
      }
      msg.delete();
      message.channel.send(queueMsgEmbed).then(sentMsg => {
        servers[mgid].numSinceLastEmbed += 10;
        if (startingIndex + 10 < serverQueue.length) {
          sentMsg.react('➡️');

          const filter = (reaction, user) => {
            if (message.member.voice.channel) {
              for (const mem of message.member.voice.channel.members) {
                if (user.id === mem[1].id) {
                  return user.id !== bot.user.id && ['➡️'].includes(reaction.emoji.name);
                }
              }
            }
            return false;
          };
          const collector = sentMsg.createReactionCollector(filter, {time: 300000});
          const arrowReactionInterval = setInterval(() => {
            clearInterval(arrowReactionInterval);
            sentMsg.reactions.removeAll();
          }, 300500);
          collector.on('collect', (reaction, reactionCollector) => {
            clearInterval(arrowReactionInterval);
            sentMsg.reactions.removeAll();
            qIterations += 10;
            generateQueue(startingIndex + 10, true);
          });
        }
      });
    });
  }

  return generateQueue(0);
}

/**
 * Gets the captions/subtitles from youtube using ytdl-core and then sends the captions to the
 * respective text channel.
 * @param message The message that triggered the bot.
 * @param url The video url to get the subtitles.
 */
function getYoutubeSubtitles (message, url) {

  ytdl.getInfo(url).then(info => {
    try {
      const player_resp = info.player_response;
      const tracks = player_resp.captions.playerCaptionsTracklistRenderer.captionTracks;
      let data = '';
      https.get(tracks[0].baseUrl.toString(), function (res) {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          res.on('data', function (data_) { data += data_.toString(); });
          res.on('end', function () {
            parser.parseString(data, function (err, result) {
              if (err) {
                console.log('ERROR in getYouTubeSubtitles');
                return console.log(err);
              } else {
                let finalString = '';
                for (let i of result.transcript.text) {
                  finalString += i._;
                }
                finalString = finalString.replace(/&#39;/g, '\'');
                finalString = finalString.length > 1900 ? finalString.substr(0, 1900) + '...' : finalString;
                message.channel.send('Could not find lyrics. Video captions are available.').then(sentMsg => {
                  const mb = '📄';
                  sentMsg.react(mb);

                  const filter = (reaction, user) => {
                    return user.id !== bot.user.id && [mb].includes(reaction.emoji.name);
                  };

                  const collector = sentMsg.createReactionCollector(filter, {time: 600000});

                  collector.once('collect', () => {
                    message.channel.send('***Captions from YouTube***');
                    message.channel.send(finalString).then(servers[message.guild.id].numSinceLastEmbed += 10);
                  });
                });
              }
            });
          });
        }
      });
    } catch (e) {
      message.channel.send('no results found');
      servers[message.guild.id].numSinceLastEmbed -= 9;
    }
  });
}

/**
 * Executes play assuming that message args are intended for a database call.
 * The database referenced depends on what is passed in via mgid.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetName the name of the sheet to reference
 * @param playRightNow bool of whether to play now or now
 * @param printErrorMsg prints error message, should be true unless attempting a followup db run
 * @param server The server playback metadata
 * @returns bool whether the play command has been handled accordingly
 */
function runDatabasePlayCommand (args, message, sheetName, playRightNow, printErrorMsg, server) {
  if (!args[1]) {
    message.channel.send("There's nothing to play! ... I'm just gonna pretend that you didn't mean that.");
    return true;
  }
  const voiceChannel = message.member.voice.channel;
  const mgid = message.guild.id;
  if (!voiceChannel) {
    message.channel.send('must be in a voice channel to play keys');
    return true;
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    server.queue = [];
    server.queueHistory = [];
  } else if (server.queue.length >= maxQueueSize) {
    message.channel.send('*max queue size has been reached*');
    return true;
  }
  server.numSinceLastEmbed += 5;
  gsrun('A', 'B', sheetName).then(async (xdb) => {
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
      while (args[dbAddInt]) {
        tempUrl = xdb.referenceDatabase.get(args[dbAddInt].toUpperCase());
        if (tempUrl) {
          // push to queue
          if (verifyPlaylist(tempUrl)) {
            dbAddedToQueue += await addPlaylistToQueue(message, mgid, 0, tempUrl, tempUrl.toLowerCase().includes('spotify.com'), false);
          } else {
            server.queue.push(tempUrl);
            dbAddedToQueue++;
          }
        } else {
          // check personal db if applicable
          if (sheetName.substr(0, 1) !== 'p') {
            if (!otherSheet) {
              await gsrun('A', 'B', 'p' + message.member.id).then((xdb) => {
                otherSheet = xdb.referenceDatabase;
              });
            }
            tempUrl = otherSheet.get(args[dbAddInt].toUpperCase());
            if (tempUrl) {
              // push to queue
              if (verifyPlaylist(tempUrl)) {
                dbAddedToQueue += await addPlaylistToQueue(message, mgid, 0, tempUrl, tempUrl.toLowerCase().includes('spotify.com'), playRightNow);
              } else if (playRightNow) {
                server.queue.unshift(tempUrl);
                dbAddedToQueue++;
                playRightNow = false;
              } else {
                server.queue.push(tempUrl);
                dbAddedToQueue++;
              }
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
      message.channel.send('*added ' + dbAddedToQueue + ' to queue*');
      if (firstUnfoundRan) {
        unFoundString = unFoundString.concat('*');
        message.channel.send(unFoundString);
      }
    } else {
      tempUrl = xdb.referenceDatabase.get(args[1].toUpperCase());
      if (!tempUrl) {
        const ss = runSearchCommand(args[1], xdb).ss;
        if (ssi === 1 && ss && ss.length > 0 && args[1].length > 1 && (ss.length - args[1].length) < Math.floor((ss.length / 2) + 2)) {
          message.channel.send("could not find '" + args[1] + "'. **Assuming '" + ss + "'**");
          tempUrl = xdb.referenceDatabase.get(ss.toUpperCase());
          if (playRightNow) { // push to queue and play
            let dsp = dispatcherMap[voiceChannel.id];
            try {
              if (server.queue[0] && dsp && dsp.streamTime &&
              server.queue[0].includes('spotify.com') ? dsp.streamTime > 75000 : dsp.streamTime > 140000) {
                server.queueHistory.push(server.queue.shift());
              }
            } catch (e) {console.log(e);}
            if (verifyPlaylist(tempUrl)) {
              await addPlaylistToQueue(message, mgid, 0, tempUrl, tempUrl.toLowerCase().includes('spotify.com'), playRightNow);
            } else {
              server.queue.unshift(tempUrl);
            }
            playSongToVC(message, server.queue[0], voiceChannel, true, server);
            message.channel.send('*playing now*');
            return true;
          } else {
            if (verifyPlaylist(tempUrl)) {
              dbAddedToQueue = await addPlaylistToQueue(message, mgid, 0, tempUrl, tempUrl.toLowerCase().includes('spotify.com'), playRightNow);
            } else {
              server.queue.push(tempUrl);
            }
          }
        } else if (!printErrorMsg) {
          if (sheetName.includes('p')) {
            message.channel.send("Could not find '" + args[1] + "' in database.");
            return true;
          } else {
            runDatabasePlayCommand(args, message, 'p' + message.member.id, playRightNow, false, server);
            return true;
          }
        } else if (ss && ss.length > 0) {
          message.channel.send("Could not find '" + args[1] + "' in database.\n*Did you mean: " + ss + '*');
          return true;
        } else {
          message.channel.send("Could not find '" + args[1] + "' in database.");
          return true;
        }
      } else { // did find in database
        if (playRightNow) { // push to queue and play
          let dsp = dispatcherMap[voiceChannel.id];
          try {
            if (server.queue[0] && dsp && dsp.streamTime &&
            server.queue[0].includes('spotify.com') ? dsp.streamTime > 75000 : dsp.streamTime > 140000) {
              server.queueHistory.push(server.queue.shift());
            }
          } catch (e) {console.log(e);}
          if (verifyPlaylist(tempUrl)) {
            await addPlaylistToQueue(message, mgid, 0, tempUrl, tempUrl.toLowerCase().includes('spotify.com'), playRightNow);
          } else {
            server.queue.unshift(tempUrl);
          }
          playSongToVC(message, server.queue[0], voiceChannel, true, server);
          message.channel.send('*playing now*');
          return true;
        } else {
          // push to queue
          if (verifyPlaylist(tempUrl)) {
            await addPlaylistToQueue(message, mgid, 0, tempUrl, tempUrl.toLowerCase().includes('spotify.com'), playRightNow);
          } else {
            server.queue.push(tempUrl);
          }
        }
      }
      if (!queueWasEmpty) message.channel.send('*added ' + (dbAddedToQueue > 1 ? dbAddedToQueue + ' ' : '') + 'to queue*');
    }
    // if queue was empty then play
    if (queueWasEmpty && server.queue.length > 0) {
      playSongToVC(message, server.queue[0], voiceChannel, true, server);
    }
  });
  return true;
}

// the search string
let ss;
// the number of searches found
let ssi;

/**
 * A search command that searches both the server and personal database for the string.
 * @param message The message that triggered the bot
 * @param mgid The guild id
 * @param providedString The string to search for
 */
function runUniversalSearchCommand (message, mgid, providedString) {
  gsrun('A', 'B', mgid).then(async (xdb) => {
    ss = runSearchCommand(providedString, xdb).ss;
    if (ss && ss.length > 0) {
      message.channel.send('Server keys found: ' + ss);
    } else if (providedString.length < 2) {
      message.channel.send('Did not find any server keys that start with the given letter.');
    } else {
      message.channel.send('Did not find any server keys that contain \'' + providedString + '\'');
    }
    message.channel.send('*Would you like to search your list too? (yes or no)*').then(() => {
      const filter = m => message.author.id === m.author.id;

      message.channel.awaitMessages(filter, {time: 30000, max: 1, errors: ['time']})
        .then(async messages => {
          if (messages.first().content.toLowerCase() === 'y' || messages.first().content.toLowerCase() === 'yes') {
            gsrun('A', 'B', 'p' + message.member.id).then(async (xdb) => {
              ss = runSearchCommand(providedString, xdb).ss;
              if (ss && ss.length > 0) {
                message.channel.send('Personal keys found: ' + ss);
              } else if (providedString.length < 2) {
                message.channel.send('Did not find any keys in your list that start with the given letter.');
              } else {
                message.channel.send('Did not find any keys in your list that contain \'' + providedString + '\'');
              }
            });
          }
        });
    });
  });
}

/**
 * Searches the database for the keys matching args[1].
 * @param keyName the keyName
 * @param xdb the object containing multiple DBs
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values
 */
function runSearchCommand (keyName, xdb) {
  const givenSLength = keyName.length;
  const keyArray2 = Array.from(xdb.congratsDatabase.keys());
  ss = '';
  ssi = 0;
  let searchKey;
  for (let ik = 0; ik < keyArray2.length; ik++) {
    searchKey = keyArray2[ik];
    if (
      keyName.toUpperCase() ===
      searchKey.substr(0, givenSLength).toUpperCase() ||
      (keyName.length > 1 &&
        searchKey.toUpperCase().includes(keyName.toUpperCase()))
    ) {
      ssi++;
      if (!ss) {
        ss = searchKey;
      } else {
        ss += ', ' + searchKey;
      }
    }
  }

  return {
    ss: ss,
    ssi: ssi
  };
}

/**
 * Function to skip songs once or multiple times.
 * Recommended if voice channel is not present.
 * @param message the message that triggered the bot
 * @param voiceChannel The active voice channel
 * @param server The server playback metadata
 * @param skipTimes Optional - the number of times to skip
 * @param sendSkipMsg Whether to send a 'skipped' message when a single song is skipped
 * @param forceSkip Optional - If there is a DJ, grants force skip abilities
 * @param mem The user that is completing the action, used for DJ mode
 */
function runSkipCommand (message, voiceChannel, server, skipTimes, sendSkipMsg, forceSkip, mem) {
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) return;
  if (!voiceChannel) {
    voiceChannel = mem.voice.channel;
    if (!voiceChannel) return message.channel.send('*must be in a voice channel to use this command*');
  }
  if (server.dictator && mem !== server.dictator)
    return message.channel.send('only the dictator can perform this action');
  if (server.voteAdmin.length > 0 && !forceSkip) {
    const vs = voteSystem(message, message.guild.id, 'skip', mem, server.voteSkipMembersId);
    server.voteSkipMembersId = vs.votes;
    if (vs.bool) {
      skipTimes = 1;
      sendSkipMsg = false;
      message.channel.send('***Skipping with ' + vs.votesNow + ' vote' + (vs.votesNow > 1 ? 's' : '') + '***');
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
        skipSong(message, voiceChannel, (sendSkipMsg ? skipCounter === 1 : false), server);
        if (skipCounter > 1) {
          message.channel.send('*skipped ' + skipCounter + ' times*');
        }
      } else {
        message.channel.send('*invalid skip amount (must be between 1 - 1000)*');
      }
    } catch (e) {
      skipSong(message, voiceChannel, true, server);
    }
  } else {
    skipSong(message, voiceChannel, true, server);
  }
}

/**
 * A system to manage votes for various bot actions. Used for DJ mode.
 * @param message THe message metadata
 * @param mgid The message guild id
 * @param commandName The action for which the voting is for
 * @param voter The member that is doing the voting
 * @param votes An array representing the ids of the members who voted for the action
 * @returns {{bool: boolean}|{bool: boolean, votesNow: number, votes, votesNeeded: number}}
 */
function voteSystem (message, mgid, commandName, voter, votes) {
  if (servers[message.guild.id].voteAdmin) {
    const vcMemMembersId = message.guild.voice.channel.members.map(x => x.id);
    if (vcMemMembersId && vcMemMembersId.includes(voter.id) && vcMemMembersId.includes(bot.user.id)) {
      servers[message.guild.id].numSinceLastEmbed += 2;
      const votesNeeded = Math.floor((vcMemMembersId.length - 1) / 2) + 1;
      let votesNow = parseInt(votes.length);
      if (votes.includes(voter.id)) {
        message.channel.send('*' + (voter.nickname ? voter.nickname : voter.user.username) +
          ', you have already voted to ' + commandName + ' this track* (**votes needed: '
          + (votesNeeded - votesNow) + '**)');
        return {bool: false, votes: votes};
      }
      votes.push(voter.id);
      votesNow++;
      if (votesNow >= votesNeeded) {
        message.channel.send('*' + (voter.nickname ? voter.nickname : voter.user.username) + ' voted to ' +
          commandName + ' (' + votesNow + '/' + votesNeeded + ')*');
        return {bool: true, votesNow, votesNeeded, votes: votes};
      } else {
        message.channel.send('*' + (voter.nickname ? voter.nickname : voter.user.username) + ' voted to ' +
          commandName + ' (' + votesNow + '/' + votesNeeded + ')*');
        return {bool: false, votes: votes};
      }
    } else {
      return {bool: false, votes: votes};
    }
  }
}

/**
 * Function to display help list.
 * @param {*} message the message that triggered the bot
 * @param {*} prefixString the prefix in string format
 */
function sendHelp (message, prefixString) {
  const helpListEmbed = new MessageEmbed();
  const description =
    '--------------  **Music Commands** --------------\n\`' +
    prefixString +
    'play [link] \` Play YouTube/Spotify link *[p]* \n\`' +
    prefixString +
    'play [word] \` Search YouTube and play *[p]* \n\`' +
    prefixString +
    'playnow [link/word] \` Plays now, overrides queue *[pn]*\n\`' +
    prefixString +
    'what \` What\'s playing *[now]*\n\`' +
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
    'loop \` Loops songs on finish *[l]*\n\`' +
    prefixString +
    'queue \` Displays the queue *[q]*\n' +
    '\n-----------  **Server Music Database**  -----------\n\`' +
    prefixString +
    "keys \` See all of the server's keys *[k]*\n\`" +
    prefixString +
    'd [key] \` Play a song from the server keys [k] \n\`' +
    prefixString +
    'dnow [key] \` Play immediately, overrides queue [dn] \n\`' +
    prefixString +
    'add [key] [url] \` Add a song to the server keys  *[a]*\n\`' +
    prefixString +
    'remove [key] \` Remove a song from the server keys  *[rm]*\n\`' +
    prefixString +
    'rand [# times] \` Play a random song from server keys  *[r]*\n\`' +
    prefixString +
    'search [key] \` Search keys  *[s]*\n' +
    '\n-----------  **Personal Music Database**  -----------\n' +
    "*Prepend 'm' to the above commands to access your personal music database*\nex: \`" + prefixString + "mkeys \`\n" +
    '\n-----------  **Advanced Music Commands**  -----------\n\`' +
    prefixString +
    'lyrics \` Get lyrics of what\'s currently playing\n\`' +
    prefixString +
    'verbose \` Keep all song embeds during a session\n\`' +
    prefixString +
    'silence \` Silence/hide now playing embeds \n\`' +
    prefixString +
    'dj \` Enable DJ mode, requires members to vote skip tracks\n\`' +
    prefixString +
    'dictator \` Enable dictator mode, one member controls all music commands\n' +
    '\n--------------  **Other Commands**  -----------------\n\`' +
    prefixString +
    'guess \` Random roll for the number of people in the voice channel \n\`' +
    prefixString +
    'changeprefix [new prefix] \` Changes the prefix for all commands \n' +
    '\n**Or just say congrats to a friend. I will chime in too! :) **'
  ;
  helpListEmbed
    .setTitle('Help List *[with aliases]*')
    .setDescription(description);
  message.channel.send(helpListEmbed);
}

/**
 * Function for searching for message contents on youtube for playback.
 * Does not check for force disconnect.
 * @param message The discord message
 * @param args The args to verify content
 * @param mgid The message guild id
 * @param playNow Bool, whether to override the queue
 * @param server The server playback metadata
 * @param indexToLookup Optional - The search index, requires searchResult to be valid
 * @param searchTerm Optional - The specific phrase to search
 * @param searchResult Optional - For recursive call with memoization
 * @returns {Promise<*|boolean|undefined>}
 */
async function runYoutubeSearch (message, args, mgid, playNow, server, indexToLookup, searchTerm, searchResult) {
  if (!searchTerm) {
    const tempArray = args.map(x => x);
    tempArray[0] = '';
    searchTerm = tempArray.join(' ').trim();
  }
  if (!searchResult) {
    indexToLookup = 0;
    searchResult = await ytsr(searchTerm, {pages: 1});
    if (!searchResult.items[0]) {
      if (!searchTerm.includes('video')) {
        return runYoutubeSearch(message, args, mgid, playNow, server, indexToLookup, searchTerm + ' video', undefined);
      }
      return message.channel.send('could not find video');
    }
  } else {
    indexToLookup = parseInt(indexToLookup);
    if (!indexToLookup) indexToLookup = 1;
    indexToLookup--;
  }
  const args2 = [];
  if (searchResult.items[indexToLookup].type === 'video') {
    args2[1] = searchResult.items[indexToLookup].url;
  } else {
    if (server.queue[0] === args2[1]) server.queueHistory.push(server.queue.shift());
    return runYoutubeSearch(message, args, mgid, playNow, server, indexToLookup += 2, searchTerm, searchResult);
  }
  if (!args2[1]) return message.channel.send('could not find video');
  if (playNow) {
    server.queue.unshift(args2[1]);
    await playSongToVC(message, args2[1], message.member.voice.channel, true, server);
  } else {
    server.queue.push(args2[1]);
    if (server.queue.length === 1) {
      await playSongToVC(message, args2[1], message.member.voice.channel, true, server);
    } else {
      message.channel.send('*added to queue*');
    }
  }
  if (indexToLookup < 4 && (playNow || server.queue.length < 2)) {
    await message.react('➡️');
    const filter = (reaction, user) => {
      if (message.member.voice.channel) {
        for (const mem of message.member.voice.channel.members) {
          if (user.id === mem[1].id) {
            return user.id !== bot.user.id && ['➡️'].includes(reaction.emoji.name);
          }
        }
      }
      return false;
    };

    const collector = message.createReactionCollector(filter, {time: 20000});
    const arrowReactionInterval = setInterval(() => {
      clearInterval(arrowReactionInterval);
      message.reactions.removeAll();
    }, 20000);
    collector.once('collect', (reaction, reactionCollector) => {
      clearInterval(arrowReactionInterval);
      if (indexToLookup > 2) {
        message.reactions.removeAll();
      } else {
        reaction.users.remove(reactionCollector.id);
      }
      if (server.queue[0] === args2[1]) server.queueHistory.push(server.queue.shift());
      runYoutubeSearch(message, args, mgid, true, server, indexToLookup += 2, searchTerm, searchResult);
    });
  }
}

/**
 * Runs the checks to add random songs to the queue
 * @param num The number of songs to be added to random, could be string
 * @param message The message that triggered the bot
 * @param sheetName The name of the sheet to reference
 * @param server The server playback metadata
 */
function runRandomToQueue (num, message, sheetName, server) {
  if (!message.member.voice.channel) {
    return message.channel.send('must be in a voice channel to play random');
  }
  if (server.dictator && message.member !== server.dictator)
    return message.channel.send('only the dictator can randomize to queue');
  if (!num) num = 1;
  let isPlaylist;
  const numCpy = num;
  try {
    num = parseInt(num);
  } catch (e) {
    isPlaylist = true;
  }
  if (!num) {
    isPlaylist = true;
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    server.queue = [];
    server.queueHistory = [];
  }
  if (server.queue.length >= maxQueueSize) {
    return message.channel.send('*max queue size has been reached*');
  }
  gsrun('A', 'B', sheetName).then((xdb) => {
    if (isPlaylist) {
      addRandomToQueue(message, numCpy, xdb.congratsDatabase, server, true);
    } else {
      try {
        if (num && num > maxQueueSize) {
          message.channel.send('*max limit for random is ' + maxQueueSize + '*');
          num = maxQueueSize;
        }
        addRandomToQueue(message, num, xdb.congratsDatabase, server);
      } catch (e) {
        addRandomToQueue(message, 1, xdb.congratsDatabase, server);
      }
    }
  });
}

/**
 * Adds a number of items from the database to the queue randomly.
 * @param message The message that triggered the bot
 * @param numOfTimes The number of items to add to the queue, or a playlist url if isPlaylist
 * @param {Map} cdb The database to reference
 * @param server The server playback metadata
 * @param isPlaylist Optional - True if to randomize just a playlist
 */
async function addRandomToQueue (message, numOfTimes, cdb, server, isPlaylist) {
  let playlistKey;
  if (isPlaylist) {
    playlistKey = numOfTimes;
    if (verifyPlaylist(cdb.get(playlistKey))) numOfTimes = 2;
    else return message.channel.send('argument must be a positive number or playlist key-name');
  }
  let sentMsg;
  if (numOfTimes > 100) sentMsg = await message.channel.send('generating random from your keys...');
  else if (isPlaylist && numOfTimes === 2) sentMsg = await message.channel.send('randomizing your playlist...');
  const rKeyArray = Array.from(cdb.keys());
  if (rKeyArray.length < 1 || (rKeyArray.length === 1 && rKeyArray[0].length < 1)) {
    return message.channel.send('Your music list is empty.');
  }
  const serverQueueLength = server.queue.length;
  // mutate numberOfTimes to not exceed maxQueueSize
  if (numOfTimes + serverQueueLength > maxQueueSize) {
    numOfTimes = maxQueueSize - serverQueueLength;
    if (numOfTimes === 0) {
      return message.channel.send('*max queue size has been reached*');
    }
  }
  let rn;
  let queueWasEmpty = false;
  if (server.queue.length < 1) {
    queueWasEmpty = true;
  }
  try {
    for (let i = 0; i < numOfTimes;) {
      let tempArray = [];
      if (isPlaylist) tempArray.push(cdb.get(playlistKey));
      else tempArray = [...rKeyArray];
      while ((tempArray.length > 0 && i < numOfTimes)) {
        const randomNumber = Math.floor(Math.random() * tempArray.length);
        let url;
        if (tempArray[randomNumber].includes('.')) url = tempArray[randomNumber];
        else url = cdb.get(tempArray[randomNumber]);
        let playlist;
        // if it is a playlist
        if (verifyPlaylist(url)) {
          try {
            let isSpotify = url.toLowerCase().includes('spotify');
            // add all the songs from the playlist to the tempArray
            if (isSpotify) {
              playlist = await getTracks(url);
            } else {
              playlist = await ytpl(await ytpl.getPlaylistID(url), {pages: 1});
              playlist = playlist.items;
            }
            let itemCounter = 0;
            for (let j of playlist) {
              url = isSpotify ? j.external_urls.spotify : (j.shortUrl ? j.shortUrl : j.url);
              if (url) {
                tempArray.push(url);
                itemCounter++;
              }
            }
            if (isPlaylist) numOfTimes = itemCounter;
            url = undefined;
          } catch (e) {}
        }
        if (url) {
          server.queue.push(url);
          i++;
        }
        tempArray.splice(randomNumber, 1);
      }
    }
    // rKeyArrayFinal should have list of randoms here
  } catch (e) {
    console.log('error in random: ');
    console.log(e);
    rn = Math.floor(Math.random() * rKeyArray.length);
    if (verifyPlaylist(rKeyArray[rn])) {
      if (sentMsg) sentMsg.delete();
      return message.channel.send('There was an error.');
    }
    server.queue.push(cdb.get(rKeyArray[rn]));
  }
  // rKeyArrayFinal.forEach(e => {server.queue.push(cdb.get(e));});
  if (queueWasEmpty && server.queue.length > 0) {
    playSongToVC(message, server.queue[0], message.member.voice.channel, true, server).then(() => {
      if (sentMsg) sentMsg.delete();
    });
  } else {
    if (sentMsg) sentMsg.delete();
    message.channel.send('*added ' + numOfTimes + ' to queue*');
  }
}

/**
 * Grabs all of the keys/names from the database
 * @param {*} message The message trigger
 * @param prefixString The character of the prefix
 * @param {*} sheetname The name of the sheet to retrieve
 * @param cmdType the prefix to call the keys being displayed
 * @param voiceChannel optional, a specific voice channel to use besides the message's
 * @param user Optional - user name, overrides the message owner's name
 */
async function runKeysCommand (message, prefixString, sheetname, cmdType, voiceChannel, user) {
  gsrun('A', 'B', sheetname).then((xdb) => {
    let keyArrayUnsorted = Array.from(xdb.congratsDatabase.keys()).reverse();
    let keyArraySorted = keyArrayUnsorted.map(x => x).sort();
    let sortByRecents = false;
    let dbName = '';
    let keyArray = keyArraySorted;
    if (keyArray.length < 1) {
      let emptyDBMessage;
      if (!cmdType) {
        emptyDBMessage = "The server's ";
      } else {
        emptyDBMessage = 'Your ';
      }
      message.channel.send('**' + emptyDBMessage + 'music list is empty.**\n*Add a song by putting a word followed by a link.' +
        '\nEx:* \` ' + prefixString + cmdType + 'a [key] [link] \`');
    } else {
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
          s = s + ', ' + keyArray[key];
        }
        s = s.substr(1);
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
          keyEmbedColor = '#b35536';
        }
        const embedKeysMessage = new MessageEmbed();
        embedKeysMessage.setTitle(keysMessage + (sortByRecent ? '(recently added)' : '(alphabetical)')).setDescription(s)
          .setColor(keyEmbedColor).setFooter("(use '" + prefixString + cmdType + "d [key]' to play)\n");
        return embedKeysMessage;
      };
      message.channel.send(generateKeysEmbed(sortByRecents)).then(async sentMsg => {
        sentMsg.react('❔').then(() => sentMsg.react('🔀').then(sentMsg.react('🔄')));
        const filter = (reaction, user) => {
          return user.id !== bot.user.id && ['❔', '🔄', '🔀'].includes(reaction.emoji.name);
        };
        const keysButtonCollector = sentMsg.createReactionCollector(filter, {time: 1200000});
        keysButtonCollector.on('collect', (reaction, reactionCollector) => {
          if (reaction.emoji.name === '❔') {
            let nameToSend;
            let descriptionSuffix;
            if (dbName === "server's keys") {
              nameToSend = 'the server';
              descriptionSuffix = 'The server keys are keys that any person in a server can play. ' +
                '\nEach server has it\'s own server keys and can be used by any member in the server.';
            } else {
              nameToSend = 'your personal';
              descriptionSuffix = 'Your personal keys are keys that only you can play. \nThey work in any server ' +
                'with the db bot.';
            }
            const embed = new MessageEmbed()
              .setTitle('How to add/remove keys from ' + nameToSend + ' list')
              .setDescription('Add a song by putting a word followed by a link -> \` ' +
                prefixString + cmdType + 'a [key] [link]\`\n' +
                'Remove a song by putting the name you want to remove -> \` ' +
                prefixString + cmdType + 'rm [key]\`')
              .setFooter(descriptionSuffix);
            message.channel.send(embed);
          } else if (reaction.emoji.name === '🔀') {
            if (!voiceChannel) {
              voiceChannel = message.member.voice.channel;
              if (!voiceChannel) return message.channel.send("must be in a voice channel to randomize");
            }
            for (const mem of voiceChannel.members) {
              if (reactionCollector.id === mem[1].id) {
                if (sheetname.includes('p')) {
                  if (reactionCollector.username) {
                    message.channel.send('*randomizing from ' + reactionCollector.username + "'s keys...*");
                  } else {
                    message.channel.send('*randomizing...*');
                  }
                  runRandomToQueue(100, message, 'p' + reactionCollector.id, servers[message.guild.id]);
                } else {
                  message.channel.send('*randomizing from the server keys...*');
                  runRandomToQueue(100, message, sheetname, servers[message.guild.id]);
                }
                return;
              }
            }
            return message.channel.send('must be in a voice channel to shuffle play');
          } else if (reaction.emoji.name === '🔄') {
            sortByRecents = !sortByRecents;
            sentMsg.edit(generateKeysEmbed(sortByRecents));
            reaction.users.remove(reactionCollector.id);
          }
        });
        keysButtonCollector.once('end', () => {
          sentMsg.reactions.removeAll();
        });
      });
    }
  });
}

bot.on('voiceStateUpdate', update => {
  if (isInactive) return;
  // if the bot is the one leaving
  if (update.member.id === bot.user.id && !update.connection && servers[update.guild.id]) {
    const server = servers[update.guild.id];
    sendLinkAsEmbed(server.currentEmbed, server.currentEmbedLink, update.channel, server, undefined, false).then(() => {
      server.numSinceLastEmbed = 0;
      server.silence = false;
      server.verbose = false;
      server.loop = false;
      server.voteAdmin = [];
      server.dictator = false;
      if (server.currentEmbed && server.currentEmbed.reactions) {
        server.collector.stop();
        server.currentEmbed.reactions.removeAll().then();
        server.currentEmbed = false;
      }
      if (server.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
    });
  } else {
    if (!update.channel) return;
    let leaveVCInt = 1100;
    if (dispatcherMap[update.channel.id]) leaveVCInt = 420000;
    clearInterval(leaveVCTimeout[update.channel.id]);
    leaveVCTimeout[update.channel.id] = setInterval(() => {
      clearInterval(leaveVCTimeout[update.channel.id]);
      if (update.channel.members.size < 2) {
        update.channel.leave();
      }
    }, leaveVCInt);
  }
});

bot.on('error', (e) => {
  console.log('BOT ERROR:');
  console.log(e);
});
process.on('error', (e) => {
  console.log('PROCESS ERROR:');
  console.log(e);
});

/**
 *  The play function. Plays a given link to the voice channel.
 * @param {*} message the message that triggered the bot
 * @param {string} whatToPlay the link of the song to play
 * @param voiceChannel the voice channel to play the song in
 * @param sendEmbed whether to send an embed to the text channel
 * @param server The server playback metadata
 */
async function playSongToVC (message, whatToPlay, voiceChannel, sendEmbed, server) {
  const mgid = message.guild.id;
  if (!whatToPlay) {
    whatToPlay = server.queue[0];
    if (!whatToPlay && server.queue[1]) {
      server.queue.shift();
      whatToPlay = server.queue[0];
    } else return;
  }
  if (!voiceChannel) {
    voiceChannel = message.member.voice.channel;
    if (!voiceChannel || voiceChannel.members.size < 1) return;
  }
  if (isInactive) {
    message.channel.send('*db bot has been updated*');
    return runStopPlayingCommand(message.guild.id, voiceChannel, false, server);
  }
  if (server.voteAdmin.length > 0) {
    server.voteSkipMembersId = [];
    server.voteRewindMembersId = [];
    server.votePlayPauseMembersId = [];
  }
  // the display url
  let urlOrg = whatToPlay;
  // the alternative url to play
  let urlAlt = whatToPlay;
  let infos;
  if (urlOrg.includes('spotify.com')) {
    let itemIndex = 0;
    try {
      infos = await getData(urlOrg);
    } catch (e) {
      console.log(e);
      message.channel.send('could not play <' + urlOrg + '>');
      whatspMap[voiceChannel.id] = '';
      return skipSong(message, voiceChannel, true, server, true);
    }
    let artists = '';
    if (infos.artists) {
      infos.artists.forEach(x => artists += x.name + ' ');
      artists = artists.trim();
    } else artists = 'N/A';
    let search = await ytsr(infos.name + ' ' + artists, {pages: 1});
    let youtubeDuration;
    // todo: 2 - durationAmount should NOT be a number but addresses the crash, fix later using these broken links
    // https://open.spotify.com/track/2GaEWytjsb64OFuNdfNVJU?si=af92d10f74d04158
    // https://www.youtube.com/watch?v=NgVH_mEDLaI
    let durationAmount = 180000;
    if (search.items[0]) {
      const convertYTFormatToMS = (durationArray) => {
        try {
        if (durationArray) {
          youtubeDuration = 0;
          durationArray.reverse();
          if (durationArray[1]) youtubeDuration += durationArray[1] * 60000;
          if (durationArray[2]) youtubeDuration += durationArray[1] * 3600000;
          youtubeDuration += durationArray[0] * 1000;
        }
      } catch (e) {youtubeDuration = 180000} // todo: 3 - remove once durationArray is addressed
        return youtubeDuration;
      };
      // fix for broken links, todo: 1 - figure out another way to get the time when this fails, maybe ytdl-core-discord
      // remove temporary if-statement once fixed
      if (search.items[0].duration) durationAmount = search.items[0].duration.split(':');
      youtubeDuration = convertYTFormatToMS(durationAmount);
      let spotifyDuration = parseInt(infos.duration_ms);
      itemIndex++;
      while (search.items[itemIndex] && search.items[itemIndex].type !== 'video' && itemIndex < 6) {
        itemIndex++;
      }
      // if the next video is a better match then play the next video
      if (!(youtubeDuration && spotifyDuration && search.items[itemIndex] && search.items[itemIndex].duration &&
        Math.abs(spotifyDuration - youtubeDuration) >
        (Math.abs(spotifyDuration - convertYTFormatToMS(search.items[itemIndex].duration.split(':'))) + 1000))) {
        itemIndex = 0;
      }
    } else {
      search = await ytsr(infos.name + ' ' + artists + ' lyrics', {pages: 1});
    }
    if (search.items[itemIndex]) urlAlt = search.items[itemIndex].url;
    else {
      message.channel.send('could not find <' + urlOrg + '>');
      runSkipCommand(message, voiceChannel, server, 1, true, true, message.member);
    }
  }
  voiceChannel.join().then(async connection => {
    whatspMap[voiceChannel.id] = urlOrg;
    // remove previous embed buttons
    if (server.numSinceLastEmbed > 4 && server.currentEmbed &&
      (!server.loop || whatspMap[voiceChannel.id] !== urlOrg)) {
      server.numSinceLastEmbed = 0;
      server.currentEmbed.delete();
      server.currentEmbed = false;
    }
    try {
      connection.voice.setSelfDeaf(true).then();
      let dispatcher = connection.play(await ytdl(urlAlt, {}), {
        type: 'opus',
        filter: 'audioonly',
        quality: '140',
        volume: false
      });
      dispatcher.pause();
      dispatcherMap[voiceChannel.id] = dispatcher;
      // if the server is not silenced then send the embed when playing
      if (sendEmbed && !server.silence) {
        await sendLinkAsEmbed(message, urlOrg, voiceChannel, server, infos).then(() => dispatcher.setVolume(0.5));
      }
      skipTimesMap[mgid] = 0;
      dispatcherMapStatus[voiceChannel.id] = false;
      dispatcher.resume();
      dispatcher.once('finish', () => {
        const songFinish = setInterval(() => {
          clearInterval(songFinish);
          if (urlOrg !== whatspMap[voiceChannel.id]) {
            console.log('There was a mismatch -------------------');
            console.log('old url: ' + urlOrg);
            console.log('current url: ' + whatspMap[voiceChannel.id]);
            try {
              bot.channels.cache.get('821993147466907659').send('there was a mismatch with playback');
            } catch (e) {
              console.log(e);
            }
          }
          if (server.currentEmbed && server.currentEmbed.reactions && !server.loop && server.queue.length < 2) {
            server.currentEmbed.reactions.removeAll();
            server.currentEmbed = false;
          }
          if (voiceChannel.members.size < 2) {
            connection.disconnect();
          } else if (server.loop) {
            playSongToVC(message, urlOrg, voiceChannel, true, server);
          } else {
            server.queueHistory.push(server.queue.shift());
            if (server.queue.length > 0) {
              playSongToVC(message, server.queue[0], voiceChannel, true, server);
            } else {
              dispatcherMap[voiceChannel.id] = false;
            }
          }
        }, 700);
        if (server && server.followUpMessage) {
          server.followUpMessage.delete();
          server.followUpMessage = undefined;
        }
      });
      dispatcher.once('error', (e) => console.log(e));
    } catch (e) {
      console.log(e);
      const numberOfPrevSkips = skipTimesMap[mgid];
      if (!numberOfPrevSkips) {
        skipTimesMap[mgid] = 1;
      } else if (numberOfPrevSkips > 3) {
        connection.disconnect();
        return;
      } else {
        skipTimesMap[mgid] += 1;
      }
      // Error catching - fault with the link?
      message.channel.send('Could not play <' + urlOrg + '>');
      // search the db to find possible broken keys
      searchForBrokenLinkWithinDB(message, urlOrg);
      whatspMap[voiceChannel.id] = '';
      skipSong(message, voiceChannel, true, server, true);
    }
  });
}

// number of consecutive error skips in a server, uses guild id
const skipTimesMap = new Map();

/**
 * Searches the guild db and personal message db for a broken link
 * @param message The message
 * @param whatToPlayS The broken link provided as a string
 */
function searchForBrokenLinkWithinDB (message, whatToPlayS) {
  gsrun('A', 'B', message.channel.guild.id).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within the server db: ' + key + '*');
      }
    });
  });
  gsrun('A', 'B', 'p' + message.member.id).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within the personal db: ' + key + '*');
      }
    });
  });
}

/**
 * Rewinds the song
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
  if (server.dictator && mem !== server.dictator)
    return message.channel.send('only the dictator can perform this action');
  let song;
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
    const vs = voteSystem(message, message.guild.id, 'rewind', mem, server.voteRewindMembersId);
    server.voteRewindMembersId = vs.votes;
    if (vs.bool) {
      rewindTimes = 1;
      ignoreSingleRewind = true;
      message.channel.send('***Rewinding with ' + vs.votesNow + ' vote' + (vs.votesNow > 1 ? 's' : '') + '***');
    } else return;
  }
  if (!rewindTimes || rewindTimes < 1 || rewindTimes > 10000) return message.channel.send('invalid rewind amount');
  let rwIncrementor = 0;
  while (server.queueHistory.length > 0 && rwIncrementor < rewindTimes) {
    if (server.queue.length > (maxQueueSize + 99)) {
      playSongToVC(message, server.queue[0], voiceChannel, true, server);
      return message.channel.send('*max queue size has been reached, cannot rewind further*');
    }
    song = false;
    // remove undefined links from queueHistory
    while (server.queueHistory.length > 0 && !song) {
      song = server.queueHistory.pop();
    }
    if (song) server.queue.unshift(song);
    rwIncrementor++;
  }
  if (song) {
    if (ignoreSingleRewind) {} else if (rewindTimes === 1) {
      message.channel.send('*rewound*');
    } else {
      message.channel.send('*rewound ' + rwIncrementor + ' times*');
    }
    playSongToVC(message, song, voiceChannel, true, server);
  } else if (server.queue[0]) {
    playSongToVC(message, server.queue[0], voiceChannel, true, server);
    message.channel.send('*replaying first song*');
  } else {
    message.channel.send('cannot find previous song');
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
}

/**
 * Sends an embed to the channel depending on the given link.
 * If not given a voice channel then playback buttons will not appear.
 * @param message the message to send the channel to
 * @param url the url to generate the embed for
 * @param voiceChannel the voice channel that the song is being played in, if playing
 * @param server The server playback metadata
 * @param infos Optional - Spotify information if already generated
 * @param forceEmbed Optional - force the embed to be regenerated
 * @returns {Promise<void>}
 */
async function sendLinkAsEmbed (message, url, voiceChannel, server, infos, forceEmbed) {
  if (!message) return;
  const mgid = message.guild.id;
  if (!mgid) return;
  if (server.verbose) forceEmbed = true;
  if (!url || server.loop && server.currentEmbedLink === url && !forceEmbed &&
    server.currentEmbed.reactions) {
    return;
  }
  server.currentEmbedChannelId = message.channel.id;
  server.currentEmbedLink = url;
  let embed;
  let timeMS = 0;
  let showButtons = true;
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
      .setThumbnail(infos.album.images.reverse()[0].url);
    timeMS = parseInt(infos.duration_ms);
    // .addField('Preview', `[Click here](${infos.preview_url})`, true) // adds a preview
  } else {
    const infos = await ytdl.getInfo(url);
    let duration = formatDuration(infos.formats[0].approxDurationMs);
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
  if (server.queue.length > 0 && message.guild.voice && message.guild.voice.channel) {
    embed.addField('Queue', ' 1 / ' + server.queue.length, true);
  } else {
    embed.addField('-', 'Last played', true);
    showButtons = false;
  }
  const generateNewEmbed = async () => {
    if (server.currentEmbed && !forceEmbed) {
      server.numSinceLastEmbed = 0;
      server.currentEmbed.delete();
      server.currentEmbed = false;
    } else if (server.currentEmbed && server.currentEmbed.reactions) {
      server.numSinceLastEmbed = 0;
      await server.collector.stop();
      await server.currentEmbed.reactions.removeAll();
      server.currentEmbed = undefined;
    }
    message.channel.send(embed)
      .then((sentMsg) => {
        if (!showButtons || !dispatcherMap[voiceChannel.id]) return;
        server.currentEmbed = sentMsg;
        server.numSinceLastEmbed = 0;
        if (!sentMsg) return;
        sentMsg.react('⏪').then(() => {
          if (collector.ended) return;
          sentMsg.react('⏯').then(() => {
            if (collector.ended) return;
            sentMsg.react('⏩').then(() => {
              if (collector.ended) return;
              sentMsg.react('⏹').then(() => {
                if (collector.ended) return;
                sentMsg.react('🔑').then(() => {
                  if (collector.ended) return;
                  sentMsg.react('🔐').then();
                });
              });
            });
          });
        });
        const filter = (reaction, user) => {
          if (voiceChannel) {
            for (const mem of voiceChannel.members) {
              if (user.id === mem[1].id) {
                return user.id !== bot.user.id && ['⏯', '⏩', '⏪', '⏹', '🔑', '🔐'].includes(reaction.emoji.name);
              }
            }
          }
          return false;
        };

        timeMS += 3600000;

        const collector = sentMsg.createReactionCollector(filter, {time: timeMS});

        server.collector = collector;
        collector.on('collect', (reaction, reactionCollector) => {
          if (!dispatcherMap[voiceChannel.id] || !voiceChannel) {
            return;
          }
          if (reaction.emoji.name === '⏩') {
            reaction.users.remove(reactionCollector.id);
            runSkipCommand(message, voiceChannel, server, 1, false, false, message.member.voice.channel.members.get(reactionCollector.id));
            if (server.followUpMessage) {
              server.followUpMessage.delete();
              server.followUpMessage = undefined;
            }
          } else if (reaction.emoji.name === '⏯' && !dispatcherMapStatus[voiceChannel.id]) {
            let tempUser = sentMsg.guild.members.cache.get(reactionCollector.id);
            runPauseCommand(message, tempUser, server, true, false, true);
            tempUser = tempUser.nickname;
            if (server.voteAdmin.length < 1 && !server.dictator) {
              if (server.followUpMessage) {
                server.followUpMessage.edit('*paused by \`' + (tempUser ? tempUser : reactionCollector.username) +
                  '\`*');
              } else {
                message.channel.send('*paused by \`' + (tempUser ? tempUser : reactionCollector.username) +
                  '\`*').then(msg => {server.followUpMessage = msg;});
              }
            }
            reaction.users.remove(reactionCollector.id);
          } else if (reaction.emoji.name === '⏯' && dispatcherMapStatus[voiceChannel.id]) {
            let tempUser = sentMsg.guild.members.cache.get(reactionCollector.id);
            runPlayCommand(message, tempUser, server, true, false, true);
            if (server.voteAdmin.length < 1 && !server.dictator) {
              tempUser = tempUser.nickname;
              if (server.followUpMessage) {
                server.followUpMessage.edit('*played by \`' + (tempUser ? tempUser : reactionCollector.username) +
                  '\`*');
              } else {
                message.channel.send('*played by \`' + (tempUser ? tempUser : reactionCollector.username) +
                  '\`*').then(msg => {server.followUpMessage = msg;});
              }
            }
            reaction.users.remove(reactionCollector.id);
          } else if (reaction.emoji.name === '⏪') {
            reaction.users.remove(reactionCollector.id);
            runRewindCommand(message, mgid, voiceChannel, undefined, true, false, message.member.voice.channel.members.get(reactionCollector.id), server);
            if (server.followUpMessage) {
              server.followUpMessage.delete();
              server.followUpMessage = undefined;
            }
          } else if (reaction.emoji.name === '⏹') {
            const mem = message.member.voice.channel.members.get(reactionCollector.id);
            if (!server.dictator || server.dictator === mem) collector.stop();
            runStopPlayingCommand(mgid, voiceChannel, false, server, message, mem);
            if (server.followUpMessage) {
              server.followUpMessage.delete();
              server.followUpMessage = undefined;
            }
          } else if (reaction.emoji.name === '🔑') {
            runKeysCommand(message, prefixMap[mgid], mgid, '', voiceChannel, '');
            server.numSinceLastEmbed += 5;
          } else if (reaction.emoji.name === '🔐') {
            server.numSinceLastEmbed += 5;
            // console.log(reaction.users.valueOf().array().pop());
            runKeysCommand(message, prefixMap[mgid], 'p' + reactionCollector.id, 'm', voiceChannel, reactionCollector);
          }
        });
      });
  };
  if (url === whatspMap[voiceChannel.id]) {
    if (server.numSinceLastEmbed < 5 && !forceEmbed && server.currentEmbed) {
      try {
        server.currentEmbed.edit(embed);
      } catch (e) {
        await generateNewEmbed();
      }
    } else {
      await generateNewEmbed();
    }
  }
}

/**
 * Stops playing in the given voice channel and leaves.
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 * @param stayInVC Whether to stay in the voice channel
 * @param server The server plagback metadata
 * @param message Optional - The message metadata, used in the case of verifying a dj or dictator
 * @param actionUser Optional - The member requesting to stop playing, used in the case of verifying a dj or dictator
 */
function runStopPlayingCommand (mgid, voiceChannel, stayInVC, server, message, actionUser) {
  if (!voiceChannel) return;
  if (server.dictator && actionUser && actionUser !== server.dictator)
    return message.channel.send('only the dictator can perform this action');
  if (server.voteAdmin.length > 0 && actionUser) {
    if (!server.voteAdmin.map(x => x.id).includes(actionUser.id))
      return message.channel.send('*only the DJ can end the session*');
  }
  if (server.currentEmbed && server.currentEmbed.reactions) {
    server.collector.stop();
    server.currentEmbed.reactions.removeAll().then();
  }
  try {
    dispatcherMap[voiceChannel.id].pause();
  } catch (e) {}
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  if (voiceChannel && !stayInVC) {
    const waitForInit = setInterval(() => {
      clearInterval(waitForInit);
      voiceChannel.leave();
    }, 600);
  }
}

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param {*} message the message that activated the bot
 * @param {*} voiceChannel The active voice channel
 * @param keyName Optional - A key to search for to retrieve a link
 * @param {*} sheetname Required if dbKey is given - provides the name of the sheet reference.
 * @param sheetLetter Required if dbKey is given - a letter enum representing the type of sheet being referenced
 * (server or personal)
 */
async function runWhatsPCommand (message, voiceChannel, keyName, sheetname, sheetLetter) {
  if (keyName && sheetname) {
    gsrun('A', 'B', sheetname).then((xdb) => {
      let dbType = "the server's";
      if (sheetLetter === 'm') {
        dbType = 'your';
      }
      if (xdb.referenceDatabase.get(keyName.toUpperCase())) {
        return message.channel.send(xdb.referenceDatabase.get(keyName.toUpperCase()));
      } else {
        message.channel.send("Could not find '" + keyName + "' in " + dbType + ' database.');
        return sendLinkAsEmbed(message, whatspMap[voiceChannel.id], voiceChannel, servers[message.guild.id], undefined, true);
      }
    });
  } else if (!voiceChannel) {
    return message.channel.send('must be in a voice channel');
  } else if (whatspMap[voiceChannel.id]) {
    return sendLinkAsEmbed(message, whatspMap[voiceChannel.id], voiceChannel, servers[message.guild.id], undefined, true);
  } else {
    return message.channel.send('nothing is playing right now');
  }
}

// What's playing, uses voice channel id
const whatspMap = new Map();
// The server's prefix, uses guild id
const prefixMap = new Map();
// The song stream, uses voice channel id
const dispatcherMap = new Map();
// The status of a dispatcher, either true for paused or false for playing
const dispatcherMapStatus = new Map();
// the timers for the bot to leave a VC, uses channel id
const leaveVCTimeout = new Map();
// login to discord
bot.login(token);
