import { MessageEventLocal } from '../../../../utils/lib/types';
import { runQueueCommand } from '../../../generateQueue';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  runQueueCommand(server, message, event.mgid, true);
};
