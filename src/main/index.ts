'use strict';
import { commandHandler } from './handler/CommandHandler';

require('dotenv').config();
import { congratsCommand } from './commands/congrats';
import {
  ActivityType,
  BaseGuildTextChannel,
  Channel,
  Guild,
  GuildMember,
  Message,
  MessageReaction,
  Snowflake,
  TextChannel,
  User,
  VoiceChannel,
  VoiceState
} from 'discord.js';
import buildNo from './utils/lib/BuildNumber';
import { deleteRows, gsrun } from './database/api/api';
import {
  botInVC,
  botInVcGuild,
  createMemoryEmbed,
  createQueueItem,
  createVisualEmbed,
  endStream,
  getSheetName,
  getTitle,
  isShortCommand
} from './utils/utils';
import { formatDuration } from './utils/formatUtils';
import { clearDJTimer, runDictatorCommand, runDJCommand, runResignCommand } from './commands/dj';
import {
  bot,
  botID,
  checkActiveMS,
  commandsMap,
  CORE_ADM,
  INVITE_MSG,
  PREFIX_SN,
  setOfBotsOn,
  startupTest,
  StreamType,
  TWITCH_BASE_LINK,
  whatspMap
} from './utils/lib/constants';
import reactions from './utils/lib/reactions';
import { sessionEndEmbed, updateActiveEmbed } from './utils/embed';
import {
  checkStatusOfYtdl,
  playLinkToVC,
  runRewindCommand,
  runSkipCommand,
  sendLinkAsEmbed
} from './commands/stream/stream';
import { shutdown } from './process/shutdown';
import { playRecommendation, sendRecommendationWrapper } from './commands/stream/recommendations';
import { checkToSeeActive } from './process/checkToSeeActive';
import { createVisualText, runQueueCommand } from './commands/generateQueue';
import { getServerPrefix, getXdb2, sendListSize } from './database/retrieval';
import { hasDJPermissions, isAdmin } from './utils/permissions';
import { dmHandler, sendMessageToUser } from './utils/dms';
import { runDeleteKeyCommand_P } from './database/delete';
import { parentThread } from './threads/parentThread';
import { getVoiceConnection } from '@discordjs/voice';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import fs from 'fs';
import LocalServer from './utils/lib/LocalServer';
import processStats from './utils/lib/ProcessStats';
import commandHandlerCommon from './commands/CommandHandlerCommon';
import axios from 'axios';
import config from '../../config.json';
import { MessageEventLocal } from './utils/lib/types';

const token =
  process.env.V13_DISCORD_TOKEN?.replace(/\\n/gm, '\n') ||
  (() => {
    throw new Error('missing params within .env file');
  })();
const hardwareTag = process.env.PERSONAL_HARDWARE_TAG?.replace(/\\n/gm, '\n').substring(0, 25) || 'unnamed';
const { exec } = require('child_process');
const version = require('../../package.json').version;
process.setMaxListeners(0);

/**
 * The execution for all bot commands within a server.
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
async function runCommandCases(message: Message) {
  const mgid = message.guild!.id;
  // the server guild playback data
  const server = processStats.getServer(mgid);
  if (processStats.devMode && !server.prefix) {
    // devmode prefix
    server.prefix = config.devPrefix;
  }
  if (server.currentEmbedChannelId === message.channel.id && server.numSinceLastEmbed < 10) {
    server.numSinceLastEmbed += 2;
  }
  // the server prefix
  const prefixString = server.prefix || (await getServerPrefix(server, mgid));
  const fwPrefix = message.content[0];
  // for all non-commands
  if (fwPrefix !== prefixString) {
    if (fwPrefix !== '.') return;
    if (processStats.devMode) return;
    const firstWordBegin = message.content.substring(0, 10).trim() + ' ';
    if (firstWordBegin === '.db-vibe ') {
      message.channel.send('Current prefix is: ' + prefixString);
    }
    return;
  }
  const args = message.content.replace(/\s+/g, ' ').split(' ');
  // the command name
  const statement = args[0].substring(1).toLowerCase();
  if (isAdmin(message.member!.id)) {
    runDevCommands(message, statement, server, args, prefixString).catch((err) => processStats.logError(err));
  } else {
    runUserCommands(message, statement, server, args, prefixString).catch((err) => processStats.logError(err));
  }
}

/**
 * All user commands.
 * @param message {import('discord.js').Message} The message.
 * @param statement {string} The command to process.
 * @param server {LocalServer} The server object.
 * @param args {Array<string>} The arguments provided with the command.
 * @param prefixString {string} The prefix used by the server.
 * @returns {Promise<undefined>}
 */
