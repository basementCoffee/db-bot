import { MessageEventLocal } from '../../../utils/lib/types';
import processStats from '../../../utils/lib/ProcessStats';
import { BaseGuildTextChannel, TextChannel } from 'discord.js';
import { devProcessCommands } from '../../dev/processDevCommands';
import { runMessageCommand } from '../../runMessageCommand';

exports.run = async (event: MessageEventLocal) => {
  // this method is for testing purposes only. (cmd: npm run dev-test)
  if (!processStats.devMode) return;
  runDevTest(<TextChannel>event.message.channel, ['']).catch((err) => processStats.debug(err));
};

/**
 * Runs a test.
 * @param channel The text channel to run the test in.
 * @param messagesToRun Array of message IDs to test.
 */
export async function runDevTest(channel: BaseGuildTextChannel, messagesToRun: Array<string>) {
  channel.send('*test received*').catch((er: Error) => processStats.debug(er));
  // fetch should be the message to test/mimic
  for (const msgId of messagesToRun) {
    if (!msgId) {
      await channel.send('warning: empty test cases, exiting...');
      break;
    }
    const msg = await channel.messages.fetch(msgId);
    await new Promise((res) => setTimeout(res, 2000));
    if (msg) {
      const baseCmdInfo = `[INFO] ${runDevTest.name}: testing "${msg.content}"`;
      if (msg.content.substring(1, 3) === 'gz') {
        processStats.debug(`${baseCmdInfo} (to ${devProcessCommands.name})`);
        await devProcessCommands(msg);
      } else {
        processStats.debug(`${baseCmdInfo} (to ${runMessageCommand.name})`);
        await runMessageCommand(msg);
      }
    } else {
      console.log(`${runDevTest.name}: could not find message with the id ${msgId}`);
    }
  }
}
