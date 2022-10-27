const { bot } = require('./lib/constants');
const CH = require('../../channel.json');
const processStats = require('./lib/ProcessStats');
const { getVoiceConnection } = require('@discordjs/voice');

/**
 * Shuts down the current process.
 * @param {string} type The type of shutdown.
 * @returns {Function} The shutdown function.
 */
function shutdown(type) {
  return () => {
    const wasActive = !processStats.isInactive;
    processStats.setProcessInactive();
    console.log('shutting down...');
    // noinspection JSUnresolvedFunction
    try {
      if (!processStats.devMode) {
        bot.channels.fetch(CH.process).then((channel) => channel.send(`shutting down: '${process.pid}' (${type})`));
        if (wasActive) bot.channels.fetch(CH.process).then((channel) => channel.send('=gzz'));
      }
    }
    catch (e) {}
    const activeCSize = bot.voice.adapters.size;
    if (activeCSize > 0) {
      console.log(`leaving ${activeCSize} voice channel${activeCSize > 1 ? 's' : ''}`);
      // noinspection JSUnresolvedFunction
      if (processStats.servers.size > 0) {
        bot.voice.adapters.forEach((x, guildId) => {
          const server = processStats.servers.get(guildId);
          bot.guilds.fetch(guildId).then((guild) => {
            const currentEmbed = server.currentEmbed;
            getVoiceConnection(guildId)?.disconnect();
            x.destroy();
            try {
              if (currentEmbed) currentEmbed.channel.send('db vibe is restarting... (this will be quick)');
              else if (server.queue[0]) guild.systemChannel.send('db vibe is restarting... (this will be quick)').then();
              processStats.disconnectConnection(server, server.audio.connection);
            }
            catch (e) {
              guild.systemChannel.send('db vibe is restarting... (this will be quick)').then();
            }
          });

          if (server.collector) server.collector.stop();
        });
      }
      setTimeout(() => process.exit(), 4500);
    }
    else {setTimeout(() => process.exit(), 1500);}
    process.exitCode = 0;
  };
}

module.exports = { shutdown };
