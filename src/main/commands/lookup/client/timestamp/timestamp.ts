import { MessageEventLocal } from '../../../../utils/lib/types';
import { formatDuration } from '../../../../utils/formatUtils';

exports.run = async (event: MessageEventLocal) => {
  if (!event.message.member!.voice?.channel) {
    event.message.channel.send('must be in a voice channel');
  } else if (event.server.audio.isVoiceChannelMember(event.message.member!)) {
    event.message.channel.send('timestamp: ' + formatDuration(event.server.audio.resource?.playbackDuration || 0));
  } else {
    event.message.channel.send('nothing is playing right now');
  }
};
