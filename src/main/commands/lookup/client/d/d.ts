import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';
import { getSheetName, isShortCommandNoArgs } from '../../../../utils/utils';
// retrieves and plays from the personal keys list
exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (isShortCommandNoArgs(event.args, message.guild!, event.statement)) return;
  commandHandlerCommon.playDBKeys(event.args, message, getSheetName(message.member!.id), false, true, server).then();
};
