import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

// stop session commands
exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.stopPlaying(
    event.mgid,
    event.message.member!.voice?.channel,
    false,
    event.server,
    event.message,
    event.message.member
  );
};
