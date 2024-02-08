import { MessageEventLocal } from '../../../utils/lib/types';
import { bot } from '../../../utils/lib/constants';
import { shutdown } from '../../../process/shutdown';

exports.run = async (event: MessageEventLocal) => {
  if (bot.voice.adapters.size > 0 && event.args[0] !== 'force') {
    event.message.channel.send("People are using the bot. Use this command again with 'force' to restart the bot");
  } else {
    event.message.channel.send('restarting the bot... (may only shutdown)').then(() => {
      shutdown('USER')();
    });
  }
};
