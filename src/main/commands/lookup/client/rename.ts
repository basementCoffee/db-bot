import { MessageEventLocal } from '../../../utils/lib/types';
import { isShortCommandNoArgs } from '../../../utils/utils';
import { botInVC } from '../../../utils/utils';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  if (isShortCommandNoArgs(event.args, message.guild!, event.statement)) return;
  if (botInVC(message))
    message.channel.send('try `rename-key` or `rename-playlist` with the old name followed by the new name');
};
