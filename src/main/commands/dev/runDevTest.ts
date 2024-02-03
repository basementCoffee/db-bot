import { BaseGuildTextChannel } from 'discord.js';
import processStats from '../../utils/lib/ProcessStats';
import { devProcessCommands } from './processDevCommands';
import { runCommandCases } from '../runCommandCases';

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
      channel.send('warning: empty test cases, exiting...');
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
        processStats.debug(`${baseCmdInfo} (to ${runCommandCases.name})`);
        await runCommandCases(msg);
      }
    } else {
      console.log(`${runDevTest.name}: could not find message with the id ${msgId}`);
    }
  }
}
