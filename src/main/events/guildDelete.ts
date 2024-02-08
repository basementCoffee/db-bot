import processStats from '../utils/lib/ProcessStats';
import { deleteRows, gsrun } from '../database/api/api';
import { PREFIX_SN } from '../utils/lib/constants';
import { Guild } from 'discord.js';

module.exports = async (guild: Guild) => {
  if (processStats.isInactive || processStats.devMode) return;
  gsrun('A', 'B', PREFIX_SN).then(async (xdb: any) => {
    for (let i = 0; i < xdb.line.length; i++) {
      const itemToCheck = xdb.line[i];
      if (itemToCheck === guild.id) {
        i += 1;
        await deleteRows(PREFIX_SN, i);
        break;
      }
    }
  });
};
