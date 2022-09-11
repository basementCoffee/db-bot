const {verifyUrl, verifyPlaylist, botInVC} = require('../utils/utils');
const {getXdb2} = require('../database/retrieval');

/**
 * Searches a Map for the given key. Provides the keys that contain the given key.
 * @param keyName {string} the key to search for.
 * @param keyArray {Array<>} An array containing all the valid names.
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values.
 */
function runSearchCommand(keyName, keyArray) {
  const keyNameLen = keyName.length;
  let ss = '';
  let ssi = 0;
  let searchKey;
  keyName = keyName.toUpperCase();
  for (let ik = 0; ik < keyArray.length; ik++) {
    searchKey = keyArray[ik].toUpperCase();
    if (keyName === searchKey.substring(0, keyNameLen) || (keyNameLen > 1 && searchKey.includes(keyName))) {
      ssi++;
      ss += `${keyArray[ik]}, `;
    }
  }
  if (ssi) ss = ss.substring(0, ss.length - 2);
  return {
    // the search string
    ss: ss,
    // the number of searches found
    ssi: ssi,
  };
}

/**
 * Tries to get a close match of a valid existing key from the word provided.
 * Otherwise, returns false.
 * @param word {string} The word to check.
 * @param namesArray An array containing all the valid names.
 * @returns {string | false} The closest valid assumption or false.
 */
function getAssumption(word, namesArray) {
  const sObj = runSearchCommand(word, namesArray);
  let ss = sObj.ss;
  if (ss) {
    ss = ss.split(',')[0];
    if (word.length > 1 && (ss.length - word.length) < Math.floor((ss.length / 2) + 2)) {
      return ss;
    }
  }

  return false;
}

/**
 * Searches the xdb for the provided string. Returns a JSON of a potential value and a guaranteed message.
 * If provided a value it will be in the format of a JSON with fields ss and ssi.
 * ss represents the search strings as CSVs and ssi would be the number of values within the ss.
 * NOTICE: Saves the keys of the sheetName referenced to the server object. This will have to be manually cleared later.
 * @param message The message that triggered the bot.
 * @param sheetName The sheet name to use for the lookup.
 * @param providedString The string to search for.
 * @param server The server metadata.
 * @returns {Promise<{valueObj: {ss: string, ssi: number}, link, message: string}|{message: string}|*|undefined>}
 */
async function searchForSingleKey(message, sheetName, providedString, server) {
  const xdb = await getXdb2(server, sheetName, true);
  const so = runSearchCommand(providedString, Array.from(xdb.globalKeys.values()).map((item) => item.name));
  if (so.ssi) {
    let link;
    if (so.ssi === 1) link = xdb.globalKeys.get(so.ss.toUpperCase())?.link;
    return {
      valueObj: so,
      link,
      message: `keys found: ${so.ss} ${(link ? `\n${link}` : '')}`,
    };
  } else if (providedString.length < 2) {
    return {
      message: 'Did not find any keys that start with the given letter.',
    };
  } else {
    return {
      message: 'Did not find any keys that contain \'' + providedString + '\'',
    };
  }
}

/**
 * Looks for an exact match of a given link within a given database.
 * @param message The message metadata.
 * @param sheetName The sheet name to use for the lookup.
 * @param link The link to lookup. Defaults to server
 * @param server The server metadata.
 * @returns {Promise<boolean>} If the request was a valid link.
 */
async function runLookupLink(message, sheetName, link, server) {
  if (!(verifyUrl(link) || verifyPlaylist(link))) return false;
  const xdb = await getXdb2(server, sheetName);
  for (const [, value] of xdb.globalKeys) {
    if (value.link === link) {
      message.channel.send(`Found it! key name is: **${value.name}**`);
      return true;
    }
  }
  message.channel.send('could not find any keys matching the given link');
  return true;
}

/**
 * A search command that searches both the server and personal database for the string.
 * @param message The message that triggered the bot.
 * @param server The server.
 * @param sheetName The guild id.
 * @param providedString The string to search for. Can contain multiple comma delineated strings.
 */
async function runUniversalSearchCommand(message, server, sheetName, providedString) {
  if (!providedString) return message.channel.send('must provide a link or word');
  const words = providedString.trim().split(/, | |,/);
  // returns true if the item provided was a link, handles the request
  if (await runLookupLink(message, sheetName, words[0], server)) return;
  if (words.length === 1) {
    message.channel.send((await searchForSingleKey(message, sheetName, words[0], server)).message);
  } else {
    const BASE_KEYS_STRING = '**_Keys found_**\n';
    let finalString = BASE_KEYS_STRING;
    let obj;
    for (const word of words) {
      obj = await searchForSingleKey(message, sheetName, word, server);
      if (obj.link) finalString += `${obj.valueObj.ss}:\n${obj.link}\n`;
    }
    if (finalString === BASE_KEYS_STRING) {
      finalString = 'did not find any exact key matches, try a single search word (instead of multiple) for a more refined search within the keys lists';
    }
    message.channel.send(finalString);
  }
  if (botInVC(!message)) server.userKeys.clear();
}

module.exports = {runSearchCommand, getAssumption, runUniversalSearchCommand};