async function runUserCommands(
  message: Message,
  statement: string,
  server: LocalServer,
  args: Array<string>,
  prefixString: string
) {
  commandsMap.set(statement, (commandsMap.get(statement) || 0) + 1);
  const cmd = await commandHandler.getCommand(statement, message.author.id);
  if (cmd) {
    const event: MessageEventLocal = {
      statement,
      message,
      args: args.slice(1),
      prefix: prefixString,
      data: new Map(),
      server: server,
      mgid: message.guild!.id
    };
    await cmd.run(event);
    return;
  }
  const mgid = message.guild!.id;
  switch (statement) {
    // the personal play now command
    case 'mplaynow':
    case 'mpnow':
    case 'mpn':
      commandHandlerCommon.playLinkNow(message, args, mgid, server, getSheetName(message.author.id)).then();
      break;
    case 'smartplay':
    case 'autoplay':
    case 'auto':
    case 'sp':
    case 'ap':
      if (!botInVC(message)) {
        // avoid sending a message for smaller command names
        if (args[0].length > 4) message.channel.send('must be playing something to use smartplay');
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
      commandHandlerCommon.lyrics(message.channel.id, message.member!.id, args, server.queue[0]);
      break;
    case 'know':
    case 'kn':
    case 'dnow':
    case 'dn':
      if (isShortCommandNoArgs(args, message.guild!, statement)) return;
      commandHandlerCommon.playLinkNow(message, args, mgid, server, getSheetName(message.member!.id)).then();
      break;
    case 'pd':
      if (isShortCommandNoArgs(args, message.guild!, statement)) return;
      commandHandlerCommon
        .playDBPlaylist(args.splice(1), message, getSheetName(message.member!.id), false, true, server)
        .then();
      break;
    case 'ps':
    case 'pshuffle':
      if (isShortCommandNoArgs(args, message.guild!, statement)) return;
      commandHandlerCommon
        .playDBPlaylist(args.splice(1), message, getSheetName(message.member!.id), false, true, server, true)
        .then();
      break;
    // .md is retrieves and plays from the keys list
    case 'md':
    case 'd':
      if (isShortCommandNoArgs(args, message.guild!, statement)) return;
      commandHandlerCommon.playDBKeys(args, message, getSheetName(message.member!.id), false, true, server).then();
      break;
    // .mdnow retrieves and plays from the keys list immediately
    case 'mkn':
    case 'mknow':
    case 'mdnow':
    case 'mdn':
      commandHandlerCommon.playLinkNow(message, args, mgid, server, getSheetName(message.member!.id)).then();
      break;
    case 'rn':
    case 'randnow':
    case 'randomnow':
      commandHandlerCommon
        .addRandomKeysToQueue([args[1] || '1'], message, getSheetName(message.member!.id), server, true)
        .then();
      break;
    case 'sync':
      // assume that there is something playing
      if (botInVC(message)) {
        if (server.audio.isVoiceChannelMember(message.member!)) {
          const MIN_SYNC_SECONDS = 7;
          const MAX_SYNC_SECONDS = 60;
          let seconds = MIN_SYNC_SECONDS;
          if (args[1]) {
            seconds = parseInt(args[1]);
            if (!seconds || seconds < MIN_SYNC_SECONDS) seconds = MIN_SYNC_SECONDS;
            else if (seconds > MAX_SYNC_SECONDS) seconds = MAX_SYNC_SECONDS;
          }
          const playArgs = [message, message.member, server, true, false, true];
          commandHandlerCommon.pauseStream(...(playArgs as [any, any, any, any, any, any]));
          const streamTime = server.audio.resource?.playbackDuration;
          if (!streamTime) return message.channel.send('*could not find a valid stream time*');
          // the seconds shown to the user (added 1 to get user ahead of actual stream)
          const streamTimeSeconds = ((streamTime / 1000) % 60) + 1;
          // the formatted duration (with seconds supposed to be replaced)
          const duration = formatDuration(streamTime);
          const vals = duration.split(' ');
          // if the stream is close to next second (7 represents the tenth's place)
          const isClose = +streamTimeSeconds.toString().split('.')[1][0] > 7;
          if (!vals.slice(-1)[0].includes('s')) vals.push(`${Math.floor(streamTimeSeconds)}s`);
          else vals[vals.length - 1] = `${Math.floor(streamTimeSeconds)}s`;
          const syncMsg = await message.channel.send(
            `timestamp is **${vals.join(' ')}**` + `\naudio will resume when I say 'now' (~${seconds} seconds)`
          );
          // convert seconds to ms and add another second
          const syncTimeMS = seconds * 1000 + 1000;
          setTimeout(async () => {
            if (!server.audio.status) {
              const newMsgStr = `timestamp is **${vals.join(' ')}**` + '\n***---now---***';
              if (isClose) await syncMsg.edit(newMsgStr);
              else syncMsg.edit(newMsgStr);
              commandHandlerCommon.resumeStream(...(playArgs as [any, any, any, any, any, any]));
              setTimeout(() => {
                if (syncMsg.deletable) syncMsg.delete();
              }, 5000);
            }
          }, syncTimeMS);
        } else {
          message.channel.send('no active link is playing');
        }
      }
      break;
    case 'mshuffle':
    case 'random':
    case 'rand':
    case 'r':
    case 'mr':
      if (isShortCommandNoArgs(args, message.guild!, statement)) return;
      commandHandlerCommon
        .addRandomKeysToQueue(args.slice(1), message, getSheetName(message.member!.id), server, false)
        .then();
      break;
    case 'shufflenow':
    case 'shufflen':
    case 'mrn':
      commandHandlerCommon
        .addRandomKeysToQueue(args.slice(1), message, getSheetName(message.member!.id), server, true)
        .then();
      break;
    case 'rename':
      if (botInVC(message))
        message.channel.send('try `rename-key` or `rename-playlist` with the old name followed by the new name');
      break;
    case 'rename-key':
    case 'rename-keys':
    case 'renamekey':
    case 'renamekeys':
      if (!args[1] || !args[2]) {
        message.channel.send(`*expected a key-name and new key-name (i.e. ${args[0]} [A] [B])*`);
        return;
      }
      commandHandlerCommon
        .renameKey(<TextChannel>message.channel, server, getSheetName(message.member!.id), args[1], args[2])
        .then();
      break;
    case 'rename-playlist':
    case 'rename-playlists':
    case 'renameplaylist':
      if (!args[1] || !args[2]) {
        message.channel.send(`*expected a playlist-name and new playlist-name (i.e. ${args[0]} [A] [B])*`);
        return;
      }
      commandHandlerCommon
        .renamePlaylist(<TextChannel>message.channel, server, getSheetName(message.member!.id), args[1], args[2])
        .then();
      break;
    // .keys is personal keys
    case 'key':
    case 'keys':
    case 'playlist':
    case 'playlists':
      commandHandlerCommon
        .keys(message, server, getSheetName(message.member!.id), null, args[1], message.member!.nickname ?? undefined)
        .then();
      break;
    case 'splash':
      commandHandlerCommon
        .setSplashscreen(server, <TextChannel>message.channel, getSheetName(message.member!.id), args[1])
        .then();
      break;
    // .search is the search
    case 'find':
    case 'lookup':
    case 'search':
      if (!args[1]) {
        const lookupItem = server.queue[0];
        if (lookupItem.source) {
          message.channel.send('from playlist: <' + lookupItem.source + '>');
          return;
        }
      }
      commandHandlerCommon
        .searchForKeyUniversal(
          message,
          server,
          getSheetName(message.member!.id),
          args[1] ? args[1] : server.queue[0]?.url
        )
        .then();
      break;
    case 'size':
      if (args[1]) sendListSize(message, server, getSheetName(message.member!.id), args[1]).then();
      break;
    case 'ticket':
      if (args[1]) {
        args[0] = '';
        dmHandler(message, args.join(''));
        message.channel.send('Your message has been sent');
      } else {
        return message.channel.send('*input a message after the command to submit a request/issue*');
      }
      break;
    // !? is the command for what's playing?
    case 'current':
    case '?':
    case 'np':
    case 'nowplaying':
    case 'playing':
    case 'now':
      await commandHandlerCommon.nowPlaying(
        server,
        message,
        message.member!.voice?.channel,
        args[1],
        getSheetName(message.member!.id),
        ''
      );
      break;
    case 'm?':
    case 'mnow':
      await commandHandlerCommon.nowPlaying(
        server,
        message,
        message.member!.voice?.channel,
        args[1],
        getSheetName(message.member!.id),
        'm'
      );
      break;
    case 'url':
    case 'link':
      if (!args[1]) {
        if (server.queue[0] && message.member!.voice.channel) {
          return message.channel.send(server.queue[0].url);
        } else {
          return message.channel.send("*add a key to get it's " + statement + ' `(i.e. ' + statement + ' [key])`*');
        }
      }
      await commandHandlerCommon.nowPlaying(
        server,
        message,
        message.member!.voice?.channel,
        args[1],
        getSheetName(message.member!.id),
        'm'
      );
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
      playRecommendation(message, server, args).catch((er: Error) => processStats.logError(er));
      break;
    case 'rec':
    case 'recc':
    case 'recommend':
      args[0] = '';
      sendRecommendationWrapper(message, args, bot.users, server).then();
      break;
    case 'rm':
    case 'remove':
      await commandHandlerCommon.removeFromQueue(message, server, args[1]);
      break;
    case 'move':
      commandHandlerCommon.moveItemInQueue(message.channel, server, args[1], args[2]);
      break;
    case 'input':
    case 'insert':
      commandHandlerCommon.insert(message, mgid, args.slice(1), server, getSheetName(message.member!.id)).then();
      break;
    case 'q':
      runQueueCommand(server, message, mgid, true);
      break;
    case 'list':
    case 'upnext':
    case 'queue':
      runQueueCommand(server, message, mgid, false);
      break;
    case 'queuesearch':
    case 'searchqueue':
    case 'queuefind':
      if (!args[1]) {
        message.channel.send('error: expected a term to search for within the queue');
        return;
      }
      if (!botInVC(message)) {
        message.channel.send('error: must be in a voice channel with db vibe');
        return;
      }
      commandHandlerCommon
        .queueFind(message, server, args.slice(1).join(' '))
        .catch((er: Error) => processStats.debug(er));
      break;
    case 'audit':
    case 'freq':
    case 'frequency':
      if (!botInVC(message)) return;
      const tempAuditArray = [];
      for (const [key, value] of server.mapFinishedLinks) {
        tempAuditArray.push({ url: key, title: await getTitle(value.queueItem), index: value.numOfPlays });
      }
      // sort by times played
      tempAuditArray.sort((a, b) => {
        return b.index - a.index;
      });
      createVisualEmbed(
        'Link Frequency',
        (await createVisualText(
          server,
          tempAuditArray,
          (index: number, title: string, url: string) => `${index} | [${title}](${url})\n`
        )) || 'no completed links'
      )
        .send(message.channel)
        .then();
      break;
    case 'purge':
      if (!args[1]) return message.channel.send('*input a term to purge from the queue*');
      commandHandlerCommon.purgeWordFromQueue(message, server, args.slice(1).join(' ').toLowerCase()).then();
      break;
    case 'prefix':
      message.channel.send("use the command `changeprefix` to change the bot's prefix");
      break;
    case 'changeprefix':
      commandHandlerCommon.changePrefix(message, server, prefixString, args[1]);
      break;
    // list commands for public commands
    case 'h':
    case 'help':
      if (isShortCommand(message.guild!, statement)) return;
      commandHandlerCommon.help(message, server, version);
      break;
    // !skip
    case 'next':
    case 'sk':
    case 'skip':
      runSkipCommand(message, message.member!.voice?.channel, server, args[1], true, false, message.member);
      break;
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
      if (isShortCommand(message.guild!, statement)) return;
      if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, server.voteAdmin)) {
        runSkipCommand(message, message.member!.voice?.channel, server, args[1], true, true, message.member);
      }
      break;
    case 'fr':
    case 'frw':
    case 'forcerw':
    case 'forcerewind':
      if (isShortCommand(message.guild!, statement)) return;
      if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, server.voteAdmin)) {
        runRewindCommand(message, mgid, message.member!.voice?.channel!, args[1], true, false, message.member, server);
      }
      break;
    case 'fp':
      if (isShortCommand(message.guild!, statement)) return;
      if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, server.voteAdmin)) {
        message.channel.send("use 'fpl' to force play and 'fpa' to force pause.");
      }
      break;
    case 'fpl':
    case 'forcepl':
    case 'forceplay':
      if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, server.voteAdmin)) {
        commandHandlerCommon.resumeStream(message, message.member!, server, false, true);
      }
      break;
    case 'fpa':
    case 'forcepa':
    case 'forcepause':
      if (hasDJPermissions(<TextChannel>message.channel, message.member!.id, true, server.voteAdmin)) {
        commandHandlerCommon.pauseStream(message, message.member!, server, false, true, false);
      }
      break;
    case 'lock-queue':
      if (server.voteAdmin.filter((x: any) => x.id === message.member!.id).length > 0) {
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
    // .add is personal add
    case 'add':
      commandHandlerCommon.addKeyToDB(
        message.channel,
        args.slice(1),
        getSheetName(message.member!.id),
        true,
        server,
        message.member
      );
      break;
    case 'playlist-add':
    case 'add-playlist':
      if (!args[1]) {
        message.channel.send(`*error: expected a playlist name to add (i.e. \`${args[0]} [playlist-name]\`)*`);
        return;
      }
      commandHandlerCommon.addCustomPlaylist(server, message.channel, getSheetName(message.member!.id), args[1]);
      break;
    case 'delete-playlist':
    case 'playlist-delete':
      commandHandlerCommon
        .removeDBPlaylist(
          server,
          getSheetName(message.member!.id),
          args[1],
          await getXdb2(server, getSheetName(message.member!.id), false),
          <TextChannel>message.channel
        )
        .then();
      break;
    // .del deletes database entries
    case 'del':
    case 'delete':
    case 'delete-key':
    case 'remove-key':
      if (!args[1]) return message.channel.send('*no args provided*');
      void runDeleteKeyCommand_P(message, args[1], getSheetName(message.member!.id), server);
      break;
    case 'move-key':
    case 'move-keys':
      if (!args[1]) return message.channel.send(`*no args provided (i.e. ${statement} [key] [playlist])*`);
      commandHandlerCommon.moveKeysBetweenPlaylists(
        server,
        <TextChannel>message.channel,
        getSheetName(message.member!.id),
        await getXdb2(server, getSheetName(message.member!.id), false),
        args.splice(1)
      );
      break;
    case 'soundcloud':
      message.channel.send(
        `*try the play command with a soundcloud link \` Ex: ${prefixString}play [SOUNDCLOUD_URL]\`*`
      );
      break;
    case 'twitch':
      if (!args[1]) return message.channel.send(`*no channel name provided \` Ex: ${prefixString}twitch [channel]\`*`);
      if (message.member!.voice?.channel) {
        args[1] = `https://www.${TWITCH_BASE_LINK}/${args[1]}`;
        server.queue.unshift(createQueueItem(args[1], StreamType.TWITCH, null));
        playLinkToVC(message, args[1], message.member!.voice.channel, server);
      } else {
        message.channel.send('*must be in a voice channel*');
      }
      break;
    case 'prev':
    case 'previous':
    case 'rw':
    case 'rewind':
      runRewindCommand(message, mgid, message.member!.voice?.channel!, args[1], false, false, message.member, server);
      break;
    case 'rp':
    case 'replay':
      commandHandlerCommon.restartPlaying(message, mgid, 'replay', server);
      break;
    case 'rs':
    case 'restart':
      commandHandlerCommon.restartPlaying(message, mgid, 'restart', server);
      break;
    case 'clearqueue':
    case 'clear':
      if (!message.member!.voice?.channel) {
        if (server.queue.length > 0) message.channel.send('must be in a voice channel to clear');
        return;
      }
      if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member)) {
        return message.channel.send('only the DJ can clear the queue');
      }
      if (server.dictator && server.dictator.id !== message.member!.id) {
        return message.channel.send('only the Dictator can clear the queue');
      }
      const currentQueueItem = botInVC(message) ? server.queue[0] : undefined;
      server.queue.length = 0;
      server.queueHistory.length = 0;
      if (currentQueueItem) {
        server.queue[0] = currentQueueItem;
        await sendLinkAsEmbed(message, currentQueueItem, message.member!.voice?.channel, server, false);
      }
      message.channel.send('The queue has been scrubbed clean');
      break;
    case 'invite':
      message.channel.send(INVITE_MSG);
      break;
    case 'hide':
    case 'silence':
      if (!message.member!.voice?.channel) {
        return message.channel.send('You must be in a voice channel to silence');
      }
      if (server.silence) {
        return message.channel.send("*song notifications already silenced, use 'unsilence' to unsilence.*");
      }
      server.silence = true;
      message.channel.send('*song notifications silenced for this session*');
      break;
    case 'unhide':
    case 'unsilence':
      if (!message.member!.voice?.channel) {
        return message.channel.send('You must be in a voice channel to unsilence');
      }
      if (!server.silence) {
        return message.channel.send('*song notifications already unsilenced*');
      }
      server.silence = false;
      message.channel.send('*song notifications enabled*');
      if (server.audio.isVoiceChannelMember(message.member!)) {
        sendLinkAsEmbed(message, server.queue[0], message.member!.voice?.channel, server, false).then();
      }
      break;
    case 'congratulate':
      // congratulate a friend
      if (!args[1]) return message.channel.send('*no friend provided*');
      const friend = message.mentions.users.first();
      if (!friend) return message.channel.send('*no friend provided*');
      const friendName = friend.username;
      const friendAvatar = friend.avatarURL()!;
      new EmbedBuilderLocal()
        .setTitle('Congrats!')
        .setDescription(`${friendName} has been congratulated!`)
        .setThumbnail(friendAvatar)
        .setColor('#00ff00')
        .setFooter({
          text: `By ${message.author.username}`,
          iconURL: message.author.avatarURL() || ''
        })
        .send(message.channel)
        .then();
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
      } else if (message.member?.voice?.channel) {
        try {
          let gmArray = Array.from(
            (<VoiceChannel>bot.channels.cache.get(message.member!.voice.channel.id.toString())).members
          );
          gmArray = gmArray.map((item: any) => item[1].nickname || item[1].user.username);
          if (gmArray.length < 1) {
            return message.channel.send('Need at least 1 person in a voice channel.');
          }
          const randomInt = Math.floor(Math.random() * gmArray.length) + 1;
          message.channel.send(`*chosen voice channel member: **${gmArray[randomInt - 1]}***`);
        } catch (e) {}
      } else {
        message.channel.send('need to be in a voice channel for this command');
      }
      break;
  }
}

