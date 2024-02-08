import { MessageEventLocal } from '../../../utils/lib/types';
import { sendListSize } from '../../../database/retrieval';

exports.run = async (event: MessageEventLocal) => {
  if (event.args[0]) sendListSize(event.message, event.server, 'entries', event.args[0]).then();
};
