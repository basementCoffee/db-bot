'use strict';
require('dotenv').config();
const token = process.env.TOKEN.replace(/\\n/gm, '\n');
const {exec} = require('child_process');
const wtf = require('wtfnode');
const version = require('../package.json').version;
const CH = require('../channel.json');
const {MessageEmbed} = require('discord.js');
const {getData} = require("spotify-url-info");
const ytdl = require('ytdl-core-discord');
const ytsr = require('ytsr');
const ytpl = require('ytpl');
let scdl = require("scdl-core").SoundCloud.create().then(x => scdl = x);
const m3u8stream = require('m3u8stream');
const twitch = require('twitch-m3u8');
const {gsrun, deleteRows, gsUpdateOverwrite} = require('./database/backend');
const {
  runAddCommand, runDeleteItemCommand, updateServerPrefix, runUniversalSearchCommand, getXdb
} = require('./database/frontend');
const {
  formatDuration, createEmbed, sendRecommendation, botInVC, adjustQueueForPlayNow, verifyUrl, verifyPlaylist,
  resetSession, convertYTFormatToMS, setSeamless, getQueueText, updateActiveEmbed, getHelpList, initializeServer,
  runSearchCommand, runHelpCommand, getTitle, linkFormatter, endStream, unshiftQueue, pushQueue, shuffleQueue,
  createQueueItem, getLinkType, createMemoryEmbed
} = require('./utils/utils');
const {
  hasDJPermissions, runDictatorCommand, runDJCommand, voteSystem, clearDJTimer, runResignCommand
} = require('./playback/dj');
const {runLyricsCommand} = require('./playback/lyrics');
const {addPlaylistToQueue, getPlaylistItems} = require('./playback/playlist');
const {
  MAX_QUEUE_S, servers, bot, checkActiveMS, setOfBotsOn, commandsMap, whatspMap, dispatcherMap, dispatcherMapStatus,
  botID, SPOTIFY_BASE_LINK, SOUNDCLOUD_BASE_LINK, TWITCH_BASE_LINK, LEAVE_VC_TIMEOUT, StreamType, startupDevMode,
  buildNo
} = require('./utils/constants');
const {reactions} = require('./utils/reactions');

process.setMaxListeners(0);

/**
 * Determines whether the message contains a form of congratulations.
 * @param word {string} The text to compare.
 * @returns {*} true if congrats is detected.
 */
function contentContainCongrats (word) {
  return (word.includes('grats') || word.includes('ongratulations') || word.includes('omedetou'));
}

let devMode = startupDevMode;
let isInactive = !devMode;

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
      playLinkToVC(message, server.queue[0], voiceChannel, server).then();
    } else if (server.autoplay && link) {
      runAutoplayCommand(message, server, voiceChannel, server.queueHistory[server.queueHistory.length - 1]).then();
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
 * Determines what to play from a word, dependent on sheetName. The word is provided from args[1].
 * Uses the database if a sheetName is provided, else uses YouTube.
 * @param message The message metadata.
 * @param args The args pertaining the content.
 * @param sheetName Optional - The sheet to reference.
 * @param server The server data.
 * @param mgid The guild id.
 * @param playNow Whether to play now.
 */
function playFromWord (message, args, sheetName, server, mgid, playNow) {
  if (sheetName) {
    runDatabasePlayCommand(args, message, sheetName, playNow, false, server).then();
  } else {
    runYoutubeSearch(message, playNow, server, args.map(x => x).splice(1).join('')).then();
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
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message) && args[1]) {
      setSeamless(server, runPlayNowCommand, [message, args, mgid, server, sheetName], sentMsg);
    }
    return;
  }
  if (server.dictator && message.member.id !== server.dictator.id)
    return message.channel.send('only the dictator can play perform this action');
  if (server.lockQueue && server.voteAdmin.filter(x => x.id === message.member.id).length === 0)
    return message.channel.send('the queue is locked: only the dj can play and add links');
  if (!args[1]) {
    return message.channel.send('What should I play now? Put a link or some words after the command.');
  }
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  } else if (server.queue.length >= MAX_QUEUE_S) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin))
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  server.numSinceLastEmbed += 2;
  if (args[1].includes('.')) {
    if (args[1][0] === '<' && args[1][args[1].length - 1] === '>') {
      args[1] = args[1].substr(1, args[1].length - 2);
    }
    if (!(verifyPlaylist(args[1]) || verifyUrl(args[1])))
      return playFromWord(message, args, sheetName, server, mgid, true);
  } else return playFromWord(message, args, sheetName, server, mgid, true);
  // places the currently playing into the queue history if played long enough
  adjustQueueForPlayNow(dispatcherMap[voiceChannel.id], server);
  // the number of added links
  let pNums = 0;
  // counter to iterate over all args - excluding args[0]
  let linkItem = args.length - 1;
  while (linkItem > 0) {
    let url = args[linkItem];
    if (url[url.length - 1] === ',') url = url.replace(/,/, '');
    pNums += await addLinkToQueue(url, message, server, mgid, true, unshiftQueue);
    linkItem--;
  }
  message.channel.send('*playing now*');
  playLinkToVC(message, server.queue[0], voiceChannel, server, 0).then();
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
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message) && args[1]) {
      setSeamless(server, runPlayLinkCommand, [message, args, mgid, server, sheetName], sentMsg);
    }
    return;
  }
  if (!args[1]) {
    if (runPlayCommand(message, message.member, server, true)) return;
    return message.channel.send('What should I play? Put a link or some words after the command.');
  }
  if (server.dictator && message.member.id !== server.dictator.id)
    return message.channel.send('only the dictator can perform this action');
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  } else if (server.queue.length >= MAX_QUEUE_S) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (servers[message.guild.id].lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin))
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  if (args[1].includes('.')) {
    if (args[1][0] === '<' && args[1][args[1].length - 1] === '>') {
      args[1] = args[1].substr(1, args[1].length - 2);
    }
    if (!(verifyPlaylist(args[1]) || verifyUrl(args[1])))
      return playFromWord(message, args, sheetName, server, mgid, false);
  } else return playFromWord(message, args, sheetName, server, mgid, false);
  // valid link
  let queueWasEmpty = false;
  if (server.queue.length < 1) {
    queueWasEmpty = true;
  }
  // the number of added links
  let pNums = 0;
  // counter to iterate over remaining link args
  let linkItem = 1;
  while (args[linkItem]) {
    let url = args[linkItem];
    if (url[url.length - 1] === ',') url = url.replace(/,/, '');
    pNums += await addLinkToQueue(args[linkItem], message, server, mgid, false, pushQueue);
    linkItem++;
  }
  // if queue was empty then play
  if (queueWasEmpty) {
    playLinkToVC(message, server.queue[0], message.member.voice.channel, server, 0).then();
  } else {
    message.channel.send('*added ' + (pNums < 2 ? '' : (pNums + ' ')) + 'to queue*');
    await updateActiveEmbed(server);
  }
}

/**
 * Adds the link to the queue. Also works for playlist links.
 * @param url The link to add to the queue.
 * @param message The message metadata.
 * @param server The server.
 * @param mgid The message guild id.
 * @param addToFront {boolean} If to add to the front.
 * @param queueFunction {Function} A function that adds a given link to the server queue.
 * @returns {Promise<Number>} The number of items added.
 */
async function addLinkToQueue (url, message, server, mgid, addToFront, queueFunction) {
  if (url.includes(SPOTIFY_BASE_LINK)) {
    url = linkFormatter(url, SPOTIFY_BASE_LINK);
    return await addPlaylistToQueue(message, server.queue, 0, url, StreamType.SPOTIFY, addToFront);
  } else if (ytpl.validateID(url) || url.includes('music.youtube')) {
    url = url.replace(/music.youtube/, 'youtube');
    return await addPlaylistToQueue(message, server.queue, 0, url, StreamType.YOUTUBE, addToFront);
  } else if (url.includes(SOUNDCLOUD_BASE_LINK) && verifyPlaylist(linkFormatter(url, SOUNDCLOUD_BASE_LINK))) {
    url = linkFormatter(url, SOUNDCLOUD_BASE_LINK);
    return await addPlaylistToQueue(message, server.queue, 0, url, StreamType.SOUNDCLOUD, addToFront);
  } else {
    queueFunction(server, createQueueItem(url, (url.includes(TWITCH_BASE_LINK) ? StreamType.TWITCH : StreamType.YOUTUBE), null));
    return 1;
  }
}

/**
 * Restarts the song playing and what was within an older session.
 * @param message The message that triggered the bot.
 * @param mgid The message guild id.
 * @param keyword Enum in string format, being either 'restart' or 'replay'.
 * @param server The server playback metadata.
 * @returns {*}
 */
async function runRestartCommand (message, mgid, keyword, server) {
  if (!server.queue[0] && !server.queueHistory) return message.channel.send('must be actively playing to ' + keyword);
  if (server.dictator && message.member.id !== server.dictator.id)
    return message.channel.send('only the dictator can ' + keyword);
  if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member)) {
    return message.channel.send('as of right now, only the DJ can restart tracks');
  }
  if (server.queue[0]) {
    await playLinkToVC(message, server.queue[0], message.member.voice.channel, server);
  } else if (server.queueHistory.length > 0) {
    server.queue.unshift(server.queueHistory.pop());
    await playLinkToVC(message, server.queue[0], message.member.voice.channel, server);
  } else {
    message.channel.send('there is nothing to ' + keyword);
  }
}

