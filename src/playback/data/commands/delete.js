const {gsrun, gsUpdateOverwrite, deleteRows} = require('../utils/database/database');
const {runSearchCommand} = require('../utils/search');

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

module.exports = {runDeleteItemCommand}