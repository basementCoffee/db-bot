const {dispatcherMap, LEAVE_VC_TIMEOUT} = require('../utils/process/constants');
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
  let connection = server.connection;
  let vc = message.member?.voice?.channel;
  if (vc && (!botInVC(message) || !connection || (connection.channel.id !== vc.id))) {
    if (connection && dispatcherMap[connection.channel.id]) {
      pauseComputation(connection.channel);
      dispatcherMap[connection.channel.id] = undefined;
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
      server.connection = await vc.join();
      server.leaveVCTimeout = setTimeout(() => server.connection.disconnect(), LEAVE_VC_TIMEOUT);
      return true;
    } catch (e) {
      catchVCJoinError(e, message.channel);
    }
  }
  return false;
}

module.exports = {joinVoiceChannelSafe};
