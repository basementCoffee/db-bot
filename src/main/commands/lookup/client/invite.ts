import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.joinVoiceChannelSafe(event.message, event.server).then();
};
