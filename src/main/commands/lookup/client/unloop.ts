import { botInVC } from '../../../utils/utils';
import { MessageEventLocal } from '../../../utils/lib/types';

exports.run = async (event: MessageEventLocal) => {
  if (!botInVC(event.message)) {
    // only send error message for 'loop' command
    if (event.statement.length > 1) {
      await event.message.channel.send('must be actively playing to loop');
    }
    return;
  }
  if (event.server.loop) {
    event.server.loop = false;
    await event.message.channel.send('*looping disabled*');
  } else {
    await event.message.channel.send('*looping is already off*');
  }
};
