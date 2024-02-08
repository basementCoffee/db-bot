import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  // test - run database commands
  commandHandlerCommon.playDBKeys(event.args, event.message, 'entries', true, true, event.server).then();
};
