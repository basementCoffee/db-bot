import { Message } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { LEAVE_VC_TIMEOUT } from '../utils/lib/constants';

const { sessionEndEmbed } = require('../utils/embed');
const { resetSession, botInVC, catchVCJoinError } = require('../utils/utils');
const processStats = require('../utils/lib/ProcessStats');
const { pauseComputation } = require('./stream/utils');
/**
 * Joins the voice channel of the message member (if applicable).
 * If there is an error upon join attempt then it caught and forwarded to the user.
 * @param message The message metadata.
 * @param server {LocalServer} The server object.
 * @returns {Promise<boolean>} True upon successful voice channel join.
 */
async function joinVoiceChannelSafe(message: Message, server: LocalServer): Promise<boolean> {
  const connection = server.audio.connection;
  const vc = message.member?.voice?.channel;
  if (vc && (!botInVC(message) || !connection || server.audio.voiceChannelId !== vc.id)) {
    if (server.currentEmbed) {
      if (server.currentEmbed.channel.id !== message.channel.id) {
        await server.currentEmbed.channel.send('`session ended: requested in another channel`');
      }
      await sessionEndEmbed(server, server.queue[0] || server.queueHistory[server.queueHistory.length - 1]);
    }
    if (connection) {
      pauseComputation(server);
      server.audio.reset();
      await new Promise((res) => setTimeout(res, 500));
    }
    if (server.leaveVCTimeout) {
      clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = null;
    }
    resetSession(server);
    try {
      server.audio.joinVoiceChannel(message.guild!, vc.id);
      server.leaveVCTimeout = setTimeout(() => processStats.disconnectConnection(server), LEAVE_VC_TIMEOUT);
      return true;
    } catch (e) {
      catchVCJoinError(e, message.channel);
    }
  } else {
    message.channel.send('*in voice channel*');
  }
  return false;
}

export { joinVoiceChannelSafe };
