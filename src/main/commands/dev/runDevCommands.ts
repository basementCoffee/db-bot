import { GuildMember, Message, Snowflake, TextChannel, VoiceChannel } from 'discord.js';
import LocalServer from '../../utils/lib/LocalServer';
import processStats from '../../utils/lib/ProcessStats';
import { runDevTest } from './runDevTest';
import { getVoiceConnection } from '@discordjs/voice';
import commandHandlerCommon from '../CommandHandlerCommon';
import { bot, botVersion, commandsMap, hardwareTag } from '../../utils/lib/constants';
import { getXdb2, sendListSize } from '../../database/retrieval';
import { runDeleteKeyCommand_P } from '../../database/delete';
import { createMemoryEmbed } from '../../utils/utils';
import { parentThread } from '../../threads/parentThread';
import { EmbedBuilderLocal } from '@hoursofza/djs-common';
import { formatDuration } from '../../utils/formatUtils';
import { sendMessageToUser } from '../../utils/dms';
import buildNo from '../../utils/lib/BuildNumber';
import { shutdown } from '../../process/shutdown';
import { runUserCommands } from '../runUserCommands';
import { devUpdateCommand } from './devUpdateCommand';
import { getTemperature } from '../../process/utils';

/**
 * All developer commands, for testing purposes.
 * @param message {import("discord.js").Message} The message.
 * @param statement {string} The command to process.
 * @param server {LocalServer} The server object.
 * @param args {Array<string>} The arguments provided with the command.
 * @param prefixString {string} The prefix used by the server.
 * @returns {Promise<void>}
 */
