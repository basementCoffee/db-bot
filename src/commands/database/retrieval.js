const {botInVC} = require('../../utils/utils');
const {gsrun, gsUpdateAdd, gsrun_P, getJSON, gsUpdateOverwrite} = require('./api/api');
const processStats = require('../../utils/process/ProcessStats');

/**
 * Get the keys and links from the database. Uses local storage if available.
 * If there is no current embed then also resorts to an API fetch.
 * @param server The server object.
 * @param sheetName {string} The name of the sheet to get info from.
 * @param save {Boolean=} Whether to save the fetch within the server.
 * @returns {Promise<{congratsDatabase: Map<>, referenceDatabase: Map<>, line: Array<>, dsInt: int} | undefined>}
 */
async function getXdb (server, sheetName, save) {
  if (!sheetName.includes('p')) {
    console.log('CALLED SERVER SHEET');
  }
  const userSettings = sheetName.includes('p') ? await getSettings(server, sheetName) : {isTest: false};
  if (userSettings.isTest) {
    const xdb = await getXdb_P(server, sheetName, save);
    const congratsDatabase = new Map();
    const referenceDatabase = new Map();
    const line = [];
    for (let [, key] of xdb.globalKeys){
      line.push(key.name);
      congratsDatabase.set(key.name, key.link);
      referenceDatabase.set(key.name.toUpperCase(), key.link);
    }
    const dsInt = xdb.globalKeys.size;
    return {
      congratsDatabase, referenceDatabase, line, dsInt
    }
  } else {
    return getOriginalXdb(server, sheetName, save);
  }
}

async function getOriginalXdb (server, sheetName, save){
  if (!save) return gsrun('A', 'B', sheetName);
  let xdb = server.userKeys.get(`${sheetName}`);
  if (!xdb) {
    xdb = await gsrun('A', 'B', sheetName);
    server.userKeys.set(`${sheetName}`, xdb);
  }
  return xdb;
}

/**
 *
 * @param server
 * @param sheetName {string}
 * @param save {any?}
 * @return {Promise<unknown>}
 */
async function getXdb_P (server, sheetName, save) {
  if (!save) return (server.userKeys.get(sheetName) || gsrun_P('E', 'F', sheetName));
  let xdb = server.userKeys.get(sheetName);
  if (!xdb) {
    xdb = await gsrun_P('E', 'F', sheetName);
    server.userKeys.set(sheetName, xdb);
  }
  return xdb;
}

async function getSettings (server, sheetName) {
  let xdb = server.userSettings.get(sheetName);
  if (!xdb) {
    xdb = await getJSON("H1", sheetName) || {};
    server.userSettings.set(sheetName, xdb);
  }
  return xdb;
}

async function setSettings (server, sheetName, settingsObj) {
  gsUpdateOverwrite([settingsObj], sheetName, "H", 1);
}

/**
 * Sends the list size of the sheet provided.
 * @param message The message that triggered the bot.
 * @param server The server object.
 * @param sheetName {string} The sheet to reference.
 * @return {Promise<void>}
 */
async function sendListSize (message, server, sheetName) {
  const xdb = await getXdb(server, sheetName, botInVC(message));
  const str = `${(sheetName[0] === 'p' ? 'Personal' : 'Server')} list size: ${(xdb?.congratsDatabase.size)}`;
  message.channel.send(str);
}

/**
 * Gets the server prefix from the database and updates the server.prefix field.
 * If there is no prefix then the default is added to the database.
 * @param server The server.
 * @param mgid The guild id, used to get the prefix.
 * @return {Promise<void>}
 */
async function getServerPrefix (server, mgid) {
  try {
    if (!processStats.serverPrefixes) {
      processStats.serverPrefixes = await gsrun('A', 'B', 'prefixes');
    }
    server.prefix = processStats.serverPrefixes.congratsDatabase.get(mgid);
    if (!server.prefix) {
      server.prefix = '.';
      try {
        gsUpdateAdd(mgid, '.', 'A', 'B', 'prefixes', processStats.serverPrefixes.dsInt);
      } catch (e) {console.log(e);}
    }
  } catch (e) {
    console.log(e);
    server.prefix = '.';
    gsUpdateAdd(mgid, '.', 'A', 'B', 'prefixes', 1);
  }
}

module.exports = {getXdb, sendListSize, getServerPrefix,  getXdb2: getXdb_P, getSettings};

