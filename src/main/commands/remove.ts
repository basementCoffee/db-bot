import LocalServer from '../utils/lib/LocalServer';
import { BaseGuildTextChannel, GuildMember, Message } from 'discord.js';
import { updateActiveEmbed } from '../utils/embed';
import { serializeAndUpdate } from '../database/utils';

/**
 * Removes an item from the queue. Does not allow for the currently playing item to be removed from the queue (index 0).
 * @param message The message metadata.
 * @param server {LocalServer} The server metadata.
 * @param itemPosition The position in the queue to remove from (starting from 1).
 * @returns {Promise<*>}
 */
async function runRemoveCommand(message: Message, server: LocalServer, itemPosition: string) {
  if (!message.member!.voice?.channel) {
    return message.channel.send('you must be in a voice channel to remove items from the queue');
  }
  if (server.dictator && message.member!.id !== server.dictator.id) {
    return message.channel.send('only the dictator can remove');
  }
  if (
    server.voteAdmin.length > 0 &&
    server.voteAdmin.filter((x: GuildMember) => x.id === message.member!.id).length === 0
  ) {
    return message.channel.send('only a dj can remove');
  }
  if (server.queue.length < 2) return message.channel.send('*cannot remove from an empty queue*');
  let rNum = parseInt(itemPosition);
  if (!rNum) {
    if (server.queue.length === 2) {
      rNum = 1;
    } else {
      const example = '` Ex: remove 2`';
      return message.channel.send(
        `Needed a position in the queue to remove (1-${server.queue.length - 1})\n` +
          `***1** is next up in the queue, **${server.queue.length - 1}** is the last item in the queue ${example}*`
      );
    }
  }
  if (rNum >= server.queue.length) {
    return message.channel.send(
      '*that position is out of bounds, **' + (server.queue.length - 1) + '** is the last item in the queue.*'
    );
  }
  server.queue.splice(rNum, 1);
  await updateActiveEmbed(server);
  message.channel.send('*removed item from queue*');
}

/**
 * Removes a playlist. Returns false if playlist could not be found. Sends the response to the channel.
 * @param server {LocalServer} The server metadata.
 * @param sheetName The sheetname to update.
 * @param playlistName The playlist to remove.
 * @param xdb The XDB.
 * @param channel The channel to send the response to.
 * @returns {Promise<boolean>}
 */
async function removePlaylist(
  server: LocalServer,
  sheetName: string,
  playlistName: string,
  xdb: any,
  channel: BaseGuildTextChannel
) {
  const existingPlaylist = xdb.playlists.get(playlistName.toUpperCase());
  if (!existingPlaylist) {
    channel.send('*playlist does not exist*');
    return false;
  }
  await serializeAndUpdate(server, sheetName, playlistName, xdb, true);
  channel.send(`*deleted playlist ${playlistName}*`);
  return true;
}

export { runRemoveCommand, removePlaylist };
