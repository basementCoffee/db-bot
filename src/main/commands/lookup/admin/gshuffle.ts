import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.addRandomKeysToQueue(event.args, event.message, 'entries', event.server, false).then();
};
