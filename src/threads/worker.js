const token = process.env.V13_DISCORD_TOKEN.replace(/\\n/gm, '\n');
const {bot, botID} = require('../utils/lib/constants');
const {runLyricsCommand} = require('../commands/lyrics');
const {removeDBMessage, logError} = require('../utils/utils');
const {parentPort} = require('worker_threads');

let loggedIn = false;

parentPort.on('message', async (m) => {
  if (!loggedIn) await login();
  try {
    switch (m.content.commandName) {
    case 'lyrics':
      bot.channels.fetch(m.content.cReqs.channelId).then((channel) => {
        if (channel) {
          const reactionsCallback = () => {
            parentPort.postMessage({
              content: {
                commandName: m.content.commandName,
                guildId: channel.guild.id,
                pageWasClicked: true,
              },
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

/**
 * Logs in to the bot.
 */
async function login() {
  await bot.login(token);
  if (bot.user.id !== botID) throw new Error('Invalid botID');
  loggedIn = true;
}

process.on('uncaughtException', (error) => {
  logError(`(worker process error) ${error.name}: ${error.message}`);
  console.log(error);
});

