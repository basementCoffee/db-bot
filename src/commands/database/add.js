const {gsrun, gsUpdateAdd, gsUpdateOverwrite} = require('./api/api');
const {getXdb2} = require('./retrieval');
const {serializeAndUpdate} = require('./utils');

/**
 * The command to add a key, value pair to a given database.
 * @param server The server metadata.
 * @param {*} args The command arguments, ignores the first item
 * @param {*} message The message that triggered the command
 * @param {string} sheetName the name of the sheet to add to
 * @param printMsgToChannel whether to print response to channel
 */
function addToDatabase (server, args, message, sheetName, printMsgToChannel) {
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
      const ps = server.prefix;
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
        gsUpdateOverwrite([xdb.dsInt + songsAddedInt], sheetName, xdb.dsInt);
        message.channel.send('*' + songsAddedInt + " songs added to the keys list. (see '" + ps + databaseType + "keys')*");
      }
    }
  });
}

/**
 * creates a new playlist if a new playlist-name is provided
 * @param server {any}
 * @param keysList {Array<string>} - the list of keys and links (each key should be followed by a link)
 * @param channel {any}
 * @param sheetName {string}
 * @param printMsgToChannel {boolean}
 * @param playlistName {string}
 * @param xdb {any?} The XDB.
 * @return {Promise<void>}
 */
async function addToDatabase_P (server, keysList, channel, sheetName, printMsgToChannel, playlistName = 'general', xdb) {
  let songsAddedInt = 0;
  let z = 0;
  // check duplicates, and initialize sheet for new servers
  if (!xdb) xdb = await getXdb2(server, sheetName, false);
  let playlist = xdb.playlists.get(playlistName.toUpperCase()) ||
    (() => {
      const tempMap = new Map();
      xdb.playlists.set(playlistName.toUpperCase(), tempMap);
      xdb.playlistArray.push(playlistName);
      gsUpdateOverwrite([xdb.playlistArray.length + 1], sheetName);
      return tempMap;
    })();
  while (keysList[z] && keysList[z + 1]) {
    let linkZ = keysList[z + 1];
    if (linkZ.substring(linkZ.length - 1) === ',') {
      linkZ = linkZ.substring(0, linkZ.length - 1);
    }
    if (keysList[z].includes('.') || keysList[z].includes(',')) {
      channel.send("did not add '" + keysList[z] + "', names cannot include '.' or ','");
    } else {
      let alreadyExists = false;
      const existingKeyObj = xdb.globalKeys.get(keysList[z].toUpperCase());
      const existingPlaylist = xdb.playlists.get(keysList[z].toUpperCase());
      if (existingKeyObj) {
        channel.send(`*'${existingKeyObj.name}' is already saved as a key*`);
        alreadyExists = true;
        break;
      } else if (existingPlaylist) {
        channel.send(`*'${keysList[z]}' cannot be used because it is a playlist*`);
        alreadyExists = true;
        break;
      }
      if (!alreadyExists) {
        playlist.set(keysList[z].toUpperCase(), {
          name: keysList[z],
          link: keysList[z + 1],
          timeStamp: ''
        });
        songsAddedInt += 1;
      }
    }
    z = z + 2;
  }
  await serializeAndUpdate(server, sheetName, playlistName, xdb);
  if (printMsgToChannel) {
    const ps = server.prefix;
    if (songsAddedInt === 1) {
      channel.send(`*link added to your **${playlistName}** playlist. (use \`${ps}d ${keysList[0]}\` to play)*`);
    } else if (songsAddedInt > 1) {
      await new Promise(res => setTimeout(res, 1000));
      gsUpdateOverwrite(10, sheetName, xdb.dsInt);
      channel.send('*' + songsAddedInt + " songs added to the keys list. (see '" + ps + "keys')*");
    }
  }
}

module.exports = {addToDatabase, addToDatabase_P};
