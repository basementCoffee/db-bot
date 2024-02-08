import { MessageEventLocal } from '../../../../utils/lib/types';
import { getSheetName } from '../../../../utils/utils';
import { runWhatsPCommand } from '../../../now-playing';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  await runWhatsPCommand(
    event.server,
    message,
    message.member!.voice?.channel,
    event.args[0],
    getSheetName(message.member!.id),
    ''
  );
};
