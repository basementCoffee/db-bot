import { MessageEventLocal } from '../../../../utils/lib/types';
import { botInVC } from '../../../../utils/utils';
import { sendLinkAsEmbed } from '../../../stream/stream';

exports.run = async (event: MessageEventLocal) => {
  const message = event.message;
  const server = event.server;
  if (!message.member!.voice?.channel) {
    if (server.queue.length > 0) message.channel.send('must be in a voice channel to clear');
    return;
  }
  if (server.voteAdmin.length > 0 && !server.voteAdmin.includes(message.member)) {
    return message.channel.send('only the DJ can clear the queue');
  }
  if (server.dictator && server.dictator.id !== message.member!.id) {
    return message.channel.send('only the Dictator can clear the queue');
  }
  const currentQueueItem = botInVC(message) ? server.queue[0] : undefined;
  server.queue.length = 0;
  server.queueHistory.length = 0;
  if (currentQueueItem) {
    server.queue[0] = currentQueueItem;
    await sendLinkAsEmbed(message, currentQueueItem, message.member!.voice?.channel, server, false);
  }
  message.channel.send('The queue has been scrubbed clean');
};