/**
 * The execution for all bot commands
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
async function runCommandCases (message) {
  const mgid = message.guild.id;
  // the server guild playback data
  if (!servers[mgid]) initializeServer(mgid);
  const server = servers[mgid];
  if (devMode) server.prefix = '='; // devmode prefix
  if (server.currentEmbedChannelId === message.channel.id && server.numSinceLastEmbed < 10) {
    server.numSinceLastEmbed++;
  }
  // the server prefix
  let prefixString = server.prefix;
  if (!prefixString) {
    await updateServerPrefix(server, mgid);
    prefixString = server.prefix;
  }
  const firstWordBegin = message.content.substr(0, 14).trim() + ' ';
  const fwPrefix = firstWordBegin.substr(0, 1);
  // for all non-commands
  if (fwPrefix !== prefixString) {
    if (devMode) return;
    if (firstWordBegin === '.db-bot ') {
      return message.channel.send('Current prefix is: ' + prefixString);
    }
    // scan the first word
    if (contentContainCongrats(firstWordBegin)) {
      if (!botInVC(message)) {
        server.queue.length = 0;
        server.queueHistory.length = 0;
        server.loop = false;
      }
      server.numSinceLastEmbed++;
      const args = message.content.toLowerCase().replace(/\s+/g, ' ').split(' ');
      let indexOfWord;
      const findIndexOfWord = (word) => {
        for (let w in args) {
          if (args[w].includes(word)) {
            indexOfWord = w;
            return w;
          }
        }
        return -1;
      };
      let name;
      if (findIndexOfWord('grats') !== -1 || findIndexOfWord('congratulations') !== -1) {
        name = args[parseInt(indexOfWord) + 1];
        const excludedWords = ['on', 'the', 'my', 'for', 'you', 'dude', 'to', 'from', 'with', 'by'];
        if (excludedWords.includes(name)) name = '';
        if (name && name.length > 1) name = name.substr(0, 1).toUpperCase() + name.substr(1);
      } else {
        name = '';
      }
      commandsMap.set('congrats', (commandsMap.get('congrats') || 0) + 1);
      const randomEmojis = ['🥲', '😉', '😇', '😗', '😅', '🥳', '😄'];
      const randENum = Math.floor(Math.random() * randomEmojis.length);
      const oneInThree = Math.floor(Math.random() * 3);
      const text = (oneInThree === 0 ? '!   ||*I would\'ve sung for you in a voice channel*  '
        + randomEmojis[randENum] + '||' : '!');
      message.channel.send('Congratulations' + (name ? (' ' + name) : '') +
        ((message.member.voice && message.member.voice.channel) ?
          '!' : text));
      const congratsLink = (message.content.includes('omedetou') ? 'https://www.youtube.com/watch?v=hf1DkBQRQj4' : 'https://www.youtube.com/watch?v=oyFQVZ2h0V8');
      if (server.queue[0] !== congratsLink) server.queue.unshift(createQueueItem(congratsLink, StreamType.YOUTUBE, null));
      else return;
      if (message.member.voice?.channel) {
        const vc = message.member.voice.channel;
        setTimeout(() => {
          if (whatspMap[vc.id] === congratsLink && parseInt(dispatcherMap[vc.id].streamTime) > 18000)
            skipLink(message, vc, false, server, true);
          const item = server.queueHistory.indexOf(congratsLink);
          if (item !== -1)
            server.queueHistory.splice(item, 1);
        }, 20000);
        return playLinkToVC(message, congratsLink, vc, servers[mgid]).then(() => {
          setTimeout(() => servers[mgid].silence = false, 400);
          const item = server.queueHistory.indexOf(congratsLink);
          if (item !== -1)
            server.queueHistory.splice(item, 1);
        });
      }
    }
    return;
  }
  const args = message.content.replace(/\s+/g, ' ').split(' ');
  const statement = args[0].substr(1).toLowerCase();
  if (statement.substr(0, 1) === 'g' && statement !== 'guess') {
    if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
      return;
    }
  } else {
    commandsMap.set(statement, (commandsMap.get(statement) || 0) + 1);
  }
  if (message.channel.id === server.currentEmbedChannelId) server.numSinceLastEmbed += 2;
  switch (statement) {
    case 'db-bot':
      runHelpCommand(message, server, version);
      break;
    // the normal play command
    case 'play':
    case 'p':
      runPlayLinkCommand(message, args, mgid, server, undefined).then();
      break;
    case 'mplay':
    case 'mp':
      runPlayLinkCommand(message, args, mgid, server, `p${message.member.id}`).then();
      break;
    // test purposes - play command
    case 'gplay':
    case 'gp':
      runPlayLinkCommand(message, args, mgid, server, 'entries').then();
      break;
    // test purposes - play now command
    case 'gpnow':
    case 'gpn':
      runPlayNowCommand(message, args, mgid, server, 'entries').then();
      break;
    // the play now command
    case 'pnow':
    case 'playnow':
    case 'pn':
      runPlayNowCommand(message, args, mgid, server, undefined).then();
      break;
    // the personal play now command
    case 'mplaynow':
    case 'mpnow':
    case 'mpn':
      runPlayNowCommand(message, args, mgid, server, `p${message.member.id}`).then();
      break;
    // stop session commands
    case 'disconnect':
    case 'quit':
    case 'leave':
    case 'end':
    case 'e':
      runStopPlayingCommand(mgid, message.member.voice.channel, false, server, message, message.member);
      break;
    case 'autoplay':
    case StreamType.SPOTIFY:
    case 'smartp':
    case 'smartplay':
      if (!botInVC(message)) return message.channel.send('must be playing something to use smartplay');
      if (server.autoplay) {
        server.autoplay = false;
        message.channel.send('*smartplay turned off*');
      } else {
        server.autoplay = true;
        message.channel.send('*smartplay turned on*');
      }
      updateActiveEmbed(server).then();
      break;
    case 'l':
    case 'loop':
      if (!botInVC(message)) {
        // only send error message for 'loop' command
        if (args[0].length > 1) await message.channel.send('must be actively playing to loop');
        return;
      }
      if (server.loop) {
        server.loop = false;
        await message.channel.send('*looping disabled*');
      } else {
        server.loop = true;
        await message.channel.send('*looping enabled (occurs on finish)*');
      }
      break;
    case 'lyric':
    case 'lyrics':
      runLyricsCommand(message, mgid, args, server);
      break;
    // test purposes - run database links
    case 'gd':
      runDatabasePlayCommand(args, message, 'entries', false, true, server).then();
      break;
    // test purposes - run database command
    case 'gdnow':
    case 'gdn':
      runDatabasePlayCommand(args, message, 'entries', true, true, server).then();
      break;
    // test purposes - run database command
    case 'gkn':
    case 'gknow':
      runDatabasePlayCommand(args, message, 'entries', true, true, server).then();
      break;
    // .d is the normal play link from database command
    case 'd':
      runDatabasePlayCommand(args, message, mgid, false, false, server).then();
      break;
    case 'know':
    case 'kn':
    case 'dnow':
    case 'dn':
      runPlayNowCommand(message, args, mgid, server, mgid).then();
      break;
    // .md is retrieves and plays from the keys list
    case 'md':
      runDatabasePlayCommand(args, message, `p${message.member.id}`, false, true, server).then();
      break;
    // .mdnow retrieves and plays from the keys list immediately
    case 'mkn':
    case 'mknow':
    case 'mdnow':
    case 'mdn':
      runPlayNowCommand(message, args, mgid, server, `p${message.member.id}`).then();
      break;
    // .r is a random that works with the normal queue
    case 'random':
    case 'rand':
    case 'r':
      runRandomToQueue(args[1] || 1, message, mgid, server).then();
      break;
    case 'shuffle':
      runRandomToQueue(args[1], message, mgid, server).then();
      break;
    case 'rn':
    case 'randnow':
    case 'randomnow':
      runRandomToQueue(args[1] || 1, message, mgid, server, true).then();
      break;
    case 'shufflen':
    case 'shufflenow':
      runRandomToQueue(args[1], message, mgid, server, true).then();
      break;
    // test purposes - random command
    case 'grand':
    case 'gr':
      runRandomToQueue(args[1] || 1, message, 'entries', server).then();
      break;
    case 'gshuffle':
      runRandomToQueue(args[1], message, 'entries', server).then();
      break;
    // .mr is the personal random that works with the normal queue
    case 'mrand':
    case 'mr':
      runRandomToQueue(args[1] || 1, message, `p${message.member.id}`, server).then();
      break;
    case 'mshuffle':
      runRandomToQueue(args[1], message, `p${message.member.id}`, server).then();
      break;
    case 'mrn':
    case 'mrandnow':
      runRandomToQueue(args[1] || 1, message, `p${message.member.id}`, server, true).then();
      break;
    case 'mshufflen':
    case 'mshufflenow':
      runRandomToQueue(args[1], message, `p${message.member.id}`, server, true).then();
      break;
    // .keys is server keys
    case 'k':
    case 'key':
    case 'keys':
      if (args[1]) runDatabasePlayCommand(args, message, mgid, false, false, server).then();
      else runKeysCommand(message, server, mgid, '', '', '').then();
      break;
    // .mkeys is personal keys
    case 'mk':
    case 'mkey':
    case 'mkeys':
      if (args[1]) runDatabasePlayCommand(args, message, `p${message.member.id}`, false, false, server).then();
      else runKeysCommand(message, server, `p${message.member.id}`, 'm', '', '').then();
      break;
    // test purposes - return keys
    case 'gk':
    case 'gkey':
    case 'gkeys':
      runKeysCommand(message, server, 'entries', 'g', '', '').then();
      break;
    // .search is the search
    case 'find':
    case 'lookup':
    case 'search':
      runUniversalSearchCommand(message, server, mgid, (args[1] ? args[1] : server.queue[0]?.url)).then();
      break;
    // .m is the personal search command
    case 'ml':
    case 'ms':
      if (botInVC(message) || args[0])
        runUniversalSearchCommand(message, server, `p${message.member.id}`, (args[1] ? args[1] : server.queue[0]?.url)).then();
      break;
    case 'mfind':
    case 'mlookup':
    case 'msearch':
      runUniversalSearchCommand(message, server, `p${message.member.id}`, (args[1] ? args[1] : server.queue[0]?.url)).then();
      break;
    case 'gfind':
    case 'glookup':
    case 'gsearch':
      runUniversalSearchCommand(message, server, `entries`, (args[1] ? args[1] : server.queue[0]?.url)).then();
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
        return gsrun('A', 'B', `p${message.member.id}`).then((xdb) =>
          message.channel.send('Personal list size: ' + (xdb.dsInt - 1))
        );
      }
      break;
    case 'ticket':
      if (args[1]) {
        args[0] = '';
        dmHandler(message, args.join(''));
        message.channel.send('Your message has been sent');
      } else return message.channel.send('*input a message after the command to submit a request/issue*');
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
    case 'mnow':
    case 'mwhat':
      await runWhatsPCommand(message, message.member.voice.channel, args[1], `p${message.member.id}`, 'm');
      break;
    case 'gurl':
    case 'glink':
      if (!args[1]) {
        if (server.queue[0] && message.member.voice.channel) {
          return message.channel.send(server.queue[0]);
        } else {
          return message.channel.send('*add a key to get it\'s ' + statement.substr(1) + ' \`(i.e. ' + statement + ' [key])\`*');
        }
      }
      await runWhatsPCommand(message, message.member.voice.channel, args[1], 'entries', 'g');
      break;
    case 'url':
    case 'link':
      if (!args[1]) {
        if (server.queue[0] && message.member.voice.channel) {
          return message.channel.send(server.queue[0]);
        } else {
          return message.channel.send('*add a key to get it\'s ' + statement + ' \`(i.e. ' + statement + ' [key])\`*');
        }
      }
      await runWhatsPCommand(message, message.member.voice.channel, args[1], mgid, '');
      break;
    case 'ping':
      message.channel.send(`latency is ${Math.round(bot.ws.ping)}ms`);
      break;
    case 'rec':
    case 'recc':
    case 'reccomend':
    case 'reccommend':
    case 'recommend':
      args[0] = '';
      let rUrl = server.queue[0];
      if (args[1] && verifyUrl(args[1])) {
        rUrl = args[1];
        args[1] = '';
      } else if (args.length > 2 && verifyUrl(args[args.length - 1])) {
        rUrl = args[args.length - 1];
        args[args.length - 1] = '';
      }
      sendRecommendation(message, args.join(' ').trim(), rUrl, bot.users).then();
      break;
    case 'murl':
    case 'mlink':
      if (!args[1]) {
        if (server.queue[0] && message.member.voice.channel) {
          return message.channel.send(server.queue[0]);
        } else {
          return message.channel.send('*add a key to get it\'s ' + statement.substr(1) + ' \`(i.e. ' + statement + ' [key])\`*');
        }
      }
      await runWhatsPCommand(message, message.member.voice.channel, args[1], `p${message.member.id}`, 'm');
      break;
    case 'rm':
    case 'remove':
      if (!message.member.voice.channel) return message.channel.send('you must be in a voice channel to remove items from the queue');
      if (server.dictator && message.member.id !== server.dictator.id)
        return message.channel.send('only the dictator can remove');
      if (server.voteAdmin.length > 0 && server.voteAdmin.filter(x => x.id === message.member.id).length === 0)
        return message.channel.send('only a dj can remove');
      if (server.queue.length < 2) return message.channel.send('*cannot remove from an empty queue*');
      let rNum = parseInt(args[1]);
      if (!rNum) {
        if (server.queue.length === 2) rNum = 1;
        else return message.channel.send((`Needed a position in the queue to remove (1-${(server.queue.length - 1)})` +
          `\n***1** is next up in the queue, **${(server.queue.length - 1)}** is the last item in the queue \` Ex: ${prefixString}remove 2\`*`));
      }
      if (rNum >= server.queue.length) return message.channel.send('*that position is out of bounds, **' +
        (server.queue.length - 1) + '** is the last item in the queue.*');
      server.queue.splice(rNum, 1);
      message.channel.send('removed item from queue');
      break;
    case 'input':
    case 'insert':
      runInsertCommand(message, mgid, args[1], args[2], server).then();
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
          await runDeleteItemCommand(message, args[1], 'prefixes', false);
          await runAddCommand(args, message, 'prefixes', false);
          await gsrun('A', 'B', 'prefixes').then(async (xdb) => {
            await gsUpdateOverwrite(xdb.congratsDatabase.size + 2, 1, 'prefixes', xdb.dsInt);
            server.prefix = args[2];
            message.channel.send(`Prefix successfully changed to ${args[2]}`);
            prefixString = ('\\' + args[2]).substr(-1, 1);
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

            if (!message.guild.me.nickname || (message.guild.me.nickname.substr(0, 1) !== '['
              && message.guild.me.nickname.substr(2, 1) !== ']')) {
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
                      message.channel.send('ok, prefix is: ' + prefixString);
                    }
                  })
                  .catch(() => {
                    message.channel.send('prefix is now: ' + prefixString);
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
      runHelpCommand(message, server, version);
      break;
    // !skip
    case 'next':
    case 'sk':
    case 'skip':
      runSkipCommand(message, message.member.voice.channel, server, args[1], true, false, message.member);
      break;
    case 'dic' :
    case 'dict' :
    case 'dictator' :
      runDictatorCommand(message, mgid, prefixString, server);
      break;
    case 'voteskip':
    case 'vote':
    case 'dj':
      runDJCommand(message, server);
      break;
    case 'fs' :
    case 'fsk' :
    case 'forcesk':
    case 'forceskip' :
      if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
        runSkipCommand(message, message.member.voice.channel, server, args[1], true, true, message.member);
      }
      break;
    case 'fr':
    case 'frw':
    case 'forcerw':
    case 'forcerewind':
      if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
        runRewindCommand(message, mgid, message.member.voice.channel, args[1], true, false, message.member, server);
      }
      break;
    case 'fp':
      if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
        message.channel.send('use \'fpl\' to force play and \'fpa\' to force pause.');
      }
      break;
    case 'fpl' :
    case 'forcepl':
    case 'forceplay' :
      if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
        runPlayCommand(message, message.member, server, false, true);
      }
      break;
    case 'fpa' :
    case 'forcepa':
    case 'forcepause' :
      if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
        runPauseCommand(message, message.member, server, false, true);
      }
      break;
    case 'lock-queue':
      if (server.voteAdmin.filter(x => x.id === message.member.id).length > 0) {
        if (server.lockQueue) message.channel.send('***the queue has been unlocked:*** *any user can add to it*');
        else message.channel.send('***the queue has been locked:*** *only the dj can add to it*');
        server.lockQueue = !server.lockQueue;
      } else {
        message.channel.send('only a dj can lock the queue');
      }
      break;
    case 'resign':
      runResignCommand(message, server);
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
      if (!message.member.voice.channel) message.channel.send('must be in a voice channel');
      else if (dispatcherMap[message.member.voice.channel.id])
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      else message.channel.send('nothing is playing right now');
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
    // .ga adds to the test database
    case 'ga':
    case 'gadd':
      runAddCommandWrapper(message, args, 'entries', true, 'g', server);
      break;
    // .a is normal add
    case 'a':
    case 'add':
      runAddCommandWrapper(message, args, mgid, true, '', server);
      break;
    // .ma is personal add
    case 'ma':
    case 'madd':
      runAddCommandWrapper(message, args, `p${message.member.id}`, true, 'm', server);
      break;
    // .del deletes database entries
    case 'del':
    case 'delete':
      server.userKeys.set(mgid, null);
      runDeleteItemCommand(message, args[1], mgid, true).catch((e) => console.log(e));
      break;
    case 'soundcloud':
      message.channel.send(`*try the play command with a soundcloud link \` Ex: ${prefixString}play [SOUNDCLOUD_URL]\`*`);
      break;
    case 'twitch':
      if (!args[1]) return message.channel.send(`*no channel name provided \` Ex: ${prefixString}twitch [channel]\`*`);
      if (message.member.voice?.channel) {
        args[1] = `https://www.${TWITCH_BASE_LINK}/${args[1]}`;
        server.queue.unshift(createQueueItem(args[1], StreamType.TWITCH, null));
        playLinkToVC(message, args[1], message.member.voice.channel, server).then();
      } else {
        message.channel.send('*must be in a voice channel*');
      }
      break;
    // test remove database entries
    case 'grm':
    case 'gdel':
    case 'gdelete':
    case 'gremove':
      server.userKeys.set('entries', null);
      runDeleteItemCommand(message, args[1], 'entries', true).catch((e) => console.log(e));
      break;
    // .mrm removes personal database entries
    case 'mrm':
    case 'mdel':
    case 'mremove':
    case 'mdelete':
      server.userKeys.set(`p${message.member.id}`, null);
      runDeleteItemCommand(message, args[1], `p${message.member.id}`, true).catch((e) => console.log(e));
      break;
    case 'prev':
    case 'previous':
    case 'rw':
    case 'rew':
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
    case 'empty':
    case 'clear' :
      if (!message.member.voice.channel) return message.channel.send('must be in a voice channel to clear');
      if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member))
        return message.channel.send('only the DJ can clear the queue');
      if (server.dictator && server.dictator.id !== message.member.id)
        return message.channel.send('only the Dictator can clear the queue');
      const currentQueueItem = (botInVC(message)) ? server.queue[0] : undefined;
      server.queue.length = 0;
      server.queueHistory.length = 0;
      if (currentQueueItem) {
        server.queue[0] = currentQueueItem;
        await sendLinkAsEmbed(message, currentQueueItem, message.member.voice.channel, server);
      }
      message.channel.send('The queue has been scrubbed clean');
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
        sendLinkAsEmbed(message, server.queue[0], message.member.voice.channel, server).then();
      }
      break;
    // print out the version number
    case 'version':
      const vEmbed = new MessageEmbed();
      vEmbed.setTitle('Version').setDescription('[' + version + '](https://github.com/Reply2Zain/db-bot)');
      message.channel.send(vEmbed);
      break;
    case 'gzmem':
      if (args[1] === 'wtf') {
        wtf.dump();
      }
      message.channel.send(createMemoryEmbed());
      break;
    // dev commands for testing purposes
    case 'gzh':
      const devCEmbed = new MessageEmbed()
        .setTitle('Dev Commands')
        .setDescription(
          '**calibrate the active bot**' +
          '\n' + prefixString + 'gzs - statistics for the active bot' +
          '\n' + prefixString + 'gzq - quit/restarts the active bot' +
          '\n' + prefixString + 'gzmem - see the process\'s memory usage' +
          '\n' + prefixString + 'gzupdate - updates the pi instance of the bot' +
          '\n' + prefixString + 'gzsms [message] - set a startup message for all users on voice channel join' +
          '\n' + prefixString + 'gzm update - sends a message to all active guilds that the bot will be updating' +
          '\n' + prefixString + 'gzc - view commands stats' +
          '\n\n**calibrate multiple/other bots**' +
          '\n=gzl - return all bot\'s ping and latency' +
          '\n=gzk - start/kill a process' +
          '\n=gzd [process #] - toggle dev mode' +
          '\n\n**other commands**' +
          '\n' + prefixString + 'gzid - guild, bot, and member id' +
          '\ndevadd - access the database'
        )
        .setFooter('version: ' + version);
      message.channel.send(devCEmbed);
      break;
    case 'gzupdate':
      if (process.pid === 4) return;
      if (args[1] === 'all') {
        exec('git pull && npm upgrade && pm2 restart 0 && pm2 restart 1');
      } else if (args[1] === 'custom' && args[2]) {
        exec(args.slice(2).join(''));
      } else {
        exec('git pull && npm upgrade && pm2 restart index');
      }
      message.channel.send('updating process...');
      break;
    case 'gzc':
      const commandsMapEmbed = new MessageEmbed();
      let commandsMapString = '';
      const commandsMapArray = [];
      let CMAInt = 0;
      commandsMap.forEach((value, key) => {
        commandsMapArray[CMAInt++] = [key, value];
      });
      commandsMapArray.sort((a, b) => b[1] - a[1]);
      commandsMapArray.forEach((val) => {
        commandsMapString += val[1] + ' - ' + val[0] + '\n';
      });
      commandsMapEmbed.setTitle('Commands Usage - Stats').setDescription(commandsMapString);
      message.channel.send(commandsMapEmbed);
      break;
    case 'gzq':
      if (devMode) return;
      if (bot.voice.connections.size > 0 && args[1] !== 'force')
        message.channel.send('People are using the bot. Use this command again with \'force\' to restart the bot');
      else message.channel.send("restarting the bot... (may only shutdown)").then(() => {shutdown('USER')();});
      break;
    case 'gzid':
      message.channel.send(`g: ${message.guild.id}, b: ${bot.user.id}, m: ${message.member.id}`);
      break;
    case 'gzsms':
      if (args[1]) {
        if (args[1] === 'clear') {
          startUpMessage = '';
          return message.channel.send('start up message is cleared');
        }
        startUpMessage = message.content.substr(message.content.indexOf(args[1]));
        Object.values(servers).forEach(x => x.startUpMessage = false);
        message.channel.send('new startup message is set');
      } else if (startUpMessage) {
        message.channel.send(`current start up message:\n\`${startUpMessage}\`\ntype **gzsm clear** to clear the startup message`);
      } else message.channel.send('*there is no startup message right now*');
      break;
    case 'gzs':
      const embed = new MessageEmbed()
        .setTitle('db bot - statistics')
        .setDescription('version: ' + version +
          '\nbuild: ' + buildNo +
          '\nprocess: ' + process.pid.toString() +
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
          // noinspection JSUnresolvedFunction
          bot.voice.connections.map(x => bot.channels.cache.get(x.channel.guild.systemChannelID).send('db bot is about to be updated. This may lead to a temporary interruption.'));
          message.channel.send('Update message sent to ' + bot.voice.connections.size + ' channels.');
        } else {
          message.channel.send('The active bot is not running on Heroku so a git push would not interrupt listening.\n' +
            'To still send out an update use \'gzm update force\'');
        }
      } else if (args[1] === 'listu') {
        let gx = '';
        let tgx;
        const tempSet = new Set();
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
        if (message.member?.voice?.channel) {
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

bot.on('guildDelete', guild => {
  if (isInactive || devMode) return;
  gsrun('A', 'B', 'prefixes').then(async (xdb) => {
    for (let i = 0; i < xdb.line.length; i++) {
      const itemToCheck = xdb.line[i];
      if (itemToCheck === guild.id) {
        i += 1;
        await deleteRows('prefixes', i);
        break;
      }
    }
  });
});

bot.on('guildCreate', guild => {
  if (isInactive || devMode) return;
  guild.systemChannel.send("Type '.help' to see my commands.").then();
});

bot.once('ready', () => {
  // bot starts up as inactive, if no response from the channel then activates itself
  if (process.pid.toString() === '4') devMode = false;
  // noinspection JSUnresolvedFunction
  if (devMode) {
    console.log('-devmode enabled-');
  } else {
    checkStatusOfYtdl();
    isInactive = true;
    bot.user.setActivity('music | .db-bot', {type: 'PLAYING'}).then();
    checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS);
    console.log('-starting up sidelined-');
    console.log('checking status of other bots...');
    // bot logs - startup
    // noinspection JSUnresolvedFunction
    bot.channels.cache.get(CH.process).send('starting up: ' + process.pid).then(() => {
      checkToSeeActive();
    });
  }
});

// calibrate on startup
bot.on('message', async (message) => {
  if (devMode || message.channel.id !== CH.process) return;
  // ~db-process (standard)[11] | -on [3] | 1 or 0 (vc size)[1] | 12345678 (build no)[8]
  // turn off active bots -- activates on '~db-process'
  if (message.content.substr(0, 11) === '~db-process') {
    // if seeing bots that are on
    if (message.content.substr(11, 3) === '-on') {
      const oBuildNo = message.content.substr(15, 8);
      // compare versions || check if actively being used (if so: keep on)
      if (parseInt(oBuildNo) >= parseInt(buildNo) || message.content.substr(14, 1) !== '0') {
        setOfBotsOn.add(oBuildNo);
      }
    } else if (message.content.substr(11, 4) === '-off') {
      // ~db-process [11] | -off [3] | 12345678 (build no) [8] | - [1]
      // compare process IDs
      if (message.content.substr(24).trim() !== process.pid.toString()) {
        isInactive = true;
        console.log('-sidelined-');
      } else isInactive = false;
    }
  }
});

/**
 * Helper for runInsertCommand. Does some preliminary verification.
 * @param message The message object.
 * @param server The server.
 * @param args {Array<string>} args[1] being the term, args[2] being the position.
 * @returns {*} 1 if passed
 */
