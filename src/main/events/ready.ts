import { ActivityType, Channel, TextChannel } from 'discord.js';
import { parentThread } from '../threads/parentThread';
import processStats from '../utils/lib/ProcessStats';
import { appConfig, bot, startupTest } from '../utils/lib/constants';
import { checkStatusOfYtdl } from '../commands/stream/stream';
import { setProcessInactiveAndMonitor } from '../process/monitor';
import buildNo from '../utils/lib/BuildNumber';
import { checkToSeeActive } from '../process/checkToSeeActive';

module.exports = async () => {
  parentThread('STARTUP', {}, []);
  // bot starts up as inactive, if no response from the channel then activates itself
  // noinspection JSUnresolvedFunction
  processStats.getServer(appConfig['check-in-guild']);
  if (processStats.devMode) {
    processStats.setProcessActive();
    if (startupTest) {
      const index = process.argv.indexOf('--test');
      if (index === process.argv.length - 1) {
        console.log('could not run test, please provide channel id');
      } else {
        bot.channels.fetch(process.argv[index + 1]).then((channel: Channel | null) => {
          if (channel && channel['lastMessageId' as keyof Channel]) {
            (<TextChannel>channel).send('=gztest').then();
          } else {
            console.log('not a text channel');
          }
        });
      }
    }
  } else {
    checkStatusOfYtdl(processStats.getServer(appConfig['check-in-guild'])).then();
    setProcessInactiveAndMonitor();
    bot.user!.setActivity('beats | .db-vibe', { type: ActivityType.Playing });
    console.log('-starting up sidelined-');
    console.log('checking status of other bots...');
    // bot logs - startup (NOTICE: "starting:" is reserved)
    await (async () =>
      (<TextChannel>await bot.channels.fetch(appConfig.process))
        .send(`starting: ${process.pid} [${buildNo.getBuildNo()}]`)
        .then(() => {
          checkToSeeActive();
        }))();
  }
  console.log('-ready-');
};
