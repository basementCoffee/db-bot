/* eslint-disable camelcase */
import {
  Channel,
  Collection,
  ColorResolvable,
  Guild,
  GuildMember,
  Message,
  Snowflake,
  TextChannel,
  VoiceChannel
} from 'discord.js';
import fetch from 'isomorphic-unfetch';
import ytdl from 'ytdl-core-discord';
import ytpl from 'ytpl';
import LocalServer from './lib/LocalServer';
import { getVoiceConnection } from '@discordjs/voice';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import { linkFormatter } from './formatUtils';
import { bot, botID, SOUNDCLOUD_BASE_LINK, SPOTIFY_BASE_LINK, StreamType, TWITCH_BASE_LINK } from './lib/constants';
import { QueueItem } from './lib/types';

const { getData } = require('spotify-url-info')(fetch);
const scdl = require('soundcloud-downloader').default;
const unpipe = require('unpipe');
const cpu = require('node-os-utils').cpu;
const os = require('os');

/**
 * Returns whether the bot is in a voice channel within the guild.
 * @param message The message that triggered the bot.
 * @returns A boolean value.
 */
function botInVC(message: Message): boolean {
  return botInVcGuild(message.guild!.id);
}

/**
 * Returns whether the bot is in a voice channel within the guild.
 * @param guildId The guild id.
 * @returns A boolean value.
 */
function botInVcGuild(guildId: string): boolean {
  try {
    const members = (<VoiceChannel>bot.channels.cache.get(getVoiceConnection(guildId)?.joinConfig.channelId!))?.members;
    return !!bot.voice.adapters.get(guildId) && members && members.has(bot.user!.id);
  } catch (e) {
    return false;
  }
}

/**
 * Returns the queue display status.
 * @param server {LocalServer} The server.
 * @returns {string} The queue count/status.
 */
function getQueueText(server: LocalServer) {
  let content;
  if (server.queue.length > 1) content = `1 / ${server.queue.length}`;
  else if (server.queue.length > 0) content = server.autoplay ? 'smartplay' : '1 / 1';
  else content = 'empty';
  return content;
}

/**
 * Returns whether a given URL is valid. Returns false if given a playlist.
 * @param url The url to verify.
 * @returns {boolean} True if given a playable URL.
 */
function verifyUrl(url: string) {
  let isValid = false;
  if (isSpotifyLink(url)) {
    isValid = true;
  } else if (url.includes(SOUNDCLOUD_BASE_LINK)) {
    isValid = scdl.isValidUrl(linkFormatter(url, SOUNDCLOUD_BASE_LINK));
  } else if (ytdl.validateURL(url) || url.includes(TWITCH_BASE_LINK)) {
    isValid = true;
  }
  return isValid && !verifyPlaylist(url);
}

/**
 * Returns true if the given url is a valid playlist link.
 * @param url The url to verify.
 * @returns {string | boolean} A StreamType or false.
 */
