const {servers} = require('../utils/process/constants');
const {getXdb} = require('../database/frontend');
const {runSearchCommand} = require('./playback-commands/search');
const {sendLinkAsEmbed} = require('./playback');

/**
 * Runs the what's playing command. Can also look up database values if args[2] is present.
 * @param {*} message the message that activated the bot
 * @param {*} voiceChannel The active voice channel
 * @param keyName Optional - A key to search for to retrieve a link
 * @param {*} sheetName Required if dbKey is given - provides the name of the sheet reference.
 * @param sheetLetter Required if dbKey is given - a letter enum representing the type of sheet being referenced
 * (server or personal)
 */
async function runWhatsPCommand (message, voiceChannel, keyName, sheetName, sheetLetter) {
  const server = servers[message.guild.id];
  if (keyName && sheetName) {
    const xdb = await getXdb(server, sheetName, !!voiceChannel);
    let link = xdb.referenceDatabase.get(keyName.toUpperCase());
    // update link value here
    if (!link) {
      let sObj = runSearchCommand(keyName, xdb.congratsDatabase);
      if (sObj.ssi === 1 && sObj.ss)
        link = `Assuming **${sObj.ss}**\n${xdb.referenceDatabase.get(sObj.ss.toUpperCase())}`;
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

module.exports = {runWhatsPCommand}