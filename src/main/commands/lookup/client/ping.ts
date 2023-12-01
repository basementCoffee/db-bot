import { MessageEventLocal } from '../../../utils/lib/types';
import { bot } from '../../../utils/lib/constants';

exports.run = async (event: MessageEventLocal) => {
  event.message.channel.send(`latency is ${Math.round(bot.ws.ping)}ms`);
};
