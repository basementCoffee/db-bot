import { MessageEventLocal } from '../../../../utils/lib/types';
import processStats from '../../../../utils/lib/ProcessStats';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (processStats.devMode) {
    if (event.args[0]) {
      event.server.prefix = event.args[0];
      message.channel.send('*prefix has been changed*');
    } else {
      message.channel.send('*must provide prefix argument*');
    }
  } else {
    message.channel.send('*can only be performed in devmode*');
  }
};
