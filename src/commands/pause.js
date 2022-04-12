const {pauseCommandUtil} = require('./stream/utils');

/**
 * Pauses the now playing, if playing.
 * @param message The message content metadata
 * @param actionUser The member that is performing the action
 * @param server The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
 * @returns boolean
 */
function runPauseCommand (message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  return pauseCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg);
}

module.exports = {runPauseCommand}