function insertCommandVerification (message, server, args) {
  if (!message.member.voice.channel) return message.channel.send('must be in a voice channel');
  if (server.dictator && message.member.id !== server.dictator.id)
    return message.channel.send('only the dictator can insert');
  if (server.lockQueue && server.voteAdmin.filter(x => x.id === message.member.id).length === 0)
    return message.channel.send('the queue is locked: only the dj can insert');
  if (server.queue.length > MAX_QUEUE_S) return message.channel.send('*max queue size has been reached*');
  if (server.queue.length < 1) return message.channel.send('cannot insert when the queue is empty (use \'play\' instead)');
  if (!args[1]) return message.channel.send('put a link followed by the position in the queue \`(i.e. insert [link] [num])\`');
  if (args[2] && isNaN(parseInt(args[2]))) return message.channel.send('second argument must be a number');
  return 1;
}

/**
 * Inserts a term into position into the queue. Accepts a valid link or key.
 * @param message The message metadata.
 * @param mgid The message guild id.
 * @param term The word/link to add to the queue.
 * @param position The position to place in the queue.
 * @param server The server to use.
 * @returns {Promise<number>} The position to insert or a negative if failed.
 */
async function runInsertCommand (message, mgid, term, position, server) {
  const args = ['', term, position];
  if (insertCommandVerification(message, server, args) !== 1) return -1;
  if (!verifyUrl(args[1]) && !verifyPlaylist(args[1])) {
    let xdb = await getXdb(server, mgid);
    let link = xdb.referenceDatabase.get(args[1].toUpperCase());
    if (!link) {
      xdb = await getXdb(server, `p${message.member.id}`);
      link = xdb.referenceDatabase.get(args[1].toUpperCase());
    }
    if (!link) {
      message.channel.send('could not find the provided key in any keys list');
      return -1;
    } else args[1] = link;
  }
  let num = parseInt(args[2]);
  if (!num) {
    if (server.queue.length === 1) num = 1;
    else {
      const sentMsg = await message.channel.send('What position would you like to insert? (1-' + server.queue.length + ') [or type \'q\' to quit]');
      const filter = m => {
        return (message.author.id === m.author.id);
      };
      let messages = await sentMsg.channel.awaitMessages(filter, {time: 60000, max: 1, errors: ['time']});
      num = messages.first().content.trim();
      if (num.toLowerCase() === 'q') {
        message.channel.send('*cancelled*');
        return -1;
      } else {
        num = parseInt(num);
      }
      if (!num) {
        message.channel.send('*cancelled*');
        return -1;
      }
    }
  }
  if (num < 1) {
    if (num === 0) message.channel.send('0 changes what\'s actively playing, use the \'playnow\' command instead.');
    else message.channel.send('position must be a positive number');
    return -1;
  }
  if (num > server.queue.length) num = server.queue.length;
  let pNums = 0;
  if (verifyPlaylist(args[1])) {
    if (args[1].includes('/playlist/') && args[1].includes(SPOTIFY_BASE_LINK)) {
      args[1] = linkFormatter(args[1], SPOTIFY_BASE_LINK);
      pNums = await addPlaylistToQueue(message, server.queue, 0, args[1], StreamType.SPOTIFY, false, num);
    } else if (ytpl.validateID(args[1])) {
      pNums = await addPlaylistToQueue(message, server.queue, 0, args[1], StreamType.YOUTUBE, false, num);
    } else if (args[1].includes(SOUNDCLOUD_BASE_LINK)) {
      args[1] = linkFormatter(args[1], SOUNDCLOUD_BASE_LINK);
      pNums = await addPlaylistToQueue(message, server.queue, 0, args[1], StreamType.SOUNDCLOUD, false, num);
    } else {
      // noinspection JSUnresolvedFunction
      bot.channels.cache.get(CH.err).send('there was a playlist reading error: ' + args[1]);
      message.channel.send('there was a link reading issue');
      return -1;
    }
  } else {
    if (num > server.queue.length) num = server.queue.length;
    server.queue.splice(num, 0, createQueueItem(args[1], args[1].includes(TWITCH_BASE_LINK) ? StreamType.TWITCH : StreamType.YOUTUBE));
  }
  await message.channel.send(`inserted ${(pNums > 1 ? (pNums + ' links') : 'link')} into position ${num}`);
  await updateActiveEmbed(server);
  return num;
}

