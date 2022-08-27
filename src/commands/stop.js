const {stopPlayingUtil} = require('./stream/utils');

/**
 * Stops playing in the given voice channel and leaves. This is intended for when a user attempts to alter a session.
 * @param mgid The current guild id
 * @param voiceChannel The current voice channel
 * @param stayInVC Whether to stay in the voice channel
 * @param server The server playback metadata
 * @param message Optional - The message metadata, used in the case of verifying a dj or dictator
 * @param actionUser Optional - The member requesting to stop playing, used in the case of verifying a dj or dictator
 * @returns {Promise<void>}
 */
function runStopPlayingCommand(mgid, voiceChannel, stayInVC, server, message, actionUser) {
  return stopPlayingUtil(mgid, voiceChannel, stayInVC, server, message, actionUser);
}

module.exports = {runStopPlayingCommand};
