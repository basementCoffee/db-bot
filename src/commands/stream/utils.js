const {botID} = require('../../utils/process/constants');
const {pauseComputation, playComputation, botInVC, disconnectConnection} = require('../../utils/utils');
const {createEmbed} = require('../../utils/embed');
const {getVoiceConnection} = require('@discordjs/voice');

/**
 * A system to manage votes for various bot actions. Used for DJ mode.
 * @param message THe message metadata
 * @param mgid The message guild id
 * @param commandName {string} The action for which the voting is for
 * @param voter The member that is doing the voting
 * @param votes {Array} An array representing the ids of the members who voted for the action
 * @param server The server to use.
 * @returns {Boolean} If there are enough votes to perform the desired action.
 */
function voteSystem(message, mgid, commandName, voter, votes, server) {
  if (server.voteAdmin) {
    const vcMemMembersId = message.guild.voice.channel.members.map((x) => x.id);
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
 * @param server The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
 * @returns {boolean} if successful
 */
function pauseCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  if (actionUser.voice && botInVC(message) && server.audio.isVoiceChannelMember(actionUser)) {
    if (server.dictator && actionUser.id !== server.dictator.id) {
      return message.channel.send('only the dictator can pause');
    }
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        if (voteSystem(message, message.guild.id, 'pause', actionUser, server.votePlayPauseMembersId, server)) {
          noPrintMsg = true;
        } else return false;
      }
    }
    pauseComputation(server);
    if (noPrintMsg) return true;
    if (server.followUpMessage) {
      server.followUpMessage.delete();
      server.followUpMessage = undefined;
    }
    message.channel.send('*paused*');
    return true;
  } else if (!noErrorMsg) {
    message.channel.send('nothing is playing right now');
    return false;
  }
}

/**
 * Plays the now playing if paused.
 * @param message The message content metadata
 * @param actionUser The member that is performing the action
 * @param server The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
 * @returns {boolean}
 */
function playCommandUtil(message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  if (actionUser.voice && botInVC(message) && server.audio.isVoiceChannelMember(actionUser)) {
    if (server.dictator && actionUser.id !== server.dictator.id) {
      return message.channel.send('only the dictator can play');
    }
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        if (voteSystem(message, message.guild.id, 'play', actionUser, server.votePlayPauseMembersId, server)) {
          noPrintMsg = true;
        } else return false;
      }
    }
    playComputation(server);
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

/**
 * Stops playing in the given voice channel and leaves.
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 * @param stayInVC Whether to stay in the voice channel
 * @param server The server playback metadata
 * @param message {any?} The message metadata, used in the case of verifying a dj or dictator
 * @param actionUser {any?} The member requesting to stop playing, used in the case of verifying a dj or dictator
 * @returns {void}
 */
function stopPlayingUtil(mgid, voiceChannel, stayInVC, server, message, actionUser) {
  if (!voiceChannel) return;
  if (server.dictator && actionUser && actionUser.id !== server.dictator.id) {
    return message.channel.send('only the dictator can perform this action');
  }
  if (server.voteAdmin.length > 0 && actionUser &&
    !server.voteAdmin.map((x) => x.id).includes(actionUser.id) && server.queue.length > 0) {
    return message.channel.send('*only the DJ can end the session*');
  }
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  const lastPlayed = server.queue[0] || server.queueHistory.slice(-1)[0];
  if (voiceChannel && !stayInVC) {
    setTimeout(() => {
      disconnectConnection(server, getVoiceConnection(mgid));
    }, 600);
  } else {
    if (server.currentEmbed) {
      createEmbed(lastPlayed.url, lastPlayed.infos).then((e) => {
        e.embed.addFields({
          inline: true,
          name: 'Queue',
          value: 'empty',
        });
        server.currentEmbed.edit({embeds: [e.embed]});
        server.collector?.stop();
      });
    }
    pauseComputation(server);
  }
}

module.exports = {voteSystem, pauseCommandUtil, playCommandUtil, stopPlayingUtil};