/**
 * Sends a message to a shared channel to see all active processes, responds accordingly using responseHandler.
 */
function checkToSeeActive () {
  setOfBotsOn.clear();
  // see if any bots are active
  // noinspection JSUnresolvedFunction
  bot.channels.cache.get(CH.process).send('=gzk').then(() => {
    if (!resHandlerTimeout) resHandlerTimeout = setTimeout(responseHandler, 9000);
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
        await bot.channels.cache.get(CH.err).send('ytdl status is unhealthy, shutting off bot');
        connection.disconnect();
        if (isInactive) setTimeout(() => process.exit(0), 2000);
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
 * Check to see if there was a response. If not then makes the current bot active.
 */
async function responseHandler () {
  resHandlerTimeout = null;
  if (setOfBotsOn.size < 1 && isInactive) {
    for (let server in servers) delete servers[server];
    const xdb = await gsrun('A', 'B', 'prefixes');
    for (const [gid, pfx] of xdb.congratsDatabase) {
      initializeServer(gid);
      servers[gid].prefix = pfx;
    }
    isInactive = false;
    devMode = false;
    console.log('-active-');
    // noinspection JSUnresolvedFunction
    bot.channels.cache.get(CH.process).send('~db-process-off' + buildNo + '-' +
      process.pid.toString());
    setTimeout(() => {
      if (isInactive) checkToSeeActive();
    }, ((Math.floor(Math.random() * 18) + 9) * 1000)); // 9 - 27 seconds
  } else if (setOfBotsOn.size > 1) {
    setOfBotsOn.clear();
    // noinspection JSUnresolvedFunction
    bot.channels.cache.get(CH.process).send('~db-process-off' + buildNo + '-' +
      process.pid.toString());
    setTimeout(() => {
      if (isInactive) checkToSeeActive();
    }, ((Math.floor(Math.random() * 5) + 3) * 1000)); // 3 - 7 seconds
  } else if (process.pid === 4) {
    if ((new Date()).getHours() === 5 && bot.uptime > 3600000 && bot.voice.connections.size < 1) {
      shutdown('HOUR(05)');
    }
  }
}

/**
 * Interpret developer process-related commands. Used for maintenance of multiple db bot instances.
 * @param message The message metadata.
 * @param zmsg The command letter.
 */
async function devProcessCommands (message, zmsg) {
  const zargs = message.content.split(' ');
  switch (zmsg) {
    case 'k':
      // =gzk
      if (message.member.id === '730350452268597300') {
        if (!isInactive && !devMode) {
          return message.channel.send(`~db-process-on${Math.min(bot.voice.connections.size, 9)}${buildNo}ver${process.pid}`);
        }
        return;
      }
      if (!zargs[1]) {
        let dm;
        if (devMode) {
          dm = ' (dev mode)';
        } else {
          dm = bot.voice.connections.size ? ' (VCs: ' + bot.voice.connections.size + ')' : '';
        }
        message.channel.send((isInactive ? 'sidelined: ' : (devMode ? 'active: ' : '**active: **')) + process.pid +
          ' (' + version + ')' + dm).then(sentMsg => {
          let devR = reactions.O_DIAMOND;
          if (devMode) {
            sentMsg.react(devR);
          } else {
            sentMsg.react(reactions.GEAR);
          }

          const filter = (reaction, user) => {
            return user.id !== botID && user.id === message.member.id &&
              [reactions.GEAR, devR].includes(reaction.emoji.name);
          };
          // updates the existing gzk message
          const updateMessage = () => {
            if (devMode) {
              dm = ' (dev mode)';
            } else {
              dm = bot.voice.connections.size ? ' (VCs: ' + bot.voice.connections.size + ')' : '';
            }
            try {
              sentMsg.edit((isInactive ? 'sidelined: ' : (devMode ? 'active: ' : '**active: **')) + process.pid +
                ' (' + version + ')' + dm);
            } catch (e) {
              message.channel.send('*db bot ' + process.pid + (isInactive ? ' has been sidelined*' : ' is now active*'));
            }
          };
          const collector = sentMsg.createReactionCollector(filter, {time: 30000});
          let prevVCSize = bot.voice.connections.size;
          let prevStatus = isInactive;
          let prevDevMode = devMode;
          const statusInterval = setInterval(() => {
            if (!(bot.voice.connections.size === prevVCSize && prevStatus === isInactive && prevDevMode === devMode)) {
              prevVCSize = bot.voice.connections.size;
              prevDevMode = devMode;
              prevStatus = isInactive;
              if (sentMsg.deletable) updateMessage();
              else clearInterval(statusInterval);
            }
          }, 4500);

          collector.on('collect', (reaction, user) => {
            if (reaction.emoji.name === reactions.GEAR) {
              if (!isInactive && bot.voice.connections.size > 0) {
                let hasDeveloper = false;
                if (bot.voice.connections.size === 1) {
                  bot.voice.connections.forEach(x => {
                    if (x.channel.members.get('730350452268597300') || x.channel.members.get('443150640823271436')) {
                      hasDeveloper = true;
                      x.disconnect();
                    }
                  });
                }
                if (!hasDeveloper) {
                  message.channel.send('***' + process.pid + ' - button is disabled***\n*This process should not be ' +
                    'sidelined because it has active members using it (VCs: ' + bot.voice.connections.size + ')*\n' +
                    '*If you just activated another process, please deactivate it.*');
                  return;
                }
              }
              isInactive = !isInactive;
              console.log((isInactive ? '-sidelined-' : '-active-'));
              if (sentMsg.deletable) {
                updateMessage();
                reaction.users.remove(user.id);
              }
            } else if (reaction.emoji.name === devR) {
              devMode = false;
              isInactive = true;
              if (!checkActiveInterval) checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS);
              if (sentMsg.deletable) updateMessage();
            }
          });
          collector.once('end', () => {
            clearInterval(statusInterval);
            if (sentMsg.deletable) {
              if (sentMsg.reactions) sentMsg.reactions.removeAll();
              updateMessage();
            }
          });
        });
      } else if (zargs[1] === 'all') {
        isInactive = true;
        console.log('-sidelined-');
      } else {
        let i = 1;
        while (zargs[i]) {
          if (zargs[i].replace(/,/g, '') === process.pid.toString()) {
            isInactive = !isInactive;
            message.channel.send('*db bot ' + process.pid + (isInactive ? ' has been sidelined*' : ' is now active*')).then();
            console.log((isInactive ? '-sidelined-' : '-active-'));
            return;
          }
          i++;
        }
      }
      break;
    case 'd':
      // =gzd
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
        isInactive = true;
        servers[message.guild.id] = null;
        return message.channel.send('*devmode is off* ' + process.pid.toString());
      } else if (zargs[1] === process.pid.toString()) {
        devMode = true;
        servers[message.guild.id] = null;
        if (checkActiveInterval) {
          clearInterval(checkActiveInterval);
          checkActiveInterval = null;
        }
        return message.channel.send('*devmode is on* ' + process.pid.toString());
      }
      break;
    case 'l':
      // =gzl
      message.channel.send(process.pid.toString() +
        `: Latency is ${Date.now() - message.createdTimestamp}ms.\nNetwork latency is ${Math.round(bot.ws.ping)}ms`);
      break;
    case 'q':
      // =gzq
      if (zargs[1] !== process.pid.toString()) return;
      if (bot.voice.connections.size > 0 && (!zargs[2] || zargs[2] !== 'force'))
        message.channel.send('People are using the bot. Use force as the second argument.').then();
      else message.channel.send("restarting the bot... (may only shutdown)").then(() =>
        setTimeout(() => {process.exit();}, 2000));
      break;
    case 'z':
      // =gzz
      if (message.author.bot && zargs[1] !== process.pid.toString()) {
        checkToSeeActive();
      }
      break;
    default:
      if (devMode && !isInactive) return runCommandCases(message);
      break;
  }
}

// parses message, provides a response
bot.on('message', (message) => {
  if (message.content.substr(0, 3) === '=gz' &&
    (message.member.id === '730350452268597300' ||
      message.member.id === '443150640823271436' ||
      message.member.id === '268554823283113985')) {
    return devProcessCommands(message, message.content.substr(3, 1));
  }
  if (message.author.bot || isInactive || (devMode && message.author.id !== '443150640823271436' &&
    message.author.id !== '268554823283113985' && message.author.id !== '799524729173442620' &&
    message.author.id !== '434532121244073984')) {
    return;
  }
  if (message.channel.type === 'dm') {
    return dmHandler(message, message.content);
  } else {
    return runCommandCases(message);
  }
});

/**
 * Handles message requests.
 * @param message The message metadata.
 * @param messageContent {string} The content of the message.
 * @returns {*}
 */
function dmHandler (message, messageContent) {
  // the message content - formatted in lower case
  let mc = messageContent.toLowerCase().trim() + ' ';
  if (mc.length < 9) {
    if (mc.length < 7 && mc.includes('help '))
      return message.author.send(getHelpList('.', 1, version)[0], version);
    else if (mc.includes('invite '))
      return message.channel.send('Here\'s the invite link!\n<https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot>');
  }
  const mb = reactions.OUTBOX;
  // noinspection JSUnresolvedFunction
  bot.channels.cache.get('870800306655592489')
    .send('------------------------------------------\n' +
      '**From: ' + message.author.username + '** (' + message.author.id + ')\n' +
      messageContent + '\n------------------------------------------').then(msg => {
    msg.react(mb).then();
    const filter = (reaction, user) => {
      return user.id !== botID;
    };

    const collector = msg.createReactionCollector(filter, {time: 86400000});

    collector.on('collect', (reaction, user) => {
      if (reaction.emoji.name === mb) {
        sendMessageToUser(msg, message.author.id, user.id);
        reaction.users.remove(user).then();
      }
    });
    collector.once('end', () => {
      msg.reactions.cache.get(mb).remove().then();
    });
  });
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
  if (actionUser.voice && message.guild.voice?.channel && dispatcherMap[actionUser.voice.channel.id]) {
    if (server.dictator && actionUser.id !== server.dictator.id)
      return message.channel.send('only the dictator can pause');
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        if (voteSystem(message, message.guild.id, 'pause', actionUser, server.votePlayPauseMembersId, server))
          noPrintMsg = true;
        else return;
      }
    }
    pauseComputation(actionUser.voice.channel);
    if (noPrintMsg) return true;
    if (server.followUpMessage) {
      server.followUpMessage.delete();
      server.followUpMessage = undefined;
    }
    message.channel.send('**paused**');
    return true;
  } else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    return false;
  }
}

