import LocalServer from '../utils/lib/LocalServer';
import { deleteRows, gsUpdateOverwrite, UserKeysData } from './api/api';

/**
 * Serialize data. Assumes that the playlist exists or will create a new playlist.
 * @param keysMap {Map}
 * @param playlistName {string}
 * @returns {{keysString: string, valuesString: string}}
 */
function serializeData(
  keysMap: Map<string, { name: string; timeStamp: string; link: string }>,
  playlistName: string
): { keysString: string; valuesString: string } {
  if (!keysMap) keysMap = new Map();
  if (!playlistName) throw new Error('expected playlist name');
  let valuesString = '';
  const tempObj: {
    // playlist name
    pn: string;
    // keys
    ks: Array<{
      // key name
      kn: string;
      // timestamp in seconds
      ts: number;
    }>;
  } = {
    pn: playlistName,
    ks: []
  };
  keysMap.forEach((val: any) => {
    tempObj.ks.push({
      kn: val.name,
      ts: val.ts
    });
    valuesString += `${val.link},`;
  });
  valuesString = valuesString.substring(0, valuesString.length - 1);
  const keysString = JSON.stringify(tempObj);
  return {
    keysString,
    valuesString
  };
}

/**
 * Serialize and update the playlist within the database. Uses xdb.playlists and xdb.playlistArray for updated data.
 * @param server {LocalServer} The server object.
 * @param sheetName The name of the sheet.
 * @param playlistName The name of the playlist.
 * @param xdb - the XDB data - is required
 * @param removePlaylist True if to delete the playlist.
 * @param newPlaylist Optional - the new playlist name IF renaming an existing playlist
 * @returns Whether the update request was sent.
 */
async function serializeAndUpdate(
  server: LocalServer,
  sheetName: string,
  playlistName: string,
  xdb: UserKeysData,
  removePlaylist = false,
  newPlaylist = ''
): Promise<boolean> {
  // get the row number of the item to add/remove
  const playlistArrayUpper = xdb.playlistArray.map((item: any) => item.toUpperCase());
  let row = playlistArrayUpper.indexOf(playlistName.toUpperCase());
  if (row === -1) row = xdb.playlistArray.length;
  // delete or serialize the playlist
  if (removePlaylist) {
    await deleteRows(sheetName, row + 2);
  } else {
    const playlist = xdb.playlists.get(playlistName.toUpperCase());
    if (!playlist) return false;
    const serializedData = serializeData(playlist, newPlaylist || playlistName);
    gsUpdateOverwrite([serializedData.keysString, serializedData.valuesString], sheetName, 'E', row + 2, 'F', row + 2);
  }
  server.userKeys.delete(sheetName);
  return true;
}

export { serializeAndUpdate };
