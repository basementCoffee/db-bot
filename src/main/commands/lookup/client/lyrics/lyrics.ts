import { MessageEventLocal } from '../../../../utils/lib/types';
import { parentThread } from '../../../../threads/parentThread';

exports.run = async (event: MessageEventLocal) => {
  // gets the lyrics for what is playing and returns it to the text channel
  parentThread('lyrics', { channelId: event.message.channel.id }, [
    event.args,
    event.server.queue[0],
    event.message.member!.id
  ]);
};
