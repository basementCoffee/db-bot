import { TextChannel } from 'discord.js';
import LocalServer from '../utils/lib/LocalServer';
import { getXdb2 } from '../database/retrieval';
import { serializeAndUpdate } from '../database/utils';

/**
 * Renames a playlist.
 * @param channel The channel to send the message to.
 * @param server {LocalServer} The local server object.
 * @param sheetName The name of the sheet to rename the playlist in.
 * @param oldName The old name of the playlist.
 * @param newName The new name of the playlist.
 * @returns {Promise<boolean>} True if successful
 */
async function renamePlaylist(
  channel: TextChannel,
  server: LocalServer,
  sheetName: string,
  oldName: string,
  newName: string
): Promise<boolean> {
  const xdb = await getXdb2(server, sheetName, false);
  if (newName.length > 20) {
    await channel.send('*character count for playlist has been exceeded (max is 20)*');
    return false;
  }
  const playlist = xdb.playlists.get(oldName.toUpperCase());
  if (!playlist) {
    await channel.send(`*playlist ${oldName} does not exist*`);
    return false;
  }
  await serializeAndUpdate(server, sheetName, oldName, xdb, false, newName);
  await channel.send(`*${oldName} has been renamed to ${newName}*`);
  return true;
}

/**
 * Renames a key.
 * @param channel The channel to send the message to.
 * @param server {LocalServer}  The server metadata.
 * @param sheetName The name of the sheet to rename the key in.
 * @param oldName The old name of the key.
 * @param newName The new name of the key.
 * @returns {Promise<boolean>} True if successful
 */
async function renameKey(
  channel: TextChannel,
  server: LocalServer,
  sheetName: string,
  oldName: string,
  newName: string
): Promise<boolean> {
  const xdb = await getXdb2(server, sheetName, false);
  if (newName.length > 20) {
    await channel.send('*character count for key has been exceeded (max is 20)*');
    return false;
  }
  const oldNameUpper = oldName.toUpperCase();
  const keyObj = xdb.globalKeys.get(oldNameUpper);
  if (keyObj === undefined) {
    await channel.send('*key does not exist*');
    return false;
  }
  const newNameUpper = newName.toUpperCase();
  const keyObjTaken = xdb.globalKeys.get(newNameUpper);
  if (keyObjTaken) {
    await channel.send(`*new key-name is already in use within your ${keyObjTaken.playlistName} playlist*`);
  }
  const playlistName = keyObj.playlistName;
  const playlist = xdb.playlists.get(playlistName.toUpperCase());
  if (playlist === undefined) {
    await channel.send('*playlist does not exist*');
    return false;
  }
  const keyData = playlist.get(oldNameUpper);
  if (keyData === undefined) {
    await channel.send('*there was an error*');
    return false;
  }
  keyData.name = newName;

  const replacementMap = new Map();

  playlist.forEach((val: any, key: any) => {
    if (key === oldNameUpper) {
      val.name = newName;
      replacementMap.set(newNameUpper, val);
    } else {
      replacementMap.set(key, val);
    }
  });
  xdb.playlists.delete(playlistName);
  xdb.playlists.set(playlistName, replacementMap);
  xdb.globalKeys.set(newName.toUpperCase(), keyData);
  xdb.globalKeys.delete(oldName.toUpperCase());
  await serializeAndUpdate(server, sheetName, playlistName, xdb, false);
  channel.send('*key has been renamed*');
  return true;
}

export { renamePlaylist, renameKey };
