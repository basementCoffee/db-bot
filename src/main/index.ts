'use strict';
require('dotenv').config();
import { commandHandler } from './handler/CommandHandler';
import { bot, botID } from './utils/lib/constants';
import { shutdown } from './process/shutdown';
import processStats from './utils/lib/ProcessStats';
import { eventHandler } from './handler/EventHandlerLocal';
import { fixConnection } from './process/utils';

const token =
  process.env.V13_DISCORD_TOKEN?.replace(/\\n/gm, '\n') ||
  (() => {
    throw new Error('missing params within .env file, ensure dotenv setup is before imports');
  })();

process.setMaxListeners(0);

process.on('error', (e) => {
  console.log('PROCESS ERROR:\n', e);
});

process
  .on('SIGTERM', shutdown('SIGTERM'))
  .on('SIGINT', shutdown('SIGINT'))
  .on('uncaughtException', uncaughtExceptionAction);

// whether the process is attempting to reconnect
let isFixingConnection = false;

/**
 * The action to be performed if there is an uncaughtExceptionError.
 * @param e The Error Object.
 */
function uncaughtExceptionAction(e: Error) {
  if (e.message.includes('getaddrinfo') && e.message.includes('discord.com')) {
    if (isFixingConnection) return;
    isFixingConnection = true;
    fixConnection(token).finally(() => {
      isFixingConnection = false;
    });
  } else {
    processStats.debug('uncaughtException: ', e);
    if (e.message === 'Unknown Message') return;
    processStats.logError(`Uncaught Exception ${processStats.devMode ? '(development)' : ''}:\n${e.stack}`);
  }
}

// The main method
(async () => {
  // login to discord
  await bot.login(token);
  if (bot.user!.id !== botID) throw new Error('Invalid botID');
  console.log('Logged into discord. Waiting for ready event...');
  commandHandler.loadAllCommands();
  eventHandler.loadAllEvents((eventName, listener) => bot.on(eventName, listener));
})();
