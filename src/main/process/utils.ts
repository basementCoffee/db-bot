import { Message } from 'discord.js';
import axios from 'axios';
import fs from 'fs';
import buildNo from '../utils/lib/BuildNumber';
import { bot, checkActiveMS, setOfBotsOn } from '../utils/lib/constants';
import processStats from '../utils/lib/ProcessStats';
import { devUpdateCommand } from '../commands/dev/devUpdateCommand';
import { checkToSeeActive } from './checkToSeeActive';
import { setProcessInactiveAndMonitor } from './monitor';

const { exec } = require('child_process');

/**
 * Runs a cmd for pi systems that returns the temperature.
 * @returns {Promise<{value: string, isError: boolean}>} An object containing the response or error message.
 */
export function getTemperature(): Promise<{ value: string; isError: boolean }> {
  return new Promise((resolve) => {
    exec('vcgencmd measure_temp', (error: any, stdout: string, stderr: string) => {
      if (stdout) {
        resolve({ value: stdout, isError: false });
      } else if (stderr) {
        resolve({ value: stderr, isError: true });
      } else {
        resolve({ value: 'no response', isError: true });
      }
    });
  });
}

/**
 * Processes an updated env file to the local directory.
 * @param message The message containing the file.
 */
export async function processEnvFile(message: Message) {
  // sets the .env file
  if (!message.attachments.first() || !message.attachments.first()!.name?.includes('.txt')) {
    message.channel.send('no attachment found');
  } else {
    const response = await axios({
      url: message.attachments.first()!.url,
      method: 'GET',
      responseType: 'stream'
    });
    response.data.pipe(fs.createWriteStream('.env'));
    message.channel.send('*contents changed. changes will take effect after a restart*');
  }
}

export function processHandler(message: Message) {
  // ON: (ex: ~db-process-on012345678verzzz)
  // ~db-process (standard)[11] | -on [14] | 1 or 0 (vc size)[15] | 12345678 (build no)[23] | ver [26] | (process) [n]
  // OFF: (~db-process-off12345678-zzz)
  // ~db-process (standard)[11] | -off [15] | 12345678 (build no)[23] | - [24] | (process) [n]
  if (message.content.substring(0, 11) === '~db-process') {
    // if seeing bots that are on
    if (message.content.substring(11, 14) === '-on') {
      const oBuildNo = message.content.substring(15, 23);
      // compare versions || check if actively being used (if so: keep on)
      if (parseInt(oBuildNo) >= parseInt(buildNo.getBuildNo()) || message.content.substring(14, 15) !== '0') {
        setOfBotsOn.add(message.content.substring(26));
        // update this process if out-of-date or reset process interval if an up-to-date process has queried
        if (processStats.isInactive) {
          // 2hrs of uptime is required to update process
          if (
            bot.uptime! > 7200000 &&
            parseInt(oBuildNo.substring(0, 6)) > parseInt(buildNo.getBuildNo().substring(0, 6))
          ) {
            devUpdateCommand();
          } else if (parseInt(oBuildNo.substring(0, 6)) >= parseInt(buildNo.getBuildNo().substring(0, 6))) {
            clearInterval(processStats.checkActiveInterval);
            // offset for process timer is 3.5 seconds - 5.9 minutes
            const offset = Math.floor(((Math.random() * 100 + 1) / 17) * 60000);
            // reset the =gzk interval since query was already made by another process
            processStats.checkActiveInterval = setInterval(checkToSeeActive, checkActiveMS + offset);
          }
        }
      }
    } else if (message.content.substring(11, 15) === '-off') {
      // compare process IDs
      if (message.content.substring(24) !== process.pid.toString()) {
        if (bot.voice!.adapters.size > 1) {
          processStats.logError('[WARN] sidelined instance is in 1 or more voice channels');
        }
        processStats.isPendingStatus = false;
        setProcessInactiveAndMonitor();
      }
    } else {
      throw new Error('invalid db-process command');
    }
  } else if (processStats.isInactive && message.content.substring(0, 9) === 'starting:') {
    // view the build number of the starting process, if newer version then update
    if (bot.uptime! > 7200000) {
      const regExp = /\[(\d+)/;
      const regResult = regExp.exec(message.content);
      const oBuildNo = regResult ? regResult[1] : null;
      if (oBuildNo && parseInt(oBuildNo.substring(0, 6)) > parseInt(buildNo.getBuildNo().substring(0, 6))) {
        devUpdateCommand();
      }
    }
  }
}

/**
 * Assuming that there was a connection error. Tries to reconnect.
 */
export async function fixConnection(token: string): Promise<boolean> {
  let waitTimeMS = 10000;
  const retryText = (time: number) => `retrying in ${time / 1000} seconds...`;
  console.log(`no connection: ${retryText(waitTimeMS)}`);
  let retries = 0;
  const connect = async () => {
    console.log('connecting...');
    try {
      await bot.login(token);
      console.log('connected.');
      return true;
    } catch (e) {
      // if the wait time was greater than 10 minutes, then exit
      if (waitTimeMS > 60_000 * 10) {
        console.log(`failed to connect after ${retries} tries. exiting...`);
        process.exit(1);
      }
      // after 3 tries, set the state to inactive
      if (retries > 2) processStats.setProcessInactive();
      retries++;
      waitTimeMS *= 2;
      console.log(`connection failed.\n${retryText(waitTimeMS)}`);
    }
    return false;
  };
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, waitTimeMS));
    if (await connect()) return true;
  }
}
