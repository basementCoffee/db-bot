const {LEAVE_VC_TIMEOUT} = require('../utils/process/constants');
const {sessionEndEmbed} = require('../utils/embed');
const {resetSession, pauseComputation, botInVC, catchVCJoinError} = require('../utils/utils');
const {disconnectConnection} = require('./stream/utils');

/**
 * Joins the voice channel of the message member (if applicable).
 * If there is an error upon join attempt then it caught and forwarded to the user.
 * @param message The message metadata.
 * @param server The server object.
 * @returns {Promise<boolean>} True upon successful voice channel join.
 */
async function joinVoiceChannelSafe(message, server) {
  const connection = server.audio.connection;
  const vc = message.member?.voice?.channel;
  if (vc && (!botInVC(message) || !connection || (server.audio.voiceChannelId !== vc.id))) {
    if (connection) {
      pauseComputation(server, connection.channel);
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
      server.leaveVCTimeout = setTimeout(() => disconnectConnection(server, server.connection), LEAVE_VC_TIMEOUT);
      return true;
    } catch (e) {
      catchVCJoinError(e, message.channel);
    }
  }
  return false;
}

module.exports = {joinVoiceChannelSafe};

