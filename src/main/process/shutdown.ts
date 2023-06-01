import { bot } from '../utils/lib/constants';
import processStats from '../utils/lib/ProcessStats';
import { Channel, Guild, TextBasedChannel } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { parentThread } from '../threads/parentThread';
import config from '../../../config.json';

/**
 * Shuts down the current process.
 * @param {string} type The type of shutdown.
 * @returns {Function} The shutdown function.
 */
function shutdown(type: string) {
  return () => {
    parentThread('SHUTDOWN', {}, []);
    const wasActive = !processStats.isInactive;
    processStats.setProcessInactive();
    console.log('shutting down...');
    // noinspection JSUnresolvedFunction
    try {
      if (!processStats.devMode) {
        bot.channels
          .fetch(config.process)
          .then((channel: Channel | null) => {
            (<TextBasedChannel>channel).send(`shutting down: '${process.pid}' (${type})`);
          })
          .catch((e) => console.log('shutdown error: ', e));
        if (wasActive)
          bot.channels
            .fetch(config.process)
            .then((channel: any) => channel.send('=gzz'))
            .catch((e) => console.log('shutdown error: ', e));
      }
    } catch (e) {}
    const activeCSize = bot.voice.adapters.size;
    if (activeCSize > 0) {
      console.log(`leaving ${activeCSize} voice channel${activeCSize > 1 ? 's' : ''}`);
      // noinspection JSUnresolvedFunction
      if (processStats.servers.size > 0) {
        bot.voice.adapters.forEach((x: any, guildId: string) => {
          const server = processStats.getServer(guildId);
          bot.guilds
            .fetch(guildId)
            .then((guild: Guild) => {
              const currentEmbed = server.currentEmbed;
              getVoiceConnection(guildId)?.disconnect();
              x.destroy();
              try {
                if (currentEmbed) currentEmbed.channel.send('db vibe is restarting... (this will be quick)');
                else if (server.queue[0])
                  guild.systemChannel?.send('db vibe is restarting... (this will be quick)').then();
                processStats.disconnectConnection(server);
              } catch (e) {
                guild.systemChannel?.send('db vibe is restarting... (this will be quick)').then();
              }
            })
            .catch();
          if (server.collector) {
            server.collector.stop();
            server.collector = null;
          }
        });
      }
      setTimeout(() => process.exit(), 4500);
    } else {
      setTimeout(() => process.exit(), 1500);
    }
    process.exitCode = 0;
  };
}

export { shutdown };
