import { Channel, MessagePayloadOption, TextChannel } from 'discord.js';
import { bot } from './lib/constants';

const CH = require('../../channel.json');

/**
 * Logs an error to a channel. NOTE: Does not console.log the error.
 * @param errText The error object or message to send.
 */
function logErrorCore(errText: string | MessagePayloadOption | Error) {
  bot.channels
    .fetch(CH.err)
    .then((channel: Channel | null) => {
      if (errText instanceof Error) {
        errText = `${errText.stack}`;
      }
      //@ts-ignore
      (<TextChannel>channel)?.send(errText);
    })
    .catch((e: Error) => console.log('Failed sending error message: ', e));
}

export { logErrorCore };
