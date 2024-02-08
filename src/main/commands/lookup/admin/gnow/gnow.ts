import { MessageEventLocal } from '../../../../utils/lib/types';
import { runWhatsPCommand } from '../../../now-playing';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  await runWhatsPCommand(server, message, message.member!.voice?.channel, event.args[0], 'entries', 'g');
};
