import {getXdb2} from "../database/retrieval";
import {Message} from "discord.js";
import LocalServer from "../utils/lib/LocalServer";
import { verifyUrl, verifyPlaylist, botInVC } from '../utils/utils';
const leven = require('leven');

/**
 * Searches a Map for the given key. Provides the keys that contain the given key.
 * @param keyName {string} the key to search for.
 * @param keyArray {Array<>} An array containing all the valid names.
 * @returns {{ss: string, ssi: number}} ss being the found values, and ssi being the number of found values.
 */
function runSearchCommand(keyName: string, keyArray: any[]) {
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
 * @returns {string | undefined} The closest valid assumption or false.
 */
function getAssumption(word: string, namesArray: string[]): string | undefined {
  const sObj = runSearchCommand(word, namesArray);
  let ss = sObj.ss;
  if (ss) {
    ss = ss.split(',')[0];
    if (word.length > 1 && (ss.length - word.length) < Math.floor((ss.length / 2) + 2)) {
      return ss;
    }
  }
  return undefined;
}

/**
 * Searches a Map for the given key. Uses an implementation of the Levenshtein distance algorithm
 * @param keyName the key to search for.
 * @param keyArray An array containing all the valid names.
 * @param levenThreashold The maximum threshold to include.
 * @returns {Array<string>} An array of the closest matches.
 */
function getAssumptionUsingLeven(keyName: string, keyArray: string[], levenThreashold = 2): Array<string> {
  const closestMatches = [];
  let lowestValue = levenThreashold;
  let currentValue;
  for (const key of keyArray) {
    currentValue = leven(keyName.toLowerCase(), key.toLowerCase());
    if (currentValue < lowestValue) {
      lowestValue = currentValue;
      closestMatches.length = 0;
      closestMatches.push(key);
    }
    else if (currentValue === lowestValue) {
      closestMatches.push(key);
    }
  }
  return closestMatches;
}

/**
 * Searches a Map for the given key. Uses an implementation of the Levenshtein distance algorithm
 * @param word The word to search for.
 * @param wordsArray An array containing all the valid words.
 * @param levenThreashold "The maximum threshold to include.
 * @returns {String | undefined} The single closest match or null if no closest match could be found.
 */
function getAssumptionMultipleMethods(word: string, wordsArray: string[], levenThreashold?: number): string | undefined {
  let assumption;
  assumption = getAssumption(word, wordsArray);
  if (!assumption) {
    const assumptionArr = getAssumptionUsingLeven(word, wordsArray, levenThreashold);
    if (assumptionArr.length === 1) assumption = assumptionArr[0];
  }
  return assumption;
}

/**
 * Searches the xdb for the provided string. Returns a JSON of a potential value and a guaranteed message.
 * If provided a value it will be in the format of a JSON with fields ss and ssi.
 * ss represents the search strings as CSVs and ssi would be the number of values within the ss.
 * NOTICE: Saves the keys of the sheetName referenced to the server object. This will have to be manually cleared later.
 * @param message The message that triggered the bot.
 * @param sheetName The sheet name to use for the lookup.
 * @param providedString The string to search for.
 * @param server {LocalServer} The local server object.
 * @returns {Promise<{valueObj: {ss: string, ssi: number}, link: string, message: string}|{message: string}>}
 */
async function searchForSingleKey(message: Message, sheetName: string, providedString: string, server: LocalServer): Promise<{valueObj: {ss: string, ssi: number}, link: string, message: string} | {message: string, link: undefined, valueObj: undefined}> {
  const xdb = await getXdb2(server, sheetName, true);
  const so = runSearchCommand(providedString, Array.from(xdb.globalKeys.values()).map((item: any) => item.name));
  if (so.ssi) {
    let link;
    if (so.ssi === 1) link = xdb.globalKeys.get(so.ss.toUpperCase())?.link;
    return {
      valueObj: so,
      link,
      message: `keys found: ${so.ss} ${(link ? `\n${link}` : '')}`,
    };
  }
  else if (providedString.length < 2) {
    return {
      message: 'Did not find any keys that start with the given letter.',
      link: undefined,
      valueObj: undefined
    };
  }
  else {
    return {
      message: 'Did not find any keys that contain \'' + providedString + '\'',
      link: undefined,
      valueObj: undefined
    };
  }
}

/**
 * Looks for an exact match of a given link within a given database.
 * @param message The message metadata.
 * @param sheetName The sheet name to use for the lookup.
 * @param link The link to lookup. Defaults to server
 * @param server {LocalServer} The local server object.
 * @returns {Promise<boolean>} If the request was a valid link.
 */
async function runLookupLink(message: Message, sheetName: string, link: string, server: LocalServer) {
  if (!(verifyUrl(link) || verifyPlaylist(link))) return false;
  const xdb = await getXdb2(server, sheetName, false);
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
 * @param server {LocalServer} The local server object.
 * @param sheetName The guild id.
 * @param providedString The string to search for. Can contain multiple comma delineated strings.
 */
async function runUniversalSearchCommand(message: Message, server: LocalServer, sheetName: string, providedString: string) {
  if (!providedString) return message.channel.send('must provide a link or word');
  const words = providedString.trim().split(/, | |,/);
  // returns true if the item provided was a link, handles the request
  if (await runLookupLink(message, sheetName, words[0], server)) return;
  if (words.length === 1) {
    message.channel.send((await searchForSingleKey(message, sheetName, words[0], server)).message);
  }
  else {
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
  if (!botInVC(message)) server.userKeys.clear();
}

export { runSearchCommand, runUniversalSearchCommand, getAssumptionMultipleMethods };
