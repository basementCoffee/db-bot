const {gsrun, gsUpdateAdd, gsUpdateOverwrite, deleteRows} = require('./backend');
const {verifyUrl, verifyPlaylist, botInVC} = require('../utils/utils');
const {servers} = require('../utils/constants');
const {runSearchCommand} = require('../playback-commands/search');

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
  // check duplicates, and initialize sheet for new servers
  gsrun('A', 'B', sheetName).then(async (xdb) => {
    while (args[z] && args[z + 1]) {
      let linkZ = args[z + 1];
      if (linkZ.substring(linkZ.length - 1) === ',') {
        linkZ = linkZ.substring(0, linkZ.length - 1);
      }
      if (args[z].includes('.') || args[z].includes(',')) {
        message.channel.send("did not add '" + args[z] + "', names cannot include '.' or ','");
        songsAddedInt--;
      } else {
        let alreadyExists = false;
        if (printMsgToChannel) {
          for (const x of xdb.congratsDatabase.keys()) {
            if (x.toUpperCase() === args[z].toUpperCase()) {
              message.channel.send("'" + x + "' is already in your list");
              alreadyExists = true;
              songsAddedInt--;
              break;
            }
          }
        }
        if (!alreadyExists) {
          await gsUpdateAdd(args[z], args[z + 1], 'A', 'B', sheetName, xdb.dsInt);
          xdb.congratsDatabase.set(args[z], args[z + 1]);
        }
      }
      z = z + 2;
      songsAddedInt += 1;
    }
    if (printMsgToChannel) {
      const ps = servers[message.guild.id].prefix;
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
        message.channel.send(`*link added to ${typeString} keys list. (use \`${ps}d ${args[1]}\` to play)*`);
      } else if (songsAddedInt > 1) {
        await new Promise(res => setTimeout(res, 1000));
        gsUpdateOverwrite(-1, songsAddedInt, sheetName, xdb.dsInt);
        message.channel.send('*' + songsAddedInt + " songs added to the keys list. (see '" + ps + databaseType + "keys')*");
      }
    }
  });
}

/**
 * Deletes an item from the database.
 * @param message the message that triggered the bot
 * @param {string} keyName the key to delete
 * @param sheetName the name of the sheet to delete from
 * @param sendMsgToChannel whether to send a response to the channel when looking for track keys
 */
async function runDeleteItemCommand (message, keyName, sheetName, sendMsgToChannel) {
  if (keyName) {
    await gsrun('A', 'B', sheetName).then(async (xdb) => {
      let couldNotFindKey = true;
      for (let i = 0; i < xdb.line.length; i++) {
        const itemToCheck = xdb.line[i];
        if (itemToCheck.toLowerCase() === keyName.toLowerCase()) {
          i += 1;
          couldNotFindKey = false;
          await gsUpdateOverwrite(-1, -1, sheetName, xdb.dsInt);
          await deleteRows(sheetName, i);
          if (sendMsgToChannel) {
            message.channel.send('deleted \'' + itemToCheck + '\' from ' +
              (sheetName.substring(0, 1) === 'p' ? 'your' : 'the server\'s') + ' keys');
          }
        }
      }
      if (couldNotFindKey && sendMsgToChannel) {
        const foundStrings = runSearchCommand(keyName, xdb.congratsDatabase).ss;
        if (foundStrings && foundStrings.length > 0 && keyName.length > 1) {
          message.channel.send("Could not find '" + keyName + "'\n*Did you mean: " + foundStrings + '*');
        } else {
          let dbType = "the server's";
          if (message.content.substr(1, 1).toLowerCase() === 'm') {
            dbType = 'your';
          }
          message.channel.send("*could not find '" + keyName + "' in " + dbType + ' database*');
        }
      }
    });
  } else {
    if (sendMsgToChannel) {
      message.channel.send('This command deletes keys from the keys-list. You need to specify the key to delete. (i.e. delete [link])');
    }
  }
}

