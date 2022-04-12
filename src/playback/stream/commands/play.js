const {dispatcherMap} = require('../../../utils/process/constants');
const {voteSystem} = require('./dj');
const {playComputation} = require('../../../utils/utils');

/**
 * Plays the now playing if paused.
 * @param message The message content metadata
 * @param actionUser The member that is performing the action
 * @param server The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
 */
function runPlayCommand (message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  if (actionUser.voice && message.guild.voice?.channel && dispatcherMap[actionUser.voice.channel.id]) {
    if (server.dictator && actionUser.id !== server.dictator.id)
      return message.channel.send('only the dictator can play');
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        if (voteSystem(message, message.guild.id, 'play', actionUser, server.votePlayPauseMembersId, server))
          noPrintMsg = true;
        else return false;
      }
    }
    playComputation(actionUser.voice.channel);
    if (noPrintMsg) return true;
    if (server.followUpMessage) {
      server.followUpMessage.delete();
      server.followUpMessage = undefined;
    }
    message.channel.send('*playing*');
    return true;
  } else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    return false;
  }
}

module.exports = {runPlayCommand}