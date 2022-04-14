const token = process.env.TOKEN.replace(/\\n/gm, '\n');
const {bot, botID} = require('../utils/process/constants');
const {runLyricsCommand} = require('../commands/lyrics');
const {removeDBMessage} = require('../utils/utils');

let loggedIn = false;

process.on('message', async (m) => {
  if (!loggedIn) await login();
  try {
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
      case 'gzn':
        removeDBMessage(...m.content.commandArgs);
        break;
      default:
        console.log(`invalid command name: ${m.content.commandName}`);
    }
  } catch (e) {}
});

async function login () {
  await bot.login(token);
  if (bot.user.id !== botID) throw new Error('Invalid botID');
  loggedIn = true;
}