/**
 * Gets the server prefix from the database and updates the server.prefix field.
 * If there is no prefix then the default is added to the database.
 * @param server The server.
 * @param mgid The guild id, used to get the prefix.
 * @return {Promise<void>}
 */
async function updateServerPrefix (server, mgid) {
  try {
    const xdb = await gsrun('A', 'B', 'prefixes');
    server.prefix = xdb.congratsDatabase.get(mgid);
    if (!server.prefix) {
      server.prefix = '.';
      try {
        gsUpdateAdd(mgid, '.', 'A', 'B', 'prefixes', xdb.dsInt);
      } catch (e) {console.log(e);}
    }
  } catch (e) {
    console.log(e);
    server.prefix = '.';
    gsUpdateAdd(mgid, '.', 'A', 'B', 'prefixes', 1);
  }
}

/**
 * Looks for an exact match of a given link within a given database.
 * @param message The message metadata.
 * @param sheetName The sheet name to use for the lookup.
 * @param link The link to lookup. Defaults to server
 * @param server The server metadata.
 * @returns {Boolean} If the request was a valid link.
 */
async function runLookupLink (message, sheetName, link, server) {
  if (!(verifyUrl(link) || verifyPlaylist(link))) return false;
  const xdb = await getXdb(server, sheetName);
  for (let [key, value] of xdb.congratsDatabase) {
    if (value === link) {
      message.channel.send(`Found it! key name is: **${key}**`);
      return true;
    }
  }
  if (sheetName[0] === 'p') message.channel.send(`could not find any keys matching the given link`);
  else runLookupLink(message, `p${message.member.id}`, link, server);
  return true;
}

/**
 * Searches the xdb for the provided string. Returns a JSON of a potential value and a guaranteed message.
 * If provided a value it will be in the format of a JSON with fields ss and ssi.
 * ss represents the search strings as CSVs and ssi would be the number of values within the ss.
 * NOTICE: Saves the keys of the sheetName referenced to the server object. This will have to be manually cleared later.
 * @param message
 * @param sheetName
 * @param providedString
 * @param server
 * @return {Promise<{valueObj: {ss: string, ssi: number}, link, message: string}|{message: string}|*|undefined>}
 */
async function searchForSingleKey (message, sheetName, providedString, server) {
  const xdb = await getXdb(server, sheetName, true);
  const so = runSearchCommand(providedString, xdb.congratsDatabase);
  if (so.ssi) {
    let link;
    if (so.ssi === 1) link = xdb.congratsDatabase.get(so.ss);
    return {
      valueObj: so,
      link,
      message: `${(sheetName[0] === 'p' ? 'Personal' : 'Server')} keys found: ${so.ss} ${(link ? `\n${link}` : '')}`
    };
  } else if (sheetName[0] !== 'p') {
    return searchForSingleKey(message, `p${message.member.id}`, providedString, server);
  } else if (providedString.length < 2) {
    return {
      message: 'Did not find any keys that start with the given letter.'
    };
  } else {
    return {
      message: 'Did not find any keys that contain \'' + providedString + '\''
    };
  }
}

/**
 * A search command that searches both the server and personal database for the string.
 * @param message The message that triggered the bot.
 * @param server The server.
 * @param sheetName The guild id.
 * @param providedString The string to search for. If given a key-name then can it can contain multiple values separated by commas or spaces.
 */
async function runUniversalSearchCommand (message, server, sheetName, providedString) {
  if (!providedString) return message.channel.send('must provide a link or word');
  const words = providedString.split(/, | |,/);
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
      finalString = 'did not find any exact key matches, ' +
        'try a single search word (instead of multiple) for a more refined search within the keys lists';
    }
    message.channel.send(finalString);
  }
  if (botInVC(!message)) server.userKeys.clear();
}

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

module.exports = {
  runAddCommand, runDeleteItemCommand, updateServerPrefix, runUniversalSearchCommand, getXdb,
  sendListSize
};
