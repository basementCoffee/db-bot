const {pauseComputation, playComputation} = require('../../utils/utils');
const {voteSystem} = require('./dj');
const {dispatcherMap} = require('../../utils/process/constants');

/**
 * Stops playing in the given voice channel and leaves.
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 * @param stayInVC Whether to stay in the voice channel
 * @param server The server playback metadata
 * @param message Optional - The message metadata, used in the case of verifying a dj or dictator
 * @param actionUser Optional - The member requesting to stop playing, used in the case of verifying a dj or dictator
 */
function runStopPlayingCommand (mgid, voiceChannel, stayInVC, server, message, actionUser) {
  if (!voiceChannel) return;
  if (server.dictator && actionUser && actionUser.id !== server.dictator.id)
    return message.channel.send('only the dictator can perform this action');
  if (server.voteAdmin.length > 0 && actionUser &&
    !server.voteAdmin.map(x => x.id).includes(actionUser.id) && server.queue.length > 0) {
    return message.channel.send('*only the DJ can end the session*');
  }
  dispatcherMap[voiceChannel.id]?.pause();
  if (server.followUpMessage) {
    server.followUpMessage.delete();
    server.followUpMessage = undefined;
  }
  if (voiceChannel && !stayInVC) {
    setTimeout(() => {
      voiceChannel.leave();
    }, 600);
  } else {
    if (server.currentEmbed?.reactions) {
      server.collector.stop();
    }
    dispatcherMap[voiceChannel.id] = undefined;
    // if (whatspMap[voiceChannel.id] !== 'https://www.youtube.com/watch?v=oyFQVZ2h0V8')
    //   sendLinkAsEmbed(message, server.queue[0], voiceChannel, server, false).then();
  }
}

/**
 * Pauses the now playing, if playing.
 * @param message The message content metadata
 * @param actionUser The member that is performing the action
 * @param server The server playback metadata
 * @param noErrorMsg Optional - If to avoid an error message if nothing is playing
 * @param force Optional - Skips the voting system if DJ mode is on
 * @param noPrintMsg Optional - Whether to print a message to the channel when not in DJ mode
 */

function runPauseCommand (message, actionUser, server, noErrorMsg, force, noPrintMsg) {
  if (actionUser.voice && message.guild.voice?.channel && dispatcherMap[actionUser.voice.channel.id]) {
    if (server.dictator && actionUser.id !== server.dictator.id)
      return message.channel.send('only the dictator can pause');
    if (server.voteAdmin.length > 0) {
      if (force) server.votePlayPauseMembersId = [];
      else {
        if (voteSystem(message, message.guild.id, 'pause', actionUser, server.votePlayPauseMembersId, server))
          noPrintMsg = true;
        else return;
      }
    }
    pauseComputation(actionUser.voice.channel);
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


module.exports = {runStopPlayingCommand, runPauseCommand, runPlayCommand}