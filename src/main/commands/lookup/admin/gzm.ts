import { bot } from '../../../utils/lib/constants';
import { GuildMember, Snowflake, TextChannel, VoiceChannel } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import processStats from '../../../utils/lib/ProcessStats';
import { MessageEventLocal } from '../../../utils/lib/types';
exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const args = event.args;
  if (!args[0]) {
    await message.channel.send(
      'active process #' + process.pid.toString() + ' is in ' + bot.voice.adapters.size + ' servers.'
    );
    return;
  } else if (args[0] === 'update') {
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
  } else if (args[0] === 'listu') {
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
};
