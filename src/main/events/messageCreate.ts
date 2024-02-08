import config from '../../../config.json';
import { isAdmin } from '../utils/permissions';
import processStats from '../utils/lib/ProcessStats';
import { dmHandler } from '../utils/dms';
import { Message } from 'discord.js';
import { devProcessCommands } from '../commands/dev/processDevCommands';
import { runMessageCommand } from '../commands/runMessageCommand';
import { processHandler } from '../process/utils';

module.exports = async (message: Message) => {
  if (
    (message.content.substring(0, 3) === '=gz' || message.channel.id === config.process) &&
    isAdmin(message.author.id)
  ) {
    void devProcessCommands(message);
    if (message.channel.id === config.process) {
      if (!processStats.devMode) {
        processHandler(message);
      }
    }
    return;
  }
  if (message.author.bot || processStats.isInactive || (processStats.devMode && !isAdmin(message.author.id))) return;
  if (message.guildId === null) {
    dmHandler(message, message.content).catch((err) => processStats.debug(err));
  } else {
    void runMessageCommand(message);
  }
};
