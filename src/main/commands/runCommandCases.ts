import { Message } from 'discord.js';
import processStats from '../utils/lib/ProcessStats';
import { appConfig } from '../utils/lib/constants';
import { getServerPrefix } from '../database/retrieval';
import { isAdmin } from '../utils/permissions';
import { runDevCommands } from './dev/runDevCommands';
import { runUserCommands } from './runUserCommands';

/**
 * The execution for all bot commands within a server.
 * @param message the message that triggered the bot
 * @returns {Promise<void>}
 */
export async function runCommandCases(message: Message) {
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
  if (isAdmin(message.member!.id)) {
    runDevCommands(message, statement, server, args, prefixString).catch((err) => processStats.logError(err));
  } else {
    runUserCommands(message, statement, server, args, prefixString).catch((err) => processStats.logError(err));
  }
}