/**
 * All developer commands, for testing purposes.
 * @param message {import('discord.js').Message} The message.
 * @param statement {string} The command to process.
 * @param server {LocalServer} The server object.
 * @param args {Array<string>} The arguments provided with the command.
 * @param prefixString {string} The prefix used by the server.
 * @returns {Promise<void>}
 */
async function runDevCommands(
  message: Message,
  statement: string,
  server: LocalServer,
  args: Array<string>,
  prefixString: string
) {
  const mgid = message.guild!.id;
  switch (statement) {
    case 'gztest':
      // =gztest
      // this method is for testing purposes only. (cmd: npm run dev-test)
      if (!processStats.devMode) return;
      runDevTest(<TextChannel>message.channel, ['']).catch((err) => processStats.debug(err));
      break;
    case 'devadd':
      message.channel.send(
        "Here's the dev docs:\n" +
          '<https://docs.google.com/spreadsheets/d/1jvH0Tjjcsp0bm2SPGT2xKg5I998jimtSRWdbGgQJdN0/edit#gid=1750635622>'
      );
      break;
    // dev commands for testing purposes
    case 'gzh':
      new EmbedBuilderLocal()
        .setTitle('Dev Commands')
        .setDescription(
          '**active bot commands**' +
            `\n ${prefixString} gzs - statistics for the active bot` +
            `\n ${prefixString} gzmem - see the process\'s memory usage` +
            `\n ${prefixString} gzc - view commands stats` +
            `\n ${prefixString} gznuke [num] [\'db\'?] - deletes [num] recent messages (or db only)` +
            `\n ${prefixString} gzr [userId] - queries a message from the bot to the user` +
            '\n\n**calibrate the active bot**' +
            `\n ${prefixString} gzq - quit/restarts the active bot` +
            `\n ${prefixString} gzupdate - updates the (active) pi instance of the bot` +
            `\n ${prefixString} gzm update - sends a message to active guilds that the bot will be updating` +
            `\n ${prefixString} gzsms [message] - set a default message for all users on VC join` +
            '\n\n**calibrate multiple/other bots**' +
            "\n=gzl - return all bot's ping and latency" +
            '\n=gzk - start/kill a process' +
            '\n=gzd [process #] - toggle dev mode' +
            '\n=gzb [process #] [+/-] - increase/decrease build number' +
            '\n=gzupdate - updates all (inactive) pi instances of the bot' +
            '\n\n**dev-testing commands**' +
            `\n ${prefixString} gzcpf - change prefix for testing (if in devmode)` +
            `\n ${prefixString} gzid - guild, bot, and member id` +
            `\n ${prefixString} devadd - access the database`
        )
        .setFooter({ text: `version: ${version}` })
        .send(message.channel)
        .then();
      break;
    // test purposes - play command
    case 'gplay':
    case 'gp':
      commandHandlerCommon.playLink(message, args, mgid, server, 'entries').then();
      break;
    // test purposes - play now command
    case 'gpnow':
    case 'gpn':
      commandHandlerCommon.playLinkNow(message, args, mgid, server, 'entries').then();
      break;
    // test purposes - run database links
    case 'gd':
      commandHandlerCommon.playDBKeys(args, message, 'entries', false, true, server).then();
      break;
    // test purposes - run database command
    case 'gdnow':
    case 'gdn':
      commandHandlerCommon.playDBKeys(args, message, 'entries', true, true, server).then();
      break;
    // test purposes - run database command
    case 'gkn':
    case 'gknow':
      commandHandlerCommon.playDBKeys(args, message, 'entries', true, true, server).then();
      break;
    // .ga adds to the test database
    case 'ga':
    case 'gadd':
      commandHandlerCommon.addKeyToDB(message.channel, args.slice(1), 'entries', true, server, message.member);
      break;
    case 'gadd-playlist':
    case 'gplaylist-add':
      if (!args[1]) {
        message.channel.send(`*error: expected a playlist name to add (i.e. \`${args[0]} [playlist-name]\`)*`);
        return;
      }
      commandHandlerCommon.addCustomPlaylist(server, message.channel, 'entries', args[1]);
      break;
    case 'gdelete-playlist':
    case 'gplaylist-delete':
      commandHandlerCommon
        .removeDBPlaylist(
          server,
          'entries',
          args[1],
          await getXdb2(server, 'entries', false),
          <TextChannel>message.channel
        )
        .then();
      break;
    // test remove database entries
    case 'gdel':
    case 'gdelete':
      runDeleteKeyCommand_P(message, args[1], 'entries', server);
      break;
    case 'gmove-key':
    case 'gmove-keys':
      if (!args[1]) return message.channel.send(`*no args provided (i.e. ${statement} [key] [playlist])*`);
      commandHandlerCommon.moveKeysBetweenPlaylists(
        server,
        <TextChannel>message.channel,
        'entries',
        await getXdb2(server, 'entries', false),
        args.splice(1)
      );
      break;
    case 'gnow':
    case 'g?':
      await commandHandlerCommon.nowPlaying(server, message, message.member!.voice?.channel, args[1], 'entries', 'g');
      break;
    case 'gzmem':
      (await createMemoryEmbed()).send(message.channel).then();
      break;
    case 'gznuke':
      parentThread('gzn', {}, [message.channel.id, parseInt(args[1]) || 1, args[2] === 'db']);
      break;
    case 'gzupdate':
      devUpdateCommand(message, args.slice(1));
      break;
    case 'gurl':
    case 'glink':
      if (!args[1]) {
        if (server.queue[0] && message.member!.voice.channel) {
          return message.channel.send(server.queue[0].url);
        } else {
          return message.channel.send(
            "*add a key to get it's " + statement.substr(1) + ' `(i.e. ' + statement + ' [key])`*'
          );
        }
      }
      await commandHandlerCommon.nowPlaying(server, message, message.member!.voice?.channel, args[1], 'entries', 'g');
      break;
    case 'gzdebug':
      if (server.queue[0]) {
        message.channel.send(`url: ${server.queue[0].url}\nurlAlt: ${server.queue[0].urlAlt}`);
      } else {
        message.channel.send('nothing is playing right now');
      }
      break;
    case 'gzc':
      let commandsMapString = '';
      const commandsMapArray: any[] = [];
      let CMAInt = 0;
      commandsMap.forEach((value: number, key: string) => {
        commandsMapArray[CMAInt++] = [key, value];
      });
      commandsMapArray.sort((a, b) => b[1] - a[1]);
      if (commandsMapArray.length < 1) {
        commandsMapString = '*empty*';
      } else {
        commandsMapArray.forEach((val) => {
          commandsMapString += val[1] + ' - ' + val[0] + '\n';
        });
      }
      new EmbedBuilderLocal()
        .setTitle('Commands Usage - Stats')
        .setDescription(commandsMapString)
        .send(message.channel)
        .then();
      break;
    case 'gzcpf':
      if (processStats.devMode) {
        if (args[1]) {
          server.prefix = args[1];
          message.channel.send('*prefix has been changed*');
        } else {
          message.channel.send('*must provide prefix argument*');
        }
      } else {
        message.channel.send('*can only be performed in devmode*');
      }
      break;
    case 'gzq':
      if (bot.voice.adapters.size > 0 && args[1] !== 'force') {
        message.channel.send("People are using the bot. Use this command again with 'force' to restart the bot");
      } else {
        message.channel.send('restarting the bot... (may only shutdown)').then(() => {
          shutdown('USER')();
        });
      }
      break;
    case 'gzid':
      message.channel.send(`g: ${message.guild!.id}, b: ${bot.user!.id}, m: ${message.member!.id}`);
      break;
    case 'gzsms':
      if (args[1]) {
        if (args[1] === 'clear') {
          processStats.startUpMessage = '';
          return message.channel.send('start up message is cleared');
        }
        processStats.startUpMessage = message.content.substring(message.content.indexOf(args[1]));
        processStats.servers.forEach((x: LocalServer) => {
          x.startUpMessage = '';
        });
        message.channel.send('*new startup message is set*');
      } else if (processStats.startUpMessage) {
        const gzsmsClearMsg = '*type **gzsm clear** to clear the startup message*';
        message.channel.send(`***current start up message:***\n${processStats.startUpMessage}\n${gzsmsClearMsg}`);
      } else {
        message.channel.send('*there is no startup message right now*');
      }
      break;
    case 'gzs':
      new EmbedBuilderLocal()
        .setTitle('db vibe - statistics')
        .setDescription(
          `version: ${version} (${buildNo.getBuildNo()})` +
            `\nprocess: ${process.pid.toString()} [${hardwareTag}]` +
            `\nservers: ${bot.guilds.cache.size}` +
            `\nuptime: ${formatDuration(bot.uptime!)}` +
            `\nactive time: ${processStats.getTimeActive()}` +
            `\nstream time: ${formatDuration(processStats.getTotalStreamTime())}` +
            `\nup since: ${bot.readyAt!.toString().substring(0, 21)}` +
            `\nnumber of streams: ${processStats.getActiveStreamSize()}` +
            `\nactive voice channels: ${bot.voice.adapters.size}`
        )
        .send(message.channel)
        .then();
      break;
    case 'gztemp':
      getTemperature().then((response) => {
        if (response.isError) message.channel.send(`returned error: \`${response.value}\``);
        else message.channel.send(`\`${response.value || 'error: no response value provided'}\``);
      });
      break;
    case 'gzr':
      if (!args[1] || !parseInt(args[1])) return;
      sendMessageToUser(message, args[1], undefined);
      break;
    case 'gzm':
      if (!args[1]) {
        message.channel.send(
          'active process #' + process.pid.toString() + ' is in ' + bot.voice.adapters.size + ' servers.'
        );
        break;
      } else if (args[1] === 'update') {
        if (args[2] === 'force') {
          const updateMsg = '`NOTICE: db vibe is about to be updated. Expect a brief interruption within 5 minutes.`';
          bot.voice.adapters.forEach((x: any, gId: string) => {
            try {
              const guildToUpdate = (<VoiceChannel | undefined>(
                bot.channels.cache.get(getVoiceConnection(gId)?.joinConfig.channelId!)
              ))?.guild;
              const currentEmbedChannelId = guildToUpdate
                ? processStats.getServer(guildToUpdate.id).currentEmbedChannelId
                : null;
              const currentTextChannel = currentEmbedChannelId ? bot.channels.cache.get(currentEmbedChannelId) : null;
              if (currentTextChannel) {
                (<TextChannel>bot.channels.cache.get(currentEmbedChannelId!))?.send(updateMsg);
              } else {
                (<VoiceChannel | undefined>(
                  bot.channels.cache.get(getVoiceConnection(gId)?.joinConfig.channelId!)
                ))?.guild.systemChannel?.send(updateMsg);
              }
            } catch (e) {}
          });
          message.channel.send('*update message sent to ' + bot.voice.adapters.size + ' channels*');
        } else {
          message.channel.send(
            'The active bot is not running on Heroku so a git push would not interrupt listening.\n' +
              'To still send out an update use `gzm update force`'
          );
        }
      } else if (args[1] === 'listu') {
        let gx = '';
        bot.voice.adapters.forEach((x: any, g: any) => {
          try {
            // guild member array
            const gmArray: Array<[Snowflake, GuildMember]> = Array.from(
              (<VoiceChannel>bot.channels.cache.get(getVoiceConnection(g)!.joinConfig.channelId!)).members
            );
            gx += `${gmArray[0][1].guild.name}: *`;
            gmArray.map((item) => item[1].user.username).forEach((y) => (gx += `${y}, `));
            gx = `${gx.substring(0, gx.length - 2)}*\n`;
          } catch (e) {}
        });
        if (gx) message.channel.send(gx);
        else message.channel.send('none found');
      }
      break;
    // test purposes - random command
    case 'grand':
    case 'gr':
      commandHandlerCommon.addRandomKeysToQueue([args[1] || '1'], message, 'entries', server, false).then();
      break;
    case 'gshuffle':
      commandHandlerCommon.addRandomKeysToQueue(args.slice(1), message, 'entries', server, false).then();
      break;
    // test purposes - return keys
    case 'gk':
    case 'gkey':
    case 'gkeys':
      commandHandlerCommon.keys(message, server, 'entries', null, args[1]).then();
      break;
    case 'gsplash':
      commandHandlerCommon.setSplashscreen(server, <TextChannel>message.channel, 'entries', args[1]).then();
      break;
    case 'gfind':
    case 'glookup':
    case 'gsearch':
      commandHandlerCommon
        .searchForKeyUniversal(message, server, 'entries', args[1] ? args[1] : server.queue[0]?.url)
        .then();
      break;
    case 'gsize':
      if (args[1]) sendListSize(message, server, 'entries', args[1]).then();
      break;
    default:
      runUserCommands(message, statement, server, args, prefixString).catch((err) => processStats.logError(err));
      break;
  }
}

