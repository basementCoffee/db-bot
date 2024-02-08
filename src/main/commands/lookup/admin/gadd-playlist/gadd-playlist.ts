import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  if (!event.args[0]) {
    await event.message.channel.send(
      `*error: expected a playlist name to add (i.e. \`${event.statement} [playlist-name]\`)*`
    );
    return;
  }
  await commandHandlerCommon.addCustomPlaylist(event.server, event.message.channel, 'entries', event.args[0]);
};
