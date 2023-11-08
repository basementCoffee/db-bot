import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  commandHandlerCommon.playLink(event.message, event.args, event.message.guild!.id, event.server, undefined).then();
};
