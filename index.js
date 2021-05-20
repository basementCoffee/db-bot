require('dotenv').config();
const {MessageEmbed, Client} = require('discord.js');
const {gsrun, gsUpdateAdd, deleteRows, gsUpdateOverwrite} = require('./database');

const token = process.env.TOKEN.replace(/\\n/gm, '\n');
const spotifyCID = process.env.SPOTIFY_CLIENT_ID.replace(/\\n/gm, '\n');
const spotifySCID = process.env.SPOTIFY_SECRET_CLIENT_ID.replace(/\\n/gm, '\n');

// initialization
const bot = new Client();

// YouTube imports
const ytdl = require('ytdl-core-discord');
const ytsr = require('ytsr');
const ytpl = require('ytpl');

// Genius imports
const Genius = require("genius-lyrics");
const GeniusClient = new Genius.Client();

// Spotify imports
const spdl = require('spdl-core');
spdl.setCredentials(spotifyCID, spotifySCID);
const {getTracks, getData} = require("spotify-url-info");

// UPDATE HERE - Before Git Push
let devMode = true; // default false
const version = '4.2.4';
const buildNo = '04020300'; // major, minor, patch, build
let isInactive = !devMode; // default true - (see: bot.on('ready'))
let servers = {};
// the max size of the queue
const maxQueueSize = 500;
let keyArray;
let s;

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
function contentsContainCongrats (message) {
  return (
    message.content.includes('grats') ||
    message.content.includes('gratz') ||
    message.content.includes('ongratulations')
  );
}

process.setMaxListeners(0);

/**
 * Skips the song that is currently being played.
 * Use for specific voice channel playback.
 * @param message the message that triggered the bot
 * @param voiceChannel the voice channel that the bot is in
 * @param playMessageToChannel whether to play message on successful skip
 */
function skipSong (message, voiceChannel, playMessageToChannel) {
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
    servers[message.guild.id].loop = false;
    return;
  }
  if (!voiceChannel) {
    voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return;
    }
  }
  if (dispatcherMap[voiceChannel.id]) dispatcherMap[voiceChannel.id].pause();
  // if server queue is not empty
  if (servers[message.guild.id].queue.length > 0) {
    servers[message.guild.id].queueHistory.push(servers[message.guild.id].queue.shift());
    if (playMessageToChannel) message.channel.send('*skipped*');
    // if there is still items in the queue then play next song
    if (servers[message.guild.id].queue.length > 0) {
      // get rid of previous dispatch
      playSongToVC(message, servers[message.guild.id].queue[0], voiceChannel, true);
    } else {
      runStopPlayingCommand(message.guild.id, voiceChannel, true);
    }
  } else {
    runStopPlayingCommand(message.guild.id, voiceChannel, true);
  }
  if (servers[message.guild.id].followUpMessage) {
    servers[message.guild.id].followUpMessage.delete();
    servers[message.guild.id].followUpMessage = undefined;
  }
}

/**
 * Removes an item from the google sheets music database
 * @param message the message that triggered the bot
 * @param {string} keyName the key to remove
 * @param sheetName the name of the sheet to alter
 * @param sendMsgToChannel whether to send a response to the channel
 */
