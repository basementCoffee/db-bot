import { VoiceState } from 'discord.js';
import processStats from '../utils/lib/ProcessStats';
import LocalServer from '../utils/lib/LocalServer';
import { bot, botID, whatspMap } from '../utils/lib/constants';
import { botInVcGuild, endStream } from '../utils/utils';
import { sessionEndEmbed } from '../utils/embed';
import { clearDJTimer } from '../commands/dj';

module.exports = async (oldState: VoiceState, newState: VoiceState) => {
  const server = processStats.getServer(oldState.guild.id.toString());
  if (processStats.isInactive) {
    if (server.collector) {
      server.collector.stop();
      server.collector = null;
    }
    return;
  }
  updateVoiceState(oldState, newState, server).then();
};

/**
 * Updates the bots voice state depending on the update occurring.
 * @param oldState The old voice-state update metadata.
 * @param newState The new voice-state update metadata.
 * @param server {LocalServer} The server metadata.
 */
async function updateVoiceState(oldState: VoiceState, newState: VoiceState, server: LocalServer) {
  if (!server) return;
  // if the bot is leaving
  if (oldState.member!.id === botID) {
    // if the bot joined then ignore
    if (newState.channel?.members.get(botID)) {
      server.audio.voiceChannelId = newState.channelId;
      return;
    }
    // clear timers first
    if (server.leaveVCTimeout) {
      clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = undefined;
    }
    clearDJTimer(server);
    // disconnect and delete the voice adapter
    processStats.disconnectConnection(server);
    bot.voice.adapters.get(oldState.guild.id)?.destroy();
    processStats.removeActiveStream(oldState.guild.id);
    await sessionEndEmbed(server, server.queue[0] || server.queueHistory.slice(-1)[0]);
    // end the stream (if applicable)
    if (server.streamData.stream) endStream(server);
    server.numSinceLastEmbed = 0;
    server.silence = false;
    server.verbose = false;
    server.loop = false;
    server.voteAdmin.length = 0;
    server.lockQueue = false;
    server.dictator = undefined;
    server.autoplay = false;
    server.userKeys.clear();
    server.queueHistory.length = 0;
    if (server.followUpMessage) {
      server.followUpMessage.delete();
      server.followUpMessage = undefined;
    }
    if (bot.voice.adapters.size < 1) {
      whatspMap.clear();
    }
  } else if (botInVcGuild(newState.guild.id)) {
    if ((oldState.channel?.members.filter((x) => !x.user.bot).size || 0) < 1) {
      let leaveVCInt = 1100;
      // if there is an active dispatch - timeout is 5 min
      if (server.audio.resource && !server.audio.resource.ended && server.queue.length > 0) {
        leaveVCInt = 420000;
      }
      // clear if timeout exists, set new timeout
      if (server.leaveVCTimeout) clearTimeout(server.leaveVCTimeout);
      server.leaveVCTimeout = setTimeout(() => {
        server.leaveVCTimeout = undefined;
        if ((oldState.channel?.members.filter((x) => !x.user.bot).size || 0) < 1) {
          processStats.disconnectConnection(server);
        }
      }, leaveVCInt);
    }
  } else if (server.seamless.function && !oldState.member?.user.bot) {
    if (server.seamless.timeout) {
      clearTimeout(server.seamless.timeout);
      server.seamless.timeout = undefined;
    }
    try {
      // @ts-ignore
      server.seamless.function(...server.seamless.args);
    } catch (e) {
      processStats.debug(e);
    }
    server.seamless.function = () => {};
    server.seamless.message?.delete();
    server.seamless.message = undefined;
  }
}
