const {runDatabasePlayCommand} = require('./databasePlayCommand');
const {runYoutubeSearch} = require('./stream/youtubeSearch');

/**
 * Determines what to play from a word, dependent on sheetName. The word is provided from args[1].
 * Uses the database if a sheetName is provided, else uses YouTube.
 * @param message The message metadata.
 * @param args The args pertaining the content.
 * @param sheetName Optional - The sheet to reference.
 * @param server The server data.
 * @param mgid The guild id.
 * @param playNow Whether to play now.
 */
function playFromWord (message, args, sheetName, server, mgid, playNow) {
  if (sheetName) {
    runDatabasePlayCommand(args, message, sheetName, playNow, false, server).then();
  } else {
    runYoutubeSearch(message, playNow, server, args.map(x => x).splice(1).join('')).then();
  }
}

module.exports = {playFromWord};
