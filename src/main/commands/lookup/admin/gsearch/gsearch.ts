import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon
    .searchForKeyUniversal(
      event.message,
      event.server,
      'entries',
      event.args[0] ? event.args[0] : event.server.queue[0]?.url
    )
    .then();
};
