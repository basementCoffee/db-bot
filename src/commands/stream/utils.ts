import LocalServer from "../../utils/lib/LocalServer";
import EmbedBuilderLocal from "../../utils/lib/EmbedBuilderLocal";
import {GuildMember, Message, VoiceBasedChannel} from "discord.js";

import { botID } from '../../utils/lib/constants';
import { botInVC } from '../../utils/utils';
import { createEmbed, updateActiveEmbed } from '../../utils/embed';
import processStats from '../../utils/lib/ProcessStats';

/**
 * A system to manage votes for various bot actions. Used for DJ mode.
 * @param message THe message metadata
 * @param mgid The message guild id
 * @param commandName {string} The action for which the voting is for
 * @param voter The member that is doing the voting
 * @param votes {Array} An array representing the ids of the members who voted for the action
 * @param server {LocalServer} The server to use.
 * @returns {Boolean} If there are enough votes to perform the desired action.
 */
function voteSystem(message: Message, mgid: string, commandName: string, voter: any, votes: any, server: LocalServer) {
  if (server.voteAdmin) {
    const vcMemMembersId = message.guild!.members.me!.voice.channel?.members.map((x) => x.id);
    if (vcMemMembersId && vcMemMembersId.includes(voter.id) && vcMemMembersId.includes(botID)) {
      server.numSinceLastEmbed += 2;
      const votesNeeded = Math.floor((vcMemMembersId.length - 1) / 2) + 1;
      let votesNow = votes.length;
      if (votes.includes(voter.id)) {
        message.channel.send('*' + (voter.nickname ? voter.nickname : voter.user.username) +
          ', you already voted to ' + commandName + ' this track* (**votes needed: ' +
          (votesNeeded - votesNow) + '**)');
        return false;
      }
      votes.push(voter.id);
      votesNow++;
      message.channel.send('*' + (voter.nickname ? voter.nickname : voter.user.username) + ' voted to ' +
        commandName + ' (' + votesNow + '/' + votesNeeded + ')*').then((sentMsg) => setTimeout(() => sentMsg.delete(), 15000));
      if (votesNow >= votesNeeded) {
        message.channel.send(`***${commandName.toUpperCase()}*** *- with ${votesNow} vote${(votesNow > 1) ? 's' : ''}*`);
        for (let x = 0; x < votesNow; x++) {
          votes.pop();
        }
        return true;
      }
    }
    return false;
  }
  return true;
}

/**
 * Pauses the now playing, if playing.
 * @param message The message content metadata
 * @param actionUser The member that is performing the action
 * @param server {LocalServer} The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to NOT print a message to the channel [DJ mode will set this to true]
 * @returns {boolean} if successful
 */
function pauseCommandUtil(message: Message, actionUser: GuildMember, server: LocalServer, noErrorMsg = false, force = false, noPrintMsg = false) {
  if (actionUser.voice && botInVC(message) && server.audio.isVoiceChannelMember(actionUser)) {
    if (server.dictator && actionUser.id !== server.dictator.id) {
      message.channel.send('only the dictator can pause');
      return false;
    }
    if (server.voteAdmin.length > 0) {
      if (force) {
        server.votePlayPauseMembersId = [];
      }
      else if (voteSystem(message, message.guild!.id, 'pause', actionUser, server.votePlayPauseMembersId, server)) {
        noPrintMsg = true;
      }
      else {
        return false;
      }
    }
    pauseComputation(server);
    if (!noPrintMsg) {
      // if we are printing a message then delete previous playback status
      if (server.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
      message.channel.send('*paused*');
    }
    return true;
  }
  else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    server.numSinceLastEmbed++;
    return false;
  }
}

/**
 * Plays the now playing if paused.
 * @param message The message content metadata
 * @param actionUser The member that is performing the action
 * @param server {LocalServer} The server playback metadata
 * @param noErrorMsg {*?} Optional - If to avoid an error message if nothing is playing
 * @param force {*?} Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg {*?} Optional - Whether to NOT print a message to the channel [DJ mode will set this to true]
 * @returns {boolean} if the request was successful
 */
