import { MessageEventLocal } from '../../../utils/lib/types';
import { sendMessageToUser } from '../../../utils/dms';

exports.run = async (event: MessageEventLocal) => {
  const id = event.args[0];
  if (!id || !parseInt(id)) return;
  sendMessageToUser(event.message, id, undefined);
};