function verifyPlaylist(url: string = ''): string | boolean {
  try {
    url = url.toLowerCase();
    if (isSpotifyLink(url)) {
      if (isPlaylistSpotifyLink(url)) {
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
 * Assuming a Spotify link is given. Returns true if the given url is a valid Spotify playlist link.
 * @param url {string} The url to verify.
 * @returns {boolean} Whether it is a Spotify playlist.
 */
function isPlaylistSpotifyLink(url: string): boolean {
  return url.includes('/playlist') || url.includes('/album');
}

function isSpotifyLink(url: string): boolean {
  return url.includes(SPOTIFY_BASE_LINK) || url.includes('spotify.link');
}

/**
 * Resets server playback to default args. MUST occur before voice channel join, NOT after voice channel leave.
 * @param server {LocalServer} The server to reset.
 */
function resetSession(server: LocalServer) {
  server.queue = [];
  server.queueHistory = [];
  server.loop = false;
  server.audio.reset();
  server.mapFinishedLinks.clear();
}

/**
 * Gets the title of a link.
 * @param queueItem The queue item to get the title.
 * @param cutoff {number=} A number representing the cutoff value.
 * @returns {Promise<string>} The title of the provided link.
 */
async function getTitle(queueItem: any, cutoff?: number): Promise<string> {
  let title;
  const isEmptyQueueItem = !queueItem.infos || !Object.keys(queueItem.infos).length;
  try {
    if (queueItem.type === StreamType.SPOTIFY) {
      if (isEmptyQueueItem) queueItem.infos = Object.assign(queueItem.infos || {}, await getData(queueItem.url));
      title = queueItem.infos.name;
    } else if (queueItem.type === StreamType.SOUNDCLOUD) {
      if (isEmptyQueueItem) queueItem.infos = Object.assign(queueItem.infos || {}, await scdl.getInfo(queueItem.url));
      title = queueItem.infos.title;
    } else if (queueItem.type === StreamType.TWITCH) {
      title = 'twitch livestream';
    } else {
      if (isEmptyQueueItem) {
        queueItem.infos = Object.assign(queueItem.infos || {}, await ytdl.getBasicInfo(queueItem.url));
      }
      title = queueItem.infos.videoDetails?.title || queueItem.infos.title;
    }
  } catch (e) {
    console.log('broken_url', e);
    title = 'broken_url';
  }
  if (cutoff && title.length > cutoff) {
    title = title.substring(0, cutoff) + '...';
  }
  return title;
}

/**
 * Formats B to MB.
 * @param data {number} The bytes to format to MB.
 * @returns {string} A string that has the number of MB.
 */
const formatMemoryUsage = (data: number) => `${Math.round((data / 1024 / 1024) * 100) / 100}`;

/**
 * Creates an embed regarding memory usage.
 * @return {Promise<EmbedBuilderLocal>}
 */
async function createMemoryEmbed() {
  const memUsage = process.memoryUsage();
  const cpuUsage = await cpu.usage();
  return new EmbedBuilderLocal()
    .setTitle('Memory Usage')
    .setDescription(
      `rss -  ${formatMemoryUsage(memUsage.rss)} MB\nheap -  ` +
        `${formatMemoryUsage(memUsage.heapUsed)} / ${formatMemoryUsage(memUsage.heapTotal)} MB ` +
        `(${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%)\ncpu: ${cpuUsage}%` +
        `\nload-avg: ${Math.round(os.loadavg()[1] * 100) / 100}%`
    );
}

/**
 * Ends the stream if a configuration for it is available.
 * @param server {LocalServer} The server in which to end the stream.
 */
function endStream(server: LocalServer) {
  try {
    if (server.streamData.type === StreamType.YOUTUBE) {
      if (server.streamData.ytPlayer === 'play-dl') {
        server.streamData.stream.pause();
        server.streamData.stream.destroy();
      } else {
        try {
          if (server.streamData.ytPlayer === 'fluent') {
            server.streamData.stream.kill();
          } else {
            server.streamData.stream.destroy();
          }
        } catch (e) {}
      }
    } else if (server.streamData.type === StreamType.SOUNDCLOUD) {
      if (!server.streamData.stream._readableState.closed) {
        console.log(`not closed: ${server.streamData.stream._readableState.pipes.length}`);
      }
      if (server.streamData.stream._readableState.pipes.length > 0) {
        for (const v of Object.keys(server.streamData.stream._readableState.pipes[0])) {
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
}

/**
 * Un-shifts the provided link to the server's queue.
 * @param queue {Array} The queue to unshift.
 * @param queueItem The item to add to the queue.
 */
function unshiftQueue(queue: Array<any>, queueItem: any) {
  queue.unshift(queueItem);
}

/**
 * Creates a queue item.
 * @param url {string} The URL to add.
 * @param type {any?} The type of URL. Provided as a StreamType.
 * @param infos {any?} The infos of the URL.
 * @param source The source of the URL, if it came from a playlist
 * @returns {{type, url, infos, source}}
 */
function createQueueItem(url: string, type: StreamType, infos?: any, source?: string): QueueItem {
  if (!type) type = getLinkType(url);
  return {
    url,
    type,
    infos,
    source
  };
}

/**
 * Pushes the provided link to the server's queue.
 * @param queue {Array} The queue to push to.
 * @param queueItem The item to add to the queue.
 */
function pushQueue(queue: Array<any>, queueItem: any) {
  queue.push(queueItem);
}

/**
 * Returns a StreamType string depending on the source of the infos.
 * @param url The url to get the type of.
 * @returns {string} A StreamType.
 */
const getLinkType = (url: string) => {
  if (isSpotifyLink(url)) return StreamType.SPOTIFY;
  else if (url.includes(SOUNDCLOUD_BASE_LINK)) return StreamType.SOUNDCLOUD;
  else if (url.includes(TWITCH_BASE_LINK)) return StreamType.TWITCH;
  return StreamType.YOUTUBE;
};

/**
 * Sets seamless listening on voice channel error. Seamless listening allows the
 * bot to temporarily save a wanted command until voice channel join.
 * @param server {LocalServer} The server.
 * @param fName The name of the function to play.
 * @param args The function parameters.
 * @param message A message to delete.
 */
function setSeamless(server: LocalServer, fName: any, args: Array<any>, message: Message) {
  server.seamless.function = fName;
  server.seamless.args = args;
  server.seamless.message = message;
  if (server.seamless.timeout) clearTimeout(server.seamless.timeout);
  server.seamless.timeout = setTimeout(() => {
    server.seamless.function = () => {};
    server.seamless.message = undefined;
  }, 9000);
}

/**
 * Removes a specific number of recent db vibe messages.
 * Also removes the command message if possible.
 * @param channelID {string} The channel id to search within.
 * @param deleteNum {number} The number of recent db vibe messages to remove.
 * @param onlyDB {boolean} True if to delete only db vibe messages.
 */
function removeDBMessage(channelID: string, deleteNum = 1, onlyDB: boolean) {
  let firstRun = true;
  try {
    // the number of messages to fetch
    const NUM_TO_FETCH = 30;
    bot.channels.fetch(channelID).then((channel: Channel | null) =>
      (<TextChannel>channel).messages
        .fetch({ limit: NUM_TO_FETCH, cache: false })
        .then(async (msgs: Collection<Snowflake, Message>) => {
          for (const [, item] of msgs) {
            if (item.deletable) {
              if (firstRun) {
                firstRun = false;
                await item.delete();
              } else if (!onlyDB || item?.member?.id === botID) {
                await item.delete();
                deleteNum--;
              }
              if (!deleteNum) break;
            }
          }
        })
    );
  } catch (e) {}
}

/**
 * Returns the error message informing the user that it is not in a voice channel with the bot.
 * @param guild The guild.
 * @return {string} The error message.
 */
function notInVoiceChannelErrorMsg(guild: Guild): string {
  return `must be in a voice channel with ${getBotDisplayName(guild)} for this command`;
}

/**
 * Gets the display name of the bot. If there is a nickname, it will return it, otherwise it will return the default
 * name.
 * @param guild The guild from which to get the name.
 * @returns {string} The display name of the bot.
 */
function getBotDisplayName(guild: Guild): string {
  return guild.members.me!.nickname || guild.members.me!.user.username;
}

/**
 * Returns true if the link is a valid playable link (includes playlists).
 * @param link {string} The link to validate.
 * @returns {boolean} If the link is a valid, playable link.
 */
function linkValidator(link: string): boolean {
  return verifyUrl(link) || !!verifyPlaylist(link);
}

/**
 * Returns the sheet name for the user id.
 * @param userId {string}
 * @returns {string} The sheet name.
 */
function getSheetName(userId: string): string {
  return `p${userId}`;
}

/**
 * Determines if the provided sheetName is a user sheet.
 * @param sheetName {string} A sheet name.
 * @returns {boolean} True if is a user sheet.
 */
function isPersonalSheet(sheetName: string): boolean {
  return sheetName[0] === 'p';
}

/**
 * Gets the members of a voice channel.
 * @param guildId {string} The guild id.
 * @return {Array<*>}} The members of the voice channel.
 */
function getVCMembers(guildId: string): Array<any> {
  const voiceConnection = getVoiceConnection(guildId);
  if (voiceConnection) {
    const collectionOfMembers: Collection<string, GuildMember> = (<VoiceChannel>(
      bot.channels.cache.get(voiceConnection.joinConfig.channelId!)
    ))?.members;
    if (collectionOfMembers) {
      const gmArray = Array.from(collectionOfMembers);
      gmArray.map((item: any) => item[1].user.username);
      return gmArray[0];
    }
  }
  return [];
}

/**
 * Creates a visual embed.
 * @param title {string} The title of the embed.
 * @param text {string} The text of the embed.
 * @param color {string?} The color of the embed.
 * @return {EmbedBuilderLocal} The embed.
 */
function createVisualEmbed(title: string, text: string, color?: ColorResolvable): EmbedBuilderLocal {
  return new EmbedBuilderLocal()
    .setTitle(title)
    .setDescription(text)
    .setColor(color || '#0099ff');
}

/**
 * Returns false if the command is short (less than 3 characters) and there is no active session.
 * @param guild {import('discord.js').Guild} The message.
 * @param statement {string} The command to check.
 * @returns {boolean} False if the cmd is short with no active session.
 */
function isShortCommand(guild: Guild, statement: string) {
  return !botInVcGuild(guild.id) && statement.length < 3;
}

export {
  botInVC,
  verifyUrl,
  verifyPlaylist,
  resetSession,
  setSeamless,
  getQueueText,
  getTitle,
  endStream,
  unshiftQueue,
  pushQueue,
  createQueueItem,
  getLinkType,
  createMemoryEmbed,
  removeDBMessage,
  linkValidator,
  getSheetName,
  isPersonalSheet,
  getBotDisplayName,
  createVisualEmbed,
  notInVoiceChannelErrorMsg,
  getVCMembers,
  botInVcGuild,
  isPlaylistSpotifyLink,
  isSpotifyLink,
  isShortCommand
};
