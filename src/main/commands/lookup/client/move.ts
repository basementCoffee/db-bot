import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  commandHandlerCommon.moveItemInQueue(message.channel, server, event.args[0], event.args[1]);
};
