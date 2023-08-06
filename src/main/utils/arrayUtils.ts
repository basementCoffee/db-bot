import LocalServer from './lib/LocalServer';
import { AudioResource } from '@discordjs/voice';

/**
 * Adjusts the queue for play now depending on the stream time.
 * @param dsp {AudioResource} The dispatcher to reference.
 * @param server {LocalServer} The server to use.
 */
function adjustQueueForPlayNow(dsp: AudioResource, server: LocalServer) {
  if (server.queue[0] && dsp?.playbackDuration && dsp.playbackDuration > 21000) {
    server.queueHistory.push(server.queue.shift()!);
  }
}

/**
 * Shuffles the provided array in place.
 * @param array {Array<*>} The array to shuffle.
 * @returns {void}
 */
function shuffleArray(array: any[]): void {
  // indices for shuffling
  let currentIndex = array.length;
  let randomIndex;
  while (currentIndex > -1) {
    randomIndex = Math.floor(Math.random() * currentIndex) + 1;
    currentIndex--;
    // swap current and random index locations
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
}

// Shuffles the queue, maintains the position of the first item in the queue.
function shuffleQueue(server: LocalServer) {
  // save the first item to prevent it from being shuffled
  const firstItem = server.queue.shift();
  if (!firstItem) return;
  shuffleArray(server.queue);
  server.queue.unshift(firstItem);
}

export { adjustQueueForPlayNow, shuffleQueue, shuffleArray };