export async function runDevCommands(
  message: Message,
  statement: string,
  server: LocalServer,
  args: Array<string>,
  prefixString: string
) {
  const mgid = message.guild!.id;
  switch (statement) {
    case 'gztest':
      // =gztest
      // this method is for testing purposes only. (cmd: npm run dev-test)
      if (!processStats.devMode) return;
      runDevTest(<TextChannel>message.channel, ['']).catch((err) => processStats.debug(err));
      break;
    // test purposes - play command
    case 'gplay':
    case 'gp':
      commandHandlerCommon.playLink(message, args, mgid, server, 'entries').then();
      break;
    // test purposes - play now command
    case 'gpnow':
    case 'gpn':
      commandHandlerCommon.playLinkNow(message, args, mgid, server, 'entries').then();
      break;
    // test purposes - run database links
    case 'gd':
      commandHandlerCommon.playDBKeys(args, message, 'entries', false, true, server).then();
      break;
    // test purposes - run database command
    case 'gdnow':
    case 'gdn':
      commandHandlerCommon.playDBKeys(args, message, 'entries', true, true, server).then();
      break;
    // test purposes - run database command
    case 'gkn':
    case 'gknow':
      commandHandlerCommon.playDBKeys(args, message, 'entries', true, true, server).then();
      break;
    // .ga adds to the test database
    case 'ga':
    case 'gadd':
      commandHandlerCommon.addKeyToDB(message.channel, args.slice(1), 'entries', true, server, message.member);
      break;
    case 'gadd-playlist':
    case 'gplaylist-add':
      if (!args[1]) {
        message.channel.send(`*error: expected a playlist name to add (i.e. \`${args[0]} [playlist-name]\`)*`);
        return;
      }
      commandHandlerCommon.addCustomPlaylist(server, message.channel, 'entries', args[1]);
      break;
    case 'gdelete-playlist':
    case 'gplaylist-delete':
      commandHandlerCommon
        .removeDBPlaylist(
          server,
          'entries',
          args[1],
          await getXdb2(server, 'entries', false),
          <TextChannel>message.channel
        )
        .then();
      break;
    // test remove database entries
    case 'gdel':
    case 'gdelete':
      runDeleteKeyCommand_P(message, args[1], 'entries', server);
      break;
    case 'gmove-key':
    case 'gmove-keys':
      if (!args[1]) return message.channel.send(`*no args provided (i.e. ${statement} [key] [playlist])*`);
      commandHandlerCommon.moveKeysBetweenPlaylists(
        server,
        <TextChannel>message.channel,
        'entries',
        await getXdb2(server, 'entries', false),
        args.splice(1)
      );
      break;
    case 'gnow':
    case 'g?':
      await commandHandlerCommon.nowPlaying(server, message, message.member!.voice?.channel, args[1], 'entries', 'g');
      break;
    case 'gzmem':
      (await createMemoryEmbed()).send(message.channel).then();
      break;
    case 'gznuke':
      parentThread('gzn', {}, [message.channel.id, parseInt(args[1]) || 1, args[2] === 'db']);
      break;
    case 'gzupdate':
      devUpdateCommand(message, args.slice(1));
      break;
    case 'gurl':
    case 'glink':
      if (!args[1]) {
        if (server.queue[0] && message.member!.voice.channel) {
          return message.channel.send(server.queue[0].url);
        } else {
          return message.channel.send(
            "*add a key to get it's " + statement.substr(1) + ' `(i.e. ' + statement + ' [key])`*'
          );
        }
      }
      await commandHandlerCommon.nowPlaying(server, message, message.member!.voice?.channel, args[1], 'entries', 'g');
      break;
    case 'gzdebug':
      if (server.queue[0]) {
        message.channel.send(`url: ${server.queue[0].url}\nurlAlt: ${server.queue[0].urlAlt}`);
      } else {
        message.channel.send('nothing is playing right now');
      }
      break;
    case 'gzc':
      let commandsMapString = '';
      const commandsMapArray: any[] = [];
      let CMAInt = 0;
      commandsMap.forEach((value: number, key: string) => {
        commandsMapArray[CMAInt++] = [key, value];
      });
      commandsMapArray.sort((a, b) => b[1] - a[1]);
      if (commandsMapArray.length < 1) {
        commandsMapString = '*empty*';
      } else {
        commandsMapArray.forEach((val) => {
          commandsMapString += val[1] + ' - ' + val[0] + '\n';
        });
      }
      new EmbedBuilderLocal()
        .setTitle('Commands Usage - Stats')
        .setDescription(commandsMapString)
        .send(message.channel)
        .then();
      break;
    case 'gzcpf':
      if (processStats.devMode) {
        if (args[1]) {
          server.prefix = args[1];
          message.channel.send('*prefix has been changed*');
        } else {
          message.channel.send('*must provide prefix argument*');
        }
      } else {
        message.channel.send('*can only be performed in devmode*');
      }
      break;
    case 'gzq':
      if (bot.voice.adapters.size > 0 && args[1] !== 'force') {
        message.channel.send("People are using the bot. Use this command again with 'force' to restart the bot");
      } else {
        message.channel.send('restarting the bot... (may only shutdown)').then(() => {
          shutdown('USER')();
        });
      }
      break;
    case 'gzid':
      message.channel.send(`g: ${message.guild!.id}, b: ${bot.user!.id}, m: ${message.member!.id}`);
      break;
    case 'gzsms':
      if (args[1]) {
        if (args[1] === 'clear') {
          processStats.startUpMessage = '';
          return message.channel.send('start up message is cleared');
        }
        processStats.startUpMessage = message.content.substring(message.content.indexOf(args[1]));
        processStats.servers.forEach((x: LocalServer) => {
          x.startUpMessage = '';
        });
        message.channel.send('*new startup message is set*');
      } else if (processStats.startUpMessage) {
        const gzsmsClearMsg = '*type **gzsm clear** to clear the startup message*';
        message.channel.send(`***current start up message:***\n${processStats.startUpMessage}\n${gzsmsClearMsg}`);
      } else {
        message.channel.send('*there is no startup message right now*');
      }
      break;
    case 'gzs':
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
        .send(message.channel)
        .then();
      break;
    case 'gztemp':
      getTemperature().then((response) => {
        if (response.isError) message.channel.send(`returned error: \`${response.value}\``);
        else message.channel.send(`\`${response.value || 'error: no response value provided'}\``);
      });
      break;
    case 'gzr':
      if (!args[1] || !parseInt(args[1])) return;
      sendMessageToUser(message, args[1], undefined);
      break;
    case 'gzm':
      if (!args[1]) {
        message.channel.send(
          'active process #' + process.pid.toString() + ' is in ' + bot.voice.adapters.size + ' servers.'
        );
        break;
      } else if (args[1] === 'update') {
        if (args[2] === 'force') {
          const updateMsg = '`NOTICE: db vibe is about to be updated. Expect a brief interruption within 5 minutes.`';
          bot.voice.adapters.forEach((x: any, gId: string) => {
            try {
              const guildToUpdate = (<VoiceChannel | undefined>(
                bot.channels.cache.get(getVoiceConnection(gId)?.joinConfig.channelId!)
              ))?.guild;
              const currentEmbedChannelId = guildToUpdate
                ? processStats.getServer(guildToUpdate.id).currentEmbedChannelId
                : null;
              const currentTextChannel = currentEmbedChannelId ? bot.channels.cache.get(currentEmbedChannelId) : null;
              if (currentTextChannel) {
                (<TextChannel>bot.channels.cache.get(currentEmbedChannelId!))?.send(updateMsg);
              } else {
                (<VoiceChannel | undefined>(
                  bot.channels.cache.get(getVoiceConnection(gId)?.joinConfig.channelId!)
                ))?.guild.systemChannel?.send(updateMsg);
              }
            } catch (e) {}
          });
          message.channel.send('*update message sent to ' + bot.voice.adapters.size + ' channels*');
        } else {
          message.channel.send(
            'The active bot is not running on Heroku so a git push would not interrupt listening.\n' +
              'To still send out an update use `gzm update force`'
          );
        }
      } else if (args[1] === 'listu') {
        let gx = '';
        bot.voice.adapters.forEach((x: any, g: any) => {
          try {
            // guild member array
            const gmArray: Array<[Snowflake, GuildMember]> = Array.from(
              (<VoiceChannel>bot.channels.cache.get(getVoiceConnection(g)!.joinConfig.channelId!)).members
            );
            gx += `${gmArray[0][1].guild.name}: *`;
            gmArray.map((item) => item[1].user.username).forEach((y) => (gx += `${y}, `));
            gx = `${gx.substring(0, gx.length - 2)}*\n`;
          } catch (e) {}
        });
        if (gx) message.channel.send(gx);
        else message.channel.send('none found');
      }
      break;
    // test purposes - random command
    case 'grand':
    case 'gr':
      commandHandlerCommon.addRandomKeysToQueue([args[1] || '1'], message, 'entries', server, false).then();
      break;
    case 'gshuffle':
      commandHandlerCommon.addRandomKeysToQueue(args.slice(1), message, 'entries', server, false).then();
      break;
    // test purposes - return keys
    case 'gk':
    case 'gkey':
    case 'gkeys':
      commandHandlerCommon.keys(message, server, 'entries', null, args[1]).then();
      break;
    case 'gsplash':
      commandHandlerCommon.setSplashscreen(server, <TextChannel>message.channel, 'entries', args[1]).then();
      break;
    case 'gfind':
    case 'glookup':
    case 'gsearch':
      commandHandlerCommon
        .searchForKeyUniversal(message, server, 'entries', args[1] ? args[1] : server.queue[0]?.url)
        .then();
      break;
    case 'gsize':
      if (args[1]) sendListSize(message, server, 'entries', args[1]).then();
      break;
    default:
      runUserCommands(message, statement, server, args, prefixString).catch((err) => processStats.logError(err));
      break;
  }
}