/**
 * Pause a dispatcher. Force may have unexpected behaviour with the stream if used excessively.
 * @param voiceChannel The voice channel that the dispatcher is playing in.
 * @param force {boolean=} Ignores the status of the dispatcher.
 */
function pauseComputation (voiceChannel, force = false) {
  if (!dispatcherMapStatus[voiceChannel.id] || force) {
    dispatcherMap[voiceChannel.id].pause();
    dispatcherMap[voiceChannel.id].resume();
    dispatcherMap[voiceChannel.id].pause();
    dispatcherMapStatus[voiceChannel.id] = true;
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
  if (actionUser.voice && message.guild.voice?.channel && dispatcherMap[actionUser.voice.channel.id]) {
    if (server.dictator && actionUser.id !== server.dictator.id)
      return message.channel.send('only the dictator can play');
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        if (voteSystem(message, message.guild.id, 'play', actionUser, server.votePlayPauseMembersId, server))
          noPrintMsg = true;
        else return false;
      }
    }
    playComputation(actionUser.voice.channel);
    if (noPrintMsg) return true;
    if (server.followUpMessage) {
      server.followUpMessage.delete();
      server.followUpMessage = undefined;
    }
    message.channel.send('*playing*');
    return true;
  } else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    return false;
  }
}

/**
 * Plays a dispatcher. Force may have unexpected behaviour with the stream if used excessively.
 * @param voiceChannel The voice channel that the dispatcher is playing in.
 * @param force {boolean=} Ignores the status of the dispatcher.
 */
function playComputation (voiceChannel, force) {
  if (dispatcherMapStatus[voiceChannel.id] || force) {
    dispatcherMap[voiceChannel.id].resume();
    dispatcherMap[voiceChannel.id].pause();
    dispatcherMap[voiceChannel.id].resume();
    dispatcherMapStatus[voiceChannel.id] = false;
  }
}

/**
 * Prompts the text channel for a response to forward to the given user.
 * @param message The original message that activates the bot.
 * @param userID The ID of the user to send the reply to.
 * @param reactionUserID Optional - The ID of a user who can reply to the prompt besides the message author
 */
