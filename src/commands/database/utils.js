const {gsUpdateOverwrite, deleteRows} = require('./api/api');

/**
 * Serialize data. Assumes that the playlist exists or will create a new playlist.
 * @param keysMap {Map}
 * @param playlistName
 * @return {{keysString: string, valuesString: string}}
 */
function serializeData (keysMap, playlistName) {
  if (!keysMap) keysMap = new Map();
  let keysString;
  let valuesString = '';

  let tempObj = {
    pn: playlistName,
    ks: []
  };
  keysMap.forEach((val) => {
    tempObj.ks.push({
      kn: val.name,
      ts: val.ts
    });
    valuesString += `${val.link},`;
  });
  valuesString = valuesString.substring(0, valuesString.length - 1);
  keysString = JSON.stringify(tempObj);
  return {
    keysString,
    valuesString
  };
}

module.exports = {
  /**
   * Serialize and update the playlist within the database.
   * @param server
   * @param sheetName
   * @param playlistName
   * @param xdb
   * @param removePlaylist {boolean?} True if to delete the playlist.
   * @return {Promise<void>}
   */
  serializeAndUpdate: async (server, sheetName, playlistName, xdb, removePlaylist) => {
    let serializedData;
    // get the row number of the item to add/remove
    const playlistArrayUpper = xdb.playlistArray.map(item => item.toUpperCase());
    let row = playlistArrayUpper.indexOf(playlistName.toUpperCase());
    if (row === -1) row = xdb.playlistArray.length;
    // delete or serialize the playlist
    if (removePlaylist){
      deleteRows(sheetName, row + 2)
    }
    else {
      serializedData = serializeData(xdb.playlists.get(playlistName.toUpperCase()), playlistName);
      await gsUpdateOverwrite([serializedData.keysString, serializedData.valuesString],
        sheetName, 'E', row + 2, "F", row + 2);
    }
    server.userKeys.delete(sheetName);
  }
};