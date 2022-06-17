const {bot} = require('./process/constants');
const CH = require('../../channel.json');
const processStats = require('./process/ProcessStats');

function shutdown (type) {
  return () => {
    const wasActive = !processStats.isInactive;
    processStats.setProcessInactive();
    console.log('shutting down...');
    // noinspection JSUnresolvedFunction
    try {
      bot.channels.fetch(CH.process).then(channel => channel.send(`shutting down: '${process.pid}' (${type}) ${processStats.devMode ? `(dev)` : ''}`));
      if (!processStats.devMode && wasActive) bot.channels.fetch(CH.process).then(channel => channel.send(`=gzz`));
    } catch (e) {}
    const activeCSize = bot.voice.adapters.size;
    if (activeCSize > 0) {
      console.log(`leaving ${activeCSize} voice channel${activeCSize > 1 ? 's' : ''}`);
      // noinspection JSUnresolvedFunction
      if (processStats.servers.size > 0) {
        bot.voice.adapters.forEach((x, guildId) => {
          let server = processStats.servers.get(guildId);
          bot.guilds.fetch(guildId).then((guild)=> {
            let currentEmbed = server.currentEmbed;
            try {
              if (currentEmbed) currentEmbed.channel.send('db bot is restarting... (this will be quick)');
              else if (server.queue[0]) guild.systemChannel.send('db bot is restarting... (this will be quick)').then();
            } catch (e) {
              guild.systemChannel.send('db bot is restarting... (this will be quick)').then();
            }
          })

          if (server.collector) server.collector.stop();
          x.destroy();
        });
      }
      setTimeout(() => process.exit(), 4500);
    } else setTimeout(() => process.exit(), 1500);
    process.exitCode = 0;
  };
}

module.exports = {shutdown};