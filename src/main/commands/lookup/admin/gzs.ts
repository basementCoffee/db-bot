import { MessageEventLocal } from '../../../utils/lib/types';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import { bot, botVersion, hardwareTag } from '../../../utils/lib/constants';
import buildNo from '../../../utils/lib/BuildNumber';
import { formatDuration } from '../../../utils/formatUtils';
import processStats from '../../../utils/lib/ProcessStats';

exports.run = async (event: MessageEventLocal) => {
  new EmbedBuilderLocal()
    .setTitle('db vibe - statistics')
    .setDescription(
      `version: ${botVersion} (${buildNo.getBuildNo()})` +
        `\nprocess: ${process.pid.toString()} [${hardwareTag}]` +
        `\nservers: ${bot.guilds.cache.size}` +
        `\nuptime: ${formatDuration(bot.uptime!)}` +
        `\nactive time: ${processStats.getTimeActive()}` +
        `\nstream time: ${formatDuration(processStats.getTotalStreamTime())}` +
        `\nup since: ${bot.readyAt!.toString().substring(0, 21)}` +
        `\nnumber of streams: ${processStats.getActiveStreamSize()}` +
        `\nactive voice channels: ${bot.voice.adapters.size}`
    )
    .send(event.message.channel)
    .then();
};
