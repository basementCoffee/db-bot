import { bot, botID } from '../utils/lib/constants';
import { removeDBMessage, logError } from '../utils/utils';
import { TextChannel } from 'discord.js';
import { runLyricsCommand } from '../commands/lyrics';
import { parentPort } from 'worker_threads';
const token = process.env.V13_DISCORD_TOKEN?.replace(/\\n/gm, '\n');

let loggedIn = false;

if (!token) {
  throw new Error('missing params within .env');
}

parentPort!.on('message', async (m: any) => {
  try {
    switch (m.content.commandName) {
      case 'lyrics':
        if (!loggedIn) await login();
        bot.channels.fetch(m.content.cReqs.channelId).then((channel: TextChannel) => {
          if (channel) {
            const reactionsCallback = () => {
              parentPort!.postMessage({
                content: {
                  commandName: m.content.commandName,
                  guildId: channel.guild.id,
                  pageWasClicked: true
                }
              });
            };
            // @ts-ignore
            runLyricsCommand(channel, reactionsCallback, ...m.content.commandArgs);
          }
        });
        break;
      case 'gzn':
        if (!loggedIn) await login();
        removeDBMessage(...(m.content.commandArgs as [any, any, any]));
        break;
      case 'SHUTDOWN':
        process.exit(0);
        process.exitCode = 0;
        break;
      case 'STARTUP':
        login();
        console.log('-worker process starting up-');
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
  console.log('-worker process logged in-');
}

process.on('uncaughtException', (error) => {
  logError(`(worker process error) ${error.name}: ${error.message}`);
  console.log(error);
});
