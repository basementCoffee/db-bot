/* eslint-disable camelcase */
const {botInVC, isPersonalSheet} = require('../../utils/utils');
const {gsrun, gsUpdateAdd, gsrun_P, getJSON, gsUpdateOverwrite} = require('./api/api');
const processStats = require('../../utils/process/ProcessStats');
const {PREFIX_SN} = require('../../utils/process/constants');

// eslint-disable-next-line valid-jsdoc
/**
 * Get the keys and links from the database. Uses local storage if available.
 * If there is no current embed then also resorts to an API fetch.
 * @param server The server object.
 * @param sheetName {string} The name of the sheet to get info from.
 * @param save {Boolean=} Whether to save the fetch within the server.
 * @returns {Promise<{congratsDatabase: Map<>, referenceDatabase: Map<>, line: Array<>, dsInt: int} | undefined>}
 */
async function getXdb(server, sheetName, save) {
  console.log('CALLED DEPRECIATED XDB FUNC');
  if (!save) return gsrun('A', 'B', sheetName);
  let xdb = server.userKeys.get(`${sheetName}`);
  if (!xdb) {
    xdb = await gsrun('A', 'B', sheetName);
    server.userKeys.set(`${sheetName}`, xdb);
  }
  return xdb;
}

/**
 * Gets the user keys from the database.
 * @param server The server object.
 * @param sheetName {string} The name of the sheet to retrieve
 * @param save {any?} Whether to save the function to the server
 * @returns {Promise<{playlistArray: [], playlists: Map<unknown, unknown>, globalKeys: any}>}
 */
async function getXdb_P(server, sheetName, save) {
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
 * Sends the list size of the sheet provided.
 * @param message The message that triggered the bot.
 * @param server The server object.
 * @param sheetName {string} The sheet to reference.
 * @returns {Promise<void>}
 */
async function sendListSize(message, server, sheetName) {
  const xdb = await getXdb(server, sheetName, botInVC(message));
  const str = `${(isPersonalSheet(sheetName) ? 'Personal' : 'Server')} list size: ${(xdb?.congratsDatabase.size)}`;
  message.channel.send(str);
}

/**
 * Gets the server prefix from the database and updates the server.prefix field.
 * If there is no prefix then the default is added to the database.
 * @param server The server.
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
      } catch (e) {
        console.log(e);
      }
    }
  } catch (e) {
    console.log(e);
    server.prefix = '.';
    gsUpdateAdd(mgid, '.', 'A', 'B', PREFIX_SN);
  }
}

module.exports = {getXdb, sendListSize, getServerPrefix, getXdb2: getXdb_P, getSettings, setSettings};
