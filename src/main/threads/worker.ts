import { bot, botID } from "../utils/lib/constants";
import { removeDBMessage } from "../utils/utils";
import { Channel, ChannelType, TextChannel } from "discord.js";
import { runLyricsCommand } from "../commands/lyrics";
import { parentPort } from "worker_threads";
import { logErrorCore } from "../utils/errorUtils";

const token = process.env.V13_DISCORD_TOKEN?.replace(/\\n/gm, "\n");
const hardwareTag = process.env.PERSONAL_HARDWARE_TAG?.replace(/\\n/gm, "\n").substring(0, 25) || "unnamed";

let loggedIn = false;

if (!token) {
  throw new Error("missing params within .env");
}

parentPort!.on("message", async (m: any) => {
  try {
    switch (m.content.commandName) {
      case "lyrics":
        if (!loggedIn) await login();
        bot.channels.fetch(m.content.cReqs.channelId).then((channel: Channel | null) => {
          if (channel) {
            const reactionsCallback = () => {
              parentPort!.postMessage({
                content: {
                  commandName: m.content.commandName,
                  guildId: (<TextChannel>channel).guild.id,
                  pageWasClicked: true
                }
              });
            };
            runLyricsCommand(
              <TextChannel>channel,
              reactionsCallback,
              ...(m.content.commandArgs as [string[], any, string])
            );
          }
        });
        break;
      case "gzn":
        if (!loggedIn) await login();
        removeDBMessage(...(m.content.commandArgs as [any, any, any]));
        break;
      case "SHUTDOWN":
        process.exit(0);
        process.exitCode = 0;
        break;
      case "STARTUP":
        login();
        console.log("-worker process starting up-");
        break;
      default:
        console.log(`invalid command name: ${m.content.commandName}`);
    }
  } catch (e) {
  }
});

/**
 * Logs in to the bot.
 */
async function login() {
  await bot.login(token);
  if (bot.user!.id !== botID) throw new Error("Invalid botID");
  loggedIn = true;
  console.log("-worker process logged in-");
}

process.on("uncaughtException", (error) => {
  logErrorCore(`worker process error [${hardwareTag}]:\n${error.stack}`);
});
