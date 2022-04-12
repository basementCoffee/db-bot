const {dispatcherMap} = require('../../../utils/process/constants');

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

module.exports = {runStopPlayingCommand}