/* eslint-disable camelcase */
import { Message } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { gsrun, gsUpdateOverwrite, deleteRows } from './api/api';
import { runSearchCommand } from '../commands/search';
import { getXdb2 } from './retrieval';
import { serializeAndUpdate } from './utils';
import { isPersonalSheet } from '../utils/utils';

/**
 * Deletes an item from the database.
 * @param message the message that triggered the bot
 * @param {string} keyName the key to delete
 * @param sheetName the name of the sheet to delete from
 * @param sendMsgToChannel whether to send a response to the channel when looking for track keys
 */
async function runDeleteCommand(message: Message, keyName: string, sheetName: string, sendMsgToChannel: boolean) {
  if (keyName) {
    await gsrun('A', 'B', sheetName).then(async (xdb: any) => {
      let couldNotFindKey = true;
      for (let i = 0; i < xdb.line.length; i++) {
        const itemToCheck = xdb.line[i];
        if (itemToCheck.toLowerCase() === keyName.toLowerCase()) {
          i += 1;
          couldNotFindKey = false;
          await gsUpdateOverwrite(-1, '-1', sheetName, xdb.dsInt);
          await deleteRows(sheetName, i);
          if (sendMsgToChannel) {
            message.channel.send(
              "deleted '" + itemToCheck + "' from " + (isPersonalSheet(sheetName) ? 'your' : "the server's") + ' keys'
            );
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
  } else if (sendMsgToChannel) {
    message.channel.send(
      'This command deletes keys from the keys-list. You need to specify the key to delete. (i.e. delete [link])'
    );
  }
}

/**
 * Deletes a key from the database.
 * @param {*} message the message that triggered the bot
 * @param {*} keyName the key to delete
 * @param {*} sheetName the name of the sheet to delete from
 * @param {*} server the server object
 */
async function runDeleteKeyCommand_P(message: any, keyName: any, sheetName: any, server: any) {
  if (await deleteKey(keyName, sheetName, server)) {
    message.channel.send(`*deleted ${keyName}*`);
  } else {
    message.channel.send(`*could not find **${keyName}** within the keys list*`);
  }
}

/**
 * Attempts to delete the key. Returns true if successful.
 * @param keyName {string}
 * @param sheetName {string}
 * @param server {LocalServer} The server object
 * @returns {Promise<boolean>} if the key was found
 */
async function deleteKey(keyName: string, sheetName: string, server: LocalServer) {
  const xdb = await getXdb2(server, sheetName, false);
  const keyObj = xdb.globalKeys.get(keyName.toUpperCase());
  if (!keyObj) return false;
  const playlistName = keyObj.playlistName;
  xdb.globalKeys.delete(keyName.toUpperCase());
  xdb.playlists.get(playlistName.toUpperCase())?.delete(keyName.toUpperCase());
  server.userKeys.get(sheetName)?.playlists.delete(keyName);
  await serializeAndUpdate(server, sheetName, playlistName, xdb);
  return true;
}

export { runDeleteCommand, runDeleteKeyCommand_P };
