/* eslint-disable camelcase */
const { gsrun, gsUpdateOverwrite, deleteRows } = require('./api/api');
const { runSearchCommand } = require('../commands/search');
const { getXdb2 } = require('./retrieval');
const { serializeAndUpdate } = require('./utils');
const { isPersonalSheet } = require('../utils/utils');

/**
 * Deletes an item from the database.
 * @param message the message that triggered the bot
 * @param {string} keyName the key to delete
 * @param sheetName the name of the sheet to delete from
 * @param sendMsgToChannel whether to send a response to the channel when looking for track keys
 */
async function runDeleteCommand(message, keyName, sheetName, sendMsgToChannel) {
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
              (isPersonalSheet(sheetName) ? 'your' : 'the server\'s') + ' keys');
          }
        }
      }
      if (couldNotFindKey && sendMsgToChannel) {
        const foundStrings = runSearchCommand(keyName, xdb.congratsDatabase).ss;
        if (foundStrings && foundStrings.length > 0 && keyName.length > 1) {
          message.channel.send('Could not find \'' + keyName + '\'\n*Did you mean: ' + foundStrings + '*');
        }
        else {
          let dbType = 'the server\'s';
          if (message.content.substr(1, 1).toLowerCase() === 'm') {
            dbType = 'your';
          }
          message.channel.send('*could not find \'' + keyName + '\' in ' + dbType + ' database*');
        }
      }
    });
  }
  else if (sendMsgToChannel) {
    message.channel.send('This command deletes keys from the keys-list. You need to specify the key to delete. (i.e. delete [link])');
  }
}

/**
 * Deletes a key from the database.
 * @param {*} message the message that triggered the bot
 * @param {*} keyName the key to delete
 * @param {*} sheetName the name of the sheet to delete from
 * @param {*} server the server object
 */
async function runDeleteKeyCommand_P(message, keyName, sheetName, server) {
  if (await deleteKey(keyName, sheetName, server)) {
    message.channel.send(`*deleted ${keyName}*`);
  }
  else {
    message.channel.send(`*could not find **${keyName}** within the keys list*`);
  }
}

/**
 * Attempts to delete the key. Returns true if successful.
 * @param keyName {string}
 * @param sheetName {string}
 * @param server The server object
 * @returns {Promise<boolean>} if the key was found
 */
async function deleteKey(keyName, sheetName, server) {
  const xdb = await getXdb2(server, sheetName);
  const keyObj = xdb.globalKeys.get(keyName.toUpperCase());
  if (!keyObj) return false;
  const playlistName = keyObj.playlistName;
  xdb.globalKeys.delete(keyName.toUpperCase());
  xdb.playlists.get(playlistName.toUpperCase()).delete(keyName.toUpperCase());
  server.userKeys.get(sheetName)?.playlists.delete(keyName);
  await serializeAndUpdate(server, sheetName, playlistName, xdb);
  return true;
}

module.exports = { runDeleteCommand, runDeleteKeyCommand_P };
