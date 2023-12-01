import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (!event.args[0]) return message.channel.send('*input a term to purge from the queue*');
  commandHandlerCommon.purgeWordFromQueue(message, server, event.args.join(' ').toLowerCase()).then();
};
