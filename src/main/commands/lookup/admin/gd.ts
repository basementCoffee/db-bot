import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  // test - run database links
  commandHandlerCommon.playDBKeys(event.args, event.message, 'entries', false, true, event.server).then();
};
