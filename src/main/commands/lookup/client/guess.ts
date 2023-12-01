import { MessageEventLocal } from '../../../utils/lib/types';
import { bot } from '../../../utils/lib/constants';
import { VoiceChannel } from 'discord.js';
// guess a member in a voice channel
exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (event.args[0]) {
    const numToCheck = parseInt(event.args[0]);
    if (!numToCheck || numToCheck < 1) {
      return message.channel.send('Number has to be positive.');
    }
    const randomInt2 = Math.floor(Math.random() * numToCheck) + 1;
    message.channel.send(`*guessing from 1-${numToCheck}... chosen: **${randomInt2}***`);
  } else if (message.member?.voice?.channel) {
    try {
      let gmArray = Array.from(
        (<VoiceChannel>bot.channels.cache.get(message.member!.voice.channel.id.toString())).members
      );
      gmArray = gmArray.map((item: any) => item[1].nickname || item[1].user.username);
      if (gmArray.length < 1) {
        return message.channel.send('Need at least 1 person in a voice channel.');
      }
      const randomInt = Math.floor(Math.random() * gmArray.length) + 1;
      message.channel.send(`*chosen voice channel member: **${gmArray[randomInt - 1]}***`);
    } catch (e) {}
  } else {
    message.channel.send('need to be in a voice channel for this command');
  }
};
