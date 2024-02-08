import { isShortCommand } from '../../../../utils/utils';
import commandHandlerCommon from '../../../CommandHandlerCommon';
import { MessageEventLocal } from '../../../../utils/lib/types';
import { botVersion } from '../../../../utils/lib/constants';

exports.run = async (event: MessageEventLocal) => {
  if (isShortCommand(event.message.guild!, event.statement)) return;
  commandHandlerCommon.help(event.message, event.server, event.data.get(botVersion));
};
