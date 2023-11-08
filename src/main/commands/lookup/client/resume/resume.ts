import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';
import { isShortCommand } from '../../../../utils/utils';

exports.run = async (event: MessageEventLocal) => {
  if (isShortCommand(event.message.guild!, event.statement)) return;
  commandHandlerCommon.resumeStream(event.message, event.message.member!, event.server);
};
