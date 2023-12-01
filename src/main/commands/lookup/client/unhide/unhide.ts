import { MessageEventLocal } from '../../../../utils/lib/types';
import { sendLinkAsEmbed } from '../../../stream/stream';

exports.run = async (event: MessageEventLocal) => {
  if (!event.message.member!.voice?.channel) {
    return event.message.channel.send('You must be in a voice channel to unsilence');
  }
  if (!event.server.silence) {
    return event.message.channel.send('*song notifications already unsilenced*');
  }
  event.server.silence = false;
  event.message.channel.send('*song notifications enabled*');
  if (event.server.audio.isVoiceChannelMember(event.message.member!)) {
    sendLinkAsEmbed(
      event.message,
      event.server.queue[0],
      event.message.member!.voice?.channel,
      event.server,
      false
    ).then();
  }
};
