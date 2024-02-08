import { MessageEventLocal } from '../../../utils/lib/types';

exports.run = async (event: MessageEventLocal) => {
  const server = event.server;
  const message = event.message;
  if (server.queue[0]) {
    await message.channel.send(`url: ${server.queue[0].url}\nurlAlt: ${server.queue[0].urlAlt}`);
  } else {
    await message.channel.send('nothing is playing right now');
  }
};