/**
 * Returns false if the command is short (less than 3 characters), there is no active session, and no cmd arguments.
 * @param args {Array<string>} The arguments.
 * @param guild {import('discord.js').Guild} The message.
 * @param statement {string} The command to check.
 * @returns {boolean} False if the cmd is short with no active session and cmd args.
 */
function isShortCommandNoArgs(args: Array<string>, guild: Guild, statement: string) {
  return !args[1] && isShortCommand(guild, statement);
}

/**
 * Sets the process as inactive, enables the 'checkActiveInterval' to ensure that a process is active.
 */
function setProcessInactiveAndMonitor() {
  processStats.setProcessInactive();
  if (!processStats.checkActiveInterval) {
    processStats.checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS);
  }
}

bot.on('guildDelete', (guild: Guild) => {
  if (processStats.isInactive || processStats.devMode) return;
  gsrun('A', 'B', PREFIX_SN).then(async (xdb: any) => {
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

bot.on('guildCreate', (guild: Guild) => {
  if (processStats.isInactive || processStats.devMode) return;
  guild.systemChannel?.send("Type '.help' to see my commands.").then();
});

bot.once('ready', () => {
  parentThread('STARTUP', {}, []);
  // bot starts up as inactive, if no response from the channel then activates itself
  // noinspection JSUnresolvedFunction
  processStats.getServer(config['check-in-guild']);
  if (processStats.devMode) {
    processStats.setProcessActive();
    if (startupTest) {
      const index = process.argv.indexOf('--test');
      if (index === process.argv.length - 1) {
        console.log('could not run test, please provide channel id');
      } else {
        bot.channels.fetch(process.argv[index + 1]).then((channel: Channel | null) => {
          if (channel && channel['lastMessageId' as keyof Channel]) {
            (<TextChannel>channel).send('=gztest').then();
          } else {
            console.log('not a text channel');
          }
        });
      }
    }
  } else {
    checkStatusOfYtdl(processStats.getServer(config['check-in-guild'])).then();
    setProcessInactiveAndMonitor();
    bot.user!.setActivity('beats | .db-vibe', { type: ActivityType.Playing });
    console.log('-starting up sidelined-');
    console.log('checking status of other bots...');
    // bot logs - startup (NOTICE: "starting:" is reserved)
    (async () =>
      (<TextChannel>await bot.channels.fetch(config.process))
        .send(`starting: ${process.pid} [${buildNo.getBuildNo()}]`)
        .then(() => {
          checkToSeeActive();
        }))();
  }
  console.log('-ready-');
});

function processHandler(message: Message) {
  // ON: (ex: ~db-process-on012345678verzzz)
  // ~db-process (standard)[11] | -on [14] | 1 or 0 (vc size)[15] | 12345678 (build no)[23] | ver [26] | (process) [n]
  // OFF: (~db-process-off12345678-zzz)
  // ~db-process (standard)[11] | -off [15] | 12345678 (build no)[23] | - [24] | (process) [n]
  if (message.content.substring(0, 11) === '~db-process') {
    // if seeing bots that are on
    if (message.content.substring(11, 14) === '-on') {
      const oBuildNo = message.content.substring(15, 23);
      // compare versions || check if actively being used (if so: keep on)
      if (parseInt(oBuildNo) >= parseInt(buildNo.getBuildNo()) || message.content.substring(14, 15) !== '0') {
        setOfBotsOn.add(message.content.substring(26));
        // update this process if out-of-date or reset process interval if an up-to-date process has queried
        if (processStats.isInactive) {
          // 2hrs of uptime is required to update process
          if (
            bot.uptime! > 7200000 &&
            parseInt(oBuildNo.substring(0, 6)) > parseInt(buildNo.getBuildNo().substring(0, 6))
          ) {
            devUpdateCommand();
          } else if (parseInt(oBuildNo.substring(0, 6)) >= parseInt(buildNo.getBuildNo().substring(0, 6))) {
            clearInterval(processStats.checkActiveInterval);
            // offset for process timer is 3.5 seconds - 5.9 minutes
            const offset = Math.floor(((Math.random() * 100 + 1) / 17) * 60000);
            // reset the =gzk interval since query was already made by another process
            processStats.checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS + offset);
          }
        }
      }
    } else if (message.content.substring(11, 15) === '-off') {
      // compare process IDs
      if (message.content.substring(24) !== process.pid.toString()) {
        if (bot.voice!.adapters.size > 1) {
          processStats.logError('[WARN] sidelined instance is in 1 or more voice channels');
        }
        processStats.isPendingStatus = false;
        setProcessInactiveAndMonitor();
      }
    } else {
      throw new Error('invalid db-process command');
    }
  } else if (processStats.isInactive && message.content.substring(0, 9) === 'starting:') {
    // view the build number of the starting process, if newer version then update
    if (bot.uptime! > 7200000) {
      const regExp = /\[(\d+)/;
      const regResult = regExp.exec(message.content);
      const oBuildNo = regResult ? regResult[1] : null;
      if (oBuildNo && parseInt(oBuildNo.substring(0, 6)) > parseInt(buildNo.getBuildNo().substring(0, 6))) {
        devUpdateCommand();
      }
    }
  }
}

/**
 * Manages a custom or PM2 update command. Does not work with the heroku process.
 * Provided arguments must start with a keyword. If the first argument is 'custom' then processes a custom command.
 * If it is 'all' then restarts both PM2 processes. Providing an invalid first argument would void the update.
 * An empty argument array represents a standard update.
 * @param message {Message} Optional - The message that triggered the bot.
 * @param args {Array<string>?} Optional - arguments for the command.
 */
function devUpdateCommand(message?: Message, args: Array<string> = []) {
  let response = 'updating process...';
  if (args[0]?.toLowerCase() === 'force') {
    if (bot.voice.adapters.size > 0) {
      message?.channel.send(
        '***people are using the bot:*** *to force an update type `force` immediately after the command*'
      );
      return;
    }
    args.splice(0, 1);
  }
  if (!args[0]) {
    args[0] = 'default';
  } else {
    response += ` (${args[0]})`;
  }
  switch (args[0]) {
    case 'default':
      processStats.setProcessInactive();
      exec('git stash && git pull');
      setTimeout(() => {
        exec('npm run pm2');
      }, 5000);
      break;
    case 'update':
    case 'upgrade':
      processStats.setProcessInactive();
      exec(`git stash && git pull && npm ${args[0]}`);
      setTimeout(() => {
        exec('npm run pm2');
      }, 5000);
      break;
    case 'all':
      processStats.setProcessInactive();
      exec('pm2 update pm2');
      break;
    case 'custom':
      if (args[1]) {
        exec(args.slice(1).join(' '));
      } else {
        response = "*must provide script after 'custom'*";
      }
      break;
    default:
      response = '*incorrect argument provided*';
  }
  message?.channel.send(response);
  console.log(response);
}

/**
 * Interpret developer process-related commands. Used for maintenance of multiple db vibe instances.
 * The first three letters of the message are assumed to be the developer prefix and are therefore ignored.
 * @param message The message metadata.
 */
async function devProcessCommands(message: Message) {
  const zargs = message.content.split(' ');
  switch (zargs[0].substring(3)) {
    case 'k':
      // =gzk
      if (config.process === message.channel.id) {
        if (!processStats.isInactive && !processStats.devMode) {
          const dbOnMsg = `~db-process-on${Math.min(bot.voice.adapters.size, 9)}${buildNo.getBuildNo()}ver${
            process.pid
          }`;
          return message.channel.send(dbOnMsg);
        }
        return;
      }
      if (!zargs[1]) {
        let dm: string;
        if (processStats.devMode) {
          dm = ' (dev mode)';
        } else {
          dm = bot.voice.adapters.size ? ' (VCs: ' + bot.voice.adapters.size + ')' : '';
        }
        // the process message: [sidelined / active] [process number] [version number]
        const procMsg = () => {
          return (
            (processStats.isInactive ? 'sidelined: ' : processStats.devMode ? 'active: ' : '**active: **') +
            process.pid +
            ` *[${hardwareTag}]* (${version})` +
            dm
          );
        };
        message.channel.send(procMsg()).then((sentMsg) => {
          if (processStats.devMode) {
            sentMsg.react(reactions.O_DIAMOND);
          } else {
            sentMsg.react(reactions.GEAR);
          }

          const filter = (reaction: MessageReaction, user: User) => {
            return (
              user.id !== botID &&
              user.id === message.member!.id &&
              [reactions.GEAR, reactions.O_DIAMOND].includes(reaction.emoji.name!)
            );
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
          const collector = sentMsg.createReactionCollector({ filter, time: 30000 });
          let prevVCSize = bot.voice.adapters.size;
          let prevStatus = processStats.isInactive;
          let prevDevMode = processStats.devMode;
          const statusInterval = setInterval(() => {
            if (
              !(
                bot.voice.adapters.size === prevVCSize &&
                prevStatus === processStats.isInactive &&
                prevDevMode === processStats.devMode
              )
            ) {
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
                  bot.voice.adapters.forEach((_adapter, guildId) => {
                    const gMems = (<VoiceChannel>(
                      bot.channels.cache.get(getVoiceConnection(guildId)!.joinConfig.channelId!)
                    ))!.members;
                    if (gMems.get(CORE_ADM[0]) || gMems.get(CORE_ADM[1])) {
                      hasDeveloper = true;
                      const server = processStats.getServer(guildId);
                      processStats.disconnectConnection(server);
                    }
                  });
                }
                if (!hasDeveloper) {
                  message.channel.send(
                    '***' +
                      process.pid +
                      ' - button is disabled***\n*This process should not be ' +
                      'sidelined because it has active members using it (VCs: ' +
                      bot.voice.adapters.size +
                      ')*\n' +
                      '*If you just activated another process, please deactivate it.*'
                  );
                  return;
                }
              }
              if (processStats.isInactive) {
                processStats.setProcessActive();
              } else {
                setProcessInactiveAndMonitor();
              }

              if (sentMsg.deletable) {
                updateMessage();
                reaction.users.remove(user.id);
              }
            } else if (reaction.emoji.name === reactions.O_DIAMOND) {
              if (processStats.devMode) {
                processStats.setDevMode(false);
                setProcessInactiveAndMonitor();
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
        setProcessInactiveAndMonitor();
      } else {
        let i = 1;
        while (zargs[i]) {
          if (zargs[i].replace(/,/g, '') === process.pid.toString()) {
            if (processStats.isInactive) {
              processStats.setProcessActive();
              message.channel.send('*db vibe ' + process.pid + ' is now active*');
            } else {
              setProcessInactiveAndMonitor();
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
        return message.channel.send(
          activeStatus + ' process: ' + process.pid.toString() + ' (' + 'dev mode: ' + processStats.devMode + ')'
        );
      }
      if (processStats.devMode && zargs[1] === process.pid.toString()) {
        processStats.setDevMode(false);
        setProcessInactiveAndMonitor();
        processStats.servers.delete(message.guild!.id);
        return message.channel.send(`*devmode is off ${process.pid}*`);
      } else if (zargs[1] === process.pid.toString()) {
        processStats.setDevMode(true);
        processStats.servers.delete(message.guild!.id);
        if (processStats.checkActiveInterval) {
          clearInterval(processStats.checkActiveInterval);
          processStats.checkActiveInterval = null;
        }
        return message.channel.send(`*devmode is on ${process.pid}*`);
      }
      break;
    case 'l':
      // =gzl
      message.channel.send(
        process.pid.toString() +
          `: Latency is ${Date.now() - message.createdTimestamp}ms.\nNetwork latency is ${Math.round(bot.ws.ping)}ms`
      );
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
          }, 2000)
        );
      }
      break;
    case 'z':
      // =gzz
      if (message.author.bot && zargs[1] !== process.pid.toString()) {
        await new Promise((res) => setTimeout(res, Math.random() * 5000));
        checkToSeeActive();
      }
      break;
    case 'update':
      // =gzupdate
      if (zargs[1]) {
        // maintain if-statement structure because of else condition
        if (zargs[1] !== process.pid.toString()) return;
      } else if (processStats.devMode) {
        // when no pid is provided & is devMode
        return;
      }

      if (processStats.isInactive || processStats.devMode) {
        message.channel.send(`*updating process ${process.pid}*`);
        devUpdateCommand(undefined, zargs.slice(2));
      }
      break;
    case 'b':
      // =gzb
      if (zargs[1]) {
        if (zargs[1] !== process.pid.toString()) return;
        if (zargs[2]) {
          if (zargs[2] === '+') {
            if (buildNo.incrementBuildNo()) {
              message.channel.send(`*build no incremented (${buildNo.getBuildNo()})*`);
            } else {
              message.channel.send(`*could not increment (${buildNo.getBuildNo()})*`);
            }
          } else if (zargs[2] === '-') {
            if (buildNo.decrementBuildNo()) {
              message.channel.send(`*build no decremented (${buildNo.getBuildNo()})*`);
            } else {
              message.channel.send(`*could not decrement (${buildNo.getBuildNo()})*`);
            }
          }
        } else {
          message.channel.send("try again followed by a '+' or '-' to increment or decrement.");
        }
      } else {
        message.channel.send(`*process ${process.pid} (${buildNo.getBuildNo()})*`);
      }
      break;
    case 'temp':
      // =gztemp
      if (zargs[1] && zargs[1] !== process.pid.toString() && zargs[1].toLowerCase() !== hardwareTag.toLowerCase())
        return;
      getTemperature().then((response) => {
        if (!response.isError && response.value) {
          message.channel.send(`${hardwareTag || process.pid.toString()}: \`${response.value}\``);
        }
      });
      break;
    case 'env':
      // =gzenv
      if (zargs[1] !== process.pid.toString()) return;
      await processEnvFile(message);
      break;
    default:
      if (processStats.devMode && !processStats.isInactive && message.guild) return runCommandCases(message);
      break;
  }
}

// parses message, provides a response
bot.on('messageCreate', (message: Message) => {
  if (
    (message.content.substring(0, 3) === '=gz' || message.channel.id === config.process) &&
    isAdmin(message.author.id)
  ) {
    void devProcessCommands(message);
    if (message.channel.id === config.process) {
      if (!processStats.devMode) {
        processHandler(message);
      }
    }
    return;
  }
  if (message.author.bot || processStats.isInactive || (processStats.devMode && !isAdmin(message.author.id))) return;
  if (message.guildId === null) {
    dmHandler(message, message.content).catch((err) => processStats.debug(err));
  } else {
    void runCommandCases(message);
  }
});

/**
 * Runs a test.
 * @param channel The text channel to run the test in.
 * @param messagesToRun Array of message IDs to test.
 */
async function runDevTest(channel: BaseGuildTextChannel, messagesToRun: Array<string>) {
  channel.send('*test received*').catch((er: Error) => processStats.debug(er));
  // fetch should be the message to test/mimic
  for (const msgId of messagesToRun) {
    if (!msgId) {
      channel.send('warning: empty test cases, exiting...');
      break;
    }
    const msg = await channel.messages.fetch(msgId);
    await new Promise((res) => setTimeout(res, 2000));
    if (msg) {
      const baseCmdInfo = `[INFO] ${runDevTest.name}: testing "${msg.content}"`;
      if (msg.content.substring(1, 3) === 'gz') {
        processStats.debug(`${baseCmdInfo} (to ${devProcessCommands.name})`);
        await devProcessCommands(msg);
      } else {
        processStats.debug(`${baseCmdInfo} (to ${runCommandCases.name})`);
        await runCommandCases(msg);
      }
    } else {
      console.log(`${runDevTest.name}: could not find message with the id ${msgId}`);
    }
  }
}

bot.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
  const server = processStats.getServer(oldState.guild.id.toString());
  if (processStats.isInactive) {
    if (server.collector) {
      server.collector.stop();
      server.collector = null;
    }
    return;
  }
  updateVoiceState(oldState, newState, server).then();
});

/**
 * Updates the bots voice state depending on the update occurring.
 * @param oldState The old voice-state update metadata.
 * @param newState The new voice-state update metadata.
 * @param server {LocalServer} The server metadata.
 */
async function updateVoiceState(oldState: VoiceState, newState: VoiceState, server: LocalServer) {
  if (!server) return;
  // if the bot is leaving
  if (oldState.member!.id === botID) {
    // if the bot joined then ignore
    if (newState.channel?.members.get(botID)) {
      server.audio.voiceChannelId = newState.channelId;
      return;
    }
    // clear timers first
    if (server.leaveVCTimeout) {
      clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = undefined;
    }
    clearDJTimer(server);
    // disconnect and delete the voice adapter
    processStats.disconnectConnection(server);
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
    server.dictator = undefined;
    server.autoplay = false;
    server.userKeys.clear();
    server.queueHistory.length = 0;
    if (server.followUpMessage) {
      server.followUpMessage.delete();
      server.followUpMessage = undefined;
    }
    if (bot.voice.adapters.size < 1) {
      whatspMap.clear();
    }
  } else if (botInVcGuild(newState.guild.id)) {
    if ((oldState.channel?.members.filter((x) => !x.user.bot).size || 0) < 1) {
      let leaveVCInt = 1100;
      // if there is an active dispatch - timeout is 5 min
      if (server.audio.resource && !server.audio.resource.ended && server.queue.length > 0) {
        leaveVCInt = 420000;
      }
      // clear if timeout exists, set new timeout
      if (server.leaveVCTimeout) clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = setTimeout(() => {
        server.leaveVCTimeout = undefined;
        if ((oldState.channel?.members.filter((x) => !x.user.bot).size || 0) < 1) {
          processStats.disconnectConnection(server);
        }
      }, leaveVCInt);
    }
  } else if (server.seamless.function && !oldState.member?.user.bot) {
    if (server.seamless.timeout) {
      clearTimeout(server.seamless.timeout);
      server.seamless.timeout = undefined;
    }
    try {
      // @ts-ignore
      server.seamless.function(...server.seamless.args);
    } catch (e) {
      processStats.debug(e);
    }
    server.seamless.function = () => {};
    server.seamless.message?.delete();
    server.seamless.message = undefined;
  }
}

/**
 * Runs a cmd for pi systems that returns the temperature.
 * @returns {Promise<{value: string, isError: boolean}>} An object containing the response or error message.
 */
function getTemperature(): Promise<{ value: string; isError: boolean }> {
  return new Promise((resolve) => {
    exec('vcgencmd measure_temp', (error: any, stdout: string, stderr: string) => {
      if (stdout) {
        resolve({ value: stdout, isError: false });
      } else if (stderr) {
        resolve({ value: stderr, isError: true });
      } else {
        resolve({ value: 'no response', isError: true });
      }
    });
  });
}

/**
 * Processes an updated env file to the local directory.
 * @param message The message containing the file.
 */
async function processEnvFile(message: Message) {
  // sets the .env file
  if (!message.attachments.first() || !message.attachments.first()!.name?.includes('.txt')) {
    message.channel.send('no attachment found');
  } else {
    const response = await axios({
      url: message.attachments.first()!.url,
      method: 'GET',
      responseType: 'stream'
    });
    response.data.pipe(fs.createWriteStream('.env'));
    message.channel.send('*contents changed. changes will take effect after a restart*');
  }
}

bot.on('error', (e: Error) => {
  console.log('BOT ERROR:\n', e);
  processStats.logError(`BOT ERROR: ${processStats.devMode ? '(development)' : ''}:\n${e.stack}`);
});
process.on('error', (e) => {
  console.log('PROCESS ERROR:\n', e);
});

process
  .on('SIGTERM', shutdown('SIGTERM'))
  .on('SIGINT', shutdown('SIGINT'))
  .on('uncaughtException', uncaughtExceptionAction);

// whether the process is attempting to reconnect
let isFixingConnection = false;
/**
 * The action to be performed if there is an uncaughtExceptionError.
 * @param e The Error Object.
 */
function uncaughtExceptionAction(e: Error) {
  if (e.message.includes('getaddrinfo') && e.message.includes('discord.com')) {
    if (isFixingConnection) return;
    isFixingConnection = true;
    fixConnection().finally(() => {
      isFixingConnection = false;
    });
  } else {
    processStats.debug('uncaughtException: ', e);
    if (e.message === 'Unknown Message') return;
    processStats.logError(`Uncaught Exception ${processStats.devMode ? '(development)' : ''}:\n${e.stack}`);
  }
}

/**
 * Assuming that there was a connection error. Tries to reconnect.
 */
async function fixConnection(): Promise<boolean> {
  let waitTimeMS = 10000;
  const retryText = (time: number) => `retrying in ${time / 1000} seconds...`;
  console.log(`no connection: ${retryText(waitTimeMS)}`);
  let retries = 0;
  const connect = async () => {
    console.log('connecting...');
    try {
      await bot.login(token);
      console.log('connected.');
      return true;
    } catch (e) {
      // if the wait time was greater than 10 minutes, then exit
      if (waitTimeMS > 60_000 * 10) {
        console.log(`failed to connect after ${retries} tries. exiting...`);
        process.exit(1);
      }
      // after 3 tries, set the state to inactive
      if (retries > 2) processStats.setProcessInactive();
      retries++;
      waitTimeMS *= 2;
      console.log(`connection failed.\n${retryText(waitTimeMS)}`);
    }
    return false;
  };
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, waitTimeMS));
    if (await connect()) return true;
  }
}

// The main method
(async () => {
  // login to discord
  await bot.login(token);
  if (bot.user!.id !== botID) throw new Error('Invalid botID');
  console.log('Logged into discord. Waiting for ready event...');
  commandHandler.loadAllCommands();
})();
