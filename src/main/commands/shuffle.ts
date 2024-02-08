// shuffles the queue
import LocalServer from '../utils/lib/LocalServer';
import { Message } from 'discord.js';
import { botInVC } from '../utils/utils';
import { shuffleQueue } from '../utils/arrayUtils';

export function shuffleQueueCommand(server: LocalServer, message: Message) {
  if (!botInVC(message)) {
    message.channel.send('*must be in an active session to shuffle the queue*');
    return;
  }
  if (server.queue.length < 3) {
    message.channel.send('*not enough links in queue to shuffle*');
    return;
  }
  shuffleQueue(server);
  message.channel.send('*your queue has been shuffled*');
}
