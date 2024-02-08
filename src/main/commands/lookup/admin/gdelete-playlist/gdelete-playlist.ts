import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';
import { getXdb2 } from '../../../../database/retrieval';
import { TextChannel } from 'discord.js';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  commandHandlerCommon
    .removeDBPlaylist(
      server,
      'entries',
      event.args[0],
      await getXdb2(server, 'entries', false),
      <TextChannel>message.channel
    )
    .then();
};
