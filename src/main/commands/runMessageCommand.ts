import { Message } from 'discord.js';
import processStats from '../utils/lib/ProcessStats';
import { appConfig } from '../utils/lib/constants';
import { getServerPrefix } from '../database/retrieval';
import LocalServer from '../utils/lib/LocalServer';
import { MessageEventLocal } from '../utils/lib/types';
import { commandHandler } from '../handler/CommandHandler';

/**
 * Processes the message for a command and executes the command. Should be the entrypoint for new message commands.
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
export async function runMessageCommand(message: Message): Promise<void> {
  const mgid = message.guild!.id;
  // the server guild playback data
  const server = processStats.getServer(mgid);
  if (processStats.devMode && !server.prefix) {
    // devmode prefix
    server.prefix = appConfig.devPrefix;
  }
  if (server.currentEmbedChannelId === message.channel.id && server.numSinceLastEmbed < 10) {
    server.numSinceLastEmbed += 2;
  }
  // the server prefix
  const prefixString = server.prefix || (await getServerPrefix(server, mgid));
  const fwPrefix = message.content[0];
  // for all non-commands
  if (fwPrefix !== prefixString) {
    if (fwPrefix !== '.') return;
    if (processStats.devMode) return;
    const firstWordBegin = message.content.substring(0, 10).trim() + ' ';
    if (firstWordBegin === '.db-vibe ') {
      message.channel.send('Current prefix is: ' + prefixString);
    }
    return;
  }
  const args = message.content.replace(/\s+/g, ' ').split(' ');
  // the command name
  const statement = args[0].substring(1).toLowerCase();
  executeCommand(message, statement, server, args, prefixString).catch((err) => processStats.logError(err));
}

/**
 * Execute a specific command.
 * @param message {import("discord.js").Message} The message.
 * @param statement {string} The command to process.
 * @param server {LocalServer} The server object.
 * @param args {Array<string>} The statement and provided arguments.
 * @param prefixString {string} The prefix used by the server.
 * @returns {Promise<void>}
 */
async function executeCommand(
  message: Message,
  statement: string,
  server: LocalServer,
  args: Array<string>,
  prefixString: string
): Promise<void> {
  const event: MessageEventLocal = {
    statement,
    message,
    args: args.slice(1),
    prefix: prefixString,
    data: new Map(),
    server: server,
    mgid: message.guild!.id
  };
  await commandHandler.execute(event);
}
