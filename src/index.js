/* eslint-disable camelcase */
'use strict';
require('dotenv').config();
const token = process.env.V13_DISCORD_TOKEN.replace(/\\n/gm, '\n');
const {exec} = require('child_process');
const version = require('../package.json').version;
const CH = require('../channel.json');
const {MessageEmbed} = require('discord.js');
const buildNo = require('./utils/process/BuildNumber');
const processStats = require('./utils/process/ProcessStats');
const {gsrun, deleteRows} = require('./commands/database/api/api');
const {
  formatDuration, botInVC, adjustQueueForPlayNow, verifyUrl, verifyPlaylist, resetSession, setSeamless, endStream,
  unshiftQueue, pushQueue, createQueueItem, createMemoryEmbed, convertSeekFormatToSec, logError, getTimeActive,
  removeFormattingLink, getSheetName, linkValidator, createVisualEmbed, getTitle, disconnectConnection,
} = require('./utils/utils');
const {runHelpCommand} = require('./commands/help');
const {runDictatorCommand, runDJCommand, clearDJTimer, runResignCommand} = require('./commands/dj');
const {
  MAX_QUEUE_S, bot, checkActiveMS, setOfBotsOn, commandsMap, whatspMap, botID, TWITCH_BASE_LINK, StreamType, INVITE_MSG,
  PREFIX_SN,
} = require('./utils/process/constants');
const {reactions} = require('./utils/reactions');
const {runRemoveCommand, removePlaylist} = require('./commands/remove');
const {updateActiveEmbed, sessionEndEmbed} = require('./utils/embed');
const {runMoveItemCommand, moveKeysWrapper} = require('./commands/move');
const {
  checkStatusOfYtdl, playLinkToVC, skipLink, runSkipCommand, sendLinkAsEmbed, runRewindCommand,
} = require('./commands/stream/stream');
const {runWhatsPCommand} = require('./commands/now-playing');
const {shutdown} = require('./utils/shutdown');
const {runDatabasePlayCommand, playPlaylistDB} = require('./commands/databasePlayCommand');
const {runAddCommandWrapper_P, addNewPlaylist} = require('./commands/add');
const {runRestartCommand} = require('./commands/restart');
const {playRecommendation, sendRecommendationWrapper} = require('./commands/stream/recommendations');
const {addLinkToQueue} = require('./utils/playlist');
const {runRandomToQueue, shuffleQueue} = require('./commands/runRandomToQueue');
const {checkToSeeActive} = require('./processes/checkToSeeActive');
const {runQueueCommand, createVisualText} = require('./commands/generateQueue');
const {runUniversalSearchCommand} = require('./commands/database/search');
const {
  sendListSize, getServerPrefix, getSettings, getXdb, setSettings, getXdb2,
} = require('./commands/database/retrieval');
const {isAdmin, hasDJPermissions} = require('./utils/permissions');
const {playFromWord} = require('./commands/playFromWord');
const {dmHandler, sendMessageToUser} = require('./utils/dms');
const {changePrefix} = require('./commands/changePrefix');
const {runPlayCommand} = require('./commands/play');
const {runPauseCommand} = require('./commands/pause');
const {runDeleteKeyCommand_P} = require('./commands/database/delete');
const {runStopPlayingCommand} = require('./commands/stop');
const {runInsertCommand} = require('./commands/insert');
const {parent_thread} = require('./threads/parent_thread');
const {joinVoiceChannelSafe} = require('./commands/join');
const {renamePlaylist, renameKey} = require('./commands/rename');
const {runKeysCommand} = require('./commands/keys');
const {getVoiceConnection} = require('@discordjs/voice');
const {getJoke} = require('./commands/joke');
const {runPurgeCommand} = require('./commands/purge');

process.setMaxListeners(0);

/**
 * Runs the play now command.
 * @param message the message that triggered the bot
 * @param args the message split into an array (ignores the first argument)
 * @param mgid the message guild id
 * @param server The server playback metadata
 * @param sheetName the name of the sheet to reference
 * @param seekSec {number?} Optional - The amount of time to seek in seconds
 * @param adjustQueue {boolean?} Whether to adjust the queue (is true by default).
 */
async function runPlayNowCommand(message, args, mgid, server, sheetName, seekSec, adjustQueue = true) {
  const voiceChannel = message.member.voice?.channel;
  if (!voiceChannel) {
    const sentMsg = await message.channel.send('must be in a voice channel to play');
    if (!botInVC(message) && args[1]) {
      setSeamless(server, runPlayNowCommand, [message, args, mgid, server, sheetName], sentMsg);
    }
    return;
  }
  if (server.dictator && message.member.id !== server.dictator.id) {
    return message.channel.send('only the dictator can play perform this action');
  }
  if (server.lockQueue && server.voteAdmin.filter((x) => x.id === message.member.id).length === 0) {
    return message.channel.send('the queue is locked: only the dj can play and add links');
  }
  if (!args[1]) {
    return message.channel.send('What should I play now? Put a link or some words after the command.');
  }
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  } else if (server.queue.length >= MAX_QUEUE_S) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  server.numSinceLastEmbed += 2;
  if (args[1].includes('.')) {
    if (args[1][0] === '<' && args[1][args[1].length - 1] === '>') {
      args[1] = args[1].substr(1, args[1].length - 2);
    }
    if (!(verifyPlaylist(args[1]) || verifyUrl(args[1]))) {
      return playFromWord(message, args, sheetName, server, mgid, true);
    }
  } else return playFromWord(message, args, sheetName, server, mgid, true);
  // places the currently playing into the queue history if played long enough
  if (adjustQueue) adjustQueueForPlayNow(server.audio.resource, server);
  // counter to iterate over all args - excluding args[0]
  let linkItem = args.length - 1;
  if (adjustQueue) {
    while (linkItem > 0) {
      let url = args[linkItem];
      if (url[url.length - 1] === ',') url = url.replace(/,/, '');
      await addLinkToQueue(url, message, server, mgid, true, unshiftQueue);
      linkItem--;
    }
  }
  playLinkToVC(message, server.queue[0], voiceChannel, server, 0, seekSec);
}

/**
 * Runs the commands and checks to play a link
 * @param message The message that triggered the bot
 * @param args An array of given play parameters, should be links or keywords
 * @param mgid The message guild id
 * @param server The server playback metadata
 * @param sheetName The name of the sheet to reference
 */
