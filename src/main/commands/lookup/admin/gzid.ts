import { MessageEventLocal } from '../../../utils/lib/types';
import { bot } from '../../../utils/lib/constants';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  message.channel.send(`g: ${message.guild!.id}, b: ${bot.user!.id}, m: ${message.member!.id}`);
};
