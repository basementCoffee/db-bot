import { MessageEventLocal } from '../../../utils/lib/types';
import { parentThread } from '../../../threads/parentThread';

exports.run = async (event: MessageEventLocal) => {
  parentThread('gzn', {}, [event.message.channel.id, parseInt(event.args[0]) || 1, event.args[1] === 'db']);
};
