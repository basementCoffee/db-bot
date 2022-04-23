const {gsrun, gsUpdateAdd, gsUpdateOverwrite} = require('./api/api');

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
      if (args[z].includes('.') || args[z].includes(',' || args[z].includes('='))) {
        message.channel.send(`did not add **${args[z]}** because names cannot include the symbols [ . , = ]`);
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
        gsUpdateOverwrite(-1, songsAddedInt, sheetName, xdb.dsInt);
        message.channel.send('*' + songsAddedInt + " songs added to the keys list. (see '" + ps + databaseType + "keys')*");
      }
    }
  });
}


module.exports = {addToDatabase};
