const {getXdb2} = require('./database/retrieval');
const {runSearchCommand} = require('./database/search');
const {sendLinkAsEmbed} = require('./stream/stream');

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param server The server metadata.
 * @param {*} message the message that activated the bot
 * @param {*} voiceChannel The active voice channel
 * @param keyName Optional - A key to search for to retrieve a link
 * @param {*} sheetName Required if dbKey is given - provides the name of the sheet reference.
 * @param sheetLetter Required if dbKey is given - a letter enum representing the type of sheet being referenced
 * (server or personal)
 */
async function runWhatsPCommand (server, message, voiceChannel, keyName, sheetName, sheetLetter) {
  if (keyName && sheetName) {
    const xdb = await getXdb2(server, sheetName, !!voiceChannel);
    let link = xdb.globalKeys.get(keyName.toUpperCase()).link;
    // update link value here
    if (!link) {
      let sObj = runSearchCommand(keyName, xdb.globalKeys);
      if (sObj.ssi === 1 && sObj.ss)
        link = `Assuming **${sObj.ss}**\n${xdb.globalKeys.get(sObj.ss.toUpperCase())}`;
    }
    if (link) {
      return message.channel.send(link);
    } else {
      message.channel.send(`Could not find '${keyName}' in ${(sheetLetter === 'm' ? 'your' : 'the server\'s')} keys list.`);
      return sendLinkAsEmbed(message, server.queue[0], voiceChannel, server, true);
    }
  } else if (!voiceChannel) {
    return message.channel.send('must be in a voice channel');
  } else if (server.queue[0]) {
    return sendLinkAsEmbed(message, server.queue[0], voiceChannel, server, true);
  } else {
    return message.channel.send('nothing is playing right now');
  }
}

module.exports = {runWhatsPCommand};