import { MessageEventLocal } from '../../../../utils/lib/types';
import { stopPlayingUtil } from '../../../stream/utils';

// stop session commands
exports.run = async (event: MessageEventLocal) => {
  stopPlayingUtil(event.message.member!.voice?.channel, false, event.server, event.message, event.message.member!.id);
};