function sendMessageToUser (message, userID, reactionUserID) {
  const user = bot.users.cache.get(userID);
  message.channel.send('What would you like me to send to ' + user.username +
    '? [type \'q\' to not send anything]').then(msg => {
    const filter = m => {
      return ((message.author.id === m.author.id || reactionUserID === m.author.id) && m.author.id !== botID);
    };
    message.channel.awaitMessages(filter, {time: 60000, max: 1, errors: ['time']})
      .then(messages => {
        if (messages.first().content && messages.first().content.trim() !== 'q') {
          user.send(messages.first().content).then(() => {
            message.channel.send('Message sent to ' + user.username + '.');
            message.react(reactions.CHECK).then();
          });
        } else if (messages.first().content.trim().toLowerCase() === 'q') {
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
 * Wrapper for the function 'runAddCommand', for the purpose of error checking.
 * @param message The message that triggered the bot
 * @param args The args that of the message contents
 * @param sheetName The name of the sheet to add to
 * @param printMsgToChannel Whether to print a response to the channel
 * @param prefixString The prefix string
 * @param server The server.
 * @returns {*}
 */
function runAddCommandWrapper (message, args, sheetName, printMsgToChannel, prefixString, server) {
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin))
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  if (args[1]) {
    if (args[2]) {
      if (args[2].substr(0, 1) === '[' && args[2].substr(args[2].length - 1, 1) === ']') {
        args[2] = args[2].substr(1, args[2].length - 2);
      }
      if (!verifyUrl(args[2]) && !verifyPlaylist(args[2]))
        return message.channel.send(`You can only add links to the keys list. (Names cannot be more than one word) \` Ex: ${prefixString}add key [link]\``);
      server.userKeys.set(sheetName, null);
      if (args[2].includes(SPOTIFY_BASE_LINK)) args[2] = linkFormatter(args[2], SPOTIFY_BASE_LINK);
      else if (args[2].includes(SOUNDCLOUD_BASE_LINK)) args[2] = linkFormatter(args[2], SOUNDCLOUD_BASE_LINK);
      runAddCommand(args, message, sheetName, printMsgToChannel);
      return;
    } else if (message.member.voice.channel && server.queue[0]?.url) {
      args[2] = server.queue[0].url;
      if (args[1].includes('.')) return message.channel.send('cannot add names with \'.\'');
      message.channel.send('Would you like to add what\'s currently playing as **' + (args[1]) + '**?').then(sentMsg => {
        sentMsg.react(reactions.CHECK).then(() => sentMsg.react(reactions.X));

        const filter = (reaction, user) => {
          return botID !== user.id && [reactions.CHECK, reactions.X].includes(reaction.emoji.name) && message.member.id === user.id;
        };

        const collector = sentMsg.createReactionCollector(filter, {time: 60000, dispose: true});
        collector.once('collect', (reaction) => {
          sentMsg.delete();
          if (reaction.emoji.name === reactions.CHECK) {
            runAddCommand(args, message, sheetName, printMsgToChannel);
          } else {
            message.channel.send('*cancelled*');
          }
        });
        collector.on('end', () => {
          if (sentMsg.deletable && sentMsg.reactions) {
            sentMsg.reactions.removeAll().then(() => sentMsg.edit('*cancelled*'));
          }
        });
      });
      return;
    }
  }
  return message.channel.send('Could not add to ' + (prefixString === 'm' ? 'your' : 'the server\'s')
    + ' keys list. Put a desired name followed by a link. *(ex:\` ' + server.prefix + prefixString +
    args[0].substr(prefixString ? 2 : 1).toLowerCase() + ' [key] [link]\`)*');
}

/**
 * Prints the queue to the console
 * @param message The message that triggered the bot
 * @param mgid The message guild id
 * @param noErrorMsg Optional - Do not send error msg if not in a voice channel
 * @returns {Promise<void>|*}
 */
function runQueueCommand (message, mgid, noErrorMsg) {
  if (servers[mgid].queue < 1 || !message.guild.voice.channel) {
    if (noErrorMsg && !botInVC(message)) return;
    return message.channel.send('There is no active queue right now');
  }
  // a copy of the queue
  const serverQueue = servers[mgid].queue.map((x) => x);
  let qIterations = serverQueue.length;
  if (qIterations > 11) qIterations = 11;
  let authorName;
  const server = servers[mgid];

  async function generateQueue (startingIndex, notFirstRun, sentMsg, sentMsgArray) {
    let queueSB = '';
    const queueMsgEmbed = new MessageEmbed();
    if (!authorName) {
      authorName = await getTitle(serverQueue[0], 50);
    }
    const n = serverQueue.length - startingIndex - 1;
    let msg;
    if (!sentMsg) {
      let msgTxt = (notFirstRun ? 'generating ' + (n < 11 ? 'remaining ' + n : 'next 10') : 'generating queue') + '...';
      msg = await message.channel.send(msgTxt);
    }
    queueMsgEmbed.setTitle('Up Next')
      .setAuthor('playing:  ' + authorName)
      .setThumbnail('https://raw.githubusercontent.com/Reply2Zain/db-bot/master/assets/dbBotIconMedium.jpg');
    let sizeConstraint = 0;
    for (let qi = startingIndex + 1; (qi < qIterations && qi < serverQueue.length && sizeConstraint < 10); qi++) {
      const title = (await getTitle(serverQueue[qi]));
      const url = serverQueue[qi].url;
      queueSB += qi + '. ' + `[${title}](${url})\n`;
      sizeConstraint++;
    }
    if (queueSB.length === 0) {
      queueSB = 'queue is empty';
    }
    queueMsgEmbed.setDescription(queueSB);
    if (startingIndex + 11 < serverQueue.length) {
      queueMsgEmbed.setFooter('embed displays 10 at a time');
    }
    if (msg?.deletable) msg.delete();
    if (sentMsg?.deletable) {
      await sentMsg.edit(queueMsgEmbed);
    } else {
      sentMsg = await message.channel.send(queueMsgEmbed);
      sentMsgArray.push(sentMsg);
    }
    server.numSinceLastEmbed += 10;
    if (startingIndex + 11 < serverQueue.length) {
      sentMsg.react(reactions.ARROW_R).then(() => {
        if (!collector.ended)
          sentMsg.react(reactions.INBOX).then(() => {
            if (server.queue.length > 0 && !collector.ended)
              sentMsg.react(reactions.OUTBOX);
          });
      });
    } else sentMsg.react(reactions.INBOX).then(() => {if (server.queue.length > 0) sentMsg.react(reactions.OUTBOX);});
    const filter = (reaction, user) => {
      if (message.member.voice.channel) {
        for (const mem of message.member.voice.channel.members) {
          if (user.id === mem[1].id) {
            return user.id !== botID && [reactions.ARROW_R, reactions.INBOX, reactions.OUTBOX].includes(reaction.emoji.name);
          }
        }
      }
      return false;
    };
    const collector = sentMsg.createReactionCollector(filter, {time: 300000, dispose: true});
    const arrowReactionTimeout = setTimeout(() => {
      sentMsg.reactions.removeAll();
    }, 300500);
    collector.on('collect', (reaction, reactionCollector) => {
      if (reaction.emoji.name === reactions.ARROW_R && startingIndex + 11 < serverQueue.length) {
        clearTimeout(arrowReactionTimeout);
        collector.stop();
        sentMsg.reactions.removeAll();
        qIterations += 10;
        generateQueue(startingIndex + 10, true, false, sentMsgArray);
      } else if (reaction.emoji.name === reactions.INBOX) {
        if (server.dictator && reactionCollector.id !== server.dictator.id)
          return message.channel.send('only the dictator can insert');
        if (server.lockQueue && server.voteAdmin.filter(x => x.id === reactionCollector.id).length === 0)
          return message.channel.send('the queue is locked: only the dj can insert');
        if (serverQueue.length > MAX_QUEUE_S) return message.channel.send('*max queue size has been reached*');
        let link;
        message.channel.send('What link would you like to insert [or type \'q\' to quit]').then(msg => {
          const filter = m => {
            return (reactionCollector.id === m.author.id && m.author.id !== botID);
          };
          message.channel.awaitMessages(filter, {time: 60000, max: 1, errors: ['time']})
            .then(async (messages) => {
              link = messages.first().content.split(' ')[0].trim();
              if (link.toLowerCase() === 'q') {
                return;
              }
              if (link) {
                const num = await runInsertCommand(message, message.guild.id, link, '', server);
                if (num < 0) {
                  msg.delete();
                  return;
                }
                serverQueue.splice(num, 0, createQueueItem(link, null, null));
                if (server.queue.length > 0) updateActiveEmbed(server).then();
                let pageNum;
                if (num === 11) pageNum = 0;
                else pageNum = Math.floor((num - 1) / 10);
                qIterations = startingIndex + 11;
                clearTimeout(arrowReactionTimeout);
                collector.stop();
                generateQueue((pageNum === 0 ? 0 : (pageNum * 10)), false, sentMsg, sentMsgArray).then();
              } else {
                message.channel.send('*cancelled*');
                msg.delete();
              }
            }).catch(() => {
            message.channel.send('*cancelled*');
            msg.delete();
          });
        });
      } else if (reaction.emoji.name === reactions.OUTBOX) {
        if (server.dictator && reactionCollector.id !== server.dictator.id)
          return message.channel.send('only the dictator can remove from the queue');
        if (server.voteAdmin.length > 0 && server.voteAdmin.filter(x => x.id === reactionCollector.id).length === 0)
          return message.channel.send('only a dj can remove from the queue');
        if (serverQueue.length < 2) return message.channel.send('*cannot remove from an empty queue*');
        message.channel.send('What in the queue would you like to remove? (1-' + (serverQueue.length - 1) + ') [or type \'q\']').then(msg => {
          const filter = m => {
            return (reactionCollector.id === m.author.id && m.author.id !== botID);
          };
          message.channel.awaitMessages(filter, {time: 60000, max: 1, errors: ['time']})
            .then(async messages => {
              let num = messages.first().content.trim();
              if (num.toLowerCase() === 'q') {
                return message.channel.send('*cancelled*');
              }
              num = parseInt(num);
              if (num) {
                if (server.queue[num] !== serverQueue[num])
                  return message.channel.send('**queue is out of date:** the positions may not align properly with the embed shown\n*please type \'queue\' again*');
                if (num >= server.queue.length) return message.channel.send('*that position is out of bounds, **' +
                  (server.queue.length - 1) + '** is the last item in the queue.*');
                server.queue.splice(num, 1);
                serverQueue.splice(num, 1);
                message.channel.send('removed item from queue');
                if (server.queue.length > 0) updateActiveEmbed(server).then();
                let pageNum;
                if (num === 11) pageNum = 0;
                else pageNum = Math.floor((num - 1) / 10);
                qIterations = startingIndex + 11;
                clearTimeout(arrowReactionTimeout);
                collector.stop();
                return generateQueue((pageNum === 0 ? 0 : (pageNum * 10)), false, sentMsg, sentMsgArray);
              } else msg.delete();
            }).catch(() => {
            message.channel.send('*cancelled*');
            msg.delete();
          });
        });
      }
    });
  }

  return generateQueue(0, false, false, []);
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
async function runDatabasePlayCommand (args, message, sheetName, playRightNow, printErrorMsg, server) {
  if (!args[1]) {
    message.channel.send("There's nothing to play! ... I'm just gonna pretend that you didn't mean that.");
    return true;
  }
  const voiceChannel = message.member.voice.channel;
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
  const xdb = await getXdb(server, sheetName);
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
        const playlistType = verifyPlaylist(tempUrl);
        if (playlistType) {
          dbAddedToQueue += await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
        } else if (playRightNow) {
          if (first) {
            server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
            first = false;
          } else server.queue.splice(dbAddedToQueue, 0, createQueueItem(tempUrl, playlistType, null));
          dbAddedToQueue++;
        } else {
          server.queue.push(createQueueItem(tempUrl, playlistType, null));
          dbAddedToQueue++;
        }
      } else {
        // check personal db if applicable
        if (sheetName.substr(0, 1) !== 'p') {
          if (!otherSheet) {
            const xdb = await getXdb(server, `p${message.member.id}`);
            otherSheet = xdb.referenceDatabase;
          }
          tempUrl = otherSheet.get(args[dbAddInt].toUpperCase());
          if (tempUrl) {
            // push to queue
            const playlistType = verifyPlaylist(tempUrl);
            if (playlistType) {
              dbAddedToQueue += await addPlaylistToQueue(message, server.queue, 0, tempUrl, playlistType, playRightNow);
            } else if (playRightNow) {
              if (first) {
                server.queue.unshift(createQueueItem(tempUrl, playlistType, null));
                first = false;
              } else server.queue.splice(dbAddedToQueue, 0, createQueueItem(tempUrl, playlistType, null));
              dbAddedToQueue++;
            } else {
              server.queue.push(createQueueItem(tempUrl, playlistType, null));
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
    if (firstUnfoundRan) {
      unFoundString = unFoundString.concat('*');
      message.channel.send(unFoundString);
    }
    if (playRightNow) {
      return playLinkToVC(message, server.queue[0], voiceChannel, server);
    } else {
      message.channel.send('*added ' + dbAddedToQueue + ' to queue*');
      await updateActiveEmbed(server);
    }
  } else {
    tempUrl = xdb.referenceDatabase.get(args[1].toUpperCase());
    if (!tempUrl) {
      const sObj = runSearchCommand(args[1], xdb);
      const ss = sObj.ss;
      if (sObj.ssi === 1 && ss && args[1].length > 1 && (ss.length - args[1].length) < Math.floor((ss.length / 2) + 2)) {
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
          playLinkToVC(message, server.queue[0], voiceChannel, server).then();
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
          message.channel.send("Could not find '" + args[1] + "' in database.");
          return true;
        } else {
          runDatabasePlayCommand(args, message, `p${message.member.id}`, playRightNow, false, server).then();
          return true;
        }
      } else if (ss?.length > 0) {
        message.channel.send("Could not find '" + args[1] + "' in database.\n*Did you mean: " + ss + '*');
        return true;
      } else {
        message.channel.send("Could not find '" + args[1] + "' in database.");
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
        playLinkToVC(message, server.queue[0], voiceChannel, server).then();
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
    playLinkToVC(message, server.queue[0], voiceChannel, server).then();
  }
  return true;
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
 * Function for searching for message contents on youtube for playback.
 * Does not check for force disconnect.
 * @param message The discord message
 * @param playNow Bool, whether to override the queue
 * @param server The server playback metadata
 * @param searchTerm The specific phrase to search for, required if not provided a search result
 * @param indexToLookup Optional - The search index, requires searchResult to be valid
 * @param searchResult Optional - For recursive call with memoization
 * @param playlistMsg Optional - A message to be used for other youtube search results
 * @returns {Promise<*|boolean|undefined>}
 */
async function runYoutubeSearch (message, playNow, server, searchTerm, indexToLookup, searchResult, playlistMsg) {
  // the number of search results to return
  const NUM_SEARCH_RES = 5;
  if (!searchResult) {
    indexToLookup = 0;
    searchResult = (await ytsr(searchTerm, {pages: 1})).items.filter(x => x.type === 'video').slice(0, NUM_SEARCH_RES + 1);
    if (!searchResult[0]) {
      if (!searchTerm.includes('video')) {
        return runYoutubeSearch(message, playNow, server, `${searchTerm} video`, indexToLookup, null, playlistMsg);
      }
      return message.channel.send('could not find video');
    }
  } else {
    indexToLookup = parseInt(indexToLookup);
    if (!indexToLookup) indexToLookup = 1;
    indexToLookup--;
  }
  let ytLink;
  // if we found a video then play it
  ytLink = searchResult[indexToLookup].url;
  if (!ytLink) return message.channel.send('could not find video');
  if (playNow) {
    adjustQueueForPlayNow(dispatcherMap[message.member.voice.channel.id], server);
    server.queue.unshift(createQueueItem(ytLink, StreamType.YOUTUBE, searchResult[indexToLookup]));
    try {
      await playLinkToVC(message, server.queue[0], message.member.voice.channel, server);
    } catch (e) {
      console.log(e);
      return;
    }
  } else {
    const queueItem = createQueueItem(ytLink, StreamType.YOUTUBE, searchResult[indexToLookup]);
    server.queue.push(queueItem);
    if (server.queue.length === 1) {
      try {
        await playLinkToVC(message, server.queue[0], message.member.voice.channel, server);
      } catch (e) {
        return;
      }
    } else {
      const foundTitle = searchResult[indexToLookup].title;
      let sentMsg;
      if (foundTitle.charCodeAt(0) < 120) {
        sentMsg = await message.channel.send('*added **' + foundTitle.replace(/\*/g, '') + '** to queue*');
        await updateActiveEmbed(server);
      } else {
        let infos = await ytdl.getBasicInfo(ytLink);
        sentMsg = await message.channel.send('*added **' + infos.videoDetails.title.replace(/\*/g, '') + '** to queue*');
        await updateActiveEmbed(server);
      }
      sentMsg.react(reactions.X).then();
      const filter = (reaction, user) => {
        return user.id === message.member.id && [reactions.X].includes(reaction.emoji.name);
      };
      const collector = sentMsg.createReactionCollector(filter, {time: 12000, dispose: true});
      collector.once('collect', () => {
        if (!collector.ended) collector.stop();
        const queueStartIndex = server.queue.length - 1;
        // 5 is the number of items checked from the end of the queue
        const queueEndIndex = Math.max(queueStartIndex - 5, 0);
        for (let i = queueStartIndex; i > queueEndIndex; i--) {
          if (server.queue[i].url === ytLink) {
            server.queue.splice(i, 1);
            sentMsg.edit(`~~${sentMsg.content}~~`);
            break;
          }
        }
        updateActiveEmbed(server);
      });
      collector.on('end', () => {
        if (sentMsg.reactions && sentMsg.deletable) sentMsg.reactions.removeAll();
      });
    }
  }
  if ((playNow || server.queue.length < 2) && !playlistMsg) {
    await message.react(reactions.PAGE_C);
    let collector;
    if (server.searchReactionTimeout) clearTimeout(server.searchReactionTimeout);
    server.searchReactionTimeout = setTimeout(() => {
      if (collector) collector.stop();
      else {
        if (playlistMsg && playlistMsg.deletable) playlistMsg.delete().then(() => {playlistMsg = undefined;});
        message.reactions.removeAll();
        server.searchReactionTimeout = null;
      }
    }, 22000);
    const filter = (reaction, user) => {
      if (message.member.voice.channel) {
        for (const mem of message.member.voice.channel.members) {
          if (user.id === mem[1].id) {
            return user.id !== botID && [reactions.PAGE_C].includes(reaction.emoji.name);
          }
        }
      }
      return false;
    };
    collector = message.createReactionCollector(filter, {time: 100000, dispose: true});
    let res;
    let notActive = true;
    let reactionCollector2;
    collector.on('collect', async (reaction, reactionCollector) => {
      clearTimeout(server.searchReactionTimeout);
      server.searchReactionTimeout = setTimeout(() => {collector.stop();}, 60000);
      if (!playlistMsg) {
        res = searchResult.slice(1).map(x => `${x.title}`);
        let finalString = '';
        let i = 0;
        res.forEach(x => {
          i++;
          return finalString += i + '. ' + x + '\n';
        });
        const playlistEmebed = new MessageEmbed()
          .setTitle(`Pick a different video`)
          .setColor('#ffffff')
          .setDescription(`${finalString}\n***What would you like me to play? (1-${res.length})*** *[or type 'q' to quit]*`);
        playlistMsg = await message.channel.send(playlistEmebed);
      }
      if (notActive) {
        notActive = false;
        reactionCollector2 = reactionCollector;
        const filter = m => {
          return (m.author.id !== botID && reactionCollector.id === m.author.id);
        };
        message.channel.awaitMessages(filter, {time: 60000, max: 1, errors: ['time']})
          .then(messages => {
            if (!reactionCollector2) return;
            let playNum = parseInt(messages.first().content && messages.first().content.trim());
            if (playNum) {
              if (playNum < 1 || playNum > res.length) {
                message.channel.send('*invalid number*');
              } else {
                server.queueHistory.push(server.queue.shift());
                runYoutubeSearch(message, true, server, searchTerm, playNum + 1, searchResult, playlistMsg);
              }
            }
            if (playlistMsg?.deletable) playlistMsg.delete().then(() => {playlistMsg = undefined;}).catch();
            clearTimeout(server.searchReactionTimeout);
            server.searchReactionTimeout = setTimeout(() => {collector.stop();}, 22000);
            notActive = true;
          }).catch(() => {
          if (playlistMsg?.deletable) playlistMsg.delete().catch();
          notActive = true;
        });
      }
    });
    collector.on('end', () => {
      if (playlistMsg?.deletable) playlistMsg.delete().then(() => {playlistMsg = undefined;});
      if (message.deletable && message.reactions) message.reactions.removeAll();
      server.searchReactionTimeout = null;
    });
    collector.on('remove', (reaction, user) => {
      if (!notActive && reactionCollector2.id === user.id) {
        reactionCollector2 = false;
        if (playlistMsg?.deletable) playlistMsg.delete().catch();
        notActive = true;
        playlistMsg = undefined;
      }
    });
  }
}

/**
 * Runs the checks to add random songs to the queue
 * @param num The number of songs to be added to random, could be string
 * @param message The message that triggered the bot
 * @param sheetName The name of the sheet to reference
 * @param server The server playback metadata
 * @param addToFront Optional - true if to add to the front
 */
async function runRandomToQueue (num, message, sheetName, server, addToFront = false) {
  if (!message.member.voice.channel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play random');
    if (!botInVC(message)) setSeamless(server, runRandomToQueue, [num, message, sheetName, server, addToFront], sentMsg);
    return;
  }
  if (servers[message.guild.id].lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin))
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  if (server.dictator && message.member.id !== server.dictator.id)
    return message.channel.send('only the dictator can randomize to queue');
  let isPlaylist;
  // holds the string
  const origArg = num;
  // convert addToFront into a number for addRandomToQueue
  try {
    num = parseInt(num);
    if (num < 1) return message.channel.send('*invalid number*');
  } catch (e) {
    isPlaylist = true;
  }
  if (!num) {
    isPlaylist = true;
  }
  server.numSinceLastEmbed++;
  // in case of force disconnect
  if (!botInVC(message)) resetSession(server);
  else if (server.queue.length >= MAX_QUEUE_S && origArg) {
    return message.channel.send('*max queue size has been reached*');
  }
  // addToFront parameter must be a number for addRandomToQueue
  if (addToFront) addToFront = 1;
  // if no arguments, assumes that the active queue should be shuffled
  if (!origArg) return shuffleQueue(message, server.queue);
  if (origArg.toString().includes('.'))
    return addRandomToQueue(message, origArg, undefined, server, true, addToFront);
  const xdb = await getXdb(server, sheetName);
  if (isPlaylist) {
    addRandomToQueue(message, origArg, xdb.congratsDatabase, server, true, addToFront).then();
  } else {
    if (num > MAX_QUEUE_S) {
      message.channel.send('*max limit for random is ' + MAX_QUEUE_S + '*');
      num = MAX_QUEUE_S;
    }
    addRandomToQueue(message, num, xdb.congratsDatabase, server, false, addToFront).then();
  }
}

/**
 * Adds a number of items from the database to the queue randomly.
 * @param message The message that triggered the bot
 * @param numOfTimes The number of items to add to the queue, or a playlist url if isPlaylist
 * @param {Map} cdb The database to reference
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
    if (cdb) playlistUrl = cdb.get(numOfTimes);
    else playlistUrl = numOfTimes;
    if (!playlistUrl) return message.channel.send(`*could not find **${numOfTimes}** in the keys list*`);
    numOfTimes = 1;
    if (verifyPlaylist(playlistUrl)) sentMsg = message.channel.send('randomizing your playlist...');
  } else {
    valArray = Array.from(cdb.values());
    if (valArray.length < 1) {
      const pf = server.prefix;
      return message.channel.send('Your music list is empty *(Try  `' + pf + 'a` or `' + pf
        + 'ma` to add to a keys list)*');
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
  if (addToFront) {
    await playLinkToVC(message, server.queue[0], message.member.voice.channel, server);
  } else if (queueWasEmpty && (server.queue.length <= (numOfTimes + 1) || addAll)) {
    // remove the filler string
    if (server.queue[0] === 'filler link') server.queue.shift();
    await playLinkToVC(message, server.queue[0], message.member.voice.channel, server);
  } else {
    message.channel.send('*added ' + numOfTimes + ' to queue*');
    await updateActiveEmbed(server);
  }
  sentMsg = await sentMsg;
  if (sentMsg?.deletable) sentMsg.delete();
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
  const xdb = await getXdb(server, sheetName);
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
    message.channel.send('**' + emptyDBMessage + 'music list is empty.**\n*Add a song by putting a word followed by a link.' +
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
        keyEmbedColor = '#90d5cf';
      }
      const embedKeysMessage = new MessageEmbed();
      embedKeysMessage.setTitle(keysMessage + (sortByRecent ? '(recently added)' : '(alphabetical)')).setDescription(s)
        .setColor(keyEmbedColor).setFooter("(use '" + prefixString + cmdType + "d [key]' to play)\n");
      return embedKeysMessage;
    };
    message.channel.send(generateKeysEmbed(sortByRecent)).then(async sentMsg => {
      const server = servers[message.guild.id];
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
            .setDescription('Add a song by putting a word followed by a link -> \` ' +
              prefixString + cmdType + 'a [key] [link]\`\n' +
              'Delete a song by putting the name you wish to delete -> \` ' +
              prefixString + cmdType + 'del [key]\`')
            .setFooter(descriptionSuffix);
          message.channel.send(embed);
        } else if (reaction.emoji.name === reactions.SHUFFLE) {
          if (!voiceChannel) {
            voiceChannel = message.member.voice.channel;
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
                  const xdb2 = await getXdb(server, `p${reactionCollector.id}`);
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

bot.on('voiceStateUpdate', update => {
  if (isInactive) return;
  updateVoiceState(update).then();
});

/**
 * Updates the bots voice state depending on the update occurring.
 * @param update The voice-state update metadata.
 */
async function updateVoiceState (update) {
  const server = servers[update.guild.id];
  if (!server) return;
  // if bot
  if (update.member.id === botID) {
    // if the bot joined then ignore
    if (update.connection) return;
    // clear timers first
    if (server.leaveVCTimeout) {
      clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = null;
    }
    clearDJTimer(server);
    await sendLinkAsEmbed(server.currentEmbed, server.queue[0] || server.queueHistory[0], update.channel, server, false).then(() => {
      // end the stream (if applicable)
      if (server.streamData.stream) endStream(server);
      server.numSinceLastEmbed = 0;
      server.silence = false;
      server.verbose = false;
      server.loop = false;
      server.voteAdmin.length = 0;
      server.lockQueue = false;
      server.dictator = null;
      server.autoplay = false;
      server.userKeys.clear();
      server.queueHistory.length = 0;
      if (server.currentEmbed?.reactions) server.collector.stop();
      server.currentEmbed = null;
      if (server.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
      if (bot.voice.connections.size < 1) {
        whatspMap.clear();
        dispatcherMap.clear();
        dispatcherMapStatus.clear();
      }
    });
  } else if (botInVC(update)) {
    if (update.channel?.members.filter(x => !x.user.bot).size < 1) {
      let leaveVCInt = 1100;
      // if there is an active dispatch - timeout is 5 min
      if (dispatcherMap[update.channel.id]) leaveVCInt = 420000;
      // clear if timeout exists, set new timeout
      if (server.leaveVCTimeout) clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = setTimeout(() => {
        server.leaveVCTimeout = null;
        if (update.channel.members.filter(x => !x.user.bot).size < 1) {
          if (server.seamless.timeout) {
            clearTimeout(server.seamless.timeout);
            server.seamless.timeout = null;
          }
          server.seamless.function = null;
          update.channel.leave();
        }
      }, leaveVCInt);
    }
  } else if (server.seamless.function && !update.member.user.bot) {
    if (server.seamless.timeout) {
      clearTimeout(server.seamless.timeout);
      server.seamless.timeout = null;
    }
    try {
      server.seamless.function(...server.seamless.args);
    } catch (e) {}
    server.seamless.function = null;
    server.seamless.message.delete();
    server.seamless.message = null;
  }
}

/**
 *  The play function. Plays a given link to the voice channel. Does not add the item to the server queue.
 * @param {*} message The message that triggered the bot.
 * @param queueItem The queue item to play (see createQueueItem).
 * @param vc The voice channel to play the song in.
 * @param server The server playback metadata.
 * @param retries {number} Optional - Integer representing the number of retries.
 */
async function playLinkToVC (message, queueItem, vc, server, retries = 0) {
  let whatToPlay = queueItem.url;
  if (!whatToPlay) {
    queueItem = server.queue[0];
    whatToPlay = queueItem.url;
    if (!queueItem || !queueItem.url) return;
  }
  if (!vc) {
    vc = message.member.voice.channel;
    if (!vc) return;
  }
  if (isInactive) {
    message.channel.send('*db bot has been updated*');
    return runStopPlayingCommand(message.guild.id, vc, false, server);
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
      await new Promise(res => setTimeout(res, 110));
    } catch (e) {
      const eMsg = e.toString();
      if (eMsg.includes('it is full')) message.channel.send('\`error: cannot join voice channel, it is full\`');
      else if (eMsg.includes('VOICE_JOIN_CHANNEL')) message.channel.send('\`permissions error: cannot join voice channel\`');
      else {
        message.channel.send('db bot ran into this error:\n`' + eMsg + '`');
        console.log(e);
      }
      return;
    }
    if (vc.members.size > 6 && (!server.djMessageDate || (Date.now() - server.djMessageDate) > 97200000)) {
      message.channel.send('Try the \'dj\' command to become a DJ.');
      server.djMessageDate = Date.now();
    }
    if (startUpMessage.length > 1 && !server.startUpMessage) {
      server.startUpMessage = true;
      message.channel.send(startUpMessage);
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
          if (!retries) return playLinkToVC(message, queueItem, vc, server, ++retries);
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
      } else {
        search = await ytsr(queueItem.infos.name + ' ' + artists + ' lyrics', {pages: 1});
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
  if (server.streamData.stream) endStream(server);
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
      server.streamData.stream = stream;
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
      server.streamData.stream = stream = await m3u8stream(twitchEncoded.url);
      server.streamData.type = StreamType.TWITCH;
    } else {
      stream = await ytdl(urlAlt, {
        filter: (retries % 2 === 0 ? () => ['251'] : ''),
        highWaterMark: 1 << 25
      });
      streamHWM = 1 << 25;
      encoderType = 'opus';
      queueItem.urlAlt = urlAlt;
    }
    dispatcher = connection.play(stream, {
      type: encoderType,
      highWaterMark: streamHWM,
      volume: false
    });
    dispatcherMap[vc.id] = dispatcher;
    // if the server is not silenced then send the embed when playing
    if (server.silence) {
      server.currentEmbed = null;
    } else if (!(retries && whatToPlay === server.queue[0].url)) {
      await sendLinkAsEmbed(message, queueItem, vc, server).then(() => dispatcher.setVolume(0.5));
    }
    if (server.streamData?.type === StreamType.SOUNDCLOUD) {
      pauseComputation(vc, true);
      await new Promise(res => setTimeout(() => {
        if (whatToPlay === whatspMap[vc.id]) playComputation(vc, true);
        res();
      }, 3000));
    } else dispatcherMapStatus[vc.id] = false;
    server.skipTimes = 0;
    dispatcher.on('error', async (e) => {
      if (dispatcher.streamTime < 1000 && retries < 4) {
        if (playbackTimeout) clearTimeout(playbackTimeout);
        if (retries === 3) await new Promise(res => setTimeout(res, 500));
        if (botInVC(message)) playLinkToVC(message, queueItem, vc, server, ++retries).then();
        return;
      }
      skipLink(message, vc, false, server, false);
      // noinspection JSUnresolvedFunction
      bot.channels.cache.get(CH.err).send(
        (new MessageEmbed()).setTitle('Dispatcher Error').setDescription(`url: ${urlAlt}
        timestamp: ${formatDuration(dispatcher.streamTime)}\nprevSong: ${server.queueHistory[server.queueHistory.length - 1]}`)
      );
      console.log('dispatcher error: ', e);
    });
    dispatcher.once('finish', () => {
      if (whatToPlay !== whatspMap[vc.id]) {
        const errString = `There was a mismatch -----------\n old url: ${whatToPlay}\n current url: ${whatspMap[vc.id]}`;
        console.log(errString);
        try {
          // noinspection JSUnresolvedFunction
          bot.channels.cache.get(CH.err).send(errString);
        } catch (e) {
          console.log(e);
        }
      }
      if (vc.members.size < 2) {
        connection.disconnect();
      } else if (server.loop) {
        playLinkToVC(message, queueItem, vc, server);
      } else {
        server.queueHistory.push(server.queue.shift());
        if (server.queue.length > 0) {
          playLinkToVC(message, server.queue[0], vc, server);
        } else if (server.autoplay) {
          runAutoplayCommand(message, server, vc, queueItem);
        } else {
          if (server.collector) server.collector.stop();
          server.leaveVCTimeout = setTimeout(() => connection.disconnect(), LEAVE_VC_TIMEOUT);
          dispatcherMap[vc.id] = false;
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
          playLinkToVC(message, queueItem, vc, server, ++retries);
        }
      }, 2000);
    }
  } catch (e) {
    const errorMsg = e.toString().substr(0, 100);
    if (errorMsg.includes('ode: 404') || errorMsg.includes('ode: 410')) {
      if (!retries) playLinkToVC(message, queueItem, vc, server, ++retries).then();
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
          message.channel.send('*db bot appears to be facing some issues: automated diagnosis is underway.*').then(() => {
            console.log(e);
            // noinspection JSUnresolvedFunction
            bot.channels.cache.get(CH.err).send('***status code 404 error***' +
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
    if (!retries) return playLinkToVC(message, queueItem, vc, server, ++retries);
    console.log('error in playLinkToVC: ', whatToPlay);
    console.log(e);
    if (server.skipTimes > 3) {
      connection.disconnect();
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
    if (devMode) return;
    // noinspection JSUnresolvedFunction
    bot.channels.cache.get(CH.err).send(`there was a playback error within playLinkToVC: ${whatToPlay}`).then(() => {
      // noinspection JSUnresolvedFunction
      bot.channels.cache.get(CH.err).send(e.toString().substr(0, 1910));
    });
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
      const links = [await getRecLink(whatToPlay, queueItem.infos, 0)];
      // ensures that the second to last song played is not the same as current
      if (server.queueHistory.length > 1 && server.queueHistory[server.queueHistory.length - 2] === links[0]) {
        links.push(await getRecLink(whatToPlay, queueItem.infos, 1));
      }
      while (links.length) {
        const link = links.pop();
        if (link) {
          server.queue.push(createQueueItem(link, StreamType.YOUTUBE));
          playLinkToVC(message, server.queue[0], vc, server).then();
          return;
        }
      }
    } catch (e) {}
    message.channel.send('*could not find a video to play*');
    server.collector.stop();
    dispatcherMap[vc.id] = false;
  } else {
    message.channel.send(`*smartplay is not supported for this stream type*`);
    runStopPlayingCommand(message.guild.id, vc, true, server, message, message.member);
  }
}

/**
 * Gets the recommended link from infos depending on the given link and index.
 * @param whatToPlay The link to find recommendations for.
 * @param infos Optional - The infos of whatToPlay.
 * @param index The index of the recommendation to get.
 * @returns {Promise<string|undefined>} A new link if successful.
 */
async function getRecLink (whatToPlay, infos, index = 0) {
  try {
    let id;
    if (infos && infos.related_videos) id = infos.related_videos[index].id;
    else id = (await ytdl.getBasicInfo(whatToPlay)).related_videos[index].id;
    return `https://www.youtube.com/watch?v=${id}`;
  } catch (e) {
    return undefined;
  }
}

/**
 * Searches the guild db and personal message db for a broken link
 * @param message The message
 * @param server The server
 * @param whatToPlayS The broken link provided as a string
 */
function searchForBrokenLinkWithinDB (message, server, whatToPlayS) {
  getXdb(server, message.channel.guild.id).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within the server db: ' + key + '*');
      }
    });
  });
  getXdb(server, `p${message.member.id}`).then((xdb) => {
    xdb.congratsDatabase.forEach((value, key) => {
      if (value === whatToPlayS) {
        return message.channel.send('*possible broken link within your personal db: ' + key + '*');
      }
    });
  });
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
      playLinkToVC(message, server.queue[0], voiceChannel, server).then();
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
    playLinkToVC(message, queueItem, voiceChannel, server).then();
  } else if (server.queue[0]) {
    playLinkToVC(message, server.queue[0], voiceChannel, server).then();
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
 * If not given a voice channel then playback buttons will not appear. This is the main playabck embed.
 * If no url is provided then returns.
 * @param message the message to send the channel to
 * @param queueItem the queueItem to generate the embed for
 * @param voiceChannel the voice channel that the song is being played in, if playing
 * @param server The server playback metadata
 * @param forceEmbed Optional - force the embed to be regenerated
 * @returns {Promise<void>}
 */
async function sendLinkAsEmbed (message, queueItem, voiceChannel, server, forceEmbed) {
  if (!message || !queueItem) return;
  const url = queueItem.url;
  if (!voiceChannel) {
    voiceChannel = message.member.voice.channel;
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
    if (server.numSinceLastEmbed < 5 && !forceEmbed && server.currentEmbed) {
      try {
        const sentMsg = await server.currentEmbed.edit(embed);
        if (sentMsg.reactions.cache.size < 1 && showButtons && dispatcherMap[voiceChannel.id])
          generatePlaybackReactions(sentMsg, server, voiceChannel, timeMS, message.guild.id);
        return;
      } catch (e) {}
    }
    await sendEmbedUpdate(message, server, forceEmbed, embed).then(sentMsg => {
      if (showButtons && dispatcherMap[voiceChannel.id])
        generatePlaybackReactions(sentMsg, server, voiceChannel, timeMS, message.guild.id);
    });
  }
}

/**
 * Sends a new message embed to the channel. Is a helper for sendLinkAsEmbed.
 * @param message The message.
 * @param server The server.
 * @param forceEmbed {Boolean} If to keep the old embed and send a new one.
 * @param embed The embed to send.
 * @returns {Promise<Message>} The new message that was sent.
 */
async function sendEmbedUpdate (message, server, forceEmbed, embed) {
  server.numSinceLastEmbed = 0;
  if (server.currentEmbed) {
    if (!forceEmbed && server.currentEmbed.deletable) {
      server.currentEmbed.delete();
    } else if (server.currentEmbed.reactions) {
      server.collector.stop();
    }
  }
  const sentMsg = await message.channel.send(embed);
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

  timeMS += 3600000;
  const collector = sentMsg.createReactionCollector(filter, {time: timeMS, dispose: true});
  server.collector = collector;

  collector.on('collect', (reaction, reactionCollector) => {
    if (!dispatcherMap[voiceChannel.id] || !voiceChannel) return;
    switch (reaction.emoji.name) {
      case reactions.SKIP:
        runSkipCommand(sentMsg, voiceChannel, server, 1, false, false, sentMsg.member.voice.channel.members.get(reactionCollector.id));
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
          runPauseCommand(sentMsg, tempUser, server, true, false, true);
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
        runRewindCommand(sentMsg, mgid, voiceChannel, undefined, true, false, sentMsg.member.voice.channel.members.get(reactionCollector.id), server);
        if (server.followUpMessage) {
          server.followUpMessage.delete();
          server.followUpMessage = undefined;
        }
        break;
      case reactions.STOP:
        const mem = sentMsg.member.voice.channel.members.get(reactionCollector.id);
        runStopPlayingCommand(mgid, voiceChannel, false, server, sentMsg, mem);
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
    if (sentMsg.deletable && sentMsg.reactions) sentMsg.reactions.removeAll().then();
  });
}

/**
 * Stops playing in the given voice channel and leaves.
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 * @param stayInVC Whether to stay in the voice channel
 * @param server The server playback metadata
 * @param message Optional - The message metadata, used in the case of verifying a dj or dictator
 * @param actionUser Optional - The member requesting to stop playing, used in the case of verifying a dj or dictator
 */
function runStopPlayingCommand (mgid, voiceChannel, stayInVC, server, message, actionUser) {
  if (!voiceChannel) return;
  if (server.dictator && actionUser && actionUser.id !== server.dictator.id)
    return message.channel.send('only the dictator can perform this action');
  if (server.voteAdmin.length > 0 && actionUser &&
    !server.voteAdmin.map(x => x.id).includes(actionUser.id) && server.queue.length > 0) {
    return message.channel.send('*only the DJ can end the session*');
  }
  dispatcherMap[voiceChannel.id]?.pause();
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  if (voiceChannel && !stayInVC) {
    setTimeout(() => {
      voiceChannel.leave();
    }, 600);
  } else {
    if (server.currentEmbed?.reactions) {
      server.collector.stop();
    }
    dispatcherMap[voiceChannel.id] = false;
    if (whatspMap[voiceChannel.id] !== 'https://www.youtube.com/watch?v=oyFQVZ2h0V8')
      sendLinkAsEmbed(message, server.queue[0], voiceChannel, server).then();
  }
}

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param {*} message the message that activated the bot
 * @param {*} voiceChannel The active voice channel
 * @param keyName Optional - A key to search for to retrieve a link
 * @param {*} sheetName Required if dbKey is given - provides the name of the sheet reference.
 * @param sheetLetter Required if dbKey is given - a letter enum representing the type of sheet being referenced
 * (server or personal)
 */
async function runWhatsPCommand (message, voiceChannel, keyName, sheetName, sheetLetter) {
  const server = servers[message.guild.id];
  if (keyName && sheetName) {
    gsrun('A', 'B', sheetName).then((xdb) => {
      let link = xdb.referenceDatabase.get(keyName.toUpperCase());
      // update link value here
      if (!link) {
        let sObj = runSearchCommand(keyName, xdb);
        if (sObj.ssi === 1 && sObj.ss)
          link = `Assuming **${sObj.ss}**\n${xdb.referenceDatabase.get(sObj.ss.toUpperCase())}`;
      }
      if (link) {
        return message.channel.send(link);
      } else {
        message.channel.send(`Could not find '${keyName}' in ${(sheetLetter === 'm' ? 'your' : 'the server\'s')} keys list.`);
        return sendLinkAsEmbed(message, server.queue[0], voiceChannel, servers[message.guild.id], true);
      }
    });
  } else if (!voiceChannel) {
    return message.channel.send('must be in a voice channel');
  } else if (server.queue[0]) {
    return sendLinkAsEmbed(message, server.queue[0], voiceChannel, server, true);
  } else {
    return message.channel.send('nothing is playing right now');
  }
}

bot.on('error', (e) => {
  console.log('BOT ERROR:');
  console.log(e);
});
process.on('error', (e) => {
  console.log('PROCESS ERROR:');
  console.log(e);
});

process
  .on('SIGTERM', shutdown('SIGTERM'))
  .on('SIGINT', shutdown('SIGINT'))
  .on('uncaughtException', (e) => console.log('uncaughtException: ', e));

function shutdown (type) {
  return () => {
    console.log('shutting down...');
    isInactive = true;
    // noinspection JSUnresolvedFunction
    try {
      bot.channels.cache.get(CH.process).send(`shutting down: '${process.pid}' (${type})`);
    } catch (e) {}
    const activeCSize = bot.voice.connections.size;
    if (activeCSize > 0) {
      console.log(`leaving ${activeCSize} voice channel${activeCSize > 1 ? 's' : ''}`);
      // noinspection JSUnresolvedFunction
      bot.channels.cache.get(CH.process).send('=gzz ' + process.pid);
      if (Object.keys(servers).length > 0) {
        bot.voice.connections.forEach(x => {
          let server = servers[x.channel.guild.id];
          let currentEmbed = server.currentEmbed;
          try {
            if (currentEmbed) currentEmbed.channel.send('db bot is restarting... (this will be quick)');
            else if (server.queue[0]) x.channel.guild.systemChannel.send('db bot is restarting... (this will be quick)').then();
          } catch (e) {
            x.channel.guild.systemChannel.send('db bot is restarting... (this will be quick)').then();
          }
          if (server.collector) server.collector.stop();
          x.disconnect();
        });
      }
      setTimeout(() => process.exit(), 4500);
    } else setTimeout(() => process.exit(), 1500);
    process.exitCode = 0;
  };
}

// active process interval
let checkActiveInterval = null;
let resHandlerTimeout = null;
// A message for users on first VC join
let startUpMessage = '';

// The main method
(async () => {
  // login to discord
  await bot.login(token);
  if (bot.user.id !== botID) throw new Error('Invalid botID');
})();
