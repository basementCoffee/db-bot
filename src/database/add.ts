/* eslint-disable camelcase */
import { gsrun, gsUpdateAdd, gsUpdateOverwrite, UserKeysData } from './api/api';
import { getXdb2 } from './retrieval';
import LocalServer from '../utils/lib/LocalServer';
import { Message } from 'discord.js';
import { serializeAndUpdate } from './utils';
import { logErrorCore } from '../utils/errorUtils';

/**
 * The command to add a key, value pair to a given database.
 * @param server The server metadata.
 * @param args The command arguments, ignores the first item
 * @param message The message that triggered the command
 * @param sheetName the name of the sheet to add to
 * @param printMsgToChannel whether to print response to channel
 */
function addToDatabase(
  server: LocalServer,
  args: string[],
  message: Message,
  sheetName: string,
  printMsgToChannel: boolean
) {
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
          await gsUpdateAdd(args[z], args[z + 1], 'A', 'B', sheetName);
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
        await new Promise((res) => setTimeout(res, 1000));
        gsUpdateOverwrite([xdb.dsInt + songsAddedInt], sheetName, undefined, xdb.dsInt);
        message.channel.send(
          '*' + songsAddedInt + " songs added to the keys list. (see '" + ps + databaseType + "keys')*"
        );
      }
    }
  });
}

/**
 * creates a new playlist if a new playlist-name is provided
 * @param server {LocalServer} The server object.
 * @param keysList {Array<string>} - the list of keys and links (each key should be followed by a link)
 * @param channel {any} The textchannel that is active.
 * @param sheetName {string} The db sheet name to use.
 * @param printMsgToChannel {boolean} Whether to print the response to the text channel.
 * @param playlistName {string} The name of the word/playlist
 * @param xdb {any?} The XDB.
 * @returns {Promise<void>}
 */
async function addToDatabase_P(
  server: LocalServer,
  keysList: Array<string>,
  channel: any,
  sheetName: string,
  printMsgToChannel: boolean,
  playlistName: string = 'general',
  xdb?: UserKeysData
): Promise<void> {
  let songsAddedInt = 0;
  let z = 0;
  // check duplicates, and initialize sheet for new servers
  if (!xdb) xdb = await getXdb2(server, sheetName, false);
  const playlist =
    xdb.playlists.get(playlistName.toUpperCase()) ||
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
  const status = await serializeAndUpdate(server, sheetName, playlistName, xdb);
  if (!status) {
    channel.send('there was an error while trying to add your key');
    logErrorCore(`error when attempting to update sheet ${sheetName}`);
    return;
  }
  if (printMsgToChannel) {
    const ps = server.prefix;
    if (songsAddedInt === 1) {
      channel.send(`*link added to your **${playlistName}** playlist. (use \`${ps}d ${keysList[0]}\` to play)*`);
    } else if (songsAddedInt > 1) {
      channel.send('*' + songsAddedInt + " songs added to the keys list. (see '" + ps + "keys')*");
    }
  }
}

export { addToDatabase, addToDatabase_P };
