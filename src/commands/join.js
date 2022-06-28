const {LEAVE_VC_TIMEOUT} = require('../utils/process/constants');
const {sessionEndEmbed} = require('../utils/embed');
const {resetSession, pauseComputation, botInVC, catchVCJoinError} = require('../utils/utils');

/**
 * Joins the voice channel of the message member (if applicable).
 * If there is an error upon join attempt then it caught and forwarded to the user.
 * @param message The message metadata.
 * @param server The server object.
 * @return {Promise<boolean>} True upon successful voice channel join.
 */
async function joinVoiceChannelSafe (message, server) {
  let connection = server.audio.connection;
  let vc = message.member?.voice?.channel;
  if (vc && (!botInVC(message) || !connection || (server.audio.voiceChannelId !== vc.id))) {
    if (connection) {
      pauseComputation(connection.channel);
      server.audio.reset();
    }
    if (server.leaveVCTimeout) {
      clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = null;
    }
    if (server.currentEmbed) {
      await sessionEndEmbed(server, server.queue[0] || server.queueHistory[server.queueHistory.length - 1]);
      await server.collector?.stop();
    }
    resetSession(server);
    try {
      server.audio.joinVoiceChannel(message.guild, vc.id);
      server.leaveVCTimeout = setTimeout(() => server.connection.disconnect(), LEAVE_VC_TIMEOUT);
      return true;
    } catch (e) {
      catchVCJoinError(e, message.channel);
    }
  }
  return false;
}

module.exports = {joinVoiceChannelSafe};

