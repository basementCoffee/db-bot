import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  // test - random command
  commandHandlerCommon
    .addRandomKeysToQueue([event.args[0] || '1'], event.message, 'entries', event.server, false)
    .then();
};
