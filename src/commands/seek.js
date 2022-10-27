const { linkValidator, convertSeekFormatToSec, getSheetName } = require('../utils/utils');
const { playLinkNow } = require('./playLink');

/**
 * Plays the link at a specific timestamp.
 * @param message
 * @param server
 * @param args
 * @param mgid
 * @return {Promise<void>}
 */
async function runSeekCommand(message, server, args, mgid) {
  const SEEK_ERR_MSG = '*provide a seek timestamp (ex: seek 5m32s)*';
  if (args[1]) {
    if (args[2]) {
      // assume exactly two arguments is provided
      const validLink = linkValidator(args[1]);
      const numSeconds = convertSeekFormatToSec(args[2]);
      if (validLink && numSeconds) {
        server.numSinceLastEmbed -= 2;
        args.splice(2, args.length - 1);
        await playLinkNow(message, args, mgid, server, getSheetName(message.member.id), numSeconds, true);
        if (numSeconds > 1200) message.channel.send('*seeking...*');
        return;
      }
    }
    else {
      // provided one argument
      if (!server.queue[0]) {
        return message.channel.send(`*provide a seek link and timestamp (ex: ${args[0]} [link] 5m32s)*`);
      }
      // continues if only one argument was provided
      const numSeconds = convertSeekFormatToSec(args[1]);
      if (numSeconds) {
        server.numSinceLastEmbed -= 2;
        args.splice(1, 1);
        args.push(server.queue[0].url);
        await playLinkNow(message, args, mgid, server, getSheetName(message.member.id), numSeconds, false);
        if (numSeconds > 1200) message.channel.send('*seeking...*');
        return;
      }
    }
  }
  // if successful then execution should not reach here
  message.channel.send(SEEK_ERR_MSG);
}

module.exports = { runSeekCommand };
