/* eslint-disable camelcase */
const { botInVC } = require('../utils/utils');
const { gsrun, gsUpdateAdd, gsrun_P, getJSON, gsUpdateOverwrite } = require('./api/api');
const processStats = require('../utils/lib/ProcessStats');
const { PREFIX_SN } = require('../utils/lib/constants');

/**
 * Gets the user keys from the database.
 * @param server {LocalServer} The server object.
 * @param sheetName {string} The name of the sheet to retrieve (for user data use getSheetName(userId))
 * @param save {any?} Whether to save the function to the server
 * @returns {Promise<{playlistArray: [], playlists: Map<unknown, unknown>, globalKeys: any}>}
 */
async function getXdb2(server, sheetName, save) {
  if (!save) return (server.userKeys.get(sheetName) || (await gsrun_P('E', 'F', sheetName)));
  let xdb = server.userKeys.get(sheetName);
  if (!xdb) {
    xdb = await gsrun_P('E', 'F', sheetName);
    server.userKeys.set(sheetName, xdb);
  }
  return xdb;
}

/**
 * Gets user settings from the database.
 * @param {*} server The server object.
 * @param {*} sheetName The sheet name.
 * @returns {*}
 */
async function getSettings(server, sheetName) {
  let xdb = server.userSettings.get(sheetName);
  if (!xdb) {
    xdb = await getJSON('H1', sheetName) || {};
    server.userSettings.set(sheetName, xdb);
  }
  return xdb;
}

/**
 * Sets the settings for a sheet.
 * @param {*} server The server object.
 * @param {*} sheetName The sheet name.
 * @param {*} settingsObj The settings object.
 */
async function setSettings(server, sheetName, settingsObj) {
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
async function sendListSize(message, server, sheetName, playlistName) {
  const xdb = await getXdb2(server, sheetName, botInVC(message));
  const playlist = xdb.playlists.get(playlistName.toUpperCase());
  if (playlist) {
    const str = `**${playlistName}** playlist size: ${(playlist.size)}`;
    message.channel.send(str);
  }
}

/**
 * Gets the server prefix from the database and updates the server.prefix field.
 * If there is no prefix then the default is added to the database.
 * @param server {LocalServer} The server.
 * @param mgid The guild id, used to get the prefix.
 * @returns {Promise<void>}
 */
async function getServerPrefix(server, mgid) {
  try {
    if (!processStats.serverPrefixes) {
      processStats.serverPrefixes = await gsrun('A', 'B', PREFIX_SN);
    }
    server.prefix = processStats.serverPrefixes.congratsDatabase.get(mgid);
    if (!server.prefix) {
      server.prefix = '.';
      try {
        gsUpdateAdd(mgid, '.', 'A', 'B', PREFIX_SN);
      }
      catch (e) {
        console.log(e);
      }
    }
  }
  catch (e) {
    console.log(e);
    server.prefix = '.';
    gsUpdateAdd(mgid, '.', 'A', 'B', PREFIX_SN);
  }
}

module.exports = { sendListSize, getServerPrefix, getXdb2, getSettings, setSettings };
