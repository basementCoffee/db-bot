import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.keys(event.message, event.server, 'entries', null, event.args[0]).then();
};