function playCommandUtil(message: Message, actionUser: GuildMember, server: LocalServer, noErrorMsg = false, force = false, noPrintMsg = false) {
  if (actionUser.voice && botInVC(message) && server.audio.isVoiceChannelMember(actionUser)) {
    if (server.dictator && actionUser.id !== server.dictator.id) {
      message.channel.send('only the dictator can play');
      return false;
    }
    if (server.voteAdmin.length > 0) {
      if (force) {
        server.votePlayPauseMembersId = [];
      }
      else if (voteSystem(message, message.guild!.id, 'play', actionUser, server.votePlayPauseMembersId, server)) {
        noPrintMsg = true;
      }
      else {
        return false;
      }
    }
    playComputation(server);
    if (!noPrintMsg) {
      // if we are printing a message then delete previous playback status
      if (server.followUpMessage) {
        server.followUpMessage.delete();
        server.followUpMessage = undefined;
      }
      message.channel.send('*playing*');
    }
    return true;
  }
  else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    server.numSinceLastEmbed++;
    return false;
  }
}

/**
 * Stops playing in the given voice channel and leaves. This is intended for when a user attempts to alter a session.
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 * @param stayInVC Whether to stay in the voice channel
 * @param server {LocalServer} The server playback metadata
 * @param message {any} The message metadata, used in the case of verifying a dj or dictator
 * @param actionUser {any?} The member requesting to stop playing, used in the case of verifying a dj or dictator
 * @returns {undefined}
 */
function stopPlayingUtil(mgid: string, voiceChannel: VoiceBasedChannel | null | undefined, stayInVC: boolean, server: LocalServer, message?: Message, actionUserId?: string) {
  if (!voiceChannel) return;
  if (server.dictator && actionUserId && actionUserId !== server.dictator.id) {
    return message?.channel.send('only the dictator can perform this action');
  }
  if (server.voteAdmin.length > 0 && actionUserId &&
    !server.voteAdmin.map((x: any) => x.id).includes(actionUserId) && server.queue.length > 0) {
    return message?.channel.send('*only the DJ can end the session*');
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  const lastPlayed = server.queue[0] || server.queueHistory.slice(-1)[0];
  if (voiceChannel && !stayInVC) {
    setTimeout(() => {
      processStats.disconnectConnection(server);
      processStats.debug(`[DISCONN] ${stopPlayingUtil.name}`);
    }, 600);
  }
  else {
    if (server.currentEmbed) {
      createEmbed(lastPlayed.url, lastPlayed.infos).then((e: {embed: EmbedBuilderLocal, infos: any, timeMS: number}) => {
        e.embed.addFields({
          inline: true,
          name: 'Queue',
          value: 'empty',
        });
        e.embed.edit(server.currentEmbed!).then();
      });
    }
    endAudioDuringSession(server);
  }
}

/**
 * Pause a dispatcher. Force may have unexpected behaviour with the stream if used excessively.
 * @param server {LocalServer} The server metadata.
 * @param force Ignores the status of the dispatcher.
 */
function pauseComputation(server: LocalServer, force = false) {
  // placed 'removeActiveStream' before checks for resiliency
  processStats.removeActiveStream(server.guildId);
  if (!server.audio.player) return;
  if (server.audio.status || force) {
    server.audio.player.pause();
    server.audio.status = false;
  }
}

/**
 * Plays a dispatcher. Force may have unexpected behaviour with the stream if used excessively.
 * @param server The server metadata.
 * @param force Ignores the status of the dispatcher.
 */
function playComputation(server: LocalServer, force = false) {
  if (!server.audio.player) return;
  if (!server.audio.status || force) {
    server.audio.player.unpause();
    server.audio.status = true;
    processStats.addActiveStream(server.guildId);
  }
}


/**
 * Performs changes when there is (or should be) no now-playing during an active session.
 * @param server {LocalServer} The server object.
 */
function endAudioDuringSession(server: LocalServer) {
  updateActiveEmbed(server);
  // active stream should be removed within pauseComputation
  pauseComputation(server);
}

export {
  voteSystem, pauseCommandUtil, playCommandUtil, stopPlayingUtil, endAudioDuringSession, pauseComputation,
  playComputation,
};