function runRemoveItemCommand (message, keyName, sheetName, sendMsgToChannel) {
  if (keyName) {
    gsrun('A', 'B', sheetName).then(async (xdb) => {
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
        gsrun('A', 'B', sheetName).then(async (xdb) => {
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
 * @param sheetName the name of the sheet to reference
 */
async function runPlayNowCommand (message, args, mgid, sheetName) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return;
  }
  if (!args[1]) {
    return message.channel.send('What should I play now? Put a link or some words.');
  }
  // in case of force disconnect
  if (
    !message.guild.client.voice ||
    !message.guild.voice ||
    !message.guild.voice.channel
  ) {
    servers[mgid].queue = [];
    servers[mgid].queueHistory = [];
    servers[mgid].loop = false;
  }
  if (servers[mgid].queue.length >= maxQueueSize) {
    return message.channel.send('*max queue size has been reached*');
  }
  if (servers[message.guild.id].followUpMessage) {
    servers[message.guild.id].followUpMessage.delete();
    servers[message.guild.id].followUpMessage = undefined;
  }
  servers[mgid].numSinceLastEmbed += 3;
  if (!ytdl.validateURL(args[1]) && !spdl.validateURL(args[1]) && !args[1].includes('spotify.com/playlist')) {
    if (sheetName) {
      return runDatabasePlayCommand(args, message, sheetName, true, false);
    } else {
      return runYoutubeSearch(message, args, mgid, true);
    }
  }
  try {
    // places the currently playing into the queue history if played long enough
    const dsp = dispatcherMap[voiceChannel.id];
    if (servers[mgid].queue[0] && servers[mgid].queue[0] === whatspMap[voiceChannel.id] &&
    dsp && dsp.streamTime && servers[mgid].queue[0].includes('spotify.com') ? dsp.streamTime > 90000 : dsp.streamTime > 150000) {
      servers[mgid].queueHistory.push(servers[mgid].queue.shift());
    }
  } catch (e) {}
  let pNums = 0;
  let playlist;
  let isPlaylist = false;
  if (args[1].includes('spotify.com/playlist')) {
    try {
      playlist = await getTracks(args[1]);
      isPlaylist = true;
    } catch (e) {
      return message.channel.send('could not play');
    }
  }
  if (ytpl.validateID(args[1]) || isPlaylist) {
    try {
      if (!isPlaylist) {
        const playlistID = await ytpl.getPlaylistID(args[1]);
        playlist = await ytpl(playlistID, {pages: 1});
        playlist = playlist.items;
      }
      let itemsLeft = maxQueueSize - servers[mgid].queue.length;
      let lowestLengthIndex = Math.min(playlist.length, itemsLeft) - 1;
      let item;
      let url;
      while (lowestLengthIndex > -1) {
        item = playlist[lowestLengthIndex];
        lowestLengthIndex--;
        url = isPlaylist ? item.external_urls.spotify : (item.shortUrl ? item.shortUrl : item.url);
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
    } catch (e) {
      console.log("Failed: " + e);
      message.channel.send('There was an error.');
    }
  } else {
    // push to queue
    servers[mgid].queue.unshift(args[1]);
  }
  message.channel.send('*playing now*');
  return playSongToVC(message, servers[mgid].queue[0], voiceChannel, true);
}

/**
 * Runs the commands and checks to play a link
 * @param message The message that triggered the bot
 * @param args An array of given play parameters, should be links or keywords
 * @param mgid The message guild id
 * @param sheetName The name of the sheet to reference
 */
async function runPlayLinkCommand (message, args, mgid, sheetName) {
  if (!message.member.voice.channel) {
    return message.channel.send("must be in a voice channel to play");
  }
  if (!args[1]) {
    if (servers[mgid].queue[0] && dispatcherMap[message.member.voice.channel.id] &&
      dispatcherMapStatus[message.member.voice.channel.id]) {
      dispatcherMap[message.member.voice.channel.id].resume();
      return message.channel.send('*playing*');
    }
    return message.channel.send('What should I play? Put a link or some words.');
  }
  if (!ytdl.validateURL(args[1]) && !spdl.validateURL(args[1]) && !args[1].includes('spotify.com/playlist')) {
    if (sheetName) {
      return runDatabasePlayCommand(args, message, sheetName, false, false);
    } else {
      return runYoutubeSearch(message, args, mgid, false);
    }
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[mgid].queue = [];
    servers[mgid].queueHistory = [];
    servers[mgid].loop = false;
  }
  let queueWasEmpty = false;
  if (servers[mgid].queue.length < 1) {
    queueWasEmpty = true;
  }
  let pNums = 0;
  let playlist;
  let isPlaylist = false;
  if (args[1].includes('spotify.com/playlist')) {
    try {
      playlist = await getTracks(args[1]);
      isPlaylist = true;
    } catch (e) {
      return message.channel.send('could not play');
    }
  }
  if (ytpl.validateID(args[1]) || isPlaylist) {
    try {
      if (!isPlaylist) {
        const playlistID = await ytpl.getPlaylistID(args[1]);
        playlist = await ytpl(playlistID, {pages: 1});
        playlist = playlist.items;
      }
      let itemsLeft = maxQueueSize - servers[mgid].queue.length;
      let url;
      for (let j of playlist) {
        url = isPlaylist ? j.external_urls.spotify : (j.shortUrl ? j.shortUrl : j.url);
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
    } catch (e) {
      console.log("Failed: " + e);
      message.channel.send('There was an error.');
    }
  } else {
    pNums = 1;
    while (args[pNums]) {
      let linkZ = args[pNums];
      if (linkZ.substring(linkZ.length - 1) === ',') {
        linkZ = linkZ.substring(0, linkZ.length - 1);
      }
      // push to queue
      servers[mgid].queue.push(args[pNums]);
      pNums += 1;
    }
    // make pNums the number of added songs
    pNums--;
  }
  // if queue was empty then play
  if (queueWasEmpty) {
    playSongToVC(message, servers[mgid].queue[0], message.member.voice.channel, true);
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
 * @param keyword Enum being either 'restart' or 'replay'
 * @returns {*}
 */
async function runRestartCommand (message, mgid, keyword) {
  if (!servers[mgid].queue[0] && !servers[mgid].queueHistory) return message.channel.send('must be actively playing to ' + keyword);
  if (servers[mgid].queue[0]) {
    await playSongToVC(message, servers[mgid].queue[0], message.member.voice.channel, true);
  } else if (servers[mgid].queueHistory.length > 0) {
    servers[mgid].queue.push(servers[mgid].queueHistory.pop());
    await playSongToVC(message, servers[mgid].queue[0], message.member.voice.channel, true);
  } else {
    message.channel.send('there is nothing to ' + keyword);
  }
}

/**
 * The execution for all of the bot commands
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
async function runCommandCases (message) {
  const mgid = message.guild.id;
  if (devMode) {
    if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
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
    bot.user.setActivity('[ .help ]', {type: 'WATCHING'}).then();
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
    return;
  }
  const args = message.content.replace(/\s+/g, ' ').split(' ');
  console.log(args); // see recent bot commands within console for testing
  const statement = args[0].substr(1).toLowerCase();
  if (statement.substr(0, 1) === 'g' && statement !== 'guess') {
    if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
      return;
    }
  }
  // the server guild playback data
  if (!servers[mgid]) {
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
      verbose: false
    };
  }
  if (message.channel.id === servers[mgid].currentEmbedChannelId) servers[mgid].numSinceLastEmbed += 2;
  switch (statement) {
    // !p is just the basic rhythm bot
    case 'p':
      runPlayLinkCommand(message, args, mgid, undefined);
      break;
    case 'play':
      runPlayLinkCommand(message, args, mgid, undefined);
      break;
    case 'mp':
      runPlayLinkCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mplay':
      runPlayLinkCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'gp':
      runPlayLinkCommand(message, args, mgid, 'entries');
      break;
    case 'gplay':
      runPlayLinkCommand(message, args, mgid, 'entries');
      break;
    // !pn is the play now command
    case 'gpn':
      runPlayNowCommand(message, args, mgid, 'entries');
      break;
    case 'pn':
      runPlayNowCommand(message, args, mgid, undefined);
      break;
    case 'pnow':
      runPlayNowCommand(message, args, mgid, undefined);
      break;
    case 'playnow':
      runPlayNowCommand(message, args, mgid, undefined);
      break;
    case 'mpn':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mpnow':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mplaynow':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    //! e is the Stop feature
    case 'e':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'end':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'leave':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'quit':
      runStopPlayingCommand(mgid, message.member.voice.channel);
      break;
    case 'loop':
      if (!message.guild.voice || !message.guild.voice.channel) {
        return message.channel.send('must be playing a song to loop');
      }
      if (servers[mgid].loop) {
        servers[mgid].loop = false;
        message.channel.send('*looping disabled*');
      } else {
        servers[mgid].loop = true;
        message.channel.send('*looping enabled*');
      }
      break;
    case 'stop':
      if (message.member.voice && dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].pause();
        dispatcherMapStatus[message.member.voice.channel.id] = true;
        message.channel.send('*stopped*');
      }
      break;
    case 'lyrics':
      if ((!message.guild.voice || !message.guild.voice.channel || !servers[mgid].queue[0]) && !args[1]) {
        return message.channel.send('must be playing a song');
      }
      message.channel.send('retrieving lyrics...').then(async sentMsg => {
        servers[mgid].numSinceLastEmbed += 2;
        let searchTerm;
        let searchTermRemix;
        let songName;
        let artistName;
        if (args[1]) {
          args[0] = '';
          searchTerm = args.join(' ').trim();
        } else {
          if (servers[mgid].queue[0].includes('spotify')) {
            const infos = await getData(servers[mgid].queue[0]);
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
            const infos = await ytdl.getInfo(servers[mgid].queue[0]);
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
              const artistNameSubIndex = artistName.search(' feat');
              if (artistNameSubIndex !== -1) artistName = artistName.substr(0, artistNameSubIndex);
              searchTerm = songName + ' ' + artistName;
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
          console.log(searchTerm);
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
                message.channel.send(lyricsText).then(servers[mgid].numSinceLastEmbed += 10);
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
          message.channel.send('no results found');
          servers[mgid].numSinceLastEmbed -= 9;
        }
        sentMsg.delete();
      });
      break;
    // !gd is to run database songs
    case 'gd':
      runDatabasePlayCommand(args, message, 'entries', false, true);
      break;
    case 'gdn':
      runDatabasePlayCommand(args, message, 'entries', true, true);
      break;
    case 'gdnow':
      runDatabasePlayCommand(args, message, 'entries', true, true);
      break;
    case 'gkn':
      runDatabasePlayCommand(args, message, 'entries', true, true);
      break;
    case 'gknow':
      runDatabasePlayCommand(args, message, 'entries', true, true);
      break;
    // !d
    case 'd':
      runDatabasePlayCommand(args, message, mgid, false, false);
      break;
    case 'dn':
      runPlayNowCommand(message, args, mgid, mgid);
      break;
    case 'dnow':
      runPlayNowCommand(message, args, mgid, mgid);
      break;
    case 'kn':
      runPlayNowCommand(message, args, mgid, mgid);
      break;
    case 'know':
      runPlayNowCommand(message, args, mgid, mgid);
      break;
    // !md is the personal database
    case 'md':
      runDatabasePlayCommand(args, message, 'p' + message.member.id, false, true);
      break;
    case 'mdn':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mdnow':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mkn':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    case 'mknow':
      runPlayNowCommand(message, args, mgid, 'p' + message.member.id);
      break;
    // !r is a random that works with the normal queue
    case 'r':
      runRandomToQueue(args[1], message, mgid);
      break;
    case 'rand':
      runRandomToQueue(args[1], message, mgid);
      break;
    // !gr is the global random to work with the normal queue
    case 'gr':
      runRandomToQueue(args[1], message, 'entries');
      break;
    // !mr is the personal random that works with the normal queue
    case 'mr':
      runRandomToQueue(args[1], message, 'p' + message.member.id);
      break;
    case 'mrand':
      runRandomToQueue(args[1], message, 'p' + message.member.id);
      break;
    // !keys is server keys
    case 'keys':
      runKeysCommand(message, prefixString, mgid, '', '', '');
      break;
    // !key
    case 'key':
      runKeysCommand(message, prefixString, mgid, '', '', '');
      break;
    case 'k':
      if (args[1]) runDatabasePlayCommand(args, message, mgid, false, false);
      else runKeysCommand(message, prefixString, mgid, '', '', '');
      break;
    // !mkeys is personal keys
    case 'mkeys':
      runKeysCommand(message, prefixString, 'p' + message.member.id, 'm', '', '');
      break;
    // !mkey is personal keys
    case 'mkey':
      runKeysCommand(message, prefixString, 'p' + message.member.id, 'm', '', '');
      break;
    case 'mk':
      if (args[1]) runDatabasePlayCommand(args, message, 'p' + message.member.id, false, false);
      else runKeysCommand(message, prefixString, 'p' + message.member.id, 'm', '', '');
      break;
    case 'gk':
      if (args[1]) runDatabasePlayCommand(args, message, 'entries', false, false);
      else runKeysCommand(message, prefixString, 'entries', 'g', '', '');
      break;
    // !gkeys is global keys
    case 'gkeys':
      runKeysCommand(message, prefixString, 'entries', 'g', '', '');
      break;
    // !gkey is global keys
    case 'gkey':
      runKeysCommand(message, prefixString, 'entries', 'g', '', '');
      break;
    // !search is the search
    case 'search':
      if (!args[1]) {
        return message.channel.send('No argument was given.');
      }
      runUniversalSearchCommand(message, mgid, args[1]);
      break;
    // !s prints out the db size or searches
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
    case '?':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'np':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'now':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'what':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'nowplaying':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'playing':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'current':
      await runWhatsPCommand(args, message, mgid, mgid);
      break;
    case 'g?':
      await runWhatsPCommand(args, message, mgid, 'entries');
      break;
    case 'm?':
      await runWhatsPCommand(args, message, mgid, 'p' + message.member.id);
      break;
    case 'queue':
      servers[mgid].numSinceLastEmbed += 10;
      runQueueCommand(message, mgid);
      break;
    case 'q':
      servers[mgid].numSinceLastEmbed += 10;
      runQueueCommand(message, mgid);
      break;
    case 'que':
      servers[mgid].numSinceLastEmbed += 10;
      runQueueCommand(message, mgid);
      break;
    case 'list':
      servers[mgid].numSinceLastEmbed += 10;
      runQueueCommand(message, mgid);
      break;
    case 'upnext':
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
      if (args[1].toUpperCase() !== args[1].toLowerCase() || args[1].charCodeAt(0) > 120) {
        return message.channel.send("cannot have a letter as a prefix.");
      }
      args[2] = args[1];
      args[1] = mgid;
      message.channel.send('*changing prefix...*');
      await gsrun('A', 'B', 'prefixes').then(async () => {
        await runRemoveItemCommand(message, args[1], 'prefixes', false);
        await runAddCommand(args, message, 'prefixes', false);
        await gsrun('A', 'B', 'prefixes').then(async (xdb) => {
          await gsUpdateOverwrite(xdb.congratsDatabase.size + 2, 1, 'prefixes', xdb.dsInt);
          prefixMap[mgid] = args[2];
          message.channel.send('Prefix successfully changed to ' + args[2]);
          prefixString = args[2];
          let name = 'db bot';
          let prefixName = '[' + prefixString + ']';
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
            message.channel.send('---------------------');
            message.channel.send('Would you like me to update my name to reflect this? (yes or no)\nFrom **' + (message.guild.me.nickname || 'db bot') + '**  -->  **' + prefixName + " " + name + '**').then(() => {
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
      break;
    // list commands for public commands
    case 'h':
      servers[mgid].numSinceLastEmbed += 10;
      sendHelp(message, prefixString);
      break;
    case 'help':
      servers[mgid].numSinceLastEmbed += 10;
      sendHelp(message, prefixString);
      break;
    // !skip
    case 'skip':
      runSkipCommand(message, args[1]);
      break;
    // !sk
    case 'sk':
      runSkipCommand(message, args[1]);
      break;
    // !pa
    case 'pa':
      if (message.member.voice && message.guild.voice && message.guild.voice.channel &&
        dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].pause();
        dispatcherMapStatus[message.member.voice.channel.id] = true;
        message.channel.send('*paused*');
      }
      break;
    case 'pause':
      if (message.member.voice && message.guild.voice && message.guild.voice.channel &&
        dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].pause();
        dispatcherMapStatus[message.member.voice.channel.id] = true;
        message.channel.send('*paused*');
      } else {
        message.channel.send('nothing is playing right now');
      }
      break;
    // !pl
    case 'pl':
      if (message.member.voice && message.guild.voice && message.guild.voice.channel &&
        dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].resume();
        dispatcherMapStatus[message.member.voice.channel.id] = false;
        message.channel.send('*playing*');
      } else {
        message.channel.send('nothing is playing right now');
      }
      break;
    case 'res':
      if (message.member.voice && message.guild.voice && message.guild.voice.channel &&
        dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].resume();
        dispatcherMapStatus[message.member.voice.channel.id] = false;
        message.channel.send('*playing*');
      }
      break;
    case 'resume':
      servers[mgid].numSinceLastEmbed += 3;
      if (message.member.voice && message.guild.voice && message.guild.voice.channel &&
        dispatcherMap[message.member.voice.channel.id]) {
        dispatcherMap[message.member.voice.channel.id].resume();
        dispatcherMapStatus[message.member.voice.channel.id] = false;
        message.channel.send('*playing*');
      } else {
        message.channel.send('nothing is playing right now');
      }
      break;
    case 'time':
      if (dispatcherMap[message.member.voice.channel.id]) {
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      }
      break;
    case 'timestamp':
      if (dispatcherMap[message.member.voice.channel.id]) {
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      }
      break;
    case 'ts':
      if (dispatcherMap[message.member.voice.channel.id]) {
        message.channel.send('timestamp: ' + formatDuration(dispatcherMap[message.member.voice.channel.id].streamTime));
      }
      break;
    case 'verbose':
      if (!servers[mgid].verbose) {
        servers[mgid].verbose = true;
        message.channel.send('***verbose mode enabled***, *embeds will be kept during this listening session*');
      } else {
        servers[mgid].verbose = false;
        message.channel.send('***verbose mode disabled***');
      }
      break;
    // !v prints out the version number
    case 'v':
      message.channel.send('version: ' + version + '\n' + 'build: ' + buildNo);
      break;
    // !devadd
    case 'devadd':
      if (message.member.id.toString() !== '443150640823271436' && message.member.id.toString() !== '268554823283113985') {
        return;
      }
      message.channel.send(
        "Here's link to add to the database:\n" +
        "<https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622>"
      );
      break;
    // !ga adds to the server database
    case 'ga':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a song name followed by a link.'
        );
      }
      if (!verifyUrl(message, args[2])) return;
      // in case the database has not been initialized
      gsrun('A', 'B', 'entries').then(() => {
        runAddCommand(args, message, 'entries', true);
      });
      break;
    // !a is normal add
    case 'a':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Incorrect format. Put a desired key-name followed by a link. *(ex: ' +
          prefixString + 'a [key] [link])*'
        );
      }
      if (!verifyUrl(message, args[2])) return;
      // in case the database has not been initialized
      gsrun('A', 'B', mgid).then(() => {
        runAddCommand(args, message, mgid, true);
      });
      break;
    case 'add':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a desired name followed by a link. *(ex: ' +
          prefixString + 'add [key] [link])*'
        );
      }
      if (!verifyUrl(message, args[2])) return;
      // in case the database has not been initialized
      gsrun('A', 'B', mgid).then(() => {
        runAddCommand(args, message, mgid, true);
      });
      break;
    // !ma is personal add
    case 'ma':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a desired name followed by a link. *(ex: ' +
          prefixString + 'ma [key] [link])*'
        );
      }
      if (!verifyUrl(message, args[2])) return;
      // in case the database has not been initialized
      gsrun('A', 'B', 'p' + message.member.id).then(() => {
        runAddCommand(args, message, 'p' + message.member.id, true);
      });
      break;
    case 'madd':
      if (!args[1] || !args[2]) {
        return message.channel.send(
          'Could not add to the database. Put a desired name followed by a link. *(ex: ' +
          prefixString + 'ma [key] [link])*'
        );
      }
      if (!verifyUrl(message, args[2])) return;
      // in case the database has not been initialized
      gsrun('A', 'B', 'p' + message.member.id).then(() => {
        runAddCommand(args, message, 'p' + message.member.id, true);
      });
      break;
    // !rm removes database entries
    case 'rm':
      runRemoveItemCommand(message, args[1], mgid, true);
      break;
    case 'remove':
      runRemoveItemCommand(message, args[1], mgid, true);
      break;
    // !grm removes database entries
    case 'grm':
      runRemoveItemCommand(message, args[1], 'entries', true);
      break;
    // !rm removes database entries
    case 'mrm':
      runRemoveItemCommand(message, args[1], 'p' + message.member.id, true);
      break;
    case 'mremove':
      runRemoveItemCommand(message, args[1], 'p' + message.member.id, true);
      break;
    case 'rewind':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to rewind');
      }
      runRewindCommand(message, mgid, message.member.voice.channel, args[1]);
      break;
    case 'rw':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to rewind');
      }
      runRewindCommand(message, mgid, message.member.voice.channel, args[1]);
      break;
    case 'replay':
      runRestartCommand(message, mgid, 'replay');
      break;
    case 'rp':
      runRestartCommand(message, mgid, 'replay');
      break;
    case 'restart':
      runRestartCommand(message, mgid, 'restart');
      break;
    case 'rs':
      runRestartCommand(message, mgid, 'restart');
      break;
    case 'clear' :
      if (!message.member.voice.channel) return message.channel.send('must be in a voice channel to clear');
      const currentSong = (dispatcherMap[message.member.voice.channel.id]) ? servers[mgid].queue[0] : undefined;
      servers[mgid].queue = [];
      servers[mgid].queueHistory = [];
      servers[mgid].loop = false;
      if (currentSong) servers[mgid].queue[0] = currentSong;
      message.channel.send('The queue has been scrubbed clean');
      if (!embedMessageMap[mgid] && currentSong) await runWhatsPCommand(args, message, mgid, undefined);
      else if (currentSong) message.channel.send('queue size: 1');
      break;
    case 'invite':
      message.channel.send("Here's the invite link!\n<https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot>");
      break;
    case 'inv':
      message.channel.send("Here's the invite link!\n<https://discord.com/oauth2/authorize?client_id=730350452268597300&permissions=1076288&scope=bot>");
      break;
    case 'silence':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to silence');
      }
      if (silenceMap[mgid]) {
        return message.channel.send('*song notifications already silenced, use \'unsilence\' to unsilence.*');
      }
      silenceMap[mgid] = true;
      message.channel.send('*song notifications silenced for this session*');
      break;
    case 'unsilence':
      if (!message.member.voice.channel) {
        return message.channel.send('You must be in a voice channel to unsilence');
      }
      if (!silenceMap[mgid]) {
        return message.channel.send('*song notifications already unsilenced*');
      }
      silenceMap[mgid] = false;
      message.channel.send('*song notifications enabled*');
      if (dispatcherMap[message.member.voice.channel.id]) {
        sendLinkAsEmbed(message, whatspMap[message.member.voice.channel.id], message.member.voice.channel).then();
      }
      break;
    case 'l':
      if (!message.guild.voice || !message.guild.voice.channel) {
        return;
      }
      if (servers[mgid].loop) {
        servers[mgid].loop = false;
        message.channel.send('*looping disabled*');
      } else {
        servers[mgid].loop = true;
        message.channel.send('*looping enabled*');
      }
      break;
    case 'gzh':
      const devCEmbed = new MessageEmbed()
        .setTitle('Dev Commands')
        .setDescription(
          prefixString + 'gzs - statistics' +
          '\n' + prefixString + 'gzi - user and bot id' +
          '\n' + prefixString + 'gzid - guild and channel id' +
          '\n' + prefixString + 'gzq - quit/restarts the active bot' +
          '\n' + prefixString + 'gzm update - sends a message to all active guilds that the bot will be updating' +
          '\n\n**calibrate multiple bots**' +
          '\n=gzl - return the bot\'s ping and latency' +
          '\n=gzd - toggle dev mode' +
          '\n=gzk - kill a process' +
          '\n=gzp - start a process' +
          '\n=gzc - ensure no two bots are on at the same time\n*(do not call gzc more than once within 5 minutes)*'
        )
        .setFooter('version: ' + version);
      message.channel.send(devCEmbed);
      break;
    case 'gzq':
      message.channel.send("quitting the bot... (may restart)");
      process.exit();
      break;
    case 'gzid':
      message.channel.send('g: ' + message.guild.id);
      message.channel.send('c: ' + message.channel.id);
      break;
    case 'version':
      message.channel.send('version: ' + version);
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
        bot.voice.connections.map(x => console.log(x.channel.guild.name));
        break;
      }
      if (args[1] === 'find') {
        let gx = '';
        bot.voice.connections.map(x => gx += x.channel.guild.name + ', ');
        gx = gx.substring(0, gx.length - 2);
        if (gx) message.channel.send(gx);
        else message.channel.send('none found');
        break;
      }
      if (args[1] === 'listu') {
        let gx = '';
        let tgx;
        let tempSet = new Set();
        bot.voice.connections.map(x => {
          tgx = '';
          tempSet.clear();
          x.channel.guild.voice.channel.members.map(y => tempSet.add(y.user.username));
          tempSet.forEach(z => tgx += z + ', ');
          tgx = tgx.substring(0, tgx.length - 2);
          gx += x.channel.guild.name + ': ' + tgx + '\n';
        });
        if (gx) message.channel.send(gx);
        else message.channel.send('none found');
        break;
      }
      if (args[1] === 'update') {
        if (process.pid === 4 || (args[2] && args[2] === 'force')) {
          bot.voice.connections.map(x => bot.channels.cache.get(x.channel.guild.systemChannelID).send('db bot is about to be updated. This may lead to a temporary interruption.'));
          message.channel.send('Update message sent to ' + bot.voice.connections.size + ' channels.');
        } else {
          message.channel.send('The active bot is not running on Heroku so a git push would not interrupt listening.\n' +
            'To still send out an update use \'gzm update force\'');
        }
      }
      break;
    case 'gzi':
      message.channel.send('bot id: ' + bot.user.id + '\nyour id: ' + message.member.id);
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
  mainActiveTimer = setInterval(checkToSeeActive, mainTimerTimeout);
  if (!devMode) {
    bot.channels.cache.get('827195452507160627').send('starting up: ' + process.pid);
    if (isInactive) {
      console.log('-starting up sidelined-');
      console.log('checking status of other bots...');
      checkToSeeActive();
    } else {
      bot.user.setActivity('[try ".help" ]', {type: 'PLAYING'}).then();
      bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
    }
  } else {
    console.log('-devmode enabled-');
  }
});
const setOfBotsOn = new Set();
let numOfBotsOn = 0;
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
        numOfBotsOn++;
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

function checkToSeeActive () {
  numOfBotsOn = 0;
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
  if (url.includes('spotify.com') ? !spdl.validateURL(url) : !ytdl.validateURL(url)) {
    message.channel.send('Invalid link');
    return false;
  }
  return true;
}

/**
 * Check to see if there was a response. If not then makes the current bot active.
 * @returns {boolean} if there was an initial response
 */
function responseHandler () {
  clearInterval(resHandlerTimer);
  if (numOfBotsOn < 1) {
    isInactive = false;
    devMode = false;
    bot.channels.cache.get('827195452507160627').send('=gzk').then(() => {
      console.log('-active-');
      servers = {};
      const waitForFollowup = setInterval(() => {
        clearInterval(waitForFollowup);
        bot.channels.cache.get('827195452507160627').send('=gzc ' + process.pid);
      }, 2500);
    });
  } else if (numOfBotsOn > 1 && setOfBotsOn.size > 1) {
    numOfBotsOn = 0;
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
    if (zmsg === 'zp' && isInactive) {
      const zargs = message.content.split(' ');
      let dm = '';
      if (devMode) {
        dm = '(dev mode)';
      }
      if (!zargs[1]) {
        await message.channel.send('sidelined: ' + process.pid + ' (' + version + ') ' + dm);
      } else if (zargs[1] === process.pid.toString() || zargs[1] === 'all') {
        isInactive = false;
        await message.channel.send('db bot ' + process.pid + ' is now active');
        console.log('-active-');
      }
      return;
    } else if (zmsg === 'zk' && !isInactive) {
      const zargs = message.content.split(' ');
      if (message.member.id === '730350452268597300' && !devMode) {
        return message.channel.send('~db-bot-process-on' + buildNo + 'ver' + process.pid);
      }
      if (!zargs[1]) {
        let dm = '';
        if (devMode) {
          dm = '(dev mode)';
        }
        await message.channel.send('active: ' + process.pid + ' (' + version + ') ' + dm);
        return;
      } else if (zargs[1] === process.pid.toString() || zargs[1] === 'all') {
        await message.channel.send('db bot ' + process.pid + ' has been sidelined');
        isInactive = true;
        console.log('-sidelined-');
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
        return message.channel.send('*devmode is on* ' + process.pid.toString());
      }
    } else if (zmsg === 'zl') {
      return message.channel.send(process.pid.toString() +
        `: Latency is ${Date.now() - message.createdTimestamp}ms.\nAPI Latency is ${Math.round(bot.ws.ping)}ms`);
    }
  }
  if (message.author.bot || isInactive) {
    return;
  }
  if (contentsContainCongrats(message)) {
    if (!servers[message.guild.id]) {
      servers[message.guild.id] = {
        queue: [],
        queueHistory: [],
        loop: false,
        collector: false
      };
    }
    message.channel.send('Congratulations!').then();
    return playSongToVC(message, 'https://www.youtube.com/watch?v=oyFQVZ2h0V8', message.member.voice.channel, false);
  } else if (message.channel.type === 'dm') {
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
  } else {
    runCommandCases(message).then();
  }
});

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
          gsUpdateAdd(args[z], args[z + 1], 'A', 'B', sheetName, xdb.dsInt);
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
 * @returns {Promise<void>|*}
 */
function runQueueCommand (message, mgid) {
  if (servers[mgid].queue < 1 || !message.guild.voice.channel) {
    return message.channel.send('There is no active queue right now');
  }
  const serverQueue = servers[mgid].queue.map((x) => x);
  let qIterations = serverQueue.length;
  if (qIterations > 11) qIterations = 11;
  let title;
  let authorName;

  async function getTitle (url, cutoff) {
    if (url.includes('spotify')) {
      const infos = await getData(url);
      title = infos.name;
    } else {
      const infos = await ytdl.getInfo(url);
      title = infos.videoDetails.title;
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
 * Executes play assuming that message args are intended for a database call.
 * The database referenced depends on what is passed in via mgid.
 * @param {*} args the message split by spaces into an array
 * @param {*} message the message that triggered the bot
 * @param {*} sheetName the name of the google sheet to reference
 * @param playRightNow bool of whether to play now or now
 * @param printErrorMsg prints error message, should be true unless attempting a followup db run
 * @returns whether the play command has been handled accordingly
 */
function runDatabasePlayCommand (args, message, sheetName, playRightNow, printErrorMsg) {
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
    servers[mgid].queue = [];
    servers[mgid].queueHistory = [];
    servers[mgid].loop = false;
  }
  if (servers[mgid].queue.length >= maxQueueSize) {
    message.channel.send('*max queue size has been reached*');
    return true;
  }
  servers[mgid].numSinceLastEmbed += 5;
  gsrun('A', 'B', sheetName).then(async (xdb) => {
    let queueWasEmpty = false;
    // if the queue is empty then play
    if (servers[mgid].queue.length < 1) {
      queueWasEmpty = true;
    }
    if (args[2] && !playRightNow) {
      let dbAddInt = 1;
      let unFoundString = '*could not find: ';
      let firstUnfoundRan = false;
      let dbAddedToQueue = 0;
      let otherSheet;
      while (args[dbAddInt]) {
        if (!xdb.referenceDatabase.get(args[dbAddInt].toUpperCase())) {
          // check personal db if applicable
          if (sheetName.substr(0, 1) !== 'p') {
            if (!otherSheet) {
              await gsrun('A', 'B', 'p' + message.member.id).then((xdb) => {
                otherSheet = xdb.referenceDatabase;
              });
            }
            if (otherSheet.get(args[dbAddInt].toUpperCase())) {
              // push to queue
              servers[mgid].queue.push(otherSheet.get(args[dbAddInt].toUpperCase()));
              dbAddedToQueue++;
              dbAddInt++;
              continue;
            }
          }
          if (firstUnfoundRan) {
            unFoundString = unFoundString.concat(', ');
          }
          unFoundString = unFoundString.concat(args[dbAddInt]);
          firstUnfoundRan = true;
        } else {
          // push to queue
          servers[mgid].queue.push(xdb.referenceDatabase.get(args[dbAddInt].toUpperCase()));
          dbAddedToQueue++;
        }
        dbAddInt++;
      }
      message.channel.send('*added ' + dbAddedToQueue + ' to queue*');
      if (firstUnfoundRan) {
        unFoundString = unFoundString.concat('*');
        message.channel.send(unFoundString);
      }
    } else {
      const itemToPlay = xdb.referenceDatabase.get(args[1].toUpperCase());
      if (!itemToPlay) {
        const ss = runSearchCommand(args[1], xdb).ss;
        if (ssi === 1 && ss && ss.length > 0 && args[1].length > 1 && (ss.length - args[1].length) < Math.floor((ss.length / 2) + 2)) {
          message.channel.send(
            "could not find '" + args[1] + "'. **Assuming '" + ss + "'**"
          );
          if (playRightNow) { // push to queue and play
            const dsp = dispatcherMap[voiceChannel.id];
            try {
              if (servers[mgid].queue[0] && servers[mgid].queue[0] === whatspMap[voiceChannel.id] &&
              dsp && dsp.streamTime && servers[mgid].queue[0].includes('spotify.com') ? dsp.streamTime > 90000 : dsp.streamTime > 150000) {
                servers[mgid].queueHistory.push(servers[mgid].queue.shift());
              }
            } catch (e) {}
            servers[mgid].queue.unshift(xdb.referenceDatabase.get(ss.toUpperCase()));
            playSongToVC(message, xdb.referenceDatabase.get(ss.toUpperCase()), voiceChannel, true);
            message.channel.send('*playing now*');
            return true;
          } else {
            servers[mgid].queue.push(xdb.referenceDatabase.get(ss.toUpperCase()));
          }
        } else if (playRightNow) {
          if (printErrorMsg) {
            message.channel.send("There's something wrong with what you put there.");
            return true;
          } else {
            runDatabasePlayCommand(args, message, 'p' + message.member.id, playRightNow, true);
          }
          return false;
        } else if (!printErrorMsg) {
          if (sheetName.includes('p')) {
            message.channel.send("There's something wrong with what you put there.");
            return true;
          } else {
            runDatabasePlayCommand(args, message, 'p' + message.member.id, playRightNow, false);
            return true;
          }
        } else if (ss && ss.length > 0) {
          message.channel.send(
            "Could not find '" + args[1] + "' in database.\n*Did you mean: " + ss + '*'
          );
          return true;
        } else {
          message.channel.send("Could not find '" + args[1] + "' in database.");
          return true;
        }
      } else { // did find in database
        if (playRightNow) { // push to queue and play
          const dsp = dispatcherMap[voiceChannel.id];
          try {
            if (servers[mgid].queue[0] && servers[mgid].queue[0] === whatspMap[voiceChannel.id] &&
            dsp && dsp.streamTime && servers[mgid].queue[0].includes('spotify.com') ? dsp.streamTime > 90000 : dsp.streamTime > 150000) {
              servers[mgid].queueHistory.push(servers[mgid].queue.shift());
            }
          } catch (e) {}
          servers[mgid].queue.unshift(itemToPlay);
          playSongToVC(message, itemToPlay, voiceChannel, true);
          message.channel.send('*playing now*');
          return true;
        } else {
          // push to queue
          servers[mgid].queue.push(itemToPlay);
        }
      }
      if (!queueWasEmpty && !playRightNow) {
        message.channel.send('*added to queue*');
      }
    }
    // if queue was empty then play
    if (queueWasEmpty && servers[mgid].queue.length > 0) {
      playSongToVC(message, servers[mgid].queue[0], voiceChannel, true);
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
 * @param skipTimes the number of times to skip
 */
function runSkipCommand (message, skipTimes) {
  if (!message.guild.voice || !message.guild.voice.channel) {
    return;
  }
  if (!message.member.voice.channel) {
    return message.channel.send('*must be in a voice channel to use this command*');
  }
  if (skipTimes) {
    try {
      skipTimes = parseInt(skipTimes);
      if (skipTimes > 0 && skipTimes < 1001) {
        let skipCounter = 0;
        while (skipTimes > 1 && servers[message.guild.id].queue.length > 0) {
          servers[message.guild.id].queueHistory.push(servers[message.guild.id].queue.shift());
          skipTimes--;
          skipCounter++;
        }
        if (skipTimes === 1 && servers[message.guild.id].queue.length > 0) {
          skipCounter++;
        }
        skipSong(message, message.member.voice.channel, false);
        if (skipCounter > 1) {
          message.channel.send('*skipped ' + skipCounter + ' times*');
        } else {
          message.channel.send('*skipped 1 time*');
        }
      } else {
        message.channel.send('*invalid skip amount (must be between 1 - 1000)*');
      }
    } catch (e) {
      skipSong(message, message.member.voice.channel, true);
    }
  } else {
    skipSong(message, message.member.voice.channel, true);
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
    'dn [key] \` Play immediately, overrides queue \n\`' +
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
    '\n--------------  **Other Commands**  -----------------\n\`' +
    prefixString +
    'silence \` Silence now playing embeds \n\`' +
    prefixString +
    'unsilence \` Re-enable now playing embeds \n\`' +
    prefixString +
    'verbose \` Keep all song embeds during a session\n\`' +
    prefixString +
    'lyrics \` Get lyrics of what\'s currently playing\n\`' +
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
 * @param message The discord message
 * @param args The args to verify content
 * @param mgid The message guild id
 * @param playNow Bool, whether to override the queue
 * @param indexToLookup Optional - The search index, requires searchResult to be valid
 * @param searchTerm Optional - The specific phrase to search
 * @param searchResult Optional - For recursive call with memoization
 * @returns {Promise<*|boolean|undefined>}
 */
async function runYoutubeSearch (message, args, mgid, playNow, indexToLookup, searchTerm, searchResult) {
  if (!searchTerm) {
    const tempArray = args.map(x => x);
    tempArray[0] = "";
    searchTerm = tempArray.join(' ').trim();
  }
  if (!searchResult) {
    indexToLookup = 0;
    searchResult = await ytsr(searchTerm, {pages: 1});
    if (!searchResult.items[0]) {
      if (!searchTerm.includes('video')) {
        return runYoutubeSearch(message, args, mgid, playNow, indexToLookup, searchTerm + ' video', undefined);
      }
      return message.channel.send('could not find video');
    }
  } else {
    indexToLookup = parseInt(indexToLookup);
    if (!indexToLookup) indexToLookup = 1;
    indexToLookup--;
  }
  const args2 = [];
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
    servers[message.guild.id].loop = false;
  }
  if (searchResult.items[indexToLookup].type === 'video') {
    args2[1] = searchResult.items[indexToLookup].url;
  } else {
    if (servers[mgid].queue[0] === args2[1]) servers[mgid].queueHistory.push(servers[mgid].queue.shift());
    return runYoutubeSearch(message, args, mgid, playNow, indexToLookup += 2, searchTerm, searchResult);
  }
  if (!args2[1]) return message.channel.send('could not find video');
  if (playNow) {
    servers[mgid].queue.unshift(args2[1]);
    await playSongToVC(message, args2[1], message.member.voice.channel, true);
  } else {
    servers[mgid].queue.push(args2[1]);
    if (servers[mgid].queue.length === 1) {
      await playSongToVC(message, args2[1], message.member.voice.channel, true);
    } else {
      message.channel.send('*added to queue*');
    }
  }
  if (indexToLookup < 4 && (playNow || servers[mgid].queue.length < 2)) {
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
      if (servers[mgid].queue[0] === args2[1]) servers[mgid].queueHistory.push(servers[mgid].queue.shift());
      runYoutubeSearch(message, args, mgid, true, indexToLookup += 2, searchTerm, searchResult);
    });
  }
}

/**
 * Runs the checks to add random songs to the queue
 * @param num The number of songs to be added to random, could be string
 * @param message The message that triggered the bot
 * @param sheetName The name of the sheet to reference
 */
function runRandomToQueue (num, message, sheetName) {
  if (!message.member.voice.channel) {
    return message.channel.send('must be in a voice channel to play random');
  }
  try {
    num = parseInt(num);
  } catch (e) {
    num = 1;
  }
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
    servers[message.guild.id].loop = false;
  }
  if (servers[message.guild.id].queue.length >= maxQueueSize) {
    return message.channel.send('*max queue size has been reached*');
  }
  gsrun('A', 'B', sheetName).then((xdb) => {
    if (!num) {
      addRandomToQueue(message, 1, xdb.congratsDatabase);
    } else {
      try {
        if (num && num >= maxQueueSize) {
          message.channel.send('*max limit for random is ' + maxQueueSize + '*');
          num = maxQueueSize;
        }
        addRandomToQueue(message, num, xdb.congratsDatabase);
      } catch (e) {
        addRandomToQueue(message, 1, xdb.congratsDatabase);
      }
    }
  });
}

/**
 * Adds a number of items from the database to the queue randomly.
 * @param message The message that triggered the bot
 * @param numOfTimes The number of items to add to the queue
 * @param {Map} cdb The database to reference
 */
function addRandomToQueue (message, numOfTimes, cdb) {
  const rKeyArray = Array.from(cdb.keys());
  if (rKeyArray.length < 1 || (rKeyArray.length === 1 && rKeyArray[0].length < 1)) {
    return message.channel.send('Your music list is empty.');
  }
  const serverQueueLength = servers[message.guild.id].queue.length;
  // mutate numberOfTimes to not exceed maxQueueSize
  if (numOfTimes + serverQueueLength > maxQueueSize) {
    numOfTimes = maxQueueSize - serverQueueLength;
    if (numOfTimes === 0) {
      return message.channel.send('*max queue size has been reached*');
    }
  }
  let rn;
  let queueWasEmpty = false;
  if (servers[message.guild.id].queue.length < 1) {
    queueWasEmpty = true;
  }
  // the final random array to be added to the queue
  const rKeyArrayFinal = [];
  try {
    const newArray = [];
    let executeWhileInRand = true;
    for (let i = 0; i < numOfTimes; i++) {
      if (!newArray || newArray.length < 1 || executeWhileInRand) {
        const tempArray = [...rKeyArray];
        let j = 0;
        while (
          (tempArray.length > 0 && j <= numOfTimes) ||
          executeWhileInRand
          ) {
          const randomNumber = Math.floor(Math.random() * tempArray.length);
          newArray.push(tempArray[randomNumber]);
          tempArray.splice(randomNumber, 1);
          j++;
          executeWhileInRand = false;
        }
        // newArray has the new values
      }
      const aTest1 = newArray.pop();
      if (aTest1) {
        rKeyArrayFinal.push(aTest1);
      } else {
        executeWhileInRand = true;
        i--;
      }
    }
    // rKeyArrayFinal should have list of randoms here
  } catch (e) {
    console.log('error in random: ' + e);
    rn = Math.floor(Math.random() * rKeyArray.length);
    rKeyArrayFinal.push(rKeyArray[rn]);
  }
  rKeyArrayFinal.forEach(e => {
    servers[message.guild.id].queue.push(cdb.get(e));
  });
  if (queueWasEmpty && servers[message.guild.id].queue.length > 0) {
    playSongToVC(message, servers[message.guild.id].queue[0], message.member.voice.channel, true);
  } else {
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
 * @param user optional user name, overrides the message owner's name
 */
async function runKeysCommand (message, prefixString, sheetname, cmdType, voiceChannel, user) {
  // if (
  //   !dataSize.get(sheetname.toString()) ||
  //   dataSize.get(sheetname.toString()) < 1
  // ) {
  //   await createSheet(message, sheetname);
  // }
  gsrun('A', 'B', sheetname).then((xdb) => {
    keyArray = Array.from(xdb.congratsDatabase.keys()).sort();
    s = '';
    let firstLetter = true;
    for (const key in keyArray) {
      if (firstLetter) {
        s = keyArray[key];
        firstLetter = false;
      } else {
        s = s + ', ' + keyArray[key];
      }
    }
    if (!s || s.length < 1) {
      let emptyDBMessage;
      if (!cmdType) {
        emptyDBMessage = "The server's ";
      } else {
        emptyDBMessage = 'Your ';
      }
      message.channel.send('**' + emptyDBMessage + 'music list is empty.**\n*Add a song by putting a word followed by a link.' +
        '\nEx:* \` ' + prefixString + cmdType + 'a [key] [link] \`');
    } else {
      let dbName = '';
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
      embedKeysMessage.setTitle(keysMessage).setDescription(s).setColor(keyEmbedColor)
        .setFooter("(use '" + prefixString + cmdType + "d [key]' to play)\n");
      message.channel.send(embedKeysMessage).then(async sentMsg => {
        sentMsg.react('❔').then(() => sentMsg.react('🔀'));
        const filter = (reaction, user) => {
          return ['🔀', '❔'].includes(reaction.emoji.name) && user.id !== bot.user.id;
        };
        const keysButtonCollector = sentMsg.createReactionCollector(filter, {
          time: 1200000
        });
        keysButtonCollector.on('collect', (reaction, reactionCollector) => {
          if (reaction.emoji.name === '❔') {
            let nameToSend;
            if (dbName === "server's keys") {
              nameToSend = 'the server';
            } else {
              nameToSend = 'your personal';
            }
            const embed = new MessageEmbed()
              .setTitle('How to add/remove keys from ' + nameToSend + ' list')
              .setDescription('add a song by putting a word followed by a link -> ' +
                prefixString + cmdType + 'a [key] [link]\n' +
                'remove a song by putting the name you want to remove -> ' +
                prefixString + cmdType + 'rm [key]');
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
                  runRandomToQueue(100, message, 'p' + reactionCollector.id);
                } else {
                  message.channel.send('*randomizing from the server keys...*');
                  runRandomToQueue(100, message, sheetname);
                }
                return;
              }
            }
            return message.channel.send('must be in a voice channel to shuffle play');
          }
        });
      });
    }
  });
}

bot.on('voiceStateUpdate', update => {
  if (isInactive) return;
  // if the bot is the one leaving
  const mgid = update.guild.id;
  if (update.member.id === bot.user.id && !update.connection && servers[mgid]) {
    servers[mgid].numSinceLastEmbed = 0;
    servers[mgid].currentEmbed = undefined;
    servers[mgid].silence = false;
    servers[mgid].verbose = false;
    if (embedMessageMap[update.guild.id] && embedMessageMap[mgid].reactions) {
      servers[mgid].collector.stop();
      embedMessageMap[mgid].reactions.removeAll().then();
      embedMessageMap[mgid] = false;
    }
    if (servers[mgid].followUpMessage) {
      servers[mgid].followUpMessage.delete();
      servers[mgid].followUpMessage = undefined;
    }
  } else {
    let leaveVCInt = 1100;
    if (!update.channel) return;
    if (dispatcherMap[update.channel.id]) {
      leaveVCInt = 420000;
    }
    clearInterval(leaveVCTimeout[update.channel.id]);
    leaveVCTimeout[update.channel.id] = setInterval(() => {
      if (update.channel.members.size < 2) {
        // console.log(update.channel.members.values());
        update.channel.leave();
      }
      clearInterval(leaveVCTimeout[update.channel.id]);
    }, leaveVCInt);
  }
});

bot.on('error', console.error);

/**
 *  The play function. Plays a given link to the voice channel.
 * @param {*} message the message that triggered the bot
 * @param {string} whatToPlay the link of the song to play
 * @param voiceChannel the voice channel to play the song in
 * @param sendEmbed whether to send an embed to the text channel
 */
async function playSongToVC (message, whatToPlay, voiceChannel, sendEmbed) {
  if (!voiceChannel || voiceChannel.members.size < 1 || !whatToPlay) {
    return;
  }
  if (isInactive) {
    message.channel.send('*db bot has been updated*');
    return runStopPlayingCommand(message.guild.id, voiceChannel);
  }
  const mgid = message.guild.id;
  // the url to play
  let url = whatToPlay;
  // the alternative spotify url
  let url2;
  let isSpotify = url.includes('spotify.com');
  let infos;
  let itemIndex = 0;
  if (isSpotify) {
    infos = await getData(url);
    let artists = '';
    infos.artists.forEach(x => artists += x.name + ' ');
    artists = artists.trim();
    let search = await ytsr(infos.name + ' ' + artists, {pages: 1});
    let youtubeDuration;
    if (search.items[0]) {
      const convertYTFormatToMS = (durationArray) => {
        if (durationArray) {
          youtubeDuration = 0;
          durationArray.reverse();
          if (durationArray[1]) youtubeDuration += durationArray[1] * 60000;
          if (durationArray[2]) youtubeDuration += durationArray[1] * 3600000;
          youtubeDuration += durationArray[0] * 1000;
        }
        return youtubeDuration;
      };
      youtubeDuration = convertYTFormatToMS(search.items[0].duration.split(':'));
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
    isSpotify = !search.items[itemIndex];
    if (!isSpotify) url2 = search.items[itemIndex].url;
  }
  if (!url2) url2 = url;
  // remove previous embed buttons
  if (servers[mgid].currentEmbed && (!servers[mgid].loop || whatspMap[voiceChannel.id] !== url) && servers[mgid].numSinceLastEmbed > 4) {
    servers[mgid].numSinceLastEmbed = 0;
    servers[mgid].currentEmbed.delete();
    servers[mgid].currentEmbed = undefined;
    embedMessageMap[mgid] = '';
  }
  whatspMap[voiceChannel.id] = url;
  voiceChannel.join().then(async connection => {
    try {
      let dispatcher;
      await connection.voice.setSelfDeaf(true);
      if (!isSpotify) {
        dispatcher = connection.play(await ytdl(url2, {}), {
          type: 'opus',
          filter: 'audioonly',
          quality: '140',
          volume: false
        });
      } else {
        dispatcher = connection
          .play(await spdl(url),
            {
              highWaterMark: 1 << 25,
              volume: false,
            });
      }
      dispatcher.pause();
      dispatcherMap[voiceChannel.id] = dispatcher;
      // if the server is not silenced then send the embed when playing
      if (!silenceMap[mgid] && sendEmbed) {
        await sendLinkAsEmbed(message, url, voiceChannel, infos).then(() => dispatcher.setVolume(0.5));
      }
      let playBufferTime = 310;
      if (isSpotify) playBufferTime = 2850;
      skipTimesMap[mgid] = 0;
      const tempInterval = setInterval(() => {
        clearInterval(tempInterval);
        dispatcherMapStatus[voiceChannel.id] = false;
        dispatcher.resume();
      }, playBufferTime);
      dispatcher.once('finish', () => {
        const songFinish = setInterval(() => {
          clearInterval(songFinish);
          if (url !== whatspMap[voiceChannel.id]) {
            console.log('There was a mismatch -------------------');
            console.log('old url: ' + url);
            console.log('current url: ' + whatspMap[voiceChannel.id]);
            bot.channels.cache.get('730837254796214384').send('there was a mismatch with playback');
            return;
          }
          const server = servers[mgid];
          if (servers[mgid].currentEmbed && servers[mgid].currentEmbed.reactions && !server.loop && server.queue.length < 2) {
            servers[mgid].currentEmbed.reactions.removeAll();
            servers[mgid].currentEmbed = undefined;
            embedMessageMap[mgid] = undefined;
          }
          if (voiceChannel.members.size < 2) {
            connection.disconnect();
          } else if (server.loop) {
            playSongToVC(message, url, voiceChannel, true);
          } else {
            server.queueHistory.push(server.queue.shift());
            if (server.queue.length > 0) {
              playSongToVC(message, server.queue[0], voiceChannel, true);
            } else {
              dispatcherMap[voiceChannel.id] = false;
            }
          }
        }, 700);
        if (servers[mgid].followUpMessage) {
          servers[mgid].followUpMessage.delete();
          servers[mgid].followUpMessage = undefined;
        }
      });
      dispatcher.once('error', console.error);
    } catch (e) {
      const numberOfPrevSkips = skipTimesMap[mgid];
      if (!numberOfPrevSkips) {
        skipTimesMap[mgid] = 1;
      } else if (numberOfPrevSkips > 3 || !message.guild.voice || message.guild.voice.connection) {
        connection.disconnect();
        return;
      } else {
        skipTimesMap[mgid] += 1;
      }
      // Error catching - fault with the link?
      message.channel.send('Could not play <' + url + '>');
      if (servers[mgid].queueHistory[0] && servers[mgid].queue[0] === url) {
        // remove the url from the queue and replace with first of queueHistory if there is one
        servers[mgid].queue[0] = servers[mgid].queueHistory[0];
        servers[mgid].queueHistory.pop();
      }
      whatspMap[voiceChannel.id] = '';
      // search the db to find possible broken keys
      searchForBrokenLinkWithinDB(message, url);
      runSkipCommand(message, 1);
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
 * @returns {*}
 */
function runRewindCommand (message, mgid, voiceChannel, numberOfTimes, ignoreSingleRewind) {
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
  if (!rewindTimes || rewindTimes < 1 || rewindTimes > 10000) return message.channel.send('invalid rewind amount');
  let rwIncrementor = 0;
  while (servers[mgid].queueHistory.length > 0 && rwIncrementor < rewindTimes) {
    if (servers[mgid].queue.length > (maxQueueSize + 99)) {
      playSongToVC(message, servers[mgid].queue[0], voiceChannel, true);
      return message.channel.send('*max queue size has been reached, cannot rewind further*');
    }
    // remove undefined links from queueHistory
    while (servers[mgid].queueHistory.length > 0 && !song) {
      song = servers[mgid].queueHistory.pop();
    }
    if (song) servers[mgid].queue.unshift(song);
    rwIncrementor++;
  }
  if (song) {
    if (ignoreSingleRewind) {} else if (rewindTimes === 1) {
      message.channel.send('*rewound*');
    } else {
      message.channel.send('*rewound ' + rwIncrementor + ' times*');
    }
    playSongToVC(message, song, voiceChannel, true);
  } else if (servers[mgid].queue[0]) {
    playSongToVC(message, servers[mgid].queue[0], voiceChannel, true);
    message.channel.send('*replaying first song*');
  } else {
    message.channel.send('cannot find previous song');
  }
  if (servers[message.guild.id].followUpMessage) {
    servers[message.guild.id].followUpMessage.delete();
    servers[message.guild.id].followUpMessage = undefined;
  }
}

/**
 * Sends an embed to the channel depending on the given link.
 * If not given a voice channel then playback buttons will not appear.
 * @param message the message to send the channel to
 * @param url the url to generate the embed for
 * @param voiceChannel the voice channel that the song is being played in
 * @param infos Optional - Spotify information if already generated
 * @param forceEmbed Optional - force the embed to be regenerated
 * @returns {Promise<void>}
 */
async function sendLinkAsEmbed (message, url, voiceChannel, infos, forceEmbed) {
  const mgid = message.guild.id;
  if (servers[mgid].verbose) forceEmbed = true;
  if (servers[mgid].loop && servers[mgid].currentEmbedLink === url && !forceEmbed && message.reactions) {
    return;
  }
  servers[mgid].currentEmbedChannelId = message.channel.id;
  servers[mgid].currentEmbedLink = url;
  let embed;
  let timeMS = 0;
  let showButtons = true;
  let isSpotify = false;
  if (url.toString().includes('spotify.com')) {
    isSpotify = true;
  }
  if (isSpotify) {
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
  if (servers[mgid].queue.length > 0) {
    embed.addField('Queue', ' 1 / ' + servers[mgid].queue.length, true);
  } else {
    embed.addField('-', 'Last played', true);
    showButtons = false;
  }
  const generateNewEmbed = async () => {
    if (servers[mgid].currentEmbed && !forceEmbed) {
      servers[mgid].numSinceLastEmbed = 0;
      servers[mgid].currentEmbed.delete();
      servers[mgid].currentEmbed = undefined;
      embedMessageMap[message.guild.id] = '';
    } else if (servers[mgid].currentEmbed && servers[mgid].currentEmbed.reactions) {
      servers[mgid].numSinceLastEmbed = 0;
      await servers[mgid].collector.stop();
      await servers[mgid].currentEmbed.reactions.removeAll();
      servers[mgid].currentEmbed = undefined;
      embedMessageMap[message.guild.id] = '';
    }
    message.channel.send(embed)
      .then((sentMsg) => {
        if (!showButtons || !dispatcherMap[voiceChannel.id]) return;
        servers[mgid].currentEmbed = sentMsg;
        servers[mgid].numSinceLastEmbed = 0;
        embedMessageMap[mgid] = sentMsg;
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

        const collector = sentMsg.createReactionCollector(filter, {
          time: timeMS
        });

        servers[mgid].collector = collector;
        collector.on('collect', (reaction, reactionCollector) => {
          if (!dispatcherMap[voiceChannel.id] || !voiceChannel) {
            return;
          }
          if (reaction.emoji.name === '⏩') {
            reaction.users.remove(reactionCollector.id);
            skipSong(message, voiceChannel, false, true);
            if (servers[mgid].followUpMessage) {
              servers[mgid].followUpMessage.delete();
              servers[mgid].followUpMessage = undefined;
            }
          } else if (reaction.emoji.name === '⏯' && !dispatcherMapStatus[voiceChannel.id]) {
            dispatcherMap[voiceChannel.id].pause();
            dispatcherMapStatus[voiceChannel.id] = true;
            const userNickname = sentMsg.guild.members.cache.get(reactionCollector.id).nickname;
            if (servers[mgid].followUpMessage) {
              servers[mgid].followUpMessage.edit('*paused by \`' + (userNickname ? userNickname : reactionCollector.username) +
                '\`*');
            } else {
              message.channel.send('*paused by \`' + (userNickname ? userNickname : reactionCollector.username) +
                '\`*').then(msg => {servers[mgid].followUpMessage = msg;});
            }
            reaction.users.remove(reactionCollector.id);
          } else if (reaction.emoji.name === '⏯' && dispatcherMapStatus[voiceChannel.id]) {
            dispatcherMap[voiceChannel.id].resume();
            dispatcherMapStatus[voiceChannel.id] = false;
            const userNickname = sentMsg.guild.members.cache.get(reactionCollector.id).nickname;
            if (servers[mgid].followUpMessage) {
              servers[mgid].followUpMessage.edit('*played by \`' + (userNickname ? userNickname : reactionCollector.username) +
                '\`*');
            } else {
              message.channel.send('*played by \`' + (userNickname ? userNickname : reactionCollector.username) +
                '\`*').then(msg => {servers[mgid].followUpMessage = msg;});
            }
            reaction.users.remove(reactionCollector.id);
          } else if (reaction.emoji.name === '⏪') {
            reaction.users.remove(reactionCollector.id);
            runRewindCommand(message, mgid, voiceChannel, undefined, true);
            if (servers[mgid].followUpMessage) {
              servers[mgid].followUpMessage.delete();
              servers[mgid].followUpMessage = undefined;
            }
          } else if (reaction.emoji.name === '⏹') {
            collector.stop();
            runStopPlayingCommand(mgid, voiceChannel);
            if (servers[mgid].followUpMessage) {
              servers[mgid].followUpMessage.delete();
              servers[mgid].followUpMessage = undefined;
            }
          } else if (reaction.emoji.name === '🔑') {
            runKeysCommand(message, prefixMap[mgid], mgid, '', voiceChannel, '');
            servers[mgid].numSinceLastEmbed += 5;
          } else if (reaction.emoji.name === '🔐') {
            servers[mgid].numSinceLastEmbed += 5;
            // console.log(reaction.users.valueOf().array().pop());
            runKeysCommand(message, prefixMap[mgid], 'p' + reactionCollector.id, 'm', voiceChannel, reactionCollector);
          }
        });
      });
  };
  if (url === whatspMap[voiceChannel.id]) {
    if (servers[mgid].numSinceLastEmbed < 5 && !forceEmbed && servers[mgid].currentEmbed) {
      try {
        servers[mgid].currentEmbed.edit(embed);
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
 */
function runStopPlayingCommand (mgid, voiceChannel, stayInVC) {
  if (!voiceChannel) return;
  if (embedMessageMap[mgid] && embedMessageMap[mgid].reactions) {
    servers[mgid].collector.stop();
    embedMessageMap[mgid].reactions.removeAll().then();
    embedMessageMap[mgid] = '';
  }
  try {
    dispatcherMap[voiceChannel.id].pause();
  } catch (e) {}
  servers[mgid].numSinceLastEmbed = 10;
  if (servers[mgid].followUpMessage) {
    servers[mgid].followUpMessage.delete();
    servers[mgid].followUpMessage = undefined;
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
 * @param {*} args the message split into an array, delim by spaces
 * @param {*} message the message that activated the bot
 * @param {*} mgid The guild id
 * @param {*} sheetname The name of the sheet reference
 */
async function runWhatsPCommand (args, message, mgid, sheetname) {
  // in case of force disconnect
  if (!message.guild.voice || !message.guild.voice.channel) {
    servers[message.guild.id].queue = [];
    servers[message.guild.id].queueHistory = [];
    servers[message.guild.id].loop = false;
  }
  if (args[1]) {
    gsrun('A', 'B', sheetname).then((xdb) => {
      let dbType = "the server's";
      if (args[0].substr(1, 1).toLowerCase() === 'm') {
        dbType = 'your';
      }
      if (xdb.referenceDatabase.get(args[1].toUpperCase())) {
        message.channel.send(xdb.referenceDatabase.get(args[1].toUpperCase()));
      } else if (whatspMap[message.member.voice.channel.id]) {
        message.channel.send("Could not find '" + args[1] + "' in " + dbType + ' database.\nCurrently playing: ' +
          whatspMap[message.member.voice.channel.id]
        );
      } else {
        message.channel.send("Could not find '" + args[1] + "' in " + dbType + ' database.' +
          (whatspMap[message.member.voice.channel.id] ? ('\n' + whatspMap[message.member.voice.channel.id]) : ''));
      }
    });
  } else {
    if (!message.member.voice.channel) {
      return message.channel.send('must be in a voice channel');
    }
    if (whatspMap[message.member.voice.channel.id]) {
      return await sendLinkAsEmbed(message, whatspMap[message.member.voice.channel.id], message.member.voice.channel, undefined, true);
    } else {
      return message.channel.send('Nothing is playing right now');
    }
  }
}

// What's playing, uses voice channel id
const whatspMap = new Map();
// The server's prefix, uses guild id
const prefixMap = new Map();
// Whether silence mode is on (true, false), uses guild id
const silenceMap = new Map();
// The song stream, uses voice channel id
const dispatcherMap = new Map();
// The messages containing embeds, uses guild id
const embedMessageMap = new Map();
// The status of a dispatcher, either true for paused or false for playing
const dispatcherMapStatus = new Map();
// the timers for the bot to leave a VC, uses channel
const leaveVCTimeout = new Map();
// login to discord
bot.login(token);
