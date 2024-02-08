import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';
import { TextChannel } from 'discord.js';
import { getXdb2 } from '../../../../database/retrieval';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (!event.args[0]) return message.channel.send(`*no args provided (i.e. ${event.statement} [key] [playlist])*`);
  commandHandlerCommon.moveKeysBetweenPlaylists(
    server,
    <TextChannel>message.channel,
    'entries',
    await getXdb2(server, 'entries', false),
    event.args
  );
};
