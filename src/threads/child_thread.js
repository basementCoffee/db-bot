const token = process.env.TOKEN.replace(/\\n/gm, '\n');
const {bot, botID} = require('../utils/process/constants');
const {runLyricsCommand} = require('../commands/lyrics');

process.on('message', async function (m) {
  try{
    await bot.login(token);
    if (bot.user.id !== botID) throw new Error('Invalid botID');
    switch (m.content.commandName) {
      case 'lyrics':
        bot.channels.fetch(m.content.channelId).then(channel => {
          if (channel) {
            const reactionsCallback = () => {
              process.send({
                content: {
                  commandName: m.content.commandName,
                  guildId: channel.guild.id,
                  pageWasClicked: true
                }
              });
            };
            runLyricsCommand(channel, reactionsCallback, ...m.content.commandArgs);
          }
        });
        break;
      default:
        console.log(`invalid command name: ${m.content.commandName}`);
    }
  } catch(e){

  }
});
