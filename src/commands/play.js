const {playCommandUtil} = require('./stream/utils');

/**
 * Plays the now playing if paused.
 * @param message The message content metadata
 * @param actionUser The member that is performing the action
 * @param server The server playback metadata
 * @param noErrorMsg {boolean?} Optional - If to avoid an error message if nothing is playing
 * @param force {boolean?} Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg {boolean?} Optional - Whether to print a message to the channel when not in DJ mode
 * @returns boolean
 */
function runPlayCommand (message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  return playCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg);
}

module.exports = {runPlayCommand};