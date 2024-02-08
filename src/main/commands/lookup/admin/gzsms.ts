import { MessageEventLocal } from '../../../utils/lib/types';
import processStats from '../../../utils/lib/ProcessStats';
import LocalServer from '../../../utils/lib/LocalServer';

exports.run = async (event: MessageEventLocal) => {
  const param1 = event.args[0];
  const message = event.message;
  if (param1) {
    if (param1 === 'clear') {
      processStats.startUpMessage = '';
      return message.channel.send('start up message is cleared');
    }
    processStats.startUpMessage = message.content.substring(message.content.indexOf(param1));
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
};
