import { MessageEventLocal } from '../../../../utils/lib/types';
import commandHandlerCommon from '../../../CommandHandlerCommon';

exports.run = async (event: MessageEventLocal) => {
  // adds to the test database
  await commandHandlerCommon.addKeyToDB(
    event.message.channel,
    event.args,
    'entries',
    true,
    event.server,
    event.message.member
  );
};
