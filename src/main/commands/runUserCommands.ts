import { Message } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { botVersion, commandsMap } from '../utils/lib/constants';
import { EventDataKeyEnum, MessageEventLocal } from '../utils/lib/types';
import { commandHandler } from '../handler/CommandHandler';

/**
 * All user commands.
 * @param message {import("discord.js").Message} The message.
 * @param statement {string} The command to process.
 * @param server {LocalServer} The server object.
 * @param args {Array<string>} The arguments provided with the command.
 * @param prefixString {string} The prefix used by the server.
 * @returns {Promise<void>}
 */
export async function runUserCommands(
  message: Message,
  statement: string,
  server: LocalServer,
  args: Array<string>,
  prefixString: string
): Promise<void> {
  commandsMap.set(statement, (commandsMap.get(statement) || 0) + 1);
  const event: MessageEventLocal = {
    statement,
    message,
    args: args.slice(1),
    prefix: prefixString,
    data: new Map(),
    server: server,
    mgid: message.guild!.id
  };
  event.data.set(EventDataKeyEnum.BOT_VERSION, botVersion);
  await commandHandler.execute(event);
}
