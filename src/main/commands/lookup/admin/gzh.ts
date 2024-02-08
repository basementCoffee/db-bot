import { MessageEventLocal } from '../../../utils/lib/types';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
const version = require('../../../../../package.json').version;

exports.run = async (event: MessageEventLocal) => {
  const prefixString = event.prefix;
  new EmbedBuilderLocal()
    .setTitle('Dev Commands')
    .setDescription(
      '**active bot commands**' +
        `\n ${prefixString} gzs - statistics for the active bot` +
        `\n ${prefixString} gzmem - see the process\'s memory usage` +
        `\n ${prefixString} gzc - view commands stats` +
        `\n ${prefixString} gznuke [num] [\'db\'?] - deletes [num] recent messages (or db only)` +
        `\n ${prefixString} gzr [userId] - queries a message from the bot to the user` +
        '\n\n**calibrate the active bot**' +
        `\n ${prefixString} gzq - quit/restarts the active bot` +
        `\n ${prefixString} gzupdate - updates the (active) pi instance of the bot` +
        `\n ${prefixString} gzm update - sends a message to active guilds that the bot will be updating` +
        `\n ${prefixString} gzsms [message] - set a default message for all users on VC join` +
        '\n\n**calibrate multiple/other bots**' +
        "\n=gzl - return all bot's ping and latency" +
        '\n=gzk - start/kill a process' +
        '\n=gzd [process #] - toggle dev mode' +
        '\n=gzb [process #] [+/-] - increase/decrease build number' +
        '\n=gzupdate - updates all (inactive) pi instances of the bot' +
        '\n\n**dev-testing commands**' +
        `\n ${prefixString} gzcpf - change prefix for testing (if in devmode)` +
        `\n ${prefixString} gzid - guild, bot, and member id` +
        `\n ${prefixString} devadd - access the database`
    )
    .setFooter({ text: `version: ${version}` })
    .send(event.message.channel)
    .then();
};
