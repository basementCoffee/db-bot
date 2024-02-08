import { MessageEventLocal } from '../../../../utils/lib/types';
import { runDeleteKeyCommand_P } from '../../../../database/delete';

exports.run = async (event: MessageEventLocal) => {
  // test remove database entries
  await runDeleteKeyCommand_P(event.message, event.args[0], 'entries', event.server);
};
