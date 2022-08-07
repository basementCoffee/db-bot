const { getTitle } = require('../utils/utils');

async function runPurgeCommand(message, server, term) {
  let sentMsg = await message.channel.send(`*purging **${term}**...*`);
  let count = await purgeItem(server.queue, async (item) => {
    return (await getTitle(item)).toLowerCase().includes(term);
  });
  sentMsg.edit(`*purged ${count} items from the queue*`);
}

/**
 * Purges the queue of all items that contain the term.
 * @param array The array to purge.
 * @param arrayItemApplicator A function that determines if the term is within an array item.
 */
async function purgeItem(array, arrayItemApplicator) {
  let counter = 0; // counter for how many items were purged
  for (let i = 1; i < array.length; i++) {
     if (await arrayItemApplicator(array[i])){
       array.splice(i, 1);
       counter++;
     }
  }
  return counter;
}


module.exports = {runPurgeCommand};