async function runPlayLinkCommand(message, args, mgid, server, sheetName) {
  if (!message.member.voice?.channel) {
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
  if (server.dictator && message.member.id !== server.dictator.id) {
    return message.channel.send('only the dictator can perform this action');
  }
  // in case of force disconnect
  if (!botInVC(message)) {
    resetSession(server);
  } else if (server.queue.length >= MAX_QUEUE_S) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (server.lockQueue && !hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
    return message.channel.send('the queue is locked: only the DJ can add to the queue');
  }
  if (args[1].includes('.')) {
    args[1] = removeFormattingLink(args[1]);
    if (!(verifyPlaylist(args[1]) || verifyUrl(args[1]))) {
      return playFromWord(message, args, sheetName, server, mgid, false);
    }
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
    playLinkToVC(message, server.queue[0], message.member.voice?.channel, server, 0);
  } else {
    message.channel.send('*added ' + (pNums < 2 ? '' : (pNums + ' ')) + 'to queue*');
    await updateActiveEmbed(server);
  }
}

/**
 * The execution for all bot commands
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
async function runCommandCases(message) {
  const mgid = message.guild.id;
  // the server guild playback data
  if (!processStats.servers.get(mgid)) processStats.initializeServer(mgid);
  const server = processStats.servers.get(mgid);
  if (processStats.devMode) server.prefix = '='; // devmode prefix
  if (server.currentEmbedChannelId === message.channel.id && server.numSinceLastEmbed < 10) {
    server.numSinceLastEmbed++;
  }
  // the server prefix
  let prefixString = server.prefix;
  if (!prefixString) {
    await getServerPrefix(server, mgid);
    prefixString = server.prefix;
  }
  const firstWordBegin = message.content.substring(0, 14).trim() + ' ';
  const fwPrefix = firstWordBegin.substring(0, 1);
  // for all non-commands
  if (fwPrefix !== prefixString) {
    if (processStats.devMode) return;
    if (firstWordBegin === '.db-vibe ') {
      return message.channel.send('Current prefix is: ' + prefixString);
    }
    return;
  }
  const args = message.content.replace(/\s+/g, ' ').split(' ');
  // the command name
  const statement = args[0].substr(1).toLowerCase();
  if (statement.substring(0, 1) === 'g' && statement !== 'guess') {
    if (message.member.id.toString() !== '443150640823271436' &&
     message.member.id.toString() !== '268554823283113985') {
      return;
    }
  } else {
    commandsMap.set(statement, (commandsMap.get(statement) || 0) + 1);
  }
  if (message.channel.id === server.currentEmbedChannelId) server.numSinceLastEmbed += 2;
  switch (statement) {
  case 'db-bot':
  case 'db-vibe':
    runHelpCommand(message, server, version);
    break;
  case 'omedetou':
  case 'congratulations':
  case 'congratz':
  case 'congrats':
    if (!botInVC(message)) {
      server.queue.length = 0;
      server.queueHistory.length = 0;
      server.loop = false;
    }
    server.numSinceLastEmbed++;
    const args2 = message.content.toLowerCase().replace(/\s+/g, ' ').split(' ');
    let indexOfWord;
    const findIndexOfWord = (word) => {
      for (const w in args) {
        if (args[w].includes(word)) {
          indexOfWord = w;
          return w;
        }
      }
      return -1;
    };
    let name;
    if (findIndexOfWord('grats') !== -1 || findIndexOfWord('congratulations') !== -1) {
      name = args2[parseInt(indexOfWord) + 1];
      const excludedWords = ['on', 'the', 'my', 'for', 'you', 'dude', 'to', 'from', 'with', 'by'];
      if (excludedWords.includes(name)) name = '';
      if (name && name.length > 1) name = name.substring(0, 1).toUpperCase() + name.substr(1);
    } else {
      name = '';
    }
    commandsMap.set('congrats', (commandsMap.get('congrats') || 0) + 1);
    message.channel.send('Congratulations' + (name ? (' ' + name) : '') + '!');
    const congratsLink = (statement.includes('omedetou') ? 'https://www.youtube.com/watch?v=hf1DkBQRQj4' : 'https://www.youtube.com/watch?v=oyFQVZ2h0V8');
    if (server.queue[0]?.url !== congratsLink) {
      server.queue.unshift(createQueueItem(congratsLink, StreamType.YOUTUBE, null));
    } else return;
    if (message.member.voice?.channel) {
      const vc = message.member.voice.channel;
      setTimeout(() => {
        if (whatspMap[vc.id] === congratsLink) {
          skipLink(message, vc, false, server, true);
        }
        const item = server.queueHistory.findIndex((val) => val.url === congratsLink);
        if (item !== -1) server.queueHistory.splice(item, 1);
      }, 20000);
      const embedStatus = server.silence;
      server.silence = true;
      playLinkToVC(message, server.queue[0], vc, server);
      setTimeout(() => server.silence = embedStatus, 4000);
      const item = server.queueHistory.findIndex((val) => val.url === congratsLink);
      if (item !== -1) server.queueHistory.splice(item, 1);
      return;
    }
    break;
    // tell the user a joke
  case 'joke':
    const joke = await getJoke();
    message.channel.send(joke);
    break;
    // the normal play command
  case 'play':
  case 'p':
    runPlayLinkCommand(message, args, mgid, server, undefined).then();
    break;
  case 'mplay':
  case 'mp':
    runPlayLinkCommand(message, args, mgid, server, getSheetName(message.member.id)).then();
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
    runPlayNowCommand(message, args, mgid, server, getSheetName(message.member.id)).then();
    break;
    // allows seeking of YouTube and Spotify links
  case 'seek':
    const SEEK_ERR_MSG = '*provide a seek timestamp (ex: seek 5m32s)*';
    if (args[1]) {
      if (args[2]) {
        // assume exactly two arguments is provided
        const validLink = linkValidator(args[1]);
        const numSeconds = convertSeekFormatToSec(args[2]);
        if (validLink && numSeconds) {
          server.numSinceLastEmbed -= 2;
          args.splice(2, args.length - 1);
          await runPlayNowCommand(message, args, mgid, server, getSheetName(message.member.id), numSeconds, true);
          if (numSeconds > 1200) message.channel.send('*seeking...*');
          return;
        }
      } else {
        // provided one argument
        if (!server.queue[0]) {
          return message.channel.send(`*provide a seek link and timestamp (ex: ${args[0]} [link] 5m32s)*`);
        }
        // continues if only one argument was provided
        const numSeconds = convertSeekFormatToSec(args[1]);
        if (numSeconds) {
          server.numSinceLastEmbed -= 2;
          args.splice(1, 1);
          args.push(server.queue[0].url);
          await runPlayNowCommand(message, args, mgid, server, getSheetName(message.member.id), numSeconds, false);
          if (numSeconds > 1200) message.channel.send('*seeking...*');
          return;
        }
      }
    }
    // if successful then execution should not reach here
    message.channel.send(SEEK_ERR_MSG);
    break;
  case 'join':
    joinVoiceChannelSafe(message, server);
    break;
    // stop session commands
  case 'disconnect':
  case 'quit':
  case 'leave':
  case 'end':
  case 'e':
    runStopPlayingCommand(mgid, message.member.voice?.channel, false, server, message, message.member);
    break;
  case 'autoplay':
  case 'sp':
  case 'smartp':
  case 'smartplay':
    if (!botInVC(message)) {
      // avoid sending a message for smaller command names
      if (args[0].length > 2) message.channel.send('must be playing something to use smartplay');
      return;
    }
    if (server.autoplay) {
      server.autoplay = false;
      message.channel.send('*smartplay turned off*');
    } else {
      server.autoplay = true;
      message.channel.send('*smartplay turned on*');
    }
    updateActiveEmbed(server).then();
    break;
  case 'unloop':
    if (!botInVC(message)) {
      // only send error message for 'loop' command
      if (args[0].length > 1) await message.channel.send('must be actively playing to loop');
      return;
    }
    if (server.loop) {
      server.loop = false;
      await message.channel.send('*looping disabled*');
    } else {
      await message.channel.send('*looping is already off*');
    }
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
    parent_thread('lyrics', message.id, message.channel.id, [args, server.queue[0], message.member.id]);
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
  case 'know':
  case 'kn':
  case 'dnow':
  case 'dn':
    runPlayNowCommand(message, args, mgid, server, getSheetName(message.member.id)).then();
    break;
  case 'pd':
  case 'dd':
    playPlaylistDB(args.splice(1), message, getSheetName(message.member.id), false, true, server).then();
    break;
  case 'ps':
  case 'pshuffle':
    playPlaylistDB(args.splice(1), message, getSheetName(message.member.id), false, true, server, true).then();
    break;
    // .md is retrieves and plays from the keys list
  case 'md':
  case 'd':
    runDatabasePlayCommand(args, message, getSheetName(message.member.id), false, true, server).then();
    break;
    // .mdnow retrieves and plays from the keys list immediately
  case 'mkn':
  case 'mknow':
  case 'mdnow':
  case 'mdn':
    runPlayNowCommand(message, args, mgid, server, getSheetName(message.member.id)).then();
    break;
  case 'shuffle':
    if (!args[1]){
      shuffleQueue(server, message);
    } else {
      runRandomToQueue(args[1], message, mgid, server).then();
    }
    break;
  case 'rn':
  case 'randnow':
  case 'randomnow':
    runRandomToQueue(args[1] || 1, message, mgid, server, true).then();
    break;
  case 'sync':
    // assume that there is something playing
    if (botInVC(message)) {
      if (server.audio.isVoiceChannelMember(message.member)) {
        const MIN_SYNC_SECONDS = 7;
        const MAX_SYNC_SECONDS = 60;
        let seconds = MIN_SYNC_SECONDS;
        if (args[1]) {
          seconds = parseInt(args[1]);
          if (!seconds || seconds < MIN_SYNC_SECONDS) seconds = MIN_SYNC_SECONDS;
          else if (seconds > MAX_SYNC_SECONDS) seconds = MAX_SYNC_SECONDS;
        }
        const playArgs = [message, message.member, server, true, false, true];
        runPauseCommand(...playArgs);
        const streamTime = server.audio.resource.playbackDuration;
        if (!streamTime) return message.channel.send('*could not find a valid stream time*');
        // the seconds shown to the user
        const streamTimeSeconds = (streamTime / 1000) % 60 + 1; // add 1 to get user ahead of actual stream
        // the formatted duration (with seconds supposed to be replaced)
        const duration = formatDuration(streamTime);
        const vals = duration.split(' ');
        // if the stream is close to next second (7 represents the tenth's place)
        const isClose = +streamTimeSeconds.toString().split('.')[1][0] > 7;
        if (!vals.slice(-1)[0].includes('s')) vals.push(`${Math.floor(streamTimeSeconds)}s`);
        else vals[vals.length - 1] = `${Math.floor(streamTimeSeconds)}s`;
        const syncMsg = await message.channel.send(
          `timestamp is **${vals.join(' ')}**` +
            `\naudio will resume when I say 'now' (~${seconds} seconds)`,
        );
        setTimeout(async () => {
          if (!server.audio.status) {
            const newMsgStr = `timestamp is **${vals.join(' ')}**` + '\n***---now---***';
            if (isClose) await syncMsg.edit(newMsgStr);
            else syncMsg.edit(newMsgStr);
            runPlayCommand(...playArgs);
            setTimeout(() => {
              if (syncMsg.deletable) syncMsg.delete();
            }, 5000);
          }
        }, (seconds * 1000) + 1000); // convert seconds to ms and add another second
      } else message.channel.send('no active link is playing');
    }
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
    // .r is a random that works with the normal queue
  case 'random':
  case 'rand':
  case 'ds':
  case 's':
  case 'r':
  case 'mr':
    runRandomToQueue(args[1] || 1, message, getSheetName(message.member.id), server).then();
    break;
  case 'mshuffle':
    runRandomToQueue(args[1], message, getSheetName(message.member.id), server).then();
    break;
  case 'mrn':
  case 'mrandnow':
    runRandomToQueue(args[1] || 1, message, getSheetName(message.member.id), server, true).then();
    break;
  case 'mshufflen':
  case 'mshufflenow':
    runRandomToQueue(args[1], message, getSheetName(message.member.id), server, true).then();
    break;
  case 'rename-key':
  case 'rename-keys':
  case 'r-key':
  case 'r-keys':
    if (!args[1] || !args[2]) {
      message.channel.send(`*expected a key-name and new key-name (i.e. ${args[0]} [A] [B])*`);
      return;
    }
    renameKey(message.channel, server, getSheetName(message.member.id), args[1], args[2]);
    break;
  case 'rename-playlist':
  case 'rename-playlists':
  case 'r-playlist':
  case 'r-playlists':
    if (!args[1] || !args[2]) {
      message.channel.send(`*expected a playlist-name and new playlist-name (i.e. ${args[0]} [A] [B])*`);
      return;
    }
    renamePlaylist(message.channel, server, getSheetName(message.member.id), args[1], args[2]);
    break;
    // .keys is personal keys
  case 'key':
  case 'k':
  case 'keys':
  case 'playlist':
  case 'playlists':
    runKeysCommand(message, server, getSheetName(message.member.id), null, args[1], message.member.nickname).then();
    break;
    // test purposes - return keys
  case 'gk':
  case 'gkey':
  case 'gkeys':
    runKeysCommand(message, server, 'entries', null, args[1]).then();
    break;
  case 'splash':
    if (!args[1] || !args[1].includes('.')) {
      message.channel.send(`*provide an icon URL to set a splash screen for your playlists \`${args[0]} [url]\`*`);
      return;
    }
    args[1] = removeFormattingLink(args[1].trim());
    if (args[1].substring(args[1].length - 5) === '.gifv') {
      args[1] = args[1].substring(0, args[1].length - 1);
    }
    const userSettings = await getSettings(server, getSheetName(message.member.id));
    userSettings.splash = args[1];
    await setSettings(server, getSheetName(message.member.id), userSettings);
    message.channel.send('*splashscreen set*');
    break;
    // .search is the search
  case 'find':
  case 'lookup':
  case 'search':
    runUniversalSearchCommand(message, server, getSheetName(message.member.id),
      (args[1] ? args[1] : server.queue[0]?.url));
    break;
  case 'gfind':
  case 'glookup':
  case 'gsearch':
    runUniversalSearchCommand(message, server, 'entries', (args[1] ? args[1] : server.queue[0]?.url)).then();
    break;
  case 'size':
    if (!args[1]) sendListSize(message, server, mgid).then();
    break;
  case 'msize':
    if (!args[1]) sendListSize(message, server, getSheetName(message.member.id)).then();
    break;
  case 'gsize':
    if (!args[1]) sendListSize(message, server, 'entries').then();
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
  case 'now':
    await runWhatsPCommand(server, message, message.member.voice?.channel, args[1], mgid, '');
    break;
  case 'g?':
    await runWhatsPCommand(server, message, message.member.voice?.channel, args[1], 'entries', 'g');
    break;
  case 'm?':
  case 'mnow':
  case 'mwhat':
    await runWhatsPCommand(server, message, message.member.voice?.channel, args[1],
      getSheetName(message.member.id), 'm');
    break;
  case 'gurl':
  case 'glink':
    if (!args[1]) {
      if (server.queue[0] && message.member.voice.channel) {
        return message.channel.send(server.queue[0].url);
      } else {
        return message.channel.send('*add a key to get it\'s ' + statement.substr(1) +
        ' \`(i.e. ' + statement + ' [key])\`*');
      }
    }
    await runWhatsPCommand(server, message, message.member.voice?.channel, args[1], 'entries', 'g');
    break;
  case 'url':
  case 'link':
    if (!args[1]) {
      if (server.queue[0] && message.member.voice.channel) {
        return message.channel.send(server.queue[0].url);
      } else {
        return message.channel.send('*add a key to get it\'s ' + statement +
        ' \`(i.e. ' + statement + ' [key])\`*');
      }
    }
    await runWhatsPCommand(server, message, message.member.voice?.channel,
      args[1], getSheetName(message.member.id), 'm');
    break;
  case 'ping':
    message.channel.send(`latency is ${Math.round(bot.ws.ping)}ms`);
    break;
  case 'prec':
  case 'precc':
  case 'precs':
  case 'playrec':
  case 'playrecc':
  case 'playrecs':
    playRecommendation(message, server, args);
    break;
  case 'rec':
  case 'recc':
  case 'reccomend':
  case 'reccommend':
  case 'recommend':
    args[0] = '';
    sendRecommendationWrapper(message, args, bot.users, server).then();
    break;
  case 'rm':
  case 'remove':
    await runRemoveCommand(message, server, args[1]);
    break;
  case 'move':
    runMoveItemCommand(message, server.queue, args[1], args[2]);
    break;
  case 'input':
  case 'insert':
    runInsertCommand(message, mgid, args.slice(1), server, getSheetName(message.member.id)).then();
    break;
  case 'q':
  case 'que':
    runQueueCommand(server, message, mgid, true);
    break;
  case 'list':
  case 'upnext':
  case 'queue':
    runQueueCommand(server, message, mgid, false);
    break;
  case 'audit':
  case 'plays':
  case 'freq':
  case 'frequency':
    let tempAuditArray = [];
    for (const [key, value] of server.mapFinishedLinks) {
      tempAuditArray.push({url: key, title: (await getTitle(value.queueItem)), index: value.numOfPlays});
    }
    tempAuditArray.sort((a, b) => {
      return b.index - a.index;
    }); // sort by times played
    message.channel.send({embeds: [
      createVisualEmbed('Link Frequency',
        ((await createVisualText(server, tempAuditArray,
          (index, title, url) => `${index} | [${title}](${url})\n`)) || 'no completed links'))
      ]});
    break;
    case 'purge':
      if (!args[1]) return message.channel.send('*input a term to purge from the queue*');
      await runPurgeCommand(message, server, args.slice(1).join(' ').toLowerCase());
      break;
  case 'prefix':
    message.channel.send('use the command `changeprefix` to change the bot\'s prefix');
    break;
  case 'changeprefix':
    changePrefix(message, server, prefixString, args[1]);
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
    runSkipCommand(message, message.member.voice?.channel, server, args[1], true, false, message.member);
    break;
  case 'dic':
  case 'dict':
  case 'dictator':
    runDictatorCommand(message, mgid, prefixString, server);
    break;
  case 'voteskip':
  case 'vote':
  case 'dj':
    runDJCommand(message, server);
    break;
  case 'fs':
  case 'fsk':
  case 'forcesk':
  case 'forceskip':
    if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
      runSkipCommand(message, message.member.voice?.channel, server, args[1], true, true, message.member);
    }
    break;
  case 'fr':
  case 'frw':
  case 'forcerw':
  case 'forcerewind':
    if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
      runRewindCommand(message, mgid, message.member.voice?.channel, args[1], true, false, message.member, server);
    }
    break;
  case 'fp':
    if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
      message.channel.send('use \'fpl\' to force play and \'fpa\' to force pause.');
    }
    break;
  case 'fpl':
  case 'forcepl':
  case 'forceplay':
    if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
      runPlayCommand(message, message.member, server, false, true);
    }
    break;
  case 'fpa':
  case 'forcepa':
  case 'forcepause':
    if (hasDJPermissions(message, message.member.id, true, server.voteAdmin)) {
      runPauseCommand(message, message.member, server, false, true);
    }
    break;
  case 'lock-queue':
    if (server.voteAdmin.filter((x) => x.id === message.member.id).length > 0) {
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
  case 'gzconvert':
  case 'gz-convert':
    // convert old data format into new data format
    if (!args[1]) return;
    const oldDB = await getXdb(server, args[1]);
    const keysObj = {
      pn: 'general',
      ks: [],
    };
    let valStr = '';
    oldDB.congratsDatabase.forEach((val, key) => {
      keysObj.ks.push({kn: key});
      valStr += val + ', ';
    });
    if (valStr.length > 1) {
      valStr = valStr.substring(0, valStr.length - 2);
    }
    console.log('K: ', JSON.stringify(keysObj));
    console.log('V: ', valStr);
    break;
  case 'ts':
  case 'time':
  case 'timestamp':
    if (!message.member.voice?.channel) message.channel.send('must be in a voice channel');
    else if (server.audio.isVoiceChannelMember(message.member)) {
      message.channel.send('timestamp: ' + formatDuration(server.audio.resource?.playbackDuration));
    } else message.channel.send('nothing is playing right now');
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
    if (message.member.id.toString() !== '443150640823271436' &&
     message.member.id.toString() !== '268554823283113985') {
      return;
    }
    message.channel.send(
      'Here\'s the dev docs:\n' +
        '<https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622>',
    );
    break;
    // .ga adds to the test database
  case 'ga':
  case 'gadd':
    runAddCommandWrapper_P(message.channel, args.slice(1), 'entries', true, server, message.member);
    break;
    // .add is personal add
  case 'add':
    runAddCommandWrapper_P(message.channel, args.slice(1),
      getSheetName(message.member.id), true, server, message.member);
    break;
  case 'playlist-add':
  case 'p-add':
  case 'add-playlist':
    if (!args[1]) {
      message.channel.send(`*error: expected a playlist name to add (i.e. \`${args[0]} [playlist-name]\`)*`);
      return;
    }
    addNewPlaylist(server, message.channel, getSheetName(message.member.id), args[1]);
    break;
  case 'gadd-playlist':
  case 'gplaylist-add':
    if (!args[1]) {
      message.channel.send(`*error: expected a playlist name to add (i.e. \`${args[0]} [playlist-name]\`)*`);
      return;
    }
    addNewPlaylist(server, message.channel, 'entries', args[1]);
    break;
  case 'delete-playlist':
  case 'del-playlist':
  case 'playlist-del':
  case 'p-del':
    removePlaylist(server, getSheetName(message.member.id), args[1],
      (await getXdb2(server, getSheetName(message.member.id))), message.channel);
    break;
  case 'gdelete-playlist':
  case 'gdel-playlist':
  case 'gplaylist-del':
  case 'gp-del':
    removePlaylist(server, 'entries', args[1], (await getXdb2(server, 'entries')), message.channel);
    break;
    // .del deletes database entries
  case 'del':
  case 'delete':
    if (!args[1]) return message.channel.send('*no args provided*');
    runDeleteKeyCommand_P(message, args[1], getSheetName(message.member.id), server);
    break;
    // test remove database entries
  case 'grm':
  case 'gdel':
  case 'gdelete':
  case 'gremove':
    runDeleteKeyCommand_P(message, args[1], 'entries', server);
    break;
    // allow ma in voice channel to accept two arguments
    // (if 1 is provided then it is put in playlist general ->
    // if 2 is provided then it looks for a playlist name in the mix)
  case 'mk':
  case 'move-key':
  case 'move-keys':
    if (!args[1] && statement === 'mk') return;
    moveKeysWrapper(server, message.channel, getSheetName(message.member.id),
      (await getXdb2(server, getSheetName(message.member.id))), args.splice(1));
    break;
  case 'gmk':
  case 'gmove-key':
  case 'gmove-keys':
    if (!args[1] && statement === 'mk') return;
    moveKeysWrapper(server, message.channel, 'entries', (await getXdb2(server, 'entries')), args.splice(1));
    break;
  case 'soundcloud':
    message.channel.send(`*try the play command with a soundcloud link \` Ex: ${prefixString}play [SOUNDCLOUD_URL]\`*`);
    break;
  case 'twitch':
    if (!args[1]) return message.channel.send(`*no channel name provided \` Ex: ${prefixString}twitch [channel]\`*`);
    if (message.member.voice?.channel) {
      args[1] = `https://www.${TWITCH_BASE_LINK}/${args[1]}`;
      server.queue.unshift(createQueueItem(args[1], StreamType.TWITCH, null));
      playLinkToVC(message, args[1], message.member.voice.channel, server);
    } else {
      message.channel.send('*must be in a voice channel*');
    }
    break;
  case 'prev':
  case 'previous':
  case 'rw':
  case 'rew':
  case 'rewind':
    runRewindCommand(message, mgid, message.member.voice?.channel, args[1], false, false, message.member, server);
    break;
  case 'rp':
  case 'replay':
    runRestartCommand(message, mgid, 'replay', server);
    break;
  case 'rs':
  case 'restart':
    runRestartCommand(message, mgid, 'restart', server);
    break;
  case 'clearqueue':
  case 'clear':
    if (!message.member.voice?.channel) return message.channel.send('must be in a voice channel to clear');
    if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member)) {
      return message.channel.send('only the DJ can clear the queue');
    }
    if (server.dictator && server.dictator.id !== message.member.id) {
      return message.channel.send('only the Dictator can clear the queue');
    }
    const currentQueueItem = (botInVC(message)) ? server.queue[0] : undefined;
    server.queue.length = 0;
    server.queueHistory.length = 0;
    if (currentQueueItem) {
      server.queue[0] = currentQueueItem;
      await sendLinkAsEmbed(message, currentQueueItem, message.member.voice?.channel, server, false);
    }
    message.channel.send('The queue has been scrubbed clean');
    break;
  case 'inv':
  case 'invite':
    message.channel.send(INVITE_MSG);
    break;
  case 'hide':
  case 'silence':
    if (!message.member.voice?.channel) {
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
    if (!message.member.voice?.channel) {
      return message.channel.send('You must be in a voice channel to unsilence');
    }
    if (!server.silence) {
      return message.channel.send('*song notifications already unsilenced*');
    }
    server.silence = false;
    message.channel.send('*song notifications enabled*');
    if (server.audio.isVoiceChannelMember(message.member)) {
      sendLinkAsEmbed(message, server.queue[0], message.member.voice?.channel, server, false).then();
    }
    break;
    // print out the version number
  case 'version':
    const vEmbed = new MessageEmbed();
    vEmbed.setTitle('Version').setDescription('[' + version + '](https://github.com/Reply2Zain/db-bot)');
    message.channel.send({embeds: [vEmbed]});
    break;
  case 'gzmem':
    message.channel.send({embeds: [await createMemoryEmbed()]});
    break;
  case 'congratulate':
    // congratulate a friend
    if (!args[1]) return message.channel.send('*no friend provided*');
    const friend = message.mentions.users.first();
    if (!friend) return message.channel.send('*no friend provided*');
    const friendName = friend.username;
    const friendAvatar = friend.avatarURL();
    const friendEmbed = new MessageEmbed();
    friendEmbed.setTitle('Congrats!').setDescription(`${friendName} has been congratulated!`);
    friendEmbed.setThumbnail(friendAvatar);
    friendEmbed.setColor('#00ff00');
    friendEmbed.setFooter(`By ${message.author.username}`, message.author.avatarURL());
    message.channel.send({embeds: [friendEmbed]});
    break;
    // dev commands for testing purposes
  case 'gzh':
    const devCEmbed = new MessageEmbed()
      .setTitle('Dev Commands')
      .setDescription(
        '**active bot commands**' +
          '\n' + prefixString + 'gzs - statistics for the active bot' +
          '\n' + prefixString + 'gzmem - see the process\'s memory usage' +
          '\n' + prefixString + 'gzc - view commands stats' +
          '\n' + prefixString + 'gznuke [num] [\'db\'?] - deletes [num] recent messages (or db only)' +
          '\n' + prefixString + 'gzr [userId] - queries a message from the bot to the user' +
          '\n\n**calibrate the active bot**' +
          '\n' + prefixString + 'gzq - quit/restarts the active bot' +
          '\n' + prefixString + 'gzupdate - updates the (active) pi instance of the bot' +
          '\n' + prefixString + 'gzm update - sends a message to active guilds that the bot will be updating' +
          '\n' + prefixString + 'gzsms [message] - set a default message for all users on VC join' +
          '\n\n**calibrate multiple/other bots**' +
          '\n=gzl - return all bot\'s ping and latency' +
          '\n=gzk - start/kill a process' +
          '\n=gzd [process #] - toggle dev mode' +
          '\n=gzupdate - updates all (inactive) pi instances of the bot' +
          '\n\n**other commands**' +
          '\n' + prefixString + 'gzid - guild, bot, and member id' +
          '\ndevadd - access the database',
      )
      .setFooter({text: `version: ${version}`});
    message.channel.send({embeds: [devCEmbed]});
    break;
  case 'gznuke':
    parent_thread('gzn', message.id, message.channel.id,
      [message.channel.id, parseInt(args[1]) || 1, args[2] === 'db']);
    break;
  case 'gzupdate':
    devUpdateCommand(message, args.splice(1));
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
    message.channel.send({embeds: [commandsMapEmbed]});
    break;
  case 'gzq':
    if (bot.voice.adapters.size > 0 && args[1] !== 'force') {
      message.channel.send('People are using the bot. Use this command again with \'force\' to restart the bot');
    } else {
      message.channel.send('restarting the bot... (may only shutdown)').then(() => {
        shutdown('USER')();
      });
    }
    break;
  case 'gzid':
    message.channel.send(`g: ${message.guild.id}, b: ${bot.user.id}, m: ${message.member.id}`);
    break;
  case 'gzsms':
    if (args[1]) {
      if (args[1] === 'clear') {
        processStats.startUpMessage = '';
        return message.channel.send('start up message is cleared');
      }
      processStats.startUpMessage = message.content.substr(message.content.indexOf(args[1]));
      Object.values(processStats.servers).forEach((x) => x.startUpMessage = false);
      message.channel.send('*new startup message is set*');
    } else if (processStats.startUpMessage) {
      const gzsmsClearMsg = '*type **gzsm clear** to clear the startup message*';
      message.channel.send(`***current start up message:***\n${processStats.startUpMessage}\n${gzsmsClearMsg}`);
    } else message.channel.send('*there is no startup message right now*');
    break;
  case 'gzs':
    const embed = new MessageEmbed()
      .setTitle('db vibe - statistics')
      .setDescription(`version: ${version} (${buildNo.getBuildNo()})` +
          `\nprocess: ${process.pid.toString()}` +
          `\nservers: ${bot.guilds.cache.size}` +
          `\nuptime: ${formatDuration(bot.uptime)}` +
          `\nactive time: ${getTimeActive()}` +
          `\nstream time: ${formatDuration(processStats.getTotalStreamTime())}` +
          `\nup since: ${bot.readyAt.toString().substring(0, 21)}` +
          `\nnumber of streams: ${processStats.getActiveStreamSize()}` +
          `\nactive voice channels: ${bot.voice.adapters.size}`,
      );
    message.channel.send({embeds: [embed]});
    break;
  case 'gzr':
    if (!args[1] || !parseInt(args[1])) return;
    sendMessageToUser(message, args[1], undefined);
    break;
  case 'gzm':
    if (!args[1]) {
      message.channel.send('active process #' + process.pid.toString() + ' is in ' +
      bot.voice.adapters.size + ' servers.');
      break;
    } else if (args[1] === 'update') {
      if (process.pid === 4 || (args[2] && args[2] === 'force')) {
        const updateMsg = 'db vibe is about to be updated. This may lead to a temporary interruption.';
        bot.voice.adapters.forEach((x, g) => {
          try {
            const guildToUpdate = bot.channels.cache.get(getVoiceConnection(g).joinConfig.channelId).guild;
            const currentEmbedChannelId = processStats.servers.get(guildToUpdate.id).currentEmbedChannelId;
            if (currentEmbedChannelId && bot.channels.cache.get(currentEmbedChannelId)) {
              bot.channels.cache.get(currentEmbedChannelId).send(updateMsg);
            } else {
              bot.channels.cache.get(getVoiceConnection(g).joinConfig.channelId).guild.systemChannel.send(updateMsg);
            }
          } catch (e) {}
        });
        message.channel.send('*update message sent to ' + bot.voice.adapters.size + ' channels*');
      } else {
        message.channel.send('The active bot is not running on Heroku so a git push would not interrupt listening.\n' +
            'To still send out an update use \'gzm update force\'');
      }
    } else if (args[1] === 'listu') {
      let gx = '';
      bot.voice.adapters.forEach((x, g) => {
        try {
          const gmArray = Array.from(bot.channels.cache.get(getVoiceConnection(g).joinConfig.channelId).members);
          gx += `${gmArray[0][1].guild.name}: *`;
          gmArray.map((item) => item[1].user.username).forEach((x) => gx += `${x}, `);
          gx = `${gx.substring(0, gx.length - 2)}*\n`;
        } catch (e) {}
      });
      if (gx) message.channel.send(gx);
      else message.channel.send('none found');
    }
    break;
    // guess a member in a voice channel
  case 'guess':
    if (args[1]) {
      const numToCheck = parseInt(args[1]);
      if (!numToCheck || numToCheck < 1) {
        return message.channel.send('Number has to be positive.');
      }
      const randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
      message.channel.send(`*guessing from 1-${numToCheck}... chosen: **${randomInt2}***`);
    } else {
      if (message.member?.voice?.channel) {
        try {
          let gmArray = Array.from(bot.channels.cache.get(message.member.voice.channel.id).members);
          gmArray = gmArray.map((item) => item[1].nickname || item[1].user.username);
          if (gmArray < 1) {
            return message.channel.send('Need at least 1 person in a voice channel.');
          }
          const randomInt = Math.floor(Math.random() * gmArray.length) + 1;
          message.channel.send(`*chosen voice channel member: **${gmArray[randomInt - 1]}***`);
        } catch (e) {}
      } else {
        message.channel.send('need to be in a voice channel for this command');
      }
    }
    break;
  }
}

bot.on('guildDelete', (guild) => {
  if (processStats.isInactive || processStats.devMode) return;
  gsrun('A', 'B', PREFIX_SN).then(async (xdb) => {
    for (let i = 0; i < xdb.line.length; i++) {
      const itemToCheck = xdb.line[i];
      if (itemToCheck === guild.id) {
        i += 1;
        await deleteRows(PREFIX_SN, i);
        break;
      }
    }
  });
});

bot.on('guildCreate', (guild) => {
  if (processStats.isInactive || processStats.devMode) return;
  guild.systemChannel.send('Type \'.help\' to see my commands.').then();
});

bot.once('ready', () => {
  // bot starts up as inactive, if no response from the channel then activates itself
  if (process.pid === 4) {
    if (processStats.devMode) {
      logError('`NOTICE: production process started up in devMode` (switching off devMode..)');
      processStats.devMode = false;
    }
    buildNo.decrementBuildNo();
  }
  // noinspection JSUnresolvedFunction
  processStats.initializeServer(CH['check-in-guild']);
  if (processStats.devMode) {
    console.log('-devmode enabled-');
    processStats.setProcessActive();
  } else {
    checkStatusOfYtdl(processStats.servers.get(CH['check-in-guild'])).then();
    processStats.setProcessInactive();
    bot.user.setActivity('beats | .db-vibe', {type: 'PLAYING'});
    if (!processStats.checkActiveInterval) {
      processStats.checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS);
    }
    console.log('-starting up sidelined-');
    console.log('checking status of other bots...');
    // bot logs - startup (NOTICE: "starting:" is reserved)
    (async () => (await bot.channels.fetch(CH.process)).send(`starting: ${process.pid} [${buildNo.getBuildNo()}]`)
      .then(() => {
        checkToSeeActive();
      }))();
  }
});

// calibrate on startup
bot.on('messageCreate', async (message) => {
  if (processStats.devMode) return;
  if (message.channel.id !== CH.process) return;
  // ~db-process (standard)[11] | -on [3] | 1 or 0 (vc size)[1] | 12345678 (build no)[8]
  // turn off active bots -- activates on '~db-process'
  if (message.content.substring(0, 11) === '~db-process') {
    // if seeing bots that are on
    if (message.content.substr(11, 3) === '-on') {
      const oBuildNo = message.content.substr(15, 8);
      // compare versions || check if actively being used (if so: keep on)
      if (parseInt(oBuildNo) >= parseInt(buildNo.getBuildNo()) || message.content.substr(14, 1) !== '0') {
        setOfBotsOn.add(message.content.substring(26));
        // update this process if out-of-date or reset process interval if an up-to-date process has queried
        if (processStats.isInactive) {
          // 2hrs of uptime is required to update process
          if (bot.uptime > 7200000 && process.pid !== 4 &&
            parseInt(oBuildNo.substring(0, 6)) > parseInt(buildNo.getBuildNo().substring(0, 6))) {
            devUpdateCommand();
          } else if (parseInt(oBuildNo.substring(0, 6)) >= parseInt(buildNo.getBuildNo().substring(0, 6))) {
            clearInterval(processStats.checkActiveInterval);
            // offset for process timer is 3.5 seconds - 5.9 minutes
            const offset = Math.floor(((Math.random() * 100) + 1) / 17 * 60000);
            // reset the =gzk interval since query was already made by another process
            processStats.checkActiveInterval = setInterval(checkToSeeActive, (checkActiveMS + offset));
          }
        }
      }
    } else if (message.content.substr(11, 4) === '-off') {
      // ~db-process [11] | -off [3] | 12345678 (build no) [8] | - [1]
      // compare process IDs
      if (message.content.substr(24).trim() !== process.pid.toString()) {
        processStats.setProcessInactive();
      } else {
        processStats.setProcessActive();
      }
    }
  } else if (processStats.isInactive && message.content.substring(0, 9) === 'starting:') {
    // view the build number of the starting process, if newer version then update
    if (bot.uptime > 7200000 && process.pid !== 4) {
      const regExp = /\[(\d+)\]/;
      const regResult = regExp.exec(message.content);
      const oBuildNo = regResult ? regResult[1] : null;
      if (oBuildNo && parseInt(oBuildNo.substring(0, 6)) > parseInt(buildNo.getBuildNo().substring(0, 6))) {
        devUpdateCommand();
      }
    }
  }
});

/**
 * Manages a custom or PM2 update command. Does not work with the heroku process.
 * Provided arguments must start with a keyword. If the first argument is 'custom' then processes a custom command.
 * If it is 'all' then restarts both PM2 processes. Providing an invalid first argument would void the update.
 * An empty argument array represents a standard update.
 * @param message {any?} Optional - The message that triggered the bot.
 * @param args {array<string>?} Optional - arguments for the command.
 */
function devUpdateCommand(message, args = []) {
  if (process.pid === 4) {
    message?.channel.send('*heroku process cannot be updated*');
    return;
  }
  let response = 'updating process...';
  console.log(response);
  if (bot.voice.adapters.size > 0) {
    if (args[0] === 'force') {
      args.splice(0, 1);
    } else {
      message?.channel.send('***people are using the bot:*** *to force an update type \`force\` after the command*');
      return;
    }
  }
  if (!args[0]) {
    exec('git stash && git pull && npm upgrade && npm i && pm2 restart vibe');
    processStats.setProcessInactive();
  } else if (args[0] === 'all') {
    exec('git stash && git pull && npm upgrade && npm i && pm2 restart 0 && pm2 restart 1');
    processStats.setProcessInactive();
  } else if (args[0] === 'custom' && args[1]) {
    exec(args.slice(1).join(' '));
  } else {
    response = 'incorrect argument provided';
  }
  message?.channel.send(response);
}

/**
 * Interpret developer process-related commands. Used for maintenance of multiple db vibe instances.
 * The first three letters of the message are assumed to be the developer prefix and are therefore ignored.
 * @param message The message metadata.
 */
async function devProcessCommands(message) {
  const zargs = message.content.split(' ');
  switch (zargs[0].substring(3)) {
  case 'k':
    // =gzk
    if (CH.process === message.channel.id) {
      if (!processStats.isInactive && !processStats.devMode) {
        const dbOnMsg = `~db-process-on${Math.min(bot.voice.adapters.size, 9)}${buildNo.getBuildNo()}ver${process.pid}`;
        return message.channel.send(dbOnMsg);
      }
      return;
    }
    if (!zargs[1]) {
      let dm;
      if (processStats.devMode) {
        dm = ' (dev mode)';
      } else {
        dm = bot.voice.adapters.size ? ' (VCs: ' + bot.voice.adapters.size + ')' : '';
      }
      // the process message: [sidelined / active] [process number] [version number]
      const procMsg = () => {
        return (processStats.isInactive ? 'sidelined: ' : (processStats.devMode ? 'active: ' : '**active: **')) +
        process.pid +' (' + version + ')' + dm;
      };
      message.channel.send(procMsg()).then((sentMsg) => {
        const devR = reactions.O_DIAMOND;
        if (processStats.devMode) {
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
          if (processStats.devMode) {
            dm = ' (dev mode)';
          } else {
            dm = bot.voice.adapters.size ? ' (VCs: ' + bot.voice.adapters.size + ')' : '';
          }
          try {
            sentMsg.edit(procMsg());
          } catch (e) {
            const updatedMsg =
            '*db vibe ' + process.pid + (processStats.isInactive ? ' has been sidelined*' : ' is now active*');
            message.channel.send(updatedMsg);
          }
        };
        const collector = sentMsg.createReactionCollector({filter, time: 30000});
        let prevVCSize = bot.voice.adapters.size;
        let prevStatus = processStats.isInactive;
        let prevDevMode = processStats.devMode;
        const statusInterval = setInterval(() => {
          if (!(bot.voice.adapters.size === prevVCSize && prevStatus === processStats.isInactive &&
            prevDevMode === processStats.devMode)) {
            prevVCSize = bot.voice.adapters.size;
            prevDevMode = processStats.devMode;
            prevStatus = processStats.isInactive;
            if (sentMsg.deletable) updateMessage();
            else clearInterval(statusInterval);
          }
        }, 4500);

        collector.on('collect', (reaction, user) => {
          if (reaction.emoji.name === reactions.GEAR) {
            if (!processStats.isInactive && bot.voice.adapters.size > 0) {
              let hasDeveloper = false;
              if (bot.voice.adapters.size === 1) {
                bot.voice.adapters.forEach((x) => {
                  if (x.channel.members.get('443150640823271436') || x.channel.members.get('268554823283113985')) {
                    hasDeveloper = true;
                    x.disconnect();
                    processStats.removeActiveStream(x.channel.guild.id);
                  }
                });
              }
              if (!hasDeveloper) {
                message.channel.send('***' + process.pid + ' - button is disabled***\n*This process should not be ' +
                    'sidelined because it has active members using it (VCs: ' + bot.voice.adapters.size + ')*\n' +
                    '*If you just activated another process, please deactivate it.*');
                return;
              }
            }
            if (processStats.isInactive) {
              processStats.setProcessActive();
            } else {
              processStats.setProcessInactive();
            }

            if (sentMsg.deletable) {
              updateMessage();
              reaction.users.remove(user.id);
            }
          } else if (reaction.emoji.name === devR) {
            processStats.devMode = false;
            processStats.setProcessInactive();
            if (!processStats.checkActiveInterval) {
              processStats.checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS);
            }
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
      processStats.setProcessInactive();
    } else {
      let i = 1;
      while (zargs[i]) {
        if (zargs[i].replace(/,/g, '') === process.pid.toString()) {
          if (processStats.isInactive) {
            processStats.setProcessActive();
            message.channel.send('*db vibe ' + process.pid + ' is now active*');
          } else {
            processStats.setProcessInactive();
            message.channel.send('*db vibe ' + process.pid + ' has been sidelined*');
          }
          return;
        }
        i++;
      }
    }
    break;
  case 'd':
    // =gzd
    const activeStatus = processStats.isInactive ? 'inactive' : '**active**';
    if (!zargs[1]) {
      return message.channel.send(activeStatus + ' process: ' + process.pid.toString() +
          ' (' + 'dev mode: ' + processStats.devMode + ')');
    }
    if (processStats.devMode && zargs[1] === process.pid.toString()) {
      processStats.devMode = false;
      processStats.setProcessInactive();
      processStats.servers.delete(message.guild.id);
      return message.channel.send(`*devmode is off ${process.pid}*`);
    } else if (zargs[1] === process.pid.toString()) {
      processStats.devMode = true;
      processStats.servers.delete(message.guild.id);
      if (processStats.checkActiveInterval) {
        clearInterval(processStats.checkActiveInterval);
        processStats.checkActiveInterval = null;
      }
      return message.channel.send(`*devmode is on ${process.pid}*`);
    }
    break;
  case 'l':
    // =gzl
    message.channel.send(process.pid.toString() +
        `: Latency is ${Date.now() - message.createdTimestamp}ms.\nNetwork latency is ${Math.round(bot.ws.ping)}ms`);
    break;
  case 'q':
    // =gzq
    if (!processStats.devMode && zargs[1] !== process.pid.toString()) return;
    if (bot.voice.adapters.size > 0 && (!zargs[2] || zargs[2] !== 'force')) {
      message.channel.send('People are using the bot. Use force as the second argument.').then();
    } else {
      message.channel.send('restarting the bot... (may only shutdown)').then(() =>
        setTimeout(() => {
          process.exit();
        }, 2000));
    }
    break;
  case 'z':
    // =gzz
    if (message.author.bot && zargs[1] !== process.pid.toString()) {
      if (process.pid === 4) await new Promise((res) => setTimeout(res, 11000));
      else await new Promise((res) => setTimeout(res, Math.random() * 5000));
      checkToSeeActive();
    }
    break;
  case 'update':
    // =gzupdate
    if (zargs[1] && zargs[1] !== process.pid.toString()) return;
    if (!processStats.devMode && processStats.isInactive && process.pid !== 4) {
      message.channel.send(`*updating process ${process.pid}*`);
      devUpdateCommand();
    }
    break;
  case 'b':
    if (zargs[1]) {
      if (zargs[1] !== process.pid.toString()) return;
      if (zargs[2]) {
        if (zargs[2] === '+') {
          if (buildNo.incrementBuildNo()) {
            message.channel.send(`*build no incremented (${buildNo.getBuildNo()})*`);
          } else message.channel.send(`*could not increment (${buildNo.getBuildNo()})*`);
        } else if (zargs[2] === '-') {
          if (buildNo.decrementBuildNo()) {
            message.channel.send(`*build no decremented (${buildNo.getBuildNo()})*`);
          } else message.channel.send(`*could not decrement (${buildNo.getBuildNo()})*`);
        }
      } else {
        message.channel.send('try again followed by a \'+\' or \'-\' to increment or decrement.');
      }
    } else {
      message.channel.send(`*process ${process.pid} (${buildNo.getBuildNo()})*`);
    }
    break;
  default:
    if (processStats.devMode && !processStats.isInactive) return runCommandCases(message);
    break;
  }
}

// parses message, provides a response
bot.on('messageCreate', (message) => {
  if (message.content.substring(0, 3) === '=gz' && isAdmin(message.author.id.toString()) || message.member.id === botID) {
    return devProcessCommands(message);
  }
  if (message.author.bot || processStats.isInactive || (processStats.devMode && !isAdmin(message.author.id))) return;
  if (message.channel.type === 'DM') {
    return dmHandler(message, message.content);
  } else {
    return runCommandCases(message);
  }
});

bot.on('voiceStateUpdate', (oldState, newState) => {
  const server = processStats.servers.get(oldState.guild.id);
  if (processStats.isInactive) {
    try {
      server.collector.stop();
    } catch (e) {}
    return;
  }
  updateVoiceState(oldState, newState, server).then();
});

/**
 * Updates the bots voice state depending on the update occurring.
 * @param oldState The old voice-state update metadata.
 * @param newState The new voice-state update metadata.
 * @param server The server metadata.
 */
async function updateVoiceState(oldState, newState, server) {
  if (!server) return;
  // if bot
  if (oldState.member.id === botID) {
    // if the bot joined then ignore
    if (newState.channel?.members.get(botID)) return;
    // clear timers first
    if (server.leaveVCTimeout) {
      clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = null;
    }
    clearDJTimer(server);
    // disconnect and delete the voice adapter
    const voiceConnection = getVoiceConnection(newState.guild.id);
    if (voiceConnection) disconnectConnection(server, voiceConnection);
    bot.voice.adapters.get(oldState.guild.id)?.destroy();
    processStats.removeActiveStream(oldState.guild.id);
    await sessionEndEmbed(server, server.queue[0] || server.queueHistory.slice(-1)[0]);
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
    if (server.currentEmbed?.reactions) {
      try {
        server.collector?.stop();
      } catch (e) {}
    }
    server.currentEmbed = null;
    if (server.followUpMessage) {
      server.followUpMessage.delete();
      server.followUpMessage = undefined;
    }
    if (bot.voice.adapters.size < 1) {
      whatspMap.clear();
      server.audio.reset();
    }
  } else if (botInVC(newState)) {
    if (oldState.channel?.members.filter((x) => !x.user.bot).size < 1) {
      let leaveVCInt = 1100;
      // if there is an active dispatch - timeout is 5 min
      if (server.audio.resource && !server.audio.resource.ended) leaveVCInt = 420000;
      // clear if timeout exists, set new timeout
      if (server.leaveVCTimeout) clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = setTimeout(() => {
        server.leaveVCTimeout = null;
        if (oldState.channel.members.filter((x) => !x.user.bot).size < 1) {
          const voiceConnection = getVoiceConnection(newState.guild.id);
          if (voiceConnection) disconnectConnection(server, voiceConnection);
        }
      }, leaveVCInt);
    }
  } else if (server.seamless.function && !oldState.member.user.bot) {
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
  .on('uncaughtException', uncaughtExceptionAction);

/**
 * The action to be performed if there is an uncaughtExceptionError.
 * @param e {Error} The Error Object.
 */
function uncaughtExceptionAction(e) {
  console.log('uncaughtException: ', e);
  console.log('error message: ', e.message);
}

// The main method
(async () => {
  // login to discord
  await bot.login(token);
  if (bot.user.id !== botID) throw new Error('Invalid botID');
})();
