import {getTitle} from "../utils/utils";
import {Message} from "discord.js";
import LocalServer from "../utils/lib/LocalServer";

/**
 * Purges an item from the queue.
 * @param message The message object.
 * @param server {LocalServer} The server object.
 * @param term {string} The term to purge.
 * @return {Promise<void>}
 */
async function runPurgeCommand(message: Message, server: LocalServer, term: string) {
  const sentMsg = await message.channel.send(`*purging **${term}**...*`);
  const count = await purgeItem(server.queue, async (item: any) => {
    return (await getTitle(item)).toLowerCase().includes(term);
  });
  sentMsg.edit(`*purged ${count} items from the queue*`);
}

/**
 * Purges the queue of all items that contain the term.
 * @param array The array to purge.
 * @param arrayItemApplicator A function that determines if the term is within an array item.
 */
async function purgeItem(array: any[], arrayItemApplicator: (item: any )=> Promise<boolean>) {
  // counter for how many items were purged
  let counter = 0;
  for (let i = 1; i < array.length; i++) {
    if (await arrayItemApplicator(array[i])) {
      array.splice(i, 1);
      counter++;
    }
  }
  return counter;
}


export { runPurgeCommand };
