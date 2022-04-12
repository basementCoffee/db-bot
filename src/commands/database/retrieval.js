const {botInVC} = require('../../utils/utils');
const {gsrun, gsUpdateAdd} = require('./api/api');
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
  if (!save) return gsrun('A', 'B', sheetName);
  let xdb = server.userKeys.get(`${sheetName}`);
  if (!xdb) {
    xdb = await gsrun('A', 'B', sheetName);
    server.userKeys.set(`${sheetName}`, xdb);
  }
  return xdb;
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

module.exports = {getXdb, sendListSize, getServerPrefix};

