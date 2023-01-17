/* eslint-disable camelcase */
import LocalServer from '../utils/lib/LocalServer';
import { Message } from 'discord.js';
import processStats from '../utils/lib/ProcessStats';
import { PREFIX_SN } from '../utils/lib/constants';
import { botInVC } from '../utils/utils';
import { getJSON, gsrun, gsrun_P, gsUpdateAdd, gsUpdateOverwrite } from './api/api';

/**
 * Gets the user keys from the database.
 * @param server {LocalServer} The server object.
 * @param sheetName {string} The name of the sheet to retrieve (for user data use getSheetName(userId))
 * @param save {boolean} Whether to save the function to the server
 * @returns {Promise<{playlistArray: [], playlists: Map<unknown, unknown>, globalKeys: any}>}
 */
async function getXdb2(
  server: LocalServer,
  sheetName: string,
  save: boolean
): Promise<{ playlistArray: []; playlists: Map<string, Map<string, any>>; globalKeys: any }> {
  if (!save) return server.userKeys.get(sheetName) || (await gsrun_P('E', 'F', sheetName));
  let xdb = server.userKeys.get(sheetName);
  if (!xdb) {
    xdb = await gsrun_P('E', 'F', sheetName);
    server.userKeys.set(sheetName, xdb);
  }
  return xdb;
}

/**
 * Gets user settings from the database.
 * @param server The server object.
 * @param sheetName The sheet name.
 * @returns The settings object.
 */
async function getSettings(server: LocalServer, sheetName: string) {
  let xdb = server.userSettings.get(sheetName);
  if (!xdb) {
    xdb = (await getJSON('H1', sheetName)) || {};
    server.userSettings.set(sheetName, xdb);
  }
  return xdb;
}

/**
 * Sets the settings for a sheet.
 * @param server The server object.
 * @param sheetName The sheet name.
 * @param settingsObj The settings object.
 */
async function setSettings(server: LocalServer, sheetName: string, settingsObj: any) {
  gsUpdateOverwrite([JSON.stringify(settingsObj)], sheetName, 'H', 1);
}

/**
 * Sends the list size of the provided playlist.
 * @param message The message that triggered the bot.
 * @param server {LocalServer} The server object.
 * @param sheetName {string} The sheet to reference.
 * @param playlistName {string} The name of the playlist to get the size of.
 * @returns {Promise<void>}
 */
async function sendListSize(message: Message, server: LocalServer, sheetName: string, playlistName: string) {
  const xdb = await getXdb2(server, sheetName, botInVC(message));
  const playlist: any = xdb.playlists.get(playlistName.toUpperCase());
  if (playlist) {
    const str = `**${playlistName}** playlist size: ${playlist.size}`;
    message.channel.send(str);
  }
}

/**
 * Gets the server prefix from the database and updates the server.prefix field.
 * If there is no prefix then the default is added to the database.
 * @param server {LocalServer} The server.
 * @param mgid The guild id, used to get the prefix.
 * @returns {Promise<string>} The server prefix.
 */
async function getServerPrefix(server: LocalServer, mgid: string) {
  try {
    if (!processStats.serverPrefixes) {
      processStats.serverPrefixes = await gsrun('A', 'B', PREFIX_SN);
    }
    server.prefix = processStats.serverPrefixes.congratsDatabase.get(mgid);
    if (!server.prefix) {
      server.prefix = '.';
      try {
        gsUpdateAdd(mgid, '.', 'A', 'B', PREFIX_SN);
      } catch (e) {
        console.log(e);
      }
    }
  } catch (e: any) {
    processStats.logError(e);
    server.prefix = '.';
    gsUpdateAdd(mgid, '.', 'A', 'B', PREFIX_SN);
  }
  return server.prefix;
}

export { sendListSize, getServerPrefix, getXdb2, getSettings, setSettings };
