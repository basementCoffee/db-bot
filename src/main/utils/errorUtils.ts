import { Channel, MessageCreateOptions, TextChannel } from "discord.js";
import { bot } from "./lib/constants";
import config from "../../../config.json";

/**
 * Logs an error to a channel. NOTE: Does not console.log the error.
 * @param errText The error object or message to send.
 */
function logErrorCore(errText: string | MessageCreateOptions | Error) {
  if (errText instanceof Error) {
    errText = `${errText.stack}`;
  }
  bot.channels
    .fetch(config.err)
    .then((channel: Channel | null) => {
      if (errText instanceof Error) {
        errText = `${errText.stack}`;
      }
      (<TextChannel>channel)?.send(errText);
    })
    .catch((e: Error) => console.log("Failed sending error message: ", e));
}

export { logErrorCore };
