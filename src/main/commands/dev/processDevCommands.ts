import { Message, MessageReaction, User, VoiceChannel } from 'discord.js';
import processStats from '../../utils/lib/ProcessStats';
import { appConfig, bot, botID, botVersion, CORE_ADM, hardwareTag } from '../../utils/lib/constants';
import buildNumber from '../../utils/lib/BuildNumber';
import reactions from '../../utils/lib/reactions';
import { devUpdateCommand } from './devUpdateCommand';
import { checkToSeeActive } from '../../process/checkToSeeActive';
import { runMessageCommand } from '../runMessageCommand';
import { getVoiceConnection } from '@discordjs/voice';
import { setProcessInactiveAndMonitor } from '../../process/monitor';
import { getTemperature, processEnvFile } from '../../process/utils';
import buildNo from '../../utils/lib/BuildNumber';

/**
 * Interpret developer process-related commands. Used for maintenance of multiple db vibe instances.
 * The first three letters of the message are assumed to be the developer prefix and are therefore ignored.
 * @param message The message metadata.
 */
export async function devProcessCommands(message: Message) {
  const zargs = message.content.split(' ');
  switch (zargs[0].substring(3)) {
    case 'k':
      // =gzk
      if (appConfig.process === message.channel.id) {
        if (!processStats.isInactive && !processStats.devMode) {
          const dbOnMsg = `~db-process-on${Math.min(bot.voice.adapters.size, 9)}${buildNumber.getBuildNo()}ver${
            process.pid
          }`;
          return message.channel.send(dbOnMsg);
        }
        return;
      }
      if (!zargs[1]) {
        let dm: string;
        if (processStats.devMode) {
          dm = ' (dev mode)';
        } else {
          dm = bot.voice.adapters.size ? ' (VCs: ' + bot.voice.adapters.size + ')' : '';
        }
        // the process message: [sidelined / active] [process number] [version number]
        const procMsg = () => {
          return (
            (processStats.isInactive ? 'sidelined: ' : processStats.devMode ? 'active: ' : '**active: **') +
            process.pid +
            ` *[${hardwareTag}]* (${botVersion})` +
            dm
          );
        };
        message.channel.send(procMsg()).then((sentMsg) => {
          if (processStats.devMode) {
            sentMsg.react(reactions.O_DIAMOND);
          } else {
            sentMsg.react(reactions.GEAR);
          }

          const filter = (reaction: MessageReaction, user: User) => {
            return (
              user.id !== botID &&
              user.id === message.member!.id &&
              [reactions.GEAR, reactions.O_DIAMOND].includes(reaction.emoji.name!)
            );
          };
          // updates the existing gzk message
          const updateMessage = () => {
            if (processStats.devMode) {
              dm = ' (dev mode)';
            } else {
              dm = bot.voice.adapters.size ? ' (VCs: ' + bot.voice.adapters.size + ')' : '';
            }
            try {
              sentMsg.edit(procMsg());
            } catch (e) {
              const updatedMsg =
                '*db vibe ' + process.pid + (processStats.isInactive ? ' has been sidelined*' : ' is now active*');
              message.channel.send(updatedMsg);
            }
          };
          const collector = sentMsg.createReactionCollector({ filter, time: 30000 });
          let prevVCSize = bot.voice.adapters.size;
          let prevStatus = processStats.isInactive;
          let prevDevMode = processStats.devMode;
          const statusInterval = setInterval(() => {
            if (
              !(
                bot.voice.adapters.size === prevVCSize &&
                prevStatus === processStats.isInactive &&
                prevDevMode === processStats.devMode
              )
            ) {
              prevVCSize = bot.voice.adapters.size;
              prevDevMode = processStats.devMode;
              prevStatus = processStats.isInactive;
              if (sentMsg.deletable) updateMessage();
              else clearInterval(statusInterval);
            }
          }, 4500);

          collector.on('collect', (reaction, user) => {
            if (reaction.emoji.name === reactions.GEAR) {
              if (!processStats.isInactive && bot.voice.adapters.size > 0) {
                let hasDeveloper = false;
                if (bot.voice.adapters.size === 1) {
                  bot.voice.adapters.forEach((_adapter, guildId) => {
                    const gMems = (<VoiceChannel>(
                      bot.channels.cache.get(getVoiceConnection(guildId)!.joinConfig.channelId!)
                    ))!.members;
                    const coreAdminIds = CORE_ADM.map((x) => x.substring(0, x.length - 1));
                    if (gMems.get(coreAdminIds[0]) || gMems.get(coreAdminIds[1])) {
                      hasDeveloper = true;
                      const server = processStats.getServer(guildId);
                      processStats.disconnectConnection(server);
                    }
                  });
                }
                if (!hasDeveloper) {
                  message.channel.send(
                    '***' +
                      process.pid +
                      ' - button is disabled***\n*This process should not be ' +
                      'sidelined because it has active members using it (VCs: ' +
                      bot.voice.adapters.size +
                      ')*\n' +
                      '*If you just activated another process, please deactivate it.*'
                  );
                  return;
                }
              }
              if (processStats.isInactive) {
                processStats.setProcessActive();
              } else {
                setProcessInactiveAndMonitor();
              }

              if (sentMsg.deletable) {
                updateMessage();
                reaction.users.remove(user.id);
              }
            } else if (reaction.emoji.name === reactions.O_DIAMOND) {
              if (processStats.devMode) {
                processStats.setDevMode(false);
                setProcessInactiveAndMonitor();
              }
              if (sentMsg.deletable) updateMessage();
            }
          });
          collector.once('end', () => {
            clearInterval(statusInterval);
            if (sentMsg.deletable) {
              if (sentMsg.reactions) sentMsg.reactions.removeAll();
              updateMessage();
            }
          });
        });
      } else if (zargs[1] === 'all') {
        setProcessInactiveAndMonitor();
      } else {
        let i = 1;
        while (zargs[i]) {
          if (zargs[i].replace(/,/g, '') === process.pid.toString()) {
            if (processStats.isInactive) {
              processStats.setProcessActive();
              message.channel.send('*db vibe ' + process.pid + ' is now active*');
            } else {
              setProcessInactiveAndMonitor();
              message.channel.send('*db vibe ' + process.pid + ' has been sidelined*');
            }
            return;
          }
          i++;
        }
      }
      break;
    case 'd':
      // =gzd
      const activeStatus = processStats.isInactive ? 'inactive' : '**active**';
      if (!zargs[1]) {
        return message.channel.send(
          activeStatus + ' process: ' + process.pid.toString() + ' (' + 'dev mode: ' + processStats.devMode + ')'
        );
      }
      if (processStats.devMode && zargs[1] === process.pid.toString()) {
        processStats.setDevMode(false);
        setProcessInactiveAndMonitor();
        processStats.servers.delete(message.guild!.id);
        return message.channel.send(`*devmode is off ${process.pid}*`);
      } else if (zargs[1] === process.pid.toString()) {
        processStats.setDevMode(true);
        processStats.servers.delete(message.guild!.id);
        if (processStats.checkActiveInterval) {
          clearInterval(processStats.checkActiveInterval);
          processStats.checkActiveInterval = null;
        }
        return message.channel.send(`*devmode is on ${process.pid}*`);
      }
      break;
    case 'l':
      // =gzl
      message.channel.send(
        process.pid.toString() +
          `: Latency is ${Date.now() - message.createdTimestamp}ms.\nNetwork latency is ${Math.round(bot.ws.ping)}ms`
      );
      break;
    case 'q':
      // =gzq
      if (!processStats.devMode && zargs[1] !== process.pid.toString()) return;
      if (bot.voice.adapters.size > 0 && (!zargs[2] || zargs[2] !== 'force')) {
        message.channel.send('People are using the bot. Use force as the second argument.').then();
      } else {
        message.channel.send('restarting the bot... (may only shutdown)').then(() =>
          setTimeout(() => {
            process.exit();
          }, 2000)
        );
      }
      break;
    case 'z':
      // =gzz
      if (message.author.bot && zargs[1] !== process.pid.toString()) {
        await new Promise((res) => setTimeout(res, Math.random() * 5000));
        checkToSeeActive();
      }
      break;
    case 'update':
      // =gzupdate
      if (zargs[1]) {
        // maintain if-statement structure because of else condition
        if (zargs[1] !== process.pid.toString()) return;
      } else if (processStats.devMode) {
        // when no pid is provided & is devMode
        return;
      }

      if (processStats.isInactive || processStats.devMode) {
        message.channel.send(`*updating process ${process.pid}*`);
        devUpdateCommand(undefined, zargs.slice(2));
      }
      break;
    case 'b':
      // =gzb
      if (zargs[1]) {
        if (zargs[1] !== process.pid.toString()) return;
        if (zargs[2]) {
          if (zargs[2] === '+') {
            if (buildNo.incrementBuildNo()) {
              message.channel.send(`*build no incremented (${buildNo.getBuildNo()})*`);
            } else {
              message.channel.send(`*could not increment (${buildNo.getBuildNo()})*`);
            }
          } else if (zargs[2] === '-') {
            if (buildNo.decrementBuildNo()) {
              message.channel.send(`*build no decremented (${buildNo.getBuildNo()})*`);
            } else {
              message.channel.send(`*could not decrement (${buildNo.getBuildNo()})*`);
            }
          }
        } else {
          message.channel.send("try again followed by a '+' or '-' to increment or decrement.");
        }
      } else {
        message.channel.send(`*process ${process.pid} (${buildNo.getBuildNo()})*`);
      }
      break;
    case 'temp':
      // =gztemp
      if (zargs[1] && zargs[1] !== process.pid.toString() && zargs[1].toLowerCase() !== hardwareTag.toLowerCase())
        return;
      getTemperature().then((response) => {
        if (!response.isError && response.value) {
          message.channel.send(`${hardwareTag || process.pid.toString()}: \`${response.value}\``);
        }
      });
      break;
    case 'env':
      // =gzenv
      if (zargs[1] !== process.pid.toString()) return;
      await processEnvFile(message);
      break;
    default:
      if (processStats.devMode && !processStats.isInactive && message.guild) return runMessageCommand(message);
      break;
  }
}
