import { MessageEventLocal } from '../../../utils/lib/types';
import commandHandlerCommon from '../../CommandHandlerCommon';
import { StreamType, TWITCH_BASE_LINK } from '../../../utils/lib/constants';
import { createQueueItem } from '../../../utils/utils';
import { playLinkToVC } from '../../stream/stream';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  let channelLink = event.args[0];
  if (!channelLink) return message.channel.send(`*no channel name provided \` Ex: ${event.prefix}twitch [channel]\`*`);
  if (message.member!.voice?.channel) {
    if (!channelLink.includes(TWITCH_BASE_LINK)) {
      channelLink = `https://www.${TWITCH_BASE_LINK}/${channelLink}`;
    }
    server.queue.unshift(createQueueItem(channelLink, StreamType.TWITCH, null));
    playLinkToVC(message, channelLink, message.member!.voice.channel, server);
  } else {
    message.channel.send('*must be in a voice channel*');
  }
};
