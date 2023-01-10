const { getTitle } = require('../utils/utils');
const { EmbedBuilderLocal } = require('../utils/lib/EmbedBuilderLocal');
const { DB_BOT_ICON_MED } = require('../utils/lib/constants');

/**
 * Find a title within the queue.
 * @param message The message object.
 * @param server {LocalServer} The server object.
 * @param term {string} The term to purge.
 * @return {Promise<void>}
 */
async function queueFind(message, server, term) {
  const sentMsg = await message.channel.send(`*looking for **${term}** within the queue...*`);
  let resultString = '';
  let count = 0;
  for (const item of server.queue) {
    const title = await getTitle(item);
    const isFound = title?.toLowerCase().includes(term);
    if (isFound) {
      resultString += `${count}. [${title}](${item.url})\n`;
    }
    count++;
  }
  new EmbedBuilderLocal()
    .setTitle(`'${term}' within the queue`)
    .setDescription(resultString || 'no results found')
    .setThumbnail(DB_BOT_ICON_MED)
    .edit(sentMsg);
}

module.exports = { queueFind };
