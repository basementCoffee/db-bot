import { Guild } from 'discord.js';
import processStats from '../utils/lib/ProcessStats';

module.exports = async (guild: Guild) => {
  if (processStats.isInactive) return;
  if (processStats.devMode) {
    console.log('guild create event: ' + guild.name);
    return;
  }
  guild.systemChannel?.send("Type '.help' to see my commands.").then();
